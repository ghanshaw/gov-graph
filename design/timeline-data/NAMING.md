# Naming datasets

How a dataset is named wherever a reader sees it: search results, the catalogue, chips, lanes, chart
legends, the cursor card. Drafted 2026-10-11 with the A.1 and C.1 variants; every name is in
`shared/labels.js`, written both ways so the two conventions can be compared on the same pages.

## The problem

The first variants named datasets in two parts, a short role under a heading:

    INCOME TAXES, PEOPLE AND COMPANIES
      Individuals, monthly         ← only makes sense under the heading
      Individual income taxes      ← the database name, in grey

"Individuals, monthly", "Yearly", "Top fifth" and "Share of the economy" mean nothing once the series
leaves its list: in a chip, a legend or the cursor card there is no heading above it. Database names
have the opposite problem: "Total receipts (monthly)", "Average federal tax rate, Highest quintile",
"Unemployment rate, Black or African American, 16 years and over" are correct but read like a table
column.

## Rules (both conventions)

1. **One name per dataset, used everywhere.** No short form for lists and long form for charts; the
   name in the legend is the name you searched for.
2. **The name stands alone.** It must make sense with no heading, topic or neighbour beside it. Group
   headings ("Tax rates and who pays") help you browse; they never complete a name.
3. **The reader's words, not the publisher's.** "Federal Revenue", not "receipts"; "Corporate Income
   Taxes", not "Corporation income taxes"; "Tariff Revenue", not "Customs duties"; "Pump Price", not
   "retail"; "Taxes Withheld from Paychecks", not "withheld income and employment taxes". A publisher's
   term stays when it is the term the news uses: Federal Funds Rate, Consumer Price Index, GDP,
   Treasury Yield, Quintile. The publisher's own title is still shown, verbatim, in About the data.
4. **Acronyms are spelled out or explained once:** "Consumer Price Index (CPI)", "U.S. Crude Oil Price
   (WTI)", "Broad Unemployment Rate (U-6)". GDP needs neither.
5. **Say how often only when it tells two datasets apart.** "Monthly Federal Revenue" and "Yearly Federal
   Revenue" both exist, so the name says which; the unemployment rate is only monthly, so its name
   doesn't (the frequency badge does). Fiscal years are "Yearly" in the name and FY on the badge.
6. **Say the unit only when it changes the meaning:** "as a Share of GDP", "Index", "Annualized" (BEA's
   quarterly and monthly values at a yearly pace). Not "in millions of dollars" or "percent"; the axis
   says that.
7. **Signs the reader could misread are in the name.** Treasury's monthly figure is a "Federal Deficit"
   (a deficit is positive); OMB's yearly figure is a "Federal Budget Balance" (a deficit is negative).
   The same goes for "Trade Balance".
8. **Groups of people are named as people,** in the words the news uses: "for Black Workers", "for
   Women", "for College Graduates", "for Teenagers (16–19)". The exact BLS definition (16 and over,
   25 and over, Hispanic of any race) goes in the description.
9. **No publisher in the name,** unless two publishers print the same measure differently and both are
   offered; then it goes in brackets at the end ("Home Price Index (FHFA)"). Otherwise the source sits
   beside the name in its own place.
10. **Title Case,** as the names of things: "Average Federal Tax Rate". Short words stay lower case
    (of, the, at, for, as, a, by, from).
11. **No stray parentheses from the database:** "(monthly)", "(daily)" go.
12. **About 50 characters at most.** A longer name is a sign the qualifier belongs in the description
    (“Core Consumer Price Index”, with “without food and energy” in the description). The machine limit is
    80 since 2026-10-15 (it was 60): the national accounts' quarterly lines need “Quarterly … (Annualized)”
    and an inflation-adjusted form around the item (user).

Roles like "the one in the news" are a tag beside the name, not part of it.

## Two conventions to choose between

**x.1.1 — Reads as a phrase.** The name is what you would say aloud.

| | |
| --- | --- |
| Monthly Individual Income Taxes | Average Federal Tax Rate of the Highest Quintile |
| Federal Revenue as a Share of GDP | Unemployment Rate for Black Workers |
| Regular Gas Price at the Pump | U.S. Crude Oil Price (WTI) |
| 10-Year Treasury Yield | National Debt Held by the Public |

Good for legends and the cursor card, where it reads like a sentence. Lists sort poorly: the monthly
and yearly versions of one measure sit apart ("Monthly …", "Yearly …").

**x.1.2 — Measure: detail.** The measure first, then what narrows it, after a colon.

| | |
| --- | --- |
| Individual Income Taxes: Monthly | Average Federal Tax Rate: Highest Quintile |
| Federal Revenue: Share of GDP | Unemployment Rate: Black Workers |
| Pump Price: Regular Gasoline | Crude Oil Price: U.S. Benchmark (WTI) |
| Treasury Yield: 10-Year | National Debt: Held by the Public |

Good for lists and search: versions of one measure line up and sort together, and a narrow chip can cut
the detail first. A measure with only one version has no colon ("Federal Funds Rate", "Consumer
Sentiment"). Reads less naturally in a sentence ("…the Treasury Yield: 10-Year rose…").

A mix is possible: measure-first in lists (catalogue, search, lanes) and the phrase in the chart
(legend, cursor card). It breaks rule 1, so it is not offered yet.

## In the app (2026-10-11)

"Reads as a phrase" was chosen. Every series' name is written in `server/lib/economic-series.js` and stored
in `economic_series.name`; `server/lib/series-names.js` checks the rules a machine can check (Title Case,
no "(monthly)", the ’ apostrophe, at most 80 characters (60 until 2026-10-15), no name used twice) and `load-economic-series.js`
refuses to store names that break them. `--names-only` updates names without reading the data files. The
client shows the stored name everywhere; `ECONOMY_TABS` names only pairs (two series offered as one choice).
Two rules were added in use: a series the publisher split in two at a redesign says its years in brackets
("Daily Excise Taxes (Since 2023)", "(2005–2023)"), and BEA's values at an annual rate say "(Annualized)".

## At scale: the national accounts (2026-10-15)

Phase 5 of the Statistical Abstract loads whole publisher tables, about 2,400 NIPA series at first, too many to
name one by one. Their names are generated (`server/lib/nipa-series.js`) and overridden by hand where the result
reads badly (user: "hand overrides but retain original names as well"):

- The line's label in the reader's words (a short list of replacements: "GDP", "consumer spending"), in Title
  Case, inside its measure's or table's template ("Spending on {B}", "Employee Compensation in {B}").
- Hand names, by BEA code stem, in `server/seed/data/nipa-names.json`: the part standing for the line, written
  once for its dollars, chained dollars, price index and growth rate; or a whole name (`{ "name": … }`).
- The form: "Inflation-Adjusted …" for chained dollars, "Price Index for …", "… Growth Rate (Adjusted for
  Inflation)", "… per Person". Where a name would pass 80 characters at either frequency, "Real …" and "… Real
  Growth Rate" are used for that line at both.
- Frequency: "Yearly …" and "Quarterly … (Annualized)", since BEA prints both. A line already loaded by hand at
  one frequency keeps its name; its other frequency is named after it ("GDP (Annualized)" → "Yearly GDP").
- Names that still collide are told apart by the line they sit under ("Parent: Line"), then by table; none do now.
- The publisher's own words are kept: `publisher_title` is the table's title, the line number and BEA's label
  ("Table 2.1. Personal Income and Its Disposition, line 10: Farm (Current Dollars, Level)").
