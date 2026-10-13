# Supreme Court Text

## Status
In Progress

## Goal
The text of Supreme Court decisions in the same structured form as executive orders and bills
(sections → items → spans, plus citations), parsed once, stored, and shown on the case page:
syllabus, each opinion with its parts and footnotes, and what each opinion cites.

## Done
- [x] Sources checked (2026-10-02). govinfo's `SCD` bulk collection is one archived text file,
  1937–1975 only (7,407 decisions, volumes 300–422, all capitals, footnotes as `/1/`, no
  structure, "GPO cannot attest to its authenticity or completeness"); nothing after 1975.
  CourtListener has only a plain-text extraction for new decisions (no HTML, no citations).
  The Court's own slip opinion PDF is the one complete source for a current decision
- [x] `server/lib/pdf-lines.js`: a PDF → its printed lines with position, type size, and which
  runs are italic, bold or raised (new dependency: `pdfjs-dist` in `server/`)
- [x] `server/lib/parse-slip-opinion.js`: lines → structure. Writings are told apart by the
  running head; paragraphs by indentation; parts (II, A, 1, a) by centred headings; footnotes
  by the rule at the foot of the page; case names and emphasis by italics. Citations by
  volume and page are linked (cases → CourtListener, U.S.C. and Stat. → govinfo, Fed. Reg. →
  federalregister.gov) and counted per writing. Test: `node --test server/lib/parse-slip-opinion.test.js`
- [x] Example: **Trump v. Slaughter**, No. 25-332, decided 2026-06-29 (CourtListener cluster
  10881681; 108 pages). Syllabus (27 paragraphs), opinion of the Court (Roberts), concurrence
  (Gorsuch), dissent (Sotomayor, joined by Kagan and Jackson); 48 parts, 24 footnotes,
  112 authorities (71 cases). Reference files `server/references/trump-v-slaughter.json` and
  `trump-v-slaughter-slip-opinion.pdf`
- [x] Storage: `server/seed/load-case-text.js --cluster <id>` → `cases.structure` (everything
  but the opinions' text) and one `case_opinions` row per writing (`position`, `structure`).
  The PDF is kept in the data directory under `supremecourt.gov/…`
- [x] Case page (`/supreme-court/roberts-8/10881681`): Show/Hide full text, Show/Hide PDF,
  Show/Hide citations, PDF ↗, CourtListener ↗; contents list in the rail (writings, then parts
  with their opening words, − / + to step levels); footnote marks link to the footnote and back.
  `OpinionText.jsx`, `OpinionOutline.jsx`; `caseText`, `caseOpinionText` queries

- [x] Outcome (2026-10-02): `structure.outcome` read from the syllabus's closing line-up:
  judgment ("Reversed and remanded."), holding, tally (6–3), each Justice's side, what they wrote
  and joined (with qualifiers such as "as to all but Part III–B"). Shown on the case page as an
  Outcome block (judgment and tally, one bar segment per Justice, a table per side) behind a
  Hide/Show outcome button, open by default; Judgment and Decision in the facts row
- [x] PDF viewer with the contents list: every writing and part has `pdf_page`. With only the
  PDF shown, the contents list stays in the rail and opens the viewer at that part's printed page

- [x] **Bulk load: Roberts Courts VII and VIII** (2026-10-02): every opinion on the Court's
  slip opinion lists for October Terms 2020–2025 from 2020-10-27, 392 decisions.
  `server/seed/load-case-text-bulk.js --terms 2020-2025 --from 2020-10-27` matches each to a
  CourtListener cluster by docket and date (kept in `courtlistener.com/scotus-slip-opinions.json`
  in the data directory), reads the slip PDF, checks it (`checkDecision`) and stores it
- [x] The Court's lists now link to the Reporter's preliminary prints (back to OT2020), whose text
  drops the letters of fi/fl ligatures ("fled" for "filed", "offce"). The original slip PDFs,
  which CourtListener records and the Court still serves, are read instead
- [x] Parser extended for: running heads that wrap or stack (plurality parts, appendices), joint
  writings ("BREYER, SOTOMAYOR, and KAGAN, JJ., dissenting"), per curiam decisions without a
  syllabus (caption, docket and date from the opinion), pages with no running head (pictures),
  original actions ("65, Orig."), unanimous and plurality line-ups, joiners in a separate
  sentence, recusals, bracketed superscripts, unraised asterisk footnotes
- [x] Per curiam outcome: Justices who wrote or joined a separate opinion are placed by it, the
  rest counted with the Court (`outcome.inferred`), using the natural court's membership
- [x] Case page finds the text when CourtListener has several clusters for one decision
  (`caseText`): by docket number (CourtListener's, or the `cases` row's when CourtListener has
  none, e.g. Cruz v. Arizona) within a year of the date (revisions are dated later, e.g.
  Zubaydah), else by case name and date. Checked 2026-10-03: every entry in the Roberts VII and
  VIII lists (134 + 262) reaches its text except Mckesson v. Doe
- [x] **No CourtListener at runtime** (2026-10-04). One row per decision: `court_decisions`
  (general, with a `court` column, for lower courts later), `court_votes` (one per Justice per
  decision), `case_opinions.decision_id` / `author_id`; CourtListener's records (`cases`, up to 8 per
  decision) point at their decision by `decision_id` and only redirect old links. Decisions are
  addressed by the Court's docket number (`/supreme-court/roberts-8/25-332`), the identifier that
  exists from filing; govinfo's `USREPORTS-<vol>-<page>` ids exist only for bound volumes (to 586 so far).
  `server/lib/decision-storage.js`; one-time move `server/seed/migrate-case-decisions.js` (391 decisions,
  979 opinions, 3,500 votes, 686 CourtListener records linked). Case page, natural court lists, Timeline and
  tag pages read the database; unloaded natural courts say "not loaded yet"
