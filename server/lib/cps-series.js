// BLS's Current Population Survey (the `ln` survey file) collected for the Statistical Abstract (Phase 5, tables
// 586–593, 602, 610, 613, 615, 622–628 and 1275): the series that print each table's rows (user, 2026-10-17), monthly
// where BLS prints them, seasonally adjusted and not, else yearly. The rows are hand-kept in
// server/seed/data/cps-tables.json; server/seed/build-cps-series.js finds their series in cps-series.json.
//
// Each series is labelled from its BLS codes: what is counted (lfst) sets the measure and form; every other code is a
// breakdown value (sex, race, age, education as the unemployment groups already loaded; nativity, veteran status,
// disability, marital status, class of worker, industry, occupation and the survey's reasons as breakdowns of their
// own). Names are built from the same vocabulary ("Unemployment Rate for Foreign-Born Women"), with hand names by
// series id in cps-names.json; BLS's own series title is kept as publisher_title.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MAX_NAME } from './series-names.js';

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'seed', 'data');
let cache = null;
const read = () => (cache ??= {
  ...JSON.parse(fs.readFileSync(path.join(DATA, 'cps-series.json'), 'utf8')),
  ...(({ names, industries, occupations }) => ({ names, industries, occupations }))(JSON.parse(fs.readFileSync(path.join(DATA, 'cps-names.json'), 'utf8'))),
});

const LFE = 'labor-force-employment-and-earnings';
export const CPS_UNEMPLOYMENT = `${LFE}/unemployed-persons/unemployment`;
const STATUS = `${LFE}/labor-force-status/labor-force-status`;
const EMPLOYMENT = `${LFE}/employed-persons/employment`;
const SERVICES = 'accommodation-food-services-and-other-services/accommodation-food-services-and-other-services/employment-in-services';

// What is counted (lfst): the breakdown value of `labor_status`, the form, and the name's words.
// `who` puts the group in: "Number of Employed {who}", "Unemployment Rate for {who}".
const LFST = {
  '00': { status: 'population', label: 'Civilian population', form: 'level', total: 'Civilian Population (16 and Over)', who: 'Civilian Population of {who}' },
  10: { status: 'labor-force', label: 'In the labor force', form: 'level', total: 'Civilian Labor Force', who: '{who} in the Labor Force' },
  13: { status: 'participation', label: 'Labor force participation rate', form: 'rate', total: 'Labor Force Participation Rate', who: 'Labor Force Participation Rate for {who}' },
  20: { status: 'employed', label: 'Employed', form: 'level', total: 'Number of Employed People', who: 'Number of Employed {who}' },
  23: { status: 'employment-ratio', label: 'Employment-population ratio', form: 'rate', total: 'Employment-Population Ratio', who: 'Employment-Population Ratio for {who}' },
  50: { status: 'not-in-labor-force', label: 'Not in the labor force', form: 'level', total: 'People Not in the Labor Force', who: '{who} Not in the Labor Force' },
  30: { form: 'level', total: 'Number of Unemployed People', who: 'Number of Unemployed {who}' },
  40: { form: 'rate', total: 'Unemployment Rate', who: 'Unemployment Rate for {who}' },
  31: { form: 'level', looking: 'full-time', total: 'Number of Unemployed Looking for Full-Time Work', who: 'Number of Unemployed {who} Looking for Full-Time Work' },
  32: { form: 'level', looking: 'part-time', total: 'Number of Unemployed Looking for Part-Time Work', who: 'Number of Unemployed {who} Looking for Part-Time Work' },
  41: { form: 'rate', looking: 'full-time', total: 'Unemployment Rate of the Full-Time Labor Force', who: 'Unemployment Rate of the Full-Time Labor Force for {who}' },
  42: { form: 'rate', looking: 'part-time', total: 'Unemployment Rate of the Part-Time Labor Force', who: 'Unemployment Rate of the Part-Time Labor Force for {who}' },
};

