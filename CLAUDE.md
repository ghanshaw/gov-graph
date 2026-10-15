# govgraph

## What This Project Is

This is a data collection and pipeline component of **govgraph**, a larger system for
collecting, storing, and visualizing U.S. federal government documents as a directed graph.

The `obama-eo` folder is the starting dataset: Obama-era executive orders, used to build
out the initial document corpus and validate the schema + pipeline before scaling.

The broader govgraph vision: every significant federal document (EOs, legislation, court
cases, regulations, OLC opinions, etc.) as nodes in a graph, connected by citations,
cross-references, and legal relationships.

## Stack

- **Runtime:** Node.js / JavaScript
- **Database:** Supabase (hosted Postgres)
- **Visualization:** Cytoscape.js with Dagre or ELK layout
- **Data sources:** Federal Register API, govinfo API, CourtListener API, Congress.gov API, manual collection

## Repo Layout & Running

- `server/` — Express + Apollo GraphQL API. `npm start` → http://localhost:9001/graphql
- `client/` — Vite + React app. `npm run dev` → http://localhost:9000 (proxies `/graphql` and `/pdf` to 9001)
- `server/lib/` — the parsers and their tests: `parse-executive-order.js` (Federal Register HTML;
  orders and memoranda), `parse-bill-xml.js` (bill XML), `parse-uscode-xml.js` (U.S. Code USLM XML),
  `parse-legislators.js` (people) and `parse-slip-opinion.js` (Supreme Court slip
  opinion PDFs, read through `pdf-lines.js`). Run with `node --test server/lib/<file>.test.js`
- `server/pdf.js` — PDF pass-through routes (see PDFs below)
- `server/seed/` — ingest and load scripts; data files in `server/seed/data/`
- `server/references/` — sample source documents kept for reference (e.g. the `eo-13636-*` files)
  and static HTML design mocks (`eo-list-design-*`, `eo-detail-design-*`; see Design Mocks)
- `research/` — background notes (e.g. `legal-document-structure.md`)
- `../gov-graph-data/` — bulk downloads, outside the repo (govinfo zips, roll call files, the
  legislators lists, U.S. Code release points; about 1.3 GB). Mirrors each publisher's paths; has its own README.
  Location set by `GOVGRAPH_DATA_DIR`; paths come from `server/lib/data-dir.js`
- `design/` — design references. `design/navy/` records the previous navy-and-gold design as of
  2026-10-02 (notes, full-page screenshots, source snapshots, `capture.sh`), before the move to
  the dark teal design. `design/timeline-data/` holds design variants for choosing and combining
  economic series on the timeline (served like the mocks; see its README)
- `features/` — feature tracking (see below)

`server/.env` (gitignored; template in `server/.env.example`) holds `DATABASE_URL`,
`COURTLISTENER_TOKEN`, `CONGRESS_API_KEY`, `GOV_INFO_KEY` (api.data.gov key for govinfo) and
`BLS_CONTACT_EMAIL` (BLS bulk downloads). Economic data needs no key since 2026-10-13: EIA, BLS and Census are read
from bulk or published files (`EIA_API_KEY`, `BLS_API_KEY`, `CENSUS_API_KEY` are no longer used).
The server must be restarted after changing `.env`, `schema.js`, `resolvers.js` or `pdf.js`
(no watch mode in `npm start`). Re-running a loader script needs no restart.

Checking pages through Chrome automation: the automated tab is usually in the background, where
smooth scrolling does not move and IntersectionObserver callbacks are held back. Scroll with
`behavior: 'instant'`, and take a screenshot (which forces a render) before judging that lazy
content failed to load.

## Database

Hosted on Supabase. Auth is via GitHub SSO (no password login).
Connection string is in Supabase dashboard → Settings → Database.

The direct host (`db.<ref>.supabase.co`) has an IPv6 address only. If it fails with
`ENOTFOUND`, check whether the project is paused and whether the network resolves IPv6;
the pooler connection string is the IPv4 alternative.

### Live tables (as of 2026-10-02)

The live database has moved past the pattern below. Tables: `executive_documents`,
`corpus`, `corpus_tags` (empty, unused), `tags`, `item_tags`, `court_decisions`, `court_votes`, `cases`, `case_opinions`, `courts`, `legislation`,
`legislative_documents`, `legislative_document_sections`, `bill_actions`, `roll_calls`, `member_votes`,
`congresses`, `people`, `person_roles`, `bill_sponsors`, `bill_relationships`, `bill_titles` (see Search under Bill Text), `proposals`, `economic_series` / `economic_observations`
(see Economic Data), `periods` (see Timeline), `reports` / `report_parts` (see Reports), the sources
`source_organizations`, `source_lineage`, `source_programs`, `source_program_organizations`, `source_files` (see Data Sources),
the U.S. Code tables `usc_release_points`,
`usc_titles`, `usc_nodes`, `usc_section_versions`, `usc_source_credits` (see U.S. Code below), and the
case-graph tables `cg_cases`, `cg_case_relationships`, `cg_scdb_cases`, `cg_data_sources`.
There is no `documents` or `document_relationships` table, and `server/seed/schema.sql`
does not define most of these. Tags: `tags` (the word) and `item_tags` (which items carry it, by ref:
`fr:<document number>`, `bill:<source_id>`, `scotus:<slug>`, `usc:<identifier>`, `report:<slug>`), in `server/tags.js`;
applied by hand only, and a new word is created on purpose, never by applying it (`features/tagging-system`).
Collections, which draw on tags and rules, are planned in `features/collections`.

`executive_documents`: `id` (uuid), `doc_type`, `number`, `title`, `president_id`,
`signed_date`, `body`, `source_id` (unique; Federal Register document number), `source_url`,
`structure` (jsonb; parsed sections → items → spans and citations) and `source_html` (raw Federal
Register HTML), both filled for all Obama, Trump (both terms) and Biden executive orders.
Presidential memoranda are rows with `doc_type = 'memorandum'` and no `number`; their only
identifier is `source_id` (584 rows, same four presidents, Federal Register set only).
Federal Register correction and republication notices share an EO number with the order
itself and have `source_id` like `C1-…` / `R1-…`.

