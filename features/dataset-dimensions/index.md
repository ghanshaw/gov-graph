# Dataset Dimensions

## Status
In Progress (2026-10-13). Labelling done; Build mode chooses datasets by their facets, checked in Chrome at desktop width.

## Goal
A composable timeline: the reader picks a measure (federal revenue, tariffs), the form it is shown in
(an amount, a share of GDP, a rate), how often, the breakdowns that apply (which tax, which group of
workers), and last a source when more than one dataset still matches. Only combinations that exist are
offered; values ruled out by other choices are greyed with the reason. It sits beside the search catalogue on
`/timeline` (`DatasetSearch.jsx`), which stays.

## Decisions
- Labelling comes first, before any UI (2026-10-12).
- Forms no publisher prints ("Share of GDP", "Growth rate" for dollar amounts) are not offered at all; the greyed, struck-through placeholders were removed (2026-10-13).
- No computed series (the Economic Data rule stands): a form is offered only where a publisher prints it.
  Federal revenue has amounts (OMB, BEA, MTS) and a share of GDP (OMB) but no growth rate.
- Series stored apart are separate datasets, never joined, even where Treasury only renamed a line. Series
  that share every dimension (the daily Treasury lines before and after February 2023; the three daily
  tariff lines) are told apart by the years they cover, offered as alternatives like sources.
- Labels follow the reader's idea of the thing, not each publisher's definition: BEA's personal current
  taxes and OMB's individual income taxes are both `individual-income`; the descriptions say how they differ.
- Build mode selects by facets, not from a list (user, 2026-10-13): click chooses a value, its × takes it
  out (double-click was replaced the same day); several values in a row are combined (any of them), rows with each other (all). Once every row that
  tells the matching datasets apart has a choice, they go on the timeline, and changing the choices changes
  them (only those the builder put on are taken off). A list appears only for datasets no facet tells apart
  (none at present). Years is a row of its own whose values are the spans the datasets cover ("1913–2026"),
  shown chosen for the datasets named, and to be chosen only where datasets differ in nothing else (the Treasury
  daily lines split in February 2023). A from–to years filter was tried and dropped (user, 2026-10-13).
  Facet values are square buttons, not round pills.
  A measure with one dataset (Consumer sentiment) is a single button with its details in a hover tooltip;
  nothing is put on until it is clicked (auto-adding on opening was dropped, user 2026-10-13). What is on the
  timeline is an "In use N" button beside Browse / Build, listed on hover with an × each.
- Build mode is a tree (concept A of three in `design/timeline-data/builder/`, chosen 2026-10-13): choosing an
  option opens beneath it only what exists for it, so nothing on screen leads nowhere and no click switches an
  earlier choice ("Dollars of the day" sits under "Amount" only; GDP's growth rate is only adjusted for inflation).
  An option alone under its parent is chosen for you. Levels in order: Measured as, the measure's breakdowns
  (sex, race, age, education as one level, **Demographics**, its groups on lines by kind), dollars, how often,
  seasonal adjustment, year, years, source. A dimension is a level only where it splits datasets the levels
  before leave together; otherwise it is listed after the tree (shared by all, or settled, like a group's years),
  source last. "Shown as" is now "Measured as".
- Subjects (the Economy tabs) are not a dimension: a measure can be under several (tariff revenue under
  Trade and under Tax revenue).

## How it is built
`server/lib/series-dimensions.js`, test `series-dimensions.test.js`:
- `DIMENSIONS`: every dimension and its values; a value may have a `parent` (Medicare taxes → payroll taxes).
- `MEASURES`: 27 measures, each with the breakdowns that apply to it. `form`, `adjustment` (nominal /
  real), `seasonal` (sa / saar / nsa) apply to all.
- Labels by slug; unemployment by group is read from `breakdown`, CBO groups from the slug.
- Read from the series, not labelled: `frequency` (four-week averages are a frequency of their own, "Four-week average"),
  `year` (calendar / fiscal for yearly series), `publisher`, and `adjustment: nominal` for dollar series.
- `dimensionProblems` checks every series is labelled, values are known, the measure has the breakdown,
  and the form agrees with the unit (rates and shares are `%`, an index is `index`).
- `sameDimensions` lists series no dimension tells apart; the test pins that list.

## Done
- [x] Served: `EconomicSeries.dimensions` (from the code, not stored) and `seriesDimensionVocabulary` (2026-10-12)
- [x] Build mode in the catalogue (`DatasetBuilder.jsx`, facets in `client/src/dimensions.js`): measures on the left,
  a row per dimension that tells datasets apart, values that lead nowhere dashed (still clickable: the choices
  that conflict are dropped), forms no publisher prints struck through with the reason, kinds in a tree on a
  line of their own, the datasets left listed to tick. Breakdowns of people start at "Everyone". Dollars,
  seasonal adjustment, year and source rows appear only when they tell apart the datasets left (2026-10-12)
- [x] Build mode as a tree (`buildTree` in `client/src/dimensions.js`), Demographics level, Measured as (2026-10-13)
- [x] Build mode reworked (2026-10-13): several values per row, × to take a value out, one-value rows shown chosen, datasets put on the
  timeline straight from the choices (`onSwap` in Timeline.jsx, settled 300 ms so a double click never flickers),
  four-week average as a frequency, the list only for datasets alike in every facet
- [x] Vocabulary and labels for all 298 stored series (the 210 in the catalogue, the 86 unemployment
  breakdowns, the Fed's target range) (2026-10-12)

## Todo
- [ ] Review the vocabulary with the picker in mind (names of dimensions and values as the reader sees them)
- [ ] Check Build mode at phone width
- [ ] Coverage (first and last date) beside the dimensions, for telling apart series split by years
- [ ] Keep the builder's choices in the URL; open Build from a search ("tariffs" → Federal revenue, Tariffs)
- [ ] Demographic series (`measure` / `place`) are not labelled yet

## Open questions
- USITC's "duties collected": after refunds or not is not stated, so it has no `flow`.
- USITC's yearly values are fiscal years (July–June) before 1918 and calendar years after; labelled calendar.
- `seasonal` is labelled only where the publisher says; yearly and daily series have none.
