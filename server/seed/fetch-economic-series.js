#!/usr/bin/env node
/**
 * Download the economic series listed in lib/economic-series.js into the data directory.
 *
 * Each series is fetched whole and kept as the publisher's own rows, at the API's path
 * (lib/economic-series.js, seriesFile):
 *   api.eia.gov/v2/petroleum/pri/spt/RWTC-daily.json
 *   api.bls.gov/publicAPI/timeseries/data/LNS14000000-monthly.json
 *   apps.bea.gov/national/Release/TXT/NipaDataQ.txt       (every quarterly NIPA series)
 *   api.fiscaldata.treasury.gov/…/debt_to_penny.json      (every day since April 1993)
 * A whole series is at most a few MB, so re-running simply fetches it again; publishers revise
 * recent values.
 *
 *   EIA  at most 5,000 rows a request, so a daily series since 1986 takes three.
 *   BLS  10 years a request without a key (20 with BLS_API_KEY), every BLS series at once; the
 *        keyless limit is 25 requests a day, and 1948 to now takes 8.
 *   BEA  the national accounts' flat files, whole (quarterly and annual data, the series and
 *        tables registers; about 45 MB), with a contact in the User-Agent (BLS_CONTACT_EMAIL).
 *   Treasury  Debt to the Penny, 10,000 rows a request. Derived series need no download.
 *   Michigan, Census, Freddie Mac, FHFA  one published file each (a series' `url`), whole.
 *   Census API  New Residential Sales, every series from 1963 in one request (CENSUS_API_KEY).
 *   Treasury taxes  Fiscal Data: Monthly Treasury Statement Table 9 whole; Daily Treasury Statement
 *        Table IV (Federal Tax Deposits, 2005–2023) whole and Table II's tax lines (2023 on).
 *   OMB, CBO, IRS  one published file each (.xlsx, .xls), whole. cbo.gov refuses scripted requests,
 *        so CBO's file is taken from the Internet Archive capture named on the series (`archive`).
 *   Federal Reserve  the whole H.15 release (a zip, about 4 MB) and the two Open Market Operations
 *        pages listing every FOMC target change since 1990.
 *
 * Usage:
 *   node --env-file=server/.env server/seed/fetch-economic-series.js [--series wti-spot,unemployment-rate]
 *
 * Env:
 *   EIA_API_KEY — free at https://www.eia.gov/opendata/ (needed for EIA series)
 *   BLS_API_KEY — optional, free at https://data.bls.gov/registrationEngine/
 *   CENSUS_API_KEY — free at https://api.census.gov/data/key_signup.html (needed for new-home prices)
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { DATA_DIR } from '../lib/data-dir.js';
import { mirrorFile } from '../lib/data-dir.js';
import { EIA_API, BLS_API, BEA_FILES, DEBT_TO_PENNY, CENSUS_RESSALES, CDC_COVID_META, FED_H15, FED_H15_FILE, FED_OMO_PAGES, FILE_SOURCES, FISCAL_DATASETS, IRS_TABLE_24, SERIES, seriesFile } from '../lib/economic-series.js';

const arg = name => {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
};
const only = arg('--series')?.split(',');
const EIA_PAGE = 5000;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchEia(s) {
  const key = process.env.EIA_API_KEY;
  if (!key) throw new Error('EIA_API_KEY is not set (server/.env)');
  const rows = [];
  for (let offset = 0; ; offset += EIA_PAGE) {
    const params = new URLSearchParams({
      api_key: key,
      frequency: s.frequency,
      'data[0]': 'value',
      'facets[series][]': s.source_id,
      'sort[0][column]': 'period',
      'sort[0][direction]': 'asc',
      offset: String(offset),
      length: String(EIA_PAGE),
    });
    const { data } = await axios.get(`${EIA_API}/${s.route}/data/?${params}`);
    const page = data.response?.data;
    if (!Array.isArray(page)) throw new Error(`unexpected response: ${JSON.stringify(data).slice(0, 200)}`);
    rows.push(...page);
    if (!page.length || rows.length >= Number(data.response.total)) break;
    await sleep(200);
  }
  return rows;
}

/** Every BLS series in `list`, in spans of years, oldest first → Map(series id → rows). */
async function fetchBls(list) {
  const key = process.env.BLS_API_KEY;
  const span = key ? 20 : 10;
  const url = `${BLS_API}/${key ? 'v2' : 'v1'}/timeseries/data/`;
  const thisYear = new Date().getFullYear();
  const rows = new Map(list.map(s => [s.source_id, []]));
  for (let start = Math.min(...list.map(s => s.from)); start <= thisYear; start += span) {
    const ids = list.filter(s => s.from <= start + span - 1).map(s => s.source_id);
    const body = { seriesid: ids, startyear: String(start), endyear: String(Math.min(thisYear, start + span - 1)) };
    if (key) body.registrationkey = key;
    const { data } = await axios.post(url, body, { headers: { 'Content-Type': 'application/json' } });
    if (data.status !== 'REQUEST_SUCCEEDED') throw new Error(`BLS ${data.status}: ${data.message?.join(' ')}`);
    for (const series of data.Results.series) rows.get(series.seriesID).push(...series.data);
    console.log(`  BLS ${body.startyear}–${body.endyear}: ${ids.length} series`);
    await sleep(500);
  }
  return rows;
}

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
  console.log(`  ${FISCAL_DATASETS[source].name}: ${rows.length} rows, ${rows[0]?.record_date} – ${rows.at(-1)?.record_date}`);
}

