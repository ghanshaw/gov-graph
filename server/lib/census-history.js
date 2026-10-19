// Census's historical tables of families and living arrangements (Current Population Survey, Annual Social and
// Economic Supplement; www2.census.gov/programs-surveys/demo/tables/families/time-series/), read for the Statistical
// Abstract's Section 1 (tables 56, 59–62, 67–69, 72). Each table prints the years down the side, newest first, in
// blocks ("All races", "White", …) when it is broken down by race, with the columns as its series.
//
// A year label carries footnote letters ("2025t", "2021r", "2023a, z", "1990 Census"). A year printed twice (after
// a change of weights or of method: "2021r" above "2021", or two parent-pointer methods) is taken from its first
// row, the method later years use, as for income table H-5. Where a table's letters a and b mean race alone and race
// alone or in combination (`scopes`), the two rows of a year are separate series; years before 2003, when one race
// was asked, belong to the series of the race alone. Values are stored as printed (thousands stay thousands).

const text = c => String(c ?? '').replace(/\s+/g, ' ').trim();
const isNumber = c => c != null && text(c) !== '' && Number.isFinite(Number(c));
// A year row: "2025t", "..2021a, z, r", "1990a Census", "1960a, c Census", "2014x, s".
const YEAR = /^\.*((?:19|20)\d{2})\s*([a-z](?:\s*,\s*[a-z])*)?\s*(Census)?\s*\**$/i;

/** A year row's label → { year, letters, census } or null. */
export function yearOf(label) {
  const m = YEAR.exec(text(label));
  if (!m) return null;
  return { year: Number(m[1]), letters: (m[2] ?? '').split(/\s*,\s*/).filter(Boolean).map(l => l.toLowerCase()), census: Boolean(m[3]) };
}

/** A heading cell without its footnote marks ("Married1" → "Married", "Hispanic*" → "Hispanic"). */
const heading = c => text(c).replace(/([A-Za-z])\d+(?=\s|$|,)/g, '$1').replace(/\*+/g, '').trim();

/**
 * A history table → { columns, blocks }: `columns[j]` is column j's heading words (the heading rows above it, a
 * heading spanning several columns repeated under each); each block is { label, years: Map(year → { row, census,
 * scope, values: Map(j → number) }) }, `label` the block's heading ("All races"; '' when the table has none).
 * with `scopes`, years are keyed `<year>` for the race alone and `<year>b` for alone or in combination.
 */
export function readCensusHistory(rows, { scopes = false } = {}) {
  const first = rows.findIndex(r => yearOf(r?.[0]) && (r ?? []).slice(1).some(isNumber));
  if (first < 0) throw new Error('no year rows');
  // The heading rows: up from the first year, the rows with words beyond the first column, until a note.
  const heads = [];
  for (let i = first - 1; i >= 0; i--) {
    const r = rows[i] ?? [];
    if ((r.slice(1)).some(c => text(c))) { heads.unshift(r); continue; }
    if (text(r[0]).length > 30) break;
  }
  const width = Math.max(...rows.slice(first).map(r => r?.length ?? 0));
  // Upper heading rows span to the right until the next heading in the same row or a row above (the last row is the
  // columns' own).
  const filled = heads.map((r, i) => Array.from({ length: width }, (_, j) => heading(r?.[j])));
  // A heading wrapped onto the next row ("Never" over "married") is one heading, in its lower row.
  filled.slice(0, -1).forEach((r, i) => {
    for (let j = 1; j < width; j++) {
      if (r[j] && /^[a-z]/.test(filled[i + 1][j])) { filled[i + 1][j] = `${r[j]} ${filled[i + 1][j]}`; r[j] = ''; }
    }
  });
  filled.slice(0, -1).forEach((r, i) => {
    for (let j = 2; j < width; j++) {
      if (!r[j] && filled.slice(0, i).every(above => !above[j] || above[j] === above[j - 1])) r[j] = r[j - 1];
    }
  });
  const columns = Array.from({ length: width }, (_, j) => filled.map(r => r[j]).filter(Boolean).filter((h, k, a) => a[k - 1] !== h).join(' / '));

  const blocks = [];
  let block = null;
  for (const r of rows.slice(first - 1)) {
    const label = text(r?.[0]);
    if (!label) continue;
    const y = yearOf(label);
    const values = new Map();
    for (let j = 1; j < width; j++) if (isNumber(r?.[j])) values.set(j, Number(r[j]));
    if (!y) {
      if (/^year$/i.test(label)) continue;
      if (/^(Source|Note|N |NA |Dash|FOR FURTHER|Internet Release)/i.test(label) || /^[a-z*]+\s{2,}/.test(r?.[0] ?? '')) {
        if (block?.years.size) break;
        continue;
      }
      if (values.size) continue;
      // A block heading (".All races", "White alone, non-Hispanic households"); a heading of blocks above it
      // ("Family households (as of 2007, …)") is kept as its first part.
      const depth = /^\.*/.exec(label)[0].length;
      const name = heading(label.replace(/^\.+/, '')).replace(/\s*\(as of 2007.*\)\.?$/, '');
      if (depth === 0 && /^\./.test(text(rows[rows.indexOf(r) + 1]?.[0]))) { block = { group: name, label: null, years: new Map() }; continue; }
      const group = depth > 0 ? (block?.group ?? null) : null;
      block = { group, label: name, years: new Map() };
      blocks.push(block);
      continue;
    }
    if (!block) { block = { group: null, label: '', years: new Map() }; blocks.push(block); }
    if (!values.size) continue;
    const scope = scopes && y.letters.includes('b') ? 'in-combination' : null;
    const key = `${y.year}${scope ? 'b' : ''}`;
    if (!block.years.has(key)) block.years.set(key, { row: label.replace(/^\.+/, ''), census: y.census, scope, year: y.year, values });
  }
  return { columns, blocks: blocks.filter(b => b.years.size) };
}

