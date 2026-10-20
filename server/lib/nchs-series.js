// NCHS's vital statistics as published on data.cdc.gov, collected for the Statistical Abstract's Section 2 (Phase 5c):
// births, birth and fertility rates, births to unmarried women, deaths and death rates by cause, infant mortality and
// life expectancy, read from the tables in the data folder as printed. Each data.cdc.gov table is a tidy CSV (a year,
// some breakdowns, one or more value columns); `TABLES` says which column is which.
//
// These tables stop where NCHS stopped updating them (2013–2019); the later final years are in NCHS's reports (PDF)
// and CDC WONDER, not read. One series may be printed by two tables (the age-adjusted death rate from heart disease
// in "Age-adjusted Death Rates for Selected Major Causes of Death" and in "Leading Causes of Death"); each year is
// taken from the first table listed that prints it, and the description says which table gives which years. States
// are places of their national series (`measure`, `place`), as the demographic series are.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { nameProblems } from './series-names.js';
import { stateByName } from './population/places.js';

export const NCHS_SERIES_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'seed', 'data', 'nchs-series.json');
let cache = null;
/** Every series of these tables, from nchs-series.json ([] before it is built). */
export const nchsSeries = () => (cache ??= fs.existsSync(NCHS_SERIES_FILE) ? JSON.parse(fs.readFileSync(NCHS_SERIES_FILE, 'utf8')).series : []);

const VIEW = id => `https://data.cdc.gov/api/v3/views/${id}/export.csv`;
const BIRTHS = 'births-deaths-marriages-and-divorces/births';
const DEATHS = 'births-deaths-marriages-and-divorces/deaths';
const LIFE = 'births-deaths-marriages-and-divorces/life-expectancy';
const GROUPS = ['race', 'race_scope', 'hispanic_origin', 'hispanic_subgroup'];

export const NCHS_MEASURES = {
  [`${BIRTHS}/births`]: { label: 'Births', dims: [...GROUPS, 'age', 'marital_status'] },
  [`${BIRTHS}/birth-rates`]: { label: 'Birth rates', dims: [...GROUPS, 'age', 'marital_status'] },
  [`${BIRTHS}/fertility-rates`]: { label: 'Fertility rates', dims: GROUPS },
  [`${DEATHS}/deaths`]: { label: 'Deaths', dims: ['cause_of_death'] },
  [`${DEATHS}/age-adjusted-death-rates`]: { label: 'Age-adjusted death rates', dims: ['race', 'sex', 'cause_of_death'] },
  [`${DEATHS}/death-rates`]: { label: 'Death rates', dims: ['age'] },
  [`${DEATHS}/infant-mortality-rates`]: { label: 'Infant mortality rates', dims: ['race', 'infant_period'] },
  [`${LIFE}/life-expectancy`]: { label: 'Life expectancy', dims: ['race', 'sex'] },
};

// ---------------------------------------------------------------------------
// Breakdowns as NCHS labels them.

// Race of the mother (births) or of the person (deaths). NCHS's older figures use bridged race; "Non-Hispanic, Single
// Race …" (from 2016) is one race alone, which `race_scope: alone` marks.
const RACES = {
  'all races': {}, 'all origins': {}, white: { race: 'white' }, 'white total': { race: 'white' }, black: { race: 'black' }, 'black total': { race: 'black' },
  'american indian or alaska native': { race: 'american-indian' }, 'asian or pacific islander': { race: 'asian-pacific-islander' },
  'asian or pacific islander total': { race: 'asian-pacific-islander' },
  hispanic: { hispanic_origin: 'hispanic' }, 'hispanic total': { hispanic_origin: 'hispanic' },
  'non-hispanic white': { race: 'white', hispanic_origin: 'not-hispanic' }, 'non-hispanic black': { race: 'black', hispanic_origin: 'not-hispanic' },
  'non-hispanic, single race white': { race: 'white', race_scope: 'alone', hispanic_origin: 'not-hispanic' },
  'non-hispanic, single race black': { race: 'black', race_scope: 'alone', hispanic_origin: 'not-hispanic' },
  'non-hispanic, single race asian': { race: 'asian', race_scope: 'alone', hispanic_origin: 'not-hispanic' },
  'non-hispanic, single race american indian or alaska native': { race: 'american-indian', race_scope: 'alone', hispanic_origin: 'not-hispanic' },
  'non-hispanic, single race native hawaiian or pacific islander': { race: 'pacific-islander', race_scope: 'alone', hispanic_origin: 'not-hispanic' },
};
const raceOf = label => {
  const r = RACES[label.trim().toLowerCase()];
  if (!r) throw new Error(`nchs: no race for "${label}"`);
  return r;
};
const RACE_WORDS = { white: 'White', black: 'Black', 'american-indian': 'Native American', 'asian-pacific-islander': 'Asian or Pacific Islander',
  asian: 'Asian', 'pacific-islander': 'Pacific Islander' };
