# Data Sources

Renamed 2026-10-13 to follow `GLOSSARY.md`: the registry's middle level is a **program** (statistics) or
**collection** (documents), stored in `source_programs`; "dataset" in older entries below means the same. A *series* is
one date-and-value line (`economic_series`).

## Status
In progress (2026-10-13). The registry is built and loaded: 44 organizations, 8 lineage entries, 43 datasets,
22,797 files (4.3 GB) and all 51,406 economic and demographic series linked to a dataset. `/sources` and
`/sources/:slug` read it. Not yet: moving off API keys, folding in the Demographics Source Files tab.

## Goal
Keep track of every source GovGraph uses: who publishes it, what it is, which files were downloaded and when,
its licence, how it is fetched, and where it sits in the Statistical Abstract (`features/statistical-abstract`).
Publishers are increasingly not U.S. federal agencies (international bodies, foreign governments, industry,
universities), and agencies are renamed, merged, moved and abolished, so the publisher is a record of its own
with a history.

## Decisions
- Four levels: organization → dataset → file → series (user and Claude, 2026-10-13).
- Bulk downloads from the publisher are preferred over APIs, and APIs with keys least of all (user, 2026-10-13).
- Every dataset records its licence or terms where they can be found (user, 2026-10-13).
- A dataset the Statistical Abstract never cites is flagged, with the reason it was added (user, 2026-10-13).
- A contact address goes in a fetch's User-Agent only for publishers that require one (BLS:
  `BLS_CONTACT_EMAIL`) (user, 2026-10-13). The dataset records whether it is required.
- This registry comes before collecting anything from the Statistical Abstract (2026-10-13).

## The model

**Organization**: the agency or body. Name, short name, kind (`federal`, `state`, `international`,
`foreign-government`, `industry`, `academic`, `nonprofit`, `private`), parent (BLS → Department of Labor),
country, website.

**Organization lineage**: predecessor → successor, date, kind (`renamed`, `merged`, `transferred`, `split`,
`abolished`), and the document that did it as a reference (`fr:`, `usc:`, `bill:`, like `periods.json`), so it
becomes a link once that document is loaded. E.g. ERDA → Department of Energy (1977); Bureau of Mines' minerals
work → USGS (1996); Office of Technology Assessment abolished (1995).

