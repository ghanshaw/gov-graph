# Timeline

## Status
In Progress

## Goal
One timeline of what the three branches did, read from what we have loaded: presidential actions,
enacted laws and Supreme Court decisions, each linking to its page in the app.

## Decisions
- Everything comes from the database (`timelineEvents`, `server/timeline.js`), not the Federal
  Register or CourtListener. The timeline shows what is loaded and grows as more is loaded.
- Defaults: from 1993, when Clinton took office (changed from the last four years, 2026-10-11), with only presidential
  terms shown: every event kind, recessions, emergencies and the economic series start off
  (2026-10-10; before, orders, laws, decisions and WTI were on). All of it can be changed in the rail
  (Show, Period, Orientation). Dragging the range selector clears the Period choice.
- Two sides of one axis: orders, memoranda and laws above, decisions below, told apart by the branch
  colour tokens.
- Laws come from the database only: a bill's first "Became Public Law" / "Became Private Law" action.

## Done
- [x] Zoomed in, nothing goes blank: month ticks (labelled every month or quarter as room allows), and the
  presidency and period labels, the price band's title and its scale stay in the visible part when scrolled (2026-10-11)
- [x] The range selector spans only the data that is on (events of the kinds shown, the series, recessions and
  emergencies when on; presidential terms only when nothing else is), never past this year; the years shown are kept
  within it (2026-10-11)
- [x] A series with too few values in the years shown (CBO tax rates end 2022, IRS brackets 2018) moves the range
  to its own years when chosen; the range can reach back to a series' first year, before any event (2026-10-11)
- [x] Zooming keeps the same date in place: under the pointer for a wheel or pinch, at the middle of
  the visible part for − / + (both orientations; not yet checked in Chrome) (2026-10-11)
- [x] `timelineEvents(kinds)`: orders (1,244, correction notices left out), memoranda (584), laws
  (120, 119th Congress), decisions (391, Roberts VII–VIII), each with `label` and in-app `href`;
  Bush orders have no page, so no link (2026-10-04)
- [x] Timeline page on that query; rail toggles for orders/memoranda, laws and decisions; Period
  (Last four years / Everything loaded); counts within the selected years; branch colours
- [x] Tooltip kept inside the visible chart (the newest events sit at its right edge)
- [x] Cursor line across all lanes and the price band, replacing the per-dot tooltip: highlights
  every event on the line and the price that week, one card for all (2026-10-10; see economic-data)

- [x] Presidential terms (2026-10-10): `presidentialTerms` query (`person_roles`, from the
  @unitedstates executive list), drawn as a strip of presidencies across the top coloured by
  party (consecutive terms joined, a tick at re-election), a dashed line through every lane where
  the president changes, and the president named in the cursor card. Rail toggle, on by default.
  Clicking a presidency opens the person's page

- [x] Periods (2026-10-10): `periods` table from `server/seed/data/periods.json` (hand-entered,
  cited): 12 NBER recessions since 1948 (generated from NBER's spreadsheet; the recession is the
  months after the peak through the trough), the COVID-19 Public Health Emergency (HHS, Jan 27 2020 –
  May 11 2023) and National Emergency (Proclamation 9994, from Mar 1 2020; ended by Pub. L. 118-3,
  Apr 10 2023). Bars in rows under the presidencies, shading through the lanes, "During:" in the
  card, toggles; clicking opens the starting document (in the app once loaded)
- [x] Zoom kept per orientation; 100% fits the selected years to the width (horizontal)

- [x] About the data shown (2026-10-10): under the chart, one block per layer that is on (events by
  kind, terms, recessions, emergencies, the economic series and its band): GovGraph's description
  (labelled "Written by GovGraph"), the publisher's title where its files have one (quoted,
  "Verbatim, from <file, field>"), and the data source with a link. Browser tooltip on period bars replaced by period details in the card

- [x] Reports of investigations as events (`report`, above the axis, toggle "Reports"; the 9/11
  Commission Report, July 22, 2004; see features/reports) (2026-10-11)

- [x] Design variants for choosing and combining series (2026-10-11): `design/timeline-data/` — four static
  mocks on real data (A search and tray, B topic answers, C layers and lanes, D sentence builder), a topic
  catalog mapping news words to published series, and a recommendation in its README
- [x] Round 2 (2026-10-11): A.1 (catalogue of every dataset) and C.1 (lanes reworked: year range, labelled
  recessions, no coverage bars), each in two naming conventions; naming rules in `design/timeline-data/NAMING.md`
- [x] Round 3 (2026-10-11): AC.1 (`ac-1.html`) combines A.1.1 and C.1.1, search across the top
- [x] The timeline is AC.1 (2026-10-11): search and catalogue of every series across the top
  (`SeriesSearch.jsx`, Economy tabs as subjects with news words, headline series, "not here yet"; unemployment
  breakdowns as rows), lanes of series under the events (`TimelineChart.jsx`, replacing `HorizontalTimeline.jsx`;
  up to two scales a lane, drag between lanes, hide, reorder, quarterly and yearly values as steps), the lane
  panel with context counts (`LanePanel.jsx`), a year range with typed years and presets (`YearRange.jsx`),
  recessions labelled and hatched in stone brown. Vertical orientation and the breakdown buttons
  (`BreakdownBar.jsx`) removed
- [x] Lanes restyled like the Economy chart (2026-10-11): taller plot, years under each lane, unit
  above the scale, legend in normal case, no lane title in capitals; no dashed presidency lines through
  the lanes; year axis ticks only at labelled years; yearly / quarterly values as a line through the
  middle of each period (irregular series keep their steps)

## Todo
- [ ] Keep the lanes, context and years in the URL, so a view can be shared
- [ ] Check dragging between lanes by hand in Chrome (checked with scripted drag events in headless Chrome)
- [ ] Clustering or a denser legend when a lane holds many series (the SVG legend estimates text widths)
- [ ] Load proclamations (Federal Register, `--type proclamation`) so Proclamation 9994 links in the app
- [ ] Load the 118th Congress's history and text so Pub. L. 118-3 links in the app
- [ ] Check periods in Chrome (extension disconnected when built)
- [ ] Check the presidencies strip and cursor card in Chrome (extension disconnected when built)
- [ ] Laws before 2025 appear once the 115th–118th Congresses are loaded (waits on the database plan)
- [ ] Decisions before Oct 2020 appear once Roberts Courts I–VI are loaded
- [ ] Blurb view over many years is very tall; consider clustering when zoomed out
- [ ] Other events worth showing: vetoes, signed bills, cert grants, emergency applications