// ---------------------------------------------------------------------------
// Measures and breakdowns.

const MARITAL = 'population/marital-status-and-living-arrangements';
const HOUSEHOLDS = 'population/households-families-group-quarters';
const M = {
  marital: `${MARITAL}/marital-status`,
  households: `${HOUSEHOLDS}/households`,
  householderAge: `${HOUSEHOLDS}/median-age-of-householders`,
  perHousehold: `${HOUSEHOLDS}/people-per-household`,
  families: `${HOUSEHOLDS}/families-with-own-children`,
  familyGroups: `${HOUSEHOLDS}/family-groups-with-children`,
  subfamilies: `${HOUSEHOLDS}/subfamilies-with-children`,
  couples: `${HOUSEHOLDS}/married-couples-by-race-of-spouses`,
  stayAtHome: `${HOUSEHOLDS}/married-couple-families-with-a-stay-at-home-parent`,
  stayAtHomeChildren: `${HOUSEHOLDS}/children-with-a-stay-at-home-parent`,
  children: `${HOUSEHOLDS}/children-by-living-arrangement`,
  alone: `${HOUSEHOLDS}/adults-living-alone`,
};
const RACE_DIMS = ['race', 'race_scope', 'hispanic_origin'];
export const HISTORY_MEASURES = {
  [M.marital]: { label: 'Marital status', dims: ['marital_status', 'sex', ...RACE_DIMS] },
  [M.households]: { label: 'Households', dims: ['household_type', 'age', 'household_size', ...RACE_DIMS] },
  [M.householderAge]: { label: 'Median age of householders', dims: [] },
  [M.perHousehold]: { label: 'People per household', dims: ['household_type', 'age'] },
  [M.families]: { label: 'Families with own children', dims: ['family_type', ...RACE_DIMS] },
  [M.familyGroups]: { label: 'Family groups with children', dims: ['family_type', ...RACE_DIMS] },
  [M.subfamilies]: { label: 'Subfamilies with children', dims: ['subfamily', 'family_type', ...RACE_DIMS] },
  [M.couples]: { label: 'Married couples by race of spouses', dims: ['couple_race'] },
  [M.stayAtHome]: { label: 'Married-couple families with a stay-at-home parent', dims: ['stay_at_home_parent'] },
  [M.stayAtHomeChildren]: { label: 'Children with a stay-at-home parent', dims: ['stay_at_home_parent'] },
  [M.children]: { label: 'Children by living arrangement', dims: ['living_arrangement', 'parent_marital_status', ...RACE_DIMS] },
  [M.alone]: { label: 'Adults living alone', dims: ['sex', 'age'] },
};

