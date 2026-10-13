#!/usr/bin/env node
/**
 * Load roll call votes on bills → roll_calls + member_votes
 *
 * A roll call is one question put to a chamber ("On Passage of the Bill"); a member vote is
 * one member's answer in it (Yea, Nay, Present, Not Voting). The bill status zips say which
 * roll calls belong to which bill (and to which of its amendments); the vote files themselves
 * were downloaded by fetch-roll-calls.js and are read from the data directory.
 *
 * Usage:
 *   node --env-file=server/.env server/seed/load-roll-calls.js --congress 119 [--force] [--dry-run]
 *
 * Run load-bill-status-bulk.js first, so every bill has its `legislation` row.
 *
 * Env:
 *   DATABASE_URL — Supabase Postgres connection URI
 *
 * Safe to re-run — roll calls already stored are skipped unless `--force`, which replaces them.
 */

import fs from 'fs';
import pg from 'pg';
import { BILL_TYPES, bulkFile, congressRange, openZip, mirrorFile, valuesClause, LEGISLATOR_FILES } from '../lib/data-dir.js';
import { parseBillStatus } from '../lib/parse-bill-status.js';
import { parseRollCall } from '../lib/parse-roll-call.js';

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');
const arg = name => {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
};
if (!arg('--congress')) {
  console.error('Usage: --congress 119 | 115-119 [--force] [--dry-run]');
  process.exit(1);
}
const CONGRESSES = congressRange(arg('--congress'));

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS roll_calls (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chamber         TEXT NOT NULL,           -- 'House' | 'Senate'
    congress_number INT  NOT NULL,
    session         INT  NOT NULL,
    roll_number     INT  NOT NULL,
    vote_date       DATE,
    question        TEXT,                    -- "On Passage of the Bill"
    description     TEXT,
    vote_type       TEXT,                    -- House: "RECORDED VOTE", "YEA-AND-NAY"; Senate: majority required
    result          TEXT,                    -- "Passed", "Bill Passed", "Amendment Rejected"
    yea             INT NOT NULL DEFAULT 0,
    nay             INT NOT NULL DEFAULT 0,
    present         INT NOT NULL DEFAULT 0,
    not_voting      INT NOT NULL DEFAULT 0,
    tie_breaker     JSONB,                   -- { by, vote }
    legislation_id  UUID REFERENCES legislation(id),
    action_position INT,                     -- the bill_actions.position that records this vote
    amendment       TEXT,                    -- e.g. "SAMDT 2849" when the vote was on an amendment
    source_url      TEXT,
    UNIQUE (chamber, congress_number, session, roll_number)
  );
  CREATE INDEX IF NOT EXISTS roll_calls_legislation_id_idx ON roll_calls (legislation_id);
  CREATE TABLE IF NOT EXISTS member_votes (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    roll_call_id UUID NOT NULL REFERENCES roll_calls(id) ON DELETE CASCADE,
    bioguide_id  TEXT,                       -- the member's Bioguide id, where known
    lis_id       TEXT,                       -- Senate only: the id the Senate publishes
    name         TEXT,                       -- "Britt, Katie"
    party        TEXT,
    state        TEXT,
    position     TEXT NOT NULL               -- 'Yea' | 'Nay' | 'Present' | 'Not Voting'
  );
  CREATE INDEX IF NOT EXISTS member_votes_roll_call_id_idx ON member_votes (roll_call_id);
  CREATE INDEX IF NOT EXISTS member_votes_bioguide_id_idx ON member_votes (bioguide_id);
  -- the member as a person (load-people.js); filled from the Bioguide id
  ALTER TABLE member_votes ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES people(id);
  CREATE INDEX IF NOT EXISTS member_votes_person_id_idx ON member_votes (person_id);
