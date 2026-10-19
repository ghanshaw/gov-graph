#!/usr/bin/env node
/**
 * Write server/seed/data/dhs-yearbook.json: the series of DHS's Yearbook of Immigration Statistics tables collected for
 * the Statistical Abstract's Section 1 (lib/dhs-yearbook.js), one per row and column taken, read from the workbooks in
 * the data folder. Re-run after a new Yearbook is downloaded and the file names in lib/dhs-yearbook.js are moved to
 * it, and check the diff.
 *
 * Usage: node server/seed/build-dhs-yearbook.js [--dry-run]
 */

import fs from 'fs';
import { mirrorFile } from '../lib/data-dir.js';
import { readXlsx, readXlsxIndents } from '../lib/xlsx.js';
import { buildDhsSeries, DHS_YEARBOOK_FILE } from '../lib/dhs-yearbook.js';

const sheetOf = (url, sheet) => {
  const file = mirrorFile(url);
  if (!fs.existsSync(file)) throw new Error(`no file at ${file}; run fetch-downloads.js first`);
  return { rows: readXlsx(file, sheet), indents: readXlsxIndents(file, sheet) };
};

const { countries, series } = buildDhsSeries(sheetOf);
const byTable = Object.entries(Object.groupBy(series, s => s.parts[0].table)).map(([t, l]) => `${t} ${l.length}`).join(', ');
console.log(`${series.length} series (${byTable}); ${Object.keys(countries).length} regions and countries`);
if (!process.argv.includes('--dry-run')) {
  const about = 'Written by server/seed/build-dhs-yearbook.js from the DHS Yearbook workbooks in the data folder (lib/dhs-yearbook.js); never edited by hand.';
  fs.writeFileSync(DHS_YEARBOOK_FILE, `{\n "about": ${JSON.stringify(about)},\n "countries": ${JSON.stringify(countries)},\n "series": [\n${series.map(s => `  ${JSON.stringify(s)}`).join(',\n')}\n ]\n}\n`);
}
