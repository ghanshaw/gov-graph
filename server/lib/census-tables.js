// Census Bureau tables collected for the Statistical Abstract's Section 1, Population (Phase 5c), read from the
// publisher's own printed tables in the data folder, never added up from its detailed files.
//
// Census prints most of its summary tables in one layout: a title block, heading rows (years, and under them sexes,
// or a year down the side), then rows whose label's leading dots give its depth under the block above it ("MALE",
// ".Under 5 years", "...White"), then notes. `readCensusGrid` reads that layout into rows and column heading paths;
// each table below says what its rows and columns are. Values are stored as printed (thousands stay thousands).
//
// One series may be printed by several tables: the population estimates are one table per decade (2000–2010 and
// 2010–2020 intercensal, 2020–2025), joined as the resident population already is (each year from the newest table
// that prints it; the description says which table gives which years). Within one vintage the first table listed wins.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MAX_NAME } from './series-names.js';

// The series list, written by server/seed/build-census-tables.js from the tables on disk (the tables' rows are their
// series, so the list is read from the files once, not each time the module loads).
export const CENSUS_TABLES_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'seed', 'data', 'census-tables.json');
let cache = null;
/** Every series of these tables, from census-tables.json ([] before it is built). */
export const censusSeries = () => (cache ??= fs.existsSync(CENSUS_TABLES_FILE) ? JSON.parse(fs.readFileSync(CENSUS_TABLES_FILE, 'utf8')).series : []);

const POPPROJ = 'https://www2.census.gov/programs-surveys/popproj/tables/2023/2023-summary-tables/';
const POPEST = 'https://www2.census.gov/programs-surveys/popest/tables/';

const isYear = c => /^\d{4}$/.test(String(c ?? '').trim());
const text = c => String(c ?? '').replace(/\s+/g, ' ').trim();
const isNumber = c => c != null && text(c) !== '' && Number.isFinite(Number(c));

/**
 * A printed table → { columns, rows }: `columns[j]` is column j's heading path, top row first (a heading spanning
 * several columns is repeated under each); each row is { path, label, depth, values: Map(j → number) } in printed
 * order, `path` its labels from the block down. Rows with no values (blank, "One Race:") are left out but still
 * head the rows under them; the notes end the table.
 */
