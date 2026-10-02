#!/usr/bin/env node
/**
 * Ingest legislation from Congress.gov → legislation + corpus
 *
 * Usage:
 *   node --env-file=server/.env server/seed/ingest-legislation.js
 *
 * Safe to re-run — uses ON CONFLICT DO NOTHING on source_id.
 */

import pg from 'pg';
import axios from 'axios';

const CONGRESS_BASE = 'https://api.congress.gov/v3';
const DELAY_MS = 500;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const CONGRESSES = [117, 118, 119];

function makePool() {
  return new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
}

function congressParams(extra = {}) {
  return { api_key: process.env.CONGRESS_API_KEY, format: 'json', ...extra };
}

function deriveStatus(bill) {
  const latest = bill.latestAction?.text?.toLowerCase() || '';
  if (bill.laws?.length > 0) return 'enacted';
  if (latest.includes('became public law')) return 'enacted';
  if (latest.includes('passed senate') && latest.includes('passed house')) return 'passed';
  if (latest.includes('vetoed')) return 'failed';
  return null;
}

async function fetchPage(congress, offset, retries = 5) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await axios.get(`${CONGRESS_BASE}/bill/${congress}`, {
        params: congressParams({ limit: 250, offset, sort: 'updateDate+desc' }),
        timeout: 30000,
      });
      return res.data;
    } catch (err) {
      if (attempt < retries) {
        const wait = 2000 * 2 ** attempt;
        console.warn(`  Fetch error (attempt ${attempt + 1}): ${err.code || err.message} — retrying in ${wait}ms`);
        await sleep(wait);
      } else {
        throw err;
      }
    }
  }
}

async function ingestPage(pool, congress, bills) {
  let inserted = 0;
  let skipped = 0;

  for (const bill of bills) {
    if (!bill.number || !bill.type) { skipped++; continue; }

    const status = deriveStatus(bill);
    const sourceId = `${bill.congress}-${bill.type}-${bill.number}`;
    const date = bill.introducedDate || null;

    const res = await pool.query(
      `INSERT INTO legislation
         (title, bill_number, bill_type, congress_number, status, introduced_date, source_id, source_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (source_id) DO NOTHING
       RETURNING id`,
      [bill.title || null, String(bill.number), bill.type.toLowerCase(),
       bill.congress, status, date, sourceId, bill.url || null]
    );

    if (res.rows.length === 0) { skipped++; continue; }

    await pool.query(
      `INSERT INTO corpus (entity_type, entity_id, title, date, branch)
       VALUES ('legislation', $1, $2, $3, 'legislative')
       ON CONFLICT (entity_type, entity_id) DO NOTHING`,
      [res.rows[0].id, bill.title || null, date]
    );

    inserted++;
  }

  return { inserted, skipped };
}

async function ingestCongress(congress) {
  let offset = 0;
  let total = null;
  let totalInserted = 0;
  let totalSkipped = 0;

  do {
    const data = await fetchPage(congress, offset);
    if (total === null) total = data.pagination?.count || 0;

    // Fresh pool per page to avoid Supabase connection timeouts
    const pool = makePool();
    try {
      const { inserted, skipped } = await ingestPage(pool, congress, data.bills || []);
      totalInserted += inserted;
      totalSkipped += skipped;
    } finally {
      await pool.end();
    }

    offset += 250;
    console.log(`  Congress ${congress} — offset ${offset}/${total} (${totalInserted} inserted, ${totalSkipped} skipped)`);
    await sleep(DELAY_MS);
  } while (offset < total);

  return totalInserted;
}

async function run() {
  // Ensure unique constraint
  const setup = makePool();
  await setup.query(
    `ALTER TABLE legislation ADD CONSTRAINT legislation_source_id_key UNIQUE (source_id)`
  ).catch(() => {});
  await setup.end();

  for (const congress of CONGRESSES) {
    console.log(`\nIngesting ${congress}th Congress...`);
    const count = await ingestCongress(congress);
    console.log(`  Done: ${count} inserted`);
  }

  console.log('\nIngest complete.');
}

run().catch(err => { console.error(err); process.exit(1); });
