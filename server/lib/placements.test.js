import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placementProblems, readPlacements, readStructures } from './placements.js';
import { MEASURES } from './series-dimensions.js';

test('every measure is placed, or left out on purpose, in every structure', () => {
  assert.deepEqual(placementProblems(readPlacements(), readStructures(), MEASURES), []);
});

const structure = { id: 's', categories: [{ id: 'a', name: 'A', children: [{ id: 'a/b', name: 'B' }] }] };
const measures = { gdp: {}, deaths: {}, sentiment: {} };

test('placements may sit at either level, or leave a measure out', () => {
  assert.deepEqual(placementProblems({ s: {
    gdp: { category: 'a/b', basis: 'table', tables: [670] },
    deaths: { category: 'a', basis: 'judgement', reason: 'No subcategory fits.' },
    sentiment: { left_out: true, reason: 'Not a subject of this scheme.' },
  } }, [structure], measures), []);
});

test('wrong placements are caught', () => {
  assert.deepEqual(placementProblems({ s: {
    gdp: { category: 'a/x', basis: 'table' },
    deaths: { category: 'a/b', basis: 'judgement' },
    unknown: { category: 'a', basis: 'guess' },
  }, other: {} }, [structure], measures), [
    's: sentiment is neither placed nor left out',
    's: gdp: unknown category a/x',
    's: gdp: table without table numbers',
    's: deaths: judgement without a reason',
    's: unknown: unknown measure',
    's: unknown: basis must be table or judgement',
    'other: unknown structure',
  ]);
});
