#!/usr/bin/env node
/**
 * Measure the download list (Phase 5a): every file named in server/seed/data/downloads.json is asked for
 * its size (HEAD, or a one-byte ranged GET where HEAD gives none), folders and pages are listed for their
 * files, and the results go to server/seed/data/download-sizes.json. Nothing is downloaded.
 *
 * At most 2 requests at a time per host, 500 ms apart, backing off on 429 and 503 (lib/polite-fetch.js).
 * A file already measured is kept unless --refresh.
 *
 * Usage:
 *   node --env-file=server/.env server/seed/size-downloads.js [--program slug,slug] [--refresh] [--report]
 *
 * --report prints the totals from download-sizes.json without asking anything.
 */

import fs from 'fs';
import { readSources } from '../lib/sources.js';
import { readDownloads, checkDownloads, expandEntry, SIZES_FILE } from '../lib/downloads.js';
import { request, htmlExpected } from '../lib/polite-fetch.js';

const arg = name => {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
};
const ONLY = arg('--program')?.split(',');
const REFRESH = process.argv.includes('--refresh');
const REPORT = process.argv.includes('--report');

const downloads = readDownloads();
const problems = checkDownloads(downloads, readSources());
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}

const sizes = fs.existsSync(SIZES_FILE) ? JSON.parse(fs.readFileSync(SIZES_FILE, 'utf8')) : { files: {} };
const save = () => fs.writeFileSync(SIZES_FILE, `${JSON.stringify(sizes, null, 1)}\n`);

/** A file's size and type without fetching it. `wanted` marks a web page saved on purpose (`name: '….html'`). */
async function measure(url, wanted) {
  let res = await request(url, { method: 'HEAD' });
  let bytes = Number(res.headers.get('content-length')) || null;
  if (!res.ok || !bytes) {
    // Some servers refuse HEAD or leave out the length; a one-byte range gives the whole size.
    const ranged = await request(url, { headers: { Range: 'bytes=0-0' } });
    ranged.body?.cancel().catch(() => {});
    const total = ranged.headers.get('content-range')?.match(/\/(\d+)$/)?.[1];
    if (ranged.ok) {
      res = ranged;
      bytes = total ? Number(total) : ranged.status === 200 ? Number(ranged.headers.get('content-length')) || null : null;
    } else if (!res.ok && [405, 416, 500, 501].includes(ranged.status)) {
      // An API that answers neither HEAD nor a range (OECD's SDMX: 405, then 416 or 500): start the whole
      // response and stop at the headers; it is reachable, its size unknown.
      const plain = await request(url);
      plain.body?.cancel().catch(() => {});
      if (plain.ok) { res = plain; bytes = Number(plain.headers.get('content-length')) || null; }
    }
  }
  const type = res.headers.get('content-type')?.split(';')[0] ?? null;
  const page = type === 'text/html' && !wanted && !htmlExpected(url);
  return {
    status: page ? 'html' : res.status,
    ...(res.error && { error: res.error }),
    bytes,
    type,
    modified: res.headers.get('last-modified') ?? null,
    final: res.url && res.url !== url ? res.url : undefined,
  };
}

/** The files linked from a folder or page: links under the folder (or, for a page, matching `match`). */
async function listLinks(entry) {
  const res = await request(entry.list);
  if (!res.ok) return { error: `${entry.list}: ${res.status} ${res.error ?? ''}`.trim(), urls: [] };
  const html = await res.text();
  const base = res.url || entry.list;
  const match = entry.match ? new RegExp(entry.match, 'i') : null;
  // Keyed by the address without its query, which `match` and `follow` are tested against; the link is kept
  // as published (a query may be needed, as in Output.aspx?…, or only bust a cache, as ERS's ?v=…).
  const urls = new Map();
  const folders = new Set();
  const follow = entry.follow ? new RegExp(entry.follow, 'i') : null;
  const pages = new Set();
  for (const [, href] of html.matchAll(/href\s*=\s*["']([^"'#]+)["']/gi)) {
    let u;
    try { u = new URL(href.replaceAll('&amp;', '&'), base); } catch { continue; }
    const p = u.origin + u.pathname;
    // A page list with `follow` opens the pages it links to that match, one level down (a menu of tables).
    if (entry.page && follow) { if (follow.test(p)) pages.add(u.href); else if (match?.test(p)) urls.set(p, u.href); continue; }
    if (!entry.page && !p.startsWith(entry.list.replace(/^http:/, 'https:')) && !p.startsWith(entry.list)) continue;
    if (p === base || p === entry.list) continue;
    if (p.endsWith('/')) { if (p.length > entry.list.length) folders.add(p); continue; }
    if (match && !match.test(p)) continue;
    if (!entry.page || match) urls.set(p, u.href);
  }
  // Pages and folders are listed together; polite() keeps each host to two requests at a time.
  const add = sub => sub.urls.forEach(u => { const x = new URL(u); urls.set(x.origin + x.pathname, u); });
  for (const sub of await Promise.all([...pages].map(page => listLinks({ list: page, page: true, match: entry.match })))) add(sub);
  // `recursive` descends into every subfolder; `follow` only into those matching it.
  if (!entry.page && (entry.recursive || follow)) {
    const subs = await Promise.all([...folders].filter(f => !follow || follow.test(f)).map(f => listLinks({ ...entry, list: f })));
    subs.forEach(add);
  }
  return { urls: [...urls.values()] };
}

