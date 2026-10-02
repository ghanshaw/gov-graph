# GovLens Schema Migration Plan

## Phase 1 — Supabase: Run the new schema

- Run `schema.sql` against Supabase to create all new tables
- Migrate existing `tags` + `entity_tags` data into new `tags` + `corpus_tags` tables
- Seed `congresses` table from `congresses.js`
- Seed `courts` table from `naturalCourts.js`
- Verify existing case graph data (`documents`, `document_relationships`) is still intact

## Phase 2 — Ingest: Populate entity tables

For each branch, write a one-time ingest script that fetches from the source API and inserts into both the entity table and `corpus`:

- `executive_documents` — pull from Federal Register API (EOs, memoranda, proclamations)
- `cases` — pull from CourtListener API
- `legislation` — pull from Congress.gov API; store `status` only when terminal (`enacted` or `failed`), otherwise leave null and fetch live from API
- Each insert also writes a corresponding row to `corpus`

Defer `body` (full text) — leave nullable, populate lazily later.
Defer `bill_actions` — action history and legislative progress tracker continue fetching live from Congress.gov; populate `bill_actions` in a later phase.

## Phase 3 — People: Seed people + person_roles

- Seed `people` + `person_roles` for presidents (sourced from static data or Wikipedia)
- Seed `people` + `person_roles` for SCOTUS justices (link to `courts`)
- Link `executive_documents.president_id` and `case_opinions.author_id` to `people`
- Defer legislators until legislative branch is deeper

## Phase 4 — Backend: Update resolvers

- Update `applyTag` / `removeTag` to write to `corpus_tags` (via `corpus_id`) instead of `entity_tags`
- Update `tagsForEntity` and `tagPage` to query `corpus_tags`
- Add resolvers for `corpus` queries (cross-branch search, timeline)
- Delete `entity_tags` table once resolvers are migrated

## Phase 5 — Backend: New GraphQL surface

- `person(id)` — profile page query, returns roles + associated documents
- `corpus(branch, dateRange, tag)` — cross-branch filtered list
- `search(query)` — full-text search across `corpus.title` (Postgres `tsvector`)

## Phase 6 — Frontend: People profile pages

- Route: `/people/:id`
- Shows all roles across time, linked documents per role
- Justices: link to opinions; Presidents: link to EOs/memoranda; Legislators: link to legislation

## Phase 7 — Frontend: Cross-branch features

- Timeline view: `corpus` filtered by date, rendered across branches
- Tag pages: already exist, update to use `corpus_tags`
- Cross-branch search page

---

## Deferred / out of scope for now

- Full text ingestion (body columns)
- `bill_actions` ingestion (Congress.gov has this data)
- `legislative_documents` (committee reports, CBO scores)
- Controlled tag vocabulary (`tags.parent_id` hierarchy)
- Relationships table (document-to-document citations)
