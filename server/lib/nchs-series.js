// NCHS's vital statistics as published on data.cdc.gov, collected for the Statistical Abstract's Section 2 (Phase 5c):
// births, birth and fertility rates, births to unmarried women, deaths and death rates by cause, infant mortality and
// life expectancy, read from the tables in the data folder as printed. Each data.cdc.gov table is a tidy CSV (a year,
// some breakdowns, one or more value columns); `TABLES` says which column is which.
//
// Beside them, the trend tables of Health, United States, 2020–2021 (Excel, data through 2019; the later editions
// are served only by a Data Finder that refuses scripts): life expectancy, infant mortality, age-adjusted death rates
// by cause and suicide rates, read by their layout (`hus-across`: years across, groups as blocks of rows; `hus-down`:
// years down, groups as column headings) with rules per table for what a block, row and column say.
//
// And the life tables of the National Vital Statistics Reports (Excel, one workbook per group): the United States for
// 2018–2024 (single race; the editions before 2018 use bridged race and are not read) and each state for 2018–2022.
// Life expectancy and survivors are taken at the ages the Abstract prints (0, 1, 5, 10, … 100), states at birth only,
// rounded as NCHS prints them in the reports (life expectancy to one decimal, survivors whole; the spreadsheets carry
// more digits).
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
import { mirrorFile } from './data-dir.js';

export const NCHS_SERIES_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'seed', 'data', 'nchs-series.json');
let cache = null;
/** Every series of these tables, from nchs-series.json ([] before it is built). */
export const nchsSeries = () => (cache ??= fs.existsSync(NCHS_SERIES_FILE) ? JSON.parse(fs.readFileSync(NCHS_SERIES_FILE, 'utf8')).series : []);

const VIEW = id => `https://data.cdc.gov/api/v3/views/${id}/export.csv`;
const HUS = name => `https://ftp.cdc.gov/pub/Health_Statistics/NCHS/Publications/Health_US/hus20-21tables/${name}.xlsx`;
const urlOf = t => (t.hus ? HUS(t.hus) : t.nvsr ? `https://ftp.cdc.gov/pub/Health_Statistics/NCHS/Publications/NVSR/${t.nvsr}` : VIEW(t.id));
const BIRTHS = 'births-deaths-marriages-and-divorces/births';
const DEATHS = 'births-deaths-marriages-and-divorces/deaths';
const LIFE = 'births-deaths-marriages-and-divorces/life-expectancy';
const GROUPS = ['race', 'race_scope', 'hispanic_origin', 'hispanic_subgroup'];

