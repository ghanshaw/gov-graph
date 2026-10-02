#!/usr/bin/env node
/**
 * Load seed/data/govinfo-obama-eos.json → executive_documents (+ corpus)
 *
 * The Federal Register ingest already creates one row per executive order, so this
 * mostly fills in `body` on those rows, matched by EO number. Orders with no existing
 * row are inserted with the govinfo package id as source_id.
 *
 * Usage:
 *   node --env-file=server/.env server/seed/load-govinfo-executive-orders.js [--dry-run]
 *
 * Env:
 *   DATABASE_URL — Supabase Postgres connection URI
 *
 * Safe to re-run — only touches rows where body IS NULL; inserts use
 * ON CONFLICT DO NOTHING on source_id.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const DRY_RUN = process.argv.includes('--dry-run');

const DATA_FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'data',
  'govinfo-obama-eos.json'
);

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Federal Register correction / republication notices share the EO number but have
// source ids like C1-2009-31418 or R1-2016-03141 — they are not the order itself.
// (Ordinary 2009 documents look like E9-1712, so only the C/R prefixes are excluded.)
const NOT_A_NOTICE = `(source_id IS NULL OR source_id !~ '^[CR][0-9]-')`;

async function loadOrder(client, order) {
  const updated = await client.query(
    `UPDATE executive_documents
        SET body = $1
      WHERE doc_type = 'executive_order'
        AND number = $2
        AND body IS NULL
        AND ${NOT_A_NOTICE}
      RETURNING id`,
    [order.body, order.number]
  );
  if (updated.rows.length > 0) return 'updated';

  const existing = await client.query(
    `SELECT 1 FROM executive_documents
      WHERE doc_type = 'executive_order' AND number = $1 AND ${NOT_A_NOTICE}
      LIMIT 1`,
    [order.number]
  );
  if (existing.rows.length > 0) return 'skipped';

  const inserted = await client.query(
    `INSERT INTO executive_documents
       (doc_type, number, title, signed_date, body, source_id, source_url)
     VALUES ('executive_order', $1, $2, $3, $4, $5, $6)
     ON CONFLICT (source_id) DO NOTHING
     RETURNING id`,
    [order.number, order.title, order.date_issued, order.body, order.source_id, order.source_url]
  );
  if (inserted.rows.length === 0) return 'skipped';

  await client.query(
    `INSERT INTO corpus (entity_type, entity_id, title, date, branch)
     VALUES ('executive_document', $1, $2, $3, 'executive')
     ON CONFLICT (entity_type, entity_id) DO NOTHING`,
    [inserted.rows[0].id, order.title, order.date_issued]
  );
  return 'inserted';
}

async function run() {
  const orders = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  console.log(`Loading ${orders.length} executive orders from ${path.basename(DATA_FILE)}${DRY_RUN ? ' (dry run)' : ''}...`);

  const counts = { updated: 0, inserted: 0, skipped: 0 };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const order of orders) {
      counts[await loadOrder(client, order)]++;
    }
    await client.query(DRY_RUN ? 'ROLLBACK' : 'COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }

  console.log(`  ${counts.updated} bodies filled, ${counts.inserted} inserted, ${counts.skipped} skipped`);
  console.log(DRY_RUN ? '\nDry run — nothing written.' : '\nLoad complete.');
}

run().catch(err => { console.error(err); process.exit(1); });
