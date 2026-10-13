import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIMENSIONS, dimensionProblems, sameDimensions, seriesDimensions } from './series-dimensions.js';
import { SERIES } from './economic-series.js';

test('every series is labelled with known values its measure allows', () => {
  assert.deepEqual(dimensionProblems(SERIES), []);
});

test('series that share every dimension are only the daily Treasury lines split by years', () => {
  assert.deepEqual(sameDimensions(SERIES), [
    ['dts-refunds-individual', 'dts-old-refunds-individual'],
    ['dts-refunds-business', 'dts-old-refunds-business'],
    ['dts-withheld', 'dts-iv-withheld'],
    ['dts-corporate', 'dts-iv-corporate'],
    ['dts-excise', 'dts-iv-excise'],
    ['dts-irs-estate-gift-misc', 'dts-iv-estate-gift'],
    ['dts-futa', 'dts-iv-futa'],
    ['dts-railroad', 'dts-iv-railroad'],
    ['dts-customs', 'dts-customs-dhs', 'dts-customs-old'],
  ]);
});

test('a parent value is a value of the same dimension', () => {
  for (const [dim, { values }] of Object.entries(DIMENSIONS)) {
    for (const [value, { parent }] of Object.entries(values)) if (parent) assert.ok(values[parent], `${dim}.${value} → ${parent}`);
  }
});

test('frequency, year and publisher are read from the series', () => {
  const omb = seriesDimensions(SERIES.find(s => s.slug === 'omb-receipts-gdp'));
  assert.deepEqual([omb.frequency, omb.year, omb.publisher, omb.form], ['yearly', 'fiscal', 'omb', 'share-of-gdp']);
  const demand = seriesDimensions(SERIES.find(s => s.slug === 'demand-total-4wk'));
  assert.equal(demand.frequency, 'four-week');
  const group = seriesDimensions(SERIES.find(s => s.slug === 'unemployment-rate--black-women'));
  assert.deepEqual([group.measure, group.form, group.race, group.sex], ['unemployment', 'rate', 'black', 'women']);
});

test('a mislabelled series is caught', () => {
  const problems = dimensionProblems([{ slug: 'unemployment-rate', unit: '$', frequency: 'monthly', source: 'bls' }]);
  assert.ok(problems.some(p => p.includes('form rate but unit $')));
  assert.ok(problems.some(p => p.includes('labelled but not a series')));
});
