# Redesign: dark teal

## Status
In Progress

## Goal
Move the whole app from the navy-and-gold look to the dark teal design: white page, Inter,
JetBrains Mono for numbers, teal `#0f766e` as the one accent, a rail to the left of the
content, tables under a dark rule instead of cards. Reference mocks:
`server/references/eo-list-design-dark-teal.html` and `eo-detail-design-dark-teal.html`.
The previous look is recorded in `design/navy/`.

## Done
- [x] Baseline: the navy state committed on branch `redesign-dark-teal` before any change
- [x] Tokens and shared classes in `client/src/index.css`; fonts loaded in `client/index.html`
- [x] Top bar (`Header.jsx`): 54px, not sticky, scrolls sideways when narrow
- [x] Shared components: `PageLayout` (rail + content, or reading layout with `head`), `Crumbs`,
      `Rail.jsx` (`RailGroup`, `RadioOptions`, `CheckOption`, `YearFacet`, `Fact`), `SearchBox`,
      `OrderTable`; `hooks/useDebounce.js` replaces four copies
- [x] Executive order lists (`Home.jsx`, `ExecutiveOrders.jsx`): rail with Year signed (bars and
      counts), President, View, Order; table with year rows; pager with "Showing 1–20 of N"
- [x] GraphQL `executiveOrderYearCounts(president, documentType, search, years)`: one count per
      year with the list's own conditions
- [x] Order page (`Detail.jsx`): reading layout, facts row (Signed, President, Published,
      Citation), contents in the rail, "In this order" counts, Show (text / PDF), Subjects
- [x] Order text (`OrderText.jsx`, `OrderOutline.jsx`) recoloured; cited documents and tags as
      panels of chips
- [x] Presidents, president profile, Supreme Court, natural court, case, Congress, session,
      bill, timeline, corpus, case graph, sources, tags: all on `PageLayout` with rails
- [x] Removed `ExecutiveOrderCard`, `CaseCard`, `BillCard` (lists are tables now)
- [x] No navy/gold literals, Playfair / IBM Plex, or JS hover handlers left in `client/src`
- [x] CLAUDE.md "Design Mocks" updated

## Todo
- [ ] Check the natural court table and the case page with live data: CourtListener answered
      429 (rate limit) during the redesign, so only their error states were seen
- [ ] Tagging was not exercised (it writes to the database); see `features/record-management`
      for the `entity_tags` problem
- [ ] `design/navy/capture.sh` could be re-run into `design/dark-teal/` for a matching record
- [ ] Lint: `midY` unused in `DAGGraph.jsx`, set-state-in-effect in `Timeline.jsx` (both
      older than the redesign)

## Decisions / Notes
- Styling lives in classes in `client/src/index.css`, not inline `style` props; hover is CSS.
  Inline styles carry geometry only (timeline positions, corpus tree connectors).
- Tailwind stays imported but unused. Class names avoid Tailwind utility names (`block`,
  `contents`, `outline`), which Tailwind would generate rules for.
- The mock's "Kind" column is not built: no such field exists.
- Rails hold only what a page already has (its filters, facts, jump lists).
- Year counts use one Federal Register count request per year, not its yearly facets, which
  count by publication date while the list filters by signing date.
- "All" in the Year signed rail is the list's own total. It can exceed the sum of the years:
  correction notices have no signing date (16 for Obama), and on `/executive-orders` the
  Federal Register's orders go back to 1994. The remainder is printed as its own line.
- The Federal Register has one identifier for both Trump terms. The list and counts now bound
  each term by signing date (`TERM_SIGNING_DATES` in `server/resolvers.js`); before, both
  Trump pages listed all 510 orders.
- Corpus tree: columns take the width of their subtree. With fixed 160px columns the third
  level overlapped (also true of the navy version).
