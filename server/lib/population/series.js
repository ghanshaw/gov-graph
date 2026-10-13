// Demographic series for the Demographic Data page (client/src/pages/Demographics.jsx), read from the
// Census Bureau files on disk (seed/fetch-population.js) and stored with the economic series
// (seed/load-demographic-series.js; economic_series with `measure` and `place`).
//
// A measure is one published figure (resident population, median age, …); it has a series for the
// nation (place null, slug = the measure's slug) and one per state and congressional district where
// the Census Bureau publishes it (slug `<measure>--<place key>`). Figures are as printed: nothing is
// derived. Annual estimates come one file per decade; each year is taken from the newest file that
// covers it, and the description says which file covers which years.

import fs from 'fs';
import path from 'path';
import { ROOT } from './files.js';
import { readXls } from '../xls.js';
import { splitCsv } from './acs.js';
import { acsYears, acsGeographies, acsTable } from './acs-read.js';
import { ACS_TABLES } from './sources.js';
import { STATES, stateByAbbr, stateByFips, stateByName, NATION, statePlace, districtPlace, linesOf } from './places.js';

const POPEST = path.join(ROOT, 'programs-surveys', 'popest');
const DECENNIAL = path.join(ROOT, 'programs-surveys', 'decennial');
const rel = file => path.relative(ROOT, file);

// ---------------------------------------------------------------------------
// Annual estimates, 1900–1989: one text table per decade, rows by state abbreviation ("U.S." or
// "US" for the nation), the years in blocks of columns. Each file's columns in order, as its
// headers print them: a year is a July 1 estimate, "Y-c" the April 1 census count (left out here:
// counts are their own series). 1900–1969 are printed in thousands.

const DECADE_TABLES = [
  ['st0009ts.txt', range(1900, 1909), true],
  ['st1019ts_v2.txt', range(1910, 1919), true],
  ['st2029ts.txt', range(1920, 1929), true],
  ['st3039ts.txt', range(1930, 1939), true],
  ['st4049ts.txt', range(1940, 1949), true],
  ['st5060ts.txt', ['1950-c', ...range(1950, 1959), '1960-c'], true],
  ['st6070ts.txt', ['1960-c', ...range(1960, 1969), '1970-c'], true],
  ['st7080ts.txt', ['1970-c', ...range(1971, 1979), '1980-c'], false],
  ['st8090ts.txt', ['1980-c', ...range(1981, 1989), '1990-c'], false],
];
function range(a, b) {
  return Array.from({ length: b - a + 1 }, (_, i) => String(a + i));
}

/** A decade table → Map(abbr | 'us' → [[date, value]]), checking every row has every column. */
export function readDecadeTable(text, columns, thousands) {
  const values = new Map();
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(?:\d+\s+)?(U\.S\.|US|[A-Z]{2})\s+([\d,\s]+)$/.exec(line);
    if (!m) continue;
    const key = m[1] === 'U.S.' || m[1] === 'US' ? 'us' : m[1].toLowerCase();
    if (key !== 'us' && !stateByAbbr.has(key)) continue;
    const numbers = m[2].trim().split(/\s+/).map(n => Number(n.replace(/,/g, '')));
    if (!values.has(key)) values.set(key, []);
    values.get(key).push(...numbers);
  }
  const out = new Map();
  for (const [key, numbers] of values) {
    if (numbers.length !== columns.length) throw new Error(`${key}: ${numbers.length} values for ${columns.length} columns`);
    out.set(key, columns.flatMap((c, i) => (c.endsWith('-c') ? [] : [[`${c}-07-01`, thousands ? numbers[i] * 1000 : numbers[i]]])));
  }
  return out;
}