`court_decisions`: one row per decision of a court (`court` = 'scotus'; addressed by `slug`, the
docket number: `25-332`, `145-orig`, `24a884`; `docket_numbers` text[], `name`, `term`, dates, `kind`
argued | per_curiam | original, `citation` once paginated, `slip_citation`, `disposition`, votes,
`natural_court_id` → `courts`, `pdf_url`, `structure` jsonb = everything except the opinions' text).
391 rows (Roberts Courts VII and VIII). `case_opinions`: one row per writing (`decision_id`,
`opinion_type`, `position`, `author_id` → `people`, `source_id` = `scotus/<slug>/<opinion id>`,
`structure`). `court_votes`: one row per Justice per decision (`person_id`, `side`, `wrote`, `joined`).
`cases`: one row per CourtListener record (about 64,000; CourtListener keeps several per decision, up
to 8), `decision_id` → its decision; kept only to redirect CourtListener ids. `courts` holds the
natural courts (Roberts I–VIII), not courts as institutions. Justices are `people` with `fjc_id` and
`person_roles` of type `justice` / `chief_justice` (`load-justices.js`, from the Federal Judicial
Center's directory).

`legislation`: one row per bill (`congress_number`, `bill_type` lower case, `bill_number`,
`source_id` like `119-HR-1`; about 86,000 rows; `details` jsonb from the bill status files). `legislative_documents`: one row per stored bill
text version (`legislation_id`, `doc_type` = version code such as `enr`, `title` = version label,
`date`, `source_id` = govinfo package id, unique; `structure` jsonb = everything except section
text; `source_xml` = raw file). `legislative_document_sections`: one row per section of a version
(`document_id`, `position`, `section_id`, `number`, `heading`, `structure` jsonb).

`people`: one row per person, our own uuid as the identity (`/people/<uuid>`). Matching ids are
columns (`bioguide_id`, `lis_id`, `wikidata_id`; `fjc_id`, `courtlistener_id` empty until judges),
the rest in `other_ids` jsonb. `person_roles`: one row per term as published (`role_type` =
representative | senator | vice_president | president, `started_at`, `ended_at`, `party`, `state`,
`district`, `senate_class`), split where the party changed mid-term. 12,797 people (every member
since 1789, presidents, vice presidents) from the @unitedstates lists via
`server/seed/load-people.js`, which also fills `member_votes.person_id`, `bill_sponsors.person_id`
and `executive_documents.president_id` (by signing date). `bill_sponsors`: sponsor and cosponsors
of each bill (`role`, `sponsorship_date`, `is_original`, `withdrawn_date`, party and state as printed).

`bill_relationships`: bills related to a bill, one row per listed relationship, direction as
listed (`legislation_id` → `related_congress` / `related_type` / `related_number`, and
`related_legislation_id` once that bill is loaded). `relationship` keeps Congress.gov's wording
("Identical bill", "Related bill", "Procedurally related", "Contained in public law", "Public law
contains the text", "Cross-Congress related bill", …); `identified_by` is CRS, House, Senate or GPO.
`source` = `congress.gov` (from the bill status files; replaced on each reload) or `govgraph` (our own,
`identified_by = 'manual'`, with a `note`; never touched by a reload; added with
`server/seed/add-bill-relationship.js`). Our type "Not identical" overrules an identical link.
Our types "Same text" (90% or more) and "Similar text" (60–90%) come from
`server/seed/match-bill-texts.js` (`identified_by = 'text-match'`, percentage in `note`): it compares the
earliest stored versions of every House/Senate pair that Congress.gov calls "Related bill" or that share
a title (share of five-word runs in common, `server/lib/text-similarity.js`), because Congress.gov's
"identical" means word for word and its links lag weeks behind. Each run replaces its own rows.
119th Congress: about 13,300 Congress.gov rows, plus 3,155 text-matched pairs (both directions).

`proposals`: what the public sees as one attempt at one law; every bill belongs to one
(`legislation.proposal_id`). A House bill and a Senate bill that are the same proposal share one; any
other bill is one alone. Rebuilt whole per Congress from `bill_relationships` by `server/lib/proposals.js`
(`buildProposals`, run by the status loader, `add-bill-relationship.js` and `build-proposals.js`).
`id` is the lead bill, lower case (`119-hr-2`): earliest introduced, House first on a tie, then lower
number. Links that pair, strongest first: "Identical bill", "Same text", "Similar text". Pairing rule:
each bill is the other's best match in the other chamber (strongest link, then closest introduction
date, then lower number); taking the links transitively merges separate measures (thirteen same-text
War Powers resolutions in the House; each year's Nurses Week resolutions). The session page lists
proposals. 119th Congress: 16,271 proposals, 3,331 House–Senate pairs (1,834 from Congress.gov's
identical links, 806 same text, 691 similar text).

### Core schema pattern

Documents are **nodes**. Relationships between documents are **edges** stored in a
join table. Direction is encoded by column name (`citing_id → cited_id`).

```sql
-- Documents table (generalized beyond cases)
CREATE TABLE documents (
  id              SERIAL PRIMARY KEY,
  title           TEXT NOT NULL,
  doc_type        TEXT,          -- 'executive_order', 'statute', 'court_case', etc.
  date_issued     DATE,
  source_id       TEXT,          -- external ID (e.g. EO number, CourtListener ID)
  source          TEXT,          -- 'federal_register', 'courtlistener', 'manual'
  body            TEXT           -- raw text if collected
);

-- Relationships (edges in the graph)
CREATE TABLE document_relationships (
  id              SERIAL PRIMARY KEY,
  citing_doc_id   INT NOT NULL REFERENCES documents(id),
  cited_doc_id    INT NOT NULL REFERENCES documents(id),
  relationship    TEXT,          -- 'cites', 'revokes', 'amends', 'supersedes', NULL=unknown
  source          TEXT,
  UNIQUE (citing_doc_id, cited_doc_id)
);
```

## Executive Order Sources & Text

- **Federal Register API** (no key): the list and metadata for executive orders, and
  well-structured HTML for 2009 onward (section headings, sub-items, typed citation links).
  A 1994 order was found to have only plain text.
- **govinfo API** (`GOV_INFO_KEY`): presidential documents are collection `CPD`
  (package ids `DCPD-*`). Package summaries include `references` (U.S. Code, Public Law
  citations). Its HTML is converted from PDF and has no real structure. EO 13510 is missing.
- **govinfo bulk data** (no key): daily Federal Register XML with orders tagged `<EXECORD>`;
  also CFR, bills, public laws, statutes. Not yet used.
- `executive_documents.body` holds plain text from govinfo for 275 Obama orders
  (13489–13764 except 13510), exposed as `ExecutiveOrder.body` and shown on the detail page.

Direction: parse Federal Register HTML into structured JSON (sections → items → spans,
plus citations), store it once in `executive_documents.structure`, and render it in React
(`client/src/components/OrderText.jsx`), keeping the raw HTML alongside. The parser is
`server/lib/parse-executive-order.js`; `server/seed/fetch-federal-register-executive-orders.js`
builds `server/seed/data/fr-eos-<president>.json` and `server/seed/load-executive-order-structure.js`
parses and stores it. Done for Obama, Trump (both terms) and Biden; not yet for Bush. `server/references/eo-13636.json`
and `eo-14160.json` are hand-built references the parser test checks against. `eo-13636-readable.html` is the
layout the page follows; `research/legal-document-structure.md` has the background on drafting
conventions, USLM and Akoma Ntoso.

Structure details worth knowing when touching the parser or `OrderText.jsx`:

- An item is `{ marker, level, page, text, spans }`. `marker` is `"a"`, `"i"`, `"A"`, `"1"` (printed
  in parentheses) or `"1."` (a numbered list, printed as is). `level` is the nesting depth; 0 = unmarked.
- Quoted provisions (replacement text in amending orders, paragraphs that open with “) are
  unmarked items with `quoted: true`, `quote_level` and, if they have their own marker, `quote_marker`
  (`"(i)"` or `"1."`). The marker stays in `text`. A quotation stays open until its closing ”, so
  numbered or unmarked paragraphs inside it are quoted too. The client groups a run into one
  `blockquote.quoted`.
- Spans are character offsets into `text`: `citation`, `deadline`, `defined_term`, `emphasis`.
- Memoranda use the same parser and scripts with `--type memorandum` (`fr-memoranda-<president>.json`).
  Their structure has `doc_type: "memorandum"`, an `addressee` line, and `bullet: true` items for
  bulleted lists; one with no numbered sections is a single unnumbered section with no preamble.
  Pages are `/:slug/memoranda/doc/<document number>` (`presidentialDocument` query, `/pdf/doc/…`).
- After changing the parser: `node --test server/lib/parse-executive-order.test.js`, then re-run
  the loader for each president and each type (`--dry-run` first):
  `load-executive-order-structure.js --president barack-obama | donald-trump | joseph-biden | donald-trump-47 [--type memorandum]`.
  It rewrites `structure` on every row (orders: 276 Obama, 220 Trump 45, 162 Biden, 288 Trump 47;
  memoranda: 257, 133, 160, 34). Bush (291 orders) has no structure yet.
- EO 13548 has no Federal Register HTML; its structure comes from govinfo's plain text
  (`govinfoTextToHtml`), with `source.name: "govinfo"` and no linked citations.

## Bill Text

Bills use the same shape, converted from the bill-format XML at govinfo
(`https://www.govinfo.gov/content/pkg/<package>/xml/<package>.xml`) by `server/lib/parse-bill-xml.js`.
The structure is declared in the XML (`<subsection>`, `<paragraph>`, … each with `<enum>` and
`<header>`), so nothing is inferred. Parse once, per bill:

    node --env-file=server/.env server/seed/load-bill-text.js --congress 119 --type hr --number 1 [--dry-run]

That loads one bill through Congress.gov. Whole Congresses come from govinfo's bulk data, kept
outside the repo in `../gov-graph-data` (`GOVGRAPH_DATA_DIR`; `server/lib/data-dir.js`), in
govinfo's own folder layout:

    node server/seed/fetch-govinfo-bulk.js --collection BILLSTATUS --congress 115-119   # history
    node server/seed/fetch-govinfo-bulk.js --collection BILLS --congress 115-119        # text
    node --env-file=server/.env server/seed/load-bill-status-bulk.js --congress 119     # run first
    node --env-file=server/.env server/seed/load-bill-text-bulk.js --congress 119 [--force]
    node --env-file=server/.env server/seed/match-bill-texts.js --congress 119          # after both

- **Status** (`parse-bill-status.js`): one file per bill → a `legislation` row (created if
  missing), `legislation.details` (sponsors, cosponsor count, policy area, committees, laws,
  latest action, text versions with official labels and dates, update date) and `bill_actions`
  (`action_type`, `action_date`, `description`, `action_code`, `source_system`, `position`; 0 is
  the latest), `bill_sponsors` and `bill_relationships`. Unchanged bills are skipped by update date
  (`--force` re-stores them). Each run ends by linking relationships to loaded bills and rebuilding
  the Congress's `proposals`. Raw status XML stays in the zips.
- **Text**: every version in a zip is converted and stored with its raw XML; a bill with no
  `legislation` row gets a minimal one. Stored versions are skipped unless `--force`, which is
  needed after changing the converter. About 3,000 versions a minute; about 18 KB of database
  per version.
- Resolutions have a `preamble` of "Whereas" clauses and usually one unnumbered section.
- **Votes**: the status files name every recorded vote on a bill and on its amendments.
  `fetch-roll-calls.js --congress 119` downloads those files (kept under
  `clerk.house.gov/…` and `senate.gov/…` in the data directory, plus the @unitedstates legislators
  lists under `unitedstates.github.io/…`); `load-roll-calls.js --congress 119` stores them.
  `roll_calls` is one row per question put to a chamber (unique on chamber, Congress, session,
  roll number; `legislation_id`, `action_position`, `amendment`, totals, `tie_breaker`).
  `member_votes` is one row per member per roll call (`bioguide_id`, `lis_id`, `name`, `party`,
  `state`, `position` = Yea | Nay | Present | Not Voting; the House's Aye/No are stored as Yea/Nay).
  House files print surnames only, so full names come from the legislators list.

**Loaded as of 2026-10-02: the 119th Congress** (since then the 117th has been loaded too, with history and text; the 115th, 116th and 118th have history — status, titles, sponsors, relationships, proposals — but no text or votes, as of 2026-10-11; the database is 2,124 MB) — 19,531 bills with history (79,999
actions), 22,565 text versions (105,592 sections), 1,117 roll calls (334,014 member votes), 201,113
sponsorships. The database is 830 MB (677 MB before people and cosponsors; 140 MB before bills), about 21.5 KB per text version with its raw XML.
The zips for 115, 116 and 118 are downloaded but not loaded: that adds roughly 2.3 GB. The project is on a
paid Supabase plan (confirmed 2026-10-07), so storage is a cost, not a hard limit. Load order per Congress:
status, text, then `fetch-roll-calls.js` and `load-roll-calls.js`. Run `load-people.js` before
these (and again after a new Congress starts) so sponsorships and votes are linked to people as
they are stored; `load-bill-status-bulk.js --force` re-stores bills whose update date is unchanged.

People pages (`People.jsx`, `Person.jsx`; resolvers in `server/people.js`) group consecutive terms
in one office into a stint and show votes, sponsored and cosponsored bills, and for presidents bills
signed and vetoed (from `bill_actions`). Tracked in `features/people/index.md`.

Enacted laws (session page, "Enacted laws only"; `server/lib/enacted-laws.js`, `enactedLaws` query):
Congress.gov's law list gives the rows; the Statutes at Large citation and slip law link come from govinfo
(`PLAW-119publ117`) only once GPO has published the law. The citation is the "[[Page N STAT. N]]"
marker at the head of the law's text; the package metadata mixes it with statutes the law amends.

Tracked in `features/congress/index.md`.

What a bill adds to the shared shape:

- `outline`: tree of containers (`division`, `title`, `subtitle`, `chapter`, `subchapter`, `part`,
  `subpart`) whose leaves are `{ type: "section", number, heading, id }`. The stored `structure`
  also has `section_index` (`position`, `id`, `chars` per section) and `citations`, but no items.
- Items may have `heading` ("In general"), `changed` (`"added"` / `"deleted"`, from a reported
  version), `continuation`, `type: "table"` (`head`, `rows`) or `type: "toc"` (`entries` with
  `text`, `depth`, `kind`, `target`). Spans may be `inserted` / `deleted`.
- Quoted amendatory text uses the same `quoted` / `quote_level` / `quote_marker` form as orders.
- A committee substitute has two bodies (original `deleted`, substitute `added`); an engrossed
  amendment (`amendment-doc`) carries its text in an `amendment-block`. The Public Law print
  (`PLAW-…`, USLM format) is not converted.

On the page (`BillDetail.jsx`, `BillText.jsx`, `BillOutline.jsx`): the outline loads first
(`billText`), sections are fetched 15 at a time as they come within reach (`billTextSections`).
Sections fold from their heading; one titled "Table of contents" starts folded and is not fetched
until opened. The rail's contents tree starts fully open, with − / + stepping it one level.

Search (`/congress` across every Congress, `/congress/:n` within one; `billSearch` query; tracked in
`features/search/index.md`): a search that is a bill or law number ("H.R. 1", "119-hr-1", "P.L. 119-21")
is read as one (`server/lib/bill-search.js`); words are matched by Postgres full-text search against
`bill_titles`, every title a bill has had (display, official, short, popular; from the status files,
source `congress.gov`), plus our own names in common use from `server/seed/data/bill-names.json`
(source `govgraph`, loaded by `load-bill-names.js`). Bills whose status is not loaded are matched on
`legislation.title` only. The words of each title are stored (`bill_titles.search`, `legislation.title_search`).
A one-word search matching most bills ("act") takes about 4 s; others take well under 1 s.

The session page's introduction-date orders come from `legislation` (19,531 bills of the 119th Congress
have dates; re-run `load-bill-status-bulk.js` to pick up new bills); the update-date orders from Congress.gov.

Congress.gov quirks: the bill list sorts only by record update date, and the direction must be
separated by a space (`sort=updateDate desc`; `updateDate+desc` is silently ignored). The bill
detail response has no public URL, so the Congress.gov link is built from congress, type and number.

## Supreme Court Decisions

The Court publishes a decision only as a PDF (the slip opinion). govinfo's `SCD` bulk collection
is a single archived text file covering 1937–1975, and CourtListener has only plain text for new
decisions, so the PDF is the source. `server/lib/pdf-lines.js` (pdfjs-dist) reads its printed lines
with position, type size and italics; `server/lib/parse-slip-opinion.js` turns them into the shared
shape. Here the structure is inferred from the typesetting (running heads, indentation, centred
headings, the footnote rule), so check a new kind of decision by eye before trusting it.

    node --env-file=server/.env server/seed/load-case-text.js --cluster 10881681 [--dry-run] [--json out.json]

Whole terms (every decision on the Court's slip opinion list; skips stored ones unless `--force`):

    node --env-file=server/.env server/seed/load-case-text-bulk.js --terms 2020-2025 --from 2020-10-27 [--dry-run] [--refresh] [--report r.json]

Loaded: Roberts Courts VII and VIII (2020-10-27 on). The Court's lists now link to Reporter's
preliminary prints, whose text drops fi/fl ligature letters ("fled" for "filed"), so the loaders
read the original slip PDF that CourtListener records. `checkDecision` reports what looks wrong in a
parse; bulk runs print it per decision. Storage is `server/lib/decision-storage.js`
(`storeDecision`): one `court_decisions` row, its opinions and votes, and every CourtListener record
of the same docket (from the decision date to a year after) pointed at it. Justices first:

    node --env-file=server/.env server/seed/load-justices.js [--dry-run]

The app does not call CourtListener at runtime: pages, lists and tags read `court_decisions`. The
loaders still use CourtListener's API to find each slip PDF (`COURTLISTENER_TOKEN`). A natural court
with no decisions loaded (Roberts I–VI) shows "not loaded yet".

The cluster id is CourtListener's; the PDF it points to is kept in the data directory
(`supremecourt.gov/…`); `server/references/trump-v-slaughter.json`
and `-slip-opinion.pdf` are what the test checks. Tracked in `features/supreme-court-text/index.md`.

What a decision adds to the shared shape:

- `outcome`: `disposition`, `holding`, `vote` (`majority`, `dissent`), `justices` (`name`, `side`,
  `wrote`, `joined` with any `qualifier`) and `writings`, all read from the syllabus's closing line-up.
- `syllabus` (`items`, `disposition`, `lineup`) and `opinions`, each with `kind` (`majority`,
  `concurrence`, `dissent`, …), `author`, `joined_by`, `byline`, `sections` and `footnotes`.
  A section is a printed part: `heading` ("1"), `path` (`["II", "A", "1"]`), `level`, `items`,
  `pdf_page` (where it starts in the PDF file; opinions and the syllabus have one too).
  The stored head keeps an `outline` per opinion (with each part's opening words) instead of the text.
- Spans may be `footnote_ref` (zero length; `number`, `target`). Items may have `align: "right"`.
- Citations of type `case` (`reporter`, `volume`, `page`, `name`, `year`) link to CourtListener's
  citation address; every citation has `mentions` (count per writing). A decision cited before it
  has a page ("605 U. S. ___") is listed with `href: null`.

On the page (`CaseDetail.jsx`, `OpinionText.jsx`, `OpinionOutline.jsx`), at
`/supreme-court/<natural court>/<docket slug>`: the decision loads first (`courtDecision`, with
`votes` linking each Justice to `/people/:id`), then each opinion (`decisionOpinion`). An old
`/supreme-court/…/<CourtListener id>` link redirects (`courtDecisionByCourtListenerId`). Parts are labelled as the Court refers to them
("Part II–A–1"). The Outcome block (`CaseOutcome.jsx`) starts open. With only the PDF shown, the
contents list opens the viewer at a part's page (`#page=N`, a new frame per page). supremecourt.gov allows its PDFs to be framed, so the viewer loads the PDF
directly, not through `server/pdf.js`.

## U.S. Code

The Code as the Office of the Law Revision Counsel publishes it: a release point after each batch of
laws ("119-36" = current through Public Law 119-36), one zip of every title in USLM XML. The model is
git: release points are tags, Public Laws the commits, source credits the blame, bills proposed patches.

    node server/seed/fetch-uscode-releases.js [--release 119-36] [--archive]
    node --env-file=server/.env server/seed/load-uscode.js --release 119-36 [--titles 5,10,42] [--dry-run]

**Loaded as of 2026-10-07: release point 119-36 only** (files dated 2025-09-09), every title and
appendix title: 70,402 units, 60,892 sections (51,453 in force), 154,739 source credits (4,583
linked to bills we hold); 508 MB in the database (437 MB of it section versions; the database is 1,651 MB). uscode.house.gov was down, so the zip came from the Internet Archive
(`--archive`; its captures of 119-73 and 119-83 are truncated). 692 MB of XML; about 660 MB of parsed
JSON, two thirds of it notes. Parsing a title takes 1–3 s (title 42: 113 MB, 1.8 GB of memory).

- `parse-uscode-xml.js`: a title file → the hierarchy (`nodes`: containers and sections, each with
  its USLM `identifier`, e.g. `/us/usc/t10/s1074c`) and each section's `structure` in the shared
  shape. Statutory notes contain whole sections of other laws, so only sections in the main
  hierarchy are units. Appendix titles have no `<main>`; their units include `courtRule` and
  `reorganizationPlan`. A few section numbers are printed twice (two § 711 in title 10): the second
  gets identifier `…~2` and slug `711_2`.
- Section `structure`: `items` (provisions with `anchor` = identifier below the section, `b-1`;
  headings printed on their own line, `heading_break`), `source_credit` (`text`, `spans`, `laws`),
  `notes` (`topic`, `heading`, `cross_heading`, `items`; quoted provisions and `subheading` items),
  `footnotes`, `citations`.
- Storage (`usc-storage.js`): a section's text is stored once per distinct version (sha-256 of the
  structure); a release with unchanged text only widens `first_seq`/`last_seq`. Release `seq` =
  congress × 10000 + law. The current Code is the units whose `last_seq` is their title's release.
  Re-loading the same release (after a parser change) replaces the versions only it holds.
- URLs: `/code`, `/code/<title>` (outline; a heading lists its sections when opened, `uscChildren`),
  `/code/<title>/<section>` (en dashes as hyphens: `/code/42/300h-6`). Queries in `server/usc.js`.
- Links from other documents: citation spans with `target.type = 'usc'` link to the section page
  (`client/src/usc.js`, `uscPath`). GPO tags mainly the parenthetical form ("(20 U.S.C. 1001)"); the
  amending wording ("Section 1074c of title 10, United States Code") is untagged, so
  `server/lib/usc-references.js` finds it when bill sections are served (`billTextSections`).

Tracked in `features/us-code/index.md` (Phase 2: classify amends / repeals; Phase 3: history from 2020).

## Population (Demographic Data)

Census Bureau files, kept as published in the data folder at their www2.census.gov paths, and
charted on **Demographic Data** (`/demographics`, `pages/Demographics.jsx`; `/population` redirects)
the way Economic Data charts its series. This replaced the first "files only, nothing in the
database" arrangement (user, 2026-10-11). Every series goes back as far as the Bureau publishes it.

- Series: `server/lib/population/series.js` reads the files into measures × places and
  `server/seed/load-demographic-series.js [--measure …] [--level nation,state,district] [--dry-run]`
  stores them in `economic_series` / `economic_observations` (shared `lib/series-storage.js`), with
  `measure` (the national series' slug) and `place` (`ca`, `ca-12-l113`; null for the nation). A
  place series' slug is `<measure>--<place>`. `economicSeriesList` returns national series only; the
  page's place picker uses `seriesPlaces(measure)`. Re-run the loader as ACS years download.
- Resident population is one series per place, 1900–2025, each year from the newest decade file that
  covers it (1900–1969 printed in thousands; no July 1970 / 1980 in the files). Census counts
  1790–2020, House seats 1910–2020, components of change 2011–2025. ACS measures are table lines
  found by label (`ACS` in series.js), not line number.
- Districts are kept by the lines they were drawn on (`lib/population/places.js`: census cycles
  starting with the 109th, 113th, 118th Congress, split at mid-cycle redraws).
- The page is `components/SeriesPage.jsx`, shared with Economic Data (`pages/Economy.jsx` passes its
  tabs and periods); `client/src/demography.js` lists the tabs. Units `people`, `households`,
  `seats`, `years`, `gini` are formatted in `economy.js`.

    node server/seed/fetch-population.js [--only apportionment,acs,…] [--years 2005-2019] [--parallel 2] [--dry-run]

- Collections (`server/lib/population/sources.js`) are directories the fetch script lists and mirrors
  (data files only; no PDFs, no county / city / metro detail): apportionment 1910–2020, state counts
  1790–1990 (legacy .xls), race and Hispanic origin 1790–1990 (Working Paper 56), national estimates
  by age, sex and race from 1900, state estimates from 1900 (by age, sex, race, origin from 1980),
  household income by state from 1959.
- The ACS 1-year (nation, states, congressional districts), 2005–2019 and 2021– (no standard 2020
  release), for the tables in `ACS_TABLES`. 2005–2019 are sequence files: the year's lookup
  (`LOOKUP_PATHS` in `lib/population/acs.js`; four formats) says which sequences hold the tables, and
  only those are fetched for each state folder with its geography file. 2021– are one file per table.
  2005's lookup has no row labels; they come from 2006 where the table has as many cells.
- www2.census.gov rate-limits with HTTP 429 and a Cloudflare challenge when hit in parallel. The
  fetch script makes at most 2 requests at a time, 500 ms apart, backs off on 429 / 503, and never
  saves an HTML page as a data file. Do not try to get past the challenge; slow down.
- Legacy .xls files are read with SheetJS (`xlsx` from cdn.sheetjs.com, added for this).
- Sexual orientation and gender identity are not asked in the census or the ACS; the ACS counts
  same-sex couple households (B09019, B11009). The Household Pulse Survey asked both (not yet fetched).
- Pages: `/demographics/files` (Source Files tab: collections and their files), `/population/file?path=` (any file as published:
  CSV and .dat as a grid, text as text, spreadsheets by sheet, zips as their contents),
  `/population/acs?year=&geo=&table=` (one table for one place: label, estimate, margin of error).
  Queries in `server/population.js`.

Tracked in `features/population/index.md`.

## Timeline

`/timeline` (`Timeline.jsx`, `TimelineChart.jsx`; the design is AC.1 in `design/timeline-data/`) reads one query, `timelineEvents` (`server/timeline.js`):
every stored executive order and memorandum (`executive_documents`, correction notices left out), enacted
law (a bill's first "Became Public Law" action), report of an investigation (`reports`), Supreme Court decision (`court_decisions`) and FOMC target
change (from the `fed-target-*` economic series), each with a
`label` and an in-app `href`. It shows what is loaded, nothing fetched live. Horizontal only (vertical was
dropped 2026-10-11). Layout: a search field across the top (`SeriesSearch.jsx`) opens a catalogue of every
economic series by subject (the Economy tabs, with each tab's `search` words, "in the news" line, headline
series and "not here yet" notes; unemployment's published breakdowns are rows of their own); below it the
chart, with the year range (`YearRange.jsx`: typed years, presets, a track lined up with the chart) and
`LanePanel.jsx` beside it: the lanes, top to bottom, then the context toggles with counts in the years shown.
Each lane is one chart under the events (`lanes.js`): series measured alike share it (same unit; dollars
only with dollars for the same period; an index alone), a ticked series joins a lane on its scale holding
the same subject, else any on its scale, else a new lane; dragging onto a lane with one other scale puts it
on a right-hand scale, a lane with two refuses it, "New lane" pulls it out. Series can be hidden (kept,
struck through) or removed; each keeps its `--cat-n` colour. Quarterly and yearly values are drawn as a
level across their period. Values are fetched one series at a time as added (`useSeriesData.js`). Lanes
are not yet kept in the URL. By default from 1993 (Clinton taking office) with only presidential terms on
(no events, periods or economic series). Orders,
memoranda, laws and reports sit above the axis, decisions below, coloured by branch (`--executive`, `--legislative`,
`--judicial`). Presidential terms (`presidentialTerms`, from `person_roles`) are a strip of presidencies
across the top, with a dashed line through the lanes at each change. Periods (`periods` table, `periods`
query in `server/timeline.js`) are recessions (NBER, since 1948) and the COVID-19 Public Health Emergency
and National Emergency: bars under the presidencies, shading through the lanes (recessions in a stone-brown hatch, not grey), "During:" in the
cursor card, toggles Recessions / Emergencies. They are entered by hand in `server/seed/data/periods.json`
(each end: date, who determined it, the document, a link, and `fr:` / `bill:` references that become
in-app links once that document is loaded) and loaded with `server/seed/load-periods.js`. Tracked in `features/timeline/index.md`.

## Reports

Reports of investigations (commissions, congressional inquiries, special counsels): `reports` (one row per
report; `related` = what created the body and the laws that followed, entered by hand in
`server/seed/data/reports.json` with `bill:` / `fr:` references) and `report_parts` (one row per chapter,
preface, appendix or summary; `structure` = sections → items in the shared shape, with the chapter's
endnotes as `notes`). Schema in `server/lib/reports.js`. Loaded: the 9/11 Commission Report (2004), text
from the Commission's own HTML (`server/lib/parse-commission-html.js`: windows-1252 HTML 4; `<h4>` numbered
sections, bold headings set on their own line or run in, one-cell tables as boxed passages, `<sup>` note
calls and a separate notes file; items may have `run_in`, `recommendation` + `anchor`, `lines`, `box`;
spans may be `strong`), PDFs from govinfo (GPO-911REPORT granules, through `/pdf/govinfo/<package>/<granule>`).

    node server/seed/fetch-reports.js [--report 9-11-commission]
    node --env-file=server/.env server/seed/load-reports.js [--report …] [--dry-run] [--json out.json]

Pages `/reports` and `/reports/:slug` (`Reports.jsx`, `ReportDetail.jsx`, `ReportText.jsx`,
`ReportOutline.jsx`; queries in `server/reports.js`). Each report is also a timeline event (`report`).
Tracked in `features/reports/index.md`.

## Economic Data

Rule: series are shown as their publishers print them. GovGraph computes no series of its own (no
ratios, growth rates or affordability measures); a measure we want must come from a publisher that
prints it. The nine computed series (inflation rates, debt-to-GDP, real spending growth, price-to-income,
mortgage payment share) were removed on 2026-10-10.

Time series beside the documents: WTI and Brent daily spot ($/bbl), U.S. retail regular gasoline and
diesel weekly ($/gal), and U.S. oil demand ("product supplied", thousand barrels per day: all petroleum,
distillate, gasoline, jet fuel; EIA's four-week averages and monthly) from EIA's petroleum bulk file (`PET.zip`, no
key; read for our series only); the unemployment rate (U-3, from 1948), U-6 and unemployed
persons, monthly, from the BLS `ln` survey file (October 2025 was not collected, so it has no value), and their
published breakdowns (rate and count for 43 groups by sex, race and ethnicity, age, education and their
published combinations; `UNEMPLOYMENT_GROUPS`, slugs `unemployment-rate--black-women`), read from the
downloaded `ln` survey file (`ln.data.1.AllData`) and offered as series of their own in the timeline's catalogue; GDP, real
GDP and real growth, quarterly from 1947, from BEA's flat files (`NipaDataQ.txt`, no key); federal
debt (total and held by the public), daily from 1993, from Treasury's Debt to the Penny (no key);
the CPI and core CPI indexes (from 1913 and 1957), read from the BLS `cu` survey files (`bls-bulk`
series read from `fetch-bls-bulk.js --survey cu` downloads), plus the PCE and core PCE price indexes
from BEA's monthly file; consumer spending (BEA monthly, `NipaDataM.txt`; real from 2007) and
the University of Michigan's consumer sentiment index (`umich`, a CSV; not government data); housing:
Freddie Mac's 30-year mortgage rate (weekly from 1971), the FHFA house price index (monthly from 1991),
and Census homeownership rates and median household income, read from Census .xlsx tables by
`server/lib/xlsx.js` (no spreadsheet library; old binary .xls cannot be read); the median new-home price
from Census's New Residential Sales history spreadsheet (`price_cust.xlsx`); the Atlanta Fed's Home Ownership Affordability Monitor
(national workbook, monthly from 2005: ownership cost share of income and affordability index). Trade and tariffs
(tab `trade`, 2026-10-11): customs duties from USITC's duties table (`ave_table.pdf`, 1891 on, with duties as a percent of
imports; read with `pdf-lines.js`; taken from the Internet Archive, usitc.gov refuses scripts; 1918 and 1930 are printed in
parts and left blank), OMB Table 2.5 (FY 1940), BEA (yearly from 1929, `NipaDataA.txt`; quarterly from 1959), the Monthly
Treasury Statement (net, gross, refunds) and three daily-statement lines; exports, imports and balance from Census's FT-900
history (.xlsx, monthly from 1992, yearly from 1960) and BEA (quarterly from 1947, yearly from 1929). Exports against imports
are `compare` pairs, which the timeline now draws as two lines too. Interest rates: the Fed's whole
H.15 release (zip of SDMX XML: effective federal funds daily from 1954, Treasury yields, prime) and the
FOMC target from the Board's Open Market Operations pages (saved HTML, changes from July 1990; frequency
`irregular`: a value from each date on). A tab series can carry a `band` (lower and upper series) drawn
as steps behind its line: the target range with the federal funds rate. Each target change is also a
timeline event (`fomc`, below the axis with the Court; toggle "Fed rate decisions"). Whole BLS
surveys are downloaded, not loaded: `fetch-bls-bulk.js --survey ln` (needs `BLS_CONTACT_EMAIL`)
mirrors `download.bls.gov/pub/time.series/ln/` (421 MB, 68,626 series) into the data directory; `cu`
(CPI, 172 MB) is downloaded too and the CPI series are read from it. The series kept are
listed in `server/lib/economic-series.js`, with the schema (`economic_series`,
`economic_observations`: `series_id`, `date`, `value`; general, not oil-specific).

    node --env-file=server/.env server/seed/fetch-economic-series.js [--series unemployment-rate]
    node --env-file=server/.env server/seed/load-economic-series.js [--dry-run]

Federal tax revenue (2026-10-11; customs duties left for tariffs): BEA Table 3.2 quarterly, Treasury's Monthly
Treasury Statement (Table 9, from March 2015) and Daily Treasury Statement tax deposits (Table IV 2005–Feb 2023 and
Table II's "Taxes - …" lines after, two sets never joined), OMB Historical Tables 1.1–2.5 by fiscal year (frequency
`fiscal-year`, dated by the year's first day; "TQ 1976"), CBO's average tax rates and tax shares by income group,
and IRS SOI Table 23 bracket rates (old .xls, `server/lib/xls.js`). Tabs Tax revenue, Revenue since 1934, Tax rates.
These are stored exactly as printed, in the publisher's unit (`$m`, `$`, `%`); daily deposits are never averaged
(`asPublished`). cbo.gov refuses scripts, so CBO's file comes from the Internet Archive (`archive` on the series).
Outflows beside them: refunds (MTS Table 4 gross and refunds; DTS refund withdrawals) and spending (tab Receipts &
outlays: OMB outlays and deficit, BEA expenditures and net borrowing, MTS outlays by function and Table 1's deficit,
signs as each publisher prints them). A tab item with `compare` draws two series as a pair on one chart.

Descriptions are always GovGraph's own (`description`); the publisher's own title for a series is read
verbatim from its files into `publisher_title`, with the file and field in `publisher_title_from` (none
where the files carry only codes).
The timeline's "About the data shown" (`AboutData.jsx`) shows both, labelled, for every layer that is on.
Each fetch takes whole series again (publishers revise recent values). A series is never
resampled to its own period or finer (weeks of a monthly series). Queries in `server/economic.js`
(`economicSeries(slug) { observations(from, to, resample: week | month | year) }`). `/timeline` draws
the chosen series in lanes under the events (daily ones as weekly averages; see Timeline). The page is `/economy/<tab>` (`Economy.jsx`, `PriceChart.jsx`): tabs per subject (Oil,
Unemployment, Inflation, Consumers, Housing, Interest rates, Health, GDP & Debt, Trade & tariffs, tax tabs; `ECONOMY_TABS` in `client/src/economy.js`, which are also
the subjects of the timeline's catalogue; a group's publisher is the bracketed end of its name, printed apart). Series are chosen above the chart (`SeriesPicker.jsx`, `?series=a,b`); several chosen share a chart when measured alike (dollars for the same period, or the same unit; `chartGroups`), otherwise charts are stacked with the same dates (`LinesChart`); values and dates are printed by unit and frequency in `client/src/economy.js`, series and period in the rail and the URL. Tracked in `features/economic-data/index.md`.

Dimensions: every series is labelled with what it measures, the form it is printed in and the breakdowns
that apply (`server/lib/series-dimensions.js`, test `series-dimensions.test.js`), for a composable picker on the
timeline. A new series must be labelled there or the test fails. Served as `EconomicSeries.dimensions` and
`seriesDimensionVocabulary`; the catalogue's Build mode (`SeriesBuilder.jsx`, `buildTree` in `client/src/dimensions.js`: the options as a tree, each choice opening what exists for it; sex, race, age and education as one Demographics level; click chooses, × takes out; the series reached go on the timeline)
narrows a measure by them; measures are reached through a taxonomy (see Taxonomies). Tracked in `features/series-dimensions/index.md`.

Names: every series is shown by its stored `economic_series.name`, everywhere (the Economy page, the
timeline, About the data; `useSeriesList.js`); `ECONOMY_TABS` names only pairs. Names follow
`design/timeline-data/NAMING.md` ("reads as a phrase": "Monthly Individual Income Taxes", "Average Federal
Tax Rate of the Highest Quintile"): Title Case, the reader's words, frequency only when it tells two series
apart, the publisher in brackets only when two print the same measure. They are written in
`server/lib/economic-series.js` and checked by `server/lib/series-names.js` (test: `series-names.test.js`; at most 80 characters);
the loader refuses names that break the rules. After renaming, `load-economic-series.js --names-only`
updates names and descriptions without reading any file (renamed 2026-10-11).

## Glossary

`GLOSSARY.md` defines the words for data, in code and on screen (agreed 2026-10-13): **publisher → program (or
collection, for documents) → file → series**; a series has one **measure** and one **category** in each **taxonomy**.
The whole list of publishers and programs is the **sources** (`sources.json`, `/sources`). Avoid "dataset" (ambiguous:
publishers use it for whole collections; say series, program or file), "registry", "source" as a level,
and "structure" for a taxonomy. Readers see "series" wherever a date-and-value line is meant.

## Data Sources

Every program (statistics) and collection (documents) GovGraph uses, at `/sources` and `/sources/<program>`
(`DataSources.jsx`, `SourceProgram.jsx`; queries in `server/sources.js`). Organizations (kind, branch, parent), their
lineage (renamed, merged, transferred, split, abolished, with the act as a `bill:` / `fr:` reference) and programs
(publishers and their roles, licence, how fetched, status, whether the 2012 Statistical Abstract cites it) are written
by hand in `server/seed/data/sources.json` (`organizations`, `lineage`, `programs`); `server/lib/sources.js` has the
vocabularies, checks and schema (`source_organizations`, `source_lineage`, `source_programs`,
`source_program_organizations`, `source_files.program`, `economic_series.program`; renamed from `…dataset…` on
2026-10-13). A program owns its files by path prefix in the data folder (`paths`); a series belongs to the program of
its file, or by `series_sources` for demographic series. Every new series and every new data folder must match a
program (`sources.test.js`, and the loader reports files that match none).

    node --env-file=server/.env server/seed/load-sources.js [--dry-run] [--no-files]

- Program kinds: `statistics` (a program), `documents` (a collection), `classification` (a scheme for sorting other
  data, such as CAP's codebook).
- Licences: `public-domain` (federal works, 17 U.S.C. 105, or CC0), `open-licence`, `free-with-terms`,
  `licensed`, `unchecked`. Anything not federal is read on the publisher's site and dated (`checked`).
  Licensed data is listed, not collected (user, 2026-10-13).
- Access, most preferred first: bulk, file, API, API with key, web page, Internet Archive. Bulk downloads are
  preferred over API keys (user, 2026-10-13). A contact address goes in the User-Agent only where the publisher
  requires one (BLS) (user, 2026-10-13).
- A program the Statistical Abstract does not cite has `in_abstract: false` and says why (`outside_abstract`).
- The University of Michigan's consumer sentiment and Freddie Mac's mortgage rates are kept for now, although
  their terms forbid republishing (user, 2026-10-13); both are recorded as `free-with-terms` with the limits quoted.
- The list page has a search field (every word must appear in a program's name, description, notes or its
  organizations' names) that combines with the rail's filters; it is not kept in the URL.
- Every downloader calls `recordFetch(file, url, { archive })` (`lib/data-dir.js`), which appends to
  `<data dir>/fetch-log.jsonl`; the loader reads it into `source_files` with each file's sha-256.
- As of 2026-10-14: 250 organizations, 10 lineage entries, 409 programs, most added from the Abstract's source notes.
  366 are not collected yet: `collected: false`, `paths: []`, `access.used: []` and `access.best` (the best way to get
  them). The list page says "Not collected"; the program page says "Not yet" (or "licensed" for licensed data).
- Licences of non-federal programs: 61 `licensed` (sold or restricted, partly from knowledge, noted as such), 21
  `free-with-terms` and 4 `open-licence` (terms read, dated), 36 `unchecked` (each notes whether terms were searched
  for and not found, or not yet searched). Every homepage was requested on 2026-10-14 and broken ones fixed; where a
  publisher has no site, the homepage is the Abstract table that cites it.
- The loader removes programs no longer in the file, so renaming a slug (and its references in the coverage file) is
  safe.

Tracked in `features/data-sources/index.md`.

## Statistical Abstract

The **Statistical Abstract of the United States, 2012** (131st edition, the last from the Census Bureau; ProQuest
continues it under licence) is the foundation of all data collection (user, 2026-10-13):

- **Shopping list.** Every table (1,396 online in 30 sections) has a source note naming its publisher. GovGraph
  collects that publisher's current, full data, not the Abstract's 2011 numbers. Every section is in scope,
  including Puerto Rico and the Island Areas, International Statistics, and tables by state or country.
- **Organisation.** The Abstract is a taxonomy: its 30 sections, and as subsections the 206 groups the Census website
  lists each section's tables under (every online table in exactly one; user, 2026-10-13). The book's contents only
  point at selected topics and do not divide the tables (the mining tables have no entry), so they are kept for the
  book view only (`contents`). Tables say where series belong; they are evidence, never shown as data. One place per series.
- The whole book is in the data folder (`www2.census.gov/library/publications/2011/compendia/statab/131ed/2012-statab.pdf`).
  Section pages are `census.gov/library/publications/2011/compendia/statab/131ed/<slug>.html` (for example
  `construction-housing.html`); each lists its tables under its subsections (`<h3>`, alphabetical on the page, so
  book order comes from the first table) as `…/131ed/tables/12sNNNN.xls` ("973 - Price Indexes of New One-Family
  Houses Sold, by Region").

The Abstract as Census left it online (Phase 2, 2026-10-13): the section pages, every table file and the section
PDFs are in the data folder (pages under `census.gov/…/131ed/`, files under `www2.census.gov/…/131ed/tables/`; 1,442
files, 148 MB), read by `server/lib/statab.js` (test `statab.test.js`). The tables are evidence only, so they are kept
in a file, not the database (user, 2026-10-13): `server/seed/data/statistical-abstract-tables.json`, one line per table
(all 1,406: `id`, `section`, `category` = its subsection, the website group it is listed under (the 10 printed but
not linked go with the table before them); `page` from the section PDF; `title` as printed; `online`; `url`;
`source` = the source note; `notes` where a file is odd). Built by `server/seed/build-abstract-tables.js` from the files; never edited by hand.
Table files follow one layout (a screen-reader line naming the column-head rows, "Table N. Title", the headnote in
brackets, heads, body, symbols, "FOOTNOTES:", "Source:", "For more information:", "Internet release date:"); seven are
.xlsx under the .xls name. Section PDFs print the page number in the foot (sometimes on the credit line) and headings
as "Table 961.", "Table. 553." or a bare "1158.". 1,389 source notes read; 17 tables carry notes.

    node server/seed/fetch-statistical-abstract.js [--only <section slugs>] [--pages-only] [--refresh-pages] [--dry-run]
    node server/seed/build-abstract-tables.js [--dry-run]

**Coverage (Phase 3, 2026-10-14).** `server/seed/data/statistical-abstract-coverage.json` (hand-kept; a file, not the
database) gives every table `programs` (slugs in `sources.json`), `coverage`, `shape`, and where they apply `in_hand`,
`series` and `note`. Vocabularies and `checkCoverage` in `server/lib/abstract-coverage.js` (test
`abstract-coverage.test.js`, with `sources.test.js` the guard for any edit to either file):

- `coverage`: `have` (every series it prints is loaded), `partly`, `wanted`, `licensed` (only for licensed programs),
  `discontinued` (the note names the successor), `unpublished` and `compiled` (no programs; the Abstract built it from
  unpublished data or from sources named in footnotes). Totals (2026-10-15, after the national accounts): 20 have, 32
  partly, 1,162 wanted, 95 licensed, 67 discontinued, 25 unpublished, 5 compiled.
- `shape`: `time-series`, `by-place`, `snapshot`. `in_hand`: the publisher's file is in the data folder, not loaded (61; 81 before Phase 5).
- `series` (required for have / partly, only for them): what is loaded, as series slugs, measures (a measure covers its
  national series and every place), `nipa:T20100` (a NIPA table's lines) or `prefix--*` (a family of published groups, e.g. `unemployment-rate--*`). The page
  resolves them from `economic_series`, so a note can't claim what isn't loaded.
- Sections 9, 12 and 14 were entered by hand; the other 27 were drafted from the source notes by pattern (the script was
  not kept) and reviewed against publishers and titles. Seven tables were assigned by judgement because their source
  notes can't be read (867, 966, 967, 1025, 1029, 1033, 1400); each note says so.

Shown at `/sources/abstract-coverage` (`AbstractCoverage.jsx`, `components/AbstractTables.jsx`): every table under its
section and a heading row per subsection, with its programs, shape, page, "Loaded:" series, note and a coverage chip;
filters for coverage, shape and section kept in the URL, and a search. Each program's page lists the tables citing it
("Section › Subsection" headings), and the sources list counts them. GraphQL: `abstractCoverage`,
`SourceProgram.abstractTables` / `abstractTableCount`, `AbstractTable.series` (`coverageReport()` in
`lib/abstract-coverage.js` reads the files and is cached until one changes; program names and series are one query each,
shared by a request). A program any table cites reports `inAbstract: true`. In the timeline catalogue's Build tab, each
Abstract subsection ends with a folded "Not here yet · N tables" line (tables with nothing loaded; the filter matches
their titles). There is no page per series or measure yet; the planned one is `/series/<measure>` with the place as a
parameter, which "Loaded:" names would link to.

**Plan and status (2026-10-14; details in `features/statistical-abstract/index.md`):**

| Phase | What | Status |
|---|---|---|
| 0. The book | The 2012 PDF in the data folder | Done |
| 1. Sources | Every publisher and program already used, with licences, access and files (`sources.json`, `/sources`) | Done |
| 2. Skeleton | Section pages, table files, section PDFs; every table's page, subsection, title, source note | Done |
| 3. Source notes → programs | Every table's programs, coverage (have / partly / wanted / licensed / discontinued / unpublished / compiled) and shape in `server/seed/data/statistical-abstract-coverage.json` (checked by `server/lib/abstract-coverage.js`); 409 programs in `sources.json`. Every Census "Current Population Reports" series (P20, P25, P60, …) is one program | Done (2026-10-14): all 30 sections, reviewed; report at `/sources/abstract-coverage` |
| 4. Placements | Every measure placed from the tables (17 by table, 12 by judgement) | Done (2026-10-14), with wanted tables shown as "Not here yet" under each subsection in the catalogue's Build tab |
| 5. Collect | Section by section: fetch the publisher's current data, label, name, place, load; first the 81 tables whose files are in hand | **Under way**: the 20 NIPA tables loaded (2026-10-15) |

**Phase 5, national accounts (2026-10-15).** Whole publisher tables, yearly and quarterly where both are printed
(user). `server/lib/nipa-series.js` lists 15 measures, each drawing every line of some NIPA tables (31 tables, 2,439
series, slugs `nipa-<code>-yearly|quarterly`); the tables' lines come from BEA's registers through
`server/seed/build-nipa-tables.js` into `server/seed/data/nipa-tables.json` (re-run after BEA's annual update and
check the diff). A code printed in several tables belongs to the first measure listing it; a line already loaded by
hand at one frequency gets a `twin_of` at the other, labelled and named after it. Names are generated from BEA's
labels with hand overrides by code stem in `server/seed/data/nipa-names.json`; the name limit is 80 (was 60;
`design/timeline-data/NAMING.md`). Coverage's `series` may name `nipa:T20100` (every series of that table's lines).
Load with `load-economic-series.js --source bea`.

Other work in hand (user, 2026-10-13): move the remaining API-key fetches to bulk files (economic data done; Congress.gov,
including the app's live call in `resolvers.js`, then govinfo, then CourtListener; `features/data-sources`); drop the
contact address from fetches to publishers that do not require it (`fetchFile` in `fetch-economic-series.js` still sends
it to BEA, Freddie Mac, FHFA and others). The work is on branch `sources-and-structures`, not yet merged to `main`.

## Taxonomies

The page **Taxonomies** (`/taxonomies`, `pages/Taxonomies.jsx`; `/structure` and `/abstract` redirect) shows the
official taxonomies GovGraph's series are placed in, as nested categories: the Statistical Abstract (also shown as
the book: sections, table ranges, printed pages, appendices) and the Comparative Agendas Project's topics (codes,
descriptions). Each taxonomy is a JSON file in `server/seed/data/taxonomies/` (`{ id, name, basis, levels, source,
categories }`, a category `{ id, name, children }` plus its scheme's fields), imported by the client through the
`@data` alias in `client/vite.config.js` (`client/src/taxonomies.js`). The Abstract's file is built from the book's
PDF and the saved section pages by `server/seed/build-abstract-taxonomy.js` (sections from the contents, with section
numbers as codes and each section's opening paragraph as description; subsections from the website's groups; the
contents' topics as `contents`, shown in the book view). CAP's file is rebuilt by `server/seed/fetch-cap-codebook.js` (saves the
codebook and its licence page to the data folder; parser `server/lib/parse-cap-codebook.js`, with a test); CC BY-NC-SA
4.0, so the derived file carries the same licence. Codes are hidden unless "Codes" is ticked. The downloaded Abstract
PDF repeats Education's pages and stops at page 876. Tracked in `features/taxonomies/index.md`.

**Category ids never change once made** (user, 2026-10-13), even if a name does. Both builders write through
`writeTaxonomy` (`server/lib/taxonomies.js`), which keeps the file's existing ids (`keepIds`: matched within the same
parent by code, then name, then position), reports renamed and added categories, and refuses to drop one unless
`--allow-removing`. CAP's ids are its codes.

**Placements** (`server/seed/data/placements.json`, checked by `server/lib/taxonomies.test.js`): per taxonomy,
`measures` places each measure (`MEASURES` in `server/lib/series-dimensions.js`, GovGraph's own flat list), and its
series follow it. A measure is one thing measured in one place (user, 2026-10-13): where the Abstract prints a
measure's series in two subsections they are two measures, which may share a name. A measure's key is its place and
its name, never a publisher or series: its Abstract category id plus its name as a slug
(`prices/consumer-price-indexes-cost-of-living-index/consumer-prices` for the CPI,
`prices/price-indexes/consumer-prices` for the PCE index; tested against its Abstract placement, so moving a measure
changes its key and every series' reference with it). In the Abstract no two measures of one name share a subsection; in CAP they may, and the Build tree shows them as one leaf (key `a+b`,
`withMeasures` / `partsOf` in `client/src/taxonomies.js`). A placement is `{ category, basis: 'table', tables }`,
`{ category, basis: 'judgement', reason }` or `{ left_out: true, reason }`; the taxonomy files are never edited for
this. `table` means an Abstract table prints the measure's own data from the same publisher; otherwise `judgement`,
naming the nearest table. In the Abstract (Phase 4, 2026-10-13): 17 of 29 measures by table, 12 by judgement. CAP's
placements are all judgement. A new measure needs a placement in every taxonomy.
A `table` placement in the Abstract must cite tables printed in its category (checked against
`statistical-abstract-tables.json`). Nothing about taxonomies or placements is in the database: the files are the only
copy, until something needs to query them (user, 2026-10-13).

The timeline catalogue's **Build** tab (`SeriesBuilder.jsx`, left column `TaxonomyTree.jsx`; design D.1 in
`design/timeline-data/build-structures/`) is a taxonomy (Statistical Abstract or Policy topics (CAP), switchable)
nested down to the measures as leaves (`withMeasures` in `client/src/taxonomies.js`), with a filter over category
names, CAP's subtopic descriptions, measures and series names, "Only with data", and "Not in this taxonomy" last.
Choosing a measure opens its choices as before, headed by its path and why it sits there. Below 860px the tree gives
way to a select grouped by top-level category.

## PDFs

govinfo sends `X-Frame-Options: SAMEORIGIN`, so its PDFs cannot be embedded directly. The in-page
viewers load them through `server/pdf.js`, which only fetches from `www.govinfo.gov` (and
`www.congress.gov` as a fallback for bills) and rejects responses that are not PDFs:

- `/pdf/eo/:number` — an executive order's Federal Register print (skips correction notices)
- `/pdf/doc/:documentNumber` — any presidential document by Federal Register document number
- `/pdf/bill/:packageId` — a bill text version, e.g. `BILLS-119hr1enr`

The PDF URL for orders and memoranda comes from the Federal Register API (`pdf_url`), so every
order has the link and viewer whether or not its text has been parsed.

## Design Mocks

Static, non-interactive HTML mocks live in `server/references/`. They use real order titles,
dates and text, hardcoded. Chrome's automation cannot open `file://` URLs; to check one, serve
the folder briefly (`python3 -m http.server 9002 --bind 127.0.0.1`) and stop it afterwards.

- **Current app design: dark teal** (list + order page as a pair): `eo-list-design-dark-teal.html`,
  `eo-detail-design-dark-teal.html`. White, Inter, JetBrains Mono for numbers, accent `#0f766e`
  (pale `#e6f4f2`), text `#14181f`, muted `#667085`, hairlines `#e4e7ec`. List page: filter rail
  on the left (Year signed with bars and counts), table with sticky column headings and year rows.
- **Previous design: navy** `#0a1628`, gold `#c9a84c`, cream `#f5f0e8`; Playfair Display, IBM Plex.
  Recorded in `design/navy/`. Mocks in this look: `eo-list-design-ledger-navy.html`,
  `eo-list-design-ledger-combined-navy.html`.
- **Other list-page explorations:** `eo-list-design-ledger.html` (rows under year headings),
  `-ledger-daybook` (by date, warm palette), `-ledger-combined` / `-combined-blue` /
  `-combined-green` (ledger rows + filter rail), `-gazette`, `-graphite`.
- **Order text explorations:** `eo-13636-readable.html`, `-readable-briefing.html`,
  `-readable-document.html`.

How the design is built in the app (`features/redesign-dark-teal`):

- All styling is classes in `client/src/index.css` (tokens on `:root`); components carry no
  colours or fonts, and inline `style` is used for geometry only. Hover is CSS, not JS.
  Drawing code (d3, SVG) takes colours from the tokens via `style`, e.g. `var(--accent)`.
- Every page is a `PageLayout` (`client/src/components/`): a rail on the left and the content,
  or, with `head`, the reading layout for a single document. Rail pieces are in `Rail.jsx`
  (`RailGroup`, `RadioOptions`, `CheckOption`, `YearFacet`, `Fact`); lists are `table.records`.
- Tailwind is imported but unused; class names must avoid its utility names (`block`,
  `contents`, `outline`), which it would generate rules for.
- Colours with a meaning (party, branch, status) have their own tokens and `.chip` variants.

Preferences settled in use (2026-10-02):

- Document pages (order, memorandum, bill) share one header: facts row, then a row of buttons
  (Show/Hide full text, Show/Hide PDF, then outbound links ending in ↗). Full text is shown by
  default. On the bill page, legislative progress with action history, and tags, each sit behind
  their own Show/Hide button and start closed.
- Memoranda have no number; lists show their Federal Register citation ("82 FR 7629") in the
  first column, headed "Citation".
- Lists sort newest first by default, with an Order control in the rail.
- Dates in lists and tables are "Oct 1, 2026" (`client/src/dates.js`, `shortDate`); detail pages spell
  the month out ("October 1, 2026"). Not ISO, not 10/01/2026 (2026-10-03).
- Recorded votes on the bill page (`BillVotes.jsx`), behind "Show votes (N)" (a button like the
  others, not a tab; shown only when a bill has votes). Votes that decide the bill come first.
  Each has a position-by-party table with bars and an expandable member list grouped by state.
  "Roll call" is the event, "member vote" one member's answer; they are separate tables.
- Party bars use the fill tokens `--rep-fill`, `--dem-fill`, `--ind-fill` (`index.css`): the
  full-strength `--rep` / `--dem` were too harsh for filled areas and a pale version too soft;
  the current values are a middle shade. Party chips and party text keep `--rep` / `--dem`.
- Charts are minimal, like the Economy page's `PriceChart` (2026-10-11): horizontal gridlines only,
  muted mono scale with the unit above it, years under the plot, one line with a light fill,
  legend in normal case. No dashed lines through charts, no tick for every year, no all-caps titles;
  yearly and quarterly values are a line through the middle of each period, not steps. The user
  found the timeline lanes "too nerdy… too R" before this.
- The contents tree in the rail: one vertical rule (nested entries indent, no extra rules), a
  divider below it, no visible scrollbars (rail and tree still scroll), and it is the rail's only
  scrolling area. A single cycling expand button was rejected in favour of − and + opposite
  "Contents".

- A round back-to-top button (▲, `BackToTop.jsx`, mounted once in `App.jsx`) appears at the bottom right once a
  page is scrolled two screens down (2026-10-11).

Preferences settled while reviewing the mocks:

- Section headings are printed plainly: a small "Section N" label, then the title. No bands,
  boxes or rules around them, and no hairlines between items.
- The contents rail starts level with the first line of the text, not beside the page title.
- The current item in a list is marked by colour (and a segment of the rail's rule), not a
  filled highlight. Deadlines are coloured text only, no background.
- The "Kind" facet and column in the mocks are invented from title keywords; no such field
  exists. govinfo subjects (`structure.govinfo`) are the only publisher-assigned classification.

## Graph Visualization Conventions

Layout follows the **Sugiyama framework** (hierarchical graph drawing).

- **Straight lines** — adjacent-level edges (one level apart in hierarchy)
- **Curved dashed lines** — skip-level edges (citing jumps over intermediate levels)
- **Edge bundling** — parallel edges on similar paths drawn as a bundle (at scale)

Key terms: polyline routing, long edge routing, transitive edges, skip edges.

Layout algorithms: **Dagre** (simpler, good default) or **ELK** (more powerful).
Both available via Cytoscape.js.

## Document Taxonomy

Federal document types to eventually collect (priority order):

**Executive Branch**
- Executive Orders (starting point — this project)
- Presidential Memoranda
- Presidential Proclamations
- Presidential Determinations
- Signing Statements
- National Security Presidential Directives / PPDs / NSMs
- OMB Circulars and M-series memos
- OLC opinions

**Legislative Branch**
- Public Laws / Statutes
- Congressional Record
- Committee reports and hearing transcripts
- CRS reports, GAO reports
- CBO cost estimates

**Judicial Branch**
- SCOTUS opinions (majority, concurring, dissenting)
- Circuit and District Court opinions
- FISA Court declassified orders

**Regulatory**
- Final rules (Federal Register)
- Proposed rules (NPRMs)
- Agency guidance documents, Dear Colleague Letters
- CFR (Code of Federal Regulations)

## Open Questions / To Revisit

- Whether to show transitive edges or only minimal spanning structure in the viz
- How edge bundling behaves at depth 2+ with tens of thousands of nodes
- How Dagre/ELK handle automatic straight vs curved routing decisions
- Cytoscape.js implementation directly against Supabase
- State vs federal scope (currently federal-only)
- Whether to store parsed document structure as JSON modelled on USLM / Akoma Ntoso names
- How to extract citations the publisher did not link (e.g. Presidential Policy Directives)

## Key Decisions Already Made

- Citation = the edge. No citation, no formal relationship. Implicit overruling etc.
  goes in a `notes` column, not dedicated schema.
- `relationship = NULL` means the edge exists but type is unknown (acceptable state).
- `source` column on relationship rows tracks data quality (authoritative vs structural).
- UNIQUE constraint on (citing_id, cited_id) prevents duplicate edges on re-import.
- Exception to "citation = the edge": relationships between bills that Congress.gov publishes
  (identified by CRS, the House, the Senate or GPO) are stored as edges though they are not citations,
  because they are authoritative and published (`bill_relationships`). Their unique key includes the
  relationship type, since one pair can have several. Our own additions go in the same table with
  `source = 'govgraph'` and a note.

## Feature Tracking

Active features are tracked in `features/`. Each feature has its own subfolder with an `index.md`.

**Before starting work on a feature:** read the relevant `features/<name>/index.md` (or create one if it doesn't exist).

**After completing work:** update `## Done`, `## Todo`, and `## Status` in the feature file. Run `npm run dashboard` from the project root to regenerate `features/dashboard.html`.

Feature folder names should be kebab-case (e.g. `graph-layout`, `data-pipeline`).