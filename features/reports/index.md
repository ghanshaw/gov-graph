# Reports

## Status
In Progress

## Goal
Reports of investigations as documents in the graph: a commission created by a law or an executive
order, a congressional inquiry or a special counsel examines one question and reports findings and
recommendations. A report has no legal force; what matters for the graph is what created the body that
wrote it and the laws that followed. Starting with the 9/11 Commission Report (2004).

## Decisions
- Tables `reports` (one row per report: issuer, date, govinfo package, `related` documents, `structure` =
  outline, recommendations, counts, sources) and `report_parts` (one row per chapter / preface /
  appendix / summary, `structure` = sections → items in the shared shape, plus notes). Schema in
  `server/lib/reports.js`. Not one table per kind: Warren, Kerner, January 6th, Mueller fit the same rows.
- Facts are entered by hand in `server/seed/data/reports.json`, like `periods.json`: what created the body
  (`created_by`) and the laws that followed (`followed_by`), each a citation, date, link and a
  `bill:` / `fr:` reference that becomes an in-app link once that bill is loaded (`documentHref`).
- 9/11 text from the Commission's own HTML edition (9-11commission.gov/report): its markup gives chapters,
  numbered sections ("1.1"), headings on their own line, run-in headings, boxed passages (one-cell
  tables), bullets, note calls (`<sup>`) and a separate notes file. govinfo's edition (GPO-911REPORT) has
  PDFs only, so it supplies the printed pages and the part titles (granule titles).
- Endnotes are printed after their chapter, as footnotes are for court opinions.
- The text is kept as the HTML prints it, slips included (hyphens for dashes, a missing space after
  some full stops). Note calls printed as plain digits ("training.52") are turned into calls when that
  note has no other call (`recoverCalls`).
- Recommendations: each paragraph in bold starting "Recommendation:" (41: 28 in chapter 12, 13 in
  chapter 13, matching the commonly cited count). The Commission did not number them; they are numbered
  in reading order as addresses (`ch12-rec-1`).
- Part order follows govinfo's: preface, chapters 1–13, appendices A–C, then the executive summary
  (published separately). The front matter (contents, members, staff) and the chair's statement are
  downloaded, not parsed.
- PDFs: govinfo's, through `server/pdf.js` (`/pdf/govinfo/<package>/<granule>`), since govinfo cannot be framed.
- Timeline: kind `report`, above the axis (lane label "REPORTS"), token `--report`, toggle "Reports",
  off by default like every other layer.

## Done
- [x] Downloaded (`fetch-reports.js`): the Commission's 40 files (HTML and PDF per part, notes, full PDF,
  FAQ) and govinfo's package PDF, 19 granule PDFs and MODS record (2026-10-11)
- [x] Parser `server/lib/parse-commission-html.js` with tests (`parse-commission-html.test.js`, 7)
- [x] Loaded (`load-reports.js`): 18 parts, 1,742 notes, 41 recommendations; every note matched to its
  call except three calls missing from the HTML (chapter 8 note 86, 10/46, 11/18)
- [x] API: `reports`, `report(slug)` (with `related` hrefs), `reportPart(slug, partId)`; timeline kind `report`
- [x] Pages: `/reports` (list) and `/reports/:slug` (facts, What followed, text loaded part by part as
  it comes within reach, contents rail, recommendations list, govinfo PDF per part); nav item "Reports"
- [x] Links into the text (`#ch12-rec-1`, notes) stay in view while the parts above load

## Todo
- [ ] Load the 107th, 108th and 110th Congresses' bills, so Pub. L. 107-306, 108-458 and 110-53 link in-app
- [ ] Mark the report's influence on those laws more precisely (which sections implement which recommendation)
- [ ] Other commissions on govinfo's "Featured Commission Publications" (e.g. the WMD Commission, GPO-WMD)
- [ ] The January 6th Select Committee report (H. Rept. 117-663, govinfo CRPT) and special counsel reports
- [ ] Figure captions in the 9/11 HTML sit mid-paragraph where the printed figures were; mark them as captions
- [ ] Check the pages in Chrome through the extension (checked in headless Chrome only)
