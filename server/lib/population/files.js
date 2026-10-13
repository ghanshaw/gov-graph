// The population section's files, read as published from the data directory: CSV and pipe-separated
// files as rows, text files as text, spreadsheets as their sheets, zip files as their contents.
// Only files below <data dir>/www2.census.gov/ are served, addressed by their path below it.

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import * as XLSX from 'xlsx';
import { DATA_DIR, mirrorFile } from '../data-dir.js';
import { CENSUS, COLLECTIONS, DATA_FILE } from './sources.js';
import { splitCsv } from './acs.js';

export const ROOT = path.join(DATA_DIR, 'www2.census.gov');

/** The file at a path below ROOT ("programs-surveys/…/apportionment.csv"), or null if outside it. */
export function resolve(relative) {
  const file = path.resolve(ROOT, relative ?? '');
  if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return null;
  return file;
}

const walk = (dir, out = []) => {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (DATA_FILE.test(entry.name) || /\.(dat)$/.test(entry.name)) out.push(full);
  }
  return out;
};

/** Each collection with the files of it on disk: [{ ...collection, files: [{ path, name, folder, size }] }] */
export function collectionsOnDisk() {
  return COLLECTIONS.map(collection => {
    const files = collection.dirs.flatMap(dir => walk(mirrorFile(CENSUS + dir).replace(/\/?$/, '')))
      .sort()
      .map(file => {
        const rel = path.relative(ROOT, file);
        return { path: rel, name: path.basename(file), folder: path.dirname(rel), size: fs.statSync(file).size };
      });
    const { dirs, ...rest } = collection;
    return { ...rest, sources: dirs.map(d => CENSUS + d), files };
  });
}

const kindOf = name => {
  if (/\.(csv)$/i.test(name)) return 'csv';
  if (/\.(dat)$/i.test(name)) return 'pipe';
  if (/\.(xlsx?|xls)$/i.test(name)) return 'sheets';
  if (/\.zip$/i.test(name)) return 'zip';
  return 'text';
};

/**
 * One file's content, a page at a time: `offset` and `limit` count lines (text) or rows (tables).
 * Spreadsheets come whole, one sheet at a time (`sheet`).
 */
export function readFile(relative, { offset = 0, limit = 500, sheet = 0 } = {}) {
  const file = resolve(relative);
  if (!file) return null;
  const name = path.basename(file);
  const kind = kindOf(name);
  const base = { path: relative, name, kind, size: fs.statSync(file).size, source: CENSUS + relative };

  if (kind === 'sheets') {
    const wb = XLSX.read(fs.readFileSync(file), { cellDates: false });
    const index = Math.min(Math.max(sheet, 0), wb.SheetNames.length - 1);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[index]], { header: 1, raw: false, defval: '', blankrows: true });
    return { ...base, sheets: wb.SheetNames, sheet: index, total: rows.length, offset, rows: rows.slice(offset, offset + limit) };
  }
  if (kind === 'zip') {
    const entries = execFileSync('unzip', ['-Z1', file], { encoding: 'utf8' }).split('\n').filter(Boolean);
    return { ...base, entries };
  }
  // Census text files are Latin-1 or ASCII; reading as Latin-1 never fails.
  const lines = fs.readFileSync(file, 'latin1').split(/\r?\n/);
  if (lines.at(-1) === '') lines.pop();
  const page = lines.slice(offset, offset + limit);
  if (kind === 'text') return { ...base, total: lines.length, offset, text: page.join('\n') };
  const split = kind === 'pipe' ? l => l.split('|') : l => splitCsv(l);
  return { ...base, total: lines.length, offset, header: offset > 0 ? split(lines[0]) : null, rows: page.map(split) };
}