export function readCensusGrid(rows) {
  // The heading rows run from the first row with words beyond the first column to the first row of figures.
  const first = rows.findIndex(r => text(r?.[0]) && (r ?? []).slice(1).some(isNumber));
  if (first < 0) throw new Error('no rows of figures');
  let head = first - 1;
  while (head > 0 && (rows[head - 1] ?? []).slice(1).some(c => text(c))) head--;
  const heads = rows.slice(head, first);
  const width = Math.max(...rows.slice(first).map(r => r?.length ?? 0));
  // A blank heading cell continues the one to its left, unless a heading above it starts a new span there.
  const filled = heads.map(r => Array.from({ length: width }, (_, j) => text(r?.[j])));
  filled.forEach((r, i) => {
    for (let j = 2; j < width; j++) {
      if (!r[j] && heads.slice(0, i).every(above => !text(above?.[j]))) r[j] = r[j - 1];
    }
  });
  const columns = Array.from({ length: width }, (_, j) => filled.map(r => r[j]).filter(Boolean));
  const out = [];
  const stack = [];
  for (const r of rows.slice(first)) {
    const raw = text(r?.[0]);
    if (!raw) continue;
    if (/^(Notes?\b|Source:|Suggested Citation|Release Date|The Census Bureau has reviewed|\d+ ?[A-Z'])/.test(raw) && !(r ?? []).slice(1).some(isNumber)) break;
    const depth = /^\.*/.exec(raw)[0].length;
    const label = raw.replace(/^\.+/, '').trim();
    stack.length = depth;
    stack[depth] = label;
    const values = new Map();
    for (let j = 1; j < width; j++) if (isNumber(r[j])) values.set(j, Number(r[j]));
    if (values.size) out.push({ path: stack.filter(Boolean), label, depth, values });
  }
  return { columns, rows: out };
}

/** A printed table with the years down → Map(column heading → [[year, value]]); the heading may span two rows. */
export function readCensusColumns(rows) {
  const head = rows.findIndex(r => /^year$/i.test(text(r?.[0])));
  if (head < 0) throw new Error('no "Year" heading');
  const first = rows.findIndex((r, i) => i > head && isYear(r?.[0]));
  const headings = rows[head].map((c, i) => [text(c), ...rows.slice(head + 1, first).map(r => text(r?.[i]))].filter(Boolean).join(' '));
  const out = new Map(headings.slice(1).map(h => [h, []]));
  for (const r of rows.slice(first)) {
    if (!isYear(r?.[0])) break;
    headings.forEach((h, i) => {
      if (i === 0 || !isNumber(r[i])) return;
      out.get(h).push([Number(text(r[0])), Number(r[i])]);
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// What a row or column says.

/** "Under 5 years", "5 to 9 years", "100 years and over" → { key, label, words } (words follow the noun). */
export function ageOf(label) {
  let m = /^Under (\d+) years$/i.exec(label);
  if (m) return { key: `under-${m[1]}`, label: `Under ${m[1]}`, words: `Under ${m[1]}` };
  m = /^(\d+) to (\d+) years$/i.exec(label);
  if (m) return { key: `${m[1]}-${m[2]}`, label: `${m[1]}–${m[2]}`, words: `Aged ${m[1]} to ${m[2]}` };
  m = /^(\d+) years and over$/i.exec(label);
  if (m) return { key: `${m[1]}-over`, label: `${m[1]} and over`, words: `Aged ${m[1]} and Over` };
  return null;
}

const SEXES = { male: 'men', female: 'women', 'both sexes': null, total: null, 'total population': null };

// Census's races (one race alone, or alone or in combination where the row says so). `adj` names a person ("Black
// Women"), `noun` the group as a whole ("Black Population").
const RACES = {
  'one race': { key: 'one-race', label: 'One race', adj: 'One-Race' },
  white: { key: 'white', label: 'White', adj: 'White' },
  'black or african american': { key: 'black', label: 'Black', adj: 'Black' },
  black: { key: 'black', label: 'Black', adj: 'Black' },
  'american indian and alaska native': { key: 'american-indian', label: 'American Indian and Alaska Native', adj: 'Native American' },
  aian: { key: 'american-indian', label: 'American Indian and Alaska Native', adj: 'Native American' },
  asian: { key: 'asian', label: 'Asian', adj: 'Asian' },
  'native hawaiian and other pacific islander': { key: 'pacific-islander', label: 'Native Hawaiian and Pacific Islander', adj: 'Pacific Islander' },
  nhpi: { key: 'pacific-islander', label: 'Native Hawaiian and Pacific Islander', adj: 'Pacific Islander' },
  'two or more races': { key: 'two-or-more', label: 'Two or more races', adj: 'Multiracial' },
};
const ORIGINS = { hispanic: 'hispanic', 'not hispanic': 'not-hispanic', 'hispanic or latino': 'hispanic' };

const clean = label => text(label).replace(/:?\d*$/, '').replace(/:$/, '').toLowerCase();

/**
 * A row's labels from its path ("MALE / NOT HISPANIC / Race Alone or in Combination: / White"): sex, Hispanic origin,
 * race and whether alone or in combination, age, or the median age. `{}` for the total; null for a row not read.
 */
export function rowLabels(rowPath) {
  const out = {};
  for (const [i, part] of rowPath.entries()) {
    const p = clean(part);
    const last = i === rowPath.length - 1;
    if (p in SEXES) { if (SEXES[p]) out.sex = SEXES[p]; continue; }
    if (p in ORIGINS) { out.hispanic_origin = ORIGINS[p]; continue; }
    if (p === 'race alone or in combination') { out.race_scope = 'in-combination'; continue; }
    if (p === 'one race' && !last) { out.race_scope = 'alone'; continue; }
    if (p === 'non-hispanic white') { out.race = 'white'; out.hispanic_origin = 'not-hispanic'; continue; }
    if (p in RACES) { out.race = RACES[p].key; continue; }
    if (p === 'median age (years)') { out.median = true; continue; }
    const age = ageOf(text(part));
    if (age) { out.age = age.key; continue; }
    return null;
  }
  // A race not said to be "in combination" is one race alone.
  if (out.race && out.race !== 'one-race' && out.race !== 'two-or-more' && !out.race_scope) out.race_scope = 'alone';
  if (out.race === 'one-race' || out.race === 'two-or-more') delete out.race_scope;
  return out;
}

/** A column's date and sex from its heading path: a July 1 estimate or projection; April 1 bases and counts are left out. */
function estimateColumn(headings) {
  if (headings.some(h => /^April 1\b/i.test(h))) return null;
  const year = [...headings].reverse().map(h => /\b((?:19|20)\d{2})/.exec(h)?.[1]).find(Boolean);
  if (!year) return null;
  const sex = headings.map(h => clean(h)).find(h => h in SEXES);
  return { date: `${year}-07-01`, sex: sex ? SEXES[sex] : undefined };
}

// ---------------------------------------------------------------------------
// Measures.

const NATIONAL = 'population/national-estimates-and-projections';
const BY_GROUP = 'population/estimates-and-projections-by-age-sex-race-ethnicity';
const PROJECTED_TOTAL = `${NATIONAL}/projected-population`;
const PROJECTED = `${BY_GROUP}/projected-population`;
const PROJECTED_MEDIAN_AGE = `${BY_GROUP}/projected-median-age`;
const ESTIMATED = `${BY_GROUP}/resident-population`;
const ESTIMATED_MEDIAN_AGE = `${BY_GROUP}/median-age`;
const GROUPS = ['sex', 'age', 'race', 'race_scope', 'hispanic_origin'];

export const CENSUS_TABLE_MEASURES = {
  [PROJECTED_TOTAL]: { label: 'Projected population', dims: [] },
  [PROJECTED]: { label: 'Projected population', dims: GROUPS },
  [PROJECTED_MEDIAN_AGE]: { label: 'Projected median age', dims: ['sex'] },
  [ESTIMATED]: { label: 'Resident population', dims: GROUPS },
  [ESTIMATED_MEDIAN_AGE]: { label: 'Median age', dims: GROUPS.filter(d => d !== 'age') },
};

/** The breakdowns these tables add or add values to: ages, races, alone or in combination, Hispanic origin ({ id: { label, values } }). */
export function censusTableDimensions() {
  const race = {};
  for (const r of Object.values(RACES)) race[r.key] = r.label;
  const AGES = ['Under 5 years', 'Under 18 years', ...Array.from({ length: 20 }, (_, i) => `${i * 5} to ${i * 5 + 4} years`), '14 to 17 years', '18 to 24 years',
    '25 to 44 years', '45 to 64 years', '18 to 64 years', '15 to 44 years', '5 to 13 years', '65 years and over', '85 years and over', '100 years and over',
    '16 years and over', '18 years and over'];
  const age = Object.fromEntries(AGES.map(ageOf).map(a => [a.key, a.label]));
  return {
    age: { label: 'Age', values: age }, race: { label: 'Race and ethnicity', values: race },
    race_scope: { label: 'Race counted', values: { alone: 'One race alone', 'in-combination': 'Alone or in combination with other races' } },
    hispanic_origin: { label: 'Hispanic origin', values: { hispanic: 'Hispanic (of any race)', 'not-hispanic': 'Not Hispanic' } },
  };
}

// ---------------------------------------------------------------------------
// Names and descriptions, from the labels.

const raceRecord = key => Object.values(RACES).find(r => r.key === key);

/** "Black", "Non-Hispanic Black", "Hispanic" before "Female Population"; `scope` follows the name. */
function groupWords({ race, race_scope, hispanic_origin }) {
  const origin = hispanic_origin === 'hispanic' ? 'Hispanic' : hispanic_origin === 'not-hispanic' ? 'Non-Hispanic' : '';
  return { words: [origin, race ? raceRecord(race).adj : ''].filter(Boolean).join(' '), scope: race_scope === 'in-combination' ? ' (Alone or in Combination)' : '' };
}

/**
 * "Projected Black Female Population Aged 5 to 9", "Population Aged 85 and Over", "Median Age of the Asian Male
 * Population". Census counts males and females of every age, so the names say Male and Female, not men and women.
 */
function nameOf(prefix, labels) {
  const { words, scope } = groupWords(labels);
  const who = [words, SEX_ADJECTIVES[labels.sex]].filter(Boolean).join(' ');
  const age = labels.age ? ` ${ageOf(AGE_LABELS[labels.age]).words}` : '';
  if (labels.median) return `${prefix}Median Age${who ? ` of the ${who} Population` : ''}${scope}`;
  return `${prefix}${who ? `${who} ` : ''}Population${age}${scope}`;
}
const SEX_ADJECTIVES = { men: 'Male', women: 'Female' };
const AGE_LABELS = {};

/** What a series counts, for its description: "the number of Black (one race alone) females aged 5 to 9". */
function whatOf(labels) {
  const race = labels.race ? `${raceRecord(labels.race).label}${labels.race_scope === 'in-combination' ? ' (alone or in combination with other races)' : labels.race_scope === 'alone' ? ' (one race alone)' : ''}` : '';
  const origin = labels.hispanic_origin === 'hispanic' ? 'Hispanic' : labels.hispanic_origin === 'not-hispanic' ? 'non-Hispanic' : '';
  const who = [origin, race, { men: 'males', women: 'females' }[labels.sex] ?? 'people'].filter(Boolean).join(' ');
  const age = labels.age ? ` ${ageOf(AGE_LABELS[labels.age]).words.toLowerCase()}` : '';
  return labels.median ? `the median age of ${who}` : `the number of ${who}${age}`;
}

const slugOf = (prefix, labels) => [prefix, labels.sex, labels.hispanic_origin, labels.race, labels.race_scope === 'in-combination' ? 'in-combination' : null, labels.age]
  .filter(Boolean).join('--');

// ---------------------------------------------------------------------------
// The tables. Each says how its columns are read (`column(headings)` → { date, sex }), and which of its rows are
// taken (`take(labels)`); `vintage` orders tables printing the same series (newest wins year by year).

const ESTIMATES_2000 = 'Census Bureau, Intercensal Estimates of the Resident Population, April 1, 2000 to July 1, 2010';
const ESTIMATES_2010 = 'Census Bureau, Intercensal Estimates of the Resident Population, April 1, 2010 to April 1, 2020 (released 2024)';
const ESTIMATES_2020 = 'Census Bureau, Vintage 2025 population estimates (released June 2026)';
const PROJECTIONS = 'Census Bureau, 2023 National Population Projections, main series (released November 2023); 2022 is the estimate the projections start from';

// The race-alone tables of 2000–2010, one per race (and Hispanic, and White alone not Hispanic).
const EST00_RACES = { wa: { race: 'white' }, ba: { race: 'black' }, ia: { race: 'american-indian' }, aa: { race: 'asian' }, na: { race: 'pacific-islander' },
  tom: { race: 'two-or-more' }, hisp: { hispanic_origin: 'hispanic' }, wanh: { race: 'white', hispanic_origin: 'not-hispanic' } };
const ASR6H_SHEETS = { Total: {}, White: { race: 'white' }, Black: { race: 'black' }, AIAN: { race: 'american-indian' }, Asian: { race: 'asian' },
  NHPI: { race: 'pacific-islander' }, 'Two or More Races': { race: 'two-or-more' } };

const estimates = (labels, prefix = 'estimated') => (labels.median
  ? { measure: ESTIMATED_MEDIAN_AGE, prefix: `${prefix}-median-age`, unit: 'years' }
  : { measure: ESTIMATED, prefix: `${prefix}-population`, unit: 'people' });

export const TABLES = [
  // Projections (Abstract tables 3, 9, 12).
  {
    id: 'np2023-t1', abstract: [3], url: `${POPPROJ}np2023-t1.xlsx`, layout: 'columns', vintage: 2023, source: PROJECTIONS,
    title: 'Projected Population and Components of Change for the United States, Main Series: 2022-2100 (NP2023-T1)',
    columns: {
      Population: { slug: 'projected-population', name: 'Projected Population', unit: 'thousands', labels: { measure: PROJECTED_TOTAL, form: 'level' }, what: 'the projected resident population, in thousands' },
      'Percent change since prior year': { slug: 'projected-population-change', name: 'Projected Population Growth', unit: '%', labels: { measure: PROJECTED_TOTAL, form: 'growth-rate' }, what: 'the projected percent change in resident population since the year before' },
    },
  },
  ...[['np2023-t3', [9], 'Projected Population by Five-Year Age Group and Sex for the United States, Main Series: 2022-2100 (NP2023-T3)'],
    ['np2023-t2', [9], 'Projected Population by Age Group and Sex for the United States, Main Series: 2022-2100 (NP2023-T2)'],
    ['np2023-t4', [12], 'Projected Population by Sex, Race, and Hispanic Origin for the United States, Main Series: 2022-2060 (NP2023-T4)']].map(([id, abstract, title]) => ({
    id, abstract, url: `${POPPROJ}${id}.xlsx`, layout: 'grid', vintage: 2023, source: PROJECTIONS, title, thousands: true,
    column: headings => (isYear(headings.at(-1)) ? { date: `${headings.at(-1)}-07-01` } : null),
    // The total is Table 1's.
    take: labels => (Object.keys(labels).length ? (labels.median
      ? { measure: PROJECTED_MEDIAN_AGE, prefix: 'projected-median-age', unit: 'years', name: 'Projected ' }
      : { measure: PROJECTED, prefix: 'projected-population', unit: 'thousands', name: 'Projected ' }) : null),
  })),

  // Estimates by sex and age, with median age (Abstract tables 7, 8): three decades.
  ...[['nc-est2025-agesex', `${POPEST}2020-2025/national/asrh/nc-est2025-agesex.xlsx`, 2025, ESTIMATES_2020],
    ['nc-est2020int-agesex', `${POPEST}2010-2020/intercensal/national/asrh/nc-est2020int-agesex.xlsx`, 2020, ESTIMATES_2010],
    ['us-est00int-01', `${POPEST}2000-2010/intercensal/national/us-est00int-01.xls`, 2010, ESTIMATES_2000]].map(([id, url, vintage, source]) => ({
    id, abstract: [7, 8], url, layout: 'grid', vintage, source, column: estimateColumn,
    take: labels => (Object.keys(labels).length ? estimates(labels) : null),
  })),
  // By sex, race and Hispanic origin (Abstract table 6).
  ...[['nc-est2025-sr11h', `${POPEST}2020-2025/national/asrh/nc-est2025-sr11h.xlsx`, 2025, ESTIMATES_2020],
    ['nc-est2020int-sr11h', `${POPEST}2010-2020/intercensal/national/asrh/nc-est2020int-sr11h.xlsx`, 2020, ESTIMATES_2010],
    ['us-est00int-02', `${POPEST}2000-2010/intercensal/national/us-est00int-02.xls`, 2010, ESTIMATES_2000]].map(([id, url, vintage, source]) => ({
    id, abstract: [6], url, layout: 'grid', vintage, source, column: estimateColumn,
    take: labels => (Object.keys(labels).length ? estimates(labels) : null),
  })),
  // By race alone, Hispanic origin and age, both sexes (Abstract table 10): one sheet per race.
  ...[['nc-est2025-asr6h', `${POPEST}2020-2025/national/asrh/nc-est2025-asr6h.xlsx`, 2025, ESTIMATES_2020],
    ['nc-est2020int-asr6h', `${POPEST}2010-2020/intercensal/national/asrh/nc-est2020int-asr6h.xlsx`, 2020, ESTIMATES_2010]].flatMap(([id, url, vintage, source]) =>
    Object.entries(ASR6H_SHEETS).map(([sheet, fixed]) => ({
      id: `${id}:${sheet}`, abstract: [10], url, sheet, layout: 'grid', vintage, source, column: estimateColumn, fixed,
      take: labels => (labels.sex || !(labels.age || labels.median) ? null : estimates(labels)),
    }))),
  ...Object.entries(EST00_RACES).map(([code, fixed]) => ({
    id: `us-est00int-03-${code}`, abstract: [10], url: `${POPEST}2000-2010/intercensal/national/us-est00int-03-${code}.xls`, layout: 'grid', vintage: 2010,
    source: ESTIMATES_2000, column: estimateColumn, fixed,
    take: labels => (labels.sex || !(labels.age || labels.median) ? null : estimates(labels)),
  })),
];
// Each age key's printed words, for names ("5-9" → "5 to 9 years").
for (const label of ['Under 5 years', 'Under 18 years', ...Array.from({ length: 20 }, (_, i) => `${i * 5} to ${i * 5 + 4} years`), '14 to 17 years', '18 to 24 years',
  '25 to 44 years', '45 to 64 years', '18 to 64 years', '15 to 44 years', '5 to 13 years', '65 years and over', '85 years and over', '100 years and over',
  '16 years and over', '18 years and over']) AGE_LABELS[ageOf(label).key] = label;

/**
 * The series of every table (for build-census-tables.js), given `rowsOf(url, sheet)`: [{ slug, source: 'census-tables',
 * url, parts: [{ table, row, sex }], labels, name, unit, frequency, description }]. A part is one table's row (and,
 * where sexes are columns, its sex); `row` is the row's path, or a column's heading for a table down the years.
 */
export function buildCensusTableSeries(rowsOf) {
  const bySlug = new Map();
  const add = (slug, t, part, make, dates) => {
    if (!bySlug.has(slug)) bySlug.set(slug, { ...make(), slug, parts: [], years: new Map() });
    const s = bySlug.get(slug);
    // Within a vintage the first table printing a series is read; a later one of the same vintage repeats it.
    if (s.parts.some(p => TABLES.find(x => x.id === p.table).vintage === t.vintage && p.table.split(':')[0] !== t.id.split(':')[0])) return;
    s.parts.push(part);
    for (const d of dates) if (!s.years.has(d) || TABLES.find(x => x.id === s.years.get(d)).vintage < t.vintage) s.years.set(d, t.id);
  };
  for (const t of TABLES) {
    const rows = rowsOf(t.url, t.sheet);
    // The title as printed: the first line that is not the note for screen readers.
    t.title ??= text(rows.find(r => text(r?.[0]) && !/^table with row headers/i.test(text(r[0])))?.[0]).replace(/^Table \d+\. /, '');
    if (t.layout === 'columns') {
      const cols = readCensusColumns(rows);
      for (const [column, c] of Object.entries(t.columns)) {
        if (!cols.has(column)) throw new Error(`${t.id}: no column "${column}"`);
        add(c.slug, t, { table: t.id, row: column }, () => ({
          labels: c.labels, name: c.name, unit: c.unit, description: `${c.what[0].toUpperCase()}${c.what.slice(1)}.` }), cols.get(column).map(([y]) => `${y}-07-01`));
      }
      continue;
    }
    const { columns, rows: grid } = readCensusGrid(rows);
    for (const r of grid) {
      const own = rowLabels(r.path);
      if (!own) throw new Error(`${t.id}: no reading for the row "${r.path.join(' / ')}"`);
      // Where sexes are columns, each sex is its own series.
      const bySex = new Map();
      for (const [j, value] of r.values) {
        const c = t.column(columns[j]);
        if (!c) continue;
        const key = c.sex ?? null;
        if (!bySex.has(key)) bySex.set(key, []);
        bySex.get(key).push([c.date, value]);
      }
      for (const [sex, values] of bySex) {
        const labels = { ...own, ...(t.fixed ?? {}), ...(sex ? { sex } : {}) };
        if (labels.race && !labels.race_scope && labels.race !== 'two-or-more' && labels.race !== 'one-race') labels.race_scope = 'alone';
        const kind = t.take(labels);
        if (!kind) continue;
        const { median, ...dims } = labels;
        const slug = slugOf(kind.prefix, labels);
        add(slug, t, { table: t.id, row: r.path.join(' / '), ...(sex !== null ? { sex } : {}) }, () => {
          const name = nameOf(kind.name ?? '', labels);
          if (name.length > MAX_NAME) throw new Error(`census-tables: ${slug} name "${name}" is over ${MAX_NAME} characters`);
          const what = whatOf(labels) + (kind.unit === 'thousands' ? ', in thousands' : '');
          return { labels: { measure: kind.measure, form: 'level', ...dims }, name, unit: kind.unit, description: `${what[0].toUpperCase()}${what.slice(1)}, on July 1.` };
        }, values.map(([d]) => d));
      }
    }
  }
  return [...bySlug.values()].map(({ years, parts, description, ...s }) => {
    // Which table gives which years, in order: "2000–2009 us-est00int-01; 2010–2019 nc-est2020int-agesex; …".
    const spans = [];
    for (const [date, id] of [...years].sort(([a], [b]) => a.localeCompare(b))) {
      const y = date.slice(0, 4);
      if (spans.at(-1)?.id === id) spans.at(-1).to = y;
      else spans.push({ id, from: y, to: y });
    }
    const tables = [...new Set(spans.map(sp => sp.id))].map(id => TABLES.find(t => t.id === id));
    const from = spans.length > 1 ? ` Years from each table: ${spans.map(sp => `${sp.from}${sp.to !== sp.from ? `–${sp.to}` : ''} ${sp.id.split(':')[0]}`).join('; ')}.` : '';
    for (const p of parts) p.title = TABLES.find(t => t.id === p.table).title;
    return {
      ...s, source: 'census-tables', source_id: parts.map(p => `${p.table}: ${p.row}${p.sex ? ` (${p.sex})` : ''}`).join('; '),
      url: tables.at(-1).url, frequency: 'annual', category: 'population', parts,
      abstract: [...new Set(tables.flatMap(t => t.abstract))],
      description: `${description} ${[...new Set(tables.map(t => t.source))].join('; ')}: ${[...new Set(tables.map(t => `“${t.title}”`))].join(', ')}.${from}`,
    };
  });
}

/** One series' observations from its tables (`rowsOf(url, sheet)`), each date from the newest table printing it. */
export function readCensusTable(s, rowsOf) {
  const byDate = new Map();
  for (const part of s.parts) {
    const t = TABLES.find(x => x.id === part.table);
    if (!t) throw new Error(`${s.slug}: no table ${part.table}`);
    const rows = rowsOf(t.url, t.sheet);
    let values;
    if (t.layout === 'columns') values = readCensusColumns(rows).get(part.row)?.map(([y, v]) => [`${y}-07-01`, v]);
    else {
      const { columns, rows: grid } = readCensusGrid(rows);
      const r = grid.find(x => x.path.join(' / ') === part.row);
      values = r && [...r.values].flatMap(([j, v]) => {
        const c = t.column(columns[j]);
        return c && (c.sex ?? undefined) === part.sex ? [[c.date, v]] : [];
      });
    }
    if (!values?.length) throw new Error(`${s.slug}: nothing at "${part.row}" in ${t.id}`);
    for (const [date, v] of values) if (!byDate.has(date) || byDate.get(date).vintage < t.vintage) byDate.set(date, { v, vintage: t.vintage });
  }
  const observations = [...byDate].sort(([a], [b]) => a.localeCompare(b)).map(([date, { v }]) => [date, String(v)]);
  return { description: s.description, observations, skipped: 0 };
}

/** The table titles a series is read from, for its publisher's title. */
export const censusTableTitle = s => s.parts.map(p => `${p.title}: ${p.row}${p.sex ? ` (${p.sex === 'men' ? 'Male' : 'Female'})` : ''}`).join('; ');
