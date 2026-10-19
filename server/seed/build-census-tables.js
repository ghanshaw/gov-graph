#!/usr/bin/env node
/**
 * Write server/seed/data/census-tables.json: the series of the Census printed tables collected for the Statistical
 * Abstract's Section 1 (lib/census-tables.js), one per row or column taken, read from the tables in the data folder.
 * Re-run after a table is added there or Census reissues one, and check the diff.
 *
 * Usage: node server/seed/build-census-tables.js [--dry-run]
 */

import fs from 'fs';
import { mirrorFile } from '../lib/data-dir.js';
import { readXlsx } from '../lib/xlsx.js';
import { readXls } from '../lib/xls.js';
import { buildCensusTableSeries, CENSUS_TABLES_FILE } from '../lib/census-tables.js';

const rowsOf = url => {
  const file = mirrorFile(url);
  if (!fs.existsSync(file)) throw new Error(`no file at ${file}; run fetch-downloads.js first`);
  return file.endsWith('.xlsx') ? readXlsx(file) : readXls(file);
};

const series = buildCensusTableSeries(rowsOf);
const byTable = Object.entries(Object.groupBy(series, s => s.table)).map(([t, l]) => `${t} ${l.length}`).join(', ');
console.log(`${series.length} series (${byTable})`);
if (!process.argv.includes('--dry-run')) {
  const about = 'Written by server/seed/build-census-tables.js from the Census tables in the data folder (lib/census-tables.js); never edited by hand.';
  fs.writeFileSync(CENSUS_TABLES_FILE, `{\n "about": ${JSON.stringify(about)},\n "series": [\n${series.map(s => `  ${JSON.stringify(s)}`).join(',\n')}\n ]\n}\n`);
}