// Each BLS code: [breakdown, value key, value label, words]. `adj` words go before the noun ("Foreign-Born Black
// Women"), `noun` replaces it ("Veterans"), `after` follows it ("Women with a Disability").
const W = (dim, key, label, words) => ({ dim, key, label, ...words });
const CODES = {
  sexs: { 1: W('sex', 'men', 'Men', { sex: 'Men' }), 2: W('sex', 'women', 'Women', { sex: 'Women' }) },
  race: { '01': W('race', 'white', 'White', { race: 'White' }), '03': W('race', 'black', 'Black', { race: 'Black' }), '04': W('race', 'asian', 'Asian', { race: 'Asian' }) },
  orig: {
    '01': W('race', 'hispanic', 'Hispanic', { race: 'Hispanic' }), '02': W('race', 'mexican', 'Mexican', { race: 'Mexican-Origin' }),
    '06': W('race', 'puerto-rican', 'Puerto Rican', { race: 'Puerto Rican' }), '07': W('race', 'cuban', 'Cuban', { race: 'Cuban-Origin' }),
    10: W('race', 'non-hispanic', 'Non-Hispanic', { race: 'Non-Hispanic' }),
  },
  born: { '01': W('nativity', 'native-born', 'Native born', { adj: 'Native-Born' }), '02': W('nativity', 'foreign-born', 'Foreign born', { adj: 'Foreign-Born' }) },
  vets: {
    '01': W('veteran', 'veteran', 'Veterans', { noun: 'Veterans' }), '09': W('veteran', 'gulf-war-era', 'Gulf War era veterans', { noun: 'Gulf War Era Veterans' }),
    13: W('veteran', 'gulf-war-era-1', 'Gulf War era I veterans', { noun: 'Gulf War Era I Veterans' }), 12: W('veteran', 'gulf-war-era-2', 'Gulf War era II veterans', { noun: 'Gulf War Era II Veterans' }),
    '03': W('veteran', 'wwii-korea-vietnam', 'World War II, Korean War and Vietnam era veterans', { noun: 'World War II to Vietnam Era Veterans' }),
    16: W('veteran', 'other-periods', 'Veterans of other service periods', { noun: 'Other-Era Veterans' }),
    25: W('veteran', 'nonveteran', 'Nonveterans', { noun: 'Nonveterans' }),
  },
  disa: { '01': W('disability', 'without', 'Without a disability', { after: 'Without a Disability' }), '02': W('disability', 'with', 'With a disability', { after: 'with a Disability' }) },
  mari: {
    '01': W('marital', 'never-married', 'Never married', { adj: 'Never-Married' }), '02': W('marital', 'married', 'Married, spouse present', { adj: 'Married' }),
    '09': W('marital', 'widowed-divorced-separated', 'Widowed, divorced or separated', { adj: 'Widowed, Divorced or Separated' }),
  },
  class: {
    '01': W('worker_class', 'wage-salary', 'Wage and salary workers', { noun: 'Wage and Salary Workers' }),
    '02': W('worker_class', 'private-wage-salary', 'Private wage and salary workers', { noun: 'Private Wage and Salary Workers' }),
    '03': W('worker_class', 'government', 'Government workers', { noun: 'Government Workers' }),
    '08': W('worker_class', 'self-employed', 'Self-employed (unincorporated)', { noun: 'Self-Employed Workers' }),
    '09': W('worker_class', 'unpaid-family', 'Unpaid family workers', { noun: 'Unpaid Family Workers' }),
  },
  mjhs: {
    '01': W('multiple_jobs', 'all', 'Multiple jobholders', { noun: 'Multiple Jobholders' }),
    '02': W('multiple_jobs', 'full-part', 'Primary job full time, second part time', { noun: 'Multiple Jobholders, One Job Part-Time' }),
    '03': W('multiple_jobs', 'both-part', 'Both jobs part time', { noun: 'Multiple Jobholders, Both Jobs Part-Time' }),
    '04': W('multiple_jobs', 'both-full', 'Both jobs full time', { noun: 'Multiple Jobholders, Both Jobs Full-Time' }),
    '05': W('multiple_jobs', 'hours-vary', 'Hours vary', { noun: 'Multiple Jobholders Whose Hours Vary' }),
  },
  wkst: {
    '02': W('work_schedule', 'part-time', 'At work part time', { noun: 'People Working Part Time' }),
    '03': W('work_schedule', 'part-time-usually-full', 'At work part time, usually full time', { noun: 'Full-Timers Working Part Time' }),
    '04': W('work_schedule', 'part-time-usually-part', 'At work part time, usually part time', { noun: 'Usual Part-Timers Working Part Time' }),
  },
  rwns: {
    '01': W('part_time_reason', 'economic', 'Economic reasons', { reason: 'for Economic Reasons' }),
    '02': W('part_time_reason', 'slack-work', 'Slack work or business conditions', { reason: 'Because of Slack Work' }),
    '07': W('part_time_reason', 'only-part-time-found', 'Could only find part-time work', { reason: 'Who Could Only Find Part-Time Work' }),
    40: W('part_time_reason', 'seasonal', 'Seasonal work', { reason: 'Because of Seasonal Work' }),
    41: W('part_time_reason', 'job-started-ended', 'Job started or ended during the week', { reason: 'Because a Job Started or Ended' }),
    10: W('part_time_reason', 'noneconomic', 'Noneconomic reasons', { reason: 'for Noneconomic Reasons' }),
    30: W('part_time_reason', 'child-care', 'Child-care problems', { reason: 'Because of Child-Care Problems' }),
    33: W('part_time_reason', 'family-obligations', 'Other family or personal obligations', { reason: 'Because of Family Obligations' }),
    34: W('part_time_reason', 'health', 'Health or medical limitations', { reason: 'Because of Health Limitations' }),
    31: W('part_time_reason', 'school', 'In school or training', { reason: 'Because of School or Training' }),
    32: W('part_time_reason', 'retired', 'Retired or Social Security limit on earnings', { reason: 'Because Retired' }),
    15: W('part_time_reason', 'vacation', 'Vacation or personal day', { reason: 'Because of Vacation' }),
    12: W('part_time_reason', 'holiday', 'Holiday', { reason: 'Because of a Holiday' }),
    13: W('part_time_reason', 'weather', 'Bad weather', { reason: 'Because of Bad Weather' }),
    35: W('part_time_reason', 'other', 'All other reasons', { reason: 'for Other Reasons' }),
  },
  jdes: { 1: W('wants_job', 'yes', 'Want a job now', { after: 'Wanting a Job' }), 2: W('wants_job', 'no', 'Do not want a job now', { after: 'Not Wanting a Job' }) },
  rnlf: {
    60: W('not_in_labor_force', 'no-search', 'Did not search for work in the past year', { reason: ', Did Not Search Last Year' }),
    61: W('not_in_labor_force', 'searched', 'Searched for work in the past year', { reason: ', Searched Last Year' }),
    62: W('not_in_labor_force', 'not-available', 'Searched, not available now', { reason: ', Not Available Now' }),
    63: W('not_in_labor_force', 'marginally-attached', 'Marginally attached', { reason: ', Marginally Attached' }),
    64: W('not_in_labor_force', 'discouraged', 'Discouraged workers', { reason: ', Discouraged' }),
    65: W('not_in_labor_force', 'other-than-discouraged', 'Reasons other than discouragement', { reason: ', Not Discouraged' }),
    66: W('not_in_labor_force', 'family', 'Family responsibilities', { reason: ', Family Responsibilities' }),
    67: W('not_in_labor_force', 'school', 'In school or training', { reason: ', in School or Training' }),
    68: W('not_in_labor_force', 'health', 'Ill health or disability', { reason: ', Ill Health or Disability' }),
    69: W('not_in_labor_force', 'other', 'Other reasons', { reason: ', Other Reasons' }),
  },
  duration: {
    '006': W('unemployment_duration', 'under-5-weeks', 'Less than 5 weeks', { reason: 'for Less Than 5 Weeks' }),
    107: W('unemployment_duration', '5-14-weeks', '5 to 14 weeks', { reason: 'for 5 to 14 Weeks' }),
    '018': W('unemployment_duration', '15-weeks-over', '15 weeks and over', { reason: 'for 15 Weeks or More' }),
    109: W('unemployment_duration', '15-26-weeks', '15 to 26 weeks', { reason: 'for 15 to 26 Weeks' }),
    '031': W('unemployment_duration', '27-weeks-over', '27 weeks and over', { reason: 'for 27 Weeks or More' }),
  },
  seek: { '01': W('job_search', 'jobseekers', 'Jobseekers', { noun: 'Jobseekers' }) },
  look: {
    '01': W('unemployment_reason', 'job-losers', 'Job losers and completed temporary jobs', { noun: 'Job Losers' }),
    '02': W('unemployment_reason', 'temporary-layoff', 'On layoff', { noun: 'Job Losers on Layoff' }),
    '05': W('unemployment_reason', 'not-on-layoff', 'Not on temporary layoff', { noun: 'Job Losers Not on Layoff' }),
    41: W('unemployment_reason', 'permanent-job-losers', 'Permanent job losers', { noun: 'Permanent Job Losers' }),
    17: W('unemployment_reason', 'temporary-job-completed', 'Completed temporary jobs', { noun: 'People Whose Temporary Jobs Ended' }),
    '06': W('unemployment_reason', 'job-leavers', 'Job leavers', { noun: 'Job Leavers' }),
  },
  entr: { 1: W('unemployment_reason', 'reentrants', 'Reentrants', { noun: 'Reentrants' }), 2: W('unemployment_reason', 'new-entrants', 'New entrants', { noun: 'New Entrants' }) },
  education: {
    11: W('education', 'no-diploma', 'No high school diploma', { noun: 'Workers Without a High School Diploma', people: 'People Without a High School Diploma' }),
    19: W('education', 'high-school', 'High school, no college', { noun: 'High School Graduates' }),
    20: W('education', 'some-college', 'Some college', { noun: 'Workers with Some College', people: 'People with Some College' }),
    40: W('education', 'bachelors', 'College graduates', { noun: 'College Graduates' }),
  },
};
// Ages as the unemployment groups already loaded name them ('20-24', '55-over').
const ageKey = text => text.replace(/ years?/, '').replace(/^(\d+) to (\d+)$/, '$1-$2').replace(/^(\d+) and over$/, '$1-over');
const ageWords = text => (/and over/.test(text) ? `Aged ${text.replace(/ years and over/, '')} and Over` : `Aged ${text.replace(/ years/, '').replace(' to ', '–')}`);