const MARITAL_STATUS = { married: 'Married', unmarried: 'Unmarried', 'never-married': 'Never married', widowed: 'Widowed', divorced: 'Divorced' };
const HOUSEHOLD_TYPE = {
  family: 'Family households', 'married-couple': 'Married-couple households', 'family-male-householder': 'Family households, male householder, no spouse',
  'family-female-householder': 'Family households, female householder, no spouse', nonfamily: 'Nonfamily households',
  'nonfamily-male-householder': 'Nonfamily households, male householder', 'nonfamily-female-householder': 'Nonfamily households, female householder',
};
const SIZES = { 1: ['One', 'One-Person'], 2: ['Two', 'Two-Person'], 3: ['Three', 'Three-Person'], 4: ['Four', 'Four-Person'], 5: ['Five', 'Five-Person'], 6: ['Six', 'Six-Person'], '7-or-more': ['Seven or more', null] };
const FAMILY_TYPE = {
  'married-couple': ['Married couple', 'Married-Couple'], 'two-parent': ['Two parents', 'Two-Parent'], 'unmarried-couple': ['Two unmarried parents', 'Unmarried-Couple'],
  'one-parent': ['One parent', 'One-Parent'], 'mother-only': ['Mother only', 'Mother-Only'], 'father-only': ['Father only', 'Father-Only'],
};
const SUBFAMILY = { related: 'Related subfamilies', unrelated: 'Unrelated subfamilies' };
const COUPLE_RACE = {
  interracial: ['Interracial', 'Interracial Married Couples'], 'black-white': ['Black and White', 'Black-White Married Couples'],
  'black-husband-white-wife': ['Black husband, White wife', 'Married Couples of a Black Husband and White Wife'],
  'white-husband-black-wife': ['White husband, Black wife', 'Married Couples of a White Husband and Black Wife'],
  'white-other-race': ['White and other race', 'Married Couples of a White and an Other-Race Spouse'],
  'black-other-race': ['Black and other race', 'Married Couples of a Black and an Other-Race Spouse'],
};
const LIVING = {
  'two-parents': ['Two parents', 'Living with Two Parents'], 'one-parent': ['One parent', 'Living with One Parent'],
  'mother-only': ['Mother only', 'Living with Their Mother Only'], 'father-only': ['Father only', 'Living with Their Father Only'],
  'other-relatives': ['Other relatives, no parent', 'Living with Other Relatives, No Parent'], nonrelatives: ['Nonrelatives, no parent', 'Living with Nonrelatives, No Parent'],
};
const PARENT_MARITAL = { divorced: ['Divorced', 'Divorced'], 'spouse-absent': ['Married, spouse absent', 'Married, Spouse-Absent'], widowed: ['Widowed', 'Widowed'], 'never-married': ['Never married', 'Never-Married'] };
const AGES = { 'under-25': 'Under 25', '25-29': '25–29', '30-34': '30–34', '35-44': '35–44', '45-54': '45–54', '55-64': '55–64', '65-74': '65–74', '75-over': '75 and over',
  'under-18': 'Under 18', '18-over': '18 and over', '18-24': '18–24', '25-34': '25–34', '35-64': '35–64' };
const AGE_WORDS = { 'under-25': 'Under 25', '75-over': 'Aged 75 and Over', 'under-18': 'Under 18', '18-over': 'Aged 18 and Over' };
const ageWords = key => AGE_WORDS[key] ?? `Aged ${key.replace('-', ' to ')}`;

/** The breakdowns these tables add ({ id: { label, values } }); ages join those of census-tables.js. */
export function historyDimensions() {
  const v = o => Object.fromEntries(Object.entries(o).map(([k, x]) => [k, Array.isArray(x) ? x[0] : x]));
  return {
    marital_status: { label: 'Marital status', values: MARITAL_STATUS },
    household_type: { label: 'Type of household', values: HOUSEHOLD_TYPE },
    household_size: { label: 'Size of household', values: Object.fromEntries(Object.entries(SIZES).map(([k, [w]]) => [k, `${w} ${k === '1' ? 'person' : 'people'}`])) },
    family_type: { label: 'Type of family', values: v(FAMILY_TYPE) },
    subfamily: { label: 'Subfamily', values: SUBFAMILY },
    couple_race: { label: 'Race of spouses', values: v(COUPLE_RACE) },
    stay_at_home_parent: { label: 'Stay-at-home parent', values: { mother: 'Mother', father: 'Father' } },
    living_arrangement: { label: 'Lives with', values: v(LIVING) },
    parent_marital_status: { label: 'Parent’s marital status', values: v(PARENT_MARITAL) },
    age: { label: 'Age', values: AGES },
  };
}

// Races as the blocks and columns name them; `adj` goes before the noun in names.
const RACE = { white: ['White', 'White'], black: ['Black', 'Black'], asian: ['Asian', 'Asian'] };
const BLOCKS = {
  'All races': {}, White: { race: 'white' }, Black: { race: 'black' }, Asian: { race: 'asian' },
  'Hispanic (of any race)': { hispanic_origin: 'hispanic' }, 'Hispanic origin': { hispanic_origin: 'hispanic' }, '': {},
};

