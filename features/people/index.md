# People

## Status
In Progress

## Goal
A page per person, linked from every name on a bill page and in its votes. A person keeps one
identity across roles (a senator can become vice president and president) and party changes,
and the page shows each role with what they did in it: votes, bills sponsored and cosponsored,
and for presidents bills signed and vetoed, plus orders and memoranda.

## Decisions
- Our own `people.id` (uuid) is the identity and the URL (`/people/<uuid>`). Ids from other systems
  are columns where records are matched on them (`bioguide_id`, `lis_id`, `wikidata_id`; `fjc_id`
  and `courtlistener_id` waiting for judges), every other id in `other_ids` jsonb.
- Party belongs to the role, not the person. One `person_roles` row per term as published; a term
  with a change of party is split at the change. Votes and sponsorships keep the party printed at the time.
- On the page, consecutive terms in the same office for the same state are one stint (terms a year
  or less apart; computed in `server/people.js`).
- All 12,770 members since 1789 are loaded, even though votes and bills exist only for the 119th Congress.

## Done
- [x] `server/lib/parse-legislators.js` (+ test): @unitedstates legislators lists and `executive.json`
  → people and roles, merging an executive entry into the legislator with the same Bioguide or Wikidata id
- [x] `server/seed/load-people.js`: 12,797 people, 45,696 roles (2026-10-02). Re-runs keep each uuid.
  Links `member_votes.person_id` (all 334,014), `bill_sponsors.person_id` and
  `executive_documents.president_id` (all 1,844, by signing date; checked against the per-president
  data files, 0 mismatches; Bush's 294 orders included)
- [x] Cosponsors: `parse-bill-status.js` returns `sponsorships`; `load-bill-status-bulk.js` stores
  `bill_sponsors` (sponsor and cosponsors with date, original, withdrawn, party/state as printed)
  and has `--force`. 119th: 19,531 sponsors + 181,582 cosponsors, all linked. Table is 53 MB
- [x] `load-roll-calls.js` sets `member_votes.person_id` as it stores votes
- [x] GraphQL: `person`, `people`, `personVotes`, `personBills`, `personPresidentialActions`;
  `BillSponsor.personId`, `rollCallMembers[].personId` (`server/people.js`)
- [x] `/people` list (in office now by default; office held, party, state, name search) and
  `/people/:id` (stints newest first; Show votes / sponsored / cosponsored / signed / vetoed;
  votes filter by position and Congress; links to the president's order and memoranda pages;
  Bioguide, Wikipedia, Wikidata, GovTrack links). "People" in the header
- [x] Sponsor names on the bill page and the Congress list, and member names in the votes list, link to the person

- [x] Order control on `/people` (2026-10-10): name A–Z (default), start date and end date, each
  newest or oldest first, by the latest office's dates (`people(sort:)`); serving Justices (no end
  date) count as the latest end

## Todo
- [ ] Judges: FJC biographical directory or CourtListener people → `fjc_id` / `courtlistener_id`, `person_roles.court_id`, `case_opinions.author_id`
- [ ] Vice presidents' tie-breaking votes (`roll_calls.tie_breaker`, 6 in the 119th) on the VP stint
- [ ] Cosponsor list on the bill page (the data is in `bill_sponsors`)
- [ ] Votes and bills for earlier Congresses, as they are loaded (see `features/congress`)
- [ ] Death dates: not in the legislators lists
- [ ] Presidents before Bush have no orders stored; the president pages exist only for the four slugs in `server/people.js`
