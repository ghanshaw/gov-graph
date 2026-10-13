#!/usr/bin/env node
/**
 * Download the Census Bureau files the population section shows (lib/population/sources.js) into
 * the data directory, at their own paths (www2.census.gov/…). Nothing is loaded into the database.
 *
 *   node server/seed/fetch-population.js [--only apportionment,acs] [--years 2005-2019] [--dry-run]
 *
 * Collections are mirrored by listing their directories on www2.census.gov. The ACS is fetched by
 * year: the year's sequence lookup says which sequence files hold the tables in ACS_TABLES, and
 * only those are downloaded, for each state folder (which also holds its congressional districts)
 * and the nation, with each folder's geography file. From 2021 there is one file per table.
 *
 * Safe to re-run: files already on disk are kept.
 */

import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { mirrorFile, recordFetch } from '../lib/data-dir.js';
import {
  CENSUS, COLLECTIONS, DATA_FILE, SKIP_DIR, ACS, ACS_TABLES, ACS_SEQUENCE_YEARS, ACS_TABLE_YEARS,
} from '../lib/population/sources.js';
import { readLookup, LOOKUP_PATHS } from '../lib/population/acs.js';

const arg = name => {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
};
const DRY_RUN = process.argv.includes('--dry-run');
const ONLY = arg('--only')?.split(',');
const YEARS = (() => {
  const value = arg('--years');
  if (!value) return null;
  // 2005-2019, or a list of years and ranges: 2008,2011,2021-2024
  const ranges = value.split(',').map(r => r.split('-').map(Number)).map(([from, to = from]) => [from, to]);
  return y => ranges.some(([from, to]) => y >= from && y <= to);
})();
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (govgraph research)' };
// www2.census.gov rate-limits (HTTP 429 with a challenge page) when asked too fast: two downloads
// at a time, requests at least GAP ms apart, and a long pause when it says to slow down.
const PARALLEL = Number(arg('--parallel') ?? 2);
const GAP = 500;

const http = axios.create({ headers: HEADERS, timeout: 120_000 });
const sleep = ms => new Promise(r => setTimeout(r, ms));

let nextSlot = 0;
async function throttle() {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + GAP;
  if (wait) await sleep(wait);
}

/** A GET that waits its turn and backs off when the server asks it to. */
async function get(url, options = {}) {
  for (let attempt = 1; ; attempt++) {
    await throttle();
    try {
      return await http.get(url, options);
    } catch (err) {
      const status = err.response?.status;
      if ((status === 429 || status === 503) && attempt <= 6) {
        const after = Number(err.response.headers?.['retry-after']) || 60 * attempt;
        console.log(`    ${status} from the server; waiting ${after}s`);
        nextSlot = Date.now() + after * 1000;
        continue;
      }
      throw err;
    }
  }
}

const counts = { downloaded: 0, kept: 0, missing: 0, failed: 0, bytes: 0 };
const failures = [];

