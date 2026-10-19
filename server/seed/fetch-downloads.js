#!/usr/bin/env node
/**
 * Download the list (Phase 5b): every file measured into server/seed/data/download-sizes.json by size-downloads.js
 * (run that first; it lists the folders, pages and catalogs in downloads.json) is saved into the data folder at the
 * publisher's path (lib/data-dir.js, mirrorFile) and logged with recordFetch. Files that failed to measure are left
 * out; a file already on disk is kept unless --refresh. Nothing is loaded.
 *
 * Requests go through lib/polite-fetch.js (2 at a time per host, 500 ms apart, backing off on 429 and 503), at most
 * 6 downloads at once in all. An HTML answer where a file was expected is refused, never saved. The run stops
 * starting downloads when the disk would drop below --min-free GB (default 8).
 *
 * Usage:
 *   node --env-file=server/.env server/seed/fetch-downloads.js [--program slug,slug] [--refresh] [--dry-run] [--min-free 8]
 */

import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { readDownloads, expandEntry, SIZES_FILE } from '../lib/downloads.js';
import { DATA_DIR, mirrorFile, recordFetch } from '../lib/data-dir.js';
import { polite, headersFor, htmlExpected } from '../lib/polite-fetch.js';

const arg = name => {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
};
const ONLY = arg('--program')?.split(',');
const REFRESH = process.argv.includes('--refresh');
const DRY = process.argv.includes('--dry-run');
const MIN_FREE = Number(arg('--min-free') ?? 8) * 1e9;
const AT_ONCE = 6;

const downloads = readDownloads();
const sizes = JSON.parse(fs.readFileSync(SIZES_FILE, 'utf8'));

// The names given in downloads.json, for URLs whose path does not end in the file's name (Output.aspx?rel=G19).
const names = new Map();
for (const p of Object.values(downloads.programs)) {
  for (const e of p.files ?? []) {
    if (!e.name) continue;
    const urls = expandEntry(e);
    const years = e.years ? String(e.years) : null;
    urls.forEach((u, i) => {
      const y = years ? String(expandEntry({ url: '{year}', years })[i]) : null;
      names.set(u, y ? e.name.replaceAll('{year}', y).replaceAll('{yy}', y.slice(-2)) : e.name);
    });
  }
}

// An Internet Archive capture is kept at the original address, with the capture in the log.
const ARCHIVED = /^https?:\/\/web\.archive\.org\/web\/\d+(?:id_)?\/(https?:\/\/.+)$/;

/** Where a URL is saved: the publisher's path, its given name in that folder, or index.html for a page address. */
function fileFor(url) {
  const original = url.match(ARCHIVED)?.[1] ?? url;
  const u = new URL(original);
  const base = mirrorFile(u.origin + u.pathname);
  const name = names.get(url);
  if (name) return path.join(u.pathname.endsWith('/') ? base : path.dirname(base), name);
  return u.pathname.endsWith('/') ? path.join(base, 'index.html') : base;
}

const todo = Object.entries(sizes.files)
  .filter(([, f]) => f.status < 400 && downloads.programs[f.program]?.files && (!ONLY || ONLY.includes(f.program)))
  .map(([url, f]) => ({ url, program: f.program, bytes: f.bytes ?? 0, file: fileFor(url) }));

const taken = new Map();
for (const t of todo) {
  if (taken.has(t.file)) throw new Error(`${t.url} and ${taken.get(t.file)} would both be saved as ${t.file}; give one a name`);
  taken.set(t.file, t.url);
}

const gb = n => `${(n / 1e9).toFixed(2)} GB`;
const mb = n => `${(n / 1e6).toFixed(1)} MB`;
const free = () => { const s = fs.statfsSync(DATA_DIR); return s.bavail * s.bsize; };

const waiting = todo.filter(t => REFRESH || !fs.existsSync(t.file));
const expected = waiting.reduce((s, t) => s + t.bytes, 0);
console.log(`${todo.length} files, ${todo.length - waiting.length} already on disk; ${waiting.length} to fetch, ${gb(expected)} measured`
  + ` (${waiting.filter(t => !t.bytes).length} of unknown size); ${gb(free())} free in ${DATA_DIR}`);
if (DRY) process.exit(0);

// At most AT_ONCE downloads in all, taken inside each host's turn so a busy host does not hold the others up.
let running = 0;
const queue = [];
const slot = async () => { while (running >= AT_ONCE) await new Promise(r => queue.push(r)); running++; };
const release = () => { running--; queue.shift()?.(); };

let done = 0, saved = 0, savedBytes = 0, stopped = false, inFlight = 0;
const failures = [];

async function download(t) {
  if (stopped) return { status: 'stopped' };
  // Counting what downloads already started will still write.
  if (free() - inFlight - t.bytes < MIN_FREE) {
    stopped = true;
    console.log(`STOP: ${gb(free())} free, under the ${gb(MIN_FREE)} floor; files not started are left for the next run`);
    return { status: 'stopped' };
  }
  await slot();
  inFlight += t.bytes;
  const part = `${t.file}.part`;
  try {
    const res = await fetch(t.url, { redirect: 'follow', signal: AbortSignal.timeout(3 * 3600e3), headers: headersFor(t.url) });
    if (!res.ok) { res.body?.cancel().catch(() => {}); return { status: res.status }; }
    if (/text\/html/i.test(res.headers.get('content-type') ?? '') && !htmlExpected(t.url, names.get(t.url))) {
      res.body?.cancel().catch(() => {});
      return { status: 'html' };
    }
    fs.mkdirSync(path.dirname(t.file), { recursive: true });
    await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(part));
    fs.renameSync(part, t.file);
    const archived = t.url.match(ARCHIVED);
    recordFetch(t.file, archived ? archived[1] : t.url, { archive: archived ? t.url : null });
    return { status: 200, bytes: fs.statSync(t.file).size };
  } catch (err) {
    fs.rmSync(part, { force: true });
    return { status: 0, error: err.cause?.code ?? err.message };
  } finally {
    inFlight -= t.bytes;
    release();
  }
}

await Promise.all(waiting.map(async t => {
  const r = await polite(t.url, () => download(t));
  done++;
  const at = `[${done}/${waiting.length}]`;
  if (r.status === 200) {
    saved++;
    savedBytes += r.bytes;
    console.log(`${at} ok ${mb(r.bytes)} ${path.relative(DATA_DIR, t.file)}`);
  } else if (r.status !== 'stopped') {
    failures.push({ ...t, ...r });
    console.log(`${at} FAILED ${r.status}${r.error ? ` ${r.error}` : ''} ${t.url}`);
  }
}));

console.log(`\n${saved} saved (${gb(savedBytes)}), ${failures.length} failed, ${waiting.length - saved - failures.length} not started; ${gb(free())} free`);
for (const f of failures) console.log(`FAILED ${f.status}${f.error ? ` ${f.error}` : ''} ${f.program} ${f.url}`);