**Dataset**: a program or publication (the Current Population Survey; the national accounts; Debt to the Penny;
OMB's Historical Tables; the Statistical Abstract itself).
- Organizations with a role: `publisher`, `producer` (Census runs the CPS for BLS), `distributor`.
- Kind: `statistics` or `documents` (Federal Register, bills, opinions, the U.S. Code).
- Licence (below), terms URL, date the terms were checked.
- Access: `bulk`, `file`, `api`, `api-key`, `page` (scraped HTML), `archive` (Internet Archive); the best one
  available is recorded and the one used, if different, with why.
- Status: `active`, `discontinued`, `moved` (with the successor dataset).
- Homepage, description (GovGraph's own words).
- In the Abstract: derived from the Abstract tables that cite it. A dataset cited by none is shown as **Not in the
  Statistical Abstract** with `outside_abstract` saying why (started after 2011; the Abstract used another source
  for the measure; a document source). A test refuses a dataset with neither.

**File**: what was downloaded. URL, path in the data folder, fetched at, size, sha-256, and the Internet Archive
capture when it came from there. Written by the fetch scripts through one shared helper, never by hand. Files
already in the data folder are backfilled by scanning it (date from the file, URL from the mirrored path).

**Series**: `economic_series` gains `dataset` (replacing the free-text `source` key: `bea`, `treasury-mts`, …),
the file it was read from, and its subsection and `placement` (`features/statistical-abstract`).

Organizations, lineage and datasets are written by hand in `server/seed/data/sources.json` and loaded by
`server/seed/load-sources.js`; schema in `server/lib/sources.js`.

## Licences
| Value | Meaning | Examples |
|---|---|---|
| `public-domain` | U.S. federal works (17 U.S.C. § 105), or dedicated (CC0) | BLS, BEA, Census, @unitedstates |
| `open-licence` | Named licence and the attribution it asks for | World Bank (CC BY 4.0), UK (Open Government Licence) |
| `free-with-terms` | Free to read; the terms limit reuse (what they limit is recorded) | Michigan consumer sentiment |
| `licensed` | Paid or licensed | NAR existing-home sales, Conference Board |
| `unchecked` | Terms not yet read | |

The licence is on the dataset, not the organization: a federal publication can reprint private data that stays
the private publisher's (the Statistical Abstract warns of this for its private-source tables), and foreign
governments' data is not public domain under U.S. law.

`licensed` datasets are listed with a link and not collected, for now (user, 2026-10-13).

## Moving off API keys
| Used now | Bulk instead |
|---|---|
| Congress.gov API (`CONGRESS_API_KEY`) | govinfo BILLSTATUS bulk (already used for whole Congresses) |
| EIA API (`EIA_API_KEY`) | EIA bulk zips (e.g. `PET.zip`), no key |
| BLS API (unemployment) | `download.bls.gov` survey files (already used for `ln`, `cu`) |
| Census API (new-home prices, `CENSUS_API_KEY`) | New Residential Sales history spreadsheet |
| govinfo API (`GOV_INFO_KEY`) | govinfo bulk data |
| CourtListener API (`COURTLISTENER_TOKEN`) | CourtListener bulk exports; the API may stay for finding new slip opinions, as the exports are periodic |

Each change is checked by comparing the series before and after: same values, same dates.

## The page
`/sources`, read from the database: datasets grouped by organization, filters for kind, licence, access, status
and in / not in the Abstract; each dataset opens to its files and the series made from them, with the Abstract
tables that cite it. The Demographics "Source Files" tab and the file viewer (`/population/file?path=`) move
here. The Abstract's coverage report (`features/statistical-abstract`, Phase 3) is a view of the same tables.

## Open questions
- Granularity: is OMB's Historical Tables one dataset or one per table? Leaning: one per publication as the
  publisher names it; tables are files.

## How it is built
- `server/seed/data/sources.json`: organizations, lineage, datasets, entered by hand. A dataset's `paths` are
  prefixes of its files' paths in the data folder (longest wins); `series_sources` names the `source` keys of
  series read from many files (demographic series). Every other series goes by its file (`seriesFile`).
- `server/lib/sources.js`: vocabularies, `checkSources`, `pathMatcher`, `seriesMatcher`, `urlFromPath`, schema
  (`source_organizations`, `source_lineage`, `source_programs`, `source_program_organizations`, `source_files`,
  `economic_series.dataset`). Test `sources.test.js`: the file is sound, every series has a dataset.
- `server/seed/load-sources.js [--dry-run] [--no-files]`: stores the registry, scans the data folder (sha-256,
  kept until a file's size or time changes; first run about 50 s, then about 40 s), links series. Reports files
  that match no dataset.
- Fetch log: `recordFetch(file, url, { archive })` (`lib/data-dir.js`) appends to `<data dir>/fetch-log.jsonl`;
  every fetch script and loader that downloads into the data folder calls it. Files fetched before it have
  their URL guessed from the path (`url_inferred`).
- `lib/series-storage.js` sets `economic_series.dataset` on every store.
- `server/sources.js`: `sourceDatasets`, `sourceDataset(slug)` (folders, national series, lineage),
  `sourceFiles(dataset, folder)` (its own query, so opening a folder does not replace the page's dataset in
  Apollo's cache), `sourceVocabulary`. Pages `DataSources.jsx` (filters: publisher kind, terms, fetched by,
  Statistical Abstract), `SourceProgram.jsx`.

## Findings (2026-10-13)
- **University of Michigan consumer sentiment**: the usage agreement forbids reproducing, distributing or
  publishing the data without written consent. It is shown on the Economy page and the timeline. Not changed;
  needs a decision.
- **Freddie Mac mortgage rates**: the PMMS page allows use with attribution, but the site's Terms of Use forbid
  publishing data and automated collection without an agreement. Recorded as free-with-terms; needs a decision.
- **Supreme Court Database** moved from scdb.wustl.edu (refuses connections) to scdb.la.psu.edu; `seed/scdb.js`
  still names the old address. Its licence was not found.
- Several fetchers send `BLS_CONTACT_EMAIL` to publishers that do not require it (BEA, Census and other single
  files in `fetch-economic-series.js`, `fetch-reports.js`), against the decision above. Not changed yet: removing it
  could make a publisher refuse; to be tried source by source.
- The data folder has both `census.gov/` and `www.census.gov/`, `usitc.gov/` and `www.usitc.gov/` (some fetchers
  bypass `mirrorFile`, which drops "www.").
- `courtlistener.com/scotus-slip-opinions.json` is GovGraph's own match list, not a download.

## Done
- [x] Agreed the model (2026-10-13)
- [x] `sources.json`: 44 organizations, 8 lineage entries, 43 datasets; non-federal terms read and dated (2026-10-13)
- [x] Schema, loader, test (2026-10-13)
- [x] Fetch log in every downloader; 22,797 files backfilled from the data folder (2026-10-13)
- [x] Every economic and demographic series linked to its dataset, and set on each store (2026-10-13)
- [x] `/sources` and `/sources/:slug` from the database, checked in Chrome (2026-10-13)

- [x] Renamed dataset → program (2026-10-13): `source_programs`, `source_program_organizations`, `source_files.program`,
  `economic_series.program` (tables and columns renamed in place, nothing reloaded), `sources.json` `programs`,
  GraphQL `SourceProgram`, `/sources/<program>` (`SourceProgram.jsx`); list headings Programs / Collections

## Todo
- [ ] Revisit Michigan sentiment and Freddie Mac: both kept for now although their terms forbid republishing (user, 2026-10-13)
- [ ] Contact address only where required: drop `BLS_CONTACT_EMAIL` from the other fetchers, checking each still works
- [ ] Replace API-key fetches with bulk files, one source at a time
- [ ] Fold the Demographics Source Files tab in; make the file viewer (`/population/file`) read any dataset's files
- [ ] Point `seed/scdb.js` at scdb.la.psu.edu; check its licence
- [ ] Put the stray `www.` folders under one path
- [ ] More lineage (agencies whose history matters for a series as it is collected)
