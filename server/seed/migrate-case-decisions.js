#!/usr/bin/env node
/**
 * One-time move of the decisions stored on `cases` rows (cases.structure, case_opinions.case_id)
 * to court_decisions, one row per decision (lib/decision-storage.js).
 *
 * For each `cases` row with text: rebuild the parsed decision from its head and its opinion rows,
 * store it with storeDecision (which also writes votes, links authors, and points every
 * CourtListener record of the decision at it), then remove the old opinion rows and clear
 * cases.structure. Votes and authors need the Justices; run load-justices.js first, or again after.
 *
 * Each decision is moved in its own transaction, so an interrupted run loses at most the decision
 * it was on; running again picks up the rest (only rows that still have cases.structure are read).
 * --dry-run moves everything in one transaction and rolls it back.
 *
 * Usage:
 *   node --env-file=server/.env server/seed/migrate-case-decisions.js [--dry-run]
 *
 * Env:
 *   DATABASE_URL — Supabase Postgres connection URI
 */

import pg from 'pg';
import { SCHEMA, storeDecision } from '../lib/decision-storage.js';

const DRY_RUN = process.argv.includes('--dry-run');

async function run() {
  console.log(`Moving stored decisions to court_decisions${DRY_RUN ? ' (dry run)' : ''}...`);
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    await client.query(SCHEMA);
    if (DRY_RUN) await client.query('BEGIN');
    const { rows: cases } = await client.query(
      `SELECT id, source_id, name, source_url, date_decided::text AS date, structure
         FROM cases WHERE structure IS NOT NULL ORDER BY date_decided`
    );
    const unmatched = new Set();
    for (const [i, row] of cases.entries()) {
      if (i % 25 === 0) console.log(`  ${i}/${cases.length}…`);
      if (!DRY_RUN) await client.query('BEGIN');
      const { rows: opinions } = await client.query(
        'SELECT structure FROM case_opinions WHERE case_id = $1 ORDER BY position',
        [row.id]
      );
      // The head keeps each opinion's metadata and outline; the opinion rows keep the text.
      const parsed = { ...row.structure, opinions: opinions.map(o => o.structure) };
      const stored = await storeDecision(client, parsed, {
        clusterId: row.source_id, caseName: row.name, dateFiled: row.date, url: row.source_url,
      });
      stored.unmatched.forEach(n => unmatched.add(n));
      await client.query('DELETE FROM case_opinions WHERE case_id = $1', [row.id]);
      await client.query('UPDATE cases SET structure = NULL WHERE id = $1', [row.id]);
      if (!DRY_RUN) await client.query('COMMIT');
    }

    const { rows: [counts] } = await client.query(
      `SELECT (SELECT count(*) FROM court_decisions)::int AS decisions,
              (SELECT count(*) FROM case_opinions WHERE decision_id IS NOT NULL)::int AS opinions,
              (SELECT count(*) FROM case_opinions WHERE case_id IS NOT NULL)::int AS old_opinions,
              (SELECT count(*) FROM court_votes)::int AS votes,
              (SELECT count(*) FROM cases WHERE decision_id IS NOT NULL)::int AS linked_records,
              (SELECT count(*) FROM cases WHERE structure IS NOT NULL)::int AS old_texts`
    );
    console.log(`  ${cases.length} stored decisions moved`);
    console.log(`  now: ${counts.decisions} decisions, ${counts.opinions} opinions, ${counts.votes} votes, ` +
      `${counts.linked_records} CourtListener records linked; left on cases: ${counts.old_texts} texts, ${counts.old_opinions} opinions`);
    if (unmatched.size) console.log(`  names with no Justice (run load-justices.js): ${[...unmatched].join(', ')}`);
    if (DRY_RUN) {
      await client.query('ROLLBACK');
      console.log('  dry run: rolled back');
    }
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