/** "Black", "Hispanic" before a noun; the scope after the name. */
function who(labels) {
  const words = [labels.hispanic_origin === 'hispanic' ? 'Hispanic' : '', labels.race ? RACE[labels.race][1] : ''].filter(Boolean).join(' ');
  return { words, scope: labels.race_scope === 'in-combination' ? ' (Alone or in Combination)' : '' };
}
/** "Black (one race alone) " for descriptions. */
function whoText(labels) {
  const race = labels.race ? `${RACE[labels.race][0]} (${labels.race_scope === 'in-combination' ? 'alone or in combination with other races' : 'one race alone from 2003'})` : '';
  return [labels.hispanic_origin === 'hispanic' ? 'Hispanic (of any race)' : '', race].filter(Boolean).join(' ');
}
const join = (...parts) => parts.filter(Boolean).join(' ');

// Each measure: its slug prefix, unit, form, and name and description from the labels.
const KINDS = {
  [M.marital]: {
    prefix: 'marital-status', unit: 'thousands',
    name: l => { const { words, scope } = who(l); const sex = l.sex === 'men' ? 'Men' : 'Women';
      return l.marital_status ? `${join(MARITAL_STATUS[l.marital_status].replace('Never married', 'Never-Married'), words, sex)}${scope}` : `${join(words, sex)} Aged 15 and Over${scope}`; },
    what: l => `the number of ${join(l.marital_status ? MARITAL_STATUS[l.marital_status].toLowerCase().replace('never married', 'never-married') : '', whoText(l), l.sex)} aged 15 and over (14 and over in 1950 and 1960), in thousands`,
  },
  [M.households]: {
    prefix: 'households', unit: 'thousands',
    name: l => {
      const { words, scope } = who(l);
      if (l.household_size) return l.household_size === '7-or-more' ? 'Households of Seven or More People' : `${SIZES[l.household_size][1]} Households`;
      if (l.age) return `Households with a Householder ${ageWords(l.age)}`;
      const type = { family: 'Family Households', 'married-couple': 'Married-Couple Households', 'family-male-householder': 'Family Households with a Male Householder, No Spouse',
        'family-female-householder': 'Family Households with a Female Householder, No Spouse', nonfamily: 'Nonfamily Households',
        'nonfamily-male-householder': 'Nonfamily Households with a Male Householder', 'nonfamily-female-householder': 'Nonfamily Households with a Female Householder' }[l.household_type] ?? 'Households';
      return `${join(words, type)}${scope}`;
    },
    what: l => `the number of ${l.household_type ? HOUSEHOLD_TYPE[l.household_type].toLowerCase() : 'households'}${l.race || l.hispanic_origin ? ` with a ${whoText(l)} householder` : ''}${l.age ? ` whose householder is ${ageWords(l.age).toLowerCase()}` : ''}${l.household_size ? ` of ${SIZES[l.household_size][0].toLowerCase()} ${l.household_size === '1' ? 'person' : 'people'}` : ''}, in thousands`,
  },
  [M.householderAge]: { prefix: 'householder-median-age', unit: 'years', name: () => 'Median Age of Householders', what: () => 'the median age of householders' },
  [M.perHousehold]: {
    prefix: 'people-per-household', unit: 'average-people', form: 'average',
    name: l => { const unit = l.household_type === 'family' ? 'Family' : 'Household';
      return l.age ? `Average Number of ${l.age === 'under-18' ? 'Children Under 18' : 'Adults'} per ${unit}` : `Average ${unit} Size`; },
    what: l => `the average number of ${l.age === 'under-18' ? 'people under 18' : l.age ? 'people 18 and over' : 'people'} per ${l.household_type === 'family' ? 'family' : 'household'}`,
  },
  [M.families]: {
    prefix: 'families-with-own-children', unit: 'thousands',
    name: l => { const { words, scope } = who(l); return `${join(words, l.family_type ? FAMILY_TYPE[l.family_type][1] : '', 'Families with Children Under 18')}${scope}`; },
    what: l => `the number of ${l.family_type ? `${FAMILY_TYPE[l.family_type][1].toLowerCase()} ` : ''}families (family households) with their own children under 18${l.race || l.hispanic_origin ? `, ${whoText(l)} householder` : ''}, in thousands`,
  },
  [M.familyGroups]: {
    prefix: 'family-groups-with-children', unit: 'thousands',
    name: l => { const { words, scope } = who(l); return `${join(words, l.family_type ? FAMILY_TYPE[l.family_type][1] : '', 'Family Groups with Children')}${scope}`; },
    what: l => `the number of ${l.family_type ? `${FAMILY_TYPE[l.family_type][1].toLowerCase()} ` : ''}family groups with children under 18 (family households, related and unrelated subfamilies; unmarried two-parent groups counted from 2007)${l.race || l.hispanic_origin ? `, ${whoText(l)} householder or reference person` : ''}, in thousands`,
  },
  [M.subfamilies]: {
    prefix: 'subfamilies-with-children', unit: 'thousands',
    // Two-parent subfamilies were all married couples while these were printed (to 2006); "Two-Parent" keeps names short.
    name: l => { const { words, scope } = who(l); return `${join(words, l.family_type ? (l.family_type === 'married-couple' ? 'Two-Parent' : FAMILY_TYPE[l.family_type][1]) : '', l.subfamily === 'related' ? 'Related' : 'Unrelated', 'Subfamilies with Children')}${scope}`; },
    what: l => `the number of ${l.subfamily} subfamilies with children under 18${l.family_type ? ` (${FAMILY_TYPE[l.family_type][0].toLowerCase()})` : ''}${l.race || l.hispanic_origin ? `, ${whoText(l)} reference person` : ''}, in thousands`,
  },
  [M.couples]: {
    prefix: 'married-couples-by-race', unit: 'thousands',
    name: l => (l.couple_race ? COUPLE_RACE[l.couple_race][1] : 'Married Couples, All Races'),
    what: l => (l.couple_race ? `the number of married couples whose spouses are ${COUPLE_RACE[l.couple_race][0].toLowerCase()}, in thousands` : 'the number of married couples, in thousands'),
  },
  [M.stayAtHome]: {
    prefix: 'stay-at-home-parent-families', unit: 'thousands',
    name: l => (l.stay_at_home_parent ? `Married-Couple Families with a Stay-at-Home ${l.stay_at_home_parent === 'mother' ? 'Mother' : 'Father'}` : 'Married-Couple Families with Children Under 15'),
    what: l => `the number of opposite-sex married-couple family groups with children under 15${l.stay_at_home_parent ? ` with a stay-at-home ${l.stay_at_home_parent}` : ''}, in thousands`,
  },
  [M.stayAtHomeChildren]: {
    prefix: 'children-with-stay-at-home-parent', unit: 'thousands',
    name: l => (l.stay_at_home_parent ? `Children Under 15 with a Stay-at-Home ${l.stay_at_home_parent === 'mother' ? 'Mother' : 'Father'}` : 'Children Under 15 in Married-Couple Families'),
    what: l => `the number of children under 15 in opposite-sex married-couple family groups${l.stay_at_home_parent ? ` with a stay-at-home ${l.stay_at_home_parent}` : ''}, in thousands`,
  },
  [M.children]: {
    prefix: 'children-living-arrangements', unit: 'thousands',
    name: l => {
      const { words, scope } = who(l);
      if (l.parent_marital_status) return `${join(words, 'Children Living with a', PARENT_MARITAL[l.parent_marital_status][1], l.living_arrangement === 'mother-only' ? 'Mother Only' : 'Father Only')}${scope}`;
      return `${join(words, l.living_arrangement ? 'Children' : 'Children Under 18', l.living_arrangement ? LIVING[l.living_arrangement][1] : '')}${scope}`;
    },
    what: l => `the number of ${whoText(l) ? `${whoText(l)} ` : ''}children under 18${l.living_arrangement ? ` living with ${LIVING[l.living_arrangement][0].toLowerCase()}` : ''}${l.parent_marital_status ? `, the parent ${PARENT_MARITAL[l.parent_marital_status][0].toLowerCase()}` : ''} (not counting children who are householders, subfamily reference persons or their spouses), in thousands`,
  },
  [M.alone]: {
    prefix: 'adults-living-alone', unit: 'thousands',
    name: l => (l.form === 'share-of-total'
      ? `Share of ${l.sex ? (l.sex === 'men' ? 'Men' : 'Women') : 'Adults'} ${l.age && l.age !== '18-over' ? `${ageWords(l.age)} ` : ''}Living Alone`
      : 'Adults Living Alone'),
    what: l => (l.form === 'share-of-total'
      ? `the percent of ${l.sex ?? 'adults'} ${l.age && l.age !== '18-over' ? ageWords(l.age).toLowerCase() : 'aged 18 and over'} who live alone`
      : 'the number of adults (18 and over) living alone, in thousands'),
  },
};

