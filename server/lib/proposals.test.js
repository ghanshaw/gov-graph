// node --test server/lib/proposals.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import { pairBills } from './proposals.js';

const bill = (id, type, number, introduced) => [id, { id, type, number, day: Date.parse(introduced) / 86_400_000 }];
const links = (...pairs) => pairs.map(([a, b]) => ({ a, b }));

test('an identical House and Senate bill are paired', () => {
  const bills = new Map([bill('hr2', 'hr', '2', '2023-05-02'), bill('s2824', 's', '2824', '2023-09-14')]);
  // Each bill's file lists the other, so the link arrives twice.
  assert.deepEqual(pairBills(bills, links(['hr2', 's2824'], ['s2824', 'hr2'])), [['hr2', 's2824']]);
});

test("a resolution re-filed each year is paired with that year's copy in the other chamber", () => {
  // Nurses Week, 119th Congress: CRS links all four resolutions to each other.
  const bills = new Map([
    bill('hres389', 'hres', '389', '2025-05-06'), bill('sres206', 'sres', '206', '2025-05-06'),
    bill('hres1264', 'hres', '1264', '2026-05-05'), bill('sres709', 'sres', '709', '2026-05-05'),
  ]);
  const all = links(['hres389', 'sres206'], ['hres389', 'sres709'], ['hres389', 'hres1264'],
    ['hres1264', 'sres206'], ['hres1264', 'sres709'], ['sres206', 'sres709']);
  assert.deepEqual(pairBills(bills, all).sort(), [['hres1264', 'sres709'], ['hres389', 'sres206']]);
});

test('identical bills in the same chamber stay apart', () => {
  const bills = new Map([bill('hconres87', 'hconres', '87', '2025-06-01'), bill('hconres88', 'hconres', '88', '2025-06-02')]);
  assert.deepEqual(pairBills(bills, links(['hconres87', 'hconres88'])), []);
});

test('a pair marked "Not identical" is not paired, and bills not loaded are ignored', () => {
  const bills = new Map([bill('hr10', 'hr', '10', '2025-01-03'), bill('s10', 's', '10', '2025-01-03')]);
  assert.deepEqual(pairBills(bills, links(['hr10', 's10']), new Set(['hr10~s10'])), []);
  assert.deepEqual(pairBills(bills, links(['hr10', 'missing'])), []);
});

test('a bill identical to two in the other chamber goes with the closer one; the other stays alone', () => {
  const bills = new Map([
    bill('s5', 's', '5', '2025-03-01'),
    bill('hr7', 'hr', '7', '2025-03-02'),
    bill('hr90', 'hr', '90', '2025-08-01'),
  ]);
  assert.deepEqual(pairBills(bills, links(['s5', 'hr7'], ['s5', 'hr90'])), [['hr7', 's5']]);
});

test('a stronger link wins over a closer date', () => {
  // S. 5 has an identical bill in the House filed months later, and a similar-text one the day after.
  const bills = new Map([
    bill('s5', 's', '5', '2025-03-01'), bill('hr7', 'hr', '7', '2025-03-02'), bill('hr90', 'hr', '90', '2025-08-01'),
  ]);
  const found = pairBills(bills, [{ a: 's5', b: 'hr7', strength: 1 }, { a: 's5', b: 'hr90', strength: 3 }]);
  assert.deepEqual(found, [['hr90', 's5']]);
});