export const NCHS_MEASURES = {
  [`${BIRTHS}/births`]: { label: 'Births', dims: [...GROUPS, 'age', 'marital_status'] },
  [`${BIRTHS}/birth-rates`]: { label: 'Birth rates', dims: [...GROUPS, 'age', 'marital_status'] },
  [`${BIRTHS}/fertility-rates`]: { label: 'Fertility rates', dims: GROUPS },
  [`${DEATHS}/deaths`]: { label: 'Deaths', dims: ['cause_of_death'] },
  [`${DEATHS}/age-adjusted-death-rates`]: { label: 'Age-adjusted death rates', dims: ['race', 'race_scope', 'hispanic_origin', 'sex', 'cause_of_death'] },
  [`${DEATHS}/death-rates`]: { label: 'Death rates', dims: ['race', 'race_scope', 'hispanic_origin', 'sex', 'age', 'cause_of_death'] },
  [`${DEATHS}/infant-mortality-rates`]: { label: 'Infant mortality rates', dims: ['race', 'race_scope', 'hispanic_origin', 'race_of', 'infant_period'] },
  [`${LIFE}/life-expectancy`]: { label: 'Life expectancy', dims: ['race', 'race_scope', 'hispanic_origin', 'sex', 'life_age'] },
  [`${LIFE}/survivors-to-age`]: { label: 'Survivors to age', dims: ['race', 'race_scope', 'hispanic_origin', 'sex', 'life_age'] },
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
const RACE_WORDS = { white: 'White', black: 'Black', 'american-indian': 'Native American', 'asian-pacific-islander': 'Asian/Pacific Islander',
  asian: 'Asian', 'pacific-islander': 'Pacific Islander' };
const RACE_TEXT = { white: 'White', black: 'Black', 'american-indian': 'American Indian or Alaska Native', 'asian-pacific-islander': 'Asian or Pacific Islander',
  asian: 'Asian', 'pacific-islander': 'Native Hawaiian or Other Pacific Islander' };
const SUBGROUPS = { mexican: ['Mexican', 'Mexican'], 'puerto rican': ['puerto-rican', 'Puerto Rican'], cuban: ['cuban', 'Cuban'],
  dominican: ['dominican', 'Dominican'], 'central and south american': ['central-south-american', 'Central and South American'],
  'other and unknown hispanic': ['other-hispanic', 'Other and Unknown Hispanic'] };
SUBGROUPS.mexican[0] = 'mexican';

/** "10-14 Years", "Less than 15 years", "40+ years", "15-44" → an age key as the census tables use them. */
function ageOf(label) {
  const l = label.trim().toLowerCase().replace(/–/g, '-').replace(/ years and over$/, '+').replace(/ years?$/, '');
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
  // Health, United States's names (SlctMort), sub-causes as `parent / child`.
  'diseases of heart': 'heart-disease', 'diseases of heart / ischemic heart disease': 'ischemic-heart-disease',
  'cerebrovascular diseases': 'stroke', 'malignant neoplasms': 'cancer', 'malignant neoplasms / trachea, bronchus, and lung': 'lung-cancer',
  'malignant neoplasms / colon, rectum, and anus': 'colorectal-cancer', 'malignant neoplasms / prostate': 'prostate-cancer',
  'malignant neoplasms / breast': 'breast-cancer', 'chronic lower respiratory diseases': 'chronic-lower-respiratory-diseases',
  'chronic liver disease and cirrhosis': 'liver-disease', 'diabetes mellitus': 'diabetes',
  'human immunodeficiency virus (hiv) disease': 'hiv', 'unintentional injuries / motor vehicle-related injuries': 'motor-vehicle-injuries',
  'unintentional injuries / poisoning': 'unintentional-poisoning', 'nephritis, nephrotic syndrome and nephrosis': 'kidney-disease', homicide: 'homicide',
};
const CAUSE_NAMES = { 'unintentional-injuries': 'Unintentional Injuries', cancer: 'Cancer', 'heart-disease': 'Heart Disease',
  'influenza-and-pneumonia': 'Influenza and Pneumonia', stroke: 'Stroke', 'alzheimers-disease': 'Alzheimer’s Disease',
  'chronic-lower-respiratory-diseases': 'Chronic Lung Disease', diabetes: 'Diabetes', 'kidney-disease': 'Kidney Disease', suicide: 'Suicide',
  'ischemic-heart-disease': 'Ischemic Heart Disease', 'lung-cancer': 'Lung Cancer', 'colorectal-cancer': 'Colorectal Cancer',
  'prostate-cancer': 'Prostate Cancer', 'breast-cancer': 'Breast Cancer', 'liver-disease': 'Chronic Liver Disease', hiv: 'HIV Disease',
  'motor-vehicle-injuries': 'Motor Vehicle Injuries', 'unintentional-poisoning': 'Unintentional Poisoning', homicide: 'Homicide' };
// Descriptions keep NCHS's terms where the name shortens them.
const CAUSE_TEXT = { 'chronic-lower-respiratory-diseases': 'chronic lower respiratory diseases (chronic lung disease)',
  'lung-cancer': 'cancer of the trachea, bronchus and lung', 'colorectal-cancer': 'cancer of the colon, rectum and anus',
  'liver-disease': 'chronic liver disease and cirrhosis', hiv: 'human immunodeficiency virus (HIV) disease',
  'kidney-disease': 'kidney disease (nephritis, nephrotic syndrome and nephrosis)', 'unintentional-poisoning': 'unintentional poisoning',
  'motor-vehicle-injuries': 'motor vehicle-related injuries' };
const causeText = key => CAUSE_TEXT[key] ?? CAUSE_NAMES[key].toLowerCase().replace('alzheimer’s', 'Alzheimer’s');
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
    cause_of_death: { label: 'Cause of death', values: Object.fromEntries(Object.keys(CAUSE_NAMES).map(k => [k, causeText(k)[0].toUpperCase() + causeText(k).slice(1)])) },
    infant_period: { label: 'Infant or neonatal', values: { neonatal: 'Neonatal (under 28 days)', 'early-neonatal': 'Early neonatal (under 7 days)', postneonatal: 'Postneonatal (28 days to 1 year)' } },
    race_of: { label: 'Race of', values: { child: 'The child', mother: 'The mother' } },
    life_age: { label: 'From age', values: Object.fromEntries(LIFE_AGES.filter(Boolean).map(a => [`at-${a}`, `Age ${a}`])) },
    race_scope: { label: 'Race counted', values: { alone: 'One race alone' } },
    hispanic_origin: { label: 'Hispanic origin', values: { hispanic: 'Hispanic (of any race)', 'not-hispanic': 'Not Hispanic' } },
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
  const race = l.race ? `${RACE_TEXT[l.race]}${l.race_scope === 'alone' ? ' (one race alone)' : ''}` : '';
  return [origin, race].filter(Boolean).join(' ');
}
const SEX = { men: ['Males', 'males'], women: ['Females', 'females'] };
/** " of Non-Hispanic Black Males", " of Hispanic People"; "" for everyone (or " of People" where an age follows). */
const groupWords = (l, aged = false) => {
  const group = who(l);
  if (l.sex) return ` of ${group ? `${group} ` : ''}${SEX[l.sex][0]}`;
  return group ? ` of ${group} People` : aged ? ' of People' : '';
};
// A cause as it reads before "Death Rate" (shorter than in "Deaths from …").
const CAUSE_RATE = { 'influenza-and-pneumonia': 'Flu and Pneumonia', 'unintentional-injuries': 'Unintentional Injury',
  'motor-vehicle-injuries': 'Motor Vehicle Crash', 'unintentional-poisoning': 'Accidental Poisoning', 'liver-disease': 'Liver Disease',
  'alzheimers-disease': 'Alzheimer’s', hiv: 'HIV' };