// ---------------------------------------------------------------------------
// The tables. `columns` maps a column number to [the words its heading must contain, its labels]; `blocks` (default
// BLOCKS) maps a block's heading to its labels, and `groups` a heading of blocks to its measure and labels.

const FAMILIES = 'https://www2.census.gov/programs-surveys/demo/tables/families/time-series/';
const SOURCE = 'Census Bureau, Current Population Survey, Annual Social and Economic Supplement (as of March; decennial census in the years marked), historical tables of families and living arrangements';
const sexes = (offset, sex) => ({
  [offset]: [/Total/, { sex }], [offset + 1]: [/Married/, { sex, marital_status: 'married' }], [offset + 3]: [/Unmarried/, { sex, marital_status: 'unmarried' }],
  [offset + 4]: [/married/, { sex, marital_status: 'never-married' }], [offset + 5]: [/Widowed/, { sex, marital_status: 'widowed' }], [offset + 6]: [/Divorced/, { sex, marital_status: 'divorced' }],
});
const FAMILY_COLUMNS = { 1: [/Total families/, {}], 4: [/Married/, { family_type: 'married-couple' }], 7: [/One parent.*Total/, { family_type: 'one-parent' }],
  8: [/Mother only/, { family_type: 'mother-only' }], 9: [/Father only/, { family_type: 'father-only' }] };
