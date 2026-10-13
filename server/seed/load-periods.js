#!/usr/bin/env node
/**
 * Load dated periods (recessions, emergencies) from seed/data/periods.json → periods.
 *
 * The file is the original: each period is entered by hand from the documents it cites, and each
 * end records who determined it (start_by / end_by), the document (start_source / end_source), a
 * link (start_url / end_url) and, where the document can be stored in this database, a reference
 * (start_document / end_document: 'fr:<Federal Register document number>' or 'bill:<legislation
 * source_id>'), which the timeline turns into an in-app link once that document is loaded.
 * Re-running replaces the table's rows with the file's.
 *
 * Usage:
 *   node --env-file=server/.env server/seed/load-periods.js [--dry-run]
 *
 * Env:
 *   DATABASE_URL — Supabase Postgres connection URI
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const DRY_RUN = process.argv.includes('--dry-run');
const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'periods.json');

export const SCHEMA = `
  CREATE TABLE IF NOT EXISTS periods (
    id              SERIAL PRIMARY KEY,
    slug            TEXT NOT NULL UNIQUE,     -- 'covid-19-national-emergency', 'recession-2020'
    kind            TEXT NOT NULL,            -- 'recession' | 'public_health_emergency' | 'national_emergency'
    name            TEXT NOT NULL,
    start_date      DATE NOT NULL,            -- in effect from (a declaration may be dated later)
    end_date        DATE,                     -- NULL while ongoing
    start_by        TEXT,                     -- who determined it: 'President Donald J. Trump', 'NBER Business Cycle Dating Committee'
    start_source    TEXT,                     -- the document: 'Proclamation 9994, March 13, 2020, 85 FR 15337 …'
    start_url       TEXT,
    start_document  TEXT,                     -- 'fr:2020-05794' | 'bill:118-HJRES-7'
    end_by          TEXT,
    end_source      TEXT,
    end_url         TEXT,
    end_document    TEXT,
    notes           TEXT,
    loaded_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_date IS NULL OR end_date >= start_date)
  );
`;

const COLUMNS = ['slug', 'kind', 'name', 'start_date', 'end_date', 'start_by', 'start_source', 'start_url', 'start_document',
  'end_by', 'end_source', 'end_url', 'end_document', 'notes'];

function check(p) {
  for (const key of ['slug', 'kind', 'name', 'start_date']) if (!p[key]) throw new Error(`${p.slug ?? '?'}: ${key} is missing`);
  for (const key of ['start_date', 'end_date']) {
    if (p[key] && !/^\d{4}-\d{2}-\d{2}$/.test(p[key])) throw new Error(`${p.slug}: ${key} ${p[key]} is not YYYY-MM-DD`);
  }
  if (p.end_date && p.end_date < p.start_date) throw new Error(`${p.slug}: ends before it starts`);
  for (const key of ['start_document', 'end_document']) {
    if (p[key] && !/^(fr|bill):\S+$/.test(p[key])) throw new Error(`${p.slug}: ${key} must be fr:<number> or bill:<source_id>`);
  }
}

async function run() {
  const { periods } = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  periods.forEach(check);
  console.log(`Loading ${periods.length} periods${DRY_RUN ? ' (dry run)' : ''}...`);
  for (const p of periods) console.log(`  ${p.kind.padEnd(24)} ${p.start_date} – ${p.end_date ?? 'ongoing'}  ${p.name}`);
  if (DRY_RUN) return;

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(SCHEMA);
    for (const p of periods) {
      const values = COLUMNS.map(c => p[c] ?? null);
      await client.query(
        `INSERT INTO periods (${COLUMNS.join(', ')}, loaded_at) VALUES (${COLUMNS.map((_, i) => `$${i + 1}`).join(', ')}, now())
         ON CONFLICT (slug) DO UPDATE SET ${COLUMNS.slice(1).map(c => `${c} = EXCLUDED.${c}`).join(', ')}, loaded_at = now()`,
        values,
      );
    }
    const { rowCount } = await client.query('DELETE FROM periods WHERE NOT (slug = ANY($1))', [periods.map(p => p.slug)]);
    await client.query('COMMIT');
    console.log(`Done.${rowCount ? ` Removed ${rowCount} no longer in the file.` : ''}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