- [x] Justices as people: `server/seed/load-justices.js` reads the Federal Judicial Center's directory
  (`judges.csv`; `lib/parse-fjc-justices.js`): 116 Justices, 121 appointments as `person_roles`
  (`justice` / `chief_justice`; service ends at senior status). Votes and opinion authors matched by
  surname among the Justices serving on the decision date. The outcome block links each Justice to
  their person page; the People page has a Justices filter, and a Justice's page shows who appointed them. Which Justices sat on a day still comes from
  `naturalCourts.js`: the directory has commission dates, not oath dates (Jackson: commissioned April 8,
  sworn June 30, 2022)

## Todo
- [ ] Mckesson v. Doe (19-1108, 2020-11-02): its slip PDF is gone from supremecourt.gov; only
  the preliminary print (ligature problem) remains
- [ ] 12 stored decisions are flagged by `checkDecision` (2026-10-02 load):
  - Barrett v. United States (24-5774) counts 5 Justices: the line-up names joiners only for
    the part that is a plurality
  - LeDure v. Union Pacific (affirmed by an equally divided Court) and Allen v. Milligan's
    appendix (a map) have no text
  - nine decisions have a footnote whose call was not found, so it has no link from the text
    (Dobbs: Thomas's concurrence; Biden v. Texas; SFFA v. Harvard; CFPB v. CFSA; Smith v.
    Arizona; Loper Bright; Moody v. NetChoice; CC/Devas; Riley v. Bondi). The footnotes themselves are stored
- [ ] "Opinions relating to orders" (statements and dissents on orders) are not loaded
- [ ] Re-run for new decisions: `load-case-text-bulk.js --terms 2025 --refresh` (already stored
  decisions are skipped)
- [ ] Older decisions: bound volumes of the U.S. Reports (govinfo `USREPORTS`, PDF, different
  typesetting) and the 1937–1975 `SCD` text would each need their own reader
- [ ] Citations not yet picked up: cases referred to by name alone or by "Id.", the
  Constitution ("Art. II, §1"), the Federalist, law reviews, Cong. Globe / Annals of Cong.
- [ ] Turn `citations` into graph edges (`cg_case_relationships`): each has volume and page, and
  a count per opinion, but is not yet matched to a `cases` row
- [ ] The outcome's sides are inferred from the line-up: concurring counts as for the judgment;
  a Justice who took no part has side "none". Check against a decision with a plurality or a
  partial dissent
- [ ] Full-text search over the stored opinions (on hold; the lists search case names only)
- [ ] Load Roberts Courts I–VI (2005–2020) so their lists (and the Timeline before 2020) have decisions
- [ ] Link the Supreme Court Database (`cg_scdb_cases`: decision direction, canonical citations)
- [ ] Schedule the bulk loader: without CourtListener's live list, new decisions appear only when it runs
- [ ] A Justice's person page lists no decisions yet (`court_votes` has them)
- [ ] The tag panel sits below the whole text on a loaded case; put it behind a Show/Hide tags
  button as on the bill page

## Decisions / Notes
- A line-break hyphen is printed as a separate piece of text hung in the margin, a real hyphen
  as part of its word. Two exceptions each way in 108 pages ("quasi-" / "legislative",
  "Web-" / "ster") are settled by how the document spells the word elsewhere.
- A short citation ("295 U. S., at 628") is assigned to the case cited in full that starts
  nearest before that page in the same volume. Three cases in this decision share volume 295.
- Parts have no titles. The page labels them as the Court refers to them ("Part II–A–1");
  the contents list shows each part's opening words.
- Footnote calls are zero-length `footnote_ref` spans, so the item text has no stray digits.
- The slip opinion is "subject to formal revision"; the stored text is the slip text, and
  `citation` has a blank page ("609 U. S. ___ (2026)") until the bound volume.
- The reference JSON was written by the parser and checked by eye against the PDF, not built
  by hand first as the executive order references were.
