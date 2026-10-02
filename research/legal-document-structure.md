# How legal documents are structured

Notes on the conventions behind sectioning, numbering and formal clauses in U.S. legal
documents, and what they mean for parsing and storing documents in govgraph.

> **Status:** written from general knowledge on 2026-10-02, not from the primary sources.
> Anything in [To verify](#to-verify) should be checked before code depends on it.
> The observations about Executive Order 13636 are the exception: those were checked
> against the saved source files in `server/references/`.

## Contents

1. [Why legal documents are sectioned](#why-legal-documents-are-sectioned)
2. [Which documents are sectioned, and how strictly](#which-documents-are-sectioned-and-how-strictly)
3. [Nesting order by document type](#nesting-order-by-document-type)
4. [Formal clauses](#formal-clauses)
5. [Where the rules come from](#where-the-rules-come-from)
6. [Machine-readable standards](#machine-readable-standards)
7. [Akoma Ntoso for executive orders](#akoma-ntoso-for-executive-orders)
8. [What we observed in Executive Order 13636](#what-we-observed-in-executive-order-13636)
9. [Implications for govgraph](#implications-for-govgraph)
10. [To verify](#to-verify)

## Why legal documents are sectioned

- **Precise cross-reference.** Every unit has an address, so text can say "section 4(a) of
  this order" and mean exactly one passage.
- **Surgical amendment.** Later documents change earlier ones by address ("strike
  subsection (b) and insert…"). That only works if units are stable and numbered.
- **One rule per unit.** Splitting obligations into separately lettered items makes it
  clear who must do what, and by when.
- **Predictable boilerplate.** Standard openings, a Definitions section and a closing
  General Provisions section recur across modern executive orders.

The general pattern: the more a document is meant to bind people or be answered point by
point, the more strictly it is numbered. Documents that argue or explain use headings but
leave the internal structure to the author.

## Which documents are sectioned, and how strictly

### Rigid (rules that get cited and amended)

| Document | Units |
|---|---|
| Constitutions | articles, sections, clauses |
| Statutes and codes | titles, chapters, sections, subsections |
| Regulations (CFR) | parts, sections, lettered and numbered paragraphs |
| Executive orders | numbered sections with lettered sub-items |
| Treaties | preamble, then numbered articles |
| Contracts, leases, terms of service | articles and numbered clauses (1, 1.1, 1.1(a)), definitions up front |
| Corporate bylaws, articles of incorporation | articles and sections |
| Patents | fixed parts (abstract, description, claims); claims individually numbered |
| Pleadings (complaints, answers) | numbered paragraphs, so each can be admitted or denied by number |

### Loose (reasoning and narrative)

| Document | Units |
|---|---|
| Court opinions | parts (I, II, III-A) at the judge's discretion; cited by page, not by section |
| OLC opinions, agency memos | headings and parts, similar to opinions |
| Briefs | a required set of parts (statement of facts, argument, conclusion); prose inside |
| Committee reports, CRS and GAO reports | ordinary report headings |
| Court orders and judgments | often short, with numbered decretal paragraphs |

### Barely sectioned

- Proclamations: "Whereas" recitals followed by a "Now, therefore" declaration.
- Signing statements, speeches, the Congressional Record: prose or transcript.
- Older documents of any type tend to be less structured than modern ones.

## Nesting order by document type

The same marker means different depths in different document types. `(i)` is level 2 in an
executive order and level 4 in a statute.

| Document | Hierarchy |
|---|---|
| Executive orders | Section 1 → (a) → (i) → (A) → (1) |
| Statutes | section → (a) → (1) → (A) → (i) → (I) |
| Regulations (CFR) | section → (a) → (1) → (i) → (A) |

Statute levels have names in the congressional drafting manuals: subsection (a),
paragraph (1), subparagraph (A), clause (i), subclause (I).

A known ambiguity: `(i)` can be the ninth letter (after `(h)`) or the first roman numeral.
A parser has to decide from context.

## Formal clauses

Most rule-making documents open with a fixed formula that gives the text its legal effect.
It is boilerplate, and worth storing separately from the substance.

| Document | Clause | Wording |
|---|---|---|
| Bill | enacting clause | "Be it enacted by the Senate and House of Representatives of the United States of America in Congress assembled," |
| Joint resolution | resolving clause | "Resolved by the Senate and House of Representatives of the United States of America in Congress assembled," |
| Concurrent resolution (House) | resolving clause | "Resolved by the House of Representatives (the Senate concurring)," |
| Executive order | statement of authority | "By the authority vested in me as President by the Constitution and the laws of the United States of America, it is hereby ordered as follows:" |

- The bill and joint-resolution wordings are prescribed by statute (1 U.S.C. 101 and 102).
  The concurrent-resolution wording comes from congressional practice.
- In printed bills and resolutions the clause is set in *italics*. That is Government
  Publishing Office typesetting convention, not a legal requirement; it separates the
  formula from the content that follows "That…".
- Printed bills carry line numbers down the left margin so amendments can refer to exact
  places ("on page 1, line 3, strike…").

## Where the rules come from

There is no single rulebook for all legal documents. The Bluebook is the closest analogue
to academic citation rules, but it governs how to cite, not how to structure. Structure is
governed per document type, with varying force.

### Binding rules

- **Executive orders:** Executive Order 11030 (1962), codified at 1 CFR Part 19. Requires
  a title, a statement of authority and numbered sections. Process: an agency drafts, the
  Office of Management and Budget reviews, the Attorney General (in practice the Office of
  Legal Counsel) reviews for form and legality, the President signs, and the Office of the
  Federal Register numbers and publishes.
- **Regulations and Federal Register documents:** the Federal Register's Document Drafting
  Handbook and its governing regulations in 1 CFR.
- **Court filings:** Federal Rule of Civil Procedure 10 (numbered paragraphs in pleadings);
  Federal Rule of Appellate Procedure 28 (required parts of a brief); local court rules.
- **Patents:** Patent Office regulations fix the order of the parts of an application.

### Official manuals (followed in practice, not law)

- **Federal statutes:** the House Legislative Counsel's *Manual on Drafting Style* and the
  Senate's *Legislative Drafting Manual*. Most states have their own drafting manual.
- **Court opinions:** internal court style manuals; some states publish theirs (for
  example the *California Style Manual*).
- **Plain language:** the Plain Writing Act of 2010 and the Federal Plain Language
  Guidelines.

### Conventions only

- **Contracts:** no rules. Practice follows guides such as Kenneth Adams's *A Manual of
  Style for Contract Drafting* and Bryan Garner's *The Redbook*.
- **Wills, memos, letters:** firm templates and habit.

### Citation (separate from structure)

- *The Bluebook*, the *ALWD Guide to Legal Citation*, and the free *Indigo Book*.

## Machine-readable standards

- **USLM (United States Legislative Markup):** the XML schema used for the U.S. Code and,
  increasingly, bills and statutes. Defines the hierarchy as named elements: section,
  subsection, paragraph, subparagraph, clause.
- **Akoma Ntoso (OASIS LegalDocML):** an international XML standard for legislative and
  judicial documents, used by several parliaments.
- **Federal Register XML:** the Federal Register's own schema, available in govinfo bulk
  data. Executive orders are tagged `<EXECORD>` (seen in the 2009-01-26 issue).

## Akoma Ntoso for executive orders

Executive orders fit the standard. Proposed mapping:

| Part of the order | Akoma Ntoso element |
|---|---|
| The document itself | `<act>` (a rule issued by an authority) |
| Number, title, dates, president, source | `<meta>` identification block |
| "Executive Order 13636", the title | `<preface>` with `<docNumber>` and `<docTitle>` |
| "By the authority vested in me…" | `<preamble>` |
| Sections and sub-items | `<section>` → `<subsection>` → `<paragraph>`, each with `<num>` and `<heading>` |
| Citations to other orders and statutes | inline `<ref href="…">` |
| Defined terms | `<def>` |
| Signature block | `<conclusions>` |

It also provides a naming scheme for identifiers, along the lines of
`/akn/us/act/eo/2013/13636`, which would suit stable node IDs in the graph.

### Costs

- It is XML; the app is JavaScript, JSON and Postgres, so both ends would need conversion.
- Nobody (as far as we know) publishes U.S. executive orders in Akoma Ntoso, so we would
  be producing it ourselves.
- The standard is large; we would use a small corner.
- Deadlines ("Within 120 days…") are not a native concept and would need a generic
  annotation.

### Recommendation

Do not store Akoma Ntoso XML as the primary format. Keep JSON in Postgres and borrow the
vocabulary: its element names for the hierarchy, its `ref` idea for citations, and its
identifier scheme for node IDs. That keeps the stack simple and leaves a path to exporting
real Akoma Ntoso later.

## What we observed in Executive Order 13636

"Improving Critical Infrastructure Cybersecurity", signed 2013-02-12, 78 FR 11739.
Source files are in `server/references/`.

| File | What it is |
|---|---|
| `eo-13636-federal-register.html` | raw Federal Register HTML (document 2013-03915) |
| `eo-13636-govinfo.html` | raw govinfo HTML (package DCPD-201300091) |
| `eo-13636-readable.html` | restyled standalone page built from the Federal Register HTML |
| `eo-13636.json` | structured form: sections, items, spans, citations |

- **Federal Register HTML is well structured.** Sections start with
  `<strong>Sec. N</strong>. <em>Title.</em>`; sub-items begin with `(a)`, `(b)`;
  paragraphs carry ids and Federal Register page numbers; citations are links tagged by
  type (`eo`, `usc`, `publ`).
- **govinfo HTML is not.** It is converted from PDF: a flat run of paragraphs with font
  tags and no headings.
- **Structure found:** 12 sections, 43 items, one nesting level only.
- **Citations found (from links only):** 5 executive orders, 5 U.S. Code sections,
  1 public law. Two Presidential Policy Directives are named in the text but not linked,
  so link-based extraction misses them.
- **Older orders differ.** A 1994 Clinton order (12896) has no working structured HTML
  from the Federal Register, only plain text.

## Implications for govgraph

- **Parse by document type.** Rule-making documents get a section-and-marker parser with a
  nesting order per type. Opinions and reports get a headings-and-paragraphs treatment
  where page or paragraph numbers are the citable unit.
- **Store structure, not rendered HTML.** Keep the raw source and a parsed JSON form;
  generate HTML at display time.
- **Store unit addresses.** "4(a)" and Federal Register page numbers allow pinpoint
  citations and edges that point at a specific provision.
- **Store formal clauses separately** (enacting clause, resolving clause, statement of
  authority) so they are not mistaken for content.
- **Model the JSON on USLM / Akoma Ntoso names** so executive orders, statutes and the
  U.S. Code share one shape.
- **Links are a first source of edges, not the only one.** A text pass is needed for
  citations the publisher did not link.

## To verify

- [ ] Executive order nesting order (a) → (i) → (A) → (1), against 1 CFR Part 19 and real
      multi-level orders.
- [ ] Statute and CFR nesting orders, against the House drafting manual and the Document
      Drafting Handbook.
- [ ] Exact requirements of Executive Order 11030 / 1 CFR Part 19.
- [ ] 1 U.S.C. 101 and 102 wording for enacting and resolving clauses.
- [ ] Akoma Ntoso element names in the mapping table, against the current schema.
- [ ] USLM element names, and whether bill XML tags the enacting or resolving clause as
      its own element.
- [ ] Whether any publisher provides U.S. executive orders in Akoma Ntoso or USLM.
- [ ] How far back Federal Register structured HTML goes (works for 2009+; fails for a
      1994 order).
