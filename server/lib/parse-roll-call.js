/**
 * A roll call vote file → one shape for both chambers.
 *
 *   House:  https://clerk.house.gov/evs/2025/roll190.xml            (<rollcall-vote>)
 *   Senate: https://www.senate.gov/legislative/LIS/roll_call_votes/vote1191/vote_119_1_00372.xml
 *                                                                   (<roll_call_vote>)
 *
 * A member's position is one of "Yea", "Nay", "Present", "Not Voting" (the House prints
 * Aye/No on some questions; they are the same thing).
 */

import { parseXml, child, plain, isElement } from './parse-bill-xml.js';

const text = (node, name) => (node ? plain(child(node, name)) || null : null);
const all = (node, name) => (node ? node.children.filter(c => isElement(c) && c.name === name) : []);
const count = value => Number(value) || 0;

const POSITIONS = { yea: 'Yea', aye: 'Yea', nay: 'Nay', no: 'Nay', present: 'Present', 'not voting': 'Not Voting' };
// Anything else (e.g. a candidate's name in the election of the Speaker) is kept as cast.
const position = cast => POSITIONS[(cast ?? '').trim().toLowerCase()] ?? (cast ?? '').trim();

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
// "3-Jul-2025" (House) and "July 1, 2025, 11:56 AM" (Senate) → "2025-07-03"
function isoDate(printed) {
  const m = /(\d{1,2})-([A-Za-z]{3})-(\d{4})/.exec(printed ?? '') ?? null;
  const s = /([A-Za-z]{3})[a-z]* (\d{1,2}), (\d{4})/.exec(printed ?? '') ?? null;
  const [day, month, year] = m ? [m[1], m[2], m[3]] : s ? [s[2], s[1], s[3]] : [];
  const number = MONTHS[(month ?? '').toLowerCase()];
  return number ? `${year}-${String(number).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null;
}

function house(root) {
  const meta = child(root, 'vote-metadata');
  const members = all(child(root, 'vote-data'), 'recorded-vote').map(v => {
    const who = child(v, 'legislator');
    return {
      memberId: who?.attrs['name-id'] ?? null, // Bioguide id
      idType: 'bioguide',
      name: who?.attrs['unaccented-name'] ?? plain(who), // surname, with the state where two share one
      party: who?.attrs.party ?? null,
      state: who?.attrs.state ?? null,
      position: position(text(v, 'vote')),
    };
  });
  return {
    chamber: 'House',
    congress: count(text(meta, 'congress')),
    session: count(/\d+/.exec(text(meta, 'session') ?? '')?.[0]),
    rollNumber: count(text(meta, 'rollcall-num')),
    date: isoDate(text(meta, 'action-date')),
    question: text(meta, 'vote-question'),
    description: text(meta, 'vote-desc'),
    voteType: text(meta, 'vote-type'),
    result: text(meta, 'vote-result'),
    measure: text(meta, 'legis-num'),
    amendment: text(meta, 'amendment-num'),
    tieBreaker: null,
    members,
  };
}

function senate(root) {
  const tie = child(root, 'tie_breaker');
  const amendment = child(root, 'amendment');
  const members = all(child(root, 'members'), 'member').map(m => ({
    memberId: text(m, 'lis_member_id'), // the Senate's own id; mapped to Bioguide by the loader
    idType: 'lis',
    name: [text(m, 'last_name'), text(m, 'first_name')].filter(Boolean).join(', '),
    party: text(m, 'party'),
    state: text(m, 'state'),
    position: position(text(m, 'vote_cast')),
  }));
  return {
    chamber: 'Senate',
    congress: count(text(root, 'congress')),
    session: count(text(root, 'session')),
    rollNumber: count(text(root, 'vote_number')),
    date: isoDate(text(root, 'vote_date')),
    question: text(root, 'question') ?? text(root, 'vote_question_text'),
    description: text(root, 'vote_title') ?? text(root, 'vote_document_text'),
    voteType: text(root, 'majority_requirement'),
    result: text(root, 'vote_result'),
    measure: text(child(root, 'document'), 'document_name'),
    amendment: text(amendment, 'amendment_number'),
    tieBreaker: text(tie, 'by_whom') ? { by: text(tie, 'by_whom'), vote: text(tie, 'tie_breaker_vote') } : null,
    members,
  };
}

export function parseRollCall(xml) {
  const root = parseXml(xml).children.find(isElement);
  if (root?.name !== 'rollcall-vote' && root?.name !== 'roll_call_vote') throw new Error('not a roll call vote file');
  const vote = root.name === 'rollcall-vote' ? house(root) : senate(root);
  if (!vote.congress || !vote.rollNumber) throw new Error('roll call without congress or number');

  // Counted from the members rather than read from the file's own totals, so both agree by construction.
  const totals = { yea: 0, nay: 0, present: 0, notVoting: 0 };
  for (const m of vote.members) {
    if (m.position === 'Yea') totals.yea++;
    else if (m.position === 'Nay') totals.nay++;
    else if (m.position === 'Present') totals.present++;
    else if (m.position === 'Not Voting') totals.notVoting++;
  }
  return { ...vote, totals };
}
