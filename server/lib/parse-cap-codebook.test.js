// The CAP codebook page as fetched on 2026-10-13 (references/cap-master-codebook.html; CC BY-NC-SA 4.0).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { parseCapCodebook } from './parse-cap-codebook.js';

const html = fs.readFileSync(new URL('../references/cap-master-codebook.html', import.meta.url), 'utf8');
const { version, date, topics } = parseCapCodebook(html);
const sub = code => topics.flatMap(t => t.children).find(s => s.code === code);

test('version and date', () => {
  assert.equal(version, '1.1');
  assert.equal(date, 'August 9, 2022');
});

test('21 major topics, codes 1–23 without 11 and 22, and every subtopic', () => {
  assert.equal(topics.length, 21);
  assert.deepEqual(topics.map(t => t.code), ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '23']);
  assert.equal(topics.reduce((n, t) => n + t.children.length, 0), 213);
  for (const t of topics) for (const s of t.children) assert.ok(s.code.startsWith(t.code) && s.code.length === t.code.length + 2, s.code);
});

test('subtopics with their descriptions, see also and notes', () => {
  assert.deepEqual(sub('101'), { id: '101', code: '101', name: 'Interest Rates', description: 'Includes issues related to inflation, cost of living, prices, and interest rates.' });
  assert.equal(sub('103').see_also, '502 training and retraining; 503 unemployment benefits.');
  assert.match(sub('107').note, /^Specific tax changes should be coded based upon the substantive area/);
  assert.ok(topics.flatMap(t => t.children).every(s => s.description), 'every subtopic has a description');
});

test('the page\'s two irregular entries', () => {
  assert.equal(sub('1612').description, 'Issues related to military reserves and reserve affairs.'); // "Description;"
  assert.equal(sub('2300').description, 'Includes issues related to general cultural policy issues.'); // in a nested list
});