const LIVING_COLUMNS = { 1: [/Total children/, {}], 2: [/Two parents/, { living_arrangement: 'two-parents' }], 4: [/One parent.*Total/, { living_arrangement: 'one-parent' }],
  5: [/Mother only/, { living_arrangement: 'mother-only' }], 6: [/Father only/, { living_arrangement: 'father-only' }],
  8: [/Other relatives/, { living_arrangement: 'other-relatives' }], 9: [/Nonrelatives/, { living_arrangement: 'nonrelatives' }] };
const parentMarital = parent => ({ 4: [/Divorced/, { living_arrangement: parent, parent_marital_status: 'divorced' }], 5: [/spouse absent/, { living_arrangement: parent, parent_marital_status: 'spouse-absent' }],
  6: [/Widowed/, { living_arrangement: parent, parent_marital_status: 'widowed' }], 7: [/Never married/, { living_arrangement: parent, parent_marital_status: 'never-married' }] });
const aloneByAge = age => ({ 5: [/Living alone \/ Men/, { form: 'share-of-total', sex: 'men', age }], 6: [/Living alone \/ Women/, { form: 'share-of-total', sex: 'women', age }] });

export const HISTORY_TABLES = [
  { id: 'ms1', abstract: [56], path: 'marital/ms1.xls', measure: M.marital, scopes: true, columns: { ...sexes(1, 'men'), ...sexes(9, 'women') },
    notes: { asian: 'Before 2003 Asian includes Pacific Islanders.', black: 'For 1950 and 1960 Census printed all races other than White.' } },
  { id: 'hh1', abstract: [59, 61], path: 'households/hh1.xls', measure: M.households, columns: {
    1: [/Total households/, {}], 2: [/Family households/, { household_type: 'family' }], 3: [/Married couples/, { household_type: 'married-couple' }],
    5: [/Male householder/, { household_type: 'family-male-householder' }], 6: [/Female householder/, { household_type: 'family-female-householder' }],
    8: [/Nonfamily households/, { household_type: 'nonfamily' }], 9: [/Nonfamily.*Male/, { household_type: 'nonfamily-male-householder' }],
    10: [/Nonfamily.*Female/, { household_type: 'nonfamily-female-householder' }] } },
  { id: 'hh2', abstract: [59], path: 'households/hh2.xls', measure: M.households, columns: {
    2: [/^White$/, { race: 'white', race_scope: 'alone' }], 3: [/White alone or in combination/, { race: 'white', race_scope: 'in-combination' }],
    4: [/^Black$/, { race: 'black', race_scope: 'alone' }], 5: [/Black alone or in combination/, { race: 'black', race_scope: 'in-combination' }],
    6: [/Asian alone/, { race: 'asian', race_scope: 'alone' }], 7: [/Hispanic/, { hispanic_origin: 'hispanic' }] } },
  { id: 'hh3', abstract: [62], path: 'households/hh3.xls', measure: M.households, columns: {
    2: [/Under 25/, { age: 'under-25' }], 3: [/25 to 29/, { age: '25-29' }], 4: [/30 to 34/, { age: '30-34' }], 5: [/35 to 44/, { age: '35-44' }], 6: [/45 to 54/, { age: '45-54' }],
    7: [/55 to 64/, { age: '55-64' }], 8: [/65 to 74/, { age: '65-74' }], 9: [/75 years and older/, { age: '75-over' }], 10: [/Median age/, { measure: M.householderAge }] } },
  { id: 'hh4', abstract: [62], path: 'households/hh4.xls', measure: M.households, columns: Object.fromEntries(Object.entries(SIZES).map(([size, [word]], i) => [i + 2, [new RegExp(word), { household_size: size }]])) },
  { id: 'hh6', abstract: [59, 61], path: 'households/hh6.xls', measure: M.perHousehold, columns: {
    2: [/per household \/ All ages/, {}], 3: [/per household \/ Under 18/, { age: 'under-18' }], 4: [/per household \/ 18 and older/, { age: '18-over' }],
    7: [/per family \/ All ages/, { household_type: 'family' }], 8: [/per family \/ Under 18/, { household_type: 'family', age: 'under-18' }],
    9: [/per family \/ 18 and older/, { household_type: 'family', age: '18-over' }] } },
  { id: 'fm1', abstract: [59], path: 'families/fm1.xls', measure: M.families, columns: {
    2: [/own children under 18 \/ Total/, {}], 3: [/Married couple/, { family_type: 'married-couple' }], 4: [/One parent families \/ Total/, { family_type: 'one-parent' }],
    5: [/Mother only/, { family_type: 'mother-only' }], 6: [/Father only/, { family_type: 'father-only' }] } },
  { id: 'fm2', abstract: [59, 67], path: 'families/fm2.xls', measure: M.familyGroups, scopes: true, columns: {
    ...FAMILY_COLUMNS, 3: [/Two parent families \/ Total/, { family_type: 'two-parent' }], 5: [/Unmarried/, { family_type: 'unmarried-couple' }] },
    // Until 2006 Census also printed the family groups' three parts; two-parent groups were married couples then.
    groups: { 'Family households': { measure: M.families, only: FAMILY_COLUMNS }, 'Related subfamilies': { measure: M.subfamilies, labels: { subfamily: 'related' }, only: FAMILY_COLUMNS },
      'Unrelated subfamilies': { measure: M.subfamilies, labels: { subfamily: 'unrelated' }, only: FAMILY_COLUMNS } } },
  { id: 'ms3', abstract: [60], path: 'marital/ms3.xls', measure: M.couples, columns: {
    1: [/Total married couples/, {}], 2: [/Interracial married couples \/ Total/, { couple_race: 'interracial' }], 3: [/Black\/White \/ Total/, { couple_race: 'black-white' }],
    4: [/Black husband White wife/, { couple_race: 'black-husband-white-wife' }], 5: [/White husband Black wife/, { couple_race: 'white-husband-black-wife' }],
    6: [/White\/ Other race/, { couple_race: 'white-other-race' }], 7: [/Black\/ Other race/, { couple_race: 'black-other-race' }] } },
  { id: 'shp1', abstract: [68], path: 'families/shp1.xls', measure: M.stayAtHome, columns: {
    1: [/family groups.*\/ Total/, {}], 2: [/Stay at home mothers/, { stay_at_home_parent: 'mother' }], 3: [/Stay at home fathers/, { stay_at_home_parent: 'father' }],
    5: [/children under 15.*\/ Total/, { measure: M.stayAtHomeChildren }], 6: [/With stay at home mothers/, { measure: M.stayAtHomeChildren, stay_at_home_parent: 'mother' }],
    7: [/With stay at home fathers/, { measure: M.stayAtHomeChildren, stay_at_home_parent: 'father' }] } },
  { id: 'ch1', abstract: [69], path: 'children/ch1.xls', measure: M.children, columns: LIVING_COLUMNS },
  { id: 'ch2', abstract: [69], path: 'children/ch2.xls', measure: M.children, scopes: true, fixed: { race: 'white' }, columns: LIVING_COLUMNS },
  { id: 'ch3', abstract: [69], path: 'children/ch3.xls', measure: M.children, scopes: true, fixed: { race: 'black' }, columns: LIVING_COLUMNS },
  { id: 'ch4', abstract: [69], path: 'children/ch4.xls', measure: M.children, fixed: { hispanic_origin: 'hispanic' }, columns: LIVING_COLUMNS },
  { id: 'ch5', abstract: [69], path: 'children/ch5.xls', measure: M.children, columns: parentMarital('mother-only') },
  { id: 'ch6', abstract: [69], path: 'children/ch6.xls', measure: M.children, columns: parentMarital('father-only') },
  { id: 'ad3', abstract: [72], path: 'adults/ad3.xls', measure: M.alone, columns: { 3: [/Living alone \/ Number/, {}], 4: [/Living alone \/ Percent/, { form: 'share-of-total' }] } },
  ...[['18-24', '18-24'], ['25-34', '25-34'], ['35-64', '35-64'], ['65-74', '65-74'], ['75andover', '75-over']].map(([file, age]) => (
    { id: `ad3-${file}`, abstract: [72], path: `adults/ad3-${file}.xls`, measure: M.alone, columns: aloneByAge(age) })),
].map(t => ({ ...t, url: `${FAMILIES}${t.path}`, layout: 'history', vintage: 2025, source: SOURCE }));