const RACE_TEXT = { white: 'White', black: 'Black', 'american-indian': 'American Indian or Alaska Native', 'asian-pacific-islander': 'Asian or Pacific Islander',
  asian: 'Asian', 'pacific-islander': 'Native Hawaiian or Other Pacific Islander' };
const SUBGROUPS = { mexican: ['Mexican', 'Mexican'], 'puerto rican': ['puerto-rican', 'Puerto Rican'], cuban: ['cuban', 'Cuban'],
  dominican: ['dominican', 'Dominican'], 'central and south american': ['central-south-american', 'Central and South American'],
  'other and unknown hispanic': ['other-hispanic', 'Other and Unknown Hispanic'] };
SUBGROUPS.mexican[0] = 'mexican';

/** "10-14 Years", "Less than 15 years", "40+ years", "15-44" → an age key as the census tables use them. */
function ageOf(label) {
  const l = label.trim().toLowerCase().replace(/ years?$/, '');
  let m = /^(\d+)-(\d+)$/.exec(l);
  if (m) return `${m[1]}-${m[2]}`;
  m = /^(\d+)\+$/.exec(l);
  if (m) return `${m[1]}-over`;
  m = /^less than (\d+)$/.exec(l);
  if (m) return `under-${m[1]}`;
  throw new Error(`nchs: no age for "${label}"`);
}
const ageWords = key => (key.startsWith('under-') ? `Under ${key.slice(6)}` : key.endsWith('-over') ? `Aged ${key.slice(0, -5)} and Over` : `Aged ${key.replace('-', ' to ')}`);
const ageLabel = key => (key.startsWith('under-') ? `Under ${key.slice(6)}` : key.endsWith('-over') ? `${key.slice(0, -5)} and over` : key.replace('-', '–'));

const CAUSES = {
  accidents: 'unintentional-injuries', 'unintentional injuries': 'unintentional-injuries', cancer: 'cancer', 'heart disease': 'heart-disease',
  'influenza and pneumonia': 'influenza-and-pneumonia', stroke: 'stroke', "alzheimer's disease": 'alzheimers-disease', clrd: 'chronic-lower-respiratory-diseases',
  diabetes: 'diabetes', 'kidney disease': 'kidney-disease', suicide: 'suicide', 'all causes': null,
};
const CAUSE_NAMES = { 'unintentional-injuries': 'Unintentional Injuries', cancer: 'Cancer', 'heart-disease': 'Heart Disease',
  'influenza-and-pneumonia': 'Influenza and Pneumonia', stroke: 'Stroke', 'alzheimers-disease': 'Alzheimer’s Disease',
  'chronic-lower-respiratory-diseases': 'Chronic Lung Disease', diabetes: 'Diabetes', 'kidney-disease': 'Kidney Disease', suicide: 'Suicide' };
const causeText = key => (key === 'chronic-lower-respiratory-diseases' ? 'chronic lower respiratory diseases (chronic lung disease)'
  : CAUSE_NAMES[key].toLowerCase().replace('alzheimer’s', 'Alzheimer’s'));
const causeOf = label => {
  const k = label.trim().toLowerCase();
  if (!(k in CAUSES)) throw new Error(`nchs: no cause for "${label}"`);
  return CAUSES[k] ? { cause_of_death: CAUSES[k] } : {};
};

/** NCHS's breakdowns ({ id: { label, values } }); races, ages and sexes join those already defined. */
export function nchsDimensions() {
  const ages = {};
  for (const s of nchsSeries()) if (s.labels?.age) ages[s.labels.age] = ageLabel(s.labels.age);
  return {
    race: { label: 'Race and ethnicity', values: { 'asian-pacific-islander': 'Asian and Pacific Islander', ...RACE_TEXT } },
    hispanic_subgroup: { label: 'Hispanic origin group', values: Object.fromEntries(Object.values(SUBGROUPS).map(([k, l]) => [k, l])) },
    age: { label: 'Age', values: ages },
    marital_status: { label: 'Marital status', values: { unmarried: 'Unmarried' } },
    cause_of_death: { label: 'Cause of death', values: { ...Object.fromEntries(Object.entries(CAUSE_NAMES).map(([k, n]) => [k, n[0] + n.slice(1).toLowerCase().replace('alzheimer’s', 'Alzheimer’s')])),
      'chronic-lower-respiratory-diseases': 'Chronic lower respiratory diseases (chronic lung disease)' } },
    infant_period: { label: 'Infant or neonatal', values: { neonatal: 'Neonatal (under 28 days)' } },
    sex: { label: 'Sex', values: { men: 'Men', women: 'Women' } },
  };
}

