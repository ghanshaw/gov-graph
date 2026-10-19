// DHS's Yearbook of Immigration Statistics, collected for the Statistical Abstract's Section 1 tables 43–51 (Phase 5c):
// green cards (persons obtaining lawful permanent resident status), refugee arrivals, grants of asylum,
// naturalizations and orphans adopted, read from the Yearbook's Excel tables in the data folder as printed (DHS
// rounds to the nearest ten), by fiscal year. The latest edition of each part only: lawful permanent residents,
// refugees and asylees for fiscal 2023 (Office of Homeland Security Statistics, 2024), naturalizations for fiscal 2022
// (the latest workbook on DHS's Yearbook page). Earlier years of the ten-year tables are in older editions (Excel from
// fiscal 2022, PDF before), not read.
//
// A Yearbook table is a title row in capitals ("…: FISCAL YEARS 2014 TO 2023"), one or two heading rows, then either
// a year down the side or blocks headed in capitals ("REGION", "COUNTRY", "ADJUSTMENTS OF STATUS") whose rows are
// indented under the row they belong to (the depth is the cell's indent, not dots), then notes. A series printed by
// several tables (the total in Tables 1, 3, 6 and 10) is read from the first table listed.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { nameProblems } from './series-names.js';

export const DHS_YEARBOOK_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'seed', 'data', 'dhs-yearbook.json');
let cache = null;
const built = () => (cache ??= fs.existsSync(DHS_YEARBOOK_FILE) ? JSON.parse(fs.readFileSync(DHS_YEARBOOK_FILE, 'utf8')) : { countries: {}, series: [] });
/** Every series of these tables, from dhs-yearbook.json ([] before it is built). */
export const dhsSeries = () => built().series;

const FILES = 'https://ohss.dhs.gov/sites/default/files/';
const LPR = `${FILES}2024-09/2024_0906_ohss_yearbook_lawful_permanent_residents_fy2023_0.xlsx`;
const REFUGEES = `${FILES}2024-11/2024_1108_ohss_yearbook_refugees_fy2023.xlsx`;
const ASYLEES = `${FILES}2024-10/2024_1002_ohss_yearbook_asylees_fy2023.xlsx`;
const NATURALIZATIONS = `${FILES}2023-12/2023_0818_plcy_yearbook_naturalizations_fy2022.xlsx_0_0.xlsx`;
const EDITION_2023 = 'DHS Office of Homeland Security Statistics, Yearbook of Immigration Statistics, fiscal year 2023 (released 2024)';
const EDITION_2022 = 'DHS Office of Homeland Security Statistics, Yearbook of Immigration Statistics, fiscal year 2022 (released 2023)';

const NATIVE = 'population/native-and-foreign-born-populations';
export const DHS_MEASURES = {
  [`${NATIVE}/lawful-permanent-residents`]: { label: 'Lawful permanent residents', dims: ['admission_class', 'admission_type', 'birth_country', 'sex', 'age', 'marital_status', 'immigrant_occupation'] },
  [`${NATIVE}/refugee-arrivals`]: { label: 'Refugee arrivals', dims: ['nationality'] },
  [`${NATIVE}/grants-of-asylum`]: { label: 'Grants of asylum', dims: ['asylum_process', 'nationality'] },
  [`${NATIVE}/naturalization-petitions-filed`]: { label: 'Naturalization petitions filed', dims: [] },
  [`${NATIVE}/people-naturalized`]: { label: 'People naturalized', dims: ['naturalization_service'] },
  [`${NATIVE}/naturalization-petitions-denied`]: { label: 'Naturalization petitions denied', dims: [] },
  [`${NATIVE}/immigrant-orphans-adopted`]: { label: 'Immigrant orphans adopted', dims: ['sex', 'age', 'birth_country'] },
};

