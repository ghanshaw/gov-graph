import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placementProblems, placementOf, readPlacements, readTaxonomies, readAbstractTables, keepIds, categoryIds } from './taxonomies.js';
import { MEASURES, seriesDimensions } from './series-dimensions.js';
import { SERIES } from './economic-series.js';

const seriesMeasure = new Map(SERIES.map(s => [s.slug, seriesDimensions(s).measure]));

test('every measure is placed, or left out on purpose, in every taxonomy; series placed apart are sound', () => {
  assert.deepEqual(placementProblems(readPlacements(), readTaxonomies(), MEASURES, seriesMeasure, readAbstractTables()), []);
});

test('every taxonomy has unique category ids', () => {
  for (const t of readTaxonomies()) {
    const all = [];
    const walk = cats => { for (const c of cats ?? []) { all.push(c.id); walk(c.children); } };
    walk(t.categories);
    assert.equal(new Set(all).size, all.length, t.id);
  }
});

const taxonomy = { id: 's', categories: [{ id: 'a', name: 'A', children: [{ id: 'a/b', name: 'B' }] }] };
const measures = { gdp: {}, deaths: {}, sentiment: {} };
const series = new Map([['real-gdp', 'gdp'], ['covid-deaths', 'deaths']]);

test('placements may sit at either level, leave a measure out, or place a series apart', () => {
  assert.deepEqual(placementProblems({ s: {
    measures: {
      gdp: { category: 'a/b', basis: 'table', tables: [670] },
      deaths: { category: 'a', basis: 'judgement', reason: 'No subcategory fits.' },
      sentiment: { left_out: true, reason: 'Not a subject of this scheme.' },
    },
    series: { 'covid-deaths': { category: 'a/b', basis: 'judgement', reason: 'An emergency, not the yearly count.' } },
  } }, [taxonomy], measures, series), []);
});

test('wrong placements are caught', () => {
  assert.deepEqual(placementProblems({ s: {
    measures: {
      gdp: { category: 'a/x', basis: 'table' },
      deaths: { category: 'a/b', basis: 'judgement' },
      unknown: { category: 'a', basis: 'guess' },
    },
    series: {
      'real-gdp': { category: 'a/y', basis: 'judgement', reason: 'Why not.' },
      'covid-deaths': { category: 'a/b', basis: 'judgement', reason: 'Same place.' },
      nowhere: { category: 'a', basis: 'judgement', reason: '?' },
    },
  }, other: {} }, [taxonomy], measures, series), [
    's: sentiment is neither placed nor left out',
    's: gdp: unknown category a/x',
    's: gdp: table without table numbers',
    's: deaths: judgement without a reason',
    's: unknown: unknown measure',
    's: unknown: basis must be table or judgement',
    's: series real-gdp: unknown category a/y',
    's: series covid-deaths: sits where its measure does',
    's: series nowhere: unknown series',
    'other: unknown taxonomy',
  ]);
});

test('a table cited as evidence must exist and be printed in that category', () => {
  const abstract = { id: 'statistical-abstract', categories: [{ id: 'a', name: 'A', children: [{ id: 'a/b', name: 'B' }, { id: 'a/c', name: 'C' }] }] };
  const tables = new Map([['670', { category: 'a/b' }], ['671', { category: 'a/c' }]]);
  assert.deepEqual(placementProblems({ 'statistical-abstract': { measures: {
    gdp: { category: 'a/b', basis: 'table', tables: [670, 671, 9999] },
    deaths: { category: 'a', basis: 'table', tables: [671] },
    sentiment: { left_out: true, reason: 'Not here.' },
  } } }, [abstract], measures, series, tables), [
    'statistical-abstract: gdp: Table 671 is printed under a/c',
    'statistical-abstract: gdp: no Table 9999',
  ]);
});

test('every Abstract table has a page and a category in the Abstract', () => {
  const abstract = readTaxonomies().find(t => t.id === 'statistical-abstract');
  const ids = categoryIds(abstract);
  const tables = [...readAbstractTables().values()];
  assert.equal(tables.length, 1406);
  assert.deepEqual(tables.filter(t => t.page == null || !ids.has(t.category)).map(t => t.id), []);
});

test('a series sits where its measure does unless placed apart', () => {
  const placements = { s: { measures: { gdp: { category: 'a' } }, series: { 'real-gdp': { category: 'a/b' } } } };
  assert.equal(placementOf(placements, 's', 'real-gdp', 'gdp').category, 'a/b');
  assert.equal(placementOf(placements, 's', 'nominal-gdp', 'gdp').category, 'a');
  assert.equal(placementOf(placements, 's', 'x', 'unplaced'), null);
});

test('a rebuilt taxonomy keeps its category ids', () => {
  const before = { id: 't', categories: [
    { id: 'housing', code: '20', name: 'Construction and Housing', children: [
      { id: 'housing/home-sales', name: 'Home sales' },
      { id: 'housing/homeownership', name: 'Homeownership' },
    ] },
    { id: 'prices', code: '14', name: 'Prices', children: [{ id: 'prices/cpi', name: 'Consumer price index' }] },
  ] };
  // The section renamed, a subsection renamed in place, one added, one dropped.
  const after = { id: 't', categories: [
    { id: 'prices', code: '14', name: 'Prices', children: [] },
    { id: 'building-and-homes', code: '20', name: 'Building and Homes', children: [
      { id: 'building-and-homes/sales-of-homes', name: 'Sales of homes' },
      { id: 'building-and-homes/homeownership', name: 'Homeownership' },
      { id: 'building-and-homes/remodeling', name: 'Remodeling' },
    ] },
  ] };
  const { taxonomy, renamed, added, removed } = keepIds(before, after);
  assert.deepEqual(taxonomy.categories.map(c => c.id), ['prices', 'housing']);
  assert.deepEqual(taxonomy.categories[1].children.map(c => c.id), ['housing/home-sales', 'housing/homeownership', 'housing/remodeling']);
  assert.deepEqual(renamed, [
    { id: 'housing', from: 'Construction and Housing', to: 'Building and Homes' },
    { id: 'housing/home-sales', from: 'Home sales', to: 'Sales of homes' },
  ]);
  assert.deepEqual(added, ['housing/remodeling']);
  assert.deepEqual(removed, ['prices/cpi']);
});

test('the taxonomy files keep their own ids when rebuilt unchanged', () => {
  for (const t of readTaxonomies()) {
    const { taxonomy, renamed, added, removed } = keepIds(t, t);
    assert.deepEqual([renamed, added, removed], [[], [], []], t.id);
    assert.deepEqual(categoryIds(taxonomy), categoryIds(t));
  }
});