// 1990–1999: the nation from the intercensal file of each year ("July 1, 1995","All Age",total),
// the states from ST-99-3 (postcensal, December 1999; no intercensal state totals are on disk).
function nineties() {
  const out = new Map([['us', []]]);
  for (let y = 1990; y <= 1999; y++) {
    const file = path.join(POPEST, 'datasets/1990-2000/intercensal/national', `us-est90int-07-${y}.csv`);
    const line = fs.readFileSync(file, 'latin1').split(/\r?\n/).find(l => l.startsWith(`"July 1, ${y}","All Age"`));
    if (!line) throw new Error(`${rel(file)}: no July 1 total`);
    out.get('us').push([`${y}-07-01`, Number(splitCsv(line)[2])]);
  }
  const st = fs.readFileSync(path.join(POPEST, 'tables/1990-2000/state/totals/st-99-03.txt'), 'latin1');
  for (const line of st.split(/\r?\n/)) {
    // Block number, area name, then the block's columns.
    const m = /^\s*\d\s{4}(\S.*?)\s{2,}([\d\s]+)$/.exec(line);
    const s = m && stateByName.get(m[1].trim().toLowerCase());
    if (!s) continue;
    if (!out.has(s.abbr)) out.set(s.abbr, []);
    out.get(s.abbr).push(...m[2].trim().split(/\s+/).map(Number));
  }
  // Columns run from 7/1/99 back to 7/1/90, then the April 1, 1990 census base, which is left out.
  for (const [key, list] of out) {
    if (key === 'us') continue;
    if (list.length !== 11) throw new Error(`st-99-03 ${key}: ${list.length} columns, expected 11`);
    out.set(key, list.slice(0, 10).map((v, i) => [`${1999 - i}-07-01`, v]));
  }
  return out;
}

/** An alldata CSV (SUMLEV, …, STATE, NAME, columns by year) → Map(fips → row object). */
function alldata(file, filter = () => true) {
  const [head, ...lines] = fs.readFileSync(file, 'latin1').split(/\r?\n/).filter(Boolean);
  const cols = splitCsv(head);
  const rows = new Map();
  for (const line of lines) {
    const row = Object.fromEntries(splitCsv(line).map((v, i) => [cols[i], v]));
    if (!filter(row)) continue;
    rows.set(row.STATE.padStart(2, '0'), row);
  }
  return rows;
}
const placeOfFips = fips => (fips === '00' || fips === '0' ? 'us' : stateByFips.get(fips)?.abbr ?? null);

const ALLDATA = {
  '2000-2010': ['datasets/2000-2010/intercensal/state/st-est00int-alldata.csv', range(2000, 2010),
    r => r.SEX === '0' && r.ORIGIN === '0' && r.RACE === '0' && r.AGEGRP === '0'],
  '2010-2020': ['datasets/2010-2020/state/totals/nst-est2020-alldata.csv', range(2010, 2020), r => ['010', '040'].includes(r.SUMLEV)],
  '2020-2025': ['datasets/2020-2025/state/totals/NST-EST2025-ALLDATA.csv', range(2020, 2025), r => ['010', '040'].includes(r.SUMLEV)],
};

/** Resident population, July 1 of each year, 1900 on: Map(place key → { observations, files }). */
export function readEstimates() {
  const byPlace = new Map();
  // Later files replace earlier ones year by year.
  const put = (key, observations, file) => {
    if (!byPlace.has(key)) byPlace.set(key, new Map());
    for (const [date, value] of observations) byPlace.get(key).set(date, { value, file });
  };
  for (const [name, columns, thousands] of DECADE_TABLES) {
    const file = path.join(POPEST, 'tables/1980-1990/state/asrh', name);
    for (const [key, obs] of readDecadeTable(fs.readFileSync(file, 'latin1'), columns, thousands)) put(key, obs, name.replace(/\.txt$/, ''));
  }
  const file90 = 'us-est90int-07 (nation, intercensal), st-99-03 (states, December 1999)';
  for (const [key, obs] of nineties()) put(key, obs, file90);
  for (const [file, years, filter] of Object.values(ALLDATA)) {
    for (const [fips, row] of alldata(path.join(POPEST, file), filter)) {
      const key = placeOfFips(fips);
      if (key) put(key, years.map(y => [`${y}-07-01`, Number(row[`POPESTIMATE${y}`])]).filter(([, v]) => Number.isFinite(v) && v > 0), path.basename(file, '.csv'));
    }
  }
  const out = new Map();
  for (const [key, dates] of byPlace) {
    const observations = [...dates].sort(([a], [b]) => a.localeCompare(b)).map(([date, { value }]) => [date, value]);
    // Which file supplies which years, in order: "1900–1909 st0009ts.txt; …".
    const spans = [];
    for (const [date, { file }] of [...dates].sort(([a], [b]) => a.localeCompare(b))) {
      const y = date.slice(0, 4);
      if (spans.at(-1)?.file === file) spans.at(-1).to = y;
      else spans.push({ file, from: y, to: y });
    }
    out.set(key, { observations, files: spans.map(s => `${s.from}–${s.to}: ${s.file}`).join('; ') });
  }
  return out;
}

