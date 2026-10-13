// node --test server/lib/parse-bill-status.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBillStatus } from './parse-bill-status.js';

const XML = `<?xml version="1.0" encoding="utf-8"?>
<billStatus><version>3.0.0</version><bill>
  <number>1</number><updateDate>2026-05-08T10:00:00Z</updateDate>
  <updateDateIncludingText>2026-05-09T10:00:00Z</updateDateIncludingText>
  <originChamber>House</originChamber><type>HR</type><introducedDate>2025-05-20</introducedDate>
  <congress>119</congress><legislationUrl>https://www.congress.gov/bill/119th-congress/house-bill/1</legislationUrl>
  <committees><item><systemCode>hsbu00</systemCode><name>Budget Committee</name></item></committees>
  <actions>
    <item><actionDate>2025-07-04</actionDate><text>Became Public Law No: 119-21.</text><type>BecameLaw</type>
      <actionCode>36000</actionCode><sourceSystem><code>9</code><name>Library of Congress</name></sourceSystem>
      <recordedVotes><recordedVote><rollNumber>190</rollNumber><url>https://clerk.house.gov/evs/2025/roll190.xml</url>
        <chamber>House</chamber><congress>119</congress><date>2025-07-03T18:31:38Z</date><sessionNumber>1</sessionNumber>
      </recordedVote></recordedVotes></item>
    <item><actionDate>2025-05-20</actionDate><actionTime>10:15:00</actionTime><text>Introduced in House</text>
      <type>IntroReferral</type><sourceSystem><name>House floor actions</name></sourceSystem></item>
  </actions>
  <sponsors><item><bioguideId>A000375</bioguideId><fullName>Rep. Arrington, Jodey C. [R-TX-19]</fullName>
    <party>R</party><state>TX</state></item></sponsors>
  <cosponsors><item><bioguideId>S001183</bioguideId><fullName>Rep. Schweikert, David [R-AZ-1]</fullName>
    <party>R</party><state>AZ</state><district>1</district><sponsorshipDate>2025-05-20</sponsorshipDate>
    <isOriginalCosponsor>True</isOriginalCosponsor></item>
    <item><bioguideId>C001129</bioguideId><fullName>Rep. Collins, Mike [R-GA-10]</fullName><party>R</party><state>GA</state>
    <district>10</district><sponsorshipDate>2025-06-02</sponsorshipDate><isOriginalCosponsor>False</isOriginalCosponsor>
    <sponsorshipWithdrawnDate>2025-06-11</sponsorshipWithdrawnDate></item></cosponsors>
  <laws><item><type>Public Law</type><number>119-21</number></item></laws>
  <policyArea><name>Economics and Public Finance</name></policyArea>
  <title>One Big Beautiful Bill Act</title>
  <textVersions><item><type>Enrolled Bill</type><date/><formats><item>
    <url>https://www.govinfo.gov/content/pkg/BILLS-119hr1enr/xml/BILLS-119hr1enr.xml</url></item></formats></item>
    <item><type>Reported in House</type><date>2025-05-20T04:00:00Z</date><formats><item>
    <url>https://www.govinfo.gov/content/pkg/BILLS-119hr1rh/xml/BILLS-119hr1rh.xml</url></item></formats></item></textVersions>
  <amendments><amendment><number>2849</number><type>SAMDT</type>
    <cosponsors><item><bioguideId>K000377</bioguideId><sponsorshipDate>2025-07-01</sponsorshipDate></item></cosponsors><actions><actions><item>
    <actionDate>2025-07-01</actionDate><text>Amendment SA 2849 not agreed to in Senate by Yea-Nay Vote. 45 - 55.</text>
    <recordedVotes><recordedVote><rollNumber>369</rollNumber><chamber>Senate</chamber><congress>119</congress>
      <date>2025-07-01T15:35:26Z</date><sessionNumber>1</sessionNumber>
      <url>https://www.senate.gov/legislative/LIS/roll_call_votes/vote1191/vote_119_1_00369.xml</url>
    </recordedVote></recordedVotes></item></actions></actions></amendment></amendments>
  <latestAction><actionDate>2025-07-04</actionDate><text>Became Public Law No: 119-21.</text></latestAction>
</bill></billStatus>`;

