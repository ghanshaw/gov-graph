// node --test server/lib/parse-roll-call.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRollCall } from './parse-roll-call.js';

test('a House roll call', () => {
  const vote = parseRollCall(`<?xml version="1.0"?>
<rollcall-vote><vote-metadata><congress>119</congress><session>1st</session><rollcall-num>190</rollcall-num>
  <legis-num>H R 1</legis-num><vote-question>On Motion to Concur in the Senate Amendment</vote-question>
  <vote-type>RECORDED VOTE</vote-type><vote-result>Passed</vote-result><action-date>3-Jul-2025</action-date>
  <vote-desc>One Big Beautiful Bill Act</vote-desc></vote-metadata>
<vote-data>
  <recorded-vote><legislator name-id="A000370" unaccented-name="Adams" party="D" state="NC">Adams</legislator><vote>No</vote></recorded-vote>
  <recorded-vote><legislator name-id="A000055" unaccented-name="Aderholt" party="R" state="AL">Aderholt</legislator><vote>Aye</vote></recorded-vote>
  <recorded-vote><legislator name-id="B000001" unaccented-name="Brown" party="R" state="OH">Brown</legislator><vote>Not Voting</vote></recorded-vote>
</vote-data></rollcall-vote>`);

  assert.deepEqual(
    [vote.chamber, vote.congress, vote.session, vote.rollNumber, vote.date, vote.result, vote.measure],
    ['House', 119, 1, 190, '2025-07-03', 'Passed', 'H R 1']
  );
  assert.equal(vote.question, 'On Motion to Concur in the Senate Amendment');
  assert.deepEqual(vote.totals, { yea: 1, nay: 1, present: 0, notVoting: 1 });
  assert.deepEqual(vote.members[0], { memberId: 'A000370', idType: 'bioguide', name: 'Adams', party: 'D', state: 'NC', position: 'Nay' });
  assert.equal(vote.members[1].position, 'Yea');
});

test('a Senate roll call, with a tie-breaker', () => {
  const vote = parseRollCall(`<?xml version="1.0"?>
<roll_call_vote><congress>119</congress><session>1</session><vote_number>372</vote_number>
  <vote_date>July 1, 2025,  11:56 AM</vote_date><question>On Passage of the Bill</question>
  <vote_title>H.R. 1, as Amended</vote_title><majority_requirement>1/2</majority_requirement>
  <vote_result>Bill Passed</vote_result><document><document_name>H.R. 1</document_name></document>
  <amendment><amendment_number/></amendment>
  <tie_breaker><by_whom>Vice President of the United States</by_whom><tie_breaker_vote>Yea</tie_breaker_vote></tie_breaker>
  <members>
    <member><last_name>Alsobrooks</last_name><first_name>Angela</first_name><party>D</party><state>MD</state>
      <vote_cast>Nay</vote_cast><lis_member_id>S428</lis_member_id></member>
    <member><last_name>Britt</last_name><first_name>Katie</first_name><party>R</party><state>AL</state>
      <vote_cast>Yea</vote_cast><lis_member_id>S416</lis_member_id></member>
  </members></roll_call_vote>`);

  assert.deepEqual(
    [vote.chamber, vote.congress, vote.session, vote.rollNumber, vote.date, vote.result, vote.measure, vote.amendment],
    ['Senate', 119, 1, 372, '2025-07-01', 'Bill Passed', 'H.R. 1', null]
  );
  assert.deepEqual(vote.tieBreaker, { by: 'Vice President of the United States', vote: 'Yea' });
  assert.deepEqual(vote.totals, { yea: 1, nay: 1, present: 0, notVoting: 0 });
  assert.deepEqual(vote.members[0], { memberId: 'S428', idType: 'lis', name: 'Alsobrooks, Angela', party: 'D', state: 'MD', position: 'Nay' });
});
