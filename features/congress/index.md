# Congress

## Status
In Progress

## Goal
Browse bills and enacted laws by Congress (Congress.gov API), with a page per bill showing its
progress, action history and printed text.

## Done
- [x] Congress list, session page (`/congress/:number`) with search, year, bill type and enacted-only filters
- [x] Bill page (`/congress/:number/:billType/:billNumber`): progress stepper, action history, tags
- [x] Session page order control (rail "Order"): latest update first (default) or earliest update first. GraphQL `bills(order:)`
- [x] Bill page header buttons, matching the executive order page: Show/Hide PDF, PDF ↗, Congress.gov ↗, GovInfo ↗. The PDF is the most recent text version; the in-page viewer loads `/pdf/bill/<package id>` (e.g. `BILLS-119s3018rs`), passed through from govinfo with congress.gov as fallback (`server/pdf.js`)
- [x] Bill text converter `server/lib/parse-bill-xml.js` (bill-format XML → the same structure as executive orders: sections → items → spans, citations, plus an `outline` tree of titles/subtitles/chapters). Handles quoted amendatory text, sub-item headings, tables, committee substitutes (struck and inserted text) and engrossed amendments. Test: `node --test server/lib/parse-bill-xml.test.js`
- [x] Storage, parse once: `server/seed/load-bill-text.js --congress N --type hr --number N` stores one `legislative_documents` row per text version (`doc_type` = version code, `source_id` = govinfo package id, `structure` = everything except section text, `source_xml` = raw file) and one `legislative_document_sections` row per section
- [x] Trial load: H.R. 1 of the 119th Congress (One Big Beautiful Bill Act, P.L. 119-21), five versions, 1,642 sections; and S. 3018 (two versions) as a small sample with amendment markup
- [x] Bill page text view for bills with stored text: Show/Hide full text, version switch in the rail, contents tree (fully expanded in its own scroll box with one rule down the left and a divider below; titles fold; − and + beside "Contents" close or open one level across the whole tree; the section being read is kept in view), sections loaded 15 at a time as they come within reach (`billText`, `billTextSections` queries; `BillText.jsx`, `BillOutline.jsx`). The PDF buttons follow the version being shown
- [x] Bill page: legislative progress + action history behind a Show/Hide progress button, tags behind a Show/Hide tags button (both closed by default; progress opens by default on bills with no stored text). Action labels corrected for codes 36000, E20000 and E40000 ("Became Public Law" was shown as "Vetoed by President")
- [x] The bill's own printed table of contents (`<toc>`) is converted as a `type: "toc"` item and rendered in its section, each entry linked to the heading it names
- [x] Bill sections fold from their heading (caret before "Section N"). A section titled "Table of contents" starts folded, and a folded section's text is not fetched until it is opened
- [x] Bill page rail while reading: only Contents and Version; the tree fills the rest of the rail's height and is its only scrolling area (Progress and In this bill come back with Show progress). The rail and tree scroll without visible scrollbars (applies to the rail on every page)
- [x] Bulk data home outside the repo: `../gov-graph-data` (`GOVGRAPH_DATA_DIR`), mirroring govinfo's paths. `server/seed/fetch-govinfo-bulk.js --collection BILLS | BILLSTATUS --congress 115-119` downloads the zips (120 zips, about 1 GB, for 115–119)
- [x] Bill history stored: `server/seed/load-bill-status-bulk.js --congress N` reads the BILLSTATUS zips into `legislation` (row created for every bill found; new `details` jsonb with sponsors, policy area, committees, laws, text versions) and `bill_actions` (new `action_code`, `source_system`, `position`). The bill page uses stored actions when a bill has them
- [x] Bulk bill text: `server/seed/load-bill-text-bulk.js --congress N` parses every version in the BILLS zips and stores text and raw XML (about 3,000 versions a minute). Resolutions are converted too ("Whereas" preamble, unnumbered "Resolved" section)
- [x] **Loaded: 119th Congress** (2026-10-02): 19,531 bills with history (79,999 actions; 3,340 bills were new rows), 22,565 text versions, 105,592 sections. Database went from 140 MB to 626 MB
- [x] Recorded votes: `roll_calls` (one row per question put to a chamber) and `member_votes` (one row per member per roll call: Yea, Nay, Present, Not Voting). `server/seed/fetch-roll-calls.js --congress N` downloads the vote files the bill status files refer to (House Clerk, Senate) plus the @unitedstates legislators lists; `server/seed/load-roll-calls.js --congress N` stores them. Parser `server/lib/parse-roll-call.js` handles both chambers
- [x] **Loaded: bill text for the 115th–118th Congresses** (2026-10-12): 18,492 / 20,446 / 21,401 / 22,922 text
  versions for the 115th / 116th / 117th / 118th (every version in govinfo's zips except 9 engrossed Senate
  amendments with no bill text). History for 117 loaded here (17,828 bills, 84,072 actions); 115, 116 and 118
  history was already in place. About 1,400 versions a minute. Database 2.1 GB → 4.2 GB (8 GB disk, Pro plan)