// ---------------------------------------------------------------------------
// What each kind of series is called. `who(l)` is the group in words ("Non-Hispanic Black", "Cuban").

function who(l) {
  if (l.hispanic_subgroup) return SUBGROUPS[Object.keys(SUBGROUPS).find(k => SUBGROUPS[k][0] === l.hispanic_subgroup)][1];
  const origin = l.hispanic_origin === 'hispanic' ? 'Hispanic' : l.hispanic_origin === 'not-hispanic' ? 'Non-Hispanic' : '';
  const race = l.race ? `${l.race_scope === 'alone' ? 'Single-Race ' : ''}${RACE_WORDS[l.race]}` : '';
  return [origin, race].filter(Boolean).join(' ');
}
function whoText(l) {
  if (l.hispanic_subgroup) return `${SUBGROUPS[Object.keys(SUBGROUPS).find(k => SUBGROUPS[k][0] === l.hispanic_subgroup)][1]} (Hispanic)`;
  const origin = l.hispanic_origin === 'hispanic' ? 'Hispanic' : l.hispanic_origin === 'not-hispanic' ? 'non-Hispanic' : '';
  const race = l.race ? `${RACE_TEXT[l.race]}${l.race_scope === 'alone' ? ' (one race alone)' : ' (bridged race)'}` : '';
  return [origin, race].filter(Boolean).join(' ');
}
const SEX = { men: ['Males', 'males'], women: ['Females', 'females'] };
const slugParts = l => [l.marital_status, l.hispanic_origin === 'hispanic' && !l.hispanic_subgroup ? 'hispanic' : l.hispanic_origin === 'not-hispanic' ? 'non-hispanic' : null,
  l.race, l.race_scope === 'alone' ? 'single-race' : null, l.hispanic_subgroup, l.sex, l.age && `age-${l.age}`, l.cause_of_death, l.infant_period];
const slugOf = (prefix, l) => [prefix, ...slugParts(l)].filter(Boolean).join('--');

