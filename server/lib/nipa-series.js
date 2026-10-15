// BEA's national accounts (NIPA) tables collected for the Statistical Abstract (Phase 5,
// features/statistical-abstract): every line of each table, yearly and quarterly where BEA publishes both
// (user, 2026-10-15). The lines are kept in server/seed/data/nipa-tables.json (seed/build-nipa-tables.js,
// from BEA's registers), so the series list never depends on the data folder.
//
// Each line becomes a series of one measure, with the line itself as the value of the measure's breakdown
// (`dim`). A line of a table in chained dollars, prices or percent changes is the same breakdown value as the
// current-dollar line it restates: BEA gives them one code stem (A191RC, A191RX, A191RG, A191RL are GDP), and
// only current-dollar tables say which line sits under which. Industry tables share no stems, so they are
// lined up by label with the table named as `structure`.
//
// Names are generated from the line's label (reader's words from WORDS, then Title Case) inside the measure's
// or table's template, with the form and frequency added as NAMING.md says; BASE_NAMES overrides the label
// part by hand (user, 2026-10-15: "hand overrides but retain original names as well"). The publisher's own
// label is kept beside it as publisher_title (economic-series.js, publisherTitle). Where two generated names
// collide, each is told apart by the line it sits under ("Exports: Goods").

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MAX_NAME } from './series-names.js';

const TABLES_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'seed', 'data', 'nipa-tables.json');
// BEA's reference year for chained dollars and price indexes (2017 = 100) since the 2023 comprehensive update.
const REFERENCE_YEAR = 2017;

const GDP_SECTION = 'income-expenditures-poverty-and-wealth/gross-domestic-product-gdp';
// A table of a measure: `lines` limits it to some of its lines; `template` names its lines ({B} is the line);
// `labels` adds breakdowns every line of the table shares; `structure` lines it up by label with another table.
const T = (id, more = {}) => ({ id, ...more });
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const INDUSTRY = { structure: 'T60200D' };

