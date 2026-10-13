# Statistical Abstract

## Status
Phases 0–2 done, Phase 4's placements done (2026-10-13). Every table's subsection, printed page, title and source note
is in `server/seed/data/statistical-abstract-tables.json` (not the database); every measure is placed from them in
`placements.json`. Next: Phase 3 (source notes → programs). The sources (publishers and programs) are
`features/data-sources`; the Abstract as a taxonomy is `features/taxonomies`.

## Goal
Use the **Statistical Abstract of the United States, 2012** (131st edition, the last the Census Bureau published;
it ended the program on October 1, 2011) as the foundation for all the data GovGraph collects:

1. **A shopping list.** Every table (about 1,400 in 30 sections) has a source note naming the agency or body and
   publication behind it. Collect that publisher's current, full data, not the Abstract's 2011 snapshot.
2. **The organisation of the data.** The timeline's catalogue follows the Abstract's order, section →
   subsection (Construction and Housing → Home sales, Homeownership, …).

## Decisions
- The 2012 edition, not the 2010 one first linked (user, 2026-10-13).
- Every section is in scope, including Puerto Rico and the Island Areas and International Statistics, and
  tables broken down by state or country, not only national time series (user, 2026-10-13).
- "Download all the data referenced in the abstract" (user, 2026-10-13): each table's source is traced to its
  publisher today and collected from there. The Abstract's own numbers are kept as files, not loaded as series.
- A series belongs to exactly one subsection, for now (user, 2026-10-13). The Abstract's ordering is used as is.
- Where the Abstract does not place a series, GovGraph chooses its subsection, and **says so**: every series
  records how its place was decided (`placement`, below), and the catalogue marks the ones placed by judgement.
  A dataset the Abstract never cites is flagged on the sources page (`features/data-sources`).
- Tables whose source is licensed are listed with a link to the publisher and not collected, for now
  (user, 2026-10-13).
- The sources (`features/data-sources`) are recorded first (2026-10-13).
- Every Census "Current Population Reports" series (P20, P25, P60, …) is one program (user, 2026-10-13).
- The Economic Data rules stand: series as their publishers print them, nothing computed, separate files never
  joined.

## Where a series sits (`placement`)
> Superseded 2026-10-13: placement is now the **measure's**, per structure, with `table` or `judgement`; see
> `features/taxonomies` (Measures and placements). The table below is kept for the reasoning.

| Value | Meaning | Recorded with it |
|---|---|---|
| `table` | The series appears in an Abstract table | the table number(s) |
| `subsection` | Its dataset is cited in the Abstract, but this series is in no table; it goes in the subsection where that dataset's tables are | the tables citing the dataset |
| `judgement` | Neither: GovGraph chose the subsection | a sentence saying why |

Examples: the unemployment rate is `table` (Labor Force, Employment, and Earnings). A series from a dataset that
started after 2011, or that the Abstract never used, is `judgement`. A test checks every series has a placement
and that a `judgement` has its reason, the way `series-names.test.js` checks names.

## Plan

### Phase 0 — the book
- [x] `2012-statab.pdf` (32 MB) in the data folder under
  `www2.census.gov/library/publications/2011/compendia/statab/131ed/` (2026-10-13)

### Phase 1 — sources (`features/data-sources`) — done 2026-10-13
Organizations, datasets, files and licences for everything already used, before anything new is collected.
Phase 2's downloads go through `recordFetch` and become files of the `statistical-abstract` dataset.

### Phase 2 — the Abstract's skeleton
- Fetch the index page, the 30 section pages and the six other pages (`census.gov/library/publications/2011/compendia/statab/131ed/<slug>.html`),
  and every file they link under `131ed/`: each table as `…/131ed/tables/12sNNNN.xls` (binary Excel), the section
  PDFs, front matter and appendices (`server/seed/fetch-statistical-abstract.js`). One request at a time, 500 ms
  apart; www2.census.gov answers 429 when pushed and the script waits. The other pages (rankings, brief, maps) link
  files of earlier editions (129ed, 130ed) only; not fetched.
- Read each table (`server/lib/statab.js`, test `statab.test.js` against copies in `server/references/statab-*`):
  number, title, headnote, column heads, row labels with depth, symbols, footnotes, notes, source note, "For more
  information" links, release date, years named (range and count), whether the rows are the states.
- Write `server/seed/data/statistical-abstract-tables.json` (`server/seed/build-abstract-tables.js [--dry-run]`): one
  line per table with its section, printed page, category in the book's taxonomy, title, whether the website links it,
  and its source note. Tables are evidence, so not in the database (user, 2026-10-13).
- Each section's PDF gives every table's printed page; the book's subsections start at the pages the contents give,
  so a table belongs to the last subsection starting on or before its page, or to the section itself before the
  first. The PDFs also hold the 10 tables the website does not link: 298, 697, 867, 966, 967, 1025, 1029, 1033, 1254,
  1400 (1,406 in all, as the contents say).

