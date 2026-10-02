#!/usr/bin/env node
/**
 * Ingest executive documents from Federal Register → executive_documents + corpus
 *
 * Usage:
 *   node --env-file=server/.env server/seed/ingest-executive-documents.js
 *
 * Safe to re-run — uses ON CONFLICT DO NOTHING on source_id.
 */

import pg from 'pg';
import axios from 'axios';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const BASE_URL = 'https://www.federalregister.gov/api/v1/documents';
const DELAY_MS = 500;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// donald-trump-47 shares the same FR API slug as donald-trump — all Trump EOs
// come back in one result set, so we only fetch once under 'donald-trump'.
const PRESIDENTS = [
  { slug: 'george-w-bush', apiSlug: 'george-w-bush', name: 'George W. Bush' },
  { slug: 'barack-obama',  apiSlug: 'barack-obama',   name: 'Barack Obama' },
  { slug: 'donald-trump',  apiSlug: 'donald-trump',   name: 'Donald Trump' },
  { slug: 'joseph-biden',  apiSlug: 'joe-biden',      name: 'Joe Biden' },
];

const DOC_TYPES = ['executive_order'];

async function fetchPage(apiSlug, docType, page) {
  const params = new URLSearchParams({
    'conditions[presidential_document_type]': docType,
    'conditions[president]': apiSlug,
    'per_page': 100,
    'page': page,
    'order': 'oldest',
  });
  [
    'document_number', 'executive_order_number', 'title',
    'signing_date', 'publication_date', 'html_url', 'president',
  ].forEach(f => params.append('fields[]', f));

  const res = await axios.get(`${BASE_URL}?${params.toString()}`);
  return res.data;
}

async function ingestPresident(client, president, docType) {
  let page = 1;
  let totalPages = 1;
  let inserted = 0;
  let skipped = 0;

  while (page <= totalPages) {
    const data = await fetchPage(president.apiSlug, docType, page);
    totalPages = data.total_pages || 1;

    for (const doc of data.results || []) {
      const date = doc.signing_date || doc.publication_date || null;
      const sourceId = doc.document_number || null;
      if (!sourceId) { skipped++; continue; }

      // Insert into executive_documents
      const res = await client.query(
        `INSERT INTO executive_documents
           (doc_type, number, title, signed_date, source_id, source_url)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (source_id) DO NOTHING
         RETURNING id`,
        [
          docType,
          doc.executive_order_number ? String(doc.executive_order_number) : null,
          doc.title || null,
          date,
          sourceId,
          doc.html_url || null,
        ]
      );

      if (res.rows.length === 0) { skipped++; continue; }

      const docId = res.rows[0].id;

      // Insert into corpus
      await client.query(
        `INSERT INTO corpus (entity_type, entity_id, title, date, branch)
         VALUES ('executive_document', $1, $2, $3, 'executive')
         ON CONFLICT (entity_type, entity_id) DO NOTHING`,
        [docId, doc.title || null, date]
      );

      inserted++;
    }

    console.log(`  ${president.name} / ${docType} — page ${page}/${totalPages} (${inserted} inserted, ${skipped} skipped)`);
    page++;
    if (page <= totalPages) await sleep(DELAY_MS);
  }

  return inserted;
}

async function run() {
  const client = await pool.connect();
  try {
    for (const president of PRESIDENTS) {
      for (const docType of DOC_TYPES) {
        console.log(`\nIngesting ${president.name} / ${docType}...`);
        const count = await ingestPresident(client, president, docType);
        console.log(`  Done: ${count} inserted`);
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
  console.log('\nIngest complete.');
}

run().catch(err => { console.error(err); process.exit(1); });
