#!/usr/bin/env node
/**
 * Load the Justices of the Supreme Court → people + person_roles, and link the decisions that name them.
 *
 * Source: the Federal Judicial Center's biographical directory of federal judges (judges.csv,
 * public), read by lib/parse-fjc-justices.js. A Justice is a person with `fjc_id` (the
 * directory's nid); their service is one role per appointment, 'justice' or 'chief_justice'
 * (Rehnquist has both). Re-running keeps each person's uuid (matched by fjc_id) and replaces
 * their roles.
 *
 * Then links what is already stored (lib/decision-storage.js, linkAllJustices):
 *   court_votes            one row per Justice per stored decision, from its outcome
 *   case_opinions.author_id   the Justice who wrote each opinion
 *
 * Usage:
 *   node --env-file=server/.env server/seed/load-justices.js [--refresh] [--dry-run]
 *
 * The directory is downloaded into the data directory if missing (or with --refresh).
 *
 * Env:
 *   DATABASE_URL — Supabase Postgres connection URI
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';
import pg from 'pg';
import { mirrorFile, recordFetch } from '../lib/data-dir.js';
import { justicesFromFjc } from '../lib/parse-fjc-justices.js';
import { SCHEMA as DECISION_SCHEMA, linkAllJustices } from '../lib/decision-storage.js';

const DRY_RUN = process.argv.includes('--dry-run');
const REFRESH = process.argv.includes('--refresh');
const SOURCE = 'fjc';
const FJC_URL = 'https://www.fjc.gov/sites/default/files/history/judges.csv';

async function readDirectory() {
  const file = mirrorFile(FJC_URL);
  if (REFRESH || !fs.existsSync(file)) {
    const { data } = await axios.get(FJC_URL, { responseType: 'text', transformResponse: x => x, headers: { 'User-Agent': 'Mozilla/5.0 (govgraph)' } });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, data);
    recordFetch(file, FJC_URL);
    console.log(`  downloaded ${path.basename(file)}`);
  }
  return fs.readFileSync(file, 'utf8');
}

async function run() {
  console.log(`Loading the Justices${DRY_RUN ? ' (dry run)' : ''}...`);
  const justices = justicesFromFjc(await readDirectory());
  console.log(`  ${justices.length} Justices, ${justices.reduce((n, j) => n + j.roles.length, 0)} appointments`);

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(DECISION_SCHEMA);
    const existing = await client.query('SELECT id, fjc_id FROM people WHERE fjc_id IS NOT NULL');
    const idByFjc = new Map(existing.rows.map(r => [r.fjc_id, r.id]));
    let created = 0;
    for (const j of justices) {
      let id = idByFjc.get(j.fjcId);
      if (!id) { id = crypto.randomUUID(); created++; }
      await client.query(
        `INSERT INTO people (id, name, sort_name, first_name, last_name, gender, birth_date, death_date, fjc_id, other_ids)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE
           SET name = EXCLUDED.name, sort_name = EXCLUDED.sort_name, first_name = EXCLUDED.first_name,
               last_name = EXCLUDED.last_name, gender = EXCLUDED.gender, birth_date = EXCLUDED.birth_date,
               death_date = EXCLUDED.death_date, fjc_id = EXCLUDED.fjc_id,
               other_ids = COALESCE(people.other_ids, '{}'::jsonb) || EXCLUDED.other_ids`,
        [id, j.name, j.sortName, j.firstName, j.lastName, j.gender, j.birthDate, j.deathDate, j.fjcId,
          JSON.stringify(j.birthYear && !j.birthDate ? { birth_year: j.birthYear } : {})]
      );
      await client.query('DELETE FROM person_roles WHERE person_id = $1 AND source = $2', [id, SOURCE]);
      for (const role of j.roles) {
        await client.query(
          `INSERT INTO person_roles (person_id, role_type, started_at, ended_at, how, source) VALUES ($1, $2, $3, $4, $5, $6)`,
          [id, role.roleType, role.start, role.end, role.how, SOURCE]
        );
      }
    }
    console.log(`  ${justices.length} people stored (${created} new)`);
    const linked = await linkAllJustices(client);
    console.log(`  linked votes and authors for ${linked.decisions} decisions${linked.unmatched.length ? `; names with no Justice: ${linked.unmatched.join(', ')}` : ''}`);
    await client.query(DRY_RUN ? 'ROLLBACK' : 'COMMIT');
    if (DRY_RUN) console.log('  dry run: rolled back');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