// Averages BLS prints alongside the counts (tdat).
const STATS = {
  '02': { key: 'average-weeks', label: 'Average weeks unemployed', name: 'Average Weeks Unemployed' },
  '03': { key: 'median-weeks', label: 'Median weeks unemployed', name: 'Median Weeks Unemployed' },
  '04': { key: 'average-hours', label: 'Average hours at work', name: 'Average Weekly Hours' },
};
const SHARE_WHO = { women: 'Women', black: 'Black', asian: 'Asian', hispanic: 'Hispanic' };

// Industries in short words where BLS's are long (cps-names.json `industries`, by code), else BLS's in Title Case.
const occupationName = code => read().occupations[code] ?? `${titleWords(read().labels.occupation[code].replace(/ occupations$/i, ''))} Jobs`;
const industryName = code => read().industries[code] ?? titleWords(read().labels.indy[code].replace(/ industries$/i, ''));

const titleWords = text => text.replace(/\b([a-z])/g, (m, c, i) => (i && /^(and|of|or|the|for|in|to|a|by|except|from|on|with)\b/.test(text.slice(i)) ? c : c.toUpperCase()));

function measureOf(s) {
  if (['30', '31', '32', '40', '41', '42'].includes(s.lfst)) return CPS_UNEMPLOYMENT;
  if (s.tables.includes(1275) && s.tables.length === 1) return SERVICES;
  const first = Math.min(...s.tables);
  return s.lfst === '20' && [602, 610, 613].includes(first) ? EMPLOYMENT : STATUS;
}

