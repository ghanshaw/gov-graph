import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBillQuery, titleKind } from './bill-search.js';

test('bill numbers as they are printed', () => {
  const hr1 = { kind: 'bill', type: 'hr', number: '1' };
  for (const q of ['H.R. 1', 'H.R.1', 'HR1', 'hr 1', 'H. R. 1', 'h.r.-1', 'House Bill 1', '  H.R.  1 ']) {
    assert.deepEqual(parseBillQuery(q), hr1, q);
  }
  assert.deepEqual(parseBillQuery('H.R. 10767'), { kind: 'bill', type: 'hr', number: '10767' });
  assert.deepEqual(parseBillQuery('S. 5'), { kind: 'bill', type: 's', number: '5' });
  assert.deepEqual(parseBillQuery('S5'), { kind: 'bill', type: 's', number: '5' });
  assert.deepEqual(parseBillQuery('H.Res. 109'), { kind: 'bill', type: 'hres', number: '109' });
  assert.deepEqual(parseBillQuery('H. J. Res. 12'), { kind: 'bill', type: 'hjres', number: '12' });
  assert.deepEqual(parseBillQuery('S.J.Res.7'), { kind: 'bill', type: 'sjres', number: '7' });
  assert.deepEqual(parseBillQuery('H.Con.Res. 14'), { kind: 'bill', type: 'hconres', number: '14' });
  assert.deepEqual(parseBillQuery('sconres 3'), { kind: 'bill', type: 'sconres', number: '3' });
  assert.deepEqual(parseBillQuery('S.Res. 059'), { kind: 'bill', type: 'sres', number: '59' });
});

test('with the Congress before or after', () => {
  const hr1 = { kind: 'bill', congress: 119, type: 'hr', number: '1' };
  for (const q of ['H.R. 1 119th Congress', 'H.R. 1 (119th Congress)', 'H.R. 1, 119th', 'hr1-119', 'H.R. 1 (119)',
    '119 hr 1', '119-hr-1', '119th Congress H.R. 1', '119th H.R. 1', '119: HR 1']) {
    assert.deepEqual(parseBillQuery(q), hr1, q);
  }
  // A lone number after the type is the bill number.
  assert.deepEqual(parseBillQuery('S. 119'), { kind: 'bill', type: 's', number: '119' });
});

test('law numbers', () => {
  const pl = { kind: 'law', lawType: 'public', congress: 119, number: '21' };
  for (const q of ['Public Law 119-21', 'public law 119–21', 'P.L. 119-21', 'PL 119-21', 'Pub. L. 119-21', 'Pub. L. No. 119-21', 'P.L.119-21']) {
    assert.deepEqual(parseBillQuery(q), pl, q);
  }
  assert.deepEqual(parseBillQuery('Private Law 115-1'), { kind: 'law', lawType: 'private', congress: 115, number: '1' });
  assert.deepEqual(parseBillQuery('Pvt. L. 118-2'), { kind: 'law', lawType: 'private', congress: 118, number: '2' });
});

test('words are not identifiers', () => {
  for (const q of ['big beautiful bill act', 'Green New Deal', 'CHIPS Act of 2022', 'hr', '1', 'section 1', 'Senate 2025 budget',
    'Laken Riley Act', 'S', 'title 10', 'public law', 'ss 1', '']) {
    assert.equal(parseBillQuery(q), null, q);
  }
});

test('title kinds', () => {
  assert.equal(titleKind('Popular Titles'), 'popular');
  assert.equal(titleKind('Short Title(s) as Passed House'), 'short');
  assert.equal(titleKind('Short Titles as Enacted'), 'short');
  assert.equal(titleKind('Short Titles as Enacted for portions of this bill'), 'portion');
  assert.equal(titleKind('Other Short Titles'), 'short');
  assert.equal(titleKind('Display Title'), 'display');
  assert.equal(titleKind('Override Display Title'), 'display');
  assert.equal(titleKind('Official Title as Introduced'), 'official');
});
