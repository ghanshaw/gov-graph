# Collections

## Status
Planning (2026-10-11). The tag repair it depends on is done (`features/tagging-system`).

## Goal
One page per subject showing everything GovGraph holds on it, across kinds: laws and bills, executive
orders and memoranda, Supreme Court decisions, U.S. Code sections, economic series, periods, reports.
First collection: tariffs (tariff laws, the orders and proclamations behind tariff actions, the cases on
them, and the trade series: customs duties, duties as a percent of imports, imports and exports).

## Decisions
- A collection is not a tag. A tag is a manual label on one item; a collection is a page assembled from
  sources, and every member shows why it is there ("cites 19 U.S.C. 1862", "tagged tariffs", or a note).
- Membership = the sources' results, plus hand-picked `include`s, minus `exclude`s (each with a note).
- Sources (rule kinds), first set:
  - `tag`: items with a tag. A collection may have several tag sources (tariffs + trade-agreements).
  - `cites_usc`: documents citing given U.S. Code sections (orders' `structure.citations`, bill sections
    through `usc-references.js`, decisions). This is the "definite" association: a tariff action names its
    authority (Section 232 = 19 U.S.C. 1862, Section 301 = 19 U.S.C. 2411, Section 201 = 19 U.S.C. 2251,
    IEEPA = 50 U.S.C. 1701 ff.).
  - `series`: economic series by slug.
  - Later: `bill_subject` (CRS legislative subject terms / policy area, as printed), `usc_title`, `hts`.
- Members are addressed by the same ref strings as tags (`server/tags.js`: `fr:`, `bill:`, `scotus:`, `usc:`, `report:`;
  to add: `series:`, `period:`).
- Single curator for now: collections are entered by hand in `server/seed/data/collections.json` (in git,
  like `reports.json` and `periods.json`) and loaded by a script. User-made collections wait for accounts.

## Todo
- [x] Tag repair first (`features/tagging-system`, 2026-10-11)
- [ ] Check whether `parse-bill-status.js` keeps CRS subject terms in `legislation.details` (decides `bill_subject`)
- [ ] Schema: `collections`, `collection_sources`, `collection_items`; loader for `collections.json`
- [ ] Resolver: resolve members with their reason; `collection(slug)` query
- [ ] Page `/collections/:slug`: timeline filtered to members with the collection's series as the band,
      then lists by branch with a "Why it's here" column
- [ ] Tariffs collection
- [ ] Proclamations: Section 232 tariffs are mostly proclamations, which are not collected yet; without them
      the tariffs collection misses most tariff actions
- [ ] Later: graph view of members and their citation edges (Cytoscape)
