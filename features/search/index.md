# Search

## Status
In Progress

## Goal
Find a bill by any name people use for it, or by any way its number is written: "big beautiful bill
act", "Green New Deal", "H.R. 10767", "P.L. 119-21". Later: text within bills, people, and other
document types.

## Decisions
- Postgres, not a hosted search engine (Algolia, Typesense, Meilisearch), decided 2026-10-11. About
  86,000 bills and a few hundred thousand titles; full-text search answers in milliseconds, and the
  data stays in one place with nothing to sync. The search is one server function (`billSearch` in
  `server/resolvers.js`), so it can be moved to an engine later if text search across every document
  type needs one.
- Titles come from the publisher first: the bill status files list every title a bill has had
  (display, official, short titles at each stage, short titles of portions, CRS's popular titles).
  H.R. 1 of the 119th has display title "An act to provide for reconciliation …" and popular title
  "One Big Beautiful Bill Act". Stored in `bill_titles` with source `congress.gov`.
- Our own names only where no publisher has one, in `server/seed/data/bill-names.json` with a note
  each, stored with source `govgraph`, kind `common`, title type "Name in common use". The results
  show which title matched and its type, so our names are labelled as ours.
- A search that is only a bill or law number is read as one (`parseBillQuery`); words are matched
  against titles. A number finds that bill in every Congress loaded unless one is named.
- Ranking: exact title 20, whole phrase 6, kind of title (popular and common 5, short 4, display 3,
  official 2, portion 1), full-text rank (shorter titles higher), enacted +4 (people search for laws by name). Ties: newest Congress.

## Done
- [x] `server/lib/bill-search.js`: `parseBillQuery` ("H.R. 1", "hr1", "H. J. Res. 12", "Senate Bill 5",
  with the Congress before or after: "119-hr-1", "H.R. 1 (119th Congress)"; "Public Law 119-21",
  "P.L. 119-21", "Pub. L. No. 119-21", "Private Law 115-1") and `titleKind`. Test: `bill-search.test.js`
- [x] `parse-bill-status.js` reads `<titles>`; `load-bill-status-bulk.js` stores them in `bill_titles`
  (replaced on each load; a bill without stored titles is re-stored even if unchanged). Full-text
  indexes on `bill_titles.title` and `legislation.title`; index on bill type and number, and on Congress
- [x] `server/seed/load-bill-names.js` loads our names (Green New Deal: H.Res. 109 and S.Res. 59, 116th)
- [x] GraphQL `billSearch(query, congress, billType, year, page, perPage)`: rows grouped by proposal,
  `matchedTitle` / `matchedTitleType`, `identifier`, `congressCounts`
- [x] `/congress`: search box across every Congress (`?q=` in the address), Congress facet with counts
  in the rail. `/congress/:n`: the search box uses the same search, scoped to that Congress, best match
  first, with a link to search all Congresses. Rows show the matched title where it differs
  (`BillRow.jsx`, shared by both pages)
- [x] Titles loaded for the 115th–119th Congresses (2026-10-11): 274,481 titles. The 115th, 116th and
  118th had title-only rows until then; loading their status added their history too (+275 MB, database 2,124 MB)
- [x] Speed: each title's words stored as a column (`bill_titles.search`, `legislation.title_search`,
  generated), the search parsed once per query, and the page and its counts in one query. Most
  searches 200–900 ms warm

## Todo
- [ ] One-word searches that match most bills ("act": 188,000 titles, 67,500 bills) take about 4 s;
  every match is scored before the best are picked. A minimum length, a cap, or skipping very common
  words would help
- [ ] Congresses before the 115th are not loaded (no bills at all)
- [ ] The Office of the Law Revision Counsel's Popular Name Table (uscode.house.gov) for enacted laws
  of every era ("Affordable Care Act" → Pub. L. 111-148); points to laws we may not have loaded
- [ ] Typo tolerance (`pg_trgm`), for when a word is misspelled and nothing matches
- [ ] Search within bill text (`legislative_document_sections`; a full-text index costs storage)
- [ ] People in the same search box
- [ ] Other document types: executive orders and memoranda (Federal Register search today),
  Supreme Court decisions (name only today)
