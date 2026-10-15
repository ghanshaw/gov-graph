#!/usr/bin/env node
/**
 * Load downloaded economic series (fetch-economic-series.js) → economic_series + economic_observations.
 *
 * One economic_series row per entry in lib/economic-series.js (matched by slug, so its id is kept),
 * and every observation in its file. Re-running replaces a series' observations with the file's,
 * which picks up the publisher's revisions.
 *
 * Every name is checked against the naming rules first (lib/series-names.js, design/timeline-data/NAMING.md);
 * a name that breaks them stops the load. --names-only updates names and descriptions of series already
 * stored, without reading any file (after renaming series in lib/economic-series.js).
 *
 * Usage:
 *   node --env-file=server/.env server/seed/load-economic-series.js [--series wti-spot] [--source bea] [--dry-run]
 *   node --env-file=server/.env server/seed/load-economic-series.js --names-only [--dry-run]
 *
 * Env:
 *   DATABASE_URL — Supabase Postgres connection URI
 */

import fs from 'fs';
import { execFileSync } from 'child_process';
import { readXlsx } from '../lib/xlsx.js';
import { extractPdfLines } from '../lib/pdf-lines.js';
import { readXls } from '../lib/xls.js';
import pg from 'pg';
import { storeSeries } from '../lib/series-storage.js';
import { SERIES, SCHEMA, seriesFile, readObservations, publisherTitle, FED_OMO_PAGES, EIA_PET_BULK, eiaBulkId } from '../lib/economic-series.js';
import { mirrorFile } from '../lib/data-dir.js';
import { seriesNameProblems } from '../lib/series-names.js';

const arg = name => {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
};
const DRY_RUN = process.argv.includes('--dry-run');
const NAMES_ONLY = process.argv.includes('--names-only');
const only = arg('--series')?.split(',');
const onlySource = arg('--source'); // every series read from one source ('bea': the national accounts)

// Files are read once each (BEA's quarterly file holds every GDP series; Treasury's both debts;
// a BLS survey file many series). A workbook's tab other than the first is named by `sheet`.
const files = new Map();
function readFile(file, asText, sheet = null) {
  const key = sheet ? `${file}#${sheet}` : file;
  if (!files.has(key)) {
    if (!fs.existsSync(file)) throw new Error(`no file at ${file}; run fetch-economic-series.js first`);
    if (file.endsWith('.xlsx')) files.set(key, readXlsx(file, sheet));
    else if (file.endsWith('.xls')) files.set(key, readXls(file));
    else {
      const text = fs.readFileSync(file, 'utf8');
      files.set(key, asText ? text : JSON.parse(text));
    }
  }
  return files.get(key);
}

// EIA's petroleum bulk file is one 370 MB text file in a zip, a JSON line per series: only our series' lines are
// read (unzip piped to grep), once.
function readEiaBulkFile() {
  const file = mirrorFile(EIA_PET_BULK);
  if (!files.has(file)) {
    if (!fs.existsSync(file)) throw new Error(`no file at ${file}; run fetch-economic-series.js first`);
    const ids = [...new Set(SERIES.filter(x => x.source === 'eia').map(eiaBulkId))];
    if (ids.some(id => !/^[A-Z0-9_.]+$/.test(id))) throw new Error(`unexpected EIA series id in ${ids.join(', ')}`);
    const pattern = `"series_id":"(${ids.map(id => id.replace(/\./g, '\\.')).join('|')})"`;
    const text = execFileSync('sh', ['-c', 'unzip -p "$0" PET.txt | grep -E "$1"', file, pattern], { maxBuffer: 256 * 1024 * 1024 }).toString('utf8');
    files.set(file, new Map(text.trim().split('\n').map(line => JSON.parse(line)).map(d => [d.series_id, d])));
  }
  return files.get(file);
}