- [x] **119th Congress refreshed** (2026-10-12): zips re-downloaded; 533 bills updated (31 new), 366 new text versions.
  The project briefly went read-only on 2026-10-07 mid-load (writes refused, `default_transaction_read_only = on`);
  it cleared without changes from here, apparently with the move to the Pro plan's 8 GB disk
- [x] **Loaded: 119th Congress votes** — 1,117 roll calls (669 House, 448 Senate; 265 on amendments) on 562 bills, 334,014 member votes, every member matched to a Bioguide id. `member_votes` is 51 MB
- [x] Bill page "Show votes (N)" button (only on bills with recorded votes): votes that decide the bill first, then amendments and procedure. Each shows a position-by-party table with bars, the tie-breaker where there was one, a link to the official record, and an expandable list of every member grouped by state (`BillVotes.jsx`; `Bill.rollCalls`, `rollCallMembers`)
- [x] Enacted laws view (session page, "Enacted laws only") laid out as Congress.gov's "Statutes at
  Large and Public Laws" list (2026-10-03): statute citation, law number (linked to the slip law PDF),
  bill and title, date it became law; newest first with an Order control; public and private laws as
  separate lists. Rows from Congress.gov's law list; the citation and slip law only once GPO has
  published the law on govinfo (collection PLAW). The citation is read from the "[[Page 140 STAT. 1061]]"
  marker at the head of the law's text (kept in the data directory), because govinfo's metadata lists the
  law's own citation together with the statutes it amends. `server/lib/enacted-laws.js`, `enactedLaws` query
- [x] Session page order by introduction date (2026-10-03): "Newest introduced first" (now the default) and
  "Oldest introduced first" come from the database (`legislation.introduced_date`, bills introduced the same
  day by number), so they need the Congress's bill history loaded (`load-bill-status-bulk.js`); the year,
  type and search filters apply there too. "Latest / Earliest update first" still come from Congress.gov.
  For a Congress not loaded (none of 115–119 now) the page says so and falls back to Congress.gov's order
