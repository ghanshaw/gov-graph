// node --test server/lib/parse-legislators.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLegislator, mergePeople } from './parse-legislators.js';

const KILEY = {
  id: { bioguide: 'K000401', fec: ['H2CA03157'], govtrack: 456881, wikidata: 'Q27987136' },
  name: { first: 'Kevin', middle: 'Patrick', last: 'Kiley', official_full: 'Kevin Kiley' },
  bio: { gender: 'M', birthday: '1985-01-30' },
  terms: [
    { type: 'rep', start: '2023-01-03', end: '2025-01-03', state: 'CA', district: 3, party: 'Republican' },
    {
      type: 'rep', start: '2025-01-03', end: '2027-01-03', state: 'CA', district: 3, party: 'Independent', caucus: 'Republican',
      party_affiliations: [
        { start: '2025-01-03', end: '2026-03-08', party: 'Republican' },
        { start: '2026-03-09', end: '2027-01-03', party: 'Independent', caucus: 'Republican' },
      ],
    },
  ],
};

const BIDEN_SENATOR = {
  id: { bioguide: 'B000444', lis: 'S010', wikidata: 'Q6279', govtrack: 300008 },
  name: { first: 'Joseph', middle: 'Robinette', last: 'Biden', suffix: 'Jr.', nickname: 'Joe' },
  bio: { birthday: '1942-11-20', gender: 'M' },
  terms: [{ type: 'sen', start: '1973-01-03', end: '1979-01-03', state: 'DE', class: 2, party: 'Democrat' }],
};
const BIDEN_EXECUTIVE = {
  id: { bioguide: 'B000444', lis: 'S010', wikidata: 'Q6279', icpsr: 14101 },
  name: { first: 'Joseph', middle: 'Robinette', last: 'Biden', suffix: 'Jr.', nickname: 'Joe' },
  bio: { birthday: '1942-11-20', gender: 'M' },
  terms: [
    { type: 'viceprez', start: '2009-01-20', end: '2013-01-20', party: 'Democrat', how: 'election' },
    { type: 'prez', start: '2021-01-20', end: '2025-01-20', party: 'Democrat', how: 'election' },
  ],
};
const TRUMP = {
  id: { govtrack: 412733, wikidata: 'Q22686', fec: ['P80001571'] },
  name: { first: 'Donald', middle: 'J.', last: 'Trump' },
  bio: { birthday: '1946-06-14', gender: 'M' },
  terms: [
    { type: 'prez', start: '2017-01-20', end: '2021-01-20', party: 'Republican', how: 'election' },
    { type: 'prez', start: '2025-01-20', end: '2029-01-20', party: 'Republican', how: 'election' },
  ],
};

test('a term with a party change becomes one role per party', () => {
  const { person, roles } = parseLegislator(KILEY);
  assert.equal(person.name, 'Kevin Kiley');
  assert.equal(person.sortName, 'Kiley, Kevin');
  assert.equal(person.bioguideId, 'K000401');
  assert.equal(person.wikidataId, 'Q27987136');
  assert.deepEqual(person.otherIds, { fec: ['H2CA03157'], govtrack: 456881 });
  assert.deepEqual(roles.map(r => [r.roleType, r.start, r.end, r.party, r.district]), [
    ['representative', '2023-01-03', '2025-01-03', 'Republican', 3],
    ['representative', '2025-01-03', '2026-03-08', 'Republican', 3],
    ['representative', '2026-03-09', '2027-01-03', 'Independent', 3],
  ]);
  assert.equal(roles[2].caucus, 'Republican');
});

test('names use the nickname and keep the suffix', () => {
  const { person, roles } = parseLegislator(BIDEN_SENATOR);
  assert.equal(person.name, 'Joe Biden, Jr.');
  assert.equal(person.sortName, 'Biden, Joe Jr.');
  assert.equal(roles[0].senateClass, 2);
  assert.equal(roles[0].chamber, 'Senate');
});

test('the executive list joins the same person by Bioguide id', () => {
  const people = mergePeople([BIDEN_SENATOR, KILEY], [BIDEN_EXECUTIVE, TRUMP]);
  assert.equal(people.length, 3);
  const biden = people.find(p => p.person.bioguideId === 'B000444');
  assert.deepEqual(biden.roles.map(r => r.roleType), ['senator', 'vice_president', 'president']);
  assert.equal(biden.person.otherIds.icpsr, 14101);
  assert.equal(biden.person.otherIds.govtrack, 300008);
});

test('a president with no Bioguide id is one person with two terms', () => {
  const [trump] = mergePeople([TRUMP]);
  assert.equal(trump.person.bioguideId, null);
  assert.equal(trump.person.wikidataId, 'Q22686');
  assert.equal(trump.person.name, 'Donald J. Trump');
  assert.deepEqual(trump.roles.map(r => [r.roleType, r.start]), [['president', '2017-01-20'], ['president', '2025-01-20']]);
});

test('a historical at-large district is stored as no district', () => {
  const { roles } = parseLegislator({
    id: { bioguide: 'F000247' }, name: { first: 'Samuel', last: 'Foot' },
    terms: [{ type: 'rep', start: '1819-12-06', end: '1821-03-03', state: 'CT', district: -1, party: 'Adams' }],
  });
  assert.equal(roles[0].district, null);
});
