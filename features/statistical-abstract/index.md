# Statistical Abstract

## Status
2026-10-14: Phases 0, 1, 2 and 4 done (4 except showing wanted tables as not yet here). **Phase 3 is done**
(2026-10-14): every table has its programs, coverage, shape and, where held, its series; the report is at
`/sources/abstract-coverage` and on each program's page. Phase 4 is done too (2026-10-14). **Next: Phase 5** (collect),
starting with the 81 tables whose files are already in the data folder. Every table's subsection, printed page, title and source note is in
`server/seed/data/statistical-abstract-tables.json` (not the database); every measure is placed from them in
`placements.json`. The sources (publishers and programs) are `features/data-sources`; the Abstract as a taxonomy is
`features/taxonomies`.

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

**Progress.** Coverage is kept by hand in `server/seed/data/statistical-abstract-coverage.json` (per table: `programs`,
`coverage`, `shape`, `in_hand` when the publisher's file is already downloaded, `note`), checked by
`server/lib/abstract-coverage.js` (test `abstract-coverage.test.js`: every table of a section listed in `sections`
is covered, programs exist, `licensed` only for licensed programs). Programs not collected yet are in `sources.json`
with `collected: false`, `paths: []` and `access.best`.

- **Section 14, Prices (2026-10-14), 20 tables:** 5 partly (CPI groups and items, FHFA by state, EIA gasoline by
  city, BEA PCE by type), 10 wanted, 2 discontinued (PPI stage of processing: ended with January 2016 data, successor
  FD-ID), 3 licensed (C2ER Cost of Living Index; CRB futures and spot indexes). 8 of the 20 are already in the data
  folder. New programs: BLS Producer Price Index (`wp`, `pc`), BLS Import/Export Price Indexes (`ei`), EIA Monthly
  Energy Review (`TOTAL.zip`), USDA Food Plans (monthly PDFs, CNPP), and licensed C2ER and CRB. CPI average prices
  (table 733) are BLS survey `ap`, kept under the CPI program. Not confirmed: who owns CRB today, and when CNPP came
  under FNS's site. Found (2026-10-14, user asked): CRB was bought by Barchart in 2001 without its futures index, and
  renamed cmdty in 2019; the futures index is the FTSE/CoreCommodity CRB Index (LSEG and CoreCommodity Indexes), so
  735 and 736 are two programs. CNPP has been part of FNS since 2017; FNS is becoming the Food and Nutrition
  Administration (announced 2026-04-30). CPI average prices stay in the CPI program (user).
- **Section 9, Federal Government Finances and Employment (2026-10-14), 34 tables:** 2 partly (OMB receipts and
  outlays, receipts by source), 29 wanted, 1 discontinued (Consolidated Federal Funds Report, ended with the FY 2012
  budget; successor USAspending, not comparable), 2 unpublished (Treasury Office of Tax Analysis data, 494–495; a new
  coverage value with no program). OMB Historical Tables still to download: 3.2, 4.1, 6.1, 7.1, 11.3. New programs:
  OMB Analytical Perspectives, Treasury savings bonds (Fiscal Data), USAspending (not in the Abstract; successor),
  Census CFFR (discontinued), IRS Data Book, SOI individual income tax statistics, OPM Federal Workforce Data
  (data.opm.gov, replacing FedScope and the printed series the Abstract cites), GSA Federal Real Property Profile.
  The Bureau of the Public Debt and FMS merged into the Fiscal Service on 2012-10-07 (lineage). To check when
  collecting: whether OPM's data covers the legislative and judicial branches (496), and whether Fiscal Data's savings
  bonds give dollars as Table 478 does.
- **Section 12, Labor Force, Employment, and Earnings (2026-10-14), 81 tables:** 4 partly (CPS employment status,
  by sex and race, unemployed summary, by education: what the unemployment series already loaded cover), 72 wanted,
  2 discontinued (Mass Layoff Statistics, ended by the 2013 sequestration; the one-off 2005 Survey of Workplace
  Violence Prevention), 3 unpublished (BLS's unpublished CPS data, 604, 605, 619: tabulating the microdata would be
  our own series). 21 tables are in the `ln` file already. CPS supplements and BLS reports from the CPS (foreign-born,
  veterans, disability, tenure, displaced workers, contingent work, minimum wage workers, union members, women's
  earnings) are all the CPS program; usual weekly earnings (`le`) and union members (`lu`) are CPS files still to
  download. New programs: BLS CES, LAUS (with the Geographic Profile), Employment Projections, JOLTS, Business
  Employment Dynamics, Mass Layoff Statistics (discontinued), ATUS, Productivity and Costs, National Compensation
  Survey (ECI, ECEC, benefits), QCEW, NLS, Injuries, Illnesses, and Fatalities, Work Stoppages; DOL's ETA
  (unemployment insurance) and Wage and Hour Division (state minimum wages); Census Current Population Reports (one
  program for every series, as decided; Historical Income Tables stay a program of their own for now); and three
  private ones with licences not yet checked: NSC Injury Facts (its terms page refused the request), the Union
  Membership and Coverage Database (unionstats.com; no terms stated), the Families and Work Institute's National
  Study of Employers.
- **The other 27 sections (2026-10-14, user: "do all the sections"), 1,271 tables:** drafted by matching each source
  note against patterns, one per publication (the script stayed in the session's scratch folder; the coverage file is
  the record), then reviewed program by program and about 20 tables corrected by hand. 16 tables with no source note in
  the tables file were read from the files or the section PDFs; 7 not online and not legible in the PDFs were assigned
  by judgement and say so (867, 966, 967, 1025, 1029, 1033, 1400). 331 new programs (3 of them there only as
  successors or official alternatives) and 188 organizations.
- **Totals, all 1,406 tables:** 1 have (House apportionment), 37 partly, 1,191 wanted (81 of them already in the data
  folder: NIPA flat files, `cu`, `ln`, PET.zip, population estimates, ACS), 84 licensed, 63 discontinued, 25 unpublished,
  5 compiled (a new coverage value: the Abstract compiled them from sources named in footnotes, not yet traced). Shapes:
  707 time series, 364 by place, 335 snapshots. `sources.json`: 250 organizations, 409 programs (366 not yet
  collected; 56 licensed, 65 licence unchecked, 24 discontinued).
- **Licences:** non-federal programs not read on the publisher's site are `unchecked`; ones known to be sold are
  `licensed` from GovGraph's knowledge (noted as not read), not from each publisher's terms. OECD and World Bank data
  are believed to be CC BY 4.0 but recorded as unchecked until read.
- **Confirmed on the web (2026-10-14):** Current Industrial Reports ended in fiscal 2011; EIA's Annual Energy Review was
  not produced for 2012 (folded into the Monthly Energy Review); BLS International Labor Comparisons was cut in the
  2013 sequestration; NOAA retired its billion-dollar disasters database after 2024 data (Climate Central continues
  it); OHSS replaced DHS's Office of Immigration Statistics in 2023. Other discontinuations (Financial Crimes Report,
  NJRP, Homicide Trends, CNPP's expenditures on children, ITA aircraft shipments, FCC telephone trends, Fed new security
  issues, FHFA MIRS) are marked "not confirmed" in their notes.