- [x] Bill relationships and proposals (2026-10-11). The status loader stores each bill's related bills
  (`bill_relationships`: Congress.gov's type and who identified it, source `congress.gov`) and rebuilds
  `proposals` (`server/lib/proposals.js`): an identical House bill and Senate bill share one, every other
  bill is one alone. Our own relationships, and the "Not identical" override, through
  `server/seed/add-bill-relationship.js` (source `govgraph`, kept across reloads); `build-proposals.js`
  rebuilds alone. **119th Congress:** 13,326 relationships, 17,768 proposals, 1,834 House–Senate pairs.
  Session page (introduction-date orders) lists one row per proposal: both numbers, each bill's sponsor and
  latest action; the heading counts bills, the pager rows. Bill page: "Identical bill: …" under the title and
  "Show related bills (N)" grouped by kind. GraphQL `Bill.companions`, `Bill.relatedBills`, `BillPage.billCount`.
  Tests: `parse-bill-status.test.js` (related bills), `proposals.test.js` (pairing rule)
- [x] Same proposal by text (2026-10-11): `server/seed/match-bill-texts.js --congress N` compares the earliest
  stored texts of House/Senate pairs that Congress.gov calls "Related bill" or that share a title, and stores
  "Same text" (≥ 90%) and "Similar text" (60–90%) as our own relationships (`identified_by = 'text-match'`).
  Pairing ranks Identical bill > Same text > Similar text, then date. **119th:** 4,518 pairs compared,
  2,332 same / 823 similar; House–Senate pairs 1,834 → 3,331. Same-title pairs still apart: 1,694 → 742
  (679 with mostly different text, 34 without stored text, 29 where one bill has a closer match).
  Bill page names the reason: "Identical bill", "Same text as" or "Companion bill", with the percentage.
  `server/lib/text-similarity.js` (+ test)

## Todo
- [x] Bill status loaded for 115th, 116th and 118th (2026-10-11): history, sponsors, titles, relationships and proposals (12,371 / 14,855 / 17,240 proposals). No text or votes yet
- [ ] Re-run `match-bill-texts.js` after each refresh of the current Congress (new bills, new text versions)
- [ ] Same-titled bills that cover the same ideas in different words (e.g. the Tax Administration
  Simplification Acts, 37%) stay apart; comparing section headings or provisions could catch them
- [ ] A proposal's furthest stage, for sorting and showing "passed the House" on its row
- [ ] Reintroductions across Congresses as a lineage (Congress.gov's "Cross-Congress related bill" rows are stored but not grouped)
- [ ] With a bill type filter, a pair still leads with its earlier bill, which may be of the other chamber
- [ ] A way to add our own relationships from the bill page (now a script)
- [ ] Votes for Congresses 115, 116 and 118 (fetch-roll-calls, then load-roll-calls; their bill status is loaded)
- [ ] Roll calls that are not about a bill (nominations, electing the Speaker) are not loaded
- [x] Member pages: see `features/people` (votes, sponsored, cosponsored; names link from the bill page and votes)
- [ ] A seat diagram of each vote (needs a chosen seat order)
- [ ] Bill text for Congresses 115, 116 and 118 (status is loaded; 117 has text too). `load-bill-text-bulk.js --congress N`
- [ ] Refreshing the current Congress on a schedule: `fetch-govinfo-bulk.js --collection BILLSTATUS|BILLS --congress 119 --refresh`, then both loaders (status skips unchanged bills; text skips stored versions, so a re-issued version needs `--force`). Done by hand 2026-10-12; a bill introduced since then has no text until the next run
- [ ] Raw bill XML (`legislative_documents.source_xml`, about 0.9 GB now) duplicates the zips in the data directory; could be dropped if space is needed
- [ ] The bill page still asks Congress.gov for title, sponsor, policy area and the list of versions; these are now in `legislation.details` and could be served from the database
- [ ] Public Law print (PLAW-…, USLM format) is not converted; the enrolled bill is the latest text shown
- [ ] Search within a bill (see also `features/search`; the browser's find only sees sections that have loaded)
- [ ] A "clean text" view of reported versions that hides struck-out text
- [ ] Turn the typed citations (U.S. Code, public laws) into graph edges
- [ ] Sort the enacted-laws list (it takes no order yet)

## Decisions / Notes
- Congress.gov can sort bills only by record update date, not by introduction date. The direction
  must be separated by a space (`sort=updateDate desc`); the earlier `updateDate+desc` was silently
  ignored, so the list used to come back in an arbitrary order.
- The bill detail response has no public URL, so the Congress.gov link is built from congress,
  type and number (`/bill/119th-congress/senate-bill/3018`).
- No system gives identical bills a shared ID; Congress.gov only lists relationships pairwise. A
  proposal's ID is its lead bill (`119-hr-2`: earliest introduced, House first on a tie, lower number).
- Pairing rule: identical **and** each the other's closest-dated identical bill in the other chamber.
  Taking identical links transitively merged separate measures (13 same-text War Powers resolutions;
  the 2025 and 2026 Nurses Week resolutions, which CRS links all to each other).