const KINDS = {
  births: {
    measure: `${BIRTHS}/births`, unit: 'births', prefix: 'births',
    name: l => {
      const group = who(l);
      const mothers = `${l.marital_status ? 'Unmarried ' : ''}${group ? `${group} ` : ''}Mothers`;
      return group || l.marital_status || l.age ? `Births to ${mothers}${l.age ? ` ${ageWords(l.age)}` : ''}` : 'Births';
    },
    what: l => `the number of live births${l.marital_status || whoText(l) || l.age ? ` to ${l.marital_status ? 'unmarried ' : ''}${whoText(l) ? `${whoText(l)} ` : ''}mothers${l.age ? ` ${ageWords(l.age).toLowerCase()}` : ''}` : ''}`,
  },
  birthRate: {
    measure: `${BIRTHS}/birth-rates`, unit: 'per-1000', prefix: 'birth-rate',
    name: l => {
      const group = who(l);
      if (l.age || l.marital_status) return `Birth Rate for ${l.marital_status ? 'Unmarried ' : ''}${group ? `${group} ` : ''}Females ${ageWords(l.age)}`;
      return group ? `Birth Rate of the ${group} Population` : 'Birth Rate';
    },
    what: l => (l.age || l.marital_status
      ? `live births per 1,000 ${l.marital_status ? 'unmarried ' : ''}${whoText(l) ? `${whoText(l)} ` : ''}females ${ageWords(l.age).toLowerCase()}`
      : `live births per 1,000 ${whoText(l) ? `${whoText(l)} ` : ''}population (the crude birth rate)`),
  },
  fertility: {
    measure: `${BIRTHS}/fertility-rates`, unit: 'per-1000', prefix: 'fertility-rate',
    name: l => `General Fertility Rate${who(l) ? ` of ${who(l)} Women` : ''}`,
    what: l => `live births per 1,000 ${whoText(l) ? `${whoText(l)} ` : ''}women aged 15 to 44 (the general fertility rate)`,
  },
  deaths: {
    measure: `${DEATHS}/deaths`, unit: 'deaths', prefix: 'deaths',
    name: l => (l.cause_of_death ? `Deaths from ${CAUSE_NAMES[l.cause_of_death]}` : 'Deaths from All Causes'),
    what: l => `the number of deaths${l.cause_of_death ? ` with ${causeText(l.cause_of_death)} as the underlying cause` : ''}`,
  },
  ageAdjusted: {
    measure: `${DEATHS}/age-adjusted-death-rates`, unit: 'per-100k', prefix: 'age-adjusted-death-rate',
    name: l => {
      const group = [who(l), l.sex ? SEX[l.sex][0] : ''].filter(Boolean).join(' ');
      return `Age-Adjusted Death Rate${group ? ` of ${l.sex ? '' : 'the '}${group}${l.sex ? '' : ' Population'}` : ''}${l.cause_of_death ? ` from ${CAUSE_NAMES[l.cause_of_death]}` : ''}`;
    },
    what: l => `deaths${l.cause_of_death ? ` from ${causeText(l.cause_of_death)}` : ''} per 100,000 ${[whoText(l), l.sex ? SEX[l.sex][1] : 'population'].filter(Boolean).join(' ')}, age-adjusted to the 2000 standard population`,
  },
  deathRate: {
    measure: `${DEATHS}/death-rates`, unit: 'per-100k', prefix: 'death-rate',
    name: l => `Death Rate at Ages ${l.age.replace('-', ' to ')}`,
    what: l => `deaths per 100,000 children and young people ${ageWords(l.age).toLowerCase()}`,
  },
  infant: {
    measure: `${DEATHS}/infant-mortality-rates`, unit: 'per-1000-births', prefix: 'infant-mortality-rate',
    name: l => `${l.race ? `${RACE_WORDS[l.race]} ` : ''}${l.infant_period ? 'Neonatal' : 'Infant'} Mortality Rate`,
    what: l => `deaths of ${l.race ? `${RACE_TEXT[l.race]} ` : ''}infants ${l.infant_period ? 'under 28 days old' : 'under 1 year old'} per 1,000 live births`,
  },
  life: {
    measure: `${LIFE}/life-expectancy`, unit: 'life-years', prefix: 'life-expectancy',
    name: l => {
      const group = [l.race ? RACE_WORDS[l.race] : '', l.sex ? SEX[l.sex][0] : ''].filter(Boolean).join(' ');
      return `Life Expectancy at Birth${group ? ` of ${l.sex ? '' : 'the '}${group}${l.sex ? '' : ' Population'}` : ''}`;
    },
    what: l => `the average number of years a ${[l.race ? RACE_TEXT[l.race] : '', l.sex ? (l.sex === 'men' ? 'male' : 'female') : 'person'].filter(Boolean).join(' ')}${l.sex && !l.race ? '' : ''} born in the year would live at that year’s death rates`,
  },
};

// ---------------------------------------------------------------------------
// The tables, in the order they are read. `values` maps a value column to its kind; `rows(r)` gives the labels of a
// row (null to skip it); `state` names the column holding a state, whose rows become place series.

const both = label => (/^both sexes$/i.test(label) ? {} : /^male$/i.test(label) ? { sex: 'men' } : /^female$/i.test(label) ? { sex: 'women' } : null);