/** The BLS ids of the series printing an Abstract table's rows (coverage's `cps:586`), or null if it has none. */
export function cpsTable(table) {
  const ids = read().series.filter(s => s.tables.includes(Number(table))).map(s => s.id);
  return ids.length ? new Set(ids) : null;
}

/** The breakdowns and their values, from the codes the series use. */
export function cpsDimensions() {
  const { labels } = read();
  const dims = {
    labor_status: { label: 'Counted', values: {} },
    looking_for: { label: 'Looking for', values: { 'full-time': { label: 'Full-time work' }, 'part-time': { label: 'Part-time work' } } },
    statistic: { label: 'Statistic', values: Object.fromEntries(Object.values(STATS).map(v => [v.key, { label: v.label }])) },
    cps_industry: { label: 'Industry', values: {} },
    occupation: { label: 'Occupation', values: {} },
  };
  for (const v of Object.values(LFST)) if (v.status) dims.labor_status.values[v.status] = { label: v.label };
  for (const [code, text] of Object.entries(labels.indy ?? {})) dims.cps_industry.values[code] = { label: text };
  for (const [code, text] of Object.entries(labels.occupation ?? {})) dims.occupation.values[code] = { label: text };
  for (const [ln, codes] of Object.entries(CODES)) {
    for (const w of Object.values(codes)) {
      dims[w.dim] ??= { label: DIM_LABELS[w.dim] ?? w.dim, values: {} };
      dims[w.dim].values[w.key] ??= { label: w.label, ...(w.dim === 'race' && ['mexican', 'puerto-rican', 'cuban'].includes(w.key) ? { parent: 'hispanic' } : {}) };
    }
    if (!labels[ln]) continue;
  }
  for (const r of ['white', 'black', 'asian']) dims.race.values[`${r}-non-hispanic`] = { label: `${r.charAt(0).toUpperCase()}${r.slice(1)}, not Hispanic`, parent: r };
  dims.age = { label: 'Age', values: Object.fromEntries(Object.values(labels.ages ?? {}).map(t => [ageKey(t), { label: t.replace(/ years/, '').replace(' to ', '–') }])) };
  return dims;
}
const DIM_LABELS = {
  sex: 'Sex', race: 'Race and ethnicity', education: 'Education', nativity: 'Born', veteran: 'Veteran status', disability: 'Disability',
  marital: 'Marital status', worker_class: 'Class of worker', multiple_jobs: 'Multiple jobs', work_schedule: 'Part time', part_time_reason: 'Part time because of',
  wants_job: 'Wants a job', not_in_labor_force: 'Why not in the labor force', unemployment_duration: 'Unemployed for', job_search: 'Searching',
  unemployment_reason: 'Reason unemployed',
};