/** The download URLs of a DCAT catalog's datasets whose title matches (and, with `match`, URLs matching). */
async function listCatalog(entry) {
  const res = await request(entry.catalog);
  if (!res.ok) return { error: `${entry.catalog}: ${res.status} ${res.error ?? ''}`.trim(), urls: [] };
  const title = new RegExp(entry.title, 'i');
  const match = entry.match ? new RegExp(entry.match, 'i') : null;
  const urls = (await res.json()).dataset
    .filter(ds => title.test(ds.title))
    .flatMap(ds => (ds.distribution ?? []).map(x => x.downloadURL).filter(Boolean))
    .filter(u => !match || match.test(u));
  return { urls: [...new Set(urls)] };
}

async function measureProgram(slug, d) {
  const listed = [];
  const errors = [];
  const pages = new Set();
  for (const e of d.files ?? []) {
    if (e.catalog) {
      const { urls, error } = await listCatalog(e);
      if (error) errors.push(error);
      if (!urls.length && !error) errors.push(`${e.catalog}: no ${e.match ? `files matching ${e.match} in datasets` : 'datasets'} titled ${e.title}`);
      listed.push(...urls);
    } else if (e.list) {
      for (const list of expandEntry({ ...e, url: e.list, list: undefined })) {
        const { urls, error } = await listLinks({ ...e, list });
        if (error) errors.push(error);
        if (!urls.length && !error) errors.push(`${list}: no files listed`);
        listed.push(...urls);
      }
    } else {
      const urls = expandEntry(e);
      if (/\.html?$/.test(e.name ?? '')) urls.forEach(u => pages.add(u));
      listed.push(...urls);
    }
  }
  const todo = [...new Set(listed)].filter(u => REFRESH || !sizes.files[u] || !(sizes.files[u].status < 400));
  await Promise.all(todo.map(async u => {
    sizes.files[u] = { program: slug, ...(await measure(u, pages.has(u))), checked: new Date().toISOString().slice(0, 10) };
  }));
  // Files no longer listed for this program are dropped.
  for (const [u, f] of Object.entries(sizes.files)) if (f.program === slug && !listed.includes(u)) delete sizes.files[u];
  sizes.listing_errors = { ...sizes.listing_errors, [slug]: errors.length ? errors : undefined };
  save();
  return listed.length;
}

const gb = n => `${(n / 1e9).toFixed(2)} GB`;
const mb = n => `${(n / 1e6).toFixed(1)} MB`;

function report() {
  const by = {};
  for (const f of Object.values(sizes.files)) {
    const p = by[f.program] ??= { files: 0, bytes: 0, unknown: 0, failed: 0 };
    p.files++;
    if (!(f.status < 400)) p.failed++;
    else if (f.bytes == null) p.unknown++;
    else p.bytes += f.bytes;
  }
  const rows = Object.entries(by).sort((a, b) => b[1].bytes - a[1].bytes);
  for (const [slug, p] of rows) {
    console.log(`${mb(p.bytes).padStart(11)}  ${String(p.files).padStart(5)} files${p.unknown ? `, ${p.unknown} size unknown` : ''}${p.failed ? `, ${p.failed} FAILED` : ''}  ${slug}`);
  }
  const total = rows.reduce((s, [, p]) => s + p.bytes, 0);
  const programs = Object.keys(downloads.programs);
  const none = programs.filter(s => downloads.programs[s].none);
  console.log(`\n${gb(total)} in ${Object.values(sizes.files).length} files, ${rows.length} programs measured`);
  console.log(`${none.length} programs with nothing to fetch as files (none)`);
  const needs = programs.filter(s => downloads.programs[s].needs);
  for (const s of needs) console.log(`needs ${downloads.programs[s].needs}: ${s}`);
  for (const [u, f] of Object.entries(sizes.files)) if (!(f.status < 400)) console.log(`FAILED ${f.status}${f.error ? ` ${f.error}` : ''} ${u}`);
  for (const [slug, errs] of Object.entries(sizes.listing_errors ?? {})) if (errs) console.log(`listing ${slug}: ${errs.join('; ')}`);
}

if (!REPORT) {
  const slugs = Object.keys(downloads.programs).filter(s => !ONLY || ONLY.includes(s));
  for (const slug of slugs) {
    if (downloads.programs[slug].none) {
      // A program now marked none keeps no listing errors from an earlier run.
      if (sizes.listing_errors?.[slug]) { delete sizes.listing_errors[slug]; save(); }
      continue;
    }
    const n = await measureProgram(slug, downloads.programs[slug]);
    console.log(`${slug}: ${n} files`);
  }
}
report();
