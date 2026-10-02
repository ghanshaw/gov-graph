# Executive Orders

## Status
In Progress

## Goal
Surface presidential executive orders (and related documents — memoranda, proclamations) from the
Federal Register API. Each president has a profile page; documents are browsable by type with
search and year filtering. Individual orders have detail and full-text views.

## Done
- [x] Federal Register API integration (no key required, 10-min node-cache TTL)
- [x] GraphQL: `executiveOrders(president, documentType, page, perPage, search, year)` query
- [x] GraphQL: `executiveOrder(number)` and `executiveOrderText(number)` queries
- [x] Presidents list page (`/`)
- [x] President profile page (`/:slug`) with document type nav
- [x] Paginated list page with search + year filter (`/:slug/:docType`)
- [x] Order detail page (`/:slug/:docType/eo/:number`)
- [x] Full text page (`/:slug/:docType/eo/:number/text`)
- [x] Obama and Biden coverage
- [x] govinfo API fetch script (`server/seed/fetch-govinfo-executive-orders.js`) — 275 Obama EOs with full text and references in `server/seed/data/govinfo-obama-eos.json`
- [x] Loader (`server/seed/load-govinfo-executive-orders.js`) — filled `executive_documents.body` for 275 Obama EOs, matched by EO number
- [x] GraphQL: `ExecutiveOrder.body` field (read from `executive_documents`); full text shown inline on the order detail page
- [x] Parser `server/lib/parse-executive-order.js`: Federal Register HTML → structure JSON (sections → items → spans, citations, parts, annex images). Handles untitled and sub-numbered sections, nesting by marker kind, orders with no sections. Test: `node --test server/lib/parse-executive-order.test.js` (reproduces the two hand-built references `server/references/eo-13636.json` and `eo-14160.json`)
- [x] `server/seed/fetch-federal-register-executive-orders.js --president <slug>` → `server/seed/data/fr-eos-<slug>.json` (metadata + raw HTML)
- [x] `server/seed/load-executive-order-structure.js --president <slug>` → `executive_documents.structure` (jsonb) and `source_html` (raw HTML). Loaded for all Obama orders (276), all Trump first-term orders (220), all Biden orders (162) and all Trump second-term orders through EO 14434 (288; 28 were new rows). EO 13548 has no Federal Register HTML and is parsed from govinfo's plain text
- [x] govinfo fetch script takes `--president`; govinfo package id, subjects and references are stored in the structure's `govinfo` block (274 Obama, 218 Trump 45, 158 Biden, 274 Trump 47)
- [x] `executiveOrder(number)` skips correction / republication notices (13526 no longer shows "Correction")
- [x] GraphQL: `ExecutiveOrder.structure` (JSON scalar)
- [x] Order detail page: formatted text with a contents list on the left for orders that have `structure` (`OrderText`, `OrderOutline`); text shown by default with a Show/Hide full text button; Federal Register button above the text; sans serif title
- [x] Executive order cards: equal height, sans serif titles
- [x] Sort on `/executive-orders` and the president pages (newest first by default, or oldest first); `executiveOrders(order:)` passes the Federal Register sort order through. Same control on the president pages (`/:slug/:docType`, grid and timeline views)
- [x] PDF: `ExecutiveOrder.pdfUrl` (Federal Register printed pages on govinfo), a "PDF ↗" link and a Show/Hide PDF viewer on the order page. govinfo blocks embedding, so the viewer loads `/pdf/eo/:number`, which the server passes through (`server/pdf.js`)
- [x] Quoted provisions in amending orders (paragraphs that open with “) are marked by the parser (`quoted`, `quote_level`) and shown as an indented block (`QuotedBlock` in `OrderText`); 383 paragraphs in 57 orders. Parser decodes `&thinsp;` / `&emsp;` / `&ocirc;` ("§ 2.1" no longer shows the raw entity). Structures re-loaded for Obama, Biden and Trump 47
- [x] Item markers wider than their column, e.g. (iii), no longer run into the text
- [x] Numbered lists ("1. …") are parsed as items (marker keeps its period, `"1."`) and shown with a hanging number. A quotation stays open until its closing mark, so numbered or unmarked paragraphs after an opening “ stay in the quoted block (e.g. the contract clause in EO 14398); quoted paragraphs carry `quote_marker` and hang it beside the text

## Todo
- [ ] Structured text for Bush (291 orders in the database, 2001–2009): add him to the fetch script's president list and run the loader
- [ ] Amending orders that restate whole sections without quotation marks produce repeated section numbers (13545, 13637, 13719, 13824, 14032, 14048, 14327)
- [ ] Republished orders (R1-…, e.g. 13719, 14388) are skipped; the stored text is the original printing
- [ ] Citations the Federal Register did not link (cases, Presidential Policy Directives) are not extracted
- [ ] The tag page's order lookup still takes the first Federal Register result (can be a correction notice)
- [ ] Fill EO 13510, which is missing from govinfo's CPD collection (available from the Federal Register)
- [ ] Full text for other presidents (detail page falls back to the Federal Register "Full Text" link when `body` is empty)
- [ ] Turn govinfo `references` and in-text "Executive Order NNNNN" citations into graph edges
- [ ] Add remaining presidents (Trump I, Bush, Clinton)
- [ ] Add Proclamations document type
- [ ] Add Notices / Rules document type
- [ ] Fix search function (currently broken — may require own DB table)

## Decisions / Notes
- `:slug` param is the Federal Register president slug (e.g. `barack-obama`, `donald-trump`)
- `president` field on Federal Register API returns `{ identifier, name }` object — extract `.identifier` in `mapOrder`
- Search and year filter are server-side via Federal Register API query params
- govinfo: presidential documents are collection `CPD` (package ids `DCPD-*`); needs `GOV_INFO_KEY` (api.data.gov). EOs are picked by title (`Executive Order NNNNN-…`) and confirmed by `president.id` in the package summary
- govinfo package summaries include `references` (U.S. Code, Public Law, Statutes at Large citations) — a ready source of edges
