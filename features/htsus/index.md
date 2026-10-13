# Harmonized Tariff Schedule (HTSUS)

## Status
Planning — Phase 0 source check done (2026-10-07). Next: choose the source and decide the model
before any fetch script or tables.

## Goal
A part of the app for the Harmonized Tariff Schedule of the United States: browse the schedule
(General Notes, General Rules of Interpretation, sections, chapters, headings), see each revision's
changes, and a list of tariff actions (the Chapter 99, subchapter III headings `9903.xx.xx`) linked to
the proclamation, executive order or law behind each one.

The model is the same as the U.S. Code's: an edition or revision ("2025 Revision 16") is a release
point, a proclamation / order / Act is a commit, the change record is the log.

## Decisions
- The HTSUS is one living document maintained by USITC, not a series of acts. A Basic Edition each
  January, then numbered Revisions (2025 went past Revision 25; 2026 had reached Revision 19 by
  mid-September).
- Raw files go in `../gov-graph-data/` under the publisher's paths, like the other sources.

## Findings (Phase 0, 2026-10-07)
- **hts.usitc.gov is degraded.** Its search application and REST API (`/reststop/…`) return 503,
  even in a browser. The fallback page offers per-chapter PDFs only, and they are stale: "2026 HTS
  Revision 1", files dated 2026-01-30.
- **USITC blocks scripted clients.** `learning.usitc.gov` and `www.usitc.gov` return 403 to curl even
  with browser headers (Akamai); the PDFs download only through a real browser.
- **The Internet Archive has the REST API's responses** (7,256 captures of `hts.usitc.gov/reststop/…`,
  fetched as `https://web.archive.org/web/<timestamp>id_/<url>`; some bodies come back gzipped):
  - `exportList?from=0101&to=9999&format=JSON&styles=false`, captured 2026-08-04: the whole schedule,
    35,789 rows (`htsno`, `indent`, `description`, `superior`, `units`, `general`, `special`, `other`,
    `footnotes`, `quotaQuantity`, `additionalDuties`). 3,096 Chapter 99 rows, 622 of them `9903`.
    Rates are prose ("The duty provided in the applicable subheading + 10%"). Which revision it is
    is not in the file.
  - `file?release=<release>&filename=<name>`: the PDFs of every past release (6,600 captures), e.g.
    `2025HTSRev16`, `2026HTSRev19`. Coverage is patchy: Chapter 99 is captured for 2018–2024 releases,
    not for 2025 or 2026.
  - `releaseDetails?release=…` (the list of files in a release), `getChapterNotes?doc=N` and
    `getSectionNotes?doc=N` (notes as HTML; chapter 99's notes only from 2024-01-02).
- **The U.S. notes are not in the JSON export.** The notes to Chapter 99, subchapter III, are where
  each tariff measure is defined; they come only as PDF (or the `getChapterNotes` HTML).
- **Few 9903 descriptions name their authority:** 47 of 622 mention an order or proclamation (only
  EO 14323 and EO 14326 by number).
- **Change records are PDFs** with a regular table (item, nature of change, effective date, source):
  - The Basic Edition's record is cumulative for the year before and names the source:
    `PP 10875` (presidential proclamation), `484(f)` (statistical committee), `Notice`, with the
    revision each change came in. That is the link from a 9903 heading to a proclamation.
  - A revision's record only gives the category (`484(f)`, `Notice`); 2025 Revision 16's 17 Chapter
    99 changes all say `Notice`, with no citation.
  - Some archived bodies are gzipped; the project's pdfjs reader parses the text cleanly.

## Done
- [x] Phase 0 source check (above)

## Todo
- [ ] Choose the source: the Internet Archive's API captures now, the live API when USITC restores
  it, or browser downloads of the current PDFs
- [ ] Find which revision the 2026-08-04 JSON export is, and whether a newer full export is captured
- [ ] Find where "Notice" changes are documented (USITC notices or the Federal Register) so each 9903
  heading can be traced to its proclamation or order
- [ ] Decide the tables (editions/revisions, headings by version, change record entries, notes)
- [ ] Collect proclamations (`executive_documents`, `doc_type = 'proclamation'`) so `PP` sources link