/** A series' slug from its measure's prefix and labels. */
const slugOf = (prefix, l) => [prefix, l.form === 'share-of-total' ? 'share' : null, l.household_type, l.household_size ? `size-${l.household_size}` : null, l.marital_status, l.family_type, l.subfamily,
  l.couple_race, l.stay_at_home_parent, l.living_arrangement, l.parent_marital_status, l.sex, l.hispanic_origin, l.race, l.race_scope === 'in-combination' ? 'in-combination' : null, l.age]
  .filter(Boolean).join('--');

const scopeOf = l => (l.race && !l.race_scope ? { ...l, race_scope: 'alone' } : l);

/**
 * A history table's series: [{ slug, part, make(), dates }] for census-tables.js's builder, where `part` is
 * { table, row: block, column } and `make()` gives the series' labels, name, unit and description.
 */
export function historySeries(t, rows) {
  const { columns, blocks } = readCensusHistory(rows, { scopes: t.scopes });
  for (const [j, [expect]] of Object.entries(t.columns)) {
    if (!expect.test(columns[j] ?? '')) throw new Error(`${t.id}: column ${j} is "${columns[j]}", not ${expect}`);
  }
  const out = [];
  for (const b of blocks) {
    const group = b.group ? t.groups?.[b.group] : null;
    if (b.group && !group) throw new Error(`${t.id}: no reading for the blocks under "${b.group}"`);
    if (!(b.label in BLOCKS)) throw new Error(`${t.id}: no reading for the block "${b.label}"`);
    const cols = group?.only ?? t.columns;
    for (const scope of t.scopes ? ['alone', 'in-combination'] : [null]) {
      const years = [...b.years.values()].filter(y => (scope === 'in-combination' ? y.scope === scope : !y.scope));
      if (!years.length) continue;
      for (const [j, [, own]] of Object.entries(cols)) {
        const dated = years.filter(y => y.values.has(Number(j)));
        if (!dated.length) continue;
        const labels = scopeOf({ ...BLOCKS[b.label], ...(t.fixed ?? {}), ...(group?.labels ?? {}), ...own, ...(scope === 'in-combination' ? { race_scope: scope } : {}) });
        const measure = labels.measure ?? group?.measure ?? t.measure;
        const { measure: _, form = 'level', ...dims } = labels;
        if (scope === 'in-combination' && !dims.race) continue;
        const kind = KINDS[measure];
        out.push({
          slug: slugOf(kind.prefix, { ...dims, form }),
          part: { table: t.id, row: [b.group, b.label].filter(Boolean).join(' / ') || '(all)', column: Number(j), heading: columns[j], ...(scope ? { scope } : {}) },
          make: () => {
            const what = kind.what({ ...dims, form });
            const note = (dims.race && t.notes?.[dims.race]) ?? '';
            return { labels: { measure, form: kind.form ?? form, ...dims }, name: kind.name({ ...dims, form }), unit: form === 'share-of-total' ? '%' : kind.unit,
              description: `${what[0].toUpperCase()}${what.slice(1)}.${note ? ` ${note}` : ''}` };
          },
          dates: dated.map(y => dateOf(y)),
        });
      }
    }
  }
  return out;
}

// As of March (the survey); the decennial census rows as of April 1.
const dateOf = y => `${y.year}-${y.census ? '04' : '03'}-01`;

/** One part's observations: [[date, value]]. */
export function historyValues(t, rows, part) {
  const { blocks } = readCensusHistory(rows, { scopes: t.scopes });
  const b = blocks.find(x => ([x.group, x.label].filter(Boolean).join(' / ') || '(all)') === part.row);
  if (!b) return [];
  return [...b.years.values()].filter(y => (part.scope === 'in-combination' ? y.scope === 'in-combination' : !y.scope) && y.values.has(part.column))
    .map(y => [dateOf(y), y.values.get(part.column)]);
}
