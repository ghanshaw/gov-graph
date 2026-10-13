#!/usr/bin/env node
/**
 * Load our own names for bills from seed/data/bill-names.json → bill_titles (source 'govgraph',
 * kind 'common', title_type 'Name in common use', the file's note).
 *
 * For names people use that no publisher records as a title: Congress.gov's titles (loaded by
 * load-bill-status-bulk.js) come first, and a name goes in the file only when they lack it. Each
 * entry names the bill by legislation source_id ("116-HRES-109"); a bill not in the database is
 * reported and skipped. Re-running replaces every govgraph title with the file's.
 *
 * Usage:
 *   node --env-file=server/.env server/seed/load-bill-names.js [--dry-run]
 *
 * Run load-bill-status-bulk.js once first: it creates bill_titles.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const DRY_RUN = process.argv.includes('--dry-run');
const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'bill-names.json');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const { names } = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM bill_titles WHERE source = 'govgraph'`);
    let stored = 0;
    for (const entry of names) {
      const { rowCount } = await client.query(
        `INSERT INTO bill_titles (legislation_id, title, title_type, kind, source, note)
         SELECT id, $2, 'Name in common use', 'common', 'govgraph', $3 FROM legislation WHERE source_id = $1`,
        [entry.bill, entry.name, entry.note]
      );
      if (rowCount) stored++;
      else console.log(`  ${entry.bill}: not in the database, skipped`);
    }
    await client.query(DRY_RUN ? 'ROLLBACK' : 'COMMIT');
    console.log(`${stored} of ${names.length} names stored${DRY_RUN ? ' (dry run — nothing written)' : ''}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => { console.error(err); process.exit(1); });
