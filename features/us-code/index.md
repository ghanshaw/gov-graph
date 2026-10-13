# U.S. Code

## Status
In Progress — Phase 1 done (release point 119-36 loaded, pages live, bills link to sections). Next: the
current release point once uscode.house.gov is back, then Phase 2.

## Goal
A part of the app for the U.S. Code itself (titles → chapters → sections, `/code/10/1074c`), with bill
text linked to the place in the Code it changes. The model is git: release points are tags, Public
Laws are merged commits, source credits are blame, bills are proposed patches.

## Decisions
- Short URLs: `/code/<title>/<section>`.
- Source: the Law Revision Counsel's release points in USLM XML (uscode.house.gov), raw zips kept in
  `../gov-graph-data/uscode.house.gov/…`, parsed structure in the database (no raw XML in tables).
- Section text is stored by version, deduplicated by content hash, so history (Phase 3) needs no
  schema change.
- Classifying references as amends / repeals / cites is a separate pass over stored bill text, not
  part of the bill parser.
- History goes back to 2020 for now. Redlines for pending bills are a stretch goal.
- Paid Supabase plan (2026-10-07): storage is a cost, not a hard limit.

## Findings (Phase 0, 2026-10-07)
- **uscode.house.gov was down:** every page served a maintenance notice, and release-point zips
  returned 403.
- **govinfo's `USCODE` collection is not a substitute:**
  - It has annual editions only (2024 is the latest, issued 2024-12-31).
  - Each title package is per-section HTML and PDF, not USLM XML.
  - Title 10's zip is over 400 MB.
- **Tagged citations in stored bill text:** 88,081 `usc` citations, to 10,372 distinct sections, in
  17,712 of 28,246 bill versions.
  - Most tagged titles: 42, 26, 15, 20, 7.
  - Most tagged sections: 20 U.S.C. 1001, 8 U.S.C. 1101, 25 U.S.C. 5304, 26 U.S.C. 501.
  - In the stored head, citations are flat: `{ type, title, section, href, labels, cited_in }`.
- **GPO tags mainly the parenthetical form** ("(20 U.S.C. 1001)" after an Act's name).
  - Direct amendments in the form "Section 1074c of title 10, United States Code" are usually
    untagged; H.R. 10717 and S. 4530 have no `external-xref` at all.
  - 25,713 of 147,627 stored bill sections use the "of title N, United States Code" wording, and
    12,360 of those have no citation span.
  - Linking bills to the Code therefore needs our own recognizer for that wording, not just GPO's tags.

## Done
- [x] Phase 0 counts and source check (above)
- [x] Release point 119-36 (108 MB zip; 692 MB of XML in 58 title files) from the Internet Archive's
  capture; its captures of 119-73 and 119-83 are truncated. `fetch-uscode-releases.js` (`--archive`)
- [x] `parse-uscode-xml.js` (+ test, references `usc-t10-s1074c.xml`, `usc-t5-s8335.xml`, `usc-t42-s242k.xml`):
  hierarchy with USLM identifiers, section items with anchors, source credit (laws with dates and
  Statutes at Large pages), notes, footnotes, tables, quoted provisions; appendix titles (court rules,
  reorganization plans). Every title parses; 6 appendix `<level>`s without sections are reported, not stored
- [x] `usc-storage.js` + `load-uscode.js`: 70,402 units, 60,892 sections (51,453 in force), one version
  row each (content hash), 154,739 source credits, 4,583 linked to bills we hold. 508 MB in the database.
  Whole release in about 6 minutes; re-loading a release replaces its versions
- [x] `server/usc.js`: `uscTitles`, `uscTitle`, `uscChildren`, `uscSection`
- [x] Pages `/code` (titles; positive-law filter; go to a section), `/code/:title` (outline; headings
  list their sections when opened), `/code/:title/:section` (text, footnotes, source credit with bill
  links, notes behind a button, place in the Code, previous / next). "U.S. Code" in the header
- [x] Links into the Code: citation spans with a `usc` target (bills, orders, the Code itself) go to the
  section page, and to the subsection's anchor when known (`/code/5/8335#c`); the "U.S. Code" chips on
  the bill page too
- [x] `usc-references.js` (+ test): finds "Section 1074c of title 10, United States Code", lists of
  sections and written-out "10 U.S.C. 1074c" when bill sections are served. H.R. 10717 and S. 4530 link

## Todo
- [ ] Download and load the current release point when uscode.house.gov is back (119-36 is from
  September 2025); the second load is the first real test of versions across releases
- [ ] Phase 0: check whether House comparative prints are published in a usable form
- [ ] Text inside a Code section that refers to another without markup ("section 8336(e)" meaning
  "of this title") is not linked; the recognizer needs the title from context
- [ ] The 6 appendix `<level>`s with text but no sections (court forms in 11a, 28a) are not stored
- [ ] A section version seen in release A, changed in B and back in C would have one row spanning
  A–C; Phase 3 needs ranges per release (or a row per span) before loading history
- [ ] Phase 2: `amendment-instructions.js` + `usc_amendments`: classify amends / repeals / adds /
  cites, with the subsection target; bill page marks amending items, section page lists bills
- [ ] Phase 3: release points from 2020; history and diffs on the section page
- [ ] Phase 4 (stretch): redlines for pending bills
- [ ] Later: map non-positive-law references ("section 202 of the Social Security Act") to Code sections
