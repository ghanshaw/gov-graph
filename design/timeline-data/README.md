# Timeline data: choosing and combining series

Design variants for how people find economic series on `/timeline`, turn several on at once, and see
them drawn together when they can be and stacked when they cannot. Written 2026-10-11.

Open them through a local server (Chrome's automation cannot open `file://`):

    cd design/timeline-data && python3 -m http.server 9002 --bind 127.0.0.1
    # http://127.0.0.1:9002/  (index.html links the four variants)

They draw **real data**: `shared/data.js` is 59 series pulled from the local GraphQL server by
`shared/fetch-data.mjs` (from 1980; daily series as weekly averages, as the timeline draws them). The
context events (laws, the tariff order) are entered by hand in `shared/catalog.js`; in the app they would
come from `timelineEvents`. Screenshots are in `screenshots/`.

## Build by structure (2026-10-13): `build-structures/`

Direction from review of `abstract-nav/`: Browse and Build become separate tabs; Build can switch between structures
(the Statistical Abstract and the Comparative Agendas Project's topics, from `server/seed/data/structures/`); the
category list is wide and shows the whole nested structure as the Structure page does, empty categories greyed or
filtered out; choosing a subsection shows every dataset under it (the choosing itself stays as in the app); a filter
over categories and dataset names. Data in `data.js` (27 measures placed in both structures as a proposal), shared
code in `frame.js`, styles in `style.css`.

- **D. Wide tree** (`wide-tree.html`): the whole structure open in a 440px left column, filter and switch above it.
- **D.1 Wide tree, down to the measure** (`wide-tree-1.html`, `d1.js`, `d1.css`): D with a third level, the measure as
  the leaf (Macroeconomics → General → GDP). Choosing it runs the app's own Build choices: `dimensions.js` is copied
  from `client/src/dimensions.js`, the app's styles for them are in `app-builder.css`, and `builder-data.js` holds the
  vocabulary and every national series with its dimensions and dates (local database, 2026-10-13). No codes.
- **E. Map, then focus** (`map-focus.html`): the whole structure across the panel in three columns; choosing a
  subsection folds it into a 360px column, only its section open, with the datasets beside.
- **F. Filter first** (`filter-first.html`): a large filter with suggested words; the tree starts folded and filtered
  to what holds data, and opens on matches down to dataset names.

URL options for all three: `?structure=cap`, `?q=tax`, `?only=1`, `?sub=<subsection id>`, `?tab=browse`.

## Build mode navigation by the Statistical Abstract (2026-10-13): `abstract-nav/`

The measure list in Build mode's left column, regrouped by the 2012 Abstract (sections and subsections as printed
in its contents, pages vii–x; data in `abstract.js`, shared frame in `abstract-frame.js`). Today's 27
measures are placed by hand as a proposal; ◇ marks one no Abstract table holds (placed by GovGraph, with the reason).

- **A. Contents** (`a-contents.html`): the book's contents as the rail, section → subsection → measure, folding.
  "With data" (default) shows the 10 sections that hold something; "All 30" shows the whole book with empty parts grey.
- **B. Section index** (`b-index.html`): the 30 sections in the rail (with data first); the panel lists the chosen
  section's subsections in book order, measures as cards, empty subsections "Not collected yet". A measure opens the
  builder in the panel, with a link back.
- **Structure tab** (both options, `?tab=structure`): the whole book at a glance, every section with its subsections
  nested under it and the measures each holds; a measure opens it in Build.

## Build mode concepts (2026-10-13): `builder/`

The catalogue's Build mode (`client/src/components/DatasetBuilder.jsx`) treats every dimension as an equal row, so
choosing "Dollars of the day" after "Growth rate" for GDP drops the growth rate (it is published only adjusted for
inflation): the choices switch back and forth. Three concepts, each on GDP and unemployment (U-6 only as a rate
for everyone; groups only as U-3), in `builder/` with the data in `builder/data.js`:

- **A. Nested** (`a-nested.html`): the dimensions as a tree in order. Choosing a value opens what exists under
  it; an option alone under its parent is chosen for you; a closed value previews what is under it ("only
  everyone"). Clean, but a breakdown shared by several branches is chosen once per branch (Women under the rate
  and again under the number).
- **B. Cascade** (`b-cascade.html`): flat rows read top down, the main row set apart and read as a phrase
  ("Unemployment as a rate and a number of people"). Each row offers only what exists with the rows above, so
  a click never changes a row above; what exists for nothing chosen above is locked and says what it needs.
  An option that is the only one under one choice above and exists under all of them is chosen for every one
  (rate and number → Official (U-3)); one found under only some says so ("rate only"). Women is chosen once.
- **C. Grid** (`c-grid.html`): the datasets as a table: combinations of the other dimensions across, the last
  dimension down, a cell per dataset with its years, "not published" where there is none. Tick cells, rows or
  columns. Clearest for two or three dimensions; unemployment's five (sex, race, age, education) need filters
  above the grid.

Order in all three: the dimensions that tell datasets apart, then what all share (how often, seasonal
adjustment), then **years**, then **source** last. Wording for "Shown as": A and C use "Measured as", B
reads as a phrase ("GDP as a growth rate"); other candidates: "Given as", "Figure", "As".

## Round 3 (2026-10-11): AC.1

`ac-1.html` combines A.1.1 and C.1.1, with the search at the top:

- **The search field runs across the page.** Focusing it, typing, or "Browse all 58 datasets" opens
  A.1's catalogue under it; Done or Esc closes it.
- **Below is C.1:** the year range and chart on the left, the lanes and then the context on the right.
  The lane panel has no search of its own.
- **Ticking a dataset** puts it in a lane, and the catalogue says which one before you tick ("→ lane 3",
  "→ new lane"). It goes to a lane on its scale that already holds the same subject, else any lane on
  its scale, else a new lane. Unticking removes it; dragging between lanes works as in C.1.
- **Names read as a phrase.**

## Round 2 (2026-10-11): A.1 and C.1

After review, C (layers and lanes) is the favourite, with A kept as the way to see every dataset there
is. Round 2 reworks both and tries two naming conventions on each:

| | Reads as a phrase | Measure: detail |
| --- | --- | --- |
| A.1, catalogue | `a-1-1.html` | `a-1-2.html` |
| C.1, layers and lanes | `c-1-1.html` | `c-1-2.html` |

What changed, from the review:

- **Names**: one human-readable name per dataset, used everywhere, never depending on a heading
  ("Individuals, monthly" is gone). Conventions and rules in `NAMING.md`; the names in `shared/labels.js`.
- **No sparklines**, and no coverage bars in the lanes (they were full for almost every series and read
  as decoration). A lane now prints "starts 2015" or "ends 2022" under a dataset only when it doesn't
  cover the years shown.
- **Recessions are labelled, not grey**: a row of brown bars, each labelled with its years, under the
  presidents, and a light brown hatch down through every chart. "during a recession" in the cursor card.
- **A year range**, as on the app's timeline: drag either end, type a year, or pick a preset. Lined up
  with the chart.
- **A.1**: the search field filters a catalogue of every dataset by subject and meaning (subjects down
  the side with counts, filters by how often it is published). Hide it to see only the tray and charts.
- **C.1**: each lane says its scales ("Index (left) · Dollars a barrel (right)") and can be moved up or
  down. Dragging onto a lane says what will happen ("Adds a second scale on the right", "This lane
  already has two scales"). Context items show their swatches as drawn and how many fall in the years
  shown. An empty search offers the subjects to start from.

## The problem today

The timeline takes **one** series at a time (`priceSlug` in `Timeline.jsx`), chosen from a rail of
collapsible groups that mirror the Economy tabs, plus BLS breakdowns for unemployment. To compare the
jobless rate with the Fed's rate you go to `/economy`, where several series can be chosen, but only
within one tab. Nothing tells you what "taxes" can mean; you have to know there are tabs called Tax
revenue, Revenue since 1934, Tax rates, Receipts & outlays and Trade & tariffs, and which publisher each
group is.

## What the variants share

All four use the same engine (`shared/chart.js`) and rules, so they differ only in how you choose.

**1. Search starts from the words people bring.** `shared/catalog.js` maps a word to a *topic*
(Unemployment, Taxes, Gas & oil prices, …) through aliases taken from news and talking points: "jobs
report", "real unemployment rate", "tax the rich", "fair share", "liberation day", "drill baby drill",
"rate cut". Each topic splits into *intents*, the different things the word means:

| People say | They might mean | Series |
| --- | --- | --- |
| taxes | how much the government collects | MTS monthly receipts; OMB yearly; OMB % of GDP |
| | income taxes, people vs. companies | MTS individual / corporate; OMB % of GDP |
| | rates and who pays | IRS top rate; CBO average rate by fifth; CBO share paid by top fifth |
| | refunds and paychecks | MTS refunds; DTS daily withholding |
| unemployment | the rate in the news | U-3 (★ headline), U-6 ("the real rate") |
| | how many people | unemployed persons |
| | for a group | BLS's own published breakdowns |
| tariffs | money collected / the average rate / trade | MTS customs; USITC duties ÷ imports since 1891; Census trade balance |

One series per topic is marked **"what the news means"** (the jobs report's U-3, the pump price, the
FOMC rate), so a casual search gives the expected number first and the alternatives beside it.

**2. Say what is missing.** When the expected number isn't loaded, search says so instead of quietly
showing something else: "The economy added 150,000 jobs" is payroll employment (CES), not loaded;
"inflation was … percent" is a 12-month change BLS prints but GovGraph doesn't hold, and under the
"publishers' numbers only" rule (no computed series) we must not compute it. That rule matters most here:
it rules out the usual way of putting unlike series on one chart, **rebasing to 100**, since that is a
series of our own. The only options left are shared axis, second axis, and stacking.

**3. Compatibility decides the chart; the user can see why.** Series share a chart when measured alike:

- the same unit (percent with percent, $/gal with $/gal, people with people);
- dollars only with dollars **over the same period**: a month's receipts and a year's are not on one scale
  (BEA's quarterly values at an annual rate count as yearly);
- an **index never shares**: CPI (1982–84 = 100) and the FHFA index have different bases.

Two settings are tried:

- "measured alike" (the current `chartGroups` rule);
- "alike *and* same subject", which keeps the unemployment rate and the Fed's rate apart though both
  are percents.

The second reads better once more than three or four series are on; A and B offer the switch, D uses
it, C lets you decide lane by lane.

Every variant shows the grouping: chips bundled per chart (A), the rail grouped per chart (B), lanes (C),
legend per panel. A line under the chart says why there are several ("percent and dollars a gallon are
measured differently, so they are stacked on the same dates").

**4. Active, hidden and off are three different states.** A series can be on, *hidden* (kept in the
tray or rail, struck through, its colour kept, one click to bring back), or removed. Colours stay with a
series while it is in the set (`colorKeeper`), so hiding one never repaints the others.

**5. Frequency is shown, not smoothed away.**

- Every series has a badge: **D** daily, **W** weekly, **M** monthly, **Q** quarterly, **Y** yearly,
  **FY** fiscal year. The coarser, the warmer the colour.
- Daily and weekly values are drawn as a line; monthly through the middle of the month.
- Quarterly, yearly and fiscal-year values are drawn as a **level across the period they stand for**
  (steps), so a yearly tax rate doesn't look like a reading taken on January 1. FOMC targets step from
  each decision.
- The cursor card prints each value with its own period ("Sep 2026", "Q2 2026", "FY 2025", "week of
  Oct 5, 2026"). A value whose period has passed is greyed as "last: 2022" rather than carried forward
  silently (CBO's rates end in 2022).
- Gaps stay gaps (October 2025 in BLS and CPI series).
- Coverage bars (C) show each series' span against the years shown: monthly Treasury data begins in
  2015, CBO ends in 2022.

**6. Context is a layer too.** Presidencies, recessions, Fed decisions, tax laws, relief laws and tariff
orders switch on and off like series, and a topic can bring its own (Taxes → tax laws; The Fed → rate
decisions).

## The four variants

### A. Search and tray (`a-search-and-tray.html`)

The design you described. A full-width search field at the top (`/` to focus) opens a panel of answers:
the matching topic, "In the news: …", each intent's series with sparkline, frequency, years, source, and
a hint, **"joins a chart"** or **"new chart"**, before you click. Under the field, the **tray**: chips
bundled per chart ("Chart 1 · Percent"), each with eye and ×; hidden ones dashed. Context chips sit at the
end of the tray.

- Good: quick for people who know what they want; everything active is visible in one band; matches
  common search-and-filter patterns.
- Weak: the answer panel is long for "taxes" (15 series); it closes when you click away, so comparing
  intents means reopening it.

### B. Topic answers (`b-topic-answers.html`)

Meaning first. Search or a row of topic pills (with a count of what's on from each) opens an **answer
sheet**: one card per meaning, toggles per series, a card of events to mark, a "Not here yet" card, and
"often looked at with Tariffs, Debt". Breakdowns are buttons, not a list. The sheet folds to one line once
you've chosen. A left rail lists what's on, grouped per chart.

- Good: best for "I heard X on the news"; the meanings sit side by side, so the reader learns that "taxes"
  is four questions; the rail mirrors the charts.
- Weak: takes the most room above the chart; one topic open at a time.

### C. Layers and lanes (`c-layers-and-lanes.html`)

Explicit control, as in a map or drawing program. A side panel: search, context layers, then **lanes**
(one lane = one chart). Drag a layer onto another lane:

- **same unit**: it joins (teal);
- **a second unit**: it goes on a right-hand scale (amber, with a note);
- **a third unit**: refused, with the reason (red);
- onto **New lane**: it is pulled apart.

L/R switches the side, and each layer shows its coverage bar.

- Good: total control; mixed frequencies in one lane (daily Fed rate, monthly jobless rate, weekly mortgage
  rate) are easy to set up and read; scales well to many layers.
- Weak: second axes invite false comparisons (the CPI-vs-oil lane in the default state shows the risk);
  drag is hard on phones; most work for a casual visitor.

### D. Sentence builder (`d-sentence.html`)

The view is a sentence: "Show **the unemployment rate** for everyone, **for Black workers** and **for
Hispanic workers** **+ something else** since **1990**, marking **recessions**." Each underlined phrase
opens a small menu: about the series, hide, remove, swap for a sibling, add a group. Below it,
**starting points** (Did tariffs bring in money? Inflation and the Fed, Who pays federal taxes?, Gas
prices by president, Who loses jobs in a recession, Debt, deficits and relief) load a whole sentence. The
sentence is also the URL.

- Good: the most readable statement of what is on; easy to share; the starting points teach what's
  possible.
- Weak: gets long past four or five series; precise control (axes, which chart) is hidden; phrasing each
  series takes writing work (`PHRASES`).

## Recommendation

Combine them:

1. **A's search field and tray** as the frame, at the top of `/timeline`.
2. **B's answer layout inside A's results**: when a search hits a topic, show its meanings as columns
   with the headline series first and "Not here yet" at the bottom.
3. **D's starting points** under the empty search field, and D's sentence as a one-line summary above the
   chart (and as the URL).
4. **C's lanes as an advanced mode**: "Arrange charts" on the tray turns the bundles into lanes you can
   drag between. Keep second axes out of the default; offer them only there.

## Questions to settle

- **Which sharing rule is the default:** measured alike, or also the same subject?
- **Second axes:** never, or only in arranged lanes?
- **The Economy page:** should it become this same component, opened with a topic (`/economy/taxes` =
  the Taxes topic)? Then the catalog would replace `ECONOMY_TABS`, and the tabs' ledes would become the
  topics' notes.
- **Which loads close the biggest gaps:** payroll jobs (CES) and the 12-month CPI change people quote.
  BLS prints that change in its release; check whether it is published as data we can load as printed
  before promising it.
- **How many series at most:** the app limits a chart to 8 lines; the tray could allow more charts.
