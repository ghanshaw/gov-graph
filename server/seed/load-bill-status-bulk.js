#!/usr/bin/env node
/**
 * Load govinfo bill status zips → legislation (+ details) and bill_actions
 *
 * One status file per bill gives its title, sponsors, policy area, laws, text versions and
 * its history of actions. Every bill found gets a `legislation` row (created if missing,
 * keyed by source_id such as 119-HR-1); its actions and its sponsor and cosponsors
 * (`bill_sponsors`) replace whatever was stored before. Run load-people.js first, so
 * sponsorships are linked to people as they are stored.
 * Its related bills (`bill_relationships`, source 'congress.gov') replace the ones stored from its
 * earlier status file; relationships we added ourselves are kept. At the end each Congress's
 * proposals are rebuilt (lib/proposals.js): identical House–Senate pairs share one.
 * Every title the bill has been known by (`bill_titles`, source 'congress.gov': display, official,
 * short and popular titles) replaces the ones stored before; search reads them (lib/bill-search.js).
 * The raw status XML is not copied into the database — it stays in the zips on disk.
 *
 * Usage:
 *   node --env-file=server/.env server/seed/load-bill-status-bulk.js --congress 119 [--type hr] [--force] [--dry-run]
 *   node --env-file=server/.env server/seed/load-bill-status-bulk.js --congress 115-119
 *
 * Download the zips first: fetch-govinfo-bulk.js --collection BILLSTATUS --congress 115-119
 *
 * Env:
 *   DATABASE_URL — Supabase Postgres connection URI
 *
 * Safe to re-run — a bill whose stored update date matches its file is skipped, unless --force
 * (or unless its titles have not been stored yet).
 */

import fs from 'fs';
import pg from 'pg';
import { BILL_TYPES, bulkFile, congressRange, openZip, valuesClause } from '../lib/data-dir.js';
import { parseBillStatus } from '../lib/parse-bill-status.js';
import { buildProposals, PROPOSALS_SCHEMA } from '../lib/proposals.js';
import { titleKind } from '../lib/bill-search.js';

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');
const arg = name => {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
};
if (!arg('--congress')) {
  console.error('Usage: --congress 119 | 115-119 [--type hr] [--force] [--dry-run]');
  process.exit(1);
}
const CONGRESSES = congressRange(arg('--congress'));
const TYPES = arg('--type') ? [arg('--type').toLowerCase()] : BILL_TYPES;
const BATCH = 200; // bills per transaction

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const SCHEMA = `
  ALTER TABLE legislation ADD COLUMN IF NOT EXISTS details JSONB;
  ALTER TABLE bill_actions
    ADD COLUMN IF NOT EXISTS action_code TEXT,
    ADD COLUMN IF NOT EXISTS source_system TEXT,
    ADD COLUMN IF NOT EXISTS position INT;    -- order as published: 0 is the latest action
  CREATE INDEX IF NOT EXISTS bill_actions_legislation_id_idx ON bill_actions (legislation_id);
  -- The sponsor and cosponsors of a bill, with the party and state printed on it at the time.
  CREATE TABLE IF NOT EXISTS bill_sponsors (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legislation_id   UUID NOT NULL REFERENCES legislation(id) ON DELETE CASCADE,
    person_id        UUID REFERENCES people(id),
    bioguide_id      TEXT NOT NULL,
    role             TEXT NOT NULL,          -- 'sponsor' | 'cosponsor'
    position         INT  NOT NULL,          -- order as published
    sponsorship_date DATE,
    is_original      BOOLEAN,                -- cosponsor from the day the bill was introduced
    withdrawn_date   DATE,
    full_name        TEXT,                   -- "Rep. Bilirakis, Gus M. [R-FL-12]"
    party            TEXT,
    state            TEXT,
    district         TEXT,
    UNIQUE (legislation_id, role, position)
  );
  CREATE INDEX IF NOT EXISTS bill_sponsors_person_id_idx ON bill_sponsors (person_id);
  -- Bills related to a bill: from its status file (source 'congress.gov'; Congress.gov's wording
  -- and who identified each, e.g. CRS) or added by us (source 'govgraph', seed/add-bill-relationship.js).
  -- One row per listed relationship, direction as listed; the reverse comes from the other bill's file.
  CREATE TABLE IF NOT EXISTS bill_relationships (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legislation_id         UUID NOT NULL REFERENCES legislation(id) ON DELETE CASCADE,
    related_congress       INT  NOT NULL,
    related_type           TEXT NOT NULL,      -- lower case, as legislation.bill_type
    related_number         TEXT NOT NULL,
    related_legislation_id UUID REFERENCES legislation(id) ON DELETE SET NULL,  -- once that bill is loaded
    related_title          TEXT,
    relationship           TEXT NOT NULL,      -- 'Identical bill', 'Related bill', … or ours, e.g. 'Not identical'
    identified_by          TEXT,               -- 'CRS' | 'House' | 'Senate' | GPO | 'manual' | 'text-match'
    source                 TEXT NOT NULL,      -- 'congress.gov' | 'govgraph'
    note                   TEXT,               -- ours: why the link exists
    fetched_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (legislation_id, related_congress, related_type, related_number, relationship, source)
  );
  CREATE INDEX IF NOT EXISTS bill_relationships_related_idx ON bill_relationships (related_legislation_id);
  -- Every title a bill has been known by: from its status file (source 'congress.gov', title_type in
  -- Congress.gov's wording) or added by us (source 'govgraph', with a note), e.g. a name in common use
  -- that no publisher records.
  CREATE TABLE IF NOT EXISTS bill_titles (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legislation_id UUID NOT NULL REFERENCES legislation(id) ON DELETE CASCADE,
    title          TEXT NOT NULL,
    title_type     TEXT NOT NULL,      -- 'Popular Titles', 'Short Title(s) as Passed House', … or ours
    kind           TEXT NOT NULL,      -- popular | short | portion | display | official (lib/bill-search.js)
    chamber        TEXT,               -- as printed: House | Senate | Joint
    position       INT,                -- order in the status file
    source         TEXT NOT NULL,      -- 'congress.gov' | 'govgraph'
    note           TEXT                -- ours: where the name comes from
  );
  CREATE UNIQUE INDEX IF NOT EXISTS bill_titles_unique_idx ON bill_titles (legislation_id, title_type, md5(title), source);
  -- Each title's words, stored so search ranks without re-reading every matching title (lib/bill-search.js).
  ALTER TABLE bill_titles ADD COLUMN IF NOT EXISTS search tsvector
    GENERATED ALWAYS AS (to_tsvector('english', title)) STORED;
  ALTER TABLE legislation ADD COLUMN IF NOT EXISTS title_search tsvector
    GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, ''))) STORED;
  CREATE INDEX IF NOT EXISTS bill_titles_search_tsv_idx ON bill_titles USING gin (search);
  CREATE INDEX IF NOT EXISTS legislation_title_search_tsv_idx ON legislation USING gin (title_search);
  -- Looking a bill up by number (search: "H.R. 1" in any Congress) and listing a Congress.
  CREATE INDEX IF NOT EXISTS legislation_number_idx ON legislation (lower(bill_type), bill_number, congress_number);
  CREATE INDEX IF NOT EXISTS legislation_congress_idx ON legislation (congress_number);
${PROPOSALS_SCHEMA}`;

