// Census Bureau tables collected for the Statistical Abstract's Section 1, Population (Phase 5c), read from the
// publisher's own printed tables in the data folder, never added up from its detailed files.
//
// Census prints most of its summary tables in one layout: a title block, a heading row of years (or, for a table
// down the years, of columns), then rows whose label's leading dots give its depth under the block above it
// ("Male", ".Under 5 years", "..Non-Hispanic White"), then notes. `readCensusGrid` reads that layout; each table
// below says which rows it takes and what they are. Values are stored as printed (thousands stay thousands).
//
// A row printed in two tables (the projections' male total is in Tables 2, 3 and 4) is taken from the first.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MAX_NAME } from './series-names.js';

// The series list, written by server/seed/build-census-tables.js from the tables on disk (the grid tables' rows are
// their series, so the list is read from the files once, not each time the module loads).
export const CENSUS_TABLES_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'seed', 'data', 'census-tables.json');
let cache = null;
/** Every series of these tables, from census-tables.json ([] before it is built). */
export const censusSeries = () => (cache ??= fs.existsSync(CENSUS_TABLES_FILE) ? JSON.parse(fs.readFileSync(CENSUS_TABLES_FILE, 'utf8')).series : []);

const POPPROJ = 'https://www2.census.gov/programs-surveys/popproj/tables/2023/2023-summary-tables/';

const isYear = c => /^\d{4}$/.test(String(c ?? '').trim());
const text = c => String(c ?? '').replace(/\s+/g, ' ').trim();

/**
 * A printed table with the years across → [{ path, label, depth, values: [[year, value]] }] in printed order. `path`
 * is the labels from the block down ("Male / White / Non-Hispanic White"). Rows with no values (blank, a heading
 * such as "Special Age Categories") are left out; the notes end the table.
 */
