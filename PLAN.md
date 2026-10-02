# GovLens — Federal Government Primary Source Document Corpus

## What It Is
A comprehensive, structured corpus of U.S. federal government primary source documents — raw official records from all three branches — surfaced as a web app and knowledge base. The premise: data published by the federal government belongs to everyone, but it's buried in dense archives. This app surfaces it cleanly.

## Design Principles
1. **Raw data over context** — display existing public information accurately and accessibly, no editorializing or summaries
2. **Public data should be easy to access** — no paywalls, no accounts
3. **Nonpartisan presentation** — equal coverage across administrations

## Current State
- **Presidents**: Obama and Biden — Executive Orders and Presidential Memoranda via Federal Register API
- **Supreme Court**: Natural Courts (Roberts I–VIII) — majority opinions via CourtListener API (free token required)
- Features: search, year filter, grid/timeline views, full-text reading, pagination
- Stack: React + Vite + Tailwind (frontend), Express + Apollo GraphQL (backend)

---

## Full Scope

### Legislative Branch
- **Senate & House output**: bills, resolutions, hearing transcripts, committee reports and prints, Congressional Record, public laws, appropriations, member letters, congressional notifications
- **Key committees**: Intelligence, Armed Services, Judiciary, Foreign Relations, Appropriations (both chambers)
- **Joint bodies**: JEC, JCT
- **Support agencies**: CBO, GAO, CRS, congressional IGs

### Executive Branch
- **Presidential documents**: executive orders, memoranda, proclamations, determinations, signing statements, veto messages, NSDs/PPDs/NSMs, PDBs, press briefings, budgets
- **OMB**: A-circulars, M-memos, SAPs
- **OLC**: legal opinions
- **15 cabinet departments**: rules, NPRMs, guidance, OGC memos, FOIA releases, IG reports, CBJs, strategic plans
- **Intelligence community**: ODNI, CIA, NSA, FBI, DIA, NSC, PCLOB
- **Independent regulatory agencies**: FEC, FCC, SEC, Federal Reserve, FTC, CFPB, NLRB, FERC

### Judicial Branch
- **Supreme Court**: opinions, orders, oral argument transcripts, cert materials
- **13 circuit courts**
- **District courts**: opinions, filings, consent decrees
- **Specialized courts**: FISC, Court of International Trade, Court of Federal Claims, Tax Court, Bankruptcy Courts

### Cross-Cutting Reference Layers
- Federal Register (daily official journal)
- CFR (codified regulations via eCFR)
- U.S. Code (codified statute)
- Treaties and executive agreements

---

## Primary Data Sources (APIs)

| API | Coverage |
|-----|----------|
| GovInfo API (`api.govinfo.gov`) | Broadest official federal document coverage |
| Congress.gov API (`api.congress.gov/v3`) | All legislative material |
| Federal Register API (`federalregister.gov/api/v1`) | Executive actions, rulemaking |
| CourtListener API (`courtlistener.com/api/rest/v4`) | Judicial opinions and filings |
| eCFR API | Live regulatory text |
| Regulations.gov | Rulemaking dockets |
| FOIA.gov / MuckRock | FOIA releases |
| oversight.gov | IG reports across all agencies |
| USASpending | Spending data |
| FEC, FCC, SEC/EDGAR, Federal Reserve, FERC APIs | Agency-specific data |
| PACER / CourtListener RECAP mirror | Federal court filings |

## Known Gaps (No API — Requires Scraping or Manual Collection)
- OLC opinions
- OGC memos
- NSC directives
- White House press briefings
- CRS reports
- Most FOIA reading rooms
- Classified or partially-declassified intelligence material
- **Primary sources for declassified intel**: National Security Archive (`nsarchive.gwu.edu`) and agency FOIA reading rooms

---

## Roadmap

### Phase 1 — Deepen Presidential Coverage *(now)*
- Add remaining modern presidents (Trump I, Bush, Clinton, etc.)
- Add more document types: Proclamations, Notices, Rules
- Add presidential bio/context on the president profile page

### Phase 2 — Cross-President Analysis
- Compare document volume across presidents by year/type
- Side-by-side topic comparison
- "Most active" stats (busiest signing year, most common topics)

### Phase 3 — Legislative Branch
- Congress: bills, votes, roll calls via Congress.gov API
- Committee documents, Congressional Record
- CBO/GAO reports via GovInfo API

### Phase 4 — Judicial Branch Expansion
- Extend Supreme Court back to earlier courts (Warren, Burger, Rehnquist)
- Add concurrences and dissents
- Circuit court opinions via CourtListener

### Phase 5 — Executive Agency Expansion
- Cabinet department rules and NPRMs via Federal Register / GovInfo
- IG reports via oversight.gov
- FOIA releases via FOIA.gov / agency reading rooms (scraping where needed)

### Phase 6 — Accessibility & Discovery
- Topic-based browsing (e.g., "climate," "immigration")
- Cross-branch search and linking
- Share links, embeds, citation formatting
