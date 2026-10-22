// The download list (Phase 5a): for every program still to collect, the files to fetch from its publisher.
// Hand-kept in server/seed/data/downloads.json; sizes are measured by server/seed/size-downloads.js into
// download-sizes.json. Nothing here is fetched: 5b downloads what this lists.
//
// A program's `files` are entries of four kinds:
//   { url }                          one file
//   { url: '…{year}…', years: '1986-2023' }   one file per year ({yy} for two digits)
//   { list: 'https://…/', match: 'regex' }    every file linked from a folder page (matching `match`);
//     `recursive: true` descends into subfolders, `follow: 'regex'` only into those matching; a list may
//     have `years` too
//   { catalog: 'https://…/data.json', title: 'regex' }   the download URLs of every dataset in a publisher's
//     DCAT catalog (the federal data.json) whose title matches; `match` filters the URLs. For sites whose
//     file paths carry ids that change on each release (data.cms.gov)
// Each may carry a `note`, and `name` where the URL does not end in the file's name (the Fed's Output.aspx).
// A program with nothing to fetch as a file says why in `none`. `needs` marks what is left for the user
// to settle: 'api-key' (only an API with a key serves it), 'scrape' (only web pages), 'decision' (a choice).
// `draft: true` marks an entry made from the program's home page and not yet reviewed.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { mirrorFile, DATA_DIR } from './data-dir.js';

const dataPath = file => path.relative(DATA_DIR, file).split(path.sep).join('/');

const DATA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'seed', 'data');
export const DOWNLOADS_FILE = path.join(DATA, 'downloads.json');
export const SIZES_FILE = path.join(DATA, 'download-sizes.json');

export const readDownloads = () => JSON.parse(fs.readFileSync(DOWNLOADS_FILE, 'utf8'));

const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const NEEDS = { 'api-key': 'Only an API with a key', scrape: 'Only web pages', decision: 'A choice to make' };

/** "1986-2023" or "2007,2012,2017" → [1986, …]. */
export function yearList(spec) {
  return String(spec).split(',').flatMap(part => {
    const [from, to = from] = part.split('-').map(Number);
    if (!from || !to || to < from) throw new Error(`bad years ${spec}`);
    return Array.from({ length: to - from + 1 }, (_, i) => from + i);
  });
}

/** An entry's URLs, without listing folders: { url } entries as they are, year patterns expanded. */
export function expandEntry(entry) {
  if (entry.list || entry.catalog) return [];
  if (!entry.years) return [entry.url];
  return yearList(entry.years).map(y => entry.url.replaceAll('{year}', String(y)).replaceAll('{yy}', String(y).slice(-2)));
}

/** Every problem in downloads.json against sources.json, as sentences; [] when it is sound. */
export function checkDownloads(downloads, sources) {
  const problems = [];
  const programs = new Map(sources.programs.map(p => [p.slug, p]));
  for (const [slug, d] of Object.entries(downloads.programs)) {
    const p = programs.get(slug);
    if (!p) { problems.push(`${slug}: not a program in sources.json`); continue; }
    if (p.licence?.type === 'licensed') problems.push(`${slug}: licensed data is not collected`);
    if (!DATE.test(d.checked ?? '')) problems.push(`${slug}: checked must be YYYY-MM-DD`);
    if (!d.files?.length && !d.none) problems.push(`${slug}: no files, and no reason (none)`);
    if (d.files?.length && d.none) problems.push(`${slug}: files and none together`);
    if (![true, undefined].includes(d.draft)) problems.push(`${slug}: draft is true or absent`);
    if (d.needs && !NEEDS[d.needs]) problems.push(`${slug}: unknown needs ${d.needs}`);
    for (const e of d.files ?? []) {
      const kinds = ['url', 'list', 'catalog'].filter(k => e[k]);
      if (kinds.length !== 1) { problems.push(`${slug}: an entry needs url, list or catalog`); continue; }
      const u = e.url ?? e.list ?? e.catalog;
      if (!/^https?:\/\//.test(u)) problems.push(`${slug}: ${u} is not a web address`);
      if (e.list && !u.endsWith('/') && !e.page) problems.push(`${slug}: a list is a folder (ends in /) or marked page: true`);
      if (e.years) {
        if (!/\{y(ear|y)\}/.test(u)) problems.push(`${slug}: ${u} has years but no {year}`);
        try { yearList(e.years); } catch (err) { problems.push(`${slug}: ${err.message}`); }
      } else if (/\{y(ear|y)\}/.test(u)) problems.push(`${slug}: ${u} has {year} but no years`);
      if (e.catalog && !e.title) problems.push(`${slug}: a catalog needs title`);
      for (const k of ['match', 'follow', 'title']) {
        if (e[k]) try { new RegExp(e[k]); } catch { problems.push(`${slug}: bad ${k} ${e[k]}`); }
      }
    }
  }
  return problems;
}

export const readSizes = () => JSON.parse(fs.readFileSync(SIZES_FILE, 'utf8'));

// An Internet Archive capture is kept at the original address, with the capture in the log.
export const ARCHIVED = /^https?:\/\/web\.archive\.org\/web\/\d+(?:id_)?\/(https?:\/\/.+)$/;

/** The names given in downloads.json, for URLs whose path does not end in the file's name (Output.aspx?rel=G19). */
function givenNames(downloads) {
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
  return names;
}

/**
 * Every file measured into download-sizes.json, with where 5b saves it in the data folder (`path`, relative, with
 * forward slashes; `file` is the full path): the publisher's path, its given name in that folder, or index.html for a
 * page address: [{ url, program, status, bytes, file, path }]. Files that failed to measure (status 400 and over) are included.
 */
export function plannedFiles(downloads = readDownloads(), sizes = readSizes()) {
  const names = givenNames(downloads);
  return Object.entries(sizes.files).map(([url, f]) => {
    const u = new URL(url.match(ARCHIVED)?.[1] ?? url);
    const base = mirrorFile(u.origin + u.pathname);
    const name = names.get(url);
    const file = name ? path.join(u.pathname.endsWith('/') ? base : path.dirname(base), name)
      : u.pathname.endsWith('/') ? path.join(base, 'index.html') : base;
    return { url, program: f.program, status: f.status ?? null, bytes: f.bytes ?? null, file, path: dataPath(file) };
  });
}
