#!/usr/bin/env node
/**
 * Ingest SCOTUS cases from CourtListener → cases + corpus
 *
 * Usage:
 *   node --env-file=server/.env server/seed/ingest-cases.js
 *
 * Safe to re-run — uses ON CONFLICT DO NOTHING on source_id (cluster_id).
 */

import pg from 'pg';
import axios from 'axios';
import { NATURAL_COURTS } from '../naturalCourts.js';

const COURTLISTENER_BASE = 'https://www.courtlistener.com/api/rest/v4';
const DELAY_MS = 1200;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function makePool() {
  return new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
}

function headers() {
  return { Authorization: `Token ${process.env.COURTLISTENER_TOKEN}` };
}

async function fetchPage(url, params = null, retries = 5) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await axios.get(url, {
        params: params || undefined,
        headers: headers(),
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

async function ingestCourt(court) {
  const pool = makePool();
  let inserted = 0;
  let skipped = 0;

  const baseParams = {
    type: 'o',
    court: 'scotus',
    filed_after: court.startDate,
    order_by: 'dateFiled asc',
    page_size: 20,
  };
  if (court.endDate) baseParams.filed_before = court.endDate;

  let nextUrl = `${COURTLISTENER_BASE}/search/`;
  let params = baseParams;
  let pageNum = 0;

  try {
    while (nextUrl) {
      await sleep(DELAY_MS);
      const data = await fetchPage(nextUrl, params);
      params = null; // subsequent pages use cursor URL directly
      nextUrl = data.next || null;
      pageNum++;

      // Retry DB inserts with fresh pool on connection failure
      for (let attempt = 0; attempt <= 5; attempt++) {
        const pool2 = makePool();
        try {
          for (const doc of data.results || []) {
            const clusterId = String(doc.cluster_id || doc.id);
            const date = doc.dateFiled || doc.date_filed || null;
            const name = doc.caseName || doc.case_name || 'Untitled';
            const docket = doc.docketNumber || doc.docket_number || null;
            const cite = Array.isArray(doc.citation) ? doc.citation[0] : doc.citation || null;
            const slug = doc.absolute_url
              ? doc.absolute_url.replace(/^\/opinion\/\d+\//, '').replace(/\/$/, '')
              : clusterId;
            const url = `https://www.courtlistener.com/opinion/${clusterId}/${slug}/`;

            const res = await pool2.query(
              `INSERT INTO cases (name, docket_number, date_decided, source_id, source_url)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (source_id) DO NOTHING
               RETURNING id`,
              [name, docket, date, clusterId, url]
            );

            if (res.rows.length === 0) { skipped++; continue; }
            const docId = res.rows[0].id;

            await pool2.query(
              `INSERT INTO corpus (entity_type, entity_id, title, date, branch)
               VALUES ('case', $1, $2, $3, 'judicial')
               ON CONFLICT (entity_type, entity_id) DO NOTHING`,
              [docId, name, date]
            );

            if (cite) {
              await pool2.query(
                `UPDATE cases SET citation = $1 WHERE id = $2 AND citation IS NULL`,
                [cite, docId]
              );
            }

            inserted++;
          }
          await pool2.end();
          break; // success
        } catch (err) {
          await pool2.end().catch(() => {});
          if (attempt < 5) {
            const wait = 3000 * 2 ** attempt;
            console.warn(`  DB error (attempt ${attempt + 1}): ${err.message} — retrying in ${wait}ms`);
            await sleep(wait);
            // Reset counters for this page — inserts use ON CONFLICT so re-running is safe
            inserted -= data.results?.filter(d => d).length || 0; // approximate reset
            inserted = Math.max(0, inserted);
          } else {
            throw err;
          }
        }
      }

      console.log(`  ${court.name} — page ${pageNum} (${inserted} inserted, ${skipped} skipped)`);
    }
  } finally {
    await pool.end();
  }

  return inserted;
}

async function run() {
  // Ensure unique constraint and citation column
  const setup = makePool();
  await setup.query(
    `ALTER TABLE cases ADD CONSTRAINT cases_source_id_key UNIQUE (source_id)`
  ).catch(() => {});
  await setup.query(
    `ALTER TABLE cases ADD COLUMN IF NOT EXISTS citation text`
  ).catch(() => {});
  await setup.end();

  // Resume from Roberts Court IV (index 5) — earlier courts already ingested
  for (const court of NATURAL_COURTS.slice(5)) {
    console.log(`\nIngesting ${court.name} (${court.startDate} → ${court.endDate || 'present'})...`);
    const count = await ingestCourt(court);
    console.log(`  Done: ${count} inserted`);
  }

  console.log('\nIngest complete.');
}

run().catch(err => { console.error(err); process.exit(1); });
