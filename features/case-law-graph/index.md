# Case Law Graph

## Status
In Progress

## Goal
A directed acyclic graph of legal cases where each case is a node and citations are directed edges.
Powers a visual state diagram showing how cases relate to and revise each other over time.
Currently seeded with the Roe → Casey → Dobbs lineage (+ Griswold). Frontend at `/case-graph`
with Simplified/Full toggle and `?caseId=` param support.

## Done
- [x] Schema: `cases` and `case_relationships` tables in Supabase
- [x] Add `is_direct BOOLEAN` column to `case_relationships`
- [x] Add `cluster_id INTEGER` column to `cases`
- [x] Seed 4 cases: Griswold (1965), Roe (1973), Casey (1992), Dobbs (2022)
- [x] Seed 5 edges (all `treatment = NULL`, `is_direct = true`, sourced from CourtListener)
- [x] GraphQL: `caseGraph(caseId)` query returning nodes + edges with `isDirect`
- [x] GraphQL: `caseInGraph(clusterId)` — returns DB id if case is in graph, else null
- [x] Frontend: `/case-graph` page with Dagre + D3 layout
- [x] Frontend: Simplified/Full toggle (filter by `is_direct`)
- [x] Frontend: `?caseId=<DB id>` param; defaults to Roe (id: 263)
- [x] "View in Case Graph →" button on CaseDetail pages for in-graph cases

## Todo
- [ ] CONAN integration for overruled edges (Congress.gov API, key in `.env` as `CONGRESS_API_KEY`)
- [ ] Broader seeding beyond the Roe lineage
- [ ] Add treatment colors/legend for `overruled` edge type in DAGGraph.jsx
- [ ] Verify edge color for `cited_with_approval` (currently maps to gray — should be distinct)

## Decisions / Notes
- Treatment policy: never infer treatment. Valid sources only: SCDB (disposition-based), CONAN (overruled), Shepard's (future/paid)
- Transitive edges are never deleted from DB — visibility controlled at query/render layer via `is_direct`
- Some transitive edges carry independent legal meaning (e.g. Dobbs → Griswold is not implied by Dobbs → Roe → Griswold)
- 2-pass query in resolver to capture sibling edges
- `relationship_type` = structural kind (`citation`, `implicit_overruling`, `superseded_by_statute`)
- `treatment` = what the citing case said (NULL = unknown/not yet sourced)

## Seeded Cases

| DB id | Case | Cluster ID | Opinion ID |
|-------|------|------------|------------|
| 263 | Roe v. Wade (1973) | 108713 | 9425157 |
| 264 | Planned Parenthood v. Casey (1992) | 112786 | 112786 |
| 265 | Dobbs v. Jackson (2022) | 6481357 | 6353492 |
| 267 | Griswold v. Connecticut (1965) | 107082 | 9423065 |
