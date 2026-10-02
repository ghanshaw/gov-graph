#!/usr/bin/env node
/**
 * Fetch executive orders from the Federal Register API → seed/data/fr-eos-<president>.json
 *
 * Each record carries the publication metadata and the raw full-text HTML, which
 * load-executive-order-structure.js parses into the structured form. No database
 * writes — this only builds the data file.
 *
 * Usage:
 *   node server/seed/fetch-federal-register-executive-orders.js --president barack-obama
 *   node server/seed/fetch-federal-register-executive-orders.js --president donald-trump     (first term)
 *   node server/seed/fetch-federal-register-executive-orders.js --president joseph-biden
 *   node server/seed/fetch-federal-register-executive-orders.js --president donald-trump-47
 *
 * Safe to re-run — HTML already in the output file is kept, so only new orders are downloaded.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

// Both Trump terms share one Federal Register slug, so terms are split by signing date.
const PRESIDENTS = {
  'barack-obama':    { apiSlug: 'barack-obama', name: 'Barack Obama' },
  'donald-trump':    { apiSlug: 'donald-trump', name: 'Donald J. Trump', signedTo: '2021-01-20' },
  'joseph-biden':    { apiSlug: 'joe-biden', name: 'Joseph R. Biden, Jr.' },
  'donald-trump-47': { apiSlug: 'donald-trump', name: 'Donald J. Trump', signedFrom: '2025-01-20' },
};

const flag = process.argv.indexOf('--president');
const SLUG = flag === -1 ? null : process.argv[flag + 1];
const PRESIDENT = PRESIDENTS[SLUG];
if (!PRESIDENT) {
  console.error(`Usage: --president ${Object.keys(PRESIDENTS).join(' | ')}`);
  process.exit(1);
}

const BASE_URL = 'https://www.federalregister.gov/api/v1/documents';
const DELAY_MS = 250;
const MAX_RETRIES = 4;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const OUT_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', `fr-eos-${SLUG}.json`);

const FIELDS = [
  'document_number', 'executive_order_number', 'title', 'signing_date', 'publication_date',
  'citation', 'volume', 'start_page', 'end_page', 'html_url', 'body_html_url', 'pdf_url',
];

async function get(url, config) {
  for (let attempt = 1; ; attempt++) {
    try {
      return (await axios.get(url, config)).data;
    } catch (err) {
      const status = err.response?.status;
      const retryable = !status || status === 429 || status >= 500;
      if (!retryable || attempt >= MAX_RETRIES) throw err;
      await sleep(2000 * attempt);
    }
  }
}

async function listOrders() {
  const orders = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const params = new URLSearchParams({
      'conditions[presidential_document_type]': 'executive_order',
      'conditions[president]': PRESIDENT.apiSlug,
      per_page: 100,
      page,
      order: 'oldest',
    });
    if (PRESIDENT.signedFrom) params.set('conditions[signing_date][gte]', PRESIDENT.signedFrom);
    if (PRESIDENT.signedTo) params.set('conditions[signing_date][lte]', PRESIDENT.signedTo);
    FIELDS.forEach(f => params.append('fields[]', f));

    const data = await get(`${BASE_URL}?${params}`);
    totalPages = data.total_pages || 1;
    orders.push(...(data.results || []));
    console.log(`  listed page ${page}/${totalPages} (${orders.length}/${data.count})`);
    page++;
    if (page <= totalPages) await sleep(DELAY_MS);
  }
  return orders;
}

async function run() {
  const previous = fs.existsSync(OUT_FILE) ? JSON.parse(fs.readFileSync(OUT_FILE, 'utf8')) : [];
  const htmlByDocument = new Map(previous.filter(o => o.html).map(o => [o.document_number, o.html]));

  console.log(`Listing executive orders for ${PRESIDENT.name}...`);
  const listed = await listOrders();

  console.log(`\nFetching full text for ${listed.length} documents (${htmlByDocument.size} already on disk)...`);
  const orders = [];
  let failed = 0;
  for (const [i, doc] of listed.entries()) {
    let html = htmlByDocument.get(doc.document_number) ?? null;
    if (!html && doc.body_html_url) {
      try {
        html = await get(doc.body_html_url, { responseType: 'text' });
        await sleep(DELAY_MS);
      } catch (err) {
        failed++;
        console.error(`  ${doc.document_number} (EO ${doc.executive_order_number}): ${err.message}`);
      }
    }
    orders.push({ ...doc, president: { slug: SLUG, name: PRESIDENT.name }, html });
    if ((i + 1) % 50 === 0 || i + 1 === listed.length) console.log(`  ${i + 1}/${listed.length}`);
  }

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(orders, null, 1));
  console.log(`\nWrote ${orders.length} documents to ${path.relative(process.cwd(), OUT_FILE)} (${failed} without text)`);
}

run().catch(err => { console.error(err); process.exit(1); });