// H.15 is one XML file in a zip (71 MB unzipped); the FOMC target is read from two saved pages.
function readSource(s) {
  if (s.source === 'fed-h15') {
    const file = seriesFile(s);
    if (!files.has(file)) {
      if (!fs.existsSync(file)) throw new Error(`no file at ${file}; run fetch-economic-series.js first`);
      files.set(file, execFileSync('unzip', ['-p', file, 'H15_data.xml'], { maxBuffer: 512 * 1024 * 1024 }).toString('utf8'));
    }
    return files.get(file);
  }
  if (s.source === 'fed-omo') return FED_OMO_PAGES.map(url => readFile(mirrorFile(url), true));
  if (s.source === 'eia') return readEiaBulkFile();
  return readFile(seriesFile(s), ['bea', 'bls-bulk', 'umich', 'freddiemac', 'fhfa', 'cdc'].includes(s.source), s.sheet);
}

// Files read for publishers' titles; a missing file gives null rather than an error.
const titleFiles = {
  text: file => (fs.existsSync(file) ? readFile(file, true) : null),
  json: file => (fs.existsSync(file) ? readFile(file, false) : null),
  rows: (file, sheet) => (fs.existsSync(file) ? readFile(file, false, sheet) : null),
  h15: () => readSource(SERIES.find(x => x.source === 'fed-h15')),
  eia: () => (fs.existsSync(mirrorFile(EIA_PET_BULK)) ? readEiaBulkFile() : null),
  pdf: file => files.get(file) ?? null,
};

// A PDF's lines are read asynchronously, so they are read before the series that need them.
async function readPdfs(list) {
  for (const file of new Set(list.filter(s => s.url?.endsWith('.pdf')).map(seriesFile))) {
    if (!fs.existsSync(file)) throw new Error(`no file at ${file}; run fetch-economic-series.js first`);
    files.set(file, await extractPdfLines(new Uint8Array(fs.readFileSync(file))));
  }
}

function readSeries(s) {
  return readObservations(s, readSource(s));
}

// Names and descriptions only, for series already stored; their observations are not touched.
async function updateNames(list) {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    const { rows } = await pool.query('SELECT slug, name, description FROM economic_series');
    const stored = new Map(rows.map(r => [r.slug, r]));
    const changed = list.filter(s => stored.has(s.slug) && (stored.get(s.slug).name !== s.name || stored.get(s.slug).description !== s.description));
    for (const s of changed) console.log(`  ${s.slug}: "${stored.get(s.slug).name}" → "${s.name}"`);
    const notStored = list.filter(s => !stored.has(s.slug));
    if (notStored.length) console.log(`  not stored yet (load them in full): ${notStored.map(s => s.slug).join(', ')}`);
    console.log(`${changed.length} of ${list.length} series ${DRY_RUN ? 'would change' : 'changed'}.`);
    if (DRY_RUN || !changed.length) return;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const s of changed) await client.query('UPDATE economic_series SET name = $2, description = $3 WHERE slug = $1', [s.slug, s.name, s.description]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

async function run() {
  const list = (only ? SERIES.filter(s => only.includes(s.slug)) : SERIES).filter(s => !onlySource || s.source === onlySource);
  if (only && list.length !== only.length) throw new Error(`Unknown series; known: ${SERIES.map(s => s.slug).join(', ')}`);
  const problems = seriesNameProblems(SERIES);
  if (problems.length) throw new Error(`Series names break the naming rules (lib/series-names.js):\n  ${problems.join('\n  ')}`);
  if (NAMES_ONLY) return updateNames(list);
  console.log(`Loading ${list.length} economic series${DRY_RUN ? ' (dry run)' : ''}...`);
  await readPdfs(list);

  const parsed = list.map(s => ({ s, ...readSeries(s), title: publisherTitle(s, titleFiles) }));
  for (const { s, observations, skipped, title } of parsed) {
    console.log(`  ${s.slug}: ${observations.length} observations, ${observations[0]?.[0]} – ${observations.at(-1)?.[0]}` +
      (skipped ? ` (${skipped} rows with no value skipped)` : ''));
    console.log(`    publisher's title: ${title ? `"${title.title}" (${title.from})` : 'none'}`);
  }
  if (DRY_RUN) return;

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(SCHEMA);
    for (const { s, observations, title } of parsed) await storeSeries(client, s, observations, title);
    await client.query('COMMIT');
    console.log('Done.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
