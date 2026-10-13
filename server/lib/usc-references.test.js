import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findUscReferences, withUscReferences } from './usc-references.js';

const targets = text => findUscReferences(text).map(s => [s.text, s.target]);

test('the amending form, with and without a subsection (H.R. 10717, S. 4530)', () => {
  assert.deepEqual(targets('Section 1074c of title 10, United States Code, is amended—'), [
    ['Section 1074c of title 10, United States Code', { type: 'usc', title: '10', section: '1074c' }],
  ]);
  assert.deepEqual(targets('Civil Service Retirement System.—Section 8335(c) of title 5, United States Code, is amended by striking'), [
    ['Section 8335(c) of title 5, United States Code', { type: 'usc', title: '5', section: '8335', subsection: 'c' }],
  ]);
  assert.deepEqual(targets('under section 300h–6(b)(1)(A) of title 42, United States Code'), [
    ['section 300h–6(b)(1)(A) of title 42, United States Code', { type: 'usc', title: '42', section: '300h-6', subsection: 'b/1/A' }],
  ]);
});

test('lists of sections link each section', () => {
  assert.deepEqual(targets('sections 8335(c) and 8425(c) of title 5, United States Code, are each amended'), [
    ['8335(c)', { type: 'usc', title: '5', section: '8335', subsection: 'c' }],
    ['8425(c)', { type: 'usc', title: '5', section: '8425', subsection: 'c' }],
  ]);
  assert.deepEqual(targets('Sections 101, 102, and 103 of title 10, United States Code').map(t => t[0]), ['101', '102', '103']);
});

test('the short form written out', () => {
  assert.deepEqual(targets('the Act (42 U.S.C. 1395w–4(b)) is amended'), [
    ['42 U.S.C. 1395w–4(b)', { type: 'usc', title: '42', section: '1395w-4', subsection: 'b' }],
  ]);
});

test('no match without a title, and existing spans are kept', () => {
  assert.deepEqual(findUscReferences('section 1074c of such title is amended'), []);
  assert.deepEqual(findUscReferences('chapter 55 of title 10, United States Code'), []);
  const tagged = { text: 'Section 1074c of title 10, United States Code, and 5 U.S.C. 8335', spans: [{ start: 0, end: 13, type: 'citation' }] };
  const out = withUscReferences(tagged);
  assert.deepEqual(out.spans.map(s => s.text ?? 'kept'), ['kept', '5 U.S.C. 8335']);
  const plain = { text: 'No references here.', spans: [] };
  assert.equal(withUscReferences(plain), plain);
});
