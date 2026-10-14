import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readCoverage, readAbstractTables, checkCoverage, tablesByProgram } from './abstract-coverage.js';
import { readSources } from './sources.js';

const coverage = readCoverage();
const tables = readAbstractTables();
const { programs } = readSources();

test('the coverage file is sound', () => {
  assert.deepEqual(checkCoverage(coverage, tables, programs), []);
});

test('a program cited by a covered table is not marked outside the Abstract', () => {
  const outside = [...tablesByProgram(coverage).keys()].filter(slug => programs.find(p => p.slug === slug).in_abstract === false);
  assert.deepEqual(outside, []);
});

test('the checks catch what they should', () => {
  const t = [{ id: '1', section: 1 }, { id: '2', section: 1 }];
  const p = [{ slug: 'a' }, { slug: 'l', licence: { type: 'licensed' }, collected: false }];
  const problems = checkCoverage({ sections: [1], tables: {
    1: { programs: ['l'], coverage: 'wanted', shape: 'by-place' },
    9: { programs: ['a'], coverage: 'have', shape: 'time-series' },
  } }, t, p);
  assert.deepEqual(problems, [
    'table 2: section 1 is done, but the table is not covered',
    'table 1: coverage licensed only for a licensed program',
    'table 9: no such table',
  ]);
});
