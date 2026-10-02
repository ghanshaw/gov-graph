# Tagging System — Implementation Notes

Implemented 2026-05-21.

## What was built

A curator-applied tagging system allowing entities across all three branches to be labeled with a shared tag (e.g. "birthright") and viewed together on a unified page.

## Database (Supabase)

Two new tables in the existing Supabase instance:

```sql
tags (id, word UNIQUE, source DEFAULT 'manual', created_at)
entity_tags (id, tag_id → tags, entity_type, entity_id, created_at, UNIQUE(tag_id, entity_type, entity_id))
```

**Entity ID formats:**
- `executive_order` → EO number string, e.g. `"14160"`
- `scotus_case` → CourtListener cluster ID, e.g. `"9118676"`
- `legislation` → `"119-HRES-27"` (matches `mapBill` format: `${congress}-${type}-${number}`)

## Backend (server/)

**schema.js** — added `Tag`, `TagSummary`, `TagPageResult`, `TaggedExecutiveOrder`, `TaggedScotusCase`, `TaggedLegislation` types; new queries `allTags`, `tagPage`, `tagsForEntity`; new `Mutation` type with `applyTag` and `removeTag`.

**resolvers.js** — added:
- `tagsForEntity` — fetches tags for a single entity from DB
- `allTags` — fetches all tags with entity counts
- `tagPage` — queries DB for entity IDs by tag, then fans out to Federal Register / CourtListener / Congress.gov APIs in parallel via `Promise.allSettled`
- `applyTag` / `removeTag` mutations — upsert/delete into Supabase
- `mapOrder` updated to include `president` field (extracted from `doc.president.identifier` — Federal Register returns an object, not a string)

**Key bug fixed:** Federal Register `president` field is `{ identifier: "donald-trump", name: "Donald Trump" }`, not a plain string. `mapOrder` extracts `.identifier`.

## Frontend (client/src/)

**New files:**
- `components/TagPanel.jsx` — tag chip display + add/remove UI; appears at bottom of each detail page
- `pages/TagsIndex.jsx` — `/tags` route, lists all tags with entity counts
- `pages/TagPage.jsx` — `/tags/:word` route, shows all tagged entities grouped by branch (Executive Orders, Supreme Court, Legislation)

**Modified files:**
- `queries.js` — added `GET_TAGS_FOR_ENTITY`, `GET_ALL_TAGS`, `GET_TAG_PAGE`, `APPLY_TAG`, `REMOVE_TAG`
- `App.jsx` — added `/tags` and `/tags/:word` routes
- `pages/Detail.jsx` — added `<TagPanel entityType="executive_order" entityId={order.number} />`
- `pages/CaseDetail.jsx` — added `<TagPanel entityType="scotus_case" entityId={scotusCase.id} />`
- `pages/BillDetail.jsx` — added `<TagPanel entityType="legislation" entityId={bill.id} />`
- `components/Header.jsx` — added "Tags" nav link; updated `isActive` logic to exclude `/tags` from Presidents active state

**Apollo import note:** All hooks (`useQuery`, `useMutation`) must be imported from `@apollo/client/react`, not `@apollo/client` — Vite's dep bundling does not re-export them from the root package.

## EO linking on tag page

EO internal route is `/:slug/:docType/eo/:number`. The president slug is reconstructed at render time from the `president` field on the fetched EO (not stored in the DB). If `president` is null (e.g. cache miss edge case), the tag page falls back to the external Federal Register URL.
