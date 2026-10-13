// Where bulk downloads live: outside the repository, because they are large and keep growing.
// Default: ../gov-graph-data beside this repository. Override with GOVGRAPH_DATA_DIR.
//
// Layout mirrors the publisher's own paths, e.g.
//   <data dir>/govinfo/bulkdata/BILLS/119/1/hr/BILLS-119-1-hr.zip
//   <data dir>/govinfo/bulkdata/BILLSTATUS/119/hr/BILLSTATUS-119-hr.zip

import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const DATA_DIR = process.env.GOVGRAPH_DATA_DIR
  ? path.resolve(process.env.GOVGRAPH_DATA_DIR)
  : path.resolve(REPO_ROOT, '..', 'gov-graph-data');

export const BILL_TYPES = ['hr', 's', 'hjres', 'sjres', 'hconres', 'sconres', 'hres', 'sres'];

/** Path of a govinfo bulk data file, relative to https://www.govinfo.gov/bulkdata/ */
export function bulkPath(collection, congress, type, session) {
  return collection === 'BILLS'
    ? `BILLS/${congress}/${session}/${type}/BILLS-${congress}-${session}-${type}.zip`
    : `BILLSTATUS/${congress}/${type}/BILLSTATUS-${congress}-${type}.zip`;
}

export const bulkFile = (...args) => path.join(DATA_DIR, 'govinfo', 'bulkdata', bulkPath(...args));

/** "115-119" or "119" → [115, …, 119] */
export function congressRange(value) {
  const [from, to = from] = String(value ?? '').split('-').map(Number);
  if (!from || !to || to < from) throw new Error('Expected --congress N or --congress N-M');
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

// ---------------------------------------------------------------------------
// Reading a zip: unpack it to a temporary folder (system `unzip`), hand back the XML files.

/** @returns {{ files: string[], read(name): string, cleanup(): void }} */
export function openZip(zipFile) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'govgraph-'));
  execFileSync('unzip', ['-q', '-o', zipFile, '-d', dir]);
  return {
    files: fs.readdirSync(dir).filter(name => name.endsWith('.xml')).sort(),
    read: name => fs.readFileSync(path.join(dir, name), 'utf8'),
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

/** Rows as "($1, $2), ($3, $4)" plus the flat parameter list, for a multi-row INSERT. */
export function valuesClause(rows) {
  const width = rows[0].length;
  return {
    sql: rows.map((_, r) => `(${Array.from({ length: width }, (_, c) => `$${r * width + c + 1}`).join(', ')})`).join(', '),
    params: rows.flat(),
  };
}

/**
 * Where a file fetched from the web is kept: <data dir>/<host>/<its path>, e.g.
 * https://clerk.house.gov/evs/2025/roll190.xml → <data dir>/clerk.house.gov/evs/2025/roll190.xml
 */
export function mirrorFile(url) {
  const { hostname, pathname } = new URL(url);
  return path.join(DATA_DIR, hostname.replace(/^www\./, ''), ...pathname.split('/').filter(Boolean));
}

// Every member of Congress with their ids (Bioguide, Senate LIS, …), from the public-domain
// @unitedstates project. Used to name House members and to match senators to Bioguide ids.
export const LEGISLATOR_FILES = ['legislators-current.json', 'legislators-historical.json']
  .map(name => `https://unitedstates.github.io/congress-legislators/${name}`);

// Every president and vice president, with the same ids where they have them. Used by load-people.js.
export const EXECUTIVE_FILE = 'https://unitedstates.github.io/congress-legislators/executive.json';

// The U.S. Code, as the Law Revision Counsel publishes it after each batch of laws: one zip of
// every title in USLM XML per release point ("119-36": current through Public Law 119-36).
export const uscodeReleaseUrl = id => {
  const [congress, law] = id.split('-');
  return `https://uscode.house.gov/download/releasepoints/us/pl/${congress}/${law}/xml_uscAll@${id}.zip`;
};

// The fetch log: one line per file a fetch script saved, with what the file alone cannot tell (the
// URL it came from, an Internet Archive capture). Read by seed/load-sources.js into source_files.
export const FETCH_LOG = path.join(DATA_DIR, 'fetch-log.jsonl');

/** Note that `file` was just saved from `url` (`archive`: the Internet Archive capture it came from). */
export function recordFetch(file, url, { archive = null } = {}) {
  const entry = { path: path.relative(DATA_DIR, file).split(path.sep).join('/'), url, archive, fetched_at: new Date().toISOString() };
  fs.appendFileSync(FETCH_LOG, `${JSON.stringify(entry)}\n`);
}
