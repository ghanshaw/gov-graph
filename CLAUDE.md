# govgraph

## What This Project Is

This is a data collection and pipeline component of **govgraph**, a larger system for
collecting, storing, and visualizing U.S. federal government documents as a directed graph.

The `obama-eo` folder is the starting dataset: Obama-era executive orders, used to build
out the initial document corpus and validate the schema + pipeline before scaling.

The broader govgraph vision: every significant federal document (EOs, legislation, court
cases, regulations, OLC opinions, etc.) as nodes in a graph, connected by citations,
cross-references, and legal relationships.

## Stack

- **Runtime:** Node.js / JavaScript
- **Database:** Supabase (hosted Postgres)
- **Visualization:** Cytoscape.js with Dagre or ELK layout
- **Data sources:** Federal Register, CourtListener API, manual collection

## Database

Hosted on Supabase. Auth is via GitHub SSO (no password login).
Connection string is in Supabase dashboard → Settings → Database.

### Core schema pattern

Documents are **nodes**. Relationships between documents are **edges** stored in a
join table. Direction is encoded by column name (`citing_id → cited_id`).

```sql
-- Documents table (generalized beyond cases)
CREATE TABLE documents (
  id              SERIAL PRIMARY KEY,
  title           TEXT NOT NULL,
  doc_type        TEXT,          -- 'executive_order', 'statute', 'court_case', etc.
  date_issued     DATE,
  source_id       TEXT,          -- external ID (e.g. EO number, CourtListener ID)
  source          TEXT,          -- 'federal_register', 'courtlistener', 'manual'
  body            TEXT           -- raw text if collected
);

-- Relationships (edges in the graph)
CREATE TABLE document_relationships (
  id              SERIAL PRIMARY KEY,
  citing_doc_id   INT NOT NULL REFERENCES documents(id),
  cited_doc_id    INT NOT NULL REFERENCES documents(id),
  relationship    TEXT,          -- 'cites', 'revokes', 'amends', 'supersedes', NULL=unknown
  source          TEXT,
  UNIQUE (citing_doc_id, cited_doc_id)
);
```

## Graph Visualization Conventions

Layout follows the **Sugiyama framework** (hierarchical graph drawing).

- **Straight lines** — adjacent-level edges (one level apart in hierarchy)
- **Curved dashed lines** — skip-level edges (citing jumps over intermediate levels)
- **Edge bundling** — parallel edges on similar paths drawn as a bundle (at scale)

Key terms: polyline routing, long edge routing, transitive edges, skip edges.

Layout algorithms: **Dagre** (simpler, good default) or **ELK** (more powerful).
Both available via Cytoscape.js.

## Document Taxonomy

Federal document types to eventually collect (priority order):

**Executive Branch**
- Executive Orders (starting point — this project)
- Presidential Memoranda
- Presidential Proclamations
- Presidential Determinations
- Signing Statements
- National Security Presidential Directives / PPDs / NSMs
- OMB Circulars and M-series memos
- OLC opinions

**Legislative Branch**
- Public Laws / Statutes
- Congressional Record
- Committee reports and hearing transcripts
- CRS reports, GAO reports
- CBO cost estimates

**Judicial Branch**
- SCOTUS opinions (majority, concurring, dissenting)
- Circuit and District Court opinions
- FISA Court declassified orders

**Regulatory**
- Final rules (Federal Register)
- Proposed rules (NPRMs)
- Agency guidance documents, Dear Colleague Letters
- CFR (Code of Federal Regulations)

## Open Questions / To Revisit

- Whether to show transitive edges or only minimal spanning structure in the viz
- How edge bundling behaves at depth 2+ with tens of thousands of nodes
- How Dagre/ELK handle automatic straight vs curved routing decisions
- Cytoscape.js implementation directly against Supabase
- State vs federal scope (currently federal-only)

## Key Decisions Already Made

- Citation = the edge. No citation, no formal relationship. Implicit overruling etc.
  goes in a `notes` column, not dedicated schema.
- `relationship = NULL` means the edge exists but type is unknown (acceptable state).
- `source` column on relationship rows tracks data quality (authoritative vs structural).
- UNIQUE constraint on (citing_id, cited_id) prevents duplicate edges on re-import.

## Feature Tracking

Active features are tracked in `features/`. Each feature has its own subfolder with an `index.md`.

**Before starting work on a feature:** read the relevant `features/<name>/index.md` (or create one if it doesn't exist).

**After completing work:** update `## Done`, `## Todo`, and `## Status` in the feature file. Run `npm run dashboard` from the project root to regenerate `features/dashboard.html`.

Feature folder names should be kebab-case (e.g. `graph-layout`, `data-pipeline`).