# Case Law Graph — Summary

## What It Is

A directed acyclic graph (DAG) of legal cases, where each case is a node and citations are directed edges. The goal is a queryable structure that powers a state diagram showing how cases relate to and revise each other over time.

## Current State (as of 2026-05-21)

- 4 seeded nodes: Griswold (1965), Roe (1973), Casey (1992), Dobbs (2022)
- 5 seeded edges — all `treatment = NULL`, `is_direct = true`, sourced from CourtListener
- Frontend at `/case-graph` — Dagre + D3, Simplified/Full toggle live
- "View in Case Graph →" button on `CaseDetail` pages for cases in the graph
- `/case-graph?caseId=<DB id>` param supported; defaults to Roe (263)

## Seeded Cases

| DB id | Case | Cluster ID | Opinion ID |
|-------|------|-----------|------------|
| 263 | Roe v. Wade (1973) | 108713 | 9425157 |
| 264 | Planned Parenthood v. Casey (1992) | 112786 | 112786 |
| 265 | Dobbs v. Jackson (2022) | 6481357 | 6353492 |
| 267 | Griswold v. Connecticut (1965) | 107082 | 9423065 |

## Seeded Edges

```
Roe (1973)   ──cites──► Griswold (1965)
Casey (1992) ──cites──► Roe (1973)
Dobbs (2022) ──cites──► Roe (1973)
Dobbs (2022) ──cites──► Casey (1992)
Dobbs (2022) ──cites──► Griswold (1965)
```

All edges confirmed via CourtListener `opinions-cited` API. Treatment = NULL on all (CourtListener provides no treatment field).

**Treatment policy:** Never infer treatment. Valid sources only: SCDB (disposition-based), CONAN (overruled, planned), Shepard's (future/paid).

## Database Schema

Tables: `data_sources`, `cases`, `scdb_cases`, `case_relationships`

Key columns added 2026-05-21:
- `cases.cluster_id INTEGER` — CourtListener cluster ID
- `case_relationships.is_direct BOOLEAN DEFAULT true` — direct vs transitive edge

Key fields on `case_relationships`:
- `citing_case_id → cited_case_id` — direction means "A cited B"
- `relationship_type` — structural kind (`citation`, `implicit_overruling`, `superseded_by_statute`)
- `treatment` — what the citing case said (NULL = unknown/not yet sourced)
- `source` + `source_id` — provenance back to `data_sources`
- `notes TEXT` — human annotations only, not structured data

## GraphQL

- `caseGraph(caseId: Int!)` — returns nodes + edges with `isDirect`; 2-pass query to capture sibling edges
- `caseInGraph(clusterId: Int!): Int` — returns DB case id if that CourtListener cluster is in the graph, else null
- `CaseGraphEdge` fields: `source`, `target`, `treatment`, `isDirect`

## Seed Scripts

- `server/seed/cases.js` — seeds from CourtListener
- `server/seed/scdb.js` — seeds from SCDB CSV (`server/seed/data/scdb.csv`, 2025_01 release, 9341 cases)

## Data Sources

| Source | What it provides |
|--------|-----------------|
| CourtListener (`opinions-cited` endpoint) | Structural edges, treatment = NULL. Params: `citing_opinion` / `cited_opinion` |
| SCDB | Disposition → treatment (`affirmed`, `reversed`, `vacated`, `remanded`). SCOTUS only. |
| CONAN (planned) | Overruled edges only, SCOTUS only. Via Congress.gov API (key in `.env` as `CONGRESS_API_KEY`) |
| Shepard's (future) | Full treatment taxonomy — paid LexisNexis enterprise API |

## Graph Display

**Simplified view** (default) — shows only `is_direct = true` edges. Toggle to **Full view** for all edges.

Why: Some transitive edges carry independent legal meaning (e.g. Dobbs → Griswold is not implied by Dobbs → Roe → Griswold). Never delete edges from DB; control visibility at the query/render layer.

## What's Next

- CONAN integration for overruled edges
- Broader seeding beyond the Roe lineage