/**
 * A published file, whole, at its mirror path (Census and others expect a contact in the User-Agent).
 * `archive`: an Internet Archive capture (timestamp) to take it from when the publisher refuses.
 */
async function fetchFile(url, file = mirrorFile(url), archive = null) {
  const contact = process.env.BLS_CONTACT_EMAIL;
  let res = await fetch(url, { headers: { 'User-Agent': `govgraph public records research${contact ? ` (${contact})` : ''}` } });
  if (!res.ok && archive) {
    console.log(`  ${url}: ${res.status}; taking the Internet Archive's capture of ${archive}`);
    res = await fetch(`https://web.archive.org/web/${archive}id_/${url}`);
  }
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const body = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
  console.log(`  ${path.relative(DATA_DIR, file)}: ${(body.length / 1e6).toFixed(1)} MB`);
}

/** New Residential Sales, whole: every category, data type and adjustment from 1963 (about 1 MB). */
async function fetchRessales() {
  const key = process.env.CENSUS_API_KEY;
  if (!key) throw new Error('CENSUS_API_KEY is not set (server/.env)');
  const params = new URLSearchParams({
    get: 'cell_value,time_slot_id,category_code,data_type_code,seasonally_adj,error_data',
    for: 'us:*', time: 'from 1963-01', key,
  });
  const res = await fetch(`${CENSUS_RESSALES}?${params}`);
  const text = await res.text();
  if (!res.ok || !text.startsWith('[')) throw new Error(`Census API ${res.status}: ${text.match(/<title>(.*?)<\/title>/)?.[1] ?? text.slice(0, 200)}`);
  const rows = JSON.parse(text);
  const file = seriesFile(SERIES.find(s => s.source === 'census-api'));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // The key is a request parameter only; it is not stored.
  fs.writeFileSync(file, JSON.stringify({ source: 'census', dataset: 'timeseries/eits/ressales', fetched_at: new Date().toISOString(), rows }));
  console.log(`  Census new residential sales: ${rows.length - 1} values`);
}

function save(s, rows) {
  const file = seriesFile(s);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ source: s.source, series: s.source_id, route: s.route ?? null, frequency: s.frequency, fetched_at: new Date().toISOString(), rows }));
  console.log(`  ${s.slug} (${s.source_id}): ${rows.length} rows`);
}

async function run() {
  const list = only ? SERIES.filter(s => only.includes(s.slug)) : SERIES;
  if (only && list.length !== only.length) throw new Error(`Unknown series; known: ${SERIES.map(s => s.slug).join(', ')}`);
  console.log(`Fetching ${list.length} economic series into ${DATA_DIR}`);
  for (const s of list.filter(s => s.source === 'eia')) save(s, await fetchEia(s));
  // A derived series needs its inputs; series from BLS survey files come from fetch-bls-bulk.js.
  const inputs = list.flatMap(s => (s.derived ? Object.values(s.derived).map(slug => SERIES.find(x => x.slug === slug)) : [s]));
  if (inputs.some(s => s.source === 'bea')) await fetchBea();
  if (inputs.some(s => s.source === 'treasury')) await fetchDebtToPenny();
  const published = new Map(inputs.filter(s => FILE_SOURCES.includes(s.source)).map(s => [s.url, s.archive ?? null]));
  if (inputs.some(s => s.source === 'irs-soi')) published.set(IRS_TABLE_24, null); // kept, not loaded
  for (const [url, archive] of published) await fetchFile(url, mirrorFile(url), archive);
  for (const source of Object.keys(FISCAL_DATASETS)) {
    // A dataset limited by line is saved as one file, so it is fetched for every series that reads it.
    if (inputs.some(s => s.source === source)) await fetchFiscalData(source, SERIES.filter(s => s.source === source).map(s => s.source_id));
  }
  if (inputs.some(s => s.source === 'census-api')) await fetchRessales();
  if (inputs.some(s => s.source === 'fed-h15')) await fetchFile(FED_H15, FED_H15_FILE());
  if (inputs.some(s => s.source === 'cdc')) await fetchFile(CDC_COVID_META); // the dataset's name and column descriptions
  if (inputs.some(s => s.source === 'fed-omo')) for (const url of FED_OMO_PAGES) await fetchFile(url);
  if (inputs.some(s => s.source === 'bls-bulk')) console.log('  BLS survey files: run fetch-bls-bulk.js --survey cu');
  const bls = list.filter(s => s.source === 'bls');
  if (bls.length) {
    const rows = await fetchBls(bls);
    for (const s of bls) save(s, rows.get(s.source_id));
  }
}

run().catch(err => {
  console.error(err.response ? `${err.response.status} ${JSON.stringify(err.response.data).slice(0, 300)}` : err);
  process.exit(1);
});
