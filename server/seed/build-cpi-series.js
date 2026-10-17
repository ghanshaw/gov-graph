#!/usr/bin/env node
/**
 * BLS's CPI survey files (cu.series, cu.item, cu.area, cu.data.*) → server/seed/data/cpi-series.json: the CPI-U
 * series GovGraph collects (lib/cpi-series.js), so the series list never depends on the data folder.
 *
 * Collected (Phase 5, Statistical Abstract tables 142, 724–727): every item for the U.S. city average, monthly,
 * seasonally adjusted and not, on the current base and the old (1967) base where BLS prints one; and all items for
 * each area, monthly. Semiannual averages are left out (BLS prints the monthly indexes they average).
 * For each series: the topic data file holding its whole history (cu.data.0.Current starts in 1997), the one
 * with the most lines where several do.
 *
 * Usage: node server/seed/build-cpi-series.js [--dry-run]   (after fetch-bls-bulk.js --survey cu)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DATA_DIR } from '../lib/data-dir.js';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'cpi-series.json');
const DRY_RUN = process.argv.includes('--dry-run');
const DIR = path.join(DATA_DIR, 'download.bls.gov', 'pub', 'time.series', 'cu');

const table = name => {
  const [head, ...lines] = fs.readFileSync(path.join(DIR, name), 'utf8').split(/\r?\n/).filter(Boolean);
  const cols = head.split('\t').map(c => c.trim());
  return lines.map(l => Object.fromEntries(l.split('\t').map((v, i) => [cols[i], v.trim()])));
};

const items = table('cu.item').sort((a, b) => Number(a.sort_sequence) - Number(b.sort_sequence));
const areas = table('cu.area').sort((a, b) => Number(a.sort_sequence) - Number(b.sort_sequence));

// An item sits under the nearest item before it in BLS's order one level up; the special aggregates ("All items less
// food", "Services", from "All items less medical care" on) are listed under Other goods and services at level 1,
// but belong to no group.
const specialFrom = Number(items.find(i => i.item_code === 'SA0L5').sort_sequence);
const stack = [];
const itemList = items.map(i => {
  const level = Number(i.display_level);
  const special = Number(i.sort_sequence) >= specialFrom && level === 1;
  stack.length = level;
  const parent = special || level === 0 ? null : stack[level - 1] ?? null;
  stack[level] = i.item_code;
  return { code: i.item_code, name: i.item_name, level: special ? 0 : level, parent, special: special || undefined };
});

const series = table('cu.series').filter(s => s.periodicity_code === 'R'
  && (s.area_code === '0000' || (s.item_code === 'SA0' && s.base_code === 'S')));

// Which topic file holds each series' whole history.
const wanted = new Set(series.map(s => s.series_id));
const lines = new Map();
for (const file of fs.readdirSync(DIR).filter(f => /^cu\.data\.\d+\./.test(f) && !f.startsWith('cu.data.0.'))) {
  const counts = new Map();
  for (const line of fs.readFileSync(path.join(DIR, file), 'utf8').split('\n')) {
    const id = line.slice(0, line.indexOf('\t')).trim();
    if (wanted.has(id)) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  for (const [id, n] of counts) if (n > (lines.get(id)?.n ?? 0)) lines.set(id, { file: `cu/${file}`, n });
}

const out = series.map(s => ({
  id: s.series_id, area: s.area_code, item: s.item_code, seasonal: s.seasonal, base: s.base_code, base_period: s.base_period,
  title: s.series_title, file: lines.get(s.series_id)?.file ?? null, from: s.begin_year, to: s.end_year,
}));
const missing = out.filter(s => !s.file);
console.log(`${itemList.length} items, ${areas.length} areas, ${out.length} series (${missing.length} in no topic file: ${missing.map(s => s.id).join(', ')})`);

const json = JSON.stringify({
  about: 'CPI-U series GovGraph collects, from BLS\'s cu survey files (server/seed/build-cpi-series.js; never edited by hand): items with their place in BLS\'s list, areas, and each series with the data file holding its history.',
  items: itemList,
  areas: areas.map(a => ({ code: a.area_code, name: a.area_name, level: Number(a.display_level) })),
  series: out.filter(s => s.file),
}).replace(/\{"code"/g, '\n    {"code"').replace(/\{"id"/g, '\n    {"id"');
if (!DRY_RUN) fs.writeFileSync(OUT, `${json}\n`);
