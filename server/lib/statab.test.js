import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { parseSectionPage, parseIndexPage, readTableFile } from './statab.js';

const REF = new URL('../references/', import.meta.url);
const ref = name => new URL(name, REF).pathname;

test('a section page: groups in book order, tables under them', () => {
  const s = parseSectionPage(fs.readFileSync(ref('statab-construction-housing.html'), 'utf8'));
  assert.equal(s.number, 20);
  assert.equal(s.name, 'Construction and Housing');
  assert.deepEqual(s.groups.map(x => x.name), [
    'Construction Industry', 'Construction Indices And Value', 'Authorizations, Starts And Completions', 'Housing Sales',
    'Housing Units And Characteristics', 'Homeownership And Housing Costs', 'Housing And Neighborhood Quality', 'Commercial Offices',
  ]);
  assert.deepEqual(s.groups.map(x => x.position), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(s.groups.reduce((n, x) => n + x.tables.length, 0), 44);
  const sales = s.groups.find(x => x.name === 'Housing Sales');
  assert.deepEqual(sales.tables.find(t => t.number === 973), {
    number: 973, suffix: '', title: 'Price Indexes of New One-Family Houses Sold, by Region',
    url: 'https://www2.census.gov/library/publications/2011/compendia/statab/131ed/tables/12s0973.xls',
  });
  assert.ok(s.files.some(f => f.endsWith('/tables/construct.pdf')));
});

test('the index page: sections and other pages apart', () => {
  const html = '<a href="/library/publications/2011/compendia/statab/131ed/prices.html">Prices</a>'
    + '<a href="/library/publications/2011/compendia/statab/131ed/rankings.html">Rankings</a>'
    + '<a href="//www2.census.gov/library/publications/2011/compendia/statab/131ed/tables/app3.pdf">III</a>';
  assert.deepEqual(parseIndexPage(html), {
    sections: ['prices'], others: ['rankings'],
    files: ['https://www2.census.gov/library/publications/2011/compendia/statab/131ed/tables/app3.pdf'],
  });
});

test('a table file: title, headnote, heads, row labels, foot', () => {
  const t = readTableFile(ref('statab-12s0014.xls'));
  assert.equal(t.number, 14);
  assert.equal(t.title, 'State Population - Rank, Percent Change, and Population Density');
  assert.match(t.headnote, /^As of April 1\. /);
  assert.equal(t.columnHeads.length, 2);
  assert.equal(t.columnHeads[0][0], 'State');
  assert.deepEqual(t.stub.slice(0, 2), [{ label: 'United States', depth: 0 }, { label: 'Alabama', depth: 0 }]);
  assert.deepEqual(t.symbols, ['X Not applicable.', 'Z Less than 0.05 percent.']);
  assert.equal(t.footnotes.length, 2);
  assert.match(t.footnotes[0], /^1 Beginning 1970/);
  assert.match(t.source, /^U\.S\. Census Bureau, Current Population Reports, P25-1106/);
  assert.equal(t.moreInfo.length, 3);
  assert.equal(t.released, '09/30/2011');
  assert.deepEqual(t.years, [1960, 2010]);
  assert.equal(t.byState, true);
});

test('a table file: nested row labels, no footnotes', () => {
  const t = readTableFile(ref('statab-12s0035.xls'));
  assert.equal(t.number, 35);
  assert.deepEqual(t.stub.slice(0, 4).map(s => [s.label, s.depth]), [['Total', 0], ['In households', 0], ['In family households', 1], ['Householder', 2]]);
  assert.deepEqual(t.footnotes, []);
  assert.match(t.source, /2009 American Community Survey, B09017/);
  assert.deepEqual(t.years, [2009, 2009]);
});
