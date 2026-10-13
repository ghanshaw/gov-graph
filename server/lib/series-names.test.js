import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameProblems, seriesNameProblems } from './series-names.js';
import { SERIES } from './economic-series.js';

test('every series name follows the naming rules and is unique', () => {
  assert.deepEqual(seriesNameProblems(SERIES), []);
});

test('names that read as a phrase pass', () => {
  for (const name of ['Monthly Individual Income Taxes', 'Average Federal Tax Rate of the Highest Quintile', 'U.S. Crude Oil Price (WTI)',
    '30-Year Mortgage Rate', 'Unemployment Rate for Workers Aged 16–19', 'Lower End of the Fed’s Target Range', 'Daily Excise Taxes (Since 2023)']) {
    assert.deepEqual(nameProblems(name), [], name);
  }
});

test('old-style names are caught', () => {
  assert.ok(nameProblems('Total receipts (monthly)').some(p => p.includes('Title Case')));
  assert.ok(nameProblems('Total Receipts (monthly)').some(p => p.includes('how often')));
  assert.ok(nameProblems('Unemployment Rate For Women').some(p => p.includes('lower case')));
  assert.ok(nameProblems('The Fed\'s Rate').some(p => p.includes('apostrophe')));
  assert.ok(nameProblems('x'.repeat(61)).length > 0);
});

test('a name used twice is caught', () => {
  const problems = seriesNameProblems([{ slug: 'a', name: 'Prime Rate' }, { slug: 'b', name: 'Prime Rate' }]);
  assert.equal(problems.length, 1);
});