// Each measure: where it sits (its key: Abstract category and name), the Abstract tables it answers, and the
// NIPA tables whose lines are its series. Listed in priority order: a series printed in several tables
// belongs to the first measure that lists it (personal consumption expenditures are GDP's second line, but
// belong to consumer spending). `dims` are breakdowns besides `dim` that its tables' `labels` use.
export const NIPA_MEASURES = [
  { key: `${GDP_SECTION}/consumer-spending`, label: 'Consumer spending', dim: 'spending_on', dimLabel: 'Spent on', template: 'Spending on {B}',
    abstract: [677, 1233], tables: [T('T20505'), T('T20506', { structure: 'T20505' }), T('T20405'), T('T20406', { structure: 'T20405' })] },
  { key: 'prices/price-indexes/consumer-prices', label: 'Consumer prices', dim: 'spending_on', dimLabel: 'Spent on', template: 'PCE Price Index for {B}',
    dims: ['price_index'], abstract: [739], tables: [T('T20504', { structure: 'T20505', labels: { price_index: 'pce' } })] },
  { key: `${GDP_SECTION}/government-consumption-and-investment`, label: 'Government consumption and investment', dim: 'government_component', dimLabel: 'Government',
    template: '{B}', abstract: [676], tables: [T('T30905'), T('T30906', { structure: 'T30905' })] },
  { key: 'business-enterprise/investment-capital-expenditures/domestic-investment', label: 'Domestic investment', dim: 'investment_component', dimLabel: 'Investment',
    template: '{B}', abstract: [782], tables: [T('T50205'), T('T50206', { structure: 'T50205' })] },
  { key: `${GDP_SECTION}/gdp`, label: 'GDP', dim: 'gdp_component', dimLabel: 'Part of GDP', template: '{B}',
    abstract: [667, 668, 669],
    tables: [T('T10105'), T('T10106', { structure: 'T10105' }), T('T10101', { structure: 'T10105' }), T('T10205', { template: 'GDP from {B}' }), T('T10206', { structure: 'T10205', template: 'GDP from {B}' }),
      T('T10305', { template: 'Value Added by {B}' }), T('T10306', { structure: 'T10305', template: 'Value Added by {B}' })] },
  { key: 'prices/price-indexes/gdp-prices', label: 'GDP prices', dim: 'gdp_component', dimLabel: 'Part of GDP', template: '{B}',
    abstract: [740], tables: [T('T10104', { structure: 'T10105' })] },
  { key: 'income-expenditures-poverty-and-wealth/personal-income/personal-income', label: 'Personal income', dim: 'income_component', dimLabel: 'Income',
    template: '{B}', abstract: [678], tables: [T('T20100')] },
  { key: 'business-enterprise/profits/corporate-profits', label: 'Corporate profits', dim: 'profits_component', dimLabel: 'Profits', template: '{B}',
    abstract: [791, 792, 793],
    tables: [T('T11200', { lines: [...range(13, 17), ...range(26, 29), ...range(41, 49)] }),
      T('T61600D', { template: 'Corporate Profits in {B}' }), T('T61700D', { template: 'Pretax Corporate Profits in {B}' })] },
  { key: `${GDP_SECTION}/national-income`, label: 'National income', dim: 'national_income_component', dimLabel: 'Income', template: '{B}',
    abstract: [673], tables: [T('T10705'), T('T11200')] },
  { key: `${GDP_SECTION}/income-and-output-per-person`, label: 'Income and output per person', dim: 'per_person', dimLabel: 'Of', template: '{B}',
    abstract: [679], tables: [T('T70100')] },
  { key: `${GDP_SECTION}/saving-and-investment`, label: 'Saving and investment', dim: 'saving_component', dimLabel: 'Saving or investment', template: '{B}',
    abstract: [674], tables: [T('T50100')] },
  { key: 'state-and-local-government-finances-and-employment/receipts-expenditures-investment/state-and-local-government-budgets',
    label: 'State and local government budgets', dim: 'state_local_component', dimLabel: 'Receipts or spending', template: '{B}',
    abstract: [430], tables: [T('T30300')] },
  { key: 'agriculture/farm-income-and-balance-sheet/farm-output-and-value-added', label: 'Farm output and value added', dim: 'farm_component', dimLabel: 'Farm accounts',
    template: '{B}', abstract: [840], tables: [T('T70305'), T('T70306', { structure: 'T70305' })] },
  { key: 'labor-force-employment-and-earnings/compensation-wages-and-earnings/pay-by-industry', label: 'Pay by industry', dim: 'industry', dimLabel: 'Industry',
    dims: ['pay'], abstract: [643, 1017], template: '{B}',
    tables: [T('T60200D', { ...INDUSTRY, template: 'Employee Compensation in {B}', labels: { pay: 'compensation' } }),
      T('T60300D', { ...INDUSTRY, template: 'Wages and Salaries in {B}', labels: { pay: 'wages' } }),
      T('T60600D', { ...INDUSTRY, template: 'Average Wage in {B}', labels: { pay: 'wages' }, kind: 'per-employee' })] },
  { key: 'labor-force-employment-and-earnings/compensation-wages-and-earnings/full-time-equivalent-employees', label: 'Full-time equivalent employees',
    dim: 'industry', dimLabel: 'Industry', abstract: [1017], template: '{B}',
    tables: [T('T60500D', { ...INDUSTRY, template: 'Full-Time Equivalent Workers in {B}' })] },
];

/** A NIPA table as collected: its title and the codes of its lines (for coverage's `nipa:T20100`). */
export function nipaTable(id) {
  const t = readTables()[id];
  return t ? { title: t.title, codes: new Set(t.lines.map(l => l.code)) } : null;
}

export const NIPA_TABLE_IDS = [...new Set(NIPA_MEASURES.flatMap(m => m.tables.map(t => t.id)))];

