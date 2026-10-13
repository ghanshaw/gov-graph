# Tagging System

## Status
Repaired 2026-10-11 (first built 2026-05-21; it broke when `entity_tags` was dropped and its links were lost —
the five words in `tags` survived, attached to nothing). Not yet checked by eye in the browser.

## Goal
A curator-applied tagging system allowing entities across all three branches (EOs, SCOTUS cases,
legislation) to be labeled with a shared tag (e.g. "birthright") and viewed together on a unified
tag page. Implemented 2026-05-21.

## Done
- [x] DB: `tags` table (id, word UNIQUE, source, created_at)
- [x] DB: `entity_tags` table (tag_id, entity_type, entity_id, UNIQUE on triplet)
- [x] GraphQL types: `Tag`, `TagSummary`, `TagPageResult`, `TaggedExecutiveOrder`, `TaggedScotusCase`, `TaggedLegislation`
- [x] GraphQL queries: `allTags`, `tagPage`, `tagsForEntity`
- [x] GraphQL mutations: `applyTag`, `removeTag`
- [x] Resolver: `tagsForEntity`, `allTags`, `tagPage` (fans out to Federal Register / CourtListener / Congress.gov in parallel)
- [x] Fix: `mapOrder` updated — Federal Register `president` field is `{ identifier, name }` object, not a string
- [x] Frontend: `TagPanel.jsx` — chip display + add/remove UI on detail pages
- [x] Frontend: `TagsIndex.jsx` — `/tags` route, all tags with entity counts
- [x] Frontend: `TagPage.jsx` — `/tags/:word`, entities grouped by branch
- [x] Wired TagPanel into Detail.jsx, CaseDetail.jsx, BillDetail.jsx
- [x] Added `/tags` and `/tags/:word` routes in App.jsx
- [x] Header: "Tags" nav link added

## Done (repair, 2026-10-11)
- [x] `item_tags(tag_id, ref, note, created_at)` keyed by ref (`server/seed/create-tag-tables.js`); refs `fr:`, `bill:`,
      `scotus:`, `usc:`, `report:` (`server/tags.js`). Tags keep `word` as name and address; `description` used
- [x] Server module `server/tags.js`: `tags`, `tagsForItem`, `tagPage` (items from the database, no live fan-out);
      `createTag`, `applyTag` (existing tags only), `removeTag`, `describeTag`, `mergeTag`, `deleteTag` (only when unused)
- [x] `TagPanel itemRef`: autocomplete against existing tags; Enter never creates; "Create tag" button with
      "Did you mean" near matches (`client/src/tags.js`: edit distance ≤ 2, shared 3-letter stem, containment)
- [x] On order, memorandum, bill, decision, U.S. Code section and report pages
- [x] Tag page grouped by kind, with description, merge (two clicks) and delete when empty

## Todo
- [ ] Check the panel and tag page by eye (Chrome was not connected)
- [ ] Re-apply the five surviving words (birthright, energy, clean-energy, housing, iran) or delete them
- [ ] Tags on items with no page of their own: economic series, periods (collections can include them meanwhile)
- [ ] Optional: export tags to a file in git

## Decisions / Notes
- (2026-10-11) Tags and collections are separate. A tag is a flat label applied by hand to one item ("what is
  this about?"); a collection is a page assembled from sources, one of which can be tags (see `features/collections`).
- (2026-10-11) Tags stay purely manual: never derived by rules. Rules live in collections.
- (2026-10-11) No aliases for now. Variants are prevented by autocomplete + explicit creation, and fixed by merge.
  Several related tags are gathered by a collection with several tag sources, not by aliasing.
- (2026-10-11) No hierarchy (tariffs under taxation). Showing related concepts together is a collection's job.
- (2026-10-11) Publisher vocabularies (CRS subject terms, FR topics, govinfo subjects) are not imported as tags;
  they are publisher data, used as collection rules.
- (superseded 2026-10-11) Entity ID formats were EO number, CourtListener id, `119-HRES-27`; now refs (see `server/tags.js`)
- Apollo hooks (`useQuery`, `useMutation`) must be imported from `@apollo/client/react`, not `@apollo/client` — Vite dep bundling does not re-export from root package
- EO internal route is `/:slug/:docType/eo/:number` — president slug reconstructed at render time from `president` field; falls back to Federal Register URL if null
- `item_tags` replaces both `entity_tags` and the planned `corpus_tags`: `corpus` covers documents only, and tags must reach
  Code sections, series and periods too. `corpus_tags` (empty) is left in place.
