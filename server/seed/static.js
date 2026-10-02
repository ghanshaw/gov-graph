#!/usr/bin/env node
/**
 * Seeds static metadata tables from congresses.js and naturalCourts.js.
 * Safe to re-run — uses ON CONFLICT DO NOTHING.
 *
 * Usage:
 *   node --env-file=server/.env server/seed/static.js
 */

import pg from 'pg';
import { CONGRESSES } from '../congresses.js';
import { NATURAL_COURTS } from '../naturalCourts.js';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    // Seed congresses
    for (const c of CONGRESSES) {
      await client.query(
        `INSERT INTO congresses (number, name, start_year, end_year, senate, house)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (number) DO NOTHING`,
        [c.number, c.name, c.startYear, c.endYear, c.senate, c.house]
      );
    }
    console.log(`Seeded ${CONGRESSES.length} congresses`);

    // Seed courts
    for (const c of NATURAL_COURTS) {
      await client.query(
        `INSERT INTO courts (name, slug, start_date, end_date)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (slug) DO NOTHING`,
        [c.name, c.slug, c.startDate, c.endDate ?? null]
      );
    }
    console.log(`Seeded ${NATURAL_COURTS.length} courts`);

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => { console.error(err); process.exit(1); });
