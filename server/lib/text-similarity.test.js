// node --test server/lib/text-similarity.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import { words, shingles, similarity, shingleHashes, hashSimilarity } from './text-similarity.js';

const sim = (a, b) => similarity(shingles(words(a)), shingles(words(b)));
const TEXT = 'The Secretary of Defense shall update the Critical Asset List of the Department of Defense '
  + 'to incorporate assets critical to the development of advanced technologies within 180 days.';

test('the same words score 1, ignoring case and punctuation', () => {
  assert.equal(sim(TEXT, TEXT.toUpperCase().replace(/ /g, ',  ')), 1);
});

test('a changed word lowers the score; different texts score near 0', () => {
  const s = sim(TEXT, TEXT.replace('180 days', '90 days'));
  assert.ok(s > 0.6 && s < 1, `got ${s}`);
  assert.ok(sim(TEXT, 'Congress finds that nurses provide care to all individuals across the United States of America.') < 0.05);
});

test('hashed shingles give the same scores as the shingles themselves', () => {
  const other = TEXT.replace('180 days', '90 days') + ' This Act takes effect on enactment.';
  const viaHashes = hashSimilarity(shingleHashes(words(TEXT)), shingleHashes(words(other)));
  assert.equal(viaHashes, sim(TEXT, other));
  assert.equal(hashSimilarity(shingleHashes(words(TEXT)), shingleHashes([])), null);
});

test('no text to compare gives null', () => {
  assert.equal(sim('', TEXT), null);
  assert.equal(sim('too short', 'too short'), null);
});