async function storeBatch(client, bills) {
  const upsert = valuesClause(bills.map(b => [
    b.title ?? `${b.type.toUpperCase()} ${b.number}`, b.number, b.type, b.congress, b.status,
    b.introducedDate, b.enactedDate, b.publicLawNumber, b.sourceId, b.details.url, JSON.stringify(b.details),
  ]));
  const { rows } = await client.query(
    `INSERT INTO legislation
       (title, bill_number, bill_type, congress_number, status, introduced_date, enacted_date,
        public_law_number, source_id, source_url, details)
     SELECT v.title, v.number, v.type, v.congress::int, v.status, v.introduced::date, v.enacted::date,
            v.law, v.source_id, v.url, v.details::jsonb
       FROM (VALUES ${upsert.sql}) AS v(title, number, type, congress, status, introduced, enacted, law, source_id, url, details)
     ON CONFLICT (source_id) DO UPDATE
       SET title = EXCLUDED.title, status = EXCLUDED.status,
           introduced_date = EXCLUDED.introduced_date, enacted_date = EXCLUDED.enacted_date,
           public_law_number = EXCLUDED.public_law_number, details = EXCLUDED.details,
           -- rows from the Congress.gov ingest keep the address they came with
           source_url = COALESCE(legislation.source_url, EXCLUDED.source_url)
     RETURNING id, source_id, title, introduced_date::text AS introduced, (xmax = 0) AS created`,
    upsert.params
  );
  const idOf = Object.fromEntries(rows.map(r => [r.source_id, r.id]));

  const created = rows.filter(r => r.created);
  if (created.length) {
    const corpus = valuesClause(created.map(r => [r.id, r.title, r.introduced]));
    await client.query(
      `INSERT INTO corpus (entity_type, entity_id, title, date, branch)
       SELECT 'legislation', v.id::uuid, v.title, v.date::date, 'legislative'
         FROM (VALUES ${corpus.sql}) AS v(id, title, date)
       ON CONFLICT (entity_type, entity_id) DO NOTHING`,
      corpus.params
    );
  }

  await client.query('DELETE FROM bill_actions WHERE legislation_id = ANY($1::uuid[])', [rows.map(r => r.id)]);
  const actions = bills.flatMap(b => b.actions.map(a => [
    idOf[b.sourceId], a.type, a.date, a.text, a.code, a.source, a.position,
  ]));
  for (let start = 0; start < actions.length; start += 1000) {
    const chunk = valuesClause(actions.slice(start, start + 1000));
    await client.query(
      `INSERT INTO bill_actions (legislation_id, action_type, action_date, description, action_code, source_system, position)
       SELECT v.id::uuid, v.type, v.date::date, v.text, v.code, v.source, v.position::int
         FROM (VALUES ${chunk.sql}) AS v(id, type, date, text, code, source, position)`,
      chunk.params
    );
  }

  await client.query('DELETE FROM bill_sponsors WHERE legislation_id = ANY($1::uuid[])', [rows.map(r => r.id)]);
  const sponsorships = bills.flatMap(b => b.sponsorships.map(s => [
    idOf[b.sourceId], s.bioguideId, s.role, s.position, s.date, s.isOriginal, s.withdrawnDate, s.fullName, s.party, s.state, s.district,
  ]));
  for (let start = 0; start < sponsorships.length; start += 1000) {
    const chunk = valuesClause(sponsorships.slice(start, start + 1000));
    await client.query(
      `INSERT INTO bill_sponsors
         (legislation_id, person_id, bioguide_id, role, position, sponsorship_date, is_original, withdrawn_date, full_name, party, state, district)
       SELECT v.id::uuid, p.id, v.bioguide, v.role, v.position::int, v.date::date, v.original::boolean, v.withdrawn::date,
              v.full_name, v.party, v.state, v.district
         FROM (VALUES ${chunk.sql}) AS v(id, bioguide, role, position, date, original, withdrawn, full_name, party, state, district)
         LEFT JOIN people p ON p.bioguide_id = v.bioguide`,
      chunk.params
    );
  }

  // Our own relationships (source 'govgraph') are left alone.
  await client.query(
    `DELETE FROM bill_relationships WHERE source = 'congress.gov' AND legislation_id = ANY($1::uuid[])`,
    [rows.map(r => r.id)]
  );
  const relationships = bills.flatMap(b => b.relatedBills.flatMap(r => r.relationships.map(d => [
    idOf[b.sourceId], r.congress, r.type, r.number, r.title, d.type, d.identifiedBy,
  ])));
  for (let start = 0; start < relationships.length; start += 1000) {
    const chunk = valuesClause(relationships.slice(start, start + 1000));
    await client.query(
      `INSERT INTO bill_relationships
         (legislation_id, related_congress, related_type, related_number, related_title, relationship, identified_by, source)
       SELECT v.id::uuid, v.congress::int, v.type, v.number, v.title, v.relationship, v.identified_by, 'congress.gov'
         FROM (VALUES ${chunk.sql}) AS v(id, congress, type, number, title, relationship, identified_by)
       ON CONFLICT DO NOTHING`,
      chunk.params
    );
  }

  await client.query(
    `DELETE FROM bill_titles WHERE source = 'congress.gov' AND legislation_id = ANY($1::uuid[])`,
    [rows.map(r => r.id)]
  );
  const titles = bills.flatMap(b => b.titles.map(t => [
    idOf[b.sourceId], t.title, t.type, titleKind(t.type), t.chamber, t.position,
  ]));
  for (let start = 0; start < titles.length; start += 1000) {
    const chunk = valuesClause(titles.slice(start, start + 1000));
    await client.query(
      `INSERT INTO bill_titles (legislation_id, title, title_type, kind, chamber, position, source)
       SELECT v.id::uuid, v.title, v.type, v.kind, v.chamber, v.position::int, 'congress.gov'
         FROM (VALUES ${chunk.sql}) AS v(id, title, type, kind, chamber, position)
       ON CONFLICT DO NOTHING`,
      chunk.params
    );
  }
  return {
    created: created.length, actions: actions.length, sponsorships: sponsorships.length,
    relationships: relationships.length, titles: titles.length,
  };
}

