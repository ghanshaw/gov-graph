# Population

## Status
In Progress

## Goal
Population and demographics of the country, the states and the congressional districts, from the
Census Bureau, saved locally and shown as published: apportionment, census counts, annual estimates,
and the American Community Survey's tables on sex, age, race, Hispanic origin, nativity, income,
poverty, education, work, housing, disability, veterans and same-sex households.

## Decisions
- **Charted like Economic Data (2026-10-11, replaces "files only"):** the page is Demographic Data
  (`/demographics`, `/population` redirects), built on the same `SeriesPage` as Economic Data: topic
  tabs, series picker, facts, periods, slider, plus a place picker (nation, states, districts). The
  figures are loaded into `economic_series` / `economic_observations` with `measure` (the national
  slug) and `place` (`ca`, `ca-12-l113`); `economicSeriesList` leaves place series out, `seriesPlaces`
  lists them. The downloads stay in `../gov-graph-data` at the Census Bureau's own paths and are
  browsable in the Source Files tab. Earlier: "save data locally. dont change anything. surface raw data".
- **Estimates across decades are one series** (user: "its the exact same dataset just split up over
  time"): each year from the newest Census file covering it; the description lists which file gives
  which years. 1900–1969 are printed in thousands and stored as persons. No July 1970 or July 1980
  estimate is in the decade files, so those years are gaps.
- **Districts by lines:** a district series covers the years its lines held (2000, 2010 and 2020
  cycles, split at mid-cycle redraws listed in `lib/population/places.js`), keyed `ca-12-l113`.
- **ACS measures are found by label**, not line number: tables were reworded and renumbered (B11009
  counted only unmarried partners in early years). A year without the line is left out.
- **Raw figures:** tables keep the published row labels, estimates and margins of error. No derived
  measures.
- **Keyless sources only:** the Census API now requires a key, so the ACS comes from its
  table-based summary files (one file per table, every geography), which need none.
- **Sexual orientation and gender identity:** the decennial census and the ACS do not ask these.
  The ACS counts same-sex married and unmarried couple households (B09019, B11009), which is what is
  available at state and district level. The Household Pulse Survey asked both questions
  (2021–2024, by state); not yet included.
- **Class:** shown through income, poverty, education, occupation, employment and housing
  tenure, as the ACS publishes them.

## Sources (as far back as published)
- Apportionment, 1910–2020 (2020, 2010, 2000 apportionment folders; .csv, .xlsx, legacy .xls).
  1790–1900 seats are not in the Census Bureau's files found so far
- State counts at every census, 1790–1990 (`population_partii/iii/iv.xls`)
- Race (and Hispanic origin from 1970) for the U.S., regions, divisions and states, 1790–1990
  (Working Paper 56; 124 .xlsx files)
- National estimates by age, sex and race, yearly from 1900; state totals yearly from 1900
  (`st0009ts.txt` … `st8090ts.txt`), by age, sex, race and Hispanic origin from 1980, components
  of change from 2000
- Household income by state from 1959 (decennial), CPS historical household income tables
- ACS 1-year, 2005–2019 (sequence files) and 2021–2025 (table files; 2025 not posted yet), for the
  nation, states and congressional districts (109th Congress lines in 2005 onward)

## Done
- [x] ACS downloaded for 2005–2019 and 2021–2024 (about 1,000–1,400 files a year; 2021– are 27 files)
  and checked for every year: nation, states and districts found, B01001 U.S. total and a district's
  B19013 read correctly (2024: 340,110,990). The 2021– readers (Geos, Table Shells, .dat) work as
  written. Reloaded: 51,041 series, 296,957 values, 2005–2024. Education, labor force and same-sex
  spouses / partners are now found; "Foreign-born" (hyphenated from 2023) matched. "Speak only
  English" covers 44 states: the Bureau leaves small states out of B16001
- [x] `fetch-population.js`: `--years` takes lists (`2008,2011,2017-2019`); a folder answering
  401 / 403 is "not published yet"; a cached "Request Rejected" listing is reported as a failure,
  not read as an empty folder
- [x] Demographic Data page (2026-10-11): `lib/population/series.js` (catalog and readers),
  `places.js` (states, district lines), `seed/load-demographic-series.js`, `lib/series-storage.js`
  (shared with load-economic-series.js), `seriesPlaces` query, `components/SeriesPage.jsx` (Economy's
  page, now shared), `pages/Demographics.jsx`, `demography.js` (tabs). Loaded 15,138 series, 52,557
  observations: resident population 1900–2025 and census counts 1790–2020 (nation, states), House
  seats 1910–2020, births / deaths / migration 2011–2025, 35 ACS measures (nation, states, districts)
  for the years on disk (2005–2008 so far). Checked: U.S. 2000 282,162,411, 2020 331,578,104, 2025
  341,784,857; California 1850 92,597; Texas seats 18 → 38. Tests: `lib/population/series.test.js`
- [x] `acs-read.js`: the file cache gives way when full (it threw ECACHEFULL after 60 files) and zip
  listings are read once
- [x] `lib/population/sources.js` (catalog), `seed/fetch-population.js` (mirrors directories; ACS by
  year from the lookups; at most 2 requests at a time, backs off on HTTP 429)
- [x] `lib/population/acs.js` (+ test): the four lookup formats (2005 .xls without labels, 2006
  tab-separated, 2007–2008 .xls, 2009– comma-separated), duplicate Puerto Rico copies, tables split
  over two sequences, geography lines of every year
- [x] `lib/population/files.js`: any file as published (CSV / .dat grid, text, spreadsheet sheets via
  SheetJS, zip contents), only below the data folder's www2.census.gov
- [x] `lib/population/acs-read.js`: one table for one place and year (label, estimate, margin of error)
- [x] `server/population.js` queries; pages `/population`, `/population/file`, `/population/acs`;
  "Population" in the header
- [x] Downloaded: all collections (1,933 files, 255 MB); ACS 2005 (1,006 files). Checked 2005: nation,
  52 states + PR, 437 districts (109th); B01001 U.S. total 288,378,137
- [x] Picker lists only stored series and counts the rest ("2 more series appear once their source
  files are loaded"); it had shown blank checkboxes (2026-10-12)
- [x] 2011 ACS lookup read (its headers "Line Number Decimal M Lines", "Long Table Title"); reloaded
  through 2012: 20,020 series, 109,371 observations. Education labels confirmed (B15003 from 2008)

## Todo
- [ ] Re-run `load-demographic-series.js` as ACS years finish downloading (it replaces observations)
- [ ] Check the measures not yet found nationally once later ACS years are on disk: labor force (B23025;
  states and districts from 2011, no national file yet), same-sex spouses and partners (B09019)
- [ ] Speak only English (B16001) is found for 42 states and 182 districts only: check why
- [ ] Check the mid-cycle redraw list in `places.js` against the Census TIGER/Line notes
- [ ] Demographic series in dataset search (`DatasetSearch.jsx` lists Economy tabs only)
- [ ] Re-run the fetch for the CPS historical income folder (added to the catalog after the run started)
- [ ] Check the pages in Chrome (extension was disconnected; checked headless with Chrome for Testing)
- [ ] 2005 labels are borrowed from 2006 and say "2006 inflation-adjusted dollars"; the page says so
- [ ] Household Pulse Survey (sexual orientation, gender identity by state, 2021–2024)
- [ ] Apportionment 1790–1900 (seats per state before 1910)
- [ ] Decennial census by congressional district (2000, 2010 SF1 CD files) before the ACS began
