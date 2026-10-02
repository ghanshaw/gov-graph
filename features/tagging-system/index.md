# Tagging System

## Status
Complete

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

## Todo

## Decisions / Notes
- Entity ID formats: EO → number string `"14160"`, SCOTUS → CourtListener cluster ID `"9118676"`, legislation → `"119-HRES-27"` (`${congress}-${type}-${number}`)
- Apollo hooks (`useQuery`, `useMutation`) must be imported from `@apollo/client/react`, not `@apollo/client` — Vite dep bundling does not re-export from root package
- EO internal route is `/:slug/:docType/eo/:number` — president slug reconstructed at render time from `president` field; falls back to Federal Register URL if null
- `entity_tags` will eventually be migrated to `corpus_tags` once the corpus table exists (see record-management feature)