// Classes of admission: `name` follows "Green Cards for …", `short` before " Born in …" (Table 10), `what` in descriptions.
const CLASSES = {
  'immediate-relatives': { label: 'Immediate relatives of U.S. citizens', name: 'Immediate Relatives of U.S. Citizens', short: 'Immediate Relatives' },
  'immediate-relatives-spouses': { label: 'Spouses of U.S. citizens', name: 'Spouses of U.S. Citizens' },
  'immediate-relatives-children': { label: 'Children of U.S. citizens (including orphans)', name: 'Children of U.S. Citizens' },
  'immediate-relatives-parents': { label: 'Parents of U.S. citizens', name: 'Parents of U.S. Citizens' },
  'family-preferences': { label: 'Family-sponsored preferences', name: 'Family-Sponsored Immigrants', short: 'Sponsored Relatives' },
  'family-first': { label: 'Family first preference: unmarried sons and daughters of U.S. citizens and their children', name: 'Unmarried Adult Children of U.S. Citizens' },
  'family-second': { label: 'Family second preference: spouses, children and unmarried sons and daughters of permanent residents', name: 'Spouses and Children of Permanent Residents' },
  'family-third': { label: 'Family third preference: married sons and daughters of U.S. citizens, their spouses and children', name: 'Married Adult Children of U.S. Citizens' },
  'family-fourth': { label: 'Family fourth preference: brothers and sisters of adult U.S. citizens, their spouses and children', name: 'Brothers and Sisters of U.S. Citizens' },
  'employment-preferences': { label: 'Employment-based preferences', name: 'Employment-Based Immigrants', short: 'Employment Immigrants' },
  'employment-first': { label: 'Employment first preference: priority workers', name: 'Priority Workers' },
  'employment-second': { label: 'Employment second preference: professionals with advanced degrees or of exceptional ability', name: 'Professionals with Advanced Degrees' },
  'employment-third': { label: 'Employment third preference: skilled workers, professionals and unskilled workers', name: 'Skilled and Unskilled Workers' },
  'employment-fourth': { label: 'Employment fourth preference: certain special immigrants', name: 'Special Immigrants' },
  'employment-fifth': { label: 'Employment fifth preference: employment creation (investors)', name: 'Investors' },
  diversity: { label: 'Diversity', name: 'Diversity Immigrants', short: 'Diversity Immigrants' },
  refugees: { label: 'Refugees', name: 'Refugees' },
  asylees: { label: 'Asylees', name: 'Asylees' },
  'refugees-and-asylees': { label: 'Refugees and asylees', name: 'Refugees and Asylees', short: 'Refugees and Asylees' },
  parolees: { label: 'Parolees', name: 'Parolees' },
  'children-born-abroad': { label: 'Children born abroad to noncitizen residents', name: 'Children Born to Residents Abroad' },
  'iraqis-and-afghans': { label: 'Certain Iraqis and Afghans employed by the U.S. government, their spouses and children', name: 'Iraqi and Afghan U.S. Government Employees' },
  'cancellation-of-removal': { label: 'Cancellation of removal', name: 'People Granted Cancellation of Removal' },
  'trafficking-victims': { label: 'Victims of human trafficking', name: 'Victims of Human Trafficking' },
  'crime-victims': { label: 'Victims of crimes and their immediate relatives', name: 'Victims of Crimes' },
  other: { label: 'Other classes (Table 6’s “Other”)', name: 'Other Classes' },
  'all-other': { label: 'All classes other than the five broad ones (Table 10’s “Other”)', name: 'All Other Classes', short: 'All Other Classes' },
};
const TOP_CLASSES = {
  'immediate relatives of u.s. citizens': 'immediate-relatives', 'family-sponsored preferences': 'family-preferences',
  'employment-based preferences': 'employment-preferences', diversity: 'diversity', refugees: 'refugees', asylees: 'asylees',
  'refugees and asylees': 'refugees-and-asylees', parolees: 'parolees', 'children born abroad to noncitizen residents': 'children-born-abroad',
  'certain iraqis and afghans employed by u.s. government and their spouses and children': 'iraqis-and-afghans',
  'cancellation of removal': 'cancellation-of-removal', 'victims of human trafficking': 'trafficking-victims',
  'victims of crimes and their immediate relatives': 'crime-victims',
};
const ORDINALS = { first: 'first', second: 'second', third: 'third', fourth: 'fourth', fifth: 'fifth' };