export const TABLES = [
  { id: 'e6fc-ccez', title: 'NCHS - Births and General Fertility Rates: United States', abstract: [78],
    values: { 'Birth Number': 'births', 'General Fertility Rate': 'fertility', 'Crude Birth Rate': 'birthRate' }, rows: () => ({}) },
  { id: '89yk-m38d', title: 'NCHS - Natality Measures for Females by Race and Hispanic Origin: United States', abstract: [79, 80],
    values: { 'Live Births': 'births', 'Birth Rate': 'birthRate', 'Fertility Rate': 'fertility' }, rows: r => raceOf(r.Race) },
  { id: 's54h-bixi', title: 'NCHS - Natality Measures for Females by Hispanic Origin Subgroup: United States', abstract: [79],
    values: { 'Live Births': 'births', 'Birth Rates': 'birthRate', 'Fertility Rates': 'fertility' },
    rows: r => ({ hispanic_origin: 'hispanic', hispanic_subgroup: SUBGROUPS[r['Hispanic Origin'].trim().toLowerCase()][0] }) },
  { id: 'yt7u-eiyg', title: 'NCHS - Birth Rates for Females by Age Group: United States', abstract: [80],
    values: { 'Birth Rate': 'birthRate' }, rows: r => ({ age: ageOf(r['Age Group']) }) },
  { id: 'e8kx-wbww', title: 'NCHS - Teen Birth Rates for Females by Age Group, Race, and Hispanic Origin: United States', abstract: [84],
    values: { 'Birth Rate': 'birthRate' }, rows: r => ({ ...raceOf(r['Race or Hispanic Origin']), age: ageOf(r['Age Group']) }) },
  { id: 'y268-sna3', title: 'NCHS - U.S. and State Trends on Teen Births', abstract: [84, 89], state: 'State',
    values: { 'State Rate': 'birthRate' }, rows: r => ({ age: ageOf(r['Age Group (Years)']) }) },
  { id: 'g6qk-ngsf', title: 'NCHS - Births to Unmarried Women by Age Group: United States', abstract: [85],
    values: { 'Number of Births': 'births' }, rows: r => ({ marital_status: 'unmarried', age: ageOf(r['Age Group']) }) },
  { id: '6tkz-y37d', title: 'NCHS - Birth Rates for Unmarried Women by Age, Race, and Hispanic Origin: United States', abstract: [85],
    values: { 'Birth Rate': 'birthRate' }, rows: r => ({ marital_status: 'unmarried', ...raceOf(r['Race or Hispanic Origin']), age: ageOf(r['Age Group']) }) },
  { id: 'jvf6-ix4w', title: 'NCHS - Nonmarital Birth Rates, by Age Group for All Women Age 15-44: United States, 1970-2013', abstract: [85],
    values: { 'Birth Rate': 'birthRate' }, rows: r => ({ marital_status: 'unmarried', ...raceOf(r.Race), age: ageOf(r.Age) }) },
  { id: 'w9j2-ggv5', title: 'NCHS - Death rates and life expectancy at birth', abstract: [104, 111],
    values: { 'Average Life Expectancy (Years)': 'life', 'Age-adjusted Death Rate': 'ageAdjusted' },
    rows: r => ({ ...raceOf(r.Race), ...both(r.Sex) }) },
  { id: '6rkc-nb2q', title: 'NCHS - Age-adjusted Death Rates for Selected Major Causes of Death', abstract: [117],
    values: { 'Age Adjusted Death Rate': 'ageAdjusted' }, rows: r => causeOf(r.Cause) },
  { id: 'bi63-dtpu', title: 'NCHS - Leading Causes of Death: United States', abstract: [113, 123], state: 'State',
    values: { Deaths: 'deaths', 'Age-adjusted Death Rate': 'ageAdjusted' }, rows: r => causeOf(r['Cause Name']) },
  { id: 'v6ab-adf5', title: 'NCHS - Childhood Mortality Rates', abstract: [110],
    values: { 'Death Rate': 'deathRate' }, rows: r => ({ age: ageOf(r['Age Group']) }) },
  { id: 'epev-k6ss', title: 'NCHS - Infant and neonatal mortality rates: United States, 1915-2013', abstract: [114, 115],
    values: { 'Mortality Rate': 'infant' }, rows: r => (/neonatal/i.test(r.Type) ? { infant_period: 'neonatal' } : {}) },
  { id: 'ddsk-zebd', title: 'NCHS - Infant Mortality Rates, by Race: United States, 1915-2013', abstract: [115],
    values: { 'Infant Mortality Rate': 'infant' }, rows: r => raceOf(r.Race) },
];

/** A published number ("3,791,712", "13.0"); null where nothing is printed. */
const number = cell => {
  const t = String(cell ?? '').replace(/,/g, '').trim();
  return /^-?\d+(\.\d+)?$/.test(t) ? t : null;
};

/** One table's cells: Map(slug → { kind, labels, place, values: Map(year → value) }). */
function tableCells(t, rows) {
  const cells = new Map();
  for (const r of rows) {
    const labels = t.rows(r);
    if (!labels) continue;
    let place = null;
    if (t.state) {
      const name = r[t.state].trim();
      if (!/^(United States|Total U.S.)$/.test(name)) {
        place = stateByName.get(name.toLowerCase())?.abbr;
        if (!place) throw new Error(`nchs: ${t.id}: no state "${name}"`);
      }
    }
    const year = r.Year.trim();
    for (const [column, kind] of Object.entries(t.values)) {
      const v = number(r[column]);
      if (v === null) continue;
      const national = slugOf(KINDS[kind].prefix, labels);
      const slug = place ? `${national}--${place}` : national;
      if (!cells.has(slug)) cells.set(slug, { kind, labels, place, national, column, values: new Map() });
      const c = cells.get(slug);
      if (!c.values.has(year)) c.values.set(year, v);
    }
  }
  return cells;
}