- **Coverage report (2026-10-14):** `/sources/abstract-coverage` (`pages/AbstractCoverage.jsx`) lists every table under
  its section and subsection (a heading row per subsection, in book order; user, 2026-10-14): shape, page, note, programs (linked) and a coverage chip, with a bar of the
  coverage split, rail totals and filters for coverage, shape and section (kept in the URL) and a search. Each program's
  page has "In the Statistical Abstract" with its tables (`components/AbstractTables.jsx`); the sources list shows each
  program's table count. Served by the `abstractCoverage` query and `SourceProgram.abstractTables` /
  `abstractTableCount`, read from the files (`coverageReport` in `lib/abstract-coverage.js`, cached until a file
  changes); nothing in the database. A program a table cites now reports `inAbstract: true`. On a program's page the
  heading rows read "Section › Subsection". Checked in Chrome at 606px and wide.
- **Checks closing Phase 3 (2026-10-14):**
  - *Homepages:* every program's homepage requested (409). 358 answered at once; 25 refused scripts and were opened in
    Chrome; 33 were wrong or moved and are fixed (CDC, BEA, NCSES, USPTO, uscourts.gov and others). ARIS's Trinity College
    site no longer answers (homepage is now the Abstract table). The U.S. Code download page (`us-code-release-points`,
    an older program) returns "Page Not Found"; not changed.
  - *Status:* the "not confirmed" discontinuations checked. FHFA's Monthly Interest Rate Survey ended May 2019, FCC's
    Trends in Telephone Service ended 2010, the Coast Guard's pollution series ended 2001 (MISLE since): their tables
    1193, 1145, 1147, 386 are now discontinued. The Fed's corporate New Security Issues is still published. Last editions
    recorded for the FBI Financial Crimes Report (FY 2010–11), BJS firearm checks (2015), NJRP (2006), CNPP expenditures
    on children (2015 data), S&P's Global Stock Markets Factbook (2013), the ALA/UMD library study (2011–12); the
    Educational Research Service closed in 2011. Nothing found about Pforzheimer's or FIBER's publications.
  - *Licences:* the 65 unchecked programs' terms searched. 3 are public domain after all (USGS geographic facts, OJJDP's
    juvenile court statistics, HRSA's OPTN data); 4 open licences (OECD and World Bank CC BY 4.0, ITU DataHub CC BY-NC-SA
    3.0 IGO); 18 free with terms (Pew, IMF, UNAIDS, NBER, ANES, unionstats, CAWP, Philadelphia Fed, Guttmacher, ACS,
    College Board, U.S. Religion Census, RIAA, APTA, SIFMA, MLA, NEA, ACLI); 5 restricted or sold, so licensed (UN
    Tourism, ICI, AAUP, NYSE, AF&PA; their tables now licensed). 36 stay unchecked: 25 searched with no terms found
    (noted), 11 not searched (FWI, AAAS, Puerto Rico, DC, Michigan, ARIS, AOA, Aesthetic Society, ALA/UMD, TechAmerica,
    NALEO).
  - *Series named (user, 2026-10-14):* every have / partly table lists what is loaded in a `series` field (series slugs,
    measures, or `prefix--*` for the published groups), checked by the test and resolved from the database on the page:
    "Loaded: Resident Population (yearly, 1900–2025; nation, 50 states, DC and Puerto Rico)". Series sharing frequency,
    years and places are named together. This showed three notes wrong: tables 35 and 191 said the ACS disability table
    (B18101) was loaded, but it is only downloaded (now wanted, file in hand); 53's English-only series covers 43 states
    and DC, not every state. A page per measure (`/series/<measure>`, places as a parameter) is the planned link target;
    not built yet (user chose names first).
  - *Review (2026-10-14; user: "finish 3"):* Claude reviewed the 27 rule-drafted sections in two passes instead of the
    user. (1) Each table's source note against its programs' publishers: 69 flags, all spelling or renamed bodies
    (Medicare "&", Air Transport Association, Foundation Center) or the 16 notes read from PDFs, except table 144
    (Trustees Report, moved to `medicare-trustees-report`), SUSB (SBA added as distributor) and Economic Indicators
    (the Council of Economic Advisers, new organization, as publisher). (2) Titles read program by program for the
    publishers with many programs (Census, BEA, NCHS, EIA, NCES, the Fed, USDA, BJS): no misplaced table found. The
    slug `ers-national-survey-of-salaries` (Educational Research Service, easily read as USDA's ERS) is now
    `educational-research-service-salaries`. The 7 tables assigned by judgement (867, 966, 967, 1025, 1029, 1033, 1400)
    stand, each saying so; the user may still spot-check any section.
  - Totals now: 1 have, 35 partly, 1,178 wanted, 95 licensed, 67 discontinued, 25 unpublished, 5 compiled. Licences:
    287 public domain, 4 open, 21 free with terms, 61 licensed, 36 unchecked.

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
- Wanted tables shown as not here yet (2026-10-14): in the timeline catalogue's Build tab, with the Statistical Abstract
  chosen, each subsection ends with a folded "Not here yet · N tables" line listing its tables with nothing loaded (not
  have or partly; partly tables' data is a measure in the tree), each with its coverage chip and a link to the coverage
  report (new tab, so the timeline keeps its state). The filter matches their titles. Fetched with `abstractCoverage`
  only when the Abstract is chosen (`SeriesBuilder.jsx`, `TaxonomyTree.jsx`). Below 860px the tree gives way to the
  measure select, which does not list them.

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
- [x] Phase 3 mapping: every table's programs, coverage and shape (2026-10-14)
- [x] Phase 3 review: the 27 rule-drafted sections checked against publishers and titles (Claude, 2026-10-14)
- [x] Phase 3 report: `/sources/abstract-coverage` and each program's tables (2026-10-14)
- [x] Phase 4 placements: every measure placed from the tables; measures split where the Abstract splits them (2026-10-13)
- [x] Subsections are the website's groups, not the contents' topics (user, 2026-10-13)
- [x] Phase 4 rest: wanted tables shown as not here yet in the catalogue's Build tab (2026-10-14)
- [ ] Phase 5: collect, section by section