const rateWords = cause => (cause === 'suicide' ? 'Suicide Rate' : `${cause ? `${CAUSE_RATE[cause] ?? CAUSE_NAMES[cause]} ` : ''}Death Rate`);
const slugParts = l => [l.marital_status, l.hispanic_origin === 'hispanic' && !l.hispanic_subgroup ? 'hispanic' : l.hispanic_origin === 'not-hispanic' ? 'non-hispanic' : null,
  l.race, l.race_scope === 'alone' ? 'single-race' : null, l.race_of && `race-of-${l.race_of}`, l.hispanic_subgroup, l.sex, l.age && `age-${l.age}`,
  l.cause_of_death, l.infant_period, l.life_age];
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
    // NCHS's headline rate, so the name leaves "age-adjusted" to the description: "Lung Cancer Death Rate of Black
    // Males", "Suicide Rate of Females"; the crude and age-specific rates say so.
    name: l => `${rateWords(l.cause_of_death)}${groupWords(l)}`,
    what: l => `deaths${l.cause_of_death ? ` from ${causeText(l.cause_of_death)}` : ''} per 100,000 ${[whoText(l), l.sex ? SEX[l.sex][1] : 'population'].filter(Boolean).join(' ')}, age-adjusted to the 2000 standard population`,
  },
  deathRate: {
    measure: `${DEATHS}/death-rates`, unit: 'per-100k', prefix: 'death-rate',
    name: l => `${l.age ? '' : 'Crude '}${rateWords(l.cause_of_death)}${groupWords(l, Boolean(l.age))}${l.age ? ` ${ageWords(l.age)}` : ''}`,
    what: l => `deaths${l.cause_of_death ? ` from ${causeText(l.cause_of_death)}` : ''} per 100,000 ${[whoText(l), l.sex ? SEX[l.sex][1] : l.age ? 'people' : 'population'].filter(Boolean).join(' ')}${l.age ? ` ${ageWords(l.age).toLowerCase()}` : ' of all ages (the crude rate)'}`,
  },
  infant: {
    measure: `${DEATHS}/infant-mortality-rates`, unit: 'per-1000-births', prefix: 'infant-mortality-rate',
    name: l => `${who(l) ? `${who(l)} ` : ''}${{ neonatal: 'Neonatal', 'early-neonatal': 'Early Neonatal', postneonatal: 'Postneonatal' }[l.infant_period] ?? 'Infant'} Mortality Rate${l.race_of ? ` (Race of ${l.race_of === 'child' ? 'Child' : 'Mother'})` : ''}`,
    what: l => `deaths of ${whoText(l) ? `${whoText(l)} ` : ''}infants ${{ neonatal: 'under 28 days old', 'early-neonatal': 'under 7 days old', postneonatal: 'aged 28 days to 1 year' }[l.infant_period] ?? 'under 1 year old'} per 1,000 live births${l.race_of ? `, by the race of the ${l.race_of}` : ''}`,
  },
  life: {
    measure: `${LIFE}/life-expectancy`, unit: 'life-years', prefix: 'life-expectancy',
    name: l => `Life Expectancy at ${l.life_age ? `Age ${l.life_age.slice(3)}` : 'Birth'}${groupWords(l)}`,
    what: l => (l.life_age
      ? `the average number of further years a ${[whoText(l), l.sex ? (l.sex === 'men' ? 'male' : 'female') : 'person'].filter(Boolean).join(' ')} aged ${l.life_age.slice(3)} in the year would live at that year’s death rates`
      : `the average number of years a ${[whoText(l), l.sex ? (l.sex === 'men' ? 'male' : 'female') : 'person'].filter(Boolean).join(' ')} born in the year would live at that year’s death rates`),
  },
  survivors: {
    measure: `${LIFE}/survivors-to-age`, unit: 'per-100k-born', prefix: 'survivors',
    name: l => `Survivors to Age ${l.life_age.slice(3)}${groupWords(l)}`,
    what: l => `of 100,000 ${[whoText(l), l.sex ? (l.sex === 'men' ? 'males' : 'females') : 'people'].filter(Boolean).join(' ')} born, the number who would live to age ${l.life_age.slice(3)} at the year’s death rates (the life table’s l(x))`,
  },
};