// Components of change, years ending June 30 (dated by July 1 of the year they end). Each file's
// first column is the part year from the census (April–June) and is left out.
const COMPONENTS = [
  ['births', 'BIRTHS', 'Births'],
  ['deaths', 'DEATHS', 'Deaths'],
  // NATURALINC in the 2010–2020 file, NATURALCHG in 2020–2025.
  ['natural-increase', 'NATURALINC|NATURALCHG', 'Natural Increase'],
  ['international-migration', 'INTERNATIONALMIG', 'Net International Migration'],
  ['domestic-migration', 'DOMESTICMIG', 'Net Domestic Migration'],
];
function readComponents(column) {
  const out = new Map();
  for (const key of ['2010-2020', '2020-2025']) {
    const [file, years, filter] = ALLDATA[key];
    for (const [fips, row] of alldata(path.join(POPEST, file), filter)) {
      const place = placeOfFips(fips);
      if (!place) continue;
      const col = column.split('|').find(c => `${c}${years[1]}` in row);
      if (!col) continue;
      const obs = years.slice(1).map(y => [`${y}-07-01`, Number(row[`${col}${y}`])]).filter(([, v]) => Number.isFinite(v));
      out.set(place, [...(out.get(place) ?? []).filter(([d]) => !obs.some(([o]) => o === d)), ...obs].sort(([a], [b]) => a.localeCompare(b)));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Census counts and House seats. 1790–1900 from Part II of Population of States and Counties
// (1990); 1910–2020 from the 2020 apportionment table, which revises some earlier counts.

const PART_II = path.join(DECENNIAL, 'tables/1990/population-of-states-and-counties-us-1790-1990/population_partii.xls');
const APPORTIONMENT = path.join(DECENNIAL, '2020/data/apportionment/apportionment.csv');

function readApportionment() {
  const [head, ...lines] = fs.readFileSync(APPORTIONMENT, 'utf8').split(/\r?\n/).filter(Boolean);
  const cols = splitCsv(head);
  return lines.map(l => Object.fromEntries(splitCsv(l).map((v, i) => [cols[i], v])));
}
const num = v => (v == null || v === '' || v === '---' ? null : Number(String(v).replace(/,/g, '')));

function readCensusCounts() {
  const out = new Map();
  const add = (key, date, value) => {
    if (value == null) return;
    if (!out.has(key)) out.set(key, new Map());
    out.get(key).set(date, value);
  };
  const rows = readXls(PART_II);
  const years = rows.find(r => r[1] === '1990')?.slice(1, 22).map(Number);
  for (const r of rows) {
    const label = String(r[0] ?? '').trim();
    const key = label === 'UNITED STATES' ? 'us' : stateByName.get(label.toLowerCase())?.abbr;
    if (!key || !years) continue;
    years.forEach((y, i) => { if (y <= 1900) add(key, `${y}-04-01`, num(r[i + 1])); });
  }
  for (const r of readApportionment()) {
    const key = r['Geography Type'] === 'Nation' ? 'us' : stateByName.get(r.Name.toLowerCase())?.abbr;
    if (key) add(key, `${r.Year}-04-01`, num(r['Resident Population']));
  }
  return new Map([...out].map(([k, m]) => [k, [...m].sort(([a], [b]) => a.localeCompare(b))]));
}

function readSeats() {
  const out = new Map();
  for (const r of readApportionment()) {
    const s = r['Geography Type'] === 'State' && stateByName.get(r.Name.toLowerCase());
    const seats = num(r['Number of Representatives']);
    if (!s || seats == null) continue;
    if (!out.has(s.abbr)) out.set(s.abbr, []);
    out.get(s.abbr).push([`${r.Year}-04-01`, seats]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// The ACS, 1-year estimates: a measure is one printed line of a table, found by its label (tables
// were reworded and renumbered over the years; B11009 counted unmarried partners only until 2018).
// `nth` picks a later line with the same label. Years whose table has no such line are left out.

const ACS = [
  // Age and sex
  ['median-age', 'B01002', /^total/, 'Median Age', 'years', 'age-sex'],
  ['median-age-men', 'B01002', /^male/, 'Median Age of Men', 'years', 'age-sex'],
  ['median-age-women', 'B01002', /^female/, 'Median Age of Women', 'years', 'age-sex'],
  ['men', 'B01001', /^male/, 'Men and Boys', 'people', 'age-sex'],
  ['women', 'B01001', /^female/, 'Women and Girls', 'people', 'age-sex'],
  // Race and Hispanic origin
  ['race-white', 'B02001', /^white alone/, 'White Alone', 'people', 'race'],
  ['race-black', 'B02001', /^black or african american alone/, 'Black or African American Alone', 'people', 'race'],
  ['race-american-indian', 'B02001', /^american indian and alaska native alone/, 'American Indian and Alaska Native Alone', 'people', 'race'],
  ['race-asian', 'B02001', /^asian alone/, 'Asian Alone', 'people', 'race'],
  ['race-pacific-islander', 'B02001', /^native hawaiian and other pacific islander alone/, 'Native Hawaiian and Pacific Islander Alone', 'people', 'race'],
  ['race-other', 'B02001', /^some other race alone/, 'Some Other Race Alone', 'people', 'race'],
  ['race-two-or-more', 'B02001', /^two or more races/, 'Two or More Races', 'people', 'race'],
  ['hispanic', 'B03002', /^hispanic or latino/, 'Hispanic or Latino', 'people', 'race'],
  // Income and poverty (dollars of each survey year)
  ['acs-median-household-income', 'B19013', /median household income/, 'Median Household Income, ACS', '$', 'income-poverty'],
  ['per-capita-income', 'B19301', /per capita income/, 'Per Capita Income', '$', 'income-poverty'],
  ['gini-index', 'B19083', /gini index/, 'Gini Index of Income Inequality', 'gini', 'income-poverty'],
  ['below-poverty', 'B17001', /below poverty level/, 'People Below the Poverty Line', 'people', 'income-poverty'],
  // Education and work
  ['high-school-diploma', 'B15003', /^regular high school diploma/, 'High School Diploma, Highest Level', 'people', 'education-work'],
  ['bachelors-degree', 'B15003', /^bachelor.s degree/, 'Bachelor’s Degree, Highest Level', 'people', 'education-work'],
  ['masters-degree', 'B15003', /^master.s degree/, 'Master’s Degree, Highest Level', 'people', 'education-work'],
  ['doctorate-degree', 'B15003', /^doctorate degree/, 'Doctorate, Highest Level', 'people', 'education-work'],
  ['in-labor-force', 'B23025', /^in labor force/, 'People in the Labor Force', 'people', 'education-work'],
  ['acs-unemployed', 'B23025', /^unemployed/, 'Unemployed People, ACS', 'people', 'education-work'],
  ['veterans', 'B21001', /^veteran/, 'Veterans', 'people', 'education-work'],
  // Households and housing
  ['households', 'B11001', /^total/, 'Households', 'households', 'households'],
  ['owner-occupied', 'B25003', /^owner.occupied/, 'Owner-Occupied Homes', 'households', 'households'],
  ['renter-occupied', 'B25003', /^renter.occupied/, 'Renter-Occupied Homes', 'households', 'households'],
  ['male-couple-households', 'B11009', /^male householder and male partner/, 'Male Same-Sex Unmarried Couples', 'households', 'households'],
  ['female-couple-households', 'B11009', /^female householder and female partner/, 'Female Same-Sex Unmarried Couples', 'households', 'households'],
  ['same-sex-spouse', 'B09019', /same.sex (husband|wife|spouse)/, 'Same-Sex Spouses', 'people', 'households'],
  ['same-sex-partner', 'B09019', /same.sex unmarried partner/, 'Same-Sex Unmarried Partners', 'people', 'households'],
  // Nativity and language
  ['foreign-born', 'B05002', /^foreign[- ]born/, 'Foreign-Born Population', 'people', 'nativity'],
  ['naturalized', 'B05002', /^naturalized/, 'Naturalized Citizens', 'people', 'nativity'],
  ['not-a-citizen', 'B05002', /^not a u\.?\s?s\.? citizen/, 'Foreign-Born, Not a Citizen', 'people', 'nativity'],
  ['english-only', 'B16001', /^speak only english/, 'Speak Only English at Home', 'people', 'nativity'],
].map(([slug, table, label, name, unit, category]) => ({ slug, table, label, name, unit, category }));

const cleanLabel = l => String(l ?? '').toLowerCase().replace(/[:\s]+$/, '').trim();

/** Every ACS measure → Map(place key → { place, observations }), reading each year and place once. */
function readAcs(log = () => {}) {
  const out = new Map(ACS.map(m => [m.slug, new Map()]));
  // Each measure's line as the latest year prints it.
  const printed = new Map();
  const tables = [...new Set(ACS.map(m => m.table))];
  for (const { year } of acsYears()) {
    const geos = acsGeographies(year);
    let found = 0;
    for (const g of geos) {
      const s = g.level === 'nation' ? null : stateByFips.get(g.level === 'state' ? g.geoid.slice(-2) : g.geoid.slice(-4, -2));
      if (g.level !== 'nation' && !s) continue;
      let place;
      if (g.level === 'nation') place = NATION;
      else if (g.level === 'state') place = statePlace(s);
      else {
        if (!g.congress) continue;
        place = { level: 'district', state: s.abbr, district: g.geoid.slice(-2), lines: linesOf(s.abbr, g.congress), congress: g.congress, s };
        place.key = `${s.abbr}-${place.district}-l${place.lines}`;
      }
      for (const table of tables) {
        const t = acsTable(year, g.geoid, table);
        if (!t) continue;
        for (const m of ACS.filter(x => x.table === table)) {
          const row = t.rows.find(r => r.estimate != null && m.label.test(cleanLabel(r.label)));
          if (!row) continue;
          printed.set(m.slug, { label: String(row.label).replace(/:$/, '') });
          const value = Number(row.estimate);
          if (!Number.isFinite(value)) continue;
          const series = out.get(m.slug);
          const key = place.key ?? 'us';
          if (!series.has(key)) series.set(key, { place, observations: [], congresses: new Set() });
          const entry = series.get(key);
          entry.observations.push([`${year}-01-01`, value]);
          if (place.congress) entry.congresses.add(place.congress);
          found++;
        }
      }
    }
    log(`  ACS ${year}: ${geos.length} places, ${found} values`);
  }
  return { out, printed };
}

// ---------------------------------------------------------------------------
// The catalog: every measure for every place it is published for, with its observations.

const placeName = place => (place.level === 'nation' ? null : place.label);
const seriesName = (name, place) => (place?.level && place.level !== 'nation' ? `${name}, ${placeName(place)}` : name);

function placeFromKey(key) {
  if (key === 'us') return NATION;
  return statePlace(stateByAbbr.get(key));
}

/**
 * Every demographic series: [{ slug, measure, place, source, source_id, frequency, name, description,
 * category, unit, observations }]. `only` limits it to some measures (by slug), `levels` to
 * some levels ('nation', 'state', 'district').
 */
export function demographicSeries({ only = null, levels = null, log = () => {} } = {}) {
  const want = slug => !only || only.includes(slug);
  const out = [];
  const add = (measure, key, place, observations, extra) => {
    if (levels && !levels.includes(place.level)) return;
    if (!observations.length) return;
    const slug = place.key ? `${measure.slug}--${place.key}` : measure.slug;
    out.push({
      slug, measure: measure.slug, place: place.key ?? null, placeLevel: place.level, placeLabel: place.label,
      source: measure.source, source_id: `${measure.sourceId}${place.key ? ` @ ${place.key}` : ''}`, frequency: 'annual',
      name: seriesName(measure.name, place), category: measure.category, unit: measure.unit,
      description: `${measure.description(extra)}${place.level === 'nation' ? '' : ` Figures for ${place.label}.`}`,
      observations,
    });
  };

  if (want('population')) {
    const m = {
      slug: 'population', name: 'Resident Population', unit: 'people', category: 'population', source: 'census-popest', sourceId: 'Population estimates, July 1',
      description: files => `Resident population on July 1 of each year: the Census Bureau's annual estimates (intercensal where published), published one file per decade, each year from the newest file that covers it (${files}). Printed in thousands to 1969. The decade files of the 1970s and 1980s give no July 1970 or July 1980 estimate.`,
    };
    for (const [key, { observations, files }] of readEstimates()) add(m, key, placeFromKey(key), observations, files);
  }
  if (want('census-population')) {
    const m = {
      slug: 'census-population', name: 'Census Count', unit: 'people', category: 'population', source: 'census-decennial', sourceId: 'Decennial census, resident population',
      description: () => 'Resident population counted by each decennial census, April 1 (the first Monday of August in 1790–1820, June 1 in 1830–1900). 1790–1900 from Population of States and Counties of the United States: 1790 to 1990, Part II; 1910–2020 from the 2020 apportionment table, which revises some earlier counts.',
    };
    for (const [key, obs] of readCensusCounts()) add(m, key, placeFromKey(key), obs);
  }
  if (want('house-seats')) {
    const m = {
      slug: 'house-seats', name: 'House Seats', unit: 'seats', category: 'population', source: 'census-apportionment', sourceId: 'Apportionment, number of representatives',
      description: () => 'Seats in the House of Representatives apportioned after each census, from the 2020 apportionment table (1910 on).',
    };
    for (const [key, obs] of readSeats()) add(m, key, placeFromKey(key), obs);
  }
  for (const [slug, column, name] of COMPONENTS) {
    if (!want(slug)) continue;
    const m = {
      slug, name, unit: 'people', category: 'population', source: 'census-popest', sourceId: `Components of change, ${column.replace('|', ' / ')}`,
      description: () => `${name} in the year to June 30 (dated July 1 of the year it ends), from the Census Bureau's population estimates (nst-est2020-alldata, 2011–2020; NST-EST2025-ALLDATA, 2021–2025). The part years from each census to June 30 are left out.`,
    };
    for (const [key, obs] of readComponents(column)) add(m, key, placeFromKey(key), obs);
  }

  const acsWanted = ACS.filter(m => want(m.slug));
  if (acsWanted.length && (!levels || levels.length)) {
    const { out: acs, printed } = readAcs(log);
    for (const m of acsWanted) {
      const measure = {
        ...m, source: 'census-acs', sourceId: `ACS 1-year ${m.table}, “${printed.get(m.slug)?.label ?? m.slug}”`,
        description: () => `American Community Survey 1-year estimates, table ${m.table} (${ACS_TABLES.find(([id]) => id === m.table)?.[1].toLowerCase() ?? 'title not listed'}), the line “${printed.get(m.slug)?.label ?? ''}”. ${m.unit === '$' ? 'Dollars of each survey year, as published. ' : ''}No 1-year estimates were released for 2020.`,
      };
      for (const [, { place, observations, congresses }] of acs.get(m.slug)) {
        const full = place.level === 'district'
          ? districtPlace(place.s, place.district, place.lines, Math.max(...congresses))
          : place;
        add(measure, full.key, full, observations.sort(([a], [b]) => a.localeCompare(b)));
      }
    }
  }
  return out;
}

export const ACS_MEASURES = ACS;
export { STATES };
