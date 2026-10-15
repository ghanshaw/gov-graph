#!/usr/bin/env node
/**
 * BEA's registers → server/seed/data/nipa-tables.json: the lines of each NIPA table GovGraph collects
 * (lib/nipa-series.js, TABLES), so the series list never depends on the data folder.
 *
 * For each table: its title and every line as the register lists it (line number, series code, the
 * publisher's label, metric, calculation type, scale), the line it sits under in the same table (from
 * SeriesCodeParents: the nearest earlier line among the code's parents) and which flat files carry the
 * series (A = NipaDataA.txt, yearly; Q = NipaDataQ.txt, quarterly). A code printed twice in one table
 * (Table 1.12 repeats farm proprietors' income) is kept at its first line.
 *
 * Usage: node server/seed/build-nipa-tables.js [--dry-run]
 * Re-run after fetch-economic-series.js brings new flat files, then check the diff: BEA renumbers lines
 * and adds or retires series at its annual updates.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { mirrorFile } from '../lib/data-dir.js';
import { BEA_FILES } from '../lib/economic-series.js';
import { NIPA_TABLE_IDS } from '../lib/nipa-series.js';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'nipa-tables.json');
const DRY_RUN = process.argv.includes('--dry-run');

/** A register's CSV line → fields (quoted fields may hold commas). */
function fields(line) {
  const out = [];
  let field = '', quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) { out.push(field); field = ''; }
    else field += ch;
  }
  out.push(field);
  return out;
}

const read = url => fs.readFileSync(mirrorFile(url), 'utf8').split(/\r?\n/).slice(1).filter(Boolean);
const [quarterlyUrl, , annualUrl, seriesUrl, tablesUrl] = BEA_FILES;

const codesIn = url => {
  const codes = new Set();
  for (const line of read(url)) codes.add(line.slice(0, line.indexOf(',')));
  return codes;
};
const inFile = { A: codesIn(annualUrl), Q: codesIn(quarterlyUrl) };

const titles = new Map(read(tablesUrl).map(l => fields(l)).map(([id, title]) => [id, title]));
const register = read(seriesUrl).map(l => {
  const [code, label, metric, calc, scale, places, parents] = fields(l);
  return { code, label, metric, calc, scale: Number(scale), places: places.split('|'), parents: parents === 'NONE' ? [] : parents.split('|') };
});

const tables = {};
for (const id of NIPA_TABLE_IDS) {
  if (!titles.has(id)) throw new Error(`${id} is not in TablesRegister.txt`);
  const lines = [];
  const seen = new Set();
  for (const s of register) {
    for (const place of s.places) {
      const [table, line] = place.split(':');
      if (table === id) lines.push({ line: Number(line), s });
    }
  }
  lines.sort((a, b) => a.line - b.line);
  const out = [];
  for (const { line, s } of lines) {
    if (seen.has(s.code)) continue;
    seen.add(s.code);
    const parent = [...out].reverse().find(o => s.parents.includes(o.code))?.code ?? null;
    out.push({
      line, code: s.code, label: s.label, metric: s.metric, calc: s.calc, scale: s.scale, parent,
      files: ['A', 'Q'].filter(f => inFile[f].has(s.code)).join(''),
    });
  }
  tables[id] = { title: titles.get(id), lines: out };
}

const json = JSON.stringify({
  about: 'Lines of the NIPA tables GovGraph collects, from BEA\'s SeriesRegister.txt and TablesRegister.txt (server/seed/build-nipa-tables.js; never edited by hand). files: A = yearly flat file, Q = quarterly.',
  tables,
}, null, 0).replace(/\{"line"/g, '\n    {"line"').replace(/"([A-Z0-9]+)":\{"title"/g, '\n  "$1":{"title"');
const count = Object.values(tables).reduce((n, t) => n + t.lines.length, 0);
console.log(`${Object.keys(tables).length} tables, ${count} lines`);
for (const [id, t] of Object.entries(tables)) {
  const missing = t.lines.filter(l => !l.files).map(l => l.code);
  if (missing.length) console.log(`  ${id}: in no flat file: ${missing.join(', ')}`);
}
if (!DRY_RUN) fs.writeFileSync(OUT, `${json}\n`);