// ---------------------------------------------------------------------------
// The tables, in the order they are read. `values` maps a value column to its kind; `rows(r)` gives the labels of a
// row (null to skip it); `state` names the column holding a state, whose rows become place series.

// Health, United States's groups: "Male", "White, not Hispanic or Latino", "Black or African-American female, not
// Hispanic or Latina", "Hispanic or Latino male", "Race of mother: White".
const HUS_RACES = [['white', 'white'], ['black( or african.american)?', 'black'], ['american indian or alaska native', 'american-indian'],
  ['asian or pacific islander', 'asian-pacific-islander'], ['native hawaiian or other pacific islander', 'pacific-islander'], ['asian', 'asian']];
function husGroup(label) {
  let l = label.toLowerCase().replace(/\s+/g, ' ').trim();
  if (/^(all people|all races|all persons)$/.test(l)) return {};
  const labels = {};
  const of = /^race of (child|mother): (.*)$/.exec(l);
  if (of) { labels.race_of = of[1]; l = of[2]; }
  if (/\bfemale\b/.test(l)) labels.sex = 'women';
  else if (/\bmale\b/.test(l)) labels.sex = 'men';
  l = l.replace(/\b(fe)?male\b/, '').replace(/\s+,/g, ',').replace(/\s+/g, ' ').trim();
  if (/,? not hispanic( or latin[oa])?$/.test(l)) { labels.hispanic_origin = 'not-hispanic'; l = l.replace(/,? not hispanic( or latin[oa])?$/, '').trim(); }
  if (/^hispanic( or latin[oa])?$/.test(l)) labels.hispanic_origin = 'hispanic';
  else if (l) {
    const race = HUS_RACES.find(([re]) => new RegExp(`^${re}$`).test(l));
    if (!race) throw new Error(`nchs: no group for "${label}"`);
    labels.race = race[1];
  }
  return labels;
}
const husCause = rowPath => {
  const k = rowPath.map(x => x.toLowerCase()).join(' / ');
  if (!(k in CAUSES)) throw new Error(`nchs: no cause for "${rowPath.join(' / ')}"`);
  return CAUSES[k] ? { cause_of_death: CAUSES[k] } : {};
};

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
  // Health, United States, 2020–2021. `cell({ block, path, column })` → { kind, labels } or null.
  { id: 'hus-lexpmort', hus: 'LExpMort', layout: 'hus-down', abstract: [104],
    cell: ({ block, column: [group, sex] }) => ({ kind: 'life', labels: { ...husGroup(group), ...both(sex), ...{ 'at birth': {}, 'at 65 years': { life_age: 'at-65' }, 'at 75 years': { life_age: 'at-75' } }[block.toLowerCase()] } }) },
  { id: 'hus-immort', hus: 'IMMort', layout: 'hus-down', abstract: [114, 115],
    cell: ({ block, column: [period, under] }) => ({ kind: 'infant', labels: { ...husGroup(block),
      ...(period === 'Infant' ? {} : period === 'Postneonatal' ? { infant_period: 'postneonatal' } : under === 'Under 7 days' ? { infant_period: 'early-neonatal' } : { infant_period: 'neonatal' }) } }) },
  { id: 'hus-slctmort', hus: 'SlctMort', layout: 'hus-across', abstract: [117, 124, 125, 126, 129],
    cell: ({ block, path }) => ({ kind: 'ageAdjusted', labels: { ...husGroup(block), ...husCause(path) } }) },
  { id: 'hus-suicmort', hus: 'SuicMort', layout: 'hus-across', abstract: [128],
    cell: ({ block, label }) => {
      const group = { ...husGroup(block), cause_of_death: 'suicide' };
      if (/^all ages, age adjusted$/i.test(label)) return { kind: 'ageAdjusted', labels: group };
      if (/^all ages, crude$/i.test(label)) return { kind: 'deathRate', labels: group };
      return { kind: 'deathRate', labels: { ...group, age: ageOf(label) } };
    } },
];
for (const t of TABLES) if (t.hus) t.title = `Health, United States, 2020–2021, Table ${t.hus}`;