test('a bill status file gives the bill, its details and its actions', () => {
  const bill = parseBillStatus(XML);

  assert.deepEqual(
    [bill.sourceId, bill.congress, bill.type, bill.number, bill.title, bill.introducedDate],
    ['119-HR-1', 119, 'hr', '1', 'One Big Beautiful Bill Act', '2025-05-20']
  );
  assert.deepEqual([bill.publicLawNumber, bill.enactedDate, bill.status], ['119-21', '2025-07-04', 'Became Public Law No: 119-21.']);
  assert.equal(bill.details.updateDate, '2026-05-09T10:00:00Z');
  assert.equal(bill.details.cosponsorCount, 2);
  assert.deepEqual(bill.details.committees, ['Budget Committee']);
  assert.deepEqual(bill.details.sponsors[0], { bioguideId: 'A000375', fullName: 'Rep. Arrington, Jodey C. [R-TX-19]', party: 'R', state: 'TX' });
  assert.deepEqual(bill.sponsorships, [
    { role: 'sponsor', position: 0, bioguideId: 'A000375', fullName: 'Rep. Arrington, Jodey C. [R-TX-19]', party: 'R',
      state: 'TX', district: null, date: null, isOriginal: null, withdrawnDate: null },
    { role: 'cosponsor', position: 0, bioguideId: 'S001183', fullName: 'Rep. Schweikert, David [R-AZ-1]', party: 'R',
      state: 'AZ', district: '1', date: '2025-05-20', isOriginal: true, withdrawnDate: null },
    { role: 'cosponsor', position: 1, bioguideId: 'C001129', fullName: 'Rep. Collins, Mike [R-GA-10]', party: 'R',
      state: 'GA', district: '10', date: '2025-06-02', isOriginal: false, withdrawnDate: '2025-06-11' },
  ]);
  assert.deepEqual(bill.details.textVersions, [
    { label: 'Enrolled Bill', date: null, packageId: 'BILLS-119hr1enr' },
    { label: 'Reported in House', date: '2025-05-20', packageId: 'BILLS-119hr1rh' },
  ]);
  assert.deepEqual(bill.recordedVotes, [{
    url: 'https://clerk.house.gov/evs/2025/roll190.xml', chamber: 'House', congress: 119, session: 1,
    rollNumber: 190, date: '2025-07-03', actionPosition: 0, amendment: null,
  }, {
    url: 'https://www.senate.gov/legislative/LIS/roll_call_votes/vote1191/vote_119_1_00369.xml', chamber: 'Senate',
    congress: 119, session: 1, rollNumber: 369, date: '2025-07-01', actionPosition: null, amendment: 'SAMDT 2849',
  }]);
  assert.deepEqual(bill.actions, [
    { position: 0, date: '2025-07-04', time: null, text: 'Became Public Law No: 119-21.', type: 'BecameLaw', code: '36000', source: 'Library of Congress' },
    { position: 1, date: '2025-05-20', time: '10:15:00', text: 'Introduced in House', type: 'IntroReferral', code: null, source: 'House floor actions' },
  ]);
  assert.deepEqual(bill.relatedBills, []);
});

// Trimmed from BILLSTATUS-118s2824.xml: one bill identical and procedurally related, one from
// another Congress, and an item without a relationship (dropped).
const RELATED = `<billStatus><bill>
  <number>2824</number><type>S</type><congress>118</congress><title>Secure the Border Act of 2023</title>
  <relatedBills>
    <item><title>Secure the Border Act of 2023</title><congress>118</congress><number>2</number><type>HR</type>
      <latestAction><actionDate>2024-12-17</actionDate><text>Referred to the Subcommittee on Social Security.</text></latestAction>
      <relationshipDetails>
        <item><type>Identical bill</type><identifiedBy>CRS</identifiedBy></item>
        <item><type>Procedurally related</type><identifiedBy>House</identifiedBy></item>
      </relationshipDetails></item>
    <item><title>Border Act of 2021</title><congress>117</congress><number>100</number><type>S</type>
      <relationshipDetails><item><type>Cross-Congress related bill</type><identifiedBy>CRS</identifiedBy></item></relationshipDetails></item>
    <item><title>No details</title><congress>118</congress><number>5</number><type>HR</type><relationshipDetails/></item>
  </relatedBills>
</bill></billStatus>`;

test('related bills keep every relationship and who identified it', () => {
  assert.deepEqual(parseBillStatus(RELATED).relatedBills, [
    { congress: 118, type: 'hr', number: '2', title: 'Secure the Border Act of 2023', relationships: [
      { type: 'Identical bill', identifiedBy: 'CRS' },
      { type: 'Procedurally related', identifiedBy: 'House' },
    ] },
    { congress: 117, type: 's', number: '100', title: 'Border Act of 2021', relationships: [
      { type: 'Cross-Congress related bill', identifiedBy: 'CRS' },
    ] },
  ]);
});

// Trimmed from BILLSTATUS-119hr1.xml: the popular title is not the display title.
const TITLES = `<billStatus><bill>
  <number>1</number><type>HR</type><congress>119</congress>
  <title>An act to provide for reconciliation pursuant to title II of H. Con. Res. 14.</title>
  <titles>
    <item><titleType>Display Title</titleType><titleTypeCode>45</titleTypeCode>
      <title>An act to provide for reconciliation pursuant to title II of H. Con. Res. 14.</title></item>
    <item><titleType>Short Titles as Enacted for portions of this bill</titleType><title>FEHB Protection Act of 2025</title></item>
    <item><titleType>Popular Titles</titleType><title>One Big Beautiful Bill Act</title></item>
    <item><titleType>Short Title(s) as Passed House</titleType><title>One Big Beautiful Bill Act</title>
      <chamberCode>H</chamberCode><chamberName>House</chamberName></item>
    <item><titleType>Official Title as Introduced</titleType><title/></item>
  </titles>
</bill></billStatus>`;

test('every title the bill is known by, in order', () => {
  assert.deepEqual(parseBillStatus(TITLES).titles, [
    { position: 0, type: 'Display Title', title: 'An act to provide for reconciliation pursuant to title II of H. Con. Res. 14.', chamber: null },
    { position: 1, type: 'Short Titles as Enacted for portions of this bill', title: 'FEHB Protection Act of 2025', chamber: null },
    { position: 2, type: 'Popular Titles', title: 'One Big Beautiful Bill Act', chamber: null },
    { position: 3, type: 'Short Title(s) as Passed House', title: 'One Big Beautiful Bill Act', chamber: 'House' },
  ]);
});
