# Record Management (Schema Migration)

## Status
Not Started

## Goal
Migrate the database to a unified `corpus` table that acts as a cross-branch index of all documents.
Each branch-specific table (executive_documents, cases, legislation) gets its own entity table, and
a shared `corpus` row ties them together. Enables cross-branch search, timeline, and tag pages.

## Done

## Todo
- [ ] Phase 1: Run new schema.sql against Supabase; migrate existing `tags` + `entity_tags` → new `tags` + `corpus_tags`; seed `congresses` and `courts` tables; verify case graph data intact
- [ ] Phase 2: Write ingest scripts for `executive_documents`, `cases`, `legislation` → also write to `corpus`; defer `body` (full text) and `bill_actions`
- [ ] Phase 3: Seed `people` + `person_roles` for presidents and SCOTUS justices; link `executive_documents.president_id` and `case_opinions.author_id`
- [ ] Phase 4: Update `applyTag`/`removeTag` resolvers to write to `corpus_tags` via `corpus_id`; update `tagsForEntity` and `tagPage`; delete `entity_tags` once migrated
- [ ] Phase 5: Add GraphQL surface — `person(id)`, `corpus(branch, dateRange, tag)`, `search(query)` (Postgres `tsvector`)
- [ ] Phase 6: Frontend — `/people/:id` profile pages (roles + associated documents per person)
- [ ] Phase 7: Frontend — timeline view, updated tag pages, cross-branch search

## Decisions / Notes
- `legislation.status` only stored when terminal (`enacted` or `failed`); otherwise fetched live from Congress.gov
- `bill_actions` deferred — action history continues fetching live from Congress.gov for now
- `body` (full text) columns deferred — populate lazily in a later phase
- Legislators deferred from Phase 3 (presidents + justices first)
- Relationships table (document-to-document citations) also deferred
