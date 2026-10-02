#!/usr/bin/env node
/**
 * Fetch one president's executive orders from the govinfo API → seed/data/govinfo-<president>-eos.json
 *
 * Source: Compilation of Presidential Documents (collection CPD, package ids DCPD-*).
 * Each record carries metadata, govinfo's extracted references (e.g. U.S. Code
 * citations) and the full text. No database writes — this only builds the data file.
 *
 * Usage:
 *   node --env-file=server/.env server/seed/fetch-govinfo-executive-orders.js [--president obama | donald-trump | joseph-biden | donald-trump-47]
 *
 * Env:
 *   GOV_INFO_KEY — api.data.gov key (https://api.data.gov/signup/)
 *
 * Safe to re-run — rewrites the output file from scratch.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const API_KEY = process.env.GOV_INFO_KEY;
if (!API_KEY) {
  console.error('GOV_INFO_KEY is not set');
  process.exit(1);
}

const BASE_URL = 'https://api.govinfo.gov';
const COLLECTION = 'CPD';

// `id` is govinfo's president id; it excludes the other president's orders on a handover day.
const PRESIDENTS = {
  'obama':           { start: '2009-01-20', end: '2017-01-20', id: 'BHO' },
  'donald-trump':    { start: '2017-01-20', end: '2021-01-20', id: 'DJT' },
  'joseph-biden':    { start: '2021-01-20', end: '2025-01-20', id: 'JRB' },
  'donald-trump-47': { start: '2025-01-20', end: new Date().toISOString().slice(0, 10), id: 'DJT' },
};
const presidentFlag = process.argv.indexOf('--president');
const PRESIDENT_KEY = presidentFlag === -1 ? 'obama' : process.argv[presidentFlag + 1];
if (!PRESIDENTS[PRESIDENT_KEY]) {
  console.error(`Unknown president "${PRESIDENT_KEY}". Use: ${Object.keys(PRESIDENTS).join(' | ')}`);
  process.exit(1);
}
const { start: START_DATE, end: END_DATE, id: PRESIDENT_ID } = PRESIDENTS[PRESIDENT_KEY];
const PAGE_SIZE = 1000;
const DELAY_MS = 100;
const MAX_RETRIES = 4;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const OUT_FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'data',
  `govinfo-${PRESIDENT_KEY}-eos.json`
);

const TITLE_RE = /^Executive Order (\d+)\s*[-–—]\s*(.+)$/;

async function get(url, responseType = 'json') {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await axios.get(url, { params: { api_key: API_KEY }, responseType });
      return res.data;
    } catch (err) {
      const status = err.response?.status;
      const retryable = !status || status === 429 || status >= 500;
      if (!retryable || attempt >= MAX_RETRIES) throw err;
      await sleep(2000 * attempt);
    }
  }
}

async function listExecutiveOrders() {
  const orders = [];
  let url = `${BASE_URL}/published/${START_DATE}/${END_DATE}` +
    `?collection=${COLLECTION}&pageSize=${PAGE_SIZE}&offsetMark=*`;
  let seen = 0;

  while (url) {
    const data = await get(url);
    for (const pkg of data.packages || []) {
      seen++;
      const match = TITLE_RE.exec(pkg.title || '');
      if (match) orders.push({ ...pkg, number: match[1], shortTitle: match[2].trim() });
    }
    console.log(`  listed ${seen}/${data.count} packages (${orders.length} executive orders)`);
    url = data.nextPage;
    if (url) await sleep(DELAY_MS);
  }

  return orders;
}

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  mdash: '—', ndash: '–', sect: '§', para: '¶',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
};

// &eacute; etc. → base letter + combining mark, composed
const ACCENTS = {
  acute: '́', grave: '̀', circ: '̂',
  uml: '̈', tilde: '̃', cedil: '̧',
};

function htmlToText(html) {
  return html
    .replace(/<head[\s\S]*?<\/head\s*>/i, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/(p|div|h\d|li|tr|pre)\s*>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z])(acute|grave|circ|uml|tilde|cedil);/gi,
      (_, ch, accent) => (ch + ACCENTS[accent.toLowerCase()]).normalize('NFC'))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function fetchOrder(pkg) {
  const summary = await get(`${BASE_URL}/packages/${pkg.packageId}/summary`);
  if (summary.president?.id !== PRESIDENT_ID) return null;

  await sleep(DELAY_MS);
  const html = await get(`${BASE_URL}/packages/${pkg.packageId}/htm`, 'text');

  return {
    doc_type: 'executive_order',
    number: pkg.number,
    title: pkg.shortTitle,
    date_issued: summary.dateIssued || pkg.dateIssued,
    source: 'govinfo',
    source_id: pkg.packageId,
    source_url: summary.detailsLink || null,
    pdf_url: `https://www.govinfo.gov/content/pkg/${pkg.packageId}/pdf/${pkg.packageId}.pdf`,
    categories: summary.dcpdCategory || [],
    subjects: summary.subject || [],
    references: summary.references || [],
    body: htmlToText(html),
  };
}

async function run() {
  console.log(`Listing ${COLLECTION} packages issued ${START_DATE} → ${END_DATE}...`);
  const listed = await listExecutiveOrders();

  console.log(`\nFetching metadata and text for ${listed.length} executive orders...`);
  const orders = [];
  let excluded = 0;
  for (const [i, pkg] of listed.entries()) {
    const order = await fetchOrder(pkg);
    if (order) orders.push(order); else excluded++;
    if ((i + 1) % 25 === 0 || i + 1 === listed.length) {
      console.log(`  ${i + 1}/${listed.length} (${orders.length} kept, ${excluded} other presidents)`);
    }
    await sleep(DELAY_MS);
  }

  orders.sort((a, b) => Number(a.number) - Number(b.number));
  fs.writeFileSync(OUT_FILE, JSON.stringify(orders, null, 2) + '\n');
  console.log(`\nWrote ${orders.length} executive orders to ${OUT_FILE}`);
}

run().catch(err => {
  console.error(err.response?.data || err.message);
  process.exit(1);
});