`;

// Names for House members (their vote files print surnames only) and Bioguide ids for senators.
function legislators() {
  const byBioguide = new Map();
  const byLis = new Map();
  for (const url of LEGISLATOR_FILES) {
    const file = mirrorFile(url);
    if (!fs.existsSync(file)) throw new Error(`${file} is missing; run fetch-roll-calls.js first`);
    for (const person of JSON.parse(fs.readFileSync(file, 'utf8'))) {
      const name = [person.name.last, [person.name.first, person.name.suffix].filter(Boolean).join(' ')].join(', ');
      byBioguide.set(person.id.bioguide, name);
      if (person.id.lis) byLis.set(person.id.lis, person.id.bioguide);
    }
  }
  return { byBioguide, byLis };
}

async function store(client, vote, reference, legislationId, people) {
  const { rows } = await client.query(
    `INSERT INTO roll_calls
       (chamber, congress_number, session, roll_number, vote_date, question, description, vote_type, result,
        yea, nay, present, not_voting, tie_breaker, legislation_id, action_position, amendment, source_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
     ON CONFLICT (chamber, congress_number, session, roll_number) DO UPDATE
       SET vote_date = EXCLUDED.vote_date, question = EXCLUDED.question, description = EXCLUDED.description,
           vote_type = EXCLUDED.vote_type, result = EXCLUDED.result, yea = EXCLUDED.yea, nay = EXCLUDED.nay,
           present = EXCLUDED.present, not_voting = EXCLUDED.not_voting, tie_breaker = EXCLUDED.tie_breaker,
           legislation_id = EXCLUDED.legislation_id, action_position = EXCLUDED.action_position,
           amendment = EXCLUDED.amendment, source_url = EXCLUDED.source_url
     RETURNING id`,
    [
      vote.chamber, vote.congress, vote.session, vote.rollNumber, vote.date ?? reference.date, vote.question,
      vote.description, vote.voteType, vote.result, vote.totals.yea, vote.totals.nay, vote.totals.present,
      vote.totals.notVoting, vote.tieBreaker ? JSON.stringify(vote.tieBreaker) : null, legislationId,
      reference.actionPosition, reference.amendment ?? vote.amendment, reference.url,
    ]
  );
  const rollCallId = rows[0].id;

  await client.query('DELETE FROM member_votes WHERE roll_call_id = $1', [rollCallId]);
  if (vote.members.length === 0) return;
  const members = valuesClause(vote.members.map(m => {
    const bioguide = m.idType === 'bioguide' ? m.memberId : people.byLis.get(m.memberId) ?? null;
    return [
      rollCallId, bioguide, m.idType === 'lis' ? m.memberId : null,
      // The House prints surnames only; the full name comes from the legislators list.
      m.idType === 'bioguide' ? people.byBioguide.get(m.memberId) ?? m.name : m.name,
      m.party, m.state, m.position,
    ];
  }));
  await client.query(
    `INSERT INTO member_votes (roll_call_id, bioguide_id, lis_id, name, party, state, position, person_id)
     SELECT v.roll_call::uuid, v.bioguide, v.lis, v.name, v.party, v.state, v.position, p.id
       FROM (VALUES ${members.sql}) AS v(roll_call, bioguide, lis, name, party, state, position)
       LEFT JOIN people p ON p.bioguide_id = v.bioguide`,
    members.params
  );
}

async function run() {
  console.log(`Loading roll calls for Congress ${CONGRESSES.join(', ')}${FORCE ? ' (replacing stored ones)' : ''}${DRY_RUN ? ' (dry run)' : ''}...`);
  const people = legislators();
  const counts = { stored: 0, skipped: 0, missing: 0, failed: 0, members: 0, unmatched: 0 };
  const failures = [];

  const client = await pool.connect();
  try {
    // A dry run does everything inside one transaction and undoes it.
    if (DRY_RUN) await client.query('BEGIN');
    await client.query(SCHEMA);

    for (const congress of CONGRESSES) {
      const bills = await client.query('SELECT id, source_id FROM legislation WHERE congress_number = $1', [congress]);
      const legislationId = Object.fromEntries(bills.rows.map(r => [r.source_id, r.id]));
      const existing = await client.query('SELECT source_url FROM roll_calls WHERE congress_number = $1', [congress]);
      const stored = new Set(existing.rows.map(r => r.source_url));
      const before = counts.stored;

      for (const type of BILL_TYPES) {
        const zipFile = bulkFile('BILLSTATUS', congress, type);
        if (!fs.existsSync(zipFile)) continue;
        const zip = openZip(zipFile);
        try {
          for (const name of zip.files) {
            const bill = parseBillStatus(zip.read(name));
            for (const reference of bill.recordedVotes) {
              if (!FORCE && stored.has(reference.url)) { counts.skipped++; continue; }
              const file = mirrorFile(reference.url);
              if (!fs.existsSync(file)) { counts.missing++; continue; }
              try {
                const vote = parseRollCall(fs.readFileSync(file, 'utf8'));
                if (!DRY_RUN) await client.query('BEGIN');
                await store(client, vote, reference, legislationId[bill.sourceId] ?? null, people);
                if (!DRY_RUN) await client.query('COMMIT');
                stored.add(reference.url);
                counts.stored++;
                counts.members += vote.members.length;
                counts.unmatched += vote.members.filter(m => m.idType === 'lis' && !people.byLis.has(m.memberId)).length;
              } catch (err) {
                if (!DRY_RUN) await client.query('ROLLBACK').catch(() => {});
                else throw err; // inside the dry run's transaction nothing can continue after an error
                counts.failed++;
                failures.push(`${reference.url}: ${err.message}`);
              }
            }
          }
        } finally {
          zip.cleanup();
        }
      }
      console.log(`  Congress ${congress}: ${counts.stored - before} roll calls stored`);
    }
  } finally {
    if (DRY_RUN) await client.query('ROLLBACK').catch(() => {});
    client.release();
    await pool.end();
  }

  console.log(`\n${counts.stored} roll calls stored (${counts.members} member votes), ${counts.skipped} already stored`);
  if (counts.unmatched) console.log(`  ${counts.unmatched} Senate member votes have no Bioguide id (member not in the legislators list)`);
  if (counts.missing) console.log(`  ${counts.missing} vote files not on disk; run fetch-roll-calls.js`);
  if (failures.length) console.log(`  ${failures.length} failed:\n  ${failures.slice(0, 20).join('\n  ')}`);
  console.log(DRY_RUN ? '\nDry run — nothing written.' : '\nLoad complete.');
}

run().catch(err => { console.error(err); process.exit(1); });