// The life tables: the National Vital Statistics Reports' folders, by the year they are for. Each workbook is one
// group's table; its title says which ("Life table for non-Hispanic Black males: United States, 2019").
const NVSR = 'https://ftp.cdc.gov/pub/Health_Statistics/NCHS/Publications/NVSR/';
const US_LIFE_TABLES = { '69-12': 2018, '70-19': 2019, '71-01': 2020, '72-12': 2021, '74-02': 2022, '74-06': 2023, '75-05': 2024 };
const STATE_LIFE_TABLES = { '70-01': 2018, '70-18': 2019, '71-02': 2020, '73-07': 2021, '74-12': 2022 };
const LIFE_AGES = [0, 1, ...Array.from({ length: 20 }, (_, i) => (i + 1) * 5)];
for (const [folder, year] of [...Object.entries(US_LIFE_TABLES), ...Object.entries(STATE_LIFE_TABLES)]) {
  const dir = mirrorFile(`${NVSR}${folder}/`);
  if (!fs.existsSync(dir)) continue;
  const state = folder in STATE_LIFE_TABLES;
  for (const file of fs.readdirSync(dir).filter(f => /\.xlsx$/.test(f)).sort()) {
    // State workbooks: total, males, females (the fourth holds standard errors).
    if (state && !/^[A-Z]{2}[123]\.xlsx$|-(1-Total|2-Male|3-Female)\.xlsx$/.test(file)) continue;
    TABLES.push({ id: `nvsr-${folder}-${file.replace(/\.xlsx$/, '')}`, nvsr: `${folder}/${file}`, layout: 'life-table', year, state,
      abstract: state ? [108] : [105, 106], title: `National Vital Statistics Reports, ${state ? 'state' : 'U.S.'} life tables for ${year} (${folder.replace(/[-_]/, ', no. ')}), ${file.replace(/\.xlsx$/, '')}` });
  }
}

