import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { readSources } from './sources.js';
import { readDownloads, checkDownloads, expandEntry, yearList } from './downloads.js';

const DATA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'seed', 'data');
const sources = readSources();
const downloads = readDownloads();

test('downloads.json is sound', () => {
  assert.deepEqual(checkDownloads(downloads, sources), []);
});

test('every program still to collect has an entry', () => {
  const coverage = JSON.parse(fs.readFileSync(path.join(DATA, 'statistical-abstract-coverage.json'), 'utf8'));
  const cited = new Set(Object.values(coverage.tables)
    .filter(t => t.coverage === 'wanted' || t.coverage === 'partly').flatMap(t => t.programs ?? []));
  const missing = sources.programs
    .filter(p => cited.has(p.slug) && p.collected === false && p.licence?.type !== 'licensed' && !downloads.programs[p.slug])
    .map(p => p.slug);
  assert.deepEqual(missing, []);
});

test('year patterns expand', () => {
  assert.deepEqual(yearList('2008-2010,2012'), [2008, 2009, 2010, 2012]);
  assert.deepEqual(expandEntry({ url: 'https://x/{year}/cbp{yy}us.zip', years: '2009-2010' }),
    ['https://x/2009/cbp09us.zip', 'https://x/2010/cbp10us.zip']);
  assert.deepEqual(expandEntry({ list: 'https://x/' }), []);
  assert.deepEqual(expandEntry({ catalog: 'https://x/data.json', title: 'a' }), []);
});

test('entries are checked', () => {
  const sources = { programs: [{ slug: 'p' }] };
  const check = files => checkDownloads({ programs: { p: { checked: '2026-10-18', files } } }, sources);
  assert.deepEqual(check([{ catalog: 'https://x/data.json', title: 'Enrollment' }]), []);
  assert.deepEqual(check([{ catalog: 'https://x/data.json' }]), ['p: a catalog needs title']);
  assert.deepEqual(check([{ url: 'https://x/a', list: 'https://x/' }]), ['p: an entry needs url, list or catalog']);
  assert.deepEqual(check([{ list: 'https://x/page', page: true, follow: '(' }]), ['p: bad follow (']);
});
