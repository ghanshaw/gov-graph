import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placementProblems, readPlacements, readTaxonomies, readAbstractTables, keepIds, categoryIds } from './taxonomies.js';
import { MEASURES } from './series-dimensions.js';

test('every measure is placed, or left out on purpose, in every taxonomy, once in each Abstract subsection by name', () => {
  assert.deepEqual(placementProblems(readPlacements(), readTaxonomies(), MEASURES, readAbstractTables()), []);
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
const measures = { gdp: { label: 'GDP' }, deaths: { label: 'Deaths' }, sentiment: { label: 'Sentiment' } }; // keys checked only in the Abstract

test('placements may sit at either level, or leave a measure out', () => {
  assert.deepEqual(placementProblems({ s: { measures: {
    gdp: { category: 'a/b', basis: 'table', tables: [670] },
    deaths: { category: 'a', basis: 'judgement', reason: 'No subcategory fits.' },
    sentiment: { left_out: true, reason: 'Not a subject of this scheme.' },
  } } }, [taxonomy], measures), []);
});

test('wrong placements are caught', () => {
  assert.deepEqual(placementProblems({ s: { measures: {
    gdp: { category: 'a/x', basis: 'table' },
    deaths: { category: 'a/b', basis: 'judgement' },
    unknown: { category: 'a', basis: 'guess' },
  } }, other: {} }, [taxonomy], measures), [
    's: sentiment is neither placed nor left out',
    's: gdp: unknown category a/x',
    's: gdp: table without table numbers',
    's: deaths: judgement without a reason',
    's: unknown: unknown measure',
    's: unknown: basis must be table or judgement',
    'other: unknown taxonomy',
  ]);
});

test('a measure is a name in a place: its key is its Abstract category and its name', () => {
  const abstract = { ...taxonomy, id: 'statistical-abstract' };
  const twins = { 'a/consumer-prices': { label: 'Consumer prices' }, 'a/b/consumer-prices': { label: 'Consumer prices' } };
  const placed = (x, y) => ({ measures: {
    'a/consumer-prices': { category: x, basis: 'judgement', reason: '.' },
    'a/b/consumer-prices': { category: y, basis: 'judgement', reason: '.' },
  } });
  assert.deepEqual(placementProblems({ 'statistical-abstract': placed('a', 'a/b') }, [abstract], twins), []);
  assert.deepEqual(placementProblems({ 'statistical-abstract': placed('a/b', 'a/b') }, [abstract], twins), [
    'statistical-abstract: a/consumer-prices: its key should be a/b/consumer-prices',
    'statistical-abstract: a/consumer-prices and a/b/consumer-prices are both "Consumer prices" in a/b',
  ]);
  assert.deepEqual(placementProblems({ s: placed('a/b', 'a/b') }, [taxonomy], twins), []); // elsewhere: shown as one
});

test('a table cited as evidence must exist and be printed in that category', () => {
  const abstract = { id: 'statistical-abstract', categories: [{ id: 'a', name: 'A', children: [{ id: 'a/b', name: 'B' }, { id: 'a/c', name: 'C' }] }] };
  const tables = new Map([['670', { category: 'a/b' }], ['671', { category: 'a/c' }]]);
  const keyed = { 'a/b/gdp': { label: 'GDP' }, 'a/deaths': { label: 'Deaths' } };
  assert.deepEqual(placementProblems({ 'statistical-abstract': { measures: {
    'a/b/gdp': { category: 'a/b', basis: 'table', tables: [670, 671, 9999] },
    'a/deaths': { category: 'a', basis: 'table', tables: [671] },
  } } }, [abstract], keyed, tables), [
    'statistical-abstract: a/b/gdp: Table 671 is printed under a/c',
    'statistical-abstract: a/b/gdp: no Table 9999',
  ]);
});

test('every Abstract table has a page and a category in the Abstract', () => {
  const abstract = readTaxonomies().find(t => t.id === 'statistical-abstract');
  const ids = categoryIds(abstract);
  const tables = [...readAbstractTables().values()];
  assert.equal(tables.length, 1406);
  assert.deepEqual(tables.filter(t => t.page == null || !ids.has(t.category)).map(t => t.id), []);
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
