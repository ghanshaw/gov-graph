#!/usr/bin/env node
/**
 * Download the economic series listed in lib/economic-series.js into the data directory, as the publishers'
 * own files at their own paths (lib/economic-series.js, seriesFile). Bulk files and published files only: no API
 * keys (user, 2026-10-13). Publishers revise recent values, so re-running fetches every file again.
 *
 *   EIA  the petroleum bulk file, www.eia.gov/opendata/bulk/PET.zip (56 MB, every petroleum series, weekly).
 *   BLS  read from the survey files fetch-bls-bulk.js downloads (ln: unemployment; cu: CPI).
 *   BEA  the national accounts' flat files, whole (quarterly and annual data, the series and
 *        tables registers; about 45 MB), with a contact in the User-Agent (BLS_CONTACT_EMAIL).
 *   Treasury  Debt to the Penny, 10,000 rows a request. Derived series need no download.
 *   Michigan, Census, Freddie Mac, FHFA  one published file each (a series' `url`), whole; Census's
 *        new-home prices are the New Residential Sales history spreadsheet (price_cust.xlsx).
 *   Treasury taxes  Fiscal Data: Monthly Treasury Statement Table 9 whole; Daily Treasury Statement
 *        Table IV (Federal Tax Deposits, 2005–2023) whole and Table II's tax lines (2023 on).
 *   OMB, CBO, IRS  one published file each (.xlsx, .xls), whole. cbo.gov refuses scripted requests,
 *        so CBO's file is taken from the Internet Archive capture named on the series (`archive`).
 *   Federal Reserve  the whole H.15 release (a zip, about 4 MB) and the two Open Market Operations
 *        pages listing every FOMC target change since 1990.
 *
 * Usage:
 *   node --env-file=server/.env server/seed/fetch-economic-series.js [--series wti-spot,home-price]
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { DATA_DIR, mirrorFile, recordFetch } from '../lib/data-dir.js';
import { EIA_PET_BULK, BEA_FILES, DEBT_TO_PENNY, CDC_COVID_META, FED_H15, FED_H15_FILE, FED_OMO_PAGES, FILE_SOURCES, FISCAL_DATASETS, IRS_TABLE_24, SERIES } from '../lib/economic-series.js';

const arg = name => {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
};
const only = arg('--series')?.split(',');

async function fetchBea() {
  const contact = process.env.BLS_CONTACT_EMAIL;
  const headers = { 'User-Agent': `govgraph public records research${contact ? ` (${contact})` : ''}` };
  for (const url of BEA_FILES) {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    const text = await res.text();
    const file = mirrorFile(url);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
    recordFetch(file, url);
    console.log(`  BEA ${path.basename(file)}: ${(text.length / 1e6).toFixed(1)} MB`);
  }
}

async function fetchDebtToPenny() {
  const rows = [];
  let labels = null;
  for (let page = 1; ; page++) {
    const params = new URLSearchParams({ sort: 'record_date', 'page[size]': '10000', 'page[number]': String(page) });
    const { data } = await axios.get(`${DEBT_TO_PENNY}?${params}`);
    rows.push(...data.data);
    labels ??= data.meta.labels; // the publisher's name for each field
    if (page >= data.meta['total-pages']) break;
  }
  const file = `${mirrorFile(DEBT_TO_PENNY)}.json`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ source: 'treasury', fetched_at: new Date().toISOString(), labels, rows }));
  recordFetch(file, DEBT_TO_PENNY);
  console.log(`  Treasury debt to the penny: ${rows.length} days, ${rows[0]?.record_date} – ${rows.at(-1)?.record_date}`);
}

/**
 * A Fiscal Data dataset (Treasury), whole or limited to some values of one field, 10,000 rows a
 * request, saved with the publisher's field labels and the query it was limited to.
 */
