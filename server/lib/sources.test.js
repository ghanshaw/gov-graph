import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SERIES, seriesFile } from './economic-series.js';
import { readSources, checkSources, pathMatcher, seriesMatcher, dataPath, urlFromPath } from './sources.js';

const sources = readSources();

test('sources.json is sound', () => {
  assert.deepEqual(checkSources(sources), []);
});

test('every economic series belongs to a dataset', () => {
  const datasetOf = seriesMatcher(sources.datasets);
  const missing = SERIES.filter(s => !datasetOf(s)).map(s => `${s.slug} (${dataPath(seriesFile(s))})`);
  assert.deepEqual(missing, []);
});

test('demographic series belong to a dataset by their source', () => {
  const datasetOf = seriesMatcher(sources.datasets);
  // The sources lib/population/series.js gives its series.
  for (const source of ['census-popest', 'census-decennial', 'census-apportionment', 'census-acs']) {
    assert.ok(datasetOf({ slug: `x--ca`, source }), source);
  }
});

test('the longest matching path wins', () => {
  const match = pathMatcher(sources.datasets);
  assert.equal(match('www2.census.gov/programs-surveys/decennial/2020/data/apportionment/x.xlsx'), 'census-decennial');
  assert.equal(match('www2.census.gov/programs-surveys/decennial/tables/time-series/historical-income-states/x.xls'), 'census-historical-income-tables');
  assert.equal(match('api.bls.gov/publicAPI/timeseries/data/LNS14000000-monthly.json'), 'bls-current-population-survey');
  assert.equal(match('nowhere.example/x'), null);
});

test('series in each dataset are where expected', () => {
  const datasetOf = seriesMatcher(sources.datasets);
  const of = slug => datasetOf(SERIES.find(s => s.slug === slug));
  assert.equal(of('wti-spot'), 'eia-petroleum');
  assert.equal(of('unemployment-rate'), 'bls-current-population-survey');
});

test('a URL is guessed from a mirrored path', () => {
  assert.equal(urlFromPath('census.gov/housing/hvs/data/histtab14.xlsx'), 'https://www.census.gov/housing/hvs/data/histtab14.xlsx');
  assert.equal(urlFromPath('govinfo/bulkdata/BILLS/119/1/hr/BILLS-119-1-hr.zip'), 'https://www.govinfo.gov/bulkdata/BILLS/119/1/hr/BILLS-119-1-hr.zip');
  assert.equal(urlFromPath('download.bls.gov/pub/time.series/ln/ln.series'), 'https://download.bls.gov/pub/time.series/ln/ln.series');
});