/**
 * The series of every table (for build-nchs-series.js), given `rowsOf(url)` → CSV rows as objects:
 * [{ slug, source: 'nchs', url, parts: [{ table, column, labels, place }], labels, name, unit, frequency, description, measure?, place? }].
 */
export function buildNchsSeries(rowsOf) {
  const bySlug = new Map();
  const bad = [];
  for (const t of TABLES) {
    for (const [slug, c] of tableCells(t, rowsOf(VIEW(t.id)))) {
      if (!bySlug.has(slug)) {
        const kind = KINDS[c.kind];
        const national = kind.name(c.labels);
        const state = c.place && [...stateByName.values()].find(s => s.abbr === c.place);
        const name = state ? `${national}, ${state.name}` : national;
        if (!state) for (const p of nameProblems(name)) bad.push(`${slug}: “${name}” ${p}`);
        const what = kind.what(c.labels);
        bySlug.set(slug, {
          slug, source: 'nchs', url: VIEW(t.id), frequency: 'annual', category: 'population', unit: kind.unit, name,
          ...(state ? { measure: c.national, place: c.place } : { labels: { measure: kind.measure, form: kind.unit === 'births' || kind.unit === 'deaths' ? 'level' : kind.unit === 'life-years' ? 'average' : 'per-population', ...c.labels } }),
          what: `${what[0].toUpperCase()}${what.slice(1)}${state ? `, ${state.name}` : ''}`, parts: [], years: new Map(),
        });
      }
      const s = bySlug.get(slug);
      s.parts.push({ table: t.id, column: c.column, labels: c.labels, place: c.place });
      for (const y of c.values.keys()) if (!s.years.has(y)) s.years.set(y, t.id);
    }
  }
  if (bad.length) throw new Error(`nchs: names that break the rules:\n${bad.join('\n')}`);
  return [...bySlug.values()].map(({ years, parts, what, ...s }) => {
    const spans = [];
    for (const [y, id] of [...years].sort(([a], [b]) => a.localeCompare(b))) {
      if (spans.at(-1)?.id === id) spans.at(-1).to = y;
      else spans.push({ id, from: y, to: y });
    }
    const used = [...new Set(spans.map(sp => sp.id))];
    const kept = parts.filter(p => used.includes(p.table));
    const from = used.length > 1 ? ` Years from each table: ${spans.map(sp => `${sp.from}${sp.to !== sp.from ? `–${sp.to}` : ''} ${TABLES.find(t => t.id === sp.id).title.replace(/^NCHS - /, '')}`).join('; ')}.` : '';
    return {
      ...s, url: VIEW(kept[0].table), parts: kept, abstract: [...new Set(kept.flatMap(p => TABLES.find(t => t.id === p.table).abstract))],
      source_id: kept.map(p => `${p.table}: ${p.column}${Object.keys(p.labels).length ? ` (${Object.values(p.labels).join(', ')})` : ''}${p.place ? ` [${p.place}]` : ''}`).join('; '),
      description: `${what}, by calendar year, as NCHS prints it (National Vital Statistics System, on data.cdc.gov): ${used.map(id => `“${TABLES.find(t => t.id === id).title.replace(/^NCHS - /, '')}”`).join(', ')}.${from}`,
    };
  });
}

/** One series' observations, given `rowsOf(url)`; each year from the first table listed that prints it. */
export function readNchsSeries(s, rowsOf) {
  const byYear = new Map();
  for (const part of s.parts) {
    const t = TABLES.find(x => x.id === part.table);
    if (!t) throw new Error(`${s.slug}: no table ${part.table}`);
    const c = tableCells(t, rowsOf(VIEW(t.id))).get(s.slug);
    if (!c) throw new Error(`${s.slug}: nothing in ${t.id}`);
    for (const [y, v] of c.values) if (!byYear.has(y)) byYear.set(y, v);
  }
  const observations = [...byYear].sort(([a], [b]) => a.localeCompare(b)).map(([y, v]) => [`${y}-01-01`, v]);
  return { description: s.description, observations, skipped: 0 };
}

/** The tables and columns a series is read from, for its publisher's title. */
export const nchsTitle = s => s.parts.map(p => `${TABLES.find(t => t.id === p.table).title}: ${p.column}`).join('; ');