// ---------------------------------------------------------------------------
// Health, United States's layouts. Cells: "- - -" not available, "…" not applicable, "*" unreliable (not shown);
// footnote marks are "\\1" after a label or year.

const SYMBOL = /^(- - -|…|\*)$/;
const husText = c => String(c ?? '').replace(/\\[\d–,\\]+/g, '').replace(/\s+/g, ' ').trim();
const husValue = c => {
  const t = String(c ?? '').trim();
  return /^-?\d+(\.\d+)?(e-?\d+)?$/i.test(t) ? String(Number(Number(t).toPrecision(12))) : null;
};
const husStop = label => /^(- - -|NOTES:|SOURCE:|\.\.\.|…)/.test(label);

/** Years across: [{ block, path, label, values: Map(year → value), single }] for each row and run of year columns. */
function readHusAcross({ rows, indents }) {
  const head = rows.findIndex(r => r.slice(1).some(c => /^(19|20)\d{2}/.test(husText(c))));
  const years = rows[head].map((c, j) => (j > 0 && /^(19|20)\d{2}/.test(husText(c)) ? { year: husText(c).slice(0, 4), single: /single race/i.test(c) } : null));
  const out = [];
  let block = null;
  const stack = [];
  for (let i = head + 1; i < rows.length; i++) {
    const r = rows[i];
    const label = husText(r[0]);
    if (husStop(label)) break;
    const cells = r.slice(1).map(c => String(c ?? '').trim());
    if (!cells.some(c => husValue(c) !== null || SYMBOL.test(c))) {
      if (label) { block = label; stack.length = 0; }
      continue;
    }
    const depth = indents[i] ?? 0;
    stack.length = depth;
    stack[depth] = label;
    for (const single of [false, true]) {
      const values = new Map();
      r.forEach((c, j) => { const v = husValue(c); if (years[j] && years[j].single === single && v !== null && !values.has(years[j].year)) values.set(years[j].year, v); });
      if (values.size) out.push({ block, path: stack.filter(Boolean), label, values, single });
    }
  }
  return out;
}

/** Years down: [{ block, column: heading path, single, values: Map(year → value) }] per block and column ("2018 (single race)" rows apart). */
function readHusDown({ rows }) {
  const out = new Map();
  let columns = [];
  let block = null;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const label = husText(r[0]);
    if (i > 0 && husStop(label)) break;
    if (/^(specified age and year|race and year)$/i.test(label)) {
      // Heading rows: this one and the next (whose first cell is empty); an upper heading spans right.
      const upper = r.map(husText);
      const lower = (husText(rows[i + 1]?.[0]) === '' ? rows[i + 1] : []).map(husText);
      columns = upper.map((_, j) => {
        if (j === 0) return null;
        let k = j;
        while (k > 1 && !upper[k]) k--;
        return [upper[k], lower[j]].filter(Boolean);
      });
      if (lower.length) i++;
      continue;
    }
    const m = /^((?:19|20)\d{2})( \(single race\))?$/.exec(label);
    if (!m) { if (label) block = label; continue; }
    const [, year, single] = m;
    r.forEach((c, j) => {
      const v = husValue(c);
      if (!columns[j]?.length || v === null) return;
      const key = JSON.stringify([block, columns[j], Boolean(single)]);
      if (!out.has(key)) out.set(key, { block, column: columns[j], single: Boolean(single), values: new Map() });
      if (!out.get(key).values.has(year)) out.get(key).values.set(year, v);
    });
  }
  return [...out.values()];
}

