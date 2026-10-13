#!/usr/bin/env node
/**
 * Download a whole survey from the Bureau of Labor Statistics' bulk files into the data directory.
 *
 * Each survey is a folder at https://download.bls.gov/pub/time.series/<survey>/ of tab-separated
 * text: `<survey>.data.*` (every value of every series; `.data.1.AllData` has them all),
 * `<survey>.series` (one line per series with its codes), small code lists (`ln.sexs`, `ln.ages`,
 * …) and `<survey>.txt` describing them. Every file is kept under the publisher's own path
 * (lib/data-dir.js, mirrorFile):
 *   download.bls.gov/pub/time.series/ln/ln.data.1.AllData
 *
 * Surveys: ln (Current Population Survey: unemployment, labor force), cu (consumer prices),
 * ce (payrolls by industry), la (local area unemployment; very large), …
 *
 * BLS refuses scripted downloads whose User-Agent names no contact, so BLS_CONTACT_EMAIL is required.
 *
 * Usage:
 *   node --env-file=server/.env server/seed/fetch-bls-bulk.js --survey ln [--refresh] [--list]
 *
 * --list prints the folder's files and sizes without downloading. A file already on disk with the
 * listed size is kept unless --refresh.
 */

import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { mirrorFile, DATA_DIR } from '../lib/data-dir.js';

const arg = name => {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
};
const SURVEY = arg('--survey');
const REFRESH = process.argv.includes('--refresh');
const LIST = process.argv.includes('--list');
if (!SURVEY || !/^[a-z]{2}$/.test(SURVEY)) {
  console.error('Usage: --survey ln [--refresh] [--list]');
  process.exit(1);
}
if (!process.env.BLS_CONTACT_EMAIL) {
  console.error('BLS_CONTACT_EMAIL is not set (server/.env); BLS refuses scripted downloads without a contact.');
  process.exit(1);
}
const HEADERS = { 'User-Agent': `govgraph public records research (${process.env.BLS_CONTACT_EMAIL})` };
const FOLDER = `https://download.bls.gov/pub/time.series/${SURVEY}/`;
const mb = n => `${(n / 1e6).toFixed(1)} MB`;

/** The folder's listing (an IIS directory page) → [{ name, size, url }]. */
async function listFolder() {
  const res = await fetch(FOLDER, { headers: HEADERS });
  if (!res.ok) throw new Error(`${FOLDER}: ${res.status}`);
  const html = await res.text();
  const files = [];
  // Each entry: "<date> <time> <size> <A HREF="/pub/time.series/ln/ln.ages">ln.ages</A>"
  for (const m of html.matchAll(/(\d+)\s*<a href="([^"]+)">([^<]+)<\/a>/gi)) {
    const [, size, href, name] = m;
    if (href.endsWith('/')) continue;
    files.push({ name, size: Number(size), url: new URL(href, FOLDER).href });
  }
  if (!files.length) throw new Error(`${FOLDER}: no files found in the listing`);
  return files;
}

async function download(file) {
  const target = mirrorFile(file.url);
  if (!REFRESH && fs.existsSync(target) && fs.statSync(target).size === file.size) return 'kept';
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const res = await fetch(file.url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${file.url}: ${res.status}`);
  // Written beside the target and renamed when complete, so an interrupted download never looks finished.
  const partial = `${target}.partial`;
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(partial));
  const size = fs.statSync(partial).size;
  if (size !== file.size) throw new Error(`${file.name}: got ${size} bytes, listing says ${file.size}`);
  fs.renameSync(partial, target);
  return 'downloaded';
}

async function run() {
  const files = await listFolder();
  const total = files.reduce((n, f) => n + f.size, 0);
  console.log(`BLS survey ${SURVEY}: ${files.length} files, ${mb(total)}`);
  if (LIST) {
    for (const f of [...files].sort((a, b) => b.size - a.size)) console.log(`  ${f.name.padEnd(28)} ${mb(f.size).padStart(10)}`);
    return;
  }
  console.log(`  into ${path.join(DATA_DIR, 'download.bls.gov', 'pub', 'time.series', SURVEY)}`);
  const counts = { downloaded: 0, kept: 0 };
  // Largest last, so the small reference files are in place even if the big one is interrupted.
  for (const f of [...files].sort((a, b) => a.size - b.size)) {
    const started = Date.now();
    const result = await download(f);
    counts[result]++;
    if (result === 'downloaded' && f.size > 1e6) console.log(`  ${f.name}: ${mb(f.size)} in ${((Date.now() - started) / 1000).toFixed(0)} s`);
  }
  console.log(`Done: ${counts.downloaded} downloaded, ${counts.kept} already on disk.`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