/** Names in a www2.census.gov directory listing: { files: [], dirs: [] }; null if there is none. */
async function listing(url) {
  let html;
  try {
    ({ data: html } = await get(url));
  } catch (err) {
    // 404: no such folder; 401 / 403: a folder not opened to the public yet (2025 in October 2026).
    if ([401, 403, 404].includes(err.response?.status)) return null;
    throw err;
  }
  // Cloudflare can keep a "Request Rejected" page in its cache for an address for days. Reported,
  // not read as an empty folder; retry later (do not try to get around it).
  if (/<title>Request Rejected<\/title>/i.test(String(html))) {
    counts.failed++;
    failures.push(`${url}: listing rejected (Cloudflare cached a "Request Rejected" page)`);
    return null;
  }
  // Names in this directory only: not absolute links, other hosts, or "../" back up the tree.
  const names = [...String(html).matchAll(/href="([^"?/:#.][^":#]*)"/g)].map(m => decodeURIComponent(m[1]))
    .filter(n => !n.includes('../'));
  return {
    files: names.filter(n => !n.endsWith('/')),
    dirs: names.filter(n => n.endsWith('/')),
  };
}

async function crawl(url, out = []) {
  const list = await listing(url);
  if (!list) return out;
  for (const f of list.files) if (DATA_FILE.test(f)) out.push(url + encodeURIComponent(f).replace(/%2F/g, '/'));
  for (const d of list.dirs) {
    const sub = url + d;
    if (SKIP_DIR.test(sub.slice(CENSUS.length))) continue;
    await crawl(sub, out);
  }
  return out;
}


// `always`: fetched even in a dry run (a year's lookup, which says what else is needed).
async function download(url, { always = false } = {}) {
  const file = mirrorFile(url);
  if (fs.existsSync(file)) {
    counts.kept++;
    return file;
  }
  if (DRY_RUN && !always) {
    counts.downloaded++;
    return null;
  }
  for (let attempt = 1; ; attempt++) {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const response = await get(url, { responseType: 'stream' });
      // A challenge or error page is never kept in place of the file.
      if (/text\/html/i.test(response.headers['content-type'] ?? '')) {
        response.data.destroy();
        throw new Error('server sent a web page, not the file');
      }
      await pipeline(response.data, fs.createWriteStream(`${file}.part`));
      fs.renameSync(`${file}.part`, file);
      recordFetch(file, url);
      counts.downloaded++;
      counts.bytes += fs.statSync(file).size;
      return file;
    } catch (err) {
      if (err.response?.status === 404) {
        counts.missing++;
        return null;
      }
      if (attempt >= 3) {
        counts.failed++;
        failures.push(`${url}: ${err.message}`);
        return null;
      }
      await sleep(2000 * attempt);
    }
  }
}

async function downloadAll(urls) {
  let next = 0;
  await Promise.all(Array.from({ length: PARALLEL }, async () => {
    while (next < urls.length) await download(urls[next++]);
  }));
}

// ---------------------------------------------------------------------------
// The ACS

/** Sequence-file years: the lookup, then each state folder's geography file and needed sequences. */
async function acsSequenceYear(year) {
  const lookupUrl = ACS + LOOKUP_PATHS[year];
  const lookupFile = await download(lookupUrl, { always: true });
  if (!lookupFile) {
    console.log(`  ${year}: no lookup at ${lookupUrl}`);
    return;
  }
  const lookup = readLookup(fs.readFileSync(lookupFile), lookupFile, XLSX);
  const wanted = new Set(ACS_TABLES.map(([id]) => id));
  const sequences = new Set();
  const found = [];
  for (const table of lookup.tables.values()) {
    if (!wanted.has(table.id)) continue;
    found.push(table.id);
    for (const part of table.parts) sequences.add(part.sequence);
  }
  const missingTables = [...wanted].filter(id => !found.includes(id));

  // The folder that holds one sub-folder per state (and one for the nation).
  const roots = ['data/1_year_seq_by_state/', 'data/1_year/', 'data/'];
  let root = null;
  let states = null;
  for (const r of roots) {
    const list = await listing(`${ACS}${year}/${r}`);
    const dirs = list?.dirs.filter(d => !/^(1_year|3_year|5_year)/.test(d) && /^[A-Z0-9]/i.test(d)) ?? [];
    if (dirs.length > 40) {
      root = r;
      states = dirs;
      break;
    }
  }
  if (!root) throw new Error(`${year}: no folder of states found`);

  const urls = [];
  for (const state of states) {
    const base = `${ACS}${year}/${root}${state}`;
    const list = await listing(base);
    for (const f of list?.files ?? []) {
      // Geography: g20091ca.txt, g20191ca.csv (both kept), cageo.2005-1yr
      if (/^g\d{5}[a-z]{2}\.(txt|csv)$/i.test(f) || /^[a-z]{2}geo\.\d{4}-1yr$/i.test(f)) {
        urls.push(base + f);
        continue;
      }
      // Sequences: 20091ca0001000.zip; ca0000001.2005-1yr.zip
      const m = /^\d{5}[a-z]{2}(\d{4})000\.zip$/i.exec(f) ?? /^[a-z]{2}(\d{7})\.\d{4}-1yr\.zip$/i.exec(f);
      if (m && sequences.has(Number(m[1]))) urls.push(base + f);
    }
  }
  console.log(`  ${year}: ${found.length} tables in ${sequences.size} sequences, ${states.length} folders, ${urls.length} files`
    + `${missingTables.length ? ` (not published that year: ${missingTables.join(', ')})` : ''}`);
  await downloadAll(urls);
}

/** Table-file years (2021–): one file per table, the geography list and the table shells. */
async function acsTableYear(year) {
  const doc = `${ACS}${year}/table-based-SF/documentation/`;
  const data = `${ACS}${year}/table-based-SF/data/1YRData/`;
  const list = await listing(data);
  if (!list || list.files.length === 0) {
    console.log(`  ${year}: not published yet`);
    return;
  }
  const urls = [
    `${doc}Geos${year}1YR.txt`,
    `${doc}ACS${year}1YR_Table_Shells.txt`,
    ...ACS_TABLES.map(([id]) => `${data}acsdt1y${year}-${id.toLowerCase()}.dat`),
  ];
  console.log(`  ${year}: ${urls.length} files`);
  await downloadAll(urls);
}

// ---------------------------------------------------------------------------

async function run() {
  for (const collection of COLLECTIONS) {
    if (ONLY && !ONLY.includes(collection.id)) continue;
    const urls = [];
    for (const dir of collection.dirs) await crawl(CENSUS + dir, urls);
    console.log(`${collection.title}: ${urls.length} files`);
    await downloadAll(urls);
  }
  if (!ONLY || ONLY.includes('acs')) {
    console.log('American Community Survey, 1-year');
    for (const year of ACS_SEQUENCE_YEARS) if (!YEARS || YEARS(year)) await acsSequenceYear(year);
    for (const year of ACS_TABLE_YEARS) if (!YEARS || YEARS(year)) await acsTableYear(year);
  }
  console.log(`\n${DRY_RUN ? 'Would download' : 'Downloaded'} ${counts.downloaded} files`
    + `${DRY_RUN ? '' : ` (${(counts.bytes / 1e6).toFixed(0)} MB)`}; kept ${counts.kept}; missing ${counts.missing}; failed ${counts.failed}`);
  for (const f of failures.slice(0, 30)) console.log(`  ${f}`);
  if (failures.length) process.exitCode = 1;
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