/** A published number ("3,791,712", "13.0"); null where nothing is printed. */
const number = cell => {
  const t = String(cell ?? '').replace(/,/g, '').trim();
  return /^-?\d+(\.\d+)?$/.test(t) ? t : null;
};

/** One table's cells: Map(slug → { kind, labels, place, national, column, values: Map(year → value) }). */
function tableCells(t, rows) {
  if (t.layout === 'life-table') return lifeCells(t, rows);
  if (t.layout) return husCells(t, rows);
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

// A year printed twice (bridged race, then single race: 2018) is a separate series for a race, one race alone;
// for everyone else the first printing wins.
const single = (cell, isSingle) => (isSingle && cell?.labels.race ? { ...cell, labels: { ...cell.labels, race_scope: 'alone' } } : cell);

// A life table's group, from its title: "the total population", "males", "the Hispanic population", "non-Hispanic
// White females", "American Indian and Alaska Native, non-Hispanic males". These editions count one race alone.
function lifeGroup(group) {
  let l = group.toLowerCase().replace(/^the /, '').replace(/ population$/, '').trim();
  const labels = {};
  if (/\bfemales$/.test(l)) labels.sex = 'women';
  else if (/\bmales$/.test(l)) labels.sex = 'men';
  l = l.replace(/\s*\b(fe)?males$/, '').trim();
  if (l === 'total' || l === '') return labels;
  if (/non-hispanic/.test(l)) { labels.hispanic_origin = 'not-hispanic'; l = l.replace(/,? ?non-hispanic,? ?/, ' ').trim(); }
  if (l === 'hispanic') return { ...labels, hispanic_origin: 'hispanic' };
  const race = [['white', 'white'], ['black', 'black'], ['american indian (and|or) alaska native', 'american-indian'], ['asian', 'asian']].find(([re]) => new RegExp(`^${re}$`).test(l));
  if (!race) throw new Error(`nchs: no life table group "${group}"`);
  return { ...labels, race: race[1], race_scope: 'alone' };
}

/** A life table's cells: life expectancy and survivors at the Abstract's ages (a state's: life expectancy at birth). */
function lifeCells(t, { rows }) {
  const cells = new Map();
  const title = /Life table for (.*): (.*), (\d{4})/.exec(String(rows[0][0]).split('\n')[0]);
  if (!title) throw new Error(`nchs: ${t.id}: not a life table`);
  const labels = lifeGroup(title[1]);
  let place = null;
  if (t.state) {
    place = stateByName.get(title[2].toLowerCase())?.abbr;
    if (!place) throw new Error(`nchs: ${t.id}: no state "${title[2]}"`);
  }
  const codes = rows.find(r => r.includes('lx') && r.includes('ex'));
  const [lx, ex] = [codes.indexOf('lx'), codes.indexOf('ex')];
  const add = (kind, own, value, column) => {
    const national = slugOf(KINDS[kind].prefix, own);
    const slug = place ? `${national}--${place}` : national;
    cells.set(slug, { kind, labels: own, place, national, column, values: new Map([[title[3], value]]) });
  };
  for (const r of rows) {
    const m = /^(\d+)(?:\s*[-–‒—]\s*\d+|\s+and (?:over|older))$/.exec(String(r[0]).trim());
    if (!m || !LIFE_AGES.includes(Number(m[1]))) continue;
    const age = Number(m[1]);
    if (t.state && age > 0) continue;
    const own = { ...labels, ...(age ? { life_age: `at-${age}` } : {}) };
    add('life', own, Number(r[ex]).toFixed(1), `age ${r[0]}, ex`);
    if (age > 0 && !t.state) add('survivors', own, String(Math.round(Number(r[lx]))), `age ${r[0]}, lx`);
  }
  return cells;
}

function husCells(t, sheet) {
  const cells = new Map();
  const add = (cell, values, column) => {
    if (!cell) return;
    const slug = slugOf(KINDS[cell.kind].prefix, cell.labels);
    if (!cells.has(slug)) cells.set(slug, { kind: cell.kind, labels: cell.labels, place: null, national: slug, column, values: new Map() });
    for (const [y, v] of values) if (!cells.get(slug).values.has(y)) cells.get(slug).values.set(y, v);
  };
  if (t.layout === 'hus-down') {
    for (const c of readHusDown(sheet)) add(single(t.cell(c), c.single), c.values, `${c.block}: ${c.column.join(', ')}${c.single ? ' (single race)' : ''}`);
    return cells;
  }
  for (const r of readHusAcross(sheet)) add(single(t.cell(r), r.single), r.values, `${r.block}: ${r.path.join(' / ')}${r.single ? ' (single race)' : ''}`);
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
    for (const [slug, c] of tableCells(t, rowsOf(urlOf(t)))) {
      if (!bySlug.has(slug)) {
        const kind = KINDS[c.kind];
        const national = kind.name(c.labels);
        const state = c.place && [...stateByName.values()].find(s => s.abbr === c.place);
        const name = state ? `${national}, ${state.name}` : national;
        if (!state) for (const p of nameProblems(name)) bad.push(`${slug}: “${name}” ${p}`);
        const what = kind.what(c.labels);
        bySlug.set(slug, {
          slug, source: 'nchs', url: urlOf(t), frequency: 'annual', category: 'population', unit: kind.unit, name,
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
      ...s, url: urlOf(TABLES.find(t => t.id === kept[0].table)), parts: kept, abstract: [...new Set(kept.flatMap(p => TABLES.find(t => t.id === p.table).abstract))],
      source_id: kept.map(p => `${p.table}: ${p.column}${Object.keys(p.labels).length ? ` (${Object.values(p.labels).join(', ')})` : ''}${p.place ? ` [${p.place}]` : ''}`).join('; '),
      description: `${what}, by calendar year, as NCHS prints it (National Vital Statistics System): ${used.map(id => `“${TABLES.find(t => t.id === id).title.replace(/^NCHS - /, '')}”${TABLES.find(t => t.id === id).hus ? '' : ' (data.cdc.gov)'}`).join(', ')}.${from}`,
    };
  });
}

/** One series' observations, given `rowsOf(url)`; each year from the first table listed that prints it. */
export function readNchsSeries(s, rowsOf) {
  const byYear = new Map();
  for (const part of s.parts) {
    const t = TABLES.find(x => x.id === part.table);
    if (!t) throw new Error(`${s.slug}: no table ${part.table}`);
    const c = tableCells(t, rowsOf(urlOf(t))).get(s.slug);
    if (!c) throw new Error(`${s.slug}: nothing in ${t.id}`);
    for (const [y, v] of c.values) if (!byYear.has(y)) byYear.set(y, v);
  }
  const observations = [...byYear].sort(([a], [b]) => a.localeCompare(b)).map(([y, v]) => [`${y}-01-01`, v]);
  return { description: s.description, observations, skipped: 0 };
}

/** The tables and columns a series is read from, for its publisher's title. */
export const nchsTitle = s => s.parts.map(p => `${TABLES.find(t => t.id === p.table).title}: ${p.column}`).join('; ');