// Point relationships at the bills they name, now that more bills may be loaded.
async function linkRelatedBills(client) {
  const { rowCount } = await client.query(
    `UPDATE bill_relationships r SET related_legislation_id = l.id
       FROM legislation l
      WHERE r.related_legislation_id IS NULL
        AND l.source_id = r.related_congress || '-' || upper(r.related_type) || '-' || r.related_number`
  );
  return rowCount;
}

async function loadZip(client, congress, type, totals) {
  const zipFile = bulkFile('BILLSTATUS', congress, type);
  if (!fs.existsSync(zipFile)) { console.log(`  ${congress} ${type}: no zip on disk, skipped`); return; }

  const { rows } = await client.query(
    `SELECT source_id, details->>'updateDate' AS updated FROM legislation l
      WHERE congress_number = $1 AND lower(bill_type) = $2 AND details IS NOT NULL
        AND EXISTS (SELECT 1 FROM bill_titles t WHERE t.legislation_id = l.id AND t.source = 'congress.gov')`,
    [congress, type]
  );
  const stored = Object.fromEntries(rows.map(r => [r.source_id, r.updated]));

  const zip = openZip(zipFile);
  const counts = { bills: 0, unchanged: 0, created: 0, actions: 0, sponsorships: 0, relationships: 0, titles: 0, failed: 0 };
  try {
    let batch = [];
    // One transaction per batch; a dry run is already inside one that will be rolled back.
    const flush = async () => {
      if (batch.length === 0) return;
      if (!DRY_RUN) await client.query('BEGIN');
      try {
        const result = await storeBatch(client, batch);
        if (!DRY_RUN) await client.query('COMMIT');
        counts.created += result.created;
        counts.actions += result.actions;
        counts.sponsorships += result.sponsorships;
        counts.relationships += result.relationships;
        counts.titles += result.titles;
      } catch (err) {
        if (!DRY_RUN) await client.query('ROLLBACK');
        throw err;
      }
      batch = [];
    };

    for (const name of zip.files) {
      let bill;
      try {
        bill = parseBillStatus(zip.read(name));
      } catch (err) {
        counts.failed++;
        totals.failures.push(`${name}: ${err.message}`);
        continue;
      }
      counts.bills++;
      if (!FORCE && stored[bill.sourceId] && stored[bill.sourceId] === bill.details.updateDate) { counts.unchanged++; continue; }
      batch.push(bill);
      if (batch.length >= BATCH) await flush();
    }
    await flush();
  } finally {
    zip.cleanup();
  }

  console.log(`  ${congress} ${type}: ${counts.bills} bills (${counts.unchanged} unchanged, ${counts.created} new rows), ${counts.actions} actions, ${counts.sponsorships} sponsorships, ${counts.relationships} relationships, ${counts.titles} titles${counts.failed ? `, ${counts.failed} unreadable` : ''}`);
  for (const key of ['bills', 'unchanged', 'created', 'actions', 'sponsorships', 'relationships', 'titles']) totals[key] += counts[key];
}