/** A row of Table 6 (its labels from the top down) → its class of admission; null for the total. */
function classOf(rowPath, otherKey = 'other') {
  const [top, sub] = rowPath.map(l => l.toLowerCase());
  if (top === 'total') return null;
  if (top === 'other') return otherKey;
  const key = TOP_CLASSES[top];
  if (!key) throw new Error(`dhs-yearbook: no class for "${rowPath.join(' / ')}"`);
  if (!sub) return key;
  if (key === 'immediate-relatives' && /^(spouses|children|parents)$/.test(sub)) return `${key}-${sub}`;
  const ordinal = ORDINALS[/^(\w+):/.exec(sub)?.[1]];
  if (ordinal && key !== 'immediate-relatives') return `${key.replace('-preferences', '')}-${ordinal}`;
  throw new Error(`dhs-yearbook: no class for "${rowPath.join(' / ')}"`);
}
const ADMISSION_TYPES = { 'adjustments of status': 'adjustment', 'new arrivals': 'new-arrival' };
const AGES = { 'under 1 year': ['under-1', 'Under 1', 'Under 1'], '1 to 4 years': ['1-4', '1–4', 'Aged 1 to 4'], '5 years and over': ['5-over', '5 and over', 'Aged 5 and Over'] };
const SEXES = { female: 'women', male: 'men', unknown: 'not-reported' };
// Table 8's characteristics. Ages are read from their labels ("5 to 9 years", "Under 16 years", "75 years and over").
function ageKey(label) {
  const l = label.toLowerCase();
  if (l === 'unknown') return 'unknown';
  let m = /^under (\d+) years?$/.exec(l);
  if (m) return `under-${m[1]}`;
  m = /^(\d+) to (\d+) years$/.exec(l);
  if (m) return `${m[1]}-${m[2]}`;
  m = /^(\d+) years and over$/.exec(l);
  if (m) return `${m[1]}-over`;
  throw new Error(`dhs-yearbook: no age for "${label}"`);
}
const ageLabel = key => (key === 'unknown' ? 'Unknown' : key.startsWith('under-') ? `Under ${key.slice(6)}` : key.endsWith('-over') ? `${key.slice(0, -5)} and over` : key.replace('-', '–'));
const ageName = key => (key === 'unknown' ? 'of Unknown Age' : key.startsWith('under-') ? `Under Age ${key.slice(6)}` : key.endsWith('-over') ? `Aged ${key.slice(0, -5)} and Over` : `Aged ${key.replace('-', ' to ')}`);
const MARITAL = { married: ['married', 'Married'], single: ['single', 'Single'], widowed: ['widowed', 'Widowed'], 'divorced/separated': ['divorced-or-separated', 'Divorced or separated'], unknown: ['unknown', 'Unknown'] };
const MARITAL_NAMES = { married: 'Married', single: 'Single', widowed: 'Widowed', 'divorced-or-separated': 'Divorced or Separated' };
// Occupations as reported on the application; `noun` names the people where the row is a kind of person.
const OCCUPATIONS = {
  'management, professional, and related occupations': { key: 'management-professional', in: 'in Management and Professional Jobs' },
  'service occupations': { key: 'service', in: 'in Service Occupations' },
  'sales and office occupations': { key: 'sales-office', in: 'in Sales and Office Occupations' },
  'farming, fishing, and forestry occupations': { key: 'farming-fishing-forestry', in: 'in Farming, Fishing and Forestry' },
  'construction, extraction, maintenance, and repair occupations': { key: 'construction-maintenance', in: 'in Construction and Maintenance' },
  'production, transportation, and material moving occupations': { key: 'production-transportation', in: 'in Production and Transportation' },
  military: { key: 'military', in: 'in the Military' },
  'no occupation/not working outside home': { key: 'not-working', in: 'Not Working Outside the Home' },
  homemakers: { key: 'homemakers', noun: 'Homemakers' },
  'students or children': { key: 'students-or-children', noun: 'Students and Children' },
  retirees: { key: 'retirees', noun: 'Retirees' },
  unemployed: { key: 'unemployed', noun: 'Unemployed', adjective: true },
  unknown: { key: 'unknown', in: 'of Unknown Occupation' },
};
const occupationOf = key => Object.entries(OCCUPATIONS).find(([, o]) => o.key === key);

/** "Married Females Aged 25 to 29", "Female Homemakers", "Males in Service Occupations": Table 8's people (every age, so not men and women). */
function personWords(l) {
  let noun = { women: 'Females', men: 'Males' }[l.sex] ?? 'People';
  const [, occ] = (l.immigrant_occupation && occupationOf(l.immigrant_occupation)) || [];
  if (occ?.adjective) noun = `${occ.noun} ${noun}`;
  else if (occ?.noun) noun = l.sex === 'women' || l.sex === 'men' ? `${l.sex === 'women' ? 'Female' : 'Male'} ${occ.noun}` : occ.noun;
  const marital = l.marital_status && l.marital_status !== 'unknown' ? `${MARITAL_NAMES[l.marital_status]} ` : '';
  const after = [l.sex === 'not-reported' ? 'of Unreported Sex' : '', l.marital_status === 'unknown' ? 'of Unknown Marital Status' : '',
    l.age ? ageName(l.age) : '', occ?.in ?? ''].filter(Boolean).join(' ');
  return `${marital}${noun}${after ? ` ${after}` : ''}`;
}
const SERVICE = { civilian: 'civilian', military: 'military', 'not reported': 'not-reported' };