export const CPS_MEASURES = {
  [CPS_UNEMPLOYMENT]: { dims: ['statistic', 'looking_for', 'nativity', 'veteran', 'disability', 'marital', 'worker_class', 'cps_industry', 'occupation', 'unemployment_duration', 'job_search', 'unemployment_reason'] },
  [STATUS]: { label: 'Labor force status', dims: ['labor_status', 'sex', 'race', 'age', 'education', 'nativity', 'veteran', 'disability', 'wants_job', 'not_in_labor_force'] },
  [EMPLOYMENT]: { label: 'Employment', dims: ['statistic', 'sex', 'race', 'age', 'marital', 'worker_class', 'cps_industry', 'multiple_jobs', 'work_schedule', 'part_time_reason'] },
  [SERVICES]: { label: 'Employment in services', dims: ['cps_industry', 'sex', 'race'] },
};

/** The group a series counts, in words: "Foreign-Born Black Women Aged 20–24 with a Disability". */
function who(s, { industry, occupation, ages, notInLaborForce }) {
  // People outside the labor force, or the whole population, are not "workers".
  const people = notInLaborForce || s.lfst === '00';
  const words = Object.entries(s.codes).map(([d, v]) => CODES[d]?.[v]).filter(Boolean)
    .map(w => (people && w.noun?.startsWith('Workers') ? { ...w, noun: w.people ?? w.noun.replace(/^Workers/, 'People') } : w));
  const adj = words.filter(w => w.adj).map(w => w.adj);
  const race = words.find(w => w.race && w.key !== 'non-hispanic')?.race;
  const nonHispanic = words.some(w => w.key === 'non-hispanic');
  const sex = words.find(w => w.sex)?.sex;
  // Industry unemployment rates are for private wage and salary workers (said in the description): "Workers in Retail Trade".
  const nouned = industry && s.codes.class === '02' ? { noun: 'Workers' } : words.find(w => w.noun);
  let noun = nouned ? nouned.noun : sex ?? 'People';
  if (nouned && sex && !/^(Workers|People)( |$)/.test(nouned.noun)) noun = `${sex === 'Men' ? 'Male' : 'Female'} ${noun}`;
  if (/^(Workers|People)( |$)/.test(nouned?.noun ?? '') && sex) noun = nouned.noun.replace(/^(Workers|People)/, sex);
  const parts = [...adj, race ? `${nonHispanic ? 'Non-Hispanic ' : ''}${race}` : null, noun].filter(Boolean);
  let text = parts.join(' ');
  if (ages) text += ` ${ageWords(ages)}`;
  if (notInLaborForce) text += ' Not in the Labor Force';
  for (const w of words) if (w.after) text += ` ${w.after}`;
  if (industry) text += ` in ${industry}`;
  if (occupation) text += ` in ${occupation}`;
  for (const w of words) if (w.reason) text += w.reason.startsWith(',') ? w.reason : ` ${w.reason}`;
  return text === 'People' && !notInLaborForce ? null : text;
}

