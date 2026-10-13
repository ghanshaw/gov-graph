#!/usr/bin/env node
/**
 * Download the 2012 Statistical Abstract as the Census Bureau left it online (features/statistical-abstract,
 * Phase 2) into the data directory, at its own paths: the index page, every page it links (30 sections and six
 * others), and every file those pages link under 131ed/ (each table as .xls, the section PDFs, front matter and
 * appendices). Nothing is loaded; seed/load-statistical-abstract.js reads what is here.
 *
 *   node server/seed/fetch-statistical-abstract.js [--only construction-housing,prices] [--pages-only] [--refresh-pages] [--dry-run]
 *
 * One request at a time, GAP ms apart, as www2.census.gov rate-limits (see fetch-population.js); no contact
 * address, which the Census Bureau does not ask for. Files already on disk are kept; pages too, unless
 * --refresh-pages. Pages are fetched even in a dry run, as they say what to download. The other pages (rankings,
 * brief, maps) link files of earlier editions (129ed, 130ed) only; those are not fetched.
 */

import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import axios from 'axios';
import { DATA_DIR, mirrorFile, recordFetch } from '../lib/data-dir.js';
import { INDEX_URL, OTHER_PAGES, pageUrl, parseIndexPage, parseSectionPage, filesLinked } from '../lib/statab.js';

const arg = name => {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
};
const DRY_RUN = process.argv.includes('--dry-run');
const PAGES_ONLY = process.argv.includes('--pages-only');
const REFRESH_PAGES = process.argv.includes('--refresh-pages');
const ONLY = arg('--only')?.split(',');
const GAP = 500;

const http = axios.create({ headers: { 'User-Agent': 'Mozilla/5.0 (govgraph research)' }, timeout: 120_000 });
const sleep = ms => new Promise(r => setTimeout(r, ms));

let last = 0;
/** A GET one at a time, GAP ms after the last, backing off when the server says to slow down. */
async function get(url, options = {}) {
  for (let attempt = 1; ; attempt++) {
    const wait = last + GAP - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
    try {
      return await http.get(url, options);
    } catch (err) {
      const status = err.response?.status;
      if ((status === 429 || status === 503) && attempt <= 6) {
        const after = Number(err.response.headers?.['retry-after']) || 60 * attempt;
        console.log(`    ${status} from the server; waiting ${after}s`);
        last = Date.now() + after * 1000;
        continue;
      }
      throw err;
    }
  }
}

const counts = { pages: 0, downloaded: 0, kept: 0, missing: 0, failed: 0, bytes: 0 };
const failures = [];
const rel = file => path.relative(DATA_DIR, file);

/** A page's HTML, from disk unless missing or --refresh-pages; saved as fetched. */
async function page(url) {
  const file = mirrorFile(url);
  if (fs.existsSync(file) && !REFRESH_PAGES) return fs.readFileSync(file, 'utf8');
  const { data } = await get(url, { responseType: 'text' });
  if (/<title>Request Rejected<\/title>/i.test(data)) throw new Error(`${url}: request rejected (Cloudflare); try later`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
  recordFetch(file, url);
  counts.pages++;
  console.log(`  page ${rel(file)}`);
  return data;
}

async function download(url) {
  const file = mirrorFile(url);
  if (fs.existsSync(file)) { counts.kept++; return; }
  if (DRY_RUN) { counts.downloaded++; return; }
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
      return;
    } catch (err) {
      if (err.response?.status === 404) {
        counts.missing++;
        failures.push(`${url}: 404`);
        return;
      }
      if (attempt >= 3) {
        counts.failed++;
        failures.push(`${url}: ${err.message}`);
        return;
      }
      await sleep(2000 * attempt);
    }
  }
}

const index = parseIndexPage(await page(INDEX_URL));
const slugs = [...index.sections, ...OTHER_PAGES].filter(s => !ONLY || ONLY.includes(s));
console.log(`${index.sections.length} sections, ${index.others.length} other pages, ${index.files.length} files on the index`);

const files = ONLY ? [] : [...index.files];
for (const slug of slugs) {
  const html = await page(pageUrl(slug));
  if (index.sections.includes(slug)) {
    const s = parseSectionPage(html);
    const tables = s.groups.reduce((n, x) => n + x.tables.length, 0);
    console.log(`  Section ${s.number}. ${s.name}: ${s.groups.length} groups, ${tables} tables`);
  }
  files.push(...filesLinked(html));
}

const todo = [...new Set(files)];
if (!PAGES_ONLY) {
  console.log(`${todo.length} files linked${DRY_RUN ? ' (dry run)' : ''}`);
  for (const [i, url] of todo.entries()) {
    await download(url);
    if ((i + 1) % 100 === 0) console.log(`  ${i + 1} of ${todo.length}: ${counts.downloaded} downloaded, ${counts.kept} kept`);
  }
}

console.log(`\nPages fetched: ${counts.pages}. Files: ${counts.downloaded} ${DRY_RUN ? 'to download' : `downloaded (${(counts.bytes / 1e6).toFixed(1)} MB)`}, ${counts.kept} already here, ${counts.missing} missing, ${counts.failed} failed.`);
for (const f of failures) console.log(`  ${f}`);
