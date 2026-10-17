#!/usr/bin/env node
/**
 * The Statistical Abstract's Current Population Survey tables (seed/data/cps-tables.json, hand-kept) → BLS's ln series
 * that print their rows → server/seed/data/cps-series.json (lib/cps-series.js reads it), so the series list never
 * depends on the data folder.
 *
 * For each row (what is counted × group) the matching series are those whose named dimensions have the given codes and
 * every other dimension is zero (a block's `optional` codes may be present or not). Of these, the monthly ones are kept (seasonally adjusted and not); where BLS prints
 * none monthly, the quarterly, else the yearly. Quarterly series that average a monthly one are left out. Rows with no
 * series are listed, so the spec can be corrected.
 *
 * Usage: node server/seed/build-cps-series.js [--dry-run] [--misses]   (after fetch-bls-bulk.js --survey ln)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DATA_DIR } from '../lib/data-dir.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'data', 'cps-series.json');
const SPEC = JSON.parse(fs.readFileSync(path.join(HERE, 'data', 'cps-tables.json'), 'utf8')).tables;
const DRY_RUN = process.argv.includes('--dry-run');
const SHOW_MISSES = process.argv.includes('--misses');
const DIR = path.join(DATA_DIR, 'download.bls.gov', 'pub', 'time.series', 'ln');

const read = name => {
  const [head, ...lines] = fs.readFileSync(path.join(DIR, name), 'utf8').split(/\r?\n/).filter(Boolean);
  const cols = head.split('\t').map(c => c.trim().replace(/_code$/, ''));
  return { cols, rows: lines.map(l => Object.fromEntries(l.split('\t').map((v, i) => [cols[i], v.trim()]))) };
};
const { cols, rows } = read('ln.series');
const NOT_DIMS = ['series_id', 'lfst', 'periodicity', 'series_title', 'seasonal', 'footnote', 'footnote_codes', 'begin_year', 'begin_period', 'end_year', 'end_period'];
const DIMS = cols.filter(c => !NOT_DIMS.includes(c));
const zero = v => /^0*$/.test(v ?? '');

// Codes by text, for industries and occupations.
const norm = t => t.toLowerCase().replace(/&/g, 'and').replace(/[^a-z]/g, '');
const byText = name => new Map(read(`ln.${name}`).rows.map(r => [norm(r[`${name}_text`]), r[name]]));
const TEXT = { indy: byText('indy'), occupation: byText('occupation') };
const code = (dim, value) => (TEXT[dim] && !/^\d+$/.test(value) ? TEXT[dim].get(norm(value)) ?? `?${value}` : value);

// Series by their codes (lfst and every dimension), monthly first.
const RANK = { M: 0, Q: 1, A: 2 };
const index = new Map();
for (const r of rows) {
  if (/cnstr series/i.test(r.series_title)) continue; // BLS's constructed copies of published series
  const key = [r.lfst, ...DIMS.map(d => (zero(r[d]) ? '' : r[d]))].join('|');
  if (!index.has(key)) index.set(key, []);
  index.get(key).push(r);
}

const cross = obj => Object.entries(obj ?? {}).reduce((acc, [dim, values]) => acc.flatMap(a => values.map(v => ({ ...a, [dim]: v }))), [{}]);

const found = new Map(); // series id → { …, tables }
const misses = [];
for (const [table, blocks] of Object.entries(SPEC)) {
  for (const block of blocks) {
    for (const group of block.groups) {
      for (const extra of cross(block.cross)) {
        const codes = Object.fromEntries(Object.entries({ ...block.with, ...group, ...extra }).map(([d, v]) => [d, code(d, v)]));
        // tdat says how a value is expressed: a number (00, left zero), a percent or rate (01), average weeks (02), …;
        // rates and shares are 01 unless the spec says otherwise.
        for (const lfst of block.lfst) {
          const rated = ['13', '23', '40', '41', '42'].includes(lfst) || codes.pcts;
          const c0 = { ...codes, ...(rated && !codes.tdat ? { tdat: '01' } : {}) };
          // `optional` codes are tried first, then left out: BLS codes "1 to 34 hours" on some part-time series only.
          const keyOf = c => [lfst, ...DIMS.map(d => (zero(c[d]) ? '' : c[d]))].join('|');
          const list = (block.optional && index.get(keyOf({ ...block.optional, ...c0 }))) || index.get(keyOf(c0)) || [];
          if (!list.length) { misses.push(`${table}: lfst ${lfst} ${JSON.stringify(c0)}`); continue; }
          const finest = Math.min(...list.map(r => RANK[r.periodicity]));
          for (const r of list.filter(x => RANK[x.periodicity] === finest)) {
            const s = found.get(r.series_id) ?? {
              id: r.series_id, lfst: r.lfst, periodicity: r.periodicity, seasonal: r.seasonal, title: r.series_title,
              codes: Object.fromEntries(DIMS.filter(d => !zero(r[d])).map(d => [d, r[d]])), from: r.begin_year, to: r.end_year, tables: [],
            };
            if (!s.tables.includes(Number(table))) s.tables.push(Number(table));
            found.set(r.series_id, s);
          }
        }
      }
    }
  }
}

const series = [...found.values()];
const by = {};
for (const s of series) by[`${s.periodicity}${s.seasonal}`] = (by[`${s.periodicity}${s.seasonal}`] ?? 0) + 1;
console.log(`${series.length} series ${JSON.stringify(by)}; ${misses.length} rows with no series`);
if (SHOW_MISSES) for (const m of misses) console.log(`  ${m}`);

// Labels of the codes used, for names and breakdowns.
const used = {};
for (const s of series) for (const [d, v] of Object.entries(s.codes)) (used[d] ??= new Set()).add(v);
const labels = { lfst: Object.fromEntries(read('ln.lfst').rows.map(r => [r.lfst, r.lfst_text])) };
for (const d of Object.keys(used)) {
  const { rows: list } = read(`ln.${d}`);
  labels[d] = Object.fromEntries(list.filter(r => used[d].has(r[d])).map(r => [r[d], r[`${d}_text`]]));
}

const json = JSON.stringify({
  about: 'BLS ln series printing the rows of the Statistical Abstract\'s CPS tables (server/seed/build-cps-series.js from cps-tables.json; never edited by hand): each with its codes, frequency and the tables it answers; and the text of every code used.',
  labels,
  series,
}).replace(/\{"id"/g, '\n    {"id"');
if (!DRY_RUN) fs.writeFileSync(OUT, `${json}\n`);
