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
- `client/` — Vite + React app. `npm run dev` → http://localhost:9000 (proxies `/graphql` to 9001)
- `server/lib/` — shared code, e.g. `parse-executive-order.js` and its test
- `server/seed/` — ingest and load scripts; data files in `server/seed/data/`
- `server/references/` — sample source documents kept for reference (e.g. the `eo-13636-*` files)
  and static HTML design mocks (`eo-list-design-*`, `eo-detail-design-*`; see Design Mocks)
- `research/` — background notes (e.g. `legal-document-structure.md`)
- `design/` — design references. `design/navy/` records the previous navy-and-gold design as of
  2026-10-02 (notes, full-page screenshots, source snapshots, `capture.sh`), before the move to
  the dark teal design
- `features/` — feature tracking (see below)

`server/.env` (gitignored; template in `server/.env.example`) holds `DATABASE_URL`,
`COURTLISTENER_TOKEN`, `CONGRESS_API_KEY` and `GOV_INFO_KEY` (api.data.gov key for govinfo).
The server must be restarted after changing `.env` or `schema.js` (no watch mode in `npm start`).

## Database

Hosted on Supabase. Auth is via GitHub SSO (no password login).
Connection string is in Supabase dashboard → Settings → Database.

The direct host (`db.<ref>.supabase.co`) has an IPv6 address only. If it fails with
`ENOTFOUND`, check whether the project is paused and whether the network resolves IPv6;
the pooler connection string is the IPv4 alternative.

### Live tables (as of 2026-10-02)

The live database has moved past the pattern below. Tables: `executive_documents`,
`corpus`, `corpus_tags`, `tags`, `cases`, `case_opinions`, `courts`, `legislation`,
`legislative_documents`, `bill_actions`, `congresses`, `people`, `person_roles`, and the
case-graph tables `cg_cases`, `cg_case_relationships`, `cg_scdb_cases`, `cg_data_sources`.
There is no `documents` or `document_relationships` table, and `server/seed/schema.sql`
does not define most of these. Some resolvers still reference the old `entity_tags`
table, which no longer exists (see `features/record-management`).

`executive_documents`: `id` (uuid), `doc_type`, `number`, `title`, `president_id`,
`signed_date`, `body`, `source_id` (unique; Federal Register document number), `source_url`,
`structure` (jsonb; parsed sections → items → spans and citations) and `source_html` (raw Federal
Register HTML), both filled for all Obama, Trump (both terms) and Biden executive orders.
Federal Register correction and republication notices share an EO number with the order
itself and have `source_id` like `C1-…` / `R1-…`.

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
- After changing the parser: `node --test server/lib/parse-executive-order.test.js`, then re-run
  the loader for each president (`--dry-run` first). It rewrites `structure` on every row
  (276 Obama, 162 Biden, 288 Trump 47) and needs no server restart.

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

## Feature Tracking

Active features are tracked in `features/`. Each feature has its own subfolder with an `index.md`.

**Before starting work on a feature:** read the relevant `features/<name>/index.md` (or create one if it doesn't exist).

**After completing work:** update `## Done`, `## Todo`, and `## Status` in the feature file. Run `npm run dashboard` from the project root to regenerate `features/dashboard.html`.

Feature folder names should be kebab-case (e.g. `graph-layout`, `data-pipeline`).