// Countries and regions as DHS names them; a key is the name as a slug. Names DHS prints in its index order
// ("Korea, South") are turned around for series names; the rest are used as printed.
const REGIONS = new Set(['africa', 'asia', 'europe', 'north-america', 'oceania', 'south-america']);
const NAME_OVERRIDES = {
  'korea-south': 'South Korea', 'korea-north': 'North Korea', 'congo-democratic-republic': 'Congo (Kinshasa)',
  'congo-republic': 'Congo (Brazzaville)', 'china-people-s-republic': 'China', 'micronesia-federated-states': 'Micronesia',
  'virgin-islands-british': 'the British Virgin Islands', 'bahamas': 'the Bahamas', 'gambia': 'the Gambia', 'cote-d-ivoire': 'Côte D’Ivoire',
  'serbia-and-montenegro-former': 'Serbia and Montenegro (Former)', 'soviet-union-former': 'the Former Soviet Union',
  'czechoslovakia-former': 'Former Czechoslovakia', 'yugoslavia-former': 'Former Yugoslavia', 'netherlands': 'the Netherlands',
  'philippines': 'the Philippines', 'united-kingdom': 'the United Kingdom', 'united-arab-emirates': 'the United Arab Emirates',
  'dominican-republic': 'the Dominican Republic', 'central-african-republic': 'the Central African Republic', 'czech-republic': 'the Czech Republic',
  'marshall-islands': 'the Marshall Islands', 'solomon-islands': 'the Solomon Islands', 'cayman-islands': 'the Cayman Islands',
  'turks-and-caicos-islands': 'the Turks and Caicos Islands', 'palestinian-territories': 'the Palestinian Territories',
  'saint-vincent-and-the-grenadines': 'Saint Vincent and the Grenadines', 'turkiye': 'Türkiye',
};
const countryKey = name => name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, '-').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** A country or region as it reads in a series name ("South Korea", "the Philippines", "Africa"). */
function countryWords(key, printed) {
  if (NAME_OVERRIDES[key]) return NAME_OVERRIDES[key];
  const m = /^(.+), (.+)$/.exec(printed);
  const words = (m ? `${m[2]} ${m[1]}` : printed).replace(/'/g, '’');
  return words.split(' ').map((w, i) => (i > 0 && /^(and|of|the)$/.test(w) ? w : w.replace(/^([(“]?)(\p{L})/u, (m, p, l) => p + l.toUpperCase()))).join(' ');
}

const text = c => String(c ?? '').replace(/\s+/g, ' ').trim();
const clean = label => text(label).replace(/(?<=[A-Za-z)])\d+$/, '').trim();
const isValue = c => /^-?\d+(\.\d+)?$/.test(text(c));
const STOP = /^(\d{1,2} [A-Z]|Notes?:|Source:|[A-Z]{1,2} Not )/;

/**
 * A Yearbook sheet → { columns, rows }: `columns[j]` is column j's heading path (an upper heading spans the columns to
 * its right until the next); each row is { block, path, values: Map(j → number) }, `path` its labels from the
 * least indented down (footnote marks taken off), `block` the capitals heading above it. Not-available cells ("NA",
 * "X", "D") are left out.
 */
export function readYearbookSheet(rows, indents) {
  const title = rows.findIndex(r => /FISCAL YEARS? \d{4}/.test(text(r[0])));
  if (title < 0) throw new Error('dhs-yearbook: no title row');
  // Heading rows have words, or years running across, beyond the first column; the figures start after them.
  const isHeading = r => {
    const cells = r.slice(1).map(text).filter(Boolean);
    if (!cells.length) return false;
    if (cells.some(c => !isValue(c))) return cells.every(c => !isValue(c) || /^(18|19|20)\d{2}$/.test(c));
    return cells.length > 1 && cells.every((c, i) => /^(18|19|20)\d{2}$/.test(c) && (i === 0 || Number(c) > Number(cells[i - 1])));
  };
  let first = title + 1;
  while (first < rows.length && (isHeading(rows[first]) || !rows[first].slice(1).some(isValue))) first++;
  // Block headings ("REGION") sit between the headings and the first figures.
  const heads = rows.slice(title + 1, first).filter(isHeading);
  const width = Math.max(0, ...rows.map(r => r.length));
  const columns = [];
  for (let j = 1; j < width; j++) {
    const at = [];
    heads.forEach((r, i) => {
      let k = j;
      if (i < heads.length - 1) while (k > 1 && !text(r[k])) k--;
      const h = clean(r[k]);
      if (h) at.push(h);
    });
    columns[j] = at;
  }
  const out = [];
  let block = null;
  const stack = [];
  for (let i = title + 1; i < rows.length; i++) {
    const r = rows[i];
    const label = text(r[0]);
    if (i >= first && STOP.test(label)) break;
    const values = new Map();
    if (i >= first) r.forEach((c, j) => { if (j > 0 && isValue(c)) values.set(j, Number(text(c))); });
    if (!values.size) {
      if (label && label === label.toUpperCase() && /[A-Z]/.test(label)) { block = label; stack.length = 0; }
      continue;
    }
    // "Total" is printed indented under its block heading; it heads nothing.
    const name = clean(label);
    const depth = name === 'Total' ? 0 : indents[i] ?? 0;
    stack.length = Math.min(stack.length, depth);
    stack[depth] = name;
    out.push({ block, path: stack.slice(0, depth + 1).filter(Boolean), label: name, values });
  }
  return { columns, rows: out };
}

/** "1976 3", "1907" → 1976; null for anything else. */
const yearOf = label => Number(/^((?:18|19|20)\d{2})(?:\s*\d)?$/.exec(text(label))?.[1]) || null;

/**
 * A fiscal year's first day as DHS counts them: July 1 through 1976 (which ran 15 months from July 1, 1975), October 1
 * after. A few early years were longer or shorter (EARLY_YEARS); the descriptions say so.
 */
// What the early years count, in the words of the 2010 Yearbook's Table 2 note (the 2023 edition prints none).
const EARLY_YEARS = 'The 2010 Yearbook notes: “From 1820 to 1867, figures represent alien passenger arrivals at seaports; from 1868 to 1891 and 1895 to 1897, immigrant alien arrivals; from 1892 to 1894 and 1898 to 2010, immigrant aliens admitted for permanent residence; from 1892 to 1903, aliens entering by cabin class were not counted as immigrants. Land arrivals were not completely enumerated until 1908. For this table, Fiscal Year 1843 covers 9 months ending September, 1843; Fiscal Years 1832 and 1850 cover 15 months ending December 31 of the respective years; and Fiscal Year 1868 covers 6 months ending June 30, 1868.” Every year is dated here as if it ran from July 1.';

export const fiscalYearStart = year => `${year - 1}-${year <= 1976 ? '07' : '10'}-01`;

// ---------------------------------------------------------------------------
// Series: what each kind of series is called and counts.

const KINDS = {
  lpr: {
    measure: `${NATIVE}/lawful-permanent-residents`, unit: 'people',
    slug: l => ['green-cards', l.admission_type, l.admission_class, l.birth_country && `born-${l.birth_country}`, l.sex, l.age && `age-${l.age}`,
      l.marital_status && `marital-${l.marital_status}`, l.immigrant_occupation && `occupation-${l.immigrant_occupation}`].filter(Boolean).join('--'),
    name: (l, c) => {
      if (l.sex || l.age || l.marital_status || l.immigrant_occupation) return `Green Cards for ${personWords(l)}`;
      const cls = l.admission_class && CLASSES[l.admission_class][l.birth_country ? 'short' : 'name'];
      const who = cls ?? (l.birth_country ? 'People' : null);
      const born = l.birth_country ? ` ${bornWords(l.birth_country, c)}` : '';
      if (l.admission_type === 'adjustment') return who ? `Green Cards for ${who}${born} Adjusting Status` : 'Green Cards for People Adjusting Status';
      if (l.admission_type === 'new-arrival') return who ? `Green Cards for ${who}${born} Arriving from Abroad` : 'Green Cards for New Arrivals from Abroad';
      return who ? `Green Cards for ${who}${born}` : 'Green Cards Granted';
    },
    what: (l, c) => `the number of people granted lawful permanent residence (a green card)${l.admission_type === 'adjustment' ? ' by adjusting their status while in the United States' : l.admission_type === 'new-arrival' ? ' on arriving from abroad with an immigrant visa' : ''}${l.admission_class ? ` in the class “${CLASSES[l.admission_class].label}”` : ''}${l.birth_country ? `, born in ${c(l.birth_country)}` : ''}${l.sex || l.age || l.marital_status || l.immigrant_occupation ? `, ${[
      l.sex && `sex ${{ women: 'female', men: 'male', 'not-reported': 'not reported' }[l.sex]}`, l.age && `age ${ageLabel(l.age).toLowerCase()}`,
      l.marital_status && `marital status ${MARITAL_NAMES[l.marital_status]?.toLowerCase() ?? 'unknown'}`,
      l.immigrant_occupation && `occupation “${occupationOf(l.immigrant_occupation)[0]}”`].filter(Boolean).join(', ')}` : ''}`,
  },
  refugees: {
    measure: `${NATIVE}/refugee-arrivals`, unit: 'people',
    slug: l => ['refugee-arrivals', l.nationality && `from-${l.nationality}`].filter(Boolean).join('--'),
    name: (l, c) => (l.nationality ? `Refugee Arrivals ${fromWords(l.nationality, c)}` : 'Refugee Arrivals'),
    what: (l, c) => `the number of refugees admitted to the United States${l.nationality ? `, ${natWords(l.nationality, c)}` : ''}`,
  },
  asylum: {
    measure: `${NATIVE}/grants-of-asylum`, unit: 'people',
    slug: l => ['asylum-grants', l.asylum_process, l.nationality && `from-${l.nationality}`].filter(Boolean).join('--'),
    name: (l, c) => `${l.asylum_process ? `${l.asylum_process === 'affirmative' ? 'Affirmative' : 'Defensive'} ` : ''}Asylum Grants${l.nationality ? ` to People ${fromWords(l.nationality, c)}` : ''}`,
    what: (l, c) => `the number of individuals granted asylum${l.asylum_process === 'affirmative' ? ' affirmatively (by U.S. Citizenship and Immigration Services, on an application made while not in removal proceedings)' : l.asylum_process === 'defensive' ? ' defensively (by an immigration judge, in removal proceedings)' : ''}${l.nationality ? `, ${natWords(l.nationality, c)}` : ''}`,
  },
  petitionsFiled: {
    measure: `${NATIVE}/naturalization-petitions-filed`, unit: 'petitions', slug: () => 'naturalization-petitions-filed',
    name: () => 'Naturalization Petitions Filed', what: () => 'the number of petitions (applications) for naturalization filed',
  },
  naturalized: {
    measure: `${NATIVE}/people-naturalized`, unit: 'people',
    slug: l => ['people-naturalized', l.naturalization_service].filter(Boolean).join('--'),
    name: l => ({ civilian: 'Civilians Naturalized', military: 'Service Members Naturalized', 'not-reported': 'People Naturalized, Civilian or Military Not Reported' }[l.naturalization_service] ?? 'People Naturalized'),
    what: l => `the number of people naturalized${{ civilian: ' as civilians', military: ' under the provisions for members of the armed forces', 'not-reported': ' whose civilian or military status was not reported' }[l.naturalization_service] ?? ''}`,
  },
  petitionsDenied: {
    measure: `${NATIVE}/naturalization-petitions-denied`, unit: 'petitions', slug: () => 'naturalization-petitions-denied',
    name: () => 'Naturalization Petitions Denied', what: () => 'the number of petitions (applications) for naturalization denied',
  },
  orphans: {
    measure: `${NATIVE}/immigrant-orphans-adopted`, unit: 'people',
    slug: l => ['orphans-adopted', l.sex, l.age, l.birth_country && `born-${l.birth_country}`].filter(Boolean).join('--'),
    name: (l, c) => `${l.sex ? (l.sex === 'women' ? 'Female ' : 'Male ') : ''}Orphans${l.age ? ` ${AGE_WORDS[l.age]}` : ''}${l.birth_country ? ` ${bornWords(l.birth_country, c)}` : ''} Adopted from Abroad`,
    what: (l, c) => `the number of ${l.sex ? (l.sex === 'women' ? 'girls' : 'boys') : 'children'}${l.age ? ` ${AGE_WORDS[l.age].toLowerCase()}` : ''}${l.birth_country ? ` born in ${c(l.birth_country)}` : ''} adopted abroad, or coming to the United States to be adopted, by U.S. citizens and granted lawful permanent residence`,
  },
};
const AGE_WORDS = Object.fromEntries(Object.values(AGES).map(([k, , w]) => [k, w]));
const fromWords = (key, c) => (key === 'unknown' ? 'of Unknown Nationality' : key === 'all-other-countries' ? 'from Other Countries' : `from ${c(key)}`);
const bornWords = (key, c) => (key === 'unknown' ? 'of Unknown Birthplace' : key === 'all-other-countries' ? 'Born in Other Countries' : `Born in ${c(key)}`);
const natWords = (key, c) => (key === 'unknown' ? 'of unknown nationality' : key === 'all-other-countries' ? 'from countries with fewer than ten a year' : REGIONS.has(key) ? `nationals of countries in ${c(key)}` : `nationals of ${c(key)}`);

// ---------------------------------------------------------------------------
// The tables, in the order they are read. `columns(headingPath)` → labels for that column (or null to skip it);
// `rows(row)` → labels for that row (or null).

const byPlace = dim => row => {
  if (row.label === 'Total') return {};
  if (!/^(REGION|COUNTRY)$/.test(row.block)) throw new Error(`dhs-yearbook: row "${row.label}" under "${row.block}"`);
  return { [dim]: countryKey(row.label) };
};
const yearColumns = ([h]) => (yearOf(h) ? { year: yearOf(h) } : null);

export const TABLES = [
  { id: 'Table 1', url: LPR, abstract: [43], kind: 'lpr', layout: 'year-pairs', edition: EDITION_2023 },
  { id: 'Table 6', url: LPR, abstract: [48], kind: 'lpr', edition: EDITION_2023, columns: yearColumns,
    rows: row => {
      const type = row.block === 'TOTAL' ? {} : ADMISSION_TYPES[row.block.toLowerCase()] ? { admission_type: ADMISSION_TYPES[row.block.toLowerCase()] } : null;
      if (!type) throw new Error(`dhs-yearbook: Table 6 block "${row.block}"`);
      const cls = classOf(row.path);
      return { ...type, ...(cls ? { admission_class: cls } : {}) };
    } },
  { id: 'Table 3', url: LPR, abstract: [50], kind: 'lpr', edition: EDITION_2023, columns: yearColumns, rows: byPlace('birth_country') },
  { id: 'Table 10', url: LPR, abstract: [49, 51], kind: 'lpr', edition: EDITION_2023, year: 2023, rows: byPlace('birth_country'),
    columns: ([h]) => (h === 'Total' ? {} : { admission_class: classOf([h], 'all-other') }) },
  { id: 'Table 8', url: LPR, abstract: [49], kind: 'lpr', edition: EDITION_2023, year: 2023,
    columns: ([h, sub]) => (h === 'Total' ? {} : h === 'Sex' ? { sex: SEXES[sub.toLowerCase()] } : null),
    rows: row => {
      if (row.label === 'Total') return {};
      if (/AGE/.test(row.block)) return { age: ageKey(row.label) };
      if (row.block === 'MARITAL STATUS') return { marital_status: MARITAL[row.label.toLowerCase()][0] };
      if (row.block === 'OCCUPATION') return { immigrant_occupation: OCCUPATIONS[row.label.toLowerCase()].key };
      throw new Error(`dhs-yearbook: Table 8 block "${row.block}"`);
    } },
  { id: 'Table 12', url: LPR, abstract: [46], kind: 'orphans', edition: EDITION_2023, year: 2023, rows: byPlace('birth_country'),
    columns: ([h, sub]) => (h === 'Total' ? {} : h === 'Sex' ? { sex: SEXES[sub.toLowerCase()] } : h === 'Age' ? { age: AGES[sub.toLowerCase()][0] } : null) },
  { id: 'Table 13', url: REFUGEES, abstract: [44], kind: 'refugees', layout: 'years', edition: EDITION_2023, columns: ([h]) => (h === 'Number' ? {} : null) },
  { id: 'Table 14', url: REFUGEES, abstract: [44], kind: 'refugees', edition: EDITION_2023, columns: yearColumns, rows: byPlace('nationality') },
  { id: 'Table 16', url: ASYLEES, abstract: [44], kind: 'asylum', layout: 'years', edition: EDITION_2023,
    columns: ([h]) => (h === 'Total' ? {} : /^(Affirmative|Defensive)$/.test(h) ? { asylum_process: h.toLowerCase() } : null) },
  { id: 'Table 17', url: ASYLEES, abstract: [44], kind: 'asylum', edition: EDITION_2023, columns: yearColumns, fixed: { asylum_process: 'affirmative' }, rows: byPlace('nationality') },
  { id: 'Table 19', url: ASYLEES, abstract: [44], kind: 'asylum', edition: EDITION_2023, columns: yearColumns, fixed: { asylum_process: 'defensive' }, rows: byPlace('nationality') },
  { id: 'Table 20', url: NATURALIZATIONS, abstract: [47], layout: 'years', edition: EDITION_2022, unrounded: true,
    columns: ([h, sub]) => (h === 'Petitions filed' ? { kind: 'petitionsFiled' } : h === 'Petitions denied' ? { kind: 'petitionsDenied' }
      : h === 'Persons naturalized' ? { kind: 'naturalized', ...(sub === 'Total' ? {} : { naturalization_service: SERVICE[sub.toLowerCase()] }) } : null) },
];

/** One table's cells as [{ labels, kind, row, column, values: [[year, value]] }] (one per row and column taken). */
function tableCells(t, sheet) {
  const { rows, indents } = sheet;
  if (t.layout === 'year-pairs') {
    // Table 1: "Year, Number" four times across.
    const values = [];
    const head = rows.findIndex(r => text(r[0]) === 'Year');
    for (const r of rows.slice(head + 1)) {
      if (STOP.test(text(r[0]))) break;
      for (let k = 0; k + 1 < r.length; k += 2) if (yearOf(r[k]) && isValue(r[k + 1])) values.push([yearOf(r[k]), Number(text(r[k + 1]))]);
    }
    return [{ labels: {}, kind: t.kind, row: '(all)', column: 'Number', values }];
  }
  const { columns, rows: grid } = readYearbookSheet(rows, indents);
  const cells = new Map();
  for (const row of grid) {
    const year = t.layout === 'years' ? yearOf(row.label) : t.year;
    if (t.layout === 'years' && !year) throw new Error(`dhs-yearbook: ${t.id}: no year in "${row.label}"`);
    const own = t.layout === 'years' ? {} : t.rows(row);
    for (const [j, v] of row.values) {
      const c = t.columns(columns[j] ?? []);
      if (!c) continue;
      const { kind = t.kind, year: y = year, ...labels } = { ...c, ...own, ...(t.fixed ?? {}) };
      const key = JSON.stringify([kind, labels]);
      if (!cells.has(key)) cells.set(key, { labels, kind, row: t.layout === 'years' ? '(all)' : row.path.join(' / '), block: row.block, column: t.layout === 'years' || t.year ? columns[j].join(' / ') : null, values: [] });
      const cell = cells.get(key);
      // A row printed twice (Unknown under REGION and COUNTRY) is taken once.
      if (!cell.values.some(([yy]) => yy === y)) cell.values.push([y, v]);
    }
  }
  return [...cells.values()];
}

/**
 * The series of every table (for build-dhs-yearbook.js), given `sheetOf(url, sheet)` → { rows, indents }:
 * { countries: { key: printed name }, series: [{ slug, source: 'dhs-yearbook', url, parts, labels, name, unit, frequency, description }] }.
 */
export function buildDhsSeries(sheetOf) {
  const countries = {};
  const bySlug = new Map();
  const bad = [];
  for (const t of TABLES) {
    const sheet = sheetOf(t.url, t.id);
    const title = text(sheet.rows.find(r => /FISCAL YEARS? \d{4}/.test(text(r[0])))[0]);
    for (const cell of tableCells(t, sheet)) {
      for (const dim of ['birth_country', 'nationality']) {
        if (!cell.labels[dim]) continue;
        const printed = cell.row.split(' / ').at(-1);
        countries[cell.labels[dim]] ??= printed;
      }
      const kind = KINDS[cell.kind];
      const slug = kind.slug(cell.labels);
      if (bySlug.has(slug)) continue; // printed by an earlier table
      const c = key => countryWords(key, countries[key]);
      const name = kind.name(cell.labels, c);
      const problems = nameProblems(name);
      if (problems.length) bad.push(`${slug}: “${name}” ${problems.join('; ')}`);
      const what = kind.what(cell.labels, c);
      const years = cell.values.map(([y]) => y);
      const early = Math.min(...years) < 1869 ? ` ${EARLY_YEARS}` : '';
      const transition = years.includes(1976) ? ' Fiscal 1976 runs 15 months, from July 1, 1975 to September 30, 1976, as DHS prints it.' : '';
      bySlug.set(slug, {
        slug, source: 'dhs-yearbook',
        source_id: `${t.id}: ${[cell.row === '(all)' ? null : cell.row, cell.column].filter(Boolean).join(', ')}${cell.block && !['REGION', 'COUNTRY', 'TOTAL'].includes(cell.block) ? ` (${cell.block.toLowerCase()})` : ''}`,
        url: t.url, frequency: 'fiscal-year', category: 'population', unit: kind.unit, name,
        labels: { measure: kind.measure, form: 'level', ...cell.labels },
        parts: [{ table: t.id, row: cell.row, block: cell.block ?? null, column: cell.column, labels: cell.labels, kind: cell.kind, title }],
        abstract: t.abstract,
        description: `${what[0].toUpperCase()}${what.slice(1)}, by fiscal year${t.unrounded ? '' : ', rounded by DHS to the nearest ten'}.${transition}${early} ${t.edition}, ${t.id}: “${title}”.`,
      });
    }
  }
  if (bad.length) throw new Error(`dhs-yearbook: names that break the rules:\n${bad.join('\n')}`);
  return { countries, series: [...bySlug.values()] };
}

/** One series' observations, given `sheetOf(url, sheet)` → { rows, indents }. */
export function readDhsYearbook(s, sheetOf) {
  const [part] = s.parts;
  const t = TABLES.find(x => x.id === part.table && x.url === s.url);
  if (!t) throw new Error(`${s.slug}: no table ${part.table}`);
  const cell = tableCells(t, sheetOf(t.url, t.id)).find(c => c.kind === part.kind && JSON.stringify(c.labels) === JSON.stringify(part.labels));
  if (!cell?.values.length) throw new Error(`${s.slug}: nothing at "${part.row}" in ${t.id}`);
  const observations = cell.values.sort(([a], [b]) => a - b).map(([y, v]) => [fiscalYearStart(y), String(v)]);
  return { description: s.description, observations, skipped: 0 };
}

/** The source ids of the series read from DHS Yearbook table `n` ("3" for Table 3), for coverage's `dhs:3`; null if none. */
export function dhsTable(n) {
  const ids = new Set(dhsSeries().filter(s => s.parts[0].table === `Table ${n}`).map(s => s.source_id));
  return ids.size ? ids : null;
}

/** The table title and row, for the publisher's title. */
export const dhsYearbookTitle = s => s.parts.map(p => `${p.title}: ${[p.row === '(all)' ? null : p.row, p.column].filter(Boolean).join(', ')}${p.block && !['REGION', 'COUNTRY', 'TOTAL'].includes(p.block) ? ` (${p.block.toLowerCase()})` : ''}`).join('; ');

/** The breakdowns these tables add ({ id: { label, values } }); ages and sexes join those already defined. */
export function dhsDimensions() {
  const { countries } = built();
  const named = Object.fromEntries(Object.entries(countries).sort(([a], [b]) => (REGIONS.has(b) - REGIONS.has(a)) || a.localeCompare(b))
    .map(([k, printed]) => [k, REGIONS.has(k) ? `${printed} (region)` : k === 'all-other-countries' ? 'Other countries (fewer than ten)' : printed]));
  return {
    admission_class: { label: 'Class of admission', values: Object.fromEntries(Object.entries(CLASSES).map(([k, c]) => [k, c.label])) },
    admission_type: { label: 'Adjustment or new arrival', values: { adjustment: 'Adjustment of status (already in the U.S.)', 'new-arrival': 'New arrival from abroad' } },
    birth_country: { label: 'Region or country of birth', values: named },
    nationality: { label: 'Region or country of nationality', values: named },
    asylum_process: { label: 'Asylum process', values: { affirmative: 'Affirmative (USCIS)', defensive: 'Defensive (immigration court)' } },
    naturalization_service: { label: 'Civilian or military', values: { civilian: 'Civilian', military: 'Military', 'not-reported': 'Not reported' } },
    age: { label: 'Age', values: Object.fromEntries([...Object.values(AGES).map(([k, l]) => [k, l]),
      ...built().series.flatMap(x => (x.labels.age ? [[x.labels.age, ageLabel(x.labels.age)]] : []))]) },
    sex: { label: 'Sex', values: { men: 'Men', women: 'Women', 'not-reported': 'Not reported' } },
    marital_status: { label: 'Marital status', values: Object.fromEntries(Object.values(MARITAL)) },
    immigrant_occupation: { label: 'Occupation (reported to DHS)', values: Object.fromEntries(Object.entries(OCCUPATIONS).map(([label, o]) => [o.key, label[0].toUpperCase() + label.slice(1)])) },
  };
}