/** The CPS series, leaving out those already written by hand (`existing`, by BLS id). */
export function cpsSeries(existing = []) {
  const { series, labels, names } = read();
  const have = new Set(existing.filter(s => s.source === 'bls-bulk').map(s => s.source_id));
  const codeKey = b => `${b.lfst}|${b.periodicity}|${/Median Weeks/i.test(b.title)}|${JSON.stringify(Object.entries(b.codes).sort())}`;
  const adjusted = new Set(series.filter(b => b.seasonal === 'S').map(codeKey));
  const out = [];
  for (const b of series) {
    if (have.has(b.id)) continue;
    const lf = LFST[b.lfst];
    const sa = b.seasonal === 'S';
    const frequency = { M: 'monthly', Q: 'quarterly', A: 'annual' }[b.periodicity];
    const industry = b.codes.indy && labels.indy[b.codes.indy];
    const occupation = b.codes.occupation && labels.occupation[b.codes.occupation];
    const ages = b.codes.ages && labels.ages[b.codes.ages];
    const share = b.codes.pcts;
    const hours = b.codes.tdat === '04';
    // Ages implied by the group (education counts people 25 and over, veteran status people 18 and over) go unsaid.
    const said = ages && !(b.codes.education && b.codes.ages === '28') && !(b.codes.vets && b.codes.ages === '15') ? ages : null;
    const group = who(b, { industry: industry && industryName(b.codes.indy), occupation: occupation && occupationName(b.codes.occupation), ages: said, notInLaborForce: b.lfst === '50' });
    // BLS codes median weeks as average weeks (tdat 02); its title tells them apart.
    const stat = /^\(\w+\) Median Weeks/i.test(b.title) ? STATS['03'] : STATS[b.codes.tdat];
    let name;
    if (names[b.id]) name = names[b.id];
    else if (stat) name = `${stat.name}${group ? ` for ${group}` : ''}`;
    else if (share === '33') name = `Share of Workers in ${industryName(b.codes.indy)} Who Are ${SHARE_WHO[Object.entries(b.codes).map(([d, v]) => CODES[d]?.[v]?.key).find(k => SHARE_WHO[k])]}`;
    else if (share === '08') name = `Share of the Unemployed Out of Work ${CODES.duration[b.codes.duration].reason.replace(/^for /, 'for ')}`;
    else if (b.lfst === '50') name = group ?? lf.total;
    else if (b.lfst === '20' && group && /Workers|Jobholders|Part Time|Part-Timers|Full-Timers/.test(group)) name = `Number of ${group}`;
    else name = group ? lf.who.replace('{who}', group) : lf.total;
    // "for People in Sales Jobs" says no more than "in Sales Jobs".
    name = name.replace(' for People in ', ' in ').replace(/^Number of (Unemployed|Employed) People (in|for) /, 'Number $1 $2 ');
    // "Unadjusted" only where BLS prints the same series seasonally adjusted too.
    if (!sa && !names[b.id] && adjusted.has(codeKey(b))) name += ' (Unadjusted)';

    const measure = measureOf(b);
    const labelsOf = { measure, form: share ? 'share-of-total' : stat ? 'average' : lf.form, seasonal: sa ? 'sa' : 'nsa' };
    if (measure === CPS_UNEMPLOYMENT) labelsOf.definition = 'u3';
    if (lf.status && measure !== SERVICES && measure !== EMPLOYMENT) labelsOf.labor_status = lf.status;
    if (lf.looking) labelsOf.looking_for = lf.looking;
    for (const [d, v] of Object.entries(b.codes)) {
      const w = CODES[d]?.[v];
      if (w) labelsOf[w.dim] = w.key;
      if (d === 'tdat' && stat) labelsOf.statistic = stat.key;
    }
    if (ages) labelsOf.age = ageKey(ages);
    if (industry) labelsOf.cps_industry = b.codes.indy;
    if (occupation) labelsOf.occupation = b.codes.occupation;
    // Non-Hispanic with a race is the race's non-Hispanic group.
    if (b.codes.orig === '10' && b.codes.race) labelsOf.race = `${CODES.race[b.codes.race].key}-non-hispanic`;

    out.push({
      slug: `cps--${b.id.toLowerCase()}`, source: 'bls-bulk', source_id: b.id, frequency, file: 'ln/ln.data.1.AllData',
      category: measure === CPS_UNEMPLOYMENT ? 'unemployment' : 'labor-force',
      unit: share || (lf.form === 'rate' && !stat) ? '%' : hours ? 'hours' : stat ? 'weeks' : 'thousands',
      name,
      description: `${b.title.replace(/^\((Seas|Unadj|unadj)\)\s*/i, '')}, ${sa ? 'seasonally adjusted' : 'not seasonally adjusted'}, ${frequency}. BLS, Current Population Survey (series ${b.id})`,
      labels: labelsOf, cps: { tables: b.tables },
    });
  }
  return out;
}
