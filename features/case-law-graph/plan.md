# Plan: Roe → Dobbs Case Graph

## Goal
Replace the Biden v. Nebraska seed with a 3-node graph showing the Roe → Casey → Dobbs lineage. No treatment inference — edges sourced directly from CourtListener only.

## Target Graph

```
Casey (1992) ──cites──► Roe (1973)
Dobbs (2022) ──cites──► Casey (1992)
Dobbs (2022) ──cites──► Roe (1973)
```

All edges confirmed via CourtListener `opinions-cited` API. No treatment (`treatment = NULL`).

Nodes: 3 (Roe, Casey, Dobbs)
Edges: 3

## Confirmed CourtListener IDs

| Case | Cluster ID | Opinion ID (use this) |
|------|-----------|----------------------|
| Roe v. Wade, 410 U.S. 113 (1973) | 108713 | `9425157` |
| Planned Parenthood v. Casey, 505 U.S. 833 (1992) | 112786 | `112786` (majority) |
| Dobbs v. Jackson, 597 U.S. 215 (2022) | 6481357 | `6353492` |

---

## Step 1 — Seed the Cases

Add a seed script (or extend `server/seed/cases.js`) to insert the 3 cases into the `cases` table:

```js
// fields: name, court, date_decided, source ('courtlistener'), source_id (opinion ID), url
```

Clear any existing Biden v. Nebraska rows first, or add these alongside.

---

## Step 3 — Seed the Edges

Insert 3 rows into `case_relationships`:

| citing opinion ID | cited opinion ID | treatment | source |
|------------------|-----------------|-----------|--------|
| `112786` (Casey) | `9425157` (Roe) | NULL | `courtlistener` |
| `6353492` (Dobbs) | `9432680` (Casey) | NULL | `courtlistener` |
| `6353492` (Dobbs) | `9425157` (Roe) | NULL | `courtlistener` |

Set `is_direct = true` on all three (once that column exists — see Step 4).

---

## Step 4 — Add `is_direct` Column to Schema

```sql
ALTER TABLE case_relationships ADD COLUMN is_direct BOOLEAN DEFAULT true;
```

Default `true` for all manually seeded rows. CourtListener-scraped transitive edges get `false` or NULL until verified.

Update the GraphQL schema (`schema.js`) to expose `isDirect` on `CaseGraphEdge`.

---

## Step 5 — Update the Resolver

The existing `caseGraph` resolver queries by a single seed `caseId`. Options:
- **Option A:** Keep `caseGraph(caseId)` but pass Roe's DB id as the new `SEED_CASE_ID` — the resolver already fetches all edges where the seed appears, which will pull in Casey and Dobbs transitively.
- **Option B:** Add a `namedGraph(name: String!)` query that returns a hardcoded subgraph by name (e.g. `"roe-dobbs"`).

**Recommendation: Option A** — simplest, no schema change needed. Just update `SEED_CASE_ID` in the frontend once Roe's DB id is known.

Update the resolver to also return `isDirect` on edges.

---

## Step 6 — Update the Frontend

In `client/src/pages/CaseGraph.jsx`:
- Update `SEED_CASE_ID` to Roe's DB id
- Update the page title/subtitle to reflect the Roe → Dobbs graph
- Add a toggle for **Simplified / Full** view (filter edges by `isDirect`)

In `DAGGraph.jsx`:
- Verify edge color for `cited_with_approval` (currently maps to "Unknown" gray — should be green or a distinct color)
- Add `overruled` as an explicit legend entry if not already present

---

## Step 7 — Verify

- Graph renders 3 nodes, 3 edges
- Edge colors match treatments
- Clicking a node opens the CourtListener source URL
- Simplified view (default) shows all 3 edges (all are direct)

---

## Open Questions

- Does the existing `cases` table have Roe/Casey/Dobbs already, or does everything need to be seeded fresh?
- Should Biden v. Nebraska rows be deleted or kept?
- Is `is_direct` added to the DB schema now, or deferred until transitive edges are introduced?