async function fetchFiscalData(source, values) {
  const { url, filter } = FISCAL_DATASETS[source];
  const queries = filter ? values.map(v => `${filter}:eq:${v}`) : [null];
  const rows = [];
  let labels = null;
  for (const query of queries) {
    for (let page = 1; ; page++) {
      const params = new URLSearchParams({ sort: 'record_date', 'page[size]': '10000', 'page[number]': String(page) });
      if (query) params.set('filter', query);
      const { data } = await axios.get(`${url}?${params}`);
      rows.push(...data.data);
      labels ??= data.meta.labels;
      if (page >= data.meta['total-pages']) break;
    }
  }
  const file = `${mirrorFile(url)}.json`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ source, dataset: url, filter: filter ? queries : null, fetched_at: new Date().toISOString(), labels, rows }));
  recordFetch(file, url);
  console.log(`  ${FISCAL_DATASETS[source].name}: ${rows.length} rows, ${rows[0]?.record_date} – ${rows.at(-1)?.record_date}`);
}

/**
 * A published file, whole, at its mirror path (Census and others expect a contact in the User-Agent).
 * `archive`: an Internet Archive capture (timestamp) to take it from when the publisher refuses.
 */
// `contact`: send BLS_CONTACT_EMAIL in the User-Agent. Only BLS requires one; the files fetched before 2026-10-13 still
// send it until each publisher is tried without (features/data-sources).
async function fetchFile(url, file = mirrorFile(url), archive = null, { contact: withContact = true } = {}) {
  const contact = withContact ? process.env.BLS_CONTACT_EMAIL : null;
  let res = await fetch(url, { headers: { 'User-Agent': `govgraph public records research${contact ? ` (${contact})` : ''}` } });
  let capture = null;
  if (!res.ok && archive) {
    capture = archive;
    console.log(`  ${url}: ${res.status}; taking the Internet Archive's capture of ${archive}`);
    res = await fetch(`https://web.archive.org/web/${archive}id_/${url}`);
  }
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const body = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
  recordFetch(file, url, { archive: capture });
  console.log(`  ${path.relative(DATA_DIR, file)}: ${(body.length / 1e6).toFixed(1)} MB`);
}

async function run() {
  const list = only ? SERIES.filter(s => only.includes(s.slug)) : SERIES;
  if (only && list.length !== only.length) throw new Error(`Unknown series; known: ${SERIES.map(s => s.slug).join(', ')}`);
  console.log(`Fetching ${list.length} economic series into ${DATA_DIR}`);
  // A derived series needs its inputs; series from BLS survey files come from fetch-bls-bulk.js.
  const inputs = list.flatMap(s => (s.derived ? Object.values(s.derived).map(slug => SERIES.find(x => x.slug === slug)) : [s]));
  if (inputs.some(s => s.source === 'eia')) await fetchFile(EIA_PET_BULK, mirrorFile(EIA_PET_BULK), null, { contact: false });
  if (inputs.some(s => s.source === 'bea')) await fetchBea();
  if (inputs.some(s => s.source === 'treasury')) await fetchDebtToPenny();
  const published = new Map(inputs.filter(s => FILE_SOURCES.includes(s.source)).map(s => [s.url, s.archive ?? null]));
  if (inputs.some(s => s.source === 'irs-soi')) published.set(IRS_TABLE_24, null); // kept, not loaded
  // Census's new-home prices are fetched without the contact address; the others still send it (see fetchFile).
  for (const [url, archive] of published) await fetchFile(url, mirrorFile(url), archive, { contact: !url.includes('/construction/nrs/') });
  for (const source of Object.keys(FISCAL_DATASETS)) {
    // A dataset limited by line is saved as one file, so it is fetched for every series that reads it.
    if (inputs.some(s => s.source === source)) await fetchFiscalData(source, SERIES.filter(s => s.source === source).map(s => s.source_id));
  }
  if (inputs.some(s => s.source === 'fed-h15')) await fetchFile(FED_H15, FED_H15_FILE());
  if (inputs.some(s => s.source === 'cdc')) await fetchFile(CDC_COVID_META); // the dataset's name and column descriptions
  if (inputs.some(s => s.source === 'fed-omo')) for (const url of FED_OMO_PAGES) await fetchFile(url);
  if (inputs.some(s => s.source === 'bls-bulk')) console.log('  BLS survey files: run fetch-bls-bulk.js --survey ln and --survey cu');
}

run().catch(err => {
  console.error(err.response ? `${err.response.status} ${JSON.stringify(err.response.data).slice(0, 300)}` : err);
  process.exit(1);
});
