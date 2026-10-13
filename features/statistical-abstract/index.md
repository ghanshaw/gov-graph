# Statistical Abstract

## Status
Phase 2 (2026-10-13): every section page and table file fetched and read into `statab_*` tables. The source
registry is `features/data-sources`; the book's own contents are a category structure (`features/category-breakdowns`).

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
- The source registry (`features/data-sources`) is built first (2026-10-13).
- The Economic Data rules stand: series as their publishers print them, nothing computed, separate files never
  joined.

## Where a series sits (`placement`)
> Superseded 2026-10-13: placement is now the **measure's**, per structure, with `table` or `judgement`; see
> `features/category-breakdowns` (Measures and placements). The table below is kept for the reasoning.

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

### Phase 1 — source registry (`features/data-sources`) — done 2026-10-13
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
- Store as `statab_sections`, `statab_subsections` (as the web pages group the tables), `statab_tables`
  (`server/seed/load-statistical-abstract.js [--dry-run] [--json out.json]`).

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
- Read each source note into publisher(s) and publication. Group into datasets in the registry, reviewed by
  hand (expect a few hundred distinct publications).
- For each dataset: kind of publisher, licence, status today (active, renamed, moved to another agency,
  discontinued) with its successor, and how to get it (bulk file first).
- **Coverage report**: every table marked have / partly / wanted / licensed (not collected) / discontinued, and
  whether it is a time series, by place, or a single-year snapshot. Shown on the sources page and per section.

### Phase 4 — the catalogue in the Abstract's order
- Give every current series its subsection and `placement`.
- The timeline's catalogue (`DatasetSearch.jsx`) groups by section → subsection instead of the Economy tabs, with
  the wanted tables shown as not yet here.

### Phase 5 — collecting, section by section
- One section at a time, in an order to be chosen. Per table: find the publisher's current file, fetch it,
  label it (`series-dimensions.js`), name it (`series-names.js`), place it, load it.
- New places: territories (`pr`, `gu`, `vi`, `as`, `mp`) and countries, for sections 29 and 30.
- Tables that are not time series (one year by state, by age, by type) need a way to be shown; see open questions.

## Open questions
- **Economy tabs.** They cross-list (tariff revenue is under Trade and under Tax revenue; see
  `features/dataset-dimensions`). Keep them as they are and use the Abstract's order only in the catalogue, or
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
- [x] Section pages and all 1,396 table files fetched, read and stored (`statab_sections`, `statab_subsections`,
  `statab_tables`) (2026-10-13)
- [x] `server/lib/xls.js`: RK numbers with the top bit set (negative doubles) no longer throw (2026-10-13)
- [x] Page for the book's structure (first `/abstract`, nav "Abstract"; now the Structure page, `/structure`): the book's structure as its contents print it, 30 sections, 147 subsections,
  table ranges, printed page numbers and the appendices, with a find field. Data now in `server/seed/data/structures/statistical-abstract.json`,
  read from the PDF's contents pages (vii–x); not tied to GovGraph's data and no database tables (user, 2026-10-13).
  The downloaded PDF prints Education's pages twice and ends at page 876 (no appendices), so the page gives printed
  page numbers and does not link into it (2026-10-13)
- [x] A second view on `/abstract`, "Categories" (`?view=categories`): the same subjects as nested, folding categories
  with no section numbers, tables, pages or appendices. Category breakdowns are their own concept
  (see `features/category-breakdowns`, which now tracks the Structure page) (user, 2026-10-13)

## Todo
- [x] Phase 1: source registry built and loaded (`features/data-sources`, 2026-10-13)
- [x] Phase 2: fetch and read the section pages and table files (2026-10-13)
- [ ] Map web subsections to the book's subsections (by the tables' printed pages, from the section PDFs)
- [ ] Show the tables somewhere (on `/sources/statistical-abstract`, or under each category on `/structure`)
- [ ] Phase 3: source notes → datasets; coverage report
- [ ] Phase 4: placement for every current series; catalogue by section (the catalogue's Build tab is by section since
  2026-10-13, the 27 measures placed by judgement in `placements.json`; Phase 4 turns them into `table`)
- [ ] Phase 5: collect, section by section