// Breakdowns used by tables' `labels`, with their values.
export const NIPA_EXTRA_DIMENSIONS = {
  pay: { label: 'Pay', values: { compensation: { label: 'Compensation (wages and benefits)' }, wages: { label: 'Wages and salaries', parent: 'compensation' } } },
};

// The reader's words for BEA's (NAMING.md rule 3), applied to a line's label before Title Case.
const WORDS = [
  [/^(Less|Equals|Plus): /, ''],
  [/\s*\((\d+\+?)+\)$/, ''], // "(17+89)": the line numbers BEA adds up
  [/\s*\([A-Z]\d+\)$/, ''], // "(G311)": the function code
  [/\s*\((?:Parts? of |\d)[^)]*\)/gi, ''], // "(Parts of 31 and 32)", "(1 - 2 - 31)": other lines of the table
  [/\s*\(GNLB\)$/, ''],
  [/^Net lending \(\+\)\/Net borrowing \(-\)/i, 'Net lending or borrowing'],
  [/\s+\\\d+\\?$/, ''],
  [/, (current dollars|billions of chained \(\d+\) dollars)$/i, ''],
  [/ with inventory valuation and capital consumption adjustments?/i, ''],
  [/ with capital consumption adjustment/i, ''],
  [/^Gross domestic product/i, 'GDP'],
  [/^Gross national product/i, 'GNP'],
  [/Personal consumption expenditures/i, 'consumer spending'],
  [/^Personal current taxes$/i, 'personal income taxes'],
  [/ purchased for off-premises consumption/i, ' bought in stores'],
];

// Hand-written names for lines (server/seed/data/nipa-names.json), by code stem: the part that stands for the line
// ({B} in the template), written once for the line in dollars, chained dollars, prices and percent changes.
const NAMES_FILE = path.join(path.dirname(TABLES_FILE), 'nipa-names.json');
let names = null;
const baseName = code => (names ??= JSON.parse(fs.readFileSync(NAMES_FILE, 'utf8')).names)[lineKey(code)];

// ---------------------------------------------------------------------------

