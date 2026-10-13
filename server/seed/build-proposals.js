#!/usr/bin/env node
/**
 * Rebuild the proposals of one or more Congresses from `bill_relationships` (lib/proposals.js).
 * load-bill-status-bulk.js and add-bill-relationship.js already do this; run it alone after
 * changing the pairing rule.
 *
 * Usage:
 *   node --env-file=server/.env server/seed/build-proposals.js --congress 119 [--dry-run]
 *
 * Env:
 *   DATABASE_URL — Supabase Postgres connection URI
 */

import pg from 'pg';
import { congressRange } from '../lib/data-dir.js';
import { buildProposals, PROPOSALS_SCHEMA } from '../lib/proposals.js';

const DRY_RUN = process.argv.includes('--dry-run');
const i = process.argv.indexOf('--congress');
if (i === -1) {
  console.error('Usage: --congress 119 | 115-119 [--dry-run]');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query(PROPOSALS_SCHEMA);
  for (const congress of congressRange(process.argv[i + 1])) {
    const { proposals, paired } = await buildProposals(client, congress);
    console.log(`${congress}: ${proposals} proposals (${paired} identical House–Senate pairs)`);
  }
  await client.query(DRY_RUN ? 'ROLLBACK' : 'COMMIT');
  console.log(DRY_RUN ? 'Dry run — nothing written.' : 'Done.');
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  throw err;
} finally {
  client.release();
  await pool.end();
}