export function readCensusGrid(rows) {
  const head = rows.findIndex(r => (r ?? []).slice(1).filter(isYear).length >= 2);
  if (head < 0) throw new Error('no heading row of years');
  const years = rows[head].map((c, i) => (i > 0 && isYear(c) ? Number(text(c)) : null));
  const out = [];
  const stack = [];
  for (const r of rows.slice(head + 1)) {
    const raw = text(r?.[0]);
    if (!raw) continue;
    if (/^(Notes?|Source|Suggested Citation|Release Date)\b/i.test(raw)) break;
    const depth = /^\.*/.exec(raw)[0].length;
    const label = raw.replace(/^\.+/, '').trim();
    stack.length = depth;
    stack[depth] = label;
    const values = years.flatMap((y, i) => (y && r[i] != null && text(r[i]) !== '' && Number.isFinite(Number(r[i])) ? [[y, Number(r[i])]] : []));
    if (values.length) out.push({ path: stack.filter(Boolean).join(' / '), label, depth, values });
  }
  return out;
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
      if (i === 0 || r[i] == null || text(r[i]) === '' || !Number.isFinite(Number(r[i]))) return;
      out.get(h).push([Number(text(r[0])), Number(r[i])]);
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// What a row says: sex from its block, age or race from its own label.

const SEXES = { Total: null, Male: 'men', Female: 'women' };
const SEX_WORDS = { men: 'Men', women: 'Women' };

/** "Under 5 years", "5 to 9 years", "100 years and over" → { key, label, words } (words follow the noun). */
export function ageOf(label) {
  let m = /^Under (\d+) years$/.exec(label);
  if (m) return { key: `under-${m[1]}`, label: `Under ${m[1]}`, words: `Under ${m[1]}` };
  m = /^(\d+) to (\d+) years$/.exec(label);
  if (m) return { key: `${m[1]}-${m[2]}`, label: `${m[1]}–${m[2]}`, words: `Aged ${m[1]} to ${m[2]}` };
  m = /^(\d+) years and over$/.exec(label);
  if (m) return { key: `${m[1]}-over`, label: `${m[1]} and over`, words: `Aged ${m[1]} and Over` };
  return null;
}

// Census's race and Hispanic-origin rows (races are one race alone, as the projections count them). `adj` goes
// before the sex ("Black Women"); `alone` is the name without a sex ("Black Population").
const RACES = {
  'One race': { key: 'one-race', label: 'One race', adj: 'One-Race', alone: 'One-Race' },
  White: { key: 'white', label: 'White', adj: 'White', alone: 'White' },
  'Non-Hispanic White': { key: 'white-non-hispanic', label: 'White, not Hispanic', adj: 'Non-Hispanic White', alone: 'Non-Hispanic White' },
  'Black or African American': { key: 'black', label: 'Black', adj: 'Black', alone: 'Black' },
  'American Indian and Alaska Native': { key: 'american-indian', label: 'American Indian and Alaska Native', adj: 'American Indian and Alaska Native', alone: 'American Indian and Alaska Native' },
  Asian: { key: 'asian', label: 'Asian', adj: 'Asian', alone: 'Asian' },
  'Native Hawaiian and Other Pacific Islander': { key: 'pacific-islander', label: 'Native Hawaiian and Pacific Islander', adj: 'Pacific Islander', alone: 'Native Hawaiian and Pacific Islander' },
  'Two or More Races': { key: 'two-or-more', label: 'Two or more races', adj: 'Multiracial', alone: 'Multiracial' },
  'Hispanic or Latino': { key: 'hispanic', label: 'Hispanic', adj: 'Hispanic', alone: 'Hispanic' },
};

// ---------------------------------------------------------------------------
// The tables.

const PROJECTED_TOTAL = 'population/national-estimates-and-projections/projected-population';
const PROJECTED = 'population/estimates-and-projections-by-age-sex-race-ethnicity/projected-population';
const PROJECTED_MEDIAN_AGE = 'population/estimates-and-projections-by-age-sex-race-ethnicity/projected-median-age';

export const CENSUS_TABLE_MEASURES = {
  [PROJECTED_TOTAL]: { label: 'Projected population', dims: [] },
  [PROJECTED]: { label: 'Projected population', dims: ['sex', 'age', 'race'] },
  [PROJECTED_MEDIAN_AGE]: { label: 'Projected median age', dims: ['sex'] },
};

const PROJECTIONS_NOTE = 'Census Bureau, 2023 National Population Projections, main series (released November 2023): resident population on July 1; 2022 is the estimate the projections start from.';

/**
 * Each publisher table: its file, how it is read, and `series(row)` → the series a row gives, or null to leave it
 * out. Every series gets `labels` (its dimensions), `name`, `unit` and `what` (the row as the description says it).
 */
const TABLES = [
  {
    id: 'np2023-t1', abstract: [3], url: `${POPPROJ}np2023-t1.xlsx`, layout: 'columns',
    title: 'Projected Population and Components of Change, Main Series: 2022-2100 (Table 1)',
    columns: {
      Population: { slug: 'projected-population', name: 'Projected Population', unit: 'thousands', labels: { measure: PROJECTED_TOTAL, form: 'level' }, what: 'the projected resident population, in thousands' },
      'Percent change since prior year': { slug: 'projected-population-change', name: 'Projected Population Growth', unit: '%', labels: { measure: PROJECTED_TOTAL, form: 'growth-rate' }, what: 'the projected percent change in resident population since the year before' },
    },
  },
  // Five-year age groups and median age by sex, then the wider groups of Table 2 not printed in Table 3, then race
  // and Hispanic origin by sex (Table 4, 2022–2060). The totals are Table 1's.
  ...['np2023-t3', 'np2023-t2', 'np2023-t4'].map(id => ({
    id, abstract: id === 'np2023-t4' ? [12] : [9], url: `${POPPROJ}${id}.xlsx`, layout: 'grid',
    title: {
      'np2023-t3': 'Projected Population by Five-Year Age Group and Sex, Main Series: 2022-2100 (Table 3)',
      'np2023-t2': 'Projected Population by Age Group and Sex, Main Series: 2022-2100 (Table 2)',
      'np2023-t4': 'Projected Population by Sex, Race, and Hispanic Origin, Main Series: 2022-2060 (Table 4)',
    }[id],
    series: row => projectionRow(row),
  })),
];

function projectionRow({ path, label, depth }) {
  const block = path.split(' / ')[0];
  if (!(block in SEXES)) return null;
  const sex = SEXES[block];
  const sexWords = SEX_WORDS[sex];
  if (depth === 0) {
    if (!sex) return null; // the total is Table 1's
    return { labels: { measure: PROJECTED, form: 'level', sex }, name: `Projected Population of ${sexWords}`, unit: 'thousands', what: `the projected number of ${sexWords.toLowerCase()}, in thousands` };
  }
  if (label === 'Median age (years)') {
    return { labels: { measure: PROJECTED_MEDIAN_AGE, form: 'level', ...(sex ? { sex } : {}) }, name: `Projected Median Age${sex ? ` of ${sexWords}` : ''}`, unit: 'years', what: `the projected median age${sex ? ` of ${sexWords.toLowerCase()}` : ''}` };
  }
  const age = ageOf(label);
  if (age) {
    return {
      labels: { measure: PROJECTED, form: 'level', ...(sex ? { sex } : {}), age: age.key }, age,
      name: `Projected Population of ${sexWords ?? 'People'} ${age.words}`, unit: 'thousands',
      what: `the projected number of ${(sexWords ?? 'people').toLowerCase()} ${age.words.toLowerCase()}, in thousands`,
    };
  }
  const race = RACES[label];
  if (race) {
    return {
      labels: { measure: PROJECTED, form: 'level', ...(sex ? { sex } : {}), race: race.key }, race,
      name: sex ? `Projected Population of ${race.adj} ${sexWords}` : `Projected ${race.alone} Population`, unit: 'thousands',
      what: `the projected ${race.key === 'hispanic' ? 'Hispanic or Latino (any race)' : `${race.label} (one race alone${race.key === 'white-non-hispanic' ? '' : ', of any Hispanic origin'})`} population${sex ? `, ${sexWords.toLowerCase()}` : ''}, in thousands`,
    };
  }
  throw new Error(`census-tables: no reading for the row "${path}"`);
}

const slugOf = labels => ['measure', 'form', 'sex', 'race', 'age'].filter(d => labels[d]).map(d => (d === 'measure' ? labels[d].split('/').pop() : d === 'form' ? (labels[d] === 'level' ? '' : labels[d]) : labels[d])).filter(Boolean).join('--');

/** The breakdown values these tables add (ages, races, the form "median"). */
export function censusTableDimensions() {
  const age = {};
  const race = {};
  for (const r of Object.values(RACES)) race[r.key] = r.label;
  // Ages are read from the files' labels, so they are listed from the words Census prints.
  const AGES = ['Under 5 years', 'Under 18 years', ...Array.from({ length: 20 }, (_, i) => `${i * 5} to ${i * 5 + 4} years`), '14 to 17 years', '18 to 24 years',
    '25 to 44 years', '45 to 64 years', '18 to 64 years', '15 to 44 years', '5 to 13 years', '65 years and over', '85 years and over', '100 years and over',
    '16 years and over', '18 years and over'];
  for (const a of AGES.map(ageOf).filter(Boolean)) age[a.key] = a.label;
  return { age, race };
}

/**
 * The series of every table (for build-census-tables.js), given a function that reads a table's rows by URL: [{ slug, source: 'census-tables',
 * url, table, key, labels, name, unit, frequency, description }]; `key` is the row's path or the column's heading.
 */
export function buildCensusTableSeries(rowsOf) {
  const out = [];
  const seen = new Set();
  for (const t of TABLES) {
    const add = (s, key) => {
      const slug = s.slug ?? slugOf(s.labels);
      if (seen.has(slug)) return;
      seen.add(slug);
      if (s.name.length > MAX_NAME) throw new Error(`census-tables: ${slug} name "${s.name}" is over ${MAX_NAME} characters`);
      out.push({
        slug, source: 'census-tables', source_id: `${t.id}: ${key}`, url: t.url, table: t.id, key, frequency: 'annual',
        labels: s.labels, name: s.name, unit: s.unit, category: 'population', abstract: t.abstract,
        description: `${s.what[0].toUpperCase()}${s.what.slice(1)}, as printed in “${t.title}”. ${PROJECTIONS_NOTE}`,
      });
    };
    if (t.layout === 'columns') for (const [column, s] of Object.entries(t.columns)) add(s, column);
    else for (const row of readCensusGrid(rowsOf(t.url))) {
      const s = t.series(row);
      if (s) add(s, row.path);
    }
  }
  return out;
}

/** One series' observations from its table's rows, dated July 1. */
export function readCensusTable(s, rows) {
  const t = TABLES.find(x => x.id === s.table);
  const values = t.layout === 'columns' ? readCensusColumns(rows).get(s.key) : readCensusGrid(rows).find(r => r.path === s.key)?.values;
  if (!values) throw new Error(`${s.slug}: no ${t.layout === 'columns' ? 'column' : 'row'} "${s.key}" in ${t.id}`);
  return { description: s.description, observations: values.map(([y, v]) => [`${y}-07-01`, String(v)]), skipped: 0 };
}
