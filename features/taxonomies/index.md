# Taxonomies

Renamed 2026-10-13 from "Category breakdowns" / the Structure page, to follow `GLOSSARY.md`: a *taxonomy* is an
official hierarchy of categories; *structure* below, in older entries, means the same.

## Status
In use (2026-10-13). The **Taxonomies** page (`/taxonomies`, nav "Taxonomies"; `/structure` and `/abstract` redirect)
shows two taxonomies as nested categories: the Statistical Abstract (also as the book) and the Comparative Agendas
Project's topics. Each is stored as a JSON file, as are the placements; none of it is in the database (user,
2026-10-13). Category ids are frozen (`keepIds`). Other schemes surveyed below. The timeline
catalogue's **Build** tab reaches measures through either taxonomy (`TaxonomyTree.jsx`), with the 27 measures placed
in both by `server/seed/data/placements.json`, every placement a `judgement` for now.

## Goal
Ways of sorting everything GovGraph holds (datasets, series, documents) into nested subjects. A breakdown is a
general category tree that may *happen* to mirror a source (the Abstract), not a picture of that source: no section
numbers, tables or pages. Several breakdowns can exist side by side, and the reader can switch between them.

## Decisions
- The Categories view is separate from the book view; the book view stays (user, 2026-10-13).
- Breakdowns are their own concept, not tied to the Abstract's data (user, 2026-10-13).
- Categories are drawn as a nested tree with elbow connectors (├─ / └─) (user, 2026-10-13).
- No appendices in the Categories view (user, 2026-10-13).

## How it is built
- **Data:** one JSON file per structure in `server/seed/data/taxonomies/`, next to the other hand-written data:
  `{ id, name, basis, levels, source, categories }`; a category is `{ id, name, children }` plus whatever its scheme
  gives. Decided 2026-10-13 (user asked whether to store them as data): JSON files now, no database tables until
  series or documents are placed in categories and need joining.
  - `statistical-abstract.json`: 30 sections (`code` = the section number, `description`, `tables` [first, last],
    `page`) → 147 subsections (`page` only), plus `appendices` and `index_page`. Built by
    `server/seed/build-abstract-taxonomy.js` from the book's PDF: the contents (pp. vii–x), and each section's
    opening paragraph ("This section presents …") as its description. The book neither numbers nor describes
    subsections, so they have no code or description (not invented).
  - `comparative-agendas.json`: 21 major topics → 213 subtopics, with `code`, `description`, and `see_also` / `note`
    where printed; built by `server/seed/fetch-cap-codebook.js` from the Master Topics Codebook v1.1 page. The
    codebook says 220 subtopics; the page lists 213 (recorded in `source.note`). The parser handles the page's two
    irregular entries, 1612 ("Description;") and 2300 (description in a nested list).
- **Client:** `client/src/taxonomies.js` imports the files through the `@data` alias (`client/vite.config.js`, with
  `server.fs.allow: ['..']`). The server can read the same files when placements need them.
- **Page:** `client/src/pages/Taxonomies.jsx`. Rail: Structure (one radio per file), Show as (Categories / The book,
  only for a structure with `appendices`), Find, Codes and Descriptions (when the structure has them; both off by default), counts per level, source.
  URL `?s=<id>&as=book`, defaults left out. `/abstract` redirects. Category tree with elbow connectors (`.category-*`,
  `--branch`); the book layout `.abstract-*`.

## Measures and placements
How data is put into a structure (agreed in discussion, 2026-10-13).

- **Measures are GovGraph's own fixed list** (`MEASURES` in `server/lib/series-dimensions.js`): what can be measured
  ("GDP", "Federal revenue", "Unemployment"), defined once, independent of every structure. Each series belongs to one
  measure. The list grows as data is collected (27 today, from the Economy tabs); it is stable, not final.
- **The list stays flat** (user, 2026-10-13). No parent level of our own: the structures do the grouping. A grouping of
  measures would make a GovGraph taxonomy to maintain.
