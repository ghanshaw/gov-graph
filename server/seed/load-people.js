#!/usr/bin/env node
/**
 * Load people and their roles → people + person_roles, and link the records that name them.
 *
 * Source: the @unitedstates lists (public domain) of every member of Congress, current and
 * historical, and of every president and vice president (lib/parse-legislators.js). A person is
 * our own uuid; the Bioguide, Senate LIS and Wikidata ids are columns, every other id goes to
 * `other_ids`. Re-running keeps each person's uuid (matched by Bioguide id, else Wikidata id) and
 * replaces their roles.
 *
 * Then links what is already stored:
 *   member_votes.person_id       by Bioguide id
 *   bill_sponsors.person_id      by Bioguide id
 *   executive_documents.president_id   the president in office on the signing date
 *
 * Usage:
 *   node --env-file=server/.env server/seed/load-people.js [--refresh] [--dry-run]
 *
 * The lists are downloaded into the data directory if missing (or with --refresh).
 *
 * Env:
 *   DATABASE_URL — Supabase Postgres connection URI
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';
import pg from 'pg';
import { mirrorFile, valuesClause, LEGISLATOR_FILES, EXECUTIVE_FILE } from '../lib/data-dir.js';
import { mergePeople } from '../lib/parse-legislators.js';

const DRY_RUN = process.argv.includes('--dry-run');
const REFRESH = process.argv.includes('--refresh');
const SOURCE = 'congress-legislators';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const SCHEMA = `
  ALTER TABLE people
    ADD COLUMN IF NOT EXISTS sort_name        TEXT,   -- "Biden, Joe Jr."
    ADD COLUMN IF NOT EXISTS first_name       TEXT,
    ADD COLUMN IF NOT EXISTS last_name        TEXT,
    ADD COLUMN IF NOT EXISTS gender           TEXT,
    ADD COLUMN IF NOT EXISTS bioguide_id      TEXT,   -- Congress (sponsors, House votes)
    ADD COLUMN IF NOT EXISTS lis_id           TEXT,   -- Senate votes
    ADD COLUMN IF NOT EXISTS wikidata_id      TEXT,   -- across branches
    ADD COLUMN IF NOT EXISTS fjc_id           TEXT,   -- judges (Federal Judicial Center), not yet loaded
    ADD COLUMN IF NOT EXISTS courtlistener_id TEXT,   -- judges, not yet loaded
    ADD COLUMN IF NOT EXISTS other_ids        JSONB;  -- govtrack, icpsr, opensecrets, fec [list], wikipedia, …
  CREATE UNIQUE INDEX IF NOT EXISTS people_bioguide_id_key ON people (bioguide_id);
  CREATE UNIQUE INDEX IF NOT EXISTS people_lis_id_key ON people (lis_id);
  CREATE UNIQUE INDEX IF NOT EXISTS people_wikidata_id_key ON people (wikidata_id);
  CREATE UNIQUE INDEX IF NOT EXISTS people_fjc_id_key ON people (fjc_id);
  CREATE UNIQUE INDEX IF NOT EXISTS people_courtlistener_id_key ON people (courtlistener_id);
  CREATE INDEX IF NOT EXISTS people_sort_name_idx ON people (sort_name);

  -- One row per term as published; a term with a change of party is one row per party.
  -- role_type: 'representative' | 'senator' | 'vice_president' | 'president'
  ALTER TABLE person_roles
    ADD COLUMN IF NOT EXISTS district     INT,      -- House; 0 = at large
    ADD COLUMN IF NOT EXISTS senate_class INT,
    ADD COLUMN IF NOT EXISTS caucus       TEXT,     -- when it differs from the party
    ADD COLUMN IF NOT EXISTS how          TEXT,     -- 'appointment', 'special-election', …
    ADD COLUMN IF NOT EXISTS source       TEXT;
  CREATE INDEX IF NOT EXISTS person_roles_person_id_idx ON person_roles (person_id);
  CREATE INDEX IF NOT EXISTS person_roles_role_type_idx ON person_roles (role_type, started_at);

  ALTER TABLE member_votes ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES people(id);
  CREATE INDEX IF NOT EXISTS member_votes_person_id_idx ON member_votes (person_id);
`;

async function readList(url) {
  const file = mirrorFile(url);
  if (REFRESH || !fs.existsSync(file)) {
    const { data } = await axios.get(url, { responseType: 'text', transformResponse: x => x });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, data);
    console.log(`  downloaded ${path.basename(file)}`);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

async function insertChunks(client, rows, size, write) {
  for (let start = 0; start < rows.length; start += size) await write(valuesClause(rows.slice(start, start + size)));
}

async function storePeople(client, records) {
  const existing = await client.query('SELECT id, bioguide_id, wikidata_id FROM people');
  const idByKey = new Map();
  for (const r of existing.rows) {
    if (r.bioguide_id) idByKey.set(`b:${r.bioguide_id}`, r.id);
    if (r.wikidata_id) idByKey.set(`w:${r.wikidata_id}`, r.id);
  }
  let created = 0;
  for (const record of records) {
    const p = record.person;
    record.id = (p.bioguideId && idByKey.get(`b:${p.bioguideId}`)) || (p.wikidataId && idByKey.get(`w:${p.wikidataId}`));
    if (!record.id) { record.id = crypto.randomUUID(); created++; }
  }

  await insertChunks(client, records.map(({ id, person: p }) => [
    id, p.name, p.sortName, p.firstName, p.lastName, p.gender, p.birthDate, p.bioguideId, p.lisId, p.wikidataId,
    JSON.stringify(p.otherIds),
  ]), 500, chunk => client.query(
    `INSERT INTO people (id, name, sort_name, first_name, last_name, gender, birth_date, bioguide_id, lis_id, wikidata_id, other_ids)
     SELECT v.id::uuid, v.name, v.sort_name, v.first_name, v.last_name, v.gender, v.birth::date, v.bioguide, v.lis, v.wikidata, v.other::jsonb
       FROM (VALUES ${chunk.sql}) AS v(id, name, sort_name, first_name, last_name, gender, birth, bioguide, lis, wikidata, other)
     ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name, sort_name = EXCLUDED.sort_name, first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name, gender = EXCLUDED.gender, birth_date = EXCLUDED.birth_date,
           bioguide_id = EXCLUDED.bioguide_id, lis_id = EXCLUDED.lis_id, wikidata_id = EXCLUDED.wikidata_id,
           other_ids = EXCLUDED.other_ids`,
    chunk.params
  ));

  await client.query('DELETE FROM person_roles WHERE source = $1', [SOURCE]);
  const roles = records.flatMap(({ id, roles }) => roles.map(r => [
    id, r.roleType, r.start, r.end, r.party, r.state, r.chamber, r.district, r.senateClass, r.caucus, r.how, SOURCE,
  ]));
  await insertChunks(client, roles, 1000, chunk => client.query(
    `INSERT INTO person_roles (person_id, role_type, started_at, ended_at, party, state, chamber, district, senate_class, caucus, how, source)
     SELECT v.person::uuid, v.type, v.start::date, v.end::date, v.party, v.state, v.chamber, v.district::int, v.class::int, v.caucus, v.how, v.source
       FROM (VALUES ${chunk.sql}) AS v(person, type, start, "end", party, state, chamber, district, class, caucus, how, source)`,
    chunk.params
  ));
  return { created, roles: roles.length };
}

async function link(client) {
  const votes = await client.query(
    `UPDATE member_votes m SET person_id = p.id FROM people p
      WHERE p.bioguide_id = m.bioguide_id AND m.person_id IS DISTINCT FROM p.id`
  );
  const hasSponsors = (await client.query(`SELECT to_regclass('bill_sponsors') IS NOT NULL AS ok`)).rows[0].ok;
  const sponsors = hasSponsors ? await client.query(
    `UPDATE bill_sponsors s SET person_id = p.id FROM people p
      WHERE p.bioguide_id = s.bioguide_id AND s.person_id IS DISTINCT FROM p.id`
  ) : { rowCount: 0 };
  // The term starts at noon on January 20; a document signed that day is the incoming president's.
  const presidents = await client.query(
    `UPDATE executive_documents d SET president_id = r.person_id FROM person_roles r
      WHERE r.role_type = 'president' AND d.signed_date >= r.started_at AND d.signed_date < r.ended_at
        AND d.president_id IS DISTINCT FROM r.person_id`
  );
  const { rows: [missing] } = await client.query(
    `SELECT (SELECT count(*) FROM member_votes WHERE person_id IS NULL)::int AS votes,
            ${hasSponsors ? '(SELECT count(*) FROM bill_sponsors WHERE person_id IS NULL)::int' : '0'} AS sponsors,
            (SELECT count(*) FROM executive_documents WHERE president_id IS NULL)::int AS documents`
  );
  return { votes: votes.rowCount, sponsors: sponsors.rowCount, presidents: presidents.rowCount, missing };
}

async function run() {
  console.log(`Loading people${DRY_RUN ? ' (dry run)' : ''}...`);
  const lists = [];
  for (const url of [...LEGISLATOR_FILES, EXECUTIVE_FILE]) lists.push(await readList(url));
  const records = mergePeople(...lists);
  console.log(`  ${records.length} people from ${lists.map(l => l.length).join(' + ')} list entries`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(SCHEMA);
    const stored = await storePeople(client, records);
    console.log(`  ${records.length} people stored (${stored.created} new), ${stored.roles} roles`);
    const linked = await link(client);
    console.log(`  linked ${linked.votes} member votes, ${linked.sponsors} sponsorships, ${linked.presidents} presidential documents`);
    console.log(`  still unlinked: ${linked.missing.votes} member votes, ${linked.missing.sponsors} sponsorships, ${linked.missing.documents} presidential documents`);
    await client.query(DRY_RUN ? 'ROLLBACK' : 'COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
  console.log(DRY_RUN ? '\nDry run — nothing written.' : '\nLoad complete.');
}

run().catch(err => { console.error(err); process.exit(1); });
