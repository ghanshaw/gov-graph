#!/usr/bin/env node
/**
 * Write server/seed/data/nchs-series.json: the series of NCHS's vital statistics tables on data.cdc.gov collected for
 * the Statistical Abstract's Section 2 (lib/nchs-series.js), read from the CSVs in the data folder. Re-run after they
 * are downloaded again, and check the diff.
 *
 * Usage: node server/seed/build-nchs-series.js [--dry-run]
 */

import fs from 'fs';
import { mirrorFile } from '../lib/data-dir.js';
import { parseCsv } from '../lib/parse-fjc-justices.js';
import { readXlsx, readXlsxIndents } from '../lib/xlsx.js';
import { buildNchsSeries, NCHS_SERIES_FILE } from '../lib/nchs-series.js';

const rowsOf = url => {
  const file = mirrorFile(url);
  if (!fs.existsSync(file)) throw new Error(`no file at ${file}; run fetch-downloads.js first`);
  // Health, United States's tables are workbooks whose rows are indented under their parents.
  if (file.endsWith('.xlsx')) return { rows: readXlsx(file), indents: readXlsxIndents(file) };
  return parseCsv(fs.readFileSync(file, 'utf8'));
};

const series = buildNchsSeries(rowsOf);
const byTable = Object.entries(Object.groupBy(series, s => s.parts[0].table)).map(([t, l]) => `${t} ${l.length}`).join(', ');
console.log(`${series.length} series (${byTable}); ${series.filter(s => s.place).length} of them states`);
if (!process.argv.includes('--dry-run')) {
  const about = 'Written by server/seed/build-nchs-series.js from the NCHS tables in the data folder (lib/nchs-series.js); never edited by hand.';
  fs.writeFileSync(NCHS_SERIES_FILE, `{\n "about": ${JSON.stringify(about)},\n "series": [\n${series.map(s => `  ${JSON.stringify(s)}`).join(',\n')}\n ]\n}\n`);
}