- **Each structure is mapped to the measures, not changed by them.** The structure files stay as the publisher prints
  them (they are rebuilt by script, and CAP's carries its licence); what we write is a **placement**: this measure sits
  in this category of this structure, and why.
- **A measure is the leaf** of every structure: category → subcategory → measure, then the measure's Build choices
  (`features/series-dimensions`). Design: `design/timeline-data/build-structures/wide-tree-1.html` (D.1).

### A placement
| Field | Example |
|---|---|
| structure | `abstract`, `cap` |
| measure | `gdp` |
| category | `income-expenditures-poverty-and-wealth/gross-domestic-product` (an id in that structure's file) |
| basis | `table` (the publisher's structure puts it there: the Abstract tables holding its series, by number), `crosswalk` (derived through a mapping between structures; which one) or `judgement` (GovGraph chose; a sentence saying why) |

This replaces the per-series `placement` in `features/statistical-abstract` (`table` / `subsection` / `judgement`):
the place is the measure's; table numbers are gathered from its series as the evidence; a series cited in the
Abstract but in no table counts as `table` if its dataset's tables are in that subsection, else `judgement`.

### Rules (proposed, not yet decided)
Built so far (2026-10-13): `placements.json` uses `basis` `table` or `judgement`, plus `{ left_out: true, reason }`
shown as "Not in this structure". The fuller vocabulary under "Who places what" (`publisher`, `published-crosswalk`,
`crosswalk`) and its "Not placed" bucket are not built; adding a basis is a change to `BASES` in
`server/lib/taxonomies.js`.

- One place per measure per structure, as the Abstract plan already says. If a measure's datasets want two places
  (tariff revenue: a tax, and foreign trade), split the measure rather than cross-list it.
- A measure is narrow enough to have one home and broad enough to be worth choosing within; finer distinctions (rate or
  level, which tax, which group) are its dimensions, not separate measures. Abstract tables on one subject broken down
  different ways usually make one measure.
- **A coarser structure:** use its own catch-all where it has one (CAP's "General" and "Other" subtopics); else place
  the measure directly under a top-level category (the tree is two levels there); else leave it out of that structure.
- **Not in this structure:** a measure may have no placement in a structure, on purpose. The tree lists such measures
  last, so switching structures never hides data. CAP sorts policy documents, not statistics; every CAP placement of a
  measure is `judgement`, and some measures (consumer sentiment) may have no honest home there. See "Who places what" below for
  how CAP places statistics.
- **A finer structure:** the Abstract's tables are below its subsections; they are not a level in the tree, only the
  evidence recorded with a placement.
- Stored as hand-written JSON, for example `server/seed/data/placements.json` (`{ structure: { measure: { category, basis,
  tables | reason } } }`), with a test: every measure placed (or marked left out) in every structure, every category
  id exists, every `judgement` has its reason, every `table` its table numbers.

### Who places what (proposed 2026-10-13, not yet decided)
No structure places everything GovGraph holds. Each is authoritative for one side and silent on the other:

| | Data (measures, series, datasets) | Documents (bills, orders, decisions, laws) |
|---|---|---|
| **Abstract** | Placed by the publisher: each table cites its dataset | Silent: it counts laws and cases, never places one |
| **CAP** | Silent: CAP codes policy activity, not statistics | Placed by the publisher: CAP's coded datasets (bills 80th–114th Congress by `bill_id`, the same form as our `source_id`; executive orders; Supreme Court cases; public laws; hearings) |
| **OMB budget functions** (if added) | Spending series by function | Programmes and appropriations; silent on court decisions |

Filling a structure's silent side is always GovGraph's own work, and is marked as such:

- **Every placement records who made it** (`basis`), most authoritative first:
  1. `table` / `publisher`: the structure's own publisher placed it (an Abstract table; a CAP code in CAP's data).
  2. `published-crosswalk`: a mapping the publisher itself prints. CAP's Budget Authority–Policy crosswalk maps OMB
     budget subfunctions to CAP topics, so our spending series by budget function go into CAP by CAP's own mapping.
  3. `crosswalk`: derived through GovGraph's own mapping between structures (which one is recorded).
  4. `judgement`: GovGraph placed this item by hand, with a reason.
- **Each structure declares what it covers** (`covers: ['data']` / `['documents']`, in GovGraph's metadata about the
  structure, not in the publisher's categories). On a structure's silent side the page says plainly that the
  arrangement is GovGraph's, and a filter can show publisher placements only.
- **An item's own placement beats a derived one.** A `judgement` or `publisher` placement overrides what a crosswalk
  would give, so a wrong crosswalk row can be corrected item by item.
- **Unplaced is a category.** Anything a structure doesn't place, and no crosswalk reaches, is listed last under
  "Not placed", so switching structures never hides data. This answers "does CAP place statistics?": yes, but only
  as GovGraph's crosswalk or judgement, labelled so; some measures (consumer sentiment, population) stay unplaced.

### Crosswalks
A crosswalk maps one structure's categories to another's (SKOS-style: `exact`, `broad`, `narrow`, `related`) and
places everything on either side at once, in both directions:

- **Abstract ↔ CAP** (the first and most useful; ~147 subsection rows, written and reviewed by hand, each with a note).
  Data flows into CAP (Prices › Consumer price index → CAP 101, whose description covers inflation, cost of living
  and prices); CAP-coded documents flow into the Abstract (a bill coded 1406 Low-Income Assistance for Housing →
  Construction and Housing).
- **Where a subsection is too coarse** (Federal Government Finances › receipts, outlays, debt spans CAP 105 National
  Budget and 107 Tax Code), the measure gets its own placement (`judgement`), which overrides the crosswalk.
- **The Abstract is the hub.** Each new structure comes with a crosswalk to the Abstract, not to every other
  structure; mappings between two others go through it.
- Stored as hand-written JSON, for example `server/seed/data/crosswalks/abstract-cap.json` (`[{ from, to, match,
  note }]`), with a test that every id exists in its structure and every Abstract subsection is mapped or marked as
  having no counterpart.

### Documents
Documents are many (86,000 bills), so their placements are rows, not hand-written JSON:

- **Refs** as tags use them: `fr:`, `bill:`, `scotus:`, `usc:`, `report:` (and `measure:` / `series:` / `dataset:` if
  data placements move to the database too).
- **A `category_placements` table** (`structure`, `category`, `ref`, `basis`, `note`), rebuilt whole by a script from
  CAP's coded datasets and the crosswalks, the way `buildProposals` rebuilds proposals. Hand placements stay in JSON
  and are loaded on top; a rebuild never touches them.
- **Bills after the 114th Congress** have no CAP code. A bill in the same proposal as a coded one could inherit its
  topic (our inference, `crosswalk`); otherwise it is unplaced, or placed by CRS policy area if that is added as a
  structure with its own crosswalk.
- **Counts** on the page include everything below a category. The membership engine may be shared with collections
  (`features/collections`): a category is a collection whose members come from placements.
- CAP's coded datasets are CC BY-NC-SA 4.0 like the codebook; each gets its own `sources.json` entry when collected.

## Alternative schemes (surveyed 2026-10-13)
Counts are approximate, from memory; check against each source before building on one.

### U.S. government subject schemes
| Scheme | Who | Shape | Fit for GovGraph |
|---|---|---|---|
| Budget functions | OMB | ~20 functions ("050 National Defense", "550 Health") → subfunctions | The government's own subject breakdown of everything it spends; stable since the 1970s; already in our data (MTS outlays by function, OMB Historical Tables) |
| Policy areas + legislative subject terms | CRS, on Congress.gov | ~30 policy areas (flat); ~1,000 subject terms on bills | Already on every loaded bill (`legislation.details` policy area); terms could be grouped under areas |
| Federal Enterprise Architecture, Business Reference Model | OMB | Mission sectors → business functions → services | What the government *does*, not what it publishes; mostly used for IT planning |
| Data.gov topics | GSA | ~15 flat themes | Too coarse |

### Academic: Comparative Agendas Project (Policy Agendas Project)
Political-science codebook: ~20 major topics (Macroeconomics, Civil Rights, Health, Agriculture, Labor, Education, …)
and ~220 subtopics. Used to code U.S. bills, hearings, executive orders, Supreme Court cases, budget authority and
public opinion back to the 1940s. The one scheme built to put documents and data on the same footing, which is what
GovGraph mixes. Its coded datasets are public, so many bills and orders could be placed by their codes, not by
judgement.

Checked 2026-10-13:
- **The full list, one page:** https://comparativeagendas.net/pages/master-codebook (mirror:
  https://compagendas.la.utexas.edu/pages/master-codebook). Master Topics Codebook v1.1, August 9, 2022; cite as
  Jones, Baumgartner, Theriault, Epp, Khandekar, Little (2025), *Policy Agendas Project: Codebook*. No download on
  the page. 21 major topics, codes 1–23 (11 and 22 unused): 1 Macroeconomics, 2 Civil Rights, 3 Health,
  4 Agriculture, 5 Labor, 6 Education, 7 Environment, 8 Energy, 9 Immigration, 10 Transportation, 12 Law and Crime,
  13 Social Welfare, 14 Housing, 15 Domestic Commerce, 16 Defense, 17 Technology, 18 Foreign Trade,
  19 International Affairs, 20 Government Operations, 21 Public Lands, 23 Culture. Subtopics are numbered under
  their topic (100 General, 101 Interest Rates, …). The codebook says 220 subtopics; a count of the page gave 213,
  so count again when building.
- **PDF (U.S. Policy Agendas variant):** https://minio.la.utexas.edu/compagendas/codebookfiles/Codebook_PAP_2019.pdf.
  U.S. datasets carry both PAP and CAP codes; CAP recommends its own codes for comparison across projects.
- **U.S. datasets (CSV, coded):** https://comparativeagendas.net/us/datasets — Executive Orders, Congressional
  Bills, Public Laws, Public Law Titles, Roll Call Votes, Congressional Hearings, CRS Reports, Supreme Court Cases,
  State of the Union Speeches, Budget Authority / Outlays, Tax Expenditures, and others. Codebooks:
  [Executive Orders](https://minio.la.utexas.edu/compagendas/codebookfiles/Executive_Orders_Codebook.pdf),
  [Supreme Court](https://minio.la.utexas.edu/compagendas/codebookfiles/Supreme_Court_Codebook.pdf). The datasets are
  under the same CC BY-NC-SA 4.0 licence; any we collect get their own entries in `sources.json`.

### International statistical standards
- **UN Classification of Statistical Activities (CSA)**: how national statistical offices, the UN, OECD and Eurostat
  sort statistical subject areas; three levels, starting with domains such as "Demographic and social statistics" and
  "Economic statistics". The closest international equivalent of the Abstract's sections; SDMX's subject-matter
  domains are based on it.
- **COFOG** (UN/IMF Classification of the Functions of Government): 10 divisions → groups → classes. The
  international counterpart of OMB's budget functions; the standard for comparing government spending.
- **EuroVoc**: the EU's thesaurus for government documents, domains → microthesauri → terms.

### General knowledge organisation
- **Library of Congress Classification** (H Social sciences, J Political science, K Law, …) and **Dewey Decimal**:
  deep, but built for shelving books, not data.
- **Faceted classification** (Ranganathan): independent facets (subject, place, time, population) combined, not one
  tree. The idea behind the timeline's Build mode (`features/series-dimensions`).
- **SKOS** (W3C Simple Knowledge Organization System): not a scheme but the standard format for any of these:
  concepts with broader / narrower, several schemes, and mappings between them (exact match, broad match). Matches
  the shape of the structure files, and CAP, EuroVoc and LCSH are commonly published in it.

## Suggestion (not decided)
1. **Second breakdown: CAP.** (Done 2026-10-13.) Covers documents and data, codes already exist, and it is a subject-based counterpart to
   the book-based Abstract.
2. **Then OMB budget functions**: official, clean hierarchy, already in the spending data.
3. **Later, mappings between breakdowns** (Abstract subsection ↔ CAP subtopic ↔ budget function), SKOS-style, so
   something placed in one breakdown shows in the others.

## Open questions
- Placements in JSON or in the database? Proposed: measures and hand placements in JSON; documents' derived
  placements in a `category_placements` table (see Documents above).
- One place per item per structure, or several? Proposed so far: one per measure; documents follow their publisher's
  code (CAP gives one major topic and one subtopic per item).
- Does category membership share an engine with collections?
- Should category names be rewritten from the source's wording ("Mobility status") into GovGraph's own?

## Done
- [x] Build tab, Statistical Abstract: each subsection ends with "Not here yet · N tables" (its tables with nothing loaded, from the coverage file), folded, filterable by title (2026-10-14; `features/statistical-abstract`, Phase 4)
- [x] Categories view of the Abstract (2026-10-13)
- [x] Page renamed Structure (`/taxonomies`); structures stored as JSON files (2026-10-13)
- [x] Comparative Agendas Project topics added as a second structure, with codes and descriptions (2026-10-13)
- [x] Codes hidden by default, shown with a "Codes" checkbox (user, 2026-10-13)
- [x] Codes and descriptions for the Statistical Abstract: section numbers, and each section's opening paragraph from
  the book; generation moved from scratch scripts into `server/seed/build-abstract-taxonomy.js` (user, 2026-10-13)
- [x] CAP licence checked: CC BY-NC-SA 4.0 (comparativeagendas.net/pages/Copyright-and-Legal, 2026-10-13). Attribution,
  non-commercial only, derivatives under the same licence; the structure file says so (`licence`). Registered in
  `sources.json`: organization `comparative-agendas-project` (academic), dataset `cap-master-codebook` of the new kind
  `classification`; files in the data folder under `comparativeagendas.net/`. `server/seed/fetch-cap-codebook.js` fetches
  the codebook and legal pages (recordFetch) and rebuilds `comparative-agendas.json` with
  `server/lib/parse-cap-codebook.js` (test against `server/references/cap-master-codebook.html`) (2026-10-13)
- [x] Nested tree with elbow connectors (2026-10-13)
- [x] Survey of alternative schemes (2026-10-13)
- [x] Measures as a flat list of our own, placed in each structure; written up above (user, 2026-10-13)
- [x] `server/seed/data/placements.json` (27 measures × 2 structures, all `judgement` with a reason), checked by
  `server/lib/taxonomies.js` / `taxonomies.test.js` (2026-10-13)
- [x] Build tab by structure (design D.1): `TaxonomyTree.jsx` (switch, filter over names, CAP subtopic descriptions,
  measures and dataset names; "Only with data"; fold all / open all; "Not in this structure" last), `withMeasures` in
  `client/src/taxonomies.js`, the path and placement reason above the measure's choices in `SeriesBuilder.jsx`, a
  select grouped by top-level category below 860px (2026-10-13)
- [x] Build-by-structure designs D, E, F and D.1 (`design/timeline-data/build-structures/`); D chosen, D.1 adds the
  measure as a third level opening the app's Build choices (2026-10-13)
- [x] Placement model written up: who places what, crosswalks, documents (user, 2026-10-13)

## Done (2026-10-13, glossary renames)
- [x] Structure → Taxonomy everywhere: page `/taxonomies`, `Taxonomies.jsx`, `TaxonomyTree.jsx`, `client/src/taxonomies.js`,
  `server/seed/data/taxonomies/`, `build-abstract-taxonomy.js`, `server/lib/taxonomies.js` (was `placements.js`), this
  folder (was `category-breakdowns`) (user, 2026-10-13)
- [x] Category ids frozen: `keepIds` / `writeTaxonomy` in `server/lib/taxonomies.js`, used by both builders; matched by
  code, then name, then position within the parent; renames keep the id; dropping one needs `--allow-removing`; tested
- [x] `placements.json` per taxonomy is `{ measures, series }`: a measure is placed, its series follow it, and a series
  is placed apart only where it differs, with its evidence (user, 2026-10-13). None placed apart yet: the customs-duty
  series were the example, but the Abstract prints customs duties in no table (Table 475 has them inside "Other").
- [x] `categories` and `category_items` were put in the database, then dropped the same day: nothing queried them, and
  the files are the one copy (user, 2026-10-13). A `table` placement in the Abstract is checked against
  `statistical-abstract-tables.json` (the table exists and is printed in that category)

- [x] The Abstract's subsections are the Census website's groups (206, every table in one), not the contents' topics,
  which do not divide the tables; the contents kept for the book view (user, 2026-10-13)
- [x] Abstract placements from the tables (statistical-abstract Phase 4): 15 measures by table, 12 by judgement, 3 series
  placed apart (2026-10-13)

## Todo
- [x] A measure is a name in a place (user, 2026-10-13): placing series apart from their measure is gone; a measure
  whose series the Abstract prints in two subsections became two measures of the same name (Consumer prices: CPI and
  PCE; Home prices: Census and FHFA). The Abstract allows one measure of a name per subsection (tested); in CAP, same-named
  measures in one category are one leaf in the Build tree, whose choices cover both
- [x] A measure's key is its Abstract category and its name (`prices/price-indexes/consumer-prices`), never a publisher
  or series (user, 2026-10-13); checked against its placement
- [ ] Put taxonomies and placements in the database only when something must query them (documents: CAP has already
  coded bills and orders by topic)
- [ ] Review the 27 placements (doubtful: consumer spending, fuel prices, mortgage rate, every CAP one); turn the
  Abstract's into `table` with table numbers once Phase 2 of `features/statistical-abstract` reads the tables
- [ ] Build mode at phone width: the tree is hidden below 860px and the select there has no structure switch
- [ ] Keep the chosen structure and measure in the URL, or across visits?
- [ ] Abstract ↔ CAP crosswalk (`server/seed/data/crosswalks/abstract-cap.json`), drafted for review, with its test
- [ ] `covers` for each structure; "Not placed" bucket and a publisher-only filter on the page
- [ ] Collect CAP's coded U.S. datasets (bills, executive orders, Supreme Court cases), register them in
  `sources.json`, and place documents through `category_placements`
- [ ] CAP's Budget Authority–Policy crosswalk, for spending series by budget function
- [ ] Next structure: OMB budget functions?