What the pages and files showed (2026-10-13):
- Each table file has the same layout: a description for screen readers naming the column-head rows ("column headers
  in rows 4 through 6"), "Table N. Title", the headnote in brackets, heads, body (".." per level in the row labels),
  symbols, "FOOTNOTES:", "Source: …", "For more information:" with links, "Internet release date: …".
- The web pages group tables into 206 subsections, listed alphabetically; the book's contents group them differently
  (147 subsections in `structures/statistical-abstract.json`). Web subsections interleave (Housing Sales is 973–980,
  inside Authorizations, Starts And Completions 968–981).
- 1,396 tables online. Not on any page, though inside the book's ranges: 298, 697, 867, 966, 967, 1025, 1029, 1033,
  1254, 1400. Listed twice: 587 (Labor Force Status; Employment Projections), 868 (Farms And Farmland; Crops).
- Some files carry another table's number: 12s0164.xls is "Table 160", 12s0208.xls "Table 204" (reported by the
  loader; the page's number is kept).

### Phase 3 — from source notes to datasets
- Read each source note into publisher(s) and publication. Group into programs in the sources (`sources.json`), reviewed by
  hand (expect a few hundred distinct publications).
- For each dataset: kind of publisher, licence, status today (active, renamed, moved to another agency,
  discontinued) with its successor, and how to get it (bulk file first).
- **Coverage report**: every table marked have / partly / wanted / licensed (not collected) / discontinued, and
  whether it is a time series, by place, or a single-year snapshot. Shown on the sources page and per section.

### Phase 4 — the catalogue in the Abstract's order
- Give every current series its subsection and `placement`. Done 2026-10-13: 17 of 29 measures by table, 12 by
  judgement (the reason names the nearest table). Where the Abstract prints a measure's series in two subsections they
  became two measures of the same name (user: a measure is a unique path): Consumer prices (CPI, Table 725) and
  Consumer prices (PCE, Table 739, Price Indexes); Home prices (Census, Housing Sales) and Home prices (FHFA, Table
  729, with the price indexes by state). A measure's key is its place and name (`prices/price-indexes/consumer-prices`).
- `table` evidence means the table prints the series' own data from the same publisher. Where the Abstract prints the
  measure from someone else, the placement is a judgement that says so: Table 1197's 30-year mortgage rate is
  Bankrate's (copyright), not Freddie Mac's; Table 470's federal debt is OMB's, not Treasury's daily figure.
- The catalogue's Build tab is the Abstract's sections and subsections (done before Phase 4).
- Still to do: show wanted tables as not yet here (needs Phase 3).

**Subsections changed (user, 2026-10-13).** The book's contents list only selected topics per section, with the page
each starts on; they do not divide the tables (Forestry, Fishing, and Mining lists Timber, Fishery, and Petroleum, so the
mining tables 901–911 fell under Fishery). The subsections are now the groups the Census website lists each section's
tables under: 206, every online table in exactly one, ordered by first table. The contents are kept as each section's
`contents` for the page's book view. Old subsection ids were dropped (`build-abstract-taxonomy.js --new-subsections
--allow-removing`, once).

### Phase 5 — collecting, section by section
- One section at a time, in an order to be chosen. Per table: find the publisher's current file, fetch it,
  label it (`series-dimensions.js`), name it (`series-names.js`), place it, load it.
- New places: territories (`pr`, `gu`, `vi`, `as`, `mp`) and countries, for sections 29 and 30.
- Tables that are not time series (one year by state, by age, by type) need a way to be shown; see open questions.

## Open questions
- **Economy tabs.** They cross-list (tariff revenue is under Trade and under Tax revenue; see
  `features/series-dimensions`). Keep them as they are and use the Abstract's order only in the catalogue, or
  rebuild them as sections? Leaning: keep the tabs for now.
- **Snapshot tables.** Many tables are one year broken down by something ("Arrests by Sex and Age: 2009"). Their
  publishers usually print a new one each year. Show them as series of yearly snapshots by place or group, or as
  tables of their own?
- **Order of sections** for Phase 5.
- **Documents in the Abstract.** Elections and Courts tables count things GovGraph holds as documents (bills
  vetoed, measures enacted, Supreme Court cases). Collect the publishers' counts and link them to the documents?
- **Storage.** Unknown until Phase 3; the database is about 2.1 GB.

## Done
- [x] Discussed and agreed the approach (2026-10-13)
- [x] Downloaded the 2012 edition's PDF (2026-10-13)
- [x] Section pages and all 1,396 table files fetched and read (2026-10-13)
- [x] `server/lib/xls.js`: RK numbers with the top bit set (negative doubles) no longer throw (2026-10-13)
- [x] Page for the book's structure (first `/abstract`, nav "Abstract"; now the Structure page, `/taxonomies`): the book's structure as its contents print it, 30 sections, 147 subsections,
  table ranges, printed page numbers and the appendices, with a find field. Data now in `server/seed/data/taxonomies/statistical-abstract.json`,
  read from the PDF's contents pages (vii–x); not tied to GovGraph's data and no database tables (user, 2026-10-13).
  The downloaded PDF prints Education's pages twice and ends at page 876 (no appendices), so the page gives printed
  page numbers and does not link into it (2026-10-13)
- [x] A second view on `/abstract`, "Categories" (`?view=categories`): the same subjects as nested, folding categories
  with no section numbers, tables, pages or appendices. Category breakdowns are their own concept
  (see `features/taxonomies`, which now tracks the Structure page) (user, 2026-10-13)

## Todo
- [x] Phase 1: sources recorded and loaded (`features/data-sources`, 2026-10-13)
- [x] Phase 2: fetch and read the section pages and table files (2026-10-13)
- [x] Tables are evidence, never shown as data (user, 2026-10-13): no page of their own
- [x] The website's headings are not the book's subsections; not kept (2026-10-13)
- [x] Every table mapped to the book's subsection by its printed page, from the section PDFs; written with its source
  note to `statistical-abstract-tables.json`; the `statab_*` tables dropped from the database (user, 2026-10-13)
- [ ] Phase 3: source notes → datasets; coverage report
- [x] Phase 4 placements: every measure placed from the tables; measures split where the Abstract splits them (2026-10-13)
- [x] Subsections are the website's groups, not the contents' topics (user, 2026-10-13)
- [ ] Phase 4 rest: wanted tables shown as not yet here (after Phase 3)
- [ ] Phase 5: collect, section by section