async function run() {
  console.log(`Loading bill status for Congress ${CONGRESSES.join(', ')}${DRY_RUN ? ' (dry run)' : ''}...`);
  const totals = { bills: 0, unchanged: 0, created: 0, actions: 0, sponsorships: 0, relationships: 0, titles: 0, failures: [] };
  const client = await pool.connect();
  try {
    // A dry run does everything, new columns included, inside one transaction and undoes it.
    if (DRY_RUN) await client.query('BEGIN');
    await client.query(SCHEMA);
    for (const congress of CONGRESSES) {
      for (const type of TYPES) await loadZip(client, congress, type, totals);
    }

    // Then link relationships to the bills they name and regroup each Congress's proposals.
    if (!DRY_RUN) await client.query('BEGIN');
    try {
      console.log(`\n${await linkRelatedBills(client)} relationships linked to loaded bills`);
      for (const congress of CONGRESSES) {
        const { proposals, paired } = await buildProposals(client, congress);
        console.log(`  ${congress}: ${proposals} proposals (${paired} identical House–Senate pairs)`);
      }
      if (!DRY_RUN) await client.query('COMMIT');
    } catch (err) {
      if (!DRY_RUN) await client.query('ROLLBACK');
      throw err;
    }
  } finally {
    if (DRY_RUN) await client.query('ROLLBACK').catch(() => {});
    client.release();
    await pool.end();
  }
  console.log(`\n${totals.bills} bills read: ${totals.bills - totals.unchanged} stored (${totals.created} new legislation rows), ${totals.unchanged} unchanged, ${totals.actions} actions, ${totals.sponsorships} sponsorships, ${totals.relationships} relationships, ${totals.titles} titles`);
  if (totals.failures.length) console.log(`Unreadable files (${totals.failures.length}):\n  ${totals.failures.slice(0, 20).join('\n  ')}`);
  console.log(DRY_RUN ? '\nDry run — nothing written.' : '\nLoad complete.');
}

run().catch(err => { console.error(err); process.exit(1); });