const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'of', 'on', 'or', 'the', 'per', 'to', 'with']);
const KEEP = new Set(['GDP', 'GNP', 'PCE', 'U.S.', 'IVA', 'CCAdj', 'NIPAs']);
/** "Food and beverages purchased for off-premises consumption" → "Food and Beverages Purchased for Off-Premises Consumption". */
export function titleCase(text) {
  return text.replace(/'/g, '’').split(' ').map((word, i) => {
    if (KEEP.has(word.replace(/[(),:]/g, ''))) return word;
    const lower = word.toLowerCase();
    if (i > 0 && SMALL.has(lower)) return lower;
    return word.split('-').map(part => part.replace(/^([("“]*)([a-z])/, (_, open, ch) => open + ch.toUpperCase())).join('-');
  }).join(' ');
}

// The label as BEA prints it, without "Less:" and the line numbers it adds up.
const printedLabel = label => label.replace(/^(Less|Equals|Plus): /, '').replace(/\s*\((\d+\+?)+\)$/, '').trim();
const sentence = text => text.charAt(0).toUpperCase() + text.slice(1);
export const cleanLabel = label => WORDS.reduce((text, [from, to]) => text.replace(from, to), label.trim()).trim();
const stem = code => code.slice(0, -1);
// A line's key: the stem of a code in BEA's usual pattern (A191RC → a191r, shared by A191RX, A191RG, A191RL), else
// the whole code (LA0000351C and LA0000352C share their first characters but are two lines).
export const lineKey = code => (/^[A-Z0-9]{4}R[A-Z]$/.test(code) ? stem(code) : code).toLowerCase();
const tableNumber = title => /^Table ([\d.]+[A-Z]?)\./.exec(title)?.[1];

let cache = null;
function readTables() {
  cache ??= JSON.parse(fs.readFileSync(TABLES_FILE, 'utf8')).tables;
  return cache;
}

/** How a line is measured, from BEA's metric and calculation type. */
function lineKind(line, table) {
  if (table.kind) return table.kind;
  if (line.calc !== 'Level') return line.metric === 'Current Dollars' ? 'growth' : 'real-growth';
  if (line.metric === 'Current Dollars') return 'level';
  if (line.metric === 'Chained Dollars') return 'real';
  if (line.metric === 'Fisher Price Index') return 'index';
  if (line.metric === 'Persons') return 'count';
  if (line.metric === 'Current Dollar Shares' || /percentage/i.test(line.label)) return 'share';
  if (line.metric === 'Ratio') return line.code.endsWith('X') ? 'real-per-person' : 'per-person';
  throw new Error(`${line.code}: unknown metric ${line.metric} / ${line.calc}`);
}

const SHARE_FORM = [[/disposable personal income/i, 'share-of-income'], [/gross national income/i, 'share-of-national-income'], [/GDP|gross domestic product/i, 'share-of-gdp']];
const KINDS = {
  level: { unit: '$m', form: 'level', saar: true, words: 'in millions of dollars' },
  real: { unit: '$m', form: 'level', real: true, saar: true, name: 'Inflation-Adjusted {N}', words: `in millions of chained (${REFERENCE_YEAR}) dollars` },
  index: { unit: 'index', form: 'index', name: 'Price Index for {N}', words: `price index, ${REFERENCE_YEAR} = 100` },
  growth: { unit: '%', form: 'growth-rate', saar: true, name: '{N} Growth Rate', words: 'percent change from the preceding period' },
  'real-growth': { unit: '%', form: 'growth-rate', real: true, saar: true, name: '{N} Growth Rate (Adjusted for Inflation)', words: 'percent change from the preceding period in chained dollars' },
  count: { unit: 'thousands', form: 'level', words: 'in thousands' },
  share: { unit: '%', words: 'percent' },
  'per-person': { unit: '$', form: 'per-person', saar: true, name: '{N} per Person', words: 'in dollars per person' },
  'real-per-person': { unit: '$', form: 'per-person', real: true, saar: true, name: 'Inflation-Adjusted {N} per Person', words: `in chained (${REFERENCE_YEAR}) dollars per person` },
  'per-employee': { unit: '$', form: 'per-employee', words: 'in dollars per full-time equivalent employee' },
};

/**
 * The lines of a table that has no structure of its own, lined up with `ref` by label in order: line i is the
 * next line of `ref` printed with the same label. Lines with no match stand alone.
 */
function alignByLabel(lines, ref) {
  const anchors = new Map();
  let at = 0;
  for (const line of lines) {
    const j = ref.findIndex((r, k) => k >= at && cleanLabel(r.label).toLowerCase() === cleanLabel(line.label).toLowerCase());
    if (j >= 0) { anchors.set(line.code, ref[j]); at = j + 1; } else anchors.set(line.code, line);
  }
  return anchors;
}

/**
 * The NIPA series, given the hand-written series (`existing`): a line whose code and frequency is already one
 * of them is left to it; a line whose code is one of them at another frequency becomes its `twin_of`, labelled
 * and named as that series. Returns { series, dimensions } (breakdown values by dimension).
 */
export function nipaSeries(existing = []) {
  const tables = readTables();
  const existingBea = new Map();
  for (const s of existing) if (s.source === 'bea') existingBea.set(`${s.source_id}|${s.frequency}`, s);
  const existingCodes = new Map(existing.filter(s => s.source === 'bea').map(s => [s.source_id, s]));

  // Lines with structure: every line of a current-dollar table that says what it sits under.
  const structured = new Map();
  for (const [id, t] of Object.entries(tables)) {
    if (!t.lines.some(l => l.parent)) continue;
    for (const l of t.lines) if (!structured.has(l.code)) structured.set(l.code, { ...l, table: id });
  }

  const claimed = new Set();
  const rows = [];
  for (const m of NIPA_MEASURES) {
    for (const spec of m.tables) {
      const t = tables[spec.id];
      if (!t) throw new Error(`${spec.id} is not in nipa-tables.json; run build-nipa-tables.js`);
      const aligned = spec.structure && spec.structure !== spec.id ? alignByLabel(t.lines, tables[spec.structure].lines) : null;
      for (const line of t.lines) {
        if (spec.lines && !spec.lines.includes(line.line)) continue;
        if (claimed.has(line.code)) continue;
        claimed.add(line.code);
        // A table with structure of its own is its own anchor; otherwise the current-dollar line of the same stem, else the
        // line of `structure` printed with the same label at the same place.
        const own = t.lines.some(l => l.parent) && !spec.structure;
        const byStem = !own && /^[A-Z0-9]{4}R[A-Z]$/.test(line.code) ? structured.get(`${stem(line.code)}C`) : null;
        const byLabel = aligned?.get(line.code);
        const anchor = own ? line : byStem ?? (byLabel && byLabel !== line ? byLabel : line);
        rows.push({ m, spec, table: t, line, anchor });
      }
    }
  }

  // Breakdown values: one per anchor line, under its anchor's parent where that is a value too.
  const dimensions = {};
  const valueOf = (m, anchor) => `${m.dim}:${lineKey(anchor.code)}`;
  for (const { m, anchor } of rows) {
    const values = (dimensions[m.dim] ??= { label: m.dimLabel, values: {} }).values;
    values[lineKey(anchor.code)] ??= { label: sentence(cleanLabel(anchor.label)), anchor };
  }
  for (const d of Object.values(dimensions)) {
    for (const v of Object.values(d.values)) {
      const parent = v.anchor.parent && lineKey(v.anchor.parent);
      if (parent && d.values[parent]) v.parent = parent;
    }
  }
  for (const d of Object.values(dimensions)) for (const v of Object.values(d.values)) delete v.anchor;

  const series = [];
  const lineByCode = new Map(rows.map(r => [r.line.code, r]));
  for (const r of rows) {
    const { m, spec, table, line, anchor } = r;
    const kind = lineKind(line, spec);
    const k = KINDS[kind];
    const form = k.form ?? SHARE_FORM.find(([re]) => re.test(line.label))?.[1];
    if (!form) throw new Error(`${line.code}: no form for "${line.label}"`);
    const frequencies = [...line.files].map(f => (f === 'A' ? 'annual' : 'quarterly'));
    const number = tableNumber(table.title);
    for (const frequency of frequencies) {
      if (existingBea.has(`${line.code}|${frequency}`)) continue;
      const quarterly = frequency === 'quarterly';
      const parentLine = line.parent && lineByCode.get(line.parent)?.line;
      const twin = existingCodes.get(line.code);
      // GovGraph's description: where the line is printed, and how it is measured.
      const description = `Line ${line.line} of NIPA Table ${number}, “${printedLabel(line.label)}”`
        + (parentLine ? ` (under “${printedLabel(parentLine.label)}”)` : '')
        // A twin of a series kept in billions is kept in billions too (economic-series.js, readBea).
        + `: ${twin?.unit === '$bn' ? k.words.replace('millions', 'billions') : k.words}${quarterly ? (k.saar ? ', seasonally adjusted at annual rates' : ', seasonally adjusted') : ', by calendar year'}. BEA, National Income and Product Accounts`;
      const s = {
        slug: `nipa-${line.code.toLowerCase()}-${quarterly ? 'quarterly' : 'yearly'}`,
        source: 'bea', source_id: line.code, frequency, category: 'national-accounts', unit: twin?.unit ?? k.unit,
        description, nipa: { table: spec.id, number, line: line.line, measure: m.key },
      };
      if (twin) {
        s.twin_of = twin.slug;
        s.twinName = twin.name;
        s.category = twin.category;
      } else {
        s.labels = {
          measure: m.key, form, [m.dim]: lineKey(anchor.code), ...(spec.labels ?? {}),
          ...(k.real ? { adjustment: 'real' } : {}),
          ...(quarterly ? { seasonal: k.saar ? 'saar' : 'sa' } : {}),
        };
      }
      const parent = anchor.parent && (structured.get(anchor.parent) ?? lineByCode.get(anchor.parent)?.line);
      s.draft = {
        base: baseName(anchor.code), label: cleanLabel(line.label), template: spec.template ?? m.template, kind,
        twinName: s.twinName, top: anchor.line === 1, parent: parent ? (baseName(parent.code) ?? titleCase(cleanLabel(parent.label))) : null, table: spec.id,
      };
      series.push(s);
    }
  }
  return { series, dimensions, valueOf };
}

/**
 * Names for the NIPA series (NAMING.md): the line's words in its template, then its form, then how often
 * when BEA prints it both ways. Names that collide are told apart by their parent line, then their table.
 */
export function nameNipaSeries(series, takenNames = new Set()) {
  const byCode = new Map();
  for (const s of series) byCode.set(s.source_id, [...(byCode.get(s.source_id) ?? []), s]);
  const lineName = (s, qualify) => {
    const { base, label, template, top, parent, table } = s.draft;
    if (base?.name) return base.name;
    let b = base ?? titleCase(label);
    if (qualify >= 1 && parent) b = `${parent}: ${b}`;
    if (qualify >= 2) b = `${b} (Table ${table.replace(/^T/, '')})`;
    return top ? b : template.replace('{B}', b);
  };
  const full = (s, qualify) => {
    // A twin is named as the hand-written series it pairs with, with its own frequency.
    if (s.twin_of) {
      const core = s.draft.twinName.replace(/^(Monthly|Quarterly) /, '').replace(/ \((Annualized|BEA)\)$/, '');
      if (s.frequency === 'annual') return takenNames.has(`Yearly ${core}`) || s.category === 'trade' ? `Yearly ${core} (BEA)` : `Yearly ${core}`;
      return `Quarterly ${core}${/\(Annualized\)$/.test(s.draft.twinName) ? ' (Annualized)' : ''}`;
    }
    const k = KINDS[s.draft.kind];
    const line = lineName(s, qualify);
    let n = (/Price Index/.test(line) ? '{N}' : k.name ?? '{N}').replace('{N}', line);
    const both = (byCode.get(s.source_id) ?? []).length > 1 || s.twin_of;
    if (both) n = s.frequency === 'quarterly' ? `Quarterly ${n}${k.saar && !/\(Adjusted for Inflation\)$/.test(n) && k.form !== 'per-person' ? ' (Annualized)' : ''}` : `Yearly ${n}`;
    // Too long, at either frequency: "Real" for "Inflation-Adjusted" and "Real Growth Rate" for "Growth Rate (Adjusted for Inflation)".
    if (n.length > MAX_NAME) shortened.add(s.source_id);
    if (shortened.has(s.source_id)) n = n.replace('Inflation-Adjusted ', 'Real ').replace(' Growth Rate (Adjusted for Inflation)', ' Real Growth Rate');
    return n;
  };
  const shortened = new Set();
  for (const s of series) full(s, 0);
  const level = new Map(series.map(s => [s.slug, 0]));
  for (let round = 0; round < 3; round++) {
    const seen = new Map();
    for (const s of series) {
      const n = full(s, level.get(s.slug));
      seen.set(n, [...(seen.get(n) ?? []), s]);
    }
    let clashes = 0;
    for (const [n, list] of seen) {
      if (list.length > 1 || takenNames.has(n)) { for (const s of list) level.set(s.slug, level.get(s.slug) + 1); clashes++; }
    }
    if (!clashes) break;
  }
  for (const s of series) {
    s.name = full(s, level.get(s.slug));
    delete s.draft;
    delete s.twinName;
  }
  return series;
}
