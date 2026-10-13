# Economic Data

## Status
In Progress

## Goal
Show economic series beside the documents: what prices and jobs were doing when an order was
signed, a law enacted or a decision handed down. Oil prices first, then unemployment.

## Decisions
- No series computed by GovGraph (2026-10-10): only what publishers print. Removed `inflation`,
  `inflation-core`, `inflation-pce`, `inflation-pce-core`, `spending-real-growth`, `price-to-income`,
  `mortgage-burden`, `debt-gdp-total`, `debt-gdp-public` (code, API field `computedFrom`, rows).
  The Done entries below that mention them are history.
- "Oil price" in the news means a crude benchmark per barrel: WTI (U.S., Cushing OK) or Brent
  (international). What people feel is retail gasoline and diesel per gallon. We keep both kinds.
- Sources: EIA API v2 (`EIA_API_KEY`) for oil and fuel; BLS Public Data API for unemployment (no
  key needed: 10 years a request, 25 requests a day; 1948 to now is 8). Both are the original
  publishers; FRED republishes the same series.
- Monthly series are dated by the month's 1st and never resampled to weeks (the server ignores a
  resample finer than the series). A month the publisher has no value for is a gap in the line.
- Series to keep are listed in `server/lib/economic-series.js` (slug, EIA route and series id,
  frequency, unit). The tables are general (`economic_series`, `economic_observations`), so later
  series (CPI, unemployment, …) need no schema change.
- Downloads mirror the API path in the data directory
  (`api.eia.gov/v2/petroleum/pri/spt/RWTC-daily.json`, 6.5 MB for all four). Each fetch takes the
  whole series again, since EIA revises recent values; the loader replaces a series' observations.
- Values are nominal dollars. Inflation adjustment waits for a CPI series.

## Series (as of 2026-10-09)
| Slug | EIA id | Frequency | From | Rows |
|---|---|---|---|---|
| `wti-spot` | RWTC | daily | 1986-01-02 | 10,264 |
| `brent-spot` | RBRTE | daily | 1987-05-20 | 9,993 |
| `gasoline-retail` | EMM_EPMR_PTE_NUS_DPG | weekly | 1990-08-20 | 1,880 |
| `diesel-retail` | EMD_EPD2D_PTE_NUS_DPG | weekly | 1994-03-21 | 1,699 |
| `demand-{total,distillate,gasoline,jet}-4wk` | EIA WRPUPUS2, WDIUPUS2, WGFUPUS2, WKJUPUS2 (EIA's own four-week averages) | four-week-average | 1990-12 / 1991-03 | ~1,860 each |
| `demand-{total,distillate,gasoline,jet}-monthly` | EIA MTTUPUS2, MDIUPUS2, MGFUPUS2, MKJUPUS2 | monthly | 1963 / 1945 / 1945 / 1965 | 739–979 |
| `unemployment-rate` | BLS LNS14000000 (U-3) | monthly | 1948-01 | 944 |
| `unemployment-u6` | BLS LNS13327709 (U-6) | monthly | 1994-01 | 392 |
| `unemployed-persons` | BLS LNS13000000 (thousands) | monthly | 1948-01 | 944 |
| `unemployment-rate--<group>`, `unemployed-persons--<group>` | BLS LNS14… / LNS13… (bulk `ln`), 43 groups each: sex, race and ethnicity, race × sex, age, age × sex, age × race (× sex) for 16–19, education | monthly | 1948–2003 | 284–944 |

| `gdp`, `gdp-real`, `gdp-growth` | BEA A191RC, A191RX, A191RL | quarterly | 1947 | 318 |
| `debt-total` | Treasury Debt to the Penny | daily | 1993-04-01 | 8,410 |
| `debt-public` | Treasury Debt to the Penny | daily (sparse to 2005) | 1997-09-30 | 5,452 |

| `cpi`, `cpi-core` | BLS CUUR0000SA0, CUUR0000SA0L1E (bulk `cu` files) | monthly | 1913, 1957 | 1,363, 835 |

| `pce-price`, `pce-price-core` | BEA DPCERG, DPCCRG (monthly file) | monthly | 1959 → 1960 | 812, 800 |
| `spending`, `spending-real` → `spending-real-growth` | BEA DPCERC, DPCERX | monthly | 1959; real 2007 | 812, 236, 224 |
| `sentiment` | Univ. of Michigan ICS_ALL (CSV) | monthly (sparse to 1978) | 1952-11 | 677 |

| `mortgage-rate` | Freddie Mac PMMS 30-year | weekly | 1971-04 | 2,898 |
| `house-prices` | FHFA HPI, U.S. purchase-only SA | monthly | 1991-01 | 427 |
| `homeownership` | Census HVS Table 14 | quarterly | 1964 | 250 |
| `household-income`, `household-income-real` | Census CPS ASEC Table H-5 | annual | 1967 | 59 |
| `covid-deaths`, `deaths-vs-expected` | CDC NCHS r8kw-7aab (weekly, U.S.) | weekly | 2019-12-29 | 345 |
| `fed-funds`, `treasury-10y`, `treasury-2y`, `prime-rate` | Fed H.15 (whole release) | daily | 1954, 1962, 1976, 1955 | 26,398 … |
| `fed-target-lower`, `fed-target-upper` | Fed Open Market Operations pages | irregular (each change) | 1990-07 | 110 |
| `home-price` | Census API, New Residential Sales (median, new houses) | monthly | 1963-01 | 764 |
| `hoam-share`, `hoam-index` | Atlanta Fed HOAM national workbook (`HOAM_US_Affordability_Index.xlsx`), columns "Annual Payment Share of Income", "Affordability Index" | monthly | 2005-01 | 259 each |

October 2025 has no value in the BLS series (not collected during the lapse in appropriations).

## Running
    node --env-file=server/.env server/seed/fetch-economic-series.js [--series wti-spot]
    node --env-file=server/.env server/seed/load-economic-series.js [--series wti-spot] [--dry-run]

## Done
- [x] Names (2026-10-11): every series renamed to read as a phrase (`design/timeline-data/NAMING.md`), in
  `server/lib/economic-series.js`, checked by `server/lib/series-names.js` (the loader refuses bad names; test
  `series-names.test.js`); stored with `load-economic-series.js --names-only`. The client shows the stored name
  everywhere (`useSeriesList.js`); `ECONOMY_TABS` keeps names only for pairs, whose legends now use the series' names
- [x] Several series at once: chosen above the chart (chips, and a panel of every series by group, up to 8 lines);
  dollars for the same period and same-unit series share a chart, others are stacked with the same dates; a table of
  each line's latest, year's change, high and low. Group headings lead with how often ("Monthly gross and refunds"),
  publisher apart; pair choices read "gross vs. refunds", "exports vs. imports" (2026-10-11)

- [x] Trade & tariffs tab (2026-10-11): 41 series. Customs duties from USITC (1891 on, plus duties as a percent of all and of
  dutiable imports, and imports for consumption; PDF via the Internet Archive), OMB Table 2.5 (FY 1940), BEA (yearly 1929,
  quarterly 1959), Monthly Treasury Statement (net, gross, refunds) and the Daily Treasury Statement's three customs lines
  (2005–2020, 2020–2025, from Nov 2025). Exports, imports and balances from Census FT-900 history (monthly 1992, yearly 1960)
  and BEA (quarterly 1947, yearly 1929), with exports-against-imports pairs. Customs also listed on the tax tabs. Timeline draws
  any `compare` pair as two lines. BEA annual file now read (`frequency: 'annual'`); unit `$k` added. Fetch of a line-filtered
  Fiscal Data dataset now always asks for every line kept, so fetching some series no longer drops the others' lines.
- [x] EIA key in `server/.env`; series list and table schema (`server/lib/economic-series.js`)
- [x] `fetch-eia-series.js` (now `fetch-economic-series.js`): all four series downloaded (2026-10-09)
- [x] `load-economic-series.js`: tables created and all four loaded, 23,836 observations, 1.6 MB
  (6 gasoline weeks in 1990 have no value) (2026-10-09)
- [x] GraphQL (`server/economic.js`): `economicSeriesList`, `economicSeries(slug)` with
  `observations(from, to, resample: week | month | year)` (averages, dated by the period's first day)
- [x] `/timeline`: price band under the events on the same time axis, chosen in the rail ("Prices":
  WTI by default, Brent, gasoline, diesel, none), weekly averages, hover shows the week's value;
  colour token `--economic`
- [x] "Economic Data" in the top nav → `/economy/:tab` (`Economy.jsx`), tabs under the title
  (`.page-tabs`; one tab, Oil). Oil: series and period in the rail (kept in the URL,
  `?series=brent-spot&period=all`), facts row (latest, change over a year, high and low in the
  period), line chart with hover (`PriceChart.jsx`, d3 scales), EIA source and link. Periods of 10
  years and more are weekly averages; default is the last 10 years
- [x] Timeline cursor (2026-10-10): one vertical line across the event lanes and the price band
  at the pointer's date, snapping to an event within 8px; every event it passes through (either
  side of the axis) and the price that week are highlighted, and one card lists them (date,
  price, up to six events). Clicking a highlighted dot opens its page. Replaces the per-dot tooltip
- [x] Unemployment (2026-10-10): BLS as a second source (`fetch-economic-series.js`, reader per
  publisher in `lib/economic-series.js`), three series loaded; Unemployment tab on `/economy`
  (rate, U-6, unemployed persons; change over a year in percentage points for rates); gaps break
  the line; unemployment rate offered under the timeline ("Economy" in the rail); value and date
  printing by unit and frequency in `client/src/economy.js`
- [x] BLS bulk files (2026-10-10): `fetch-bls-bulk.js --survey <code>` mirrors a whole survey folder
  (needs `BLS_CONTACT_EMAIL`; BLS refuses scripted requests without a contact). `ln` (Current
  Population Survey) downloaded: 421 MB, 68,626 series, 9.3 million values, 1940–2026. Not loaded
- [x] GDP & Debt (2026-10-10): BEA flat files and Treasury Debt to the Penny (no keys), debt-to-GDP
  computed in the loader (quarter-end debt / that quarter's GDP at an annual rate; total from 1993,
  held by the public from Q3 2001 because Treasury reports it yearly before then). Tab on
  `/economy`; real GDP growth and debt-to-GDP offered under the timeline. The line now breaks only
  where a gap is unusual for that stretch of the series (`gapBreaks`), so the sparse early debt
  figures draw as a line and the missing BLS month still breaks
- [x] Inflation (2026-10-10): `cu` survey downloaded whole (172 MB); CPI and core CPI read from its
  topic files (`bls-bulk` source; `cu.data.0.Current` starts in 1997), inflation computed as the
  12-month change to one decimal as BLS reports it (checked: 14.8% Mar 1980, 9.1% Jun 2022, 3.0% Sep
  2025). October 2025 index missing, so no figure for Oct 2025 or Oct 2026. Inflation tab and
  timeline option
- [x] Consumers and PCE (2026-10-10): BEA monthly file added to the BEA download; consumer spending
  (current dollars from 1959, real from 2007 as BEA's monthly tables have it) and its 12-month real
  growth; PCE and core PCE inflation on the Inflation tab; University of Michigan consumer sentiment
  (Conference Board confidence is licensed, not used). Consumers tab; sentiment and real spending
  growth offered under the timeline
- [x] Housing affordability (2026-10-10): `CENSUS_API_KEY`; New Residential Sales saved whole
  (`ressales.json`, 0.9 MB, key not stored); median new-home price; price-to-income (annual) and
  mortgage payment share of income (monthly; months after the latest income year use that year's
  income). Checked: 54% at the 1981 rate peak, under 20% in 2012 and 2021, 35% in Oct 2023
- [x] Atlanta Fed Home Ownership Affordability Monitor (2026-10-10): national workbook (no key),
  ownership cost share of income (stored as a percent) and affordability index, on the Housing tab
  beside our own measure. HOAM counts existing homes (Zonda), 10% down, PMI, taxes and insurance, so it
  runs well above ours: 43.9% vs 27.3% in July 2026, 25.6% vs 19.7% in January 2012. Metro and county
  workbooks (`HOAM_CBSA_Data.xlsx`, `HOAM_County_Data.xlsx`) not loaded
- [x] Unemployment by demographics (2026-10-10): 20 published BLS rates (race and ethnicity, sex,
  race × sex, age, education), seasonally adjusted, read from the downloaded `ln` survey
  (`ln.data.1.AllData`, scanned once for every series it holds). Unemployment tab grouped under
  All / By race and ethnicity / By sex / By age / By education; on the timeline through `ECONOMY_TABS`.
  Refresh: `fetch-bls-bulk.js --survey ln`, then load the `unemployment-*` series
- [x] Breakdown buttons on the timeline (2026-10-10), replacing the 20 demographic series in the
  picker: choose the unemployment rate or unemployed persons, then press buttons above the range
  slider (Sex, Race and ethnicity, Age, Education). Several in one row → a line each; across rows
  they combine (Black + Women = Black women). Only combinations BLS publishes are drawn; others are
  listed as not published, and a button that would draw nothing is disabled. Up to 8 lines, colours
  `--cat-1…8` kept per group while shown; the total is a dashed grey line. Table of groups:
  `UNEMPLOYMENT_GROUPS` in `lib/economic-series.js` (86 series); API `EconomicSeries.breakdowns`,
  `economicSeriesSet(slugs)`; `BreakdownBar.jsx`. Hispanic men and women are published for 20 and over only
- [ ] Check the breakdown buttons in Chrome (extension disconnected when built)
- [ ] Breakdown buttons on the Economic Data page (it shows only the totals now)
- [ ] Existing-home prices: NAR's median is licensed; FHFA's index has no dollar level
- [ ] FOMC target before 1990 (the Fed's tables start in July 1990; targets were announced from 1994)
- [ ] Check the Interest rates tab and band in Chrome (extension disconnected)
- [ ] World oil demand: EIA Short-Term Energy Outlook (IEA's figures are licensed)
- [ ] Real consumer spending before 2007: quarterly (`NipaDataQ.txt`, DPCERX from 1947)
- [ ] Published replacements for the removed series: inflation rates and debt-to-GDP as publishers
  print them (BLS 12-month percent changes, BEA percent-change tables, OMB Historical Tables 7.1
  for debt-to-GDP by fiscal year from 1940)
- [ ] Decide how to store whole surveys (goal: chart every series). Proposal: every series in
  `economic_series` with its codes as dimensions (from the code lists); values as arrays, one row
  per series, not one row per value; a browse page per survey with filters from the code lists.
  Measure database size before loading
- [ ] Download `cu` (consumer prices) and `ce` (payrolls); check `la` (local areas) size first
- [ ] Check the Unemployment tab and timeline band in Chrome (extension disconnected)
- [ ] Check the timeline cursor in Chrome (extension was disconnected when it was built)
- [x] Checked in Chrome (2026-10-09): all four series, each period, hover near both edges, 500px
  window (no sideways scroll, facts wrap to two rows), timeline band under the events

- [x] Timeline offers every series (2026-10-10), grouped as the Economic Data tabs (one list,
  `ECONOMY_TABS` in `client/src/economy.js`, used by both pages); each group opens from its heading,
  the current one open, a closed one showing its chosen series

- [x] Housing (2026-10-10): Freddie Mac mortgage rate, FHFA house price index, Census homeownership
  rate and median household income (current and 2025 dollars), read from Census .xlsx tables by
  `server/lib/xlsx.js`. Housing tab; on the timeline through `ECONOMY_TABS`

- [x] Health (2026-10-10): CDC weekly COVID-19 deaths and all deaths as a percent of expected, the
  CSV kept whole; the eight weeks before each release are left out (incomplete counts). Health tab

- [x] Interest rates (2026-10-10): whole H.15 release and the FOMC target-change pages saved; fed
  funds effective rate with the target range drawn as a stepped band (`band` on the tab's series;
  `stepBand` in `client/src/economy.js`), 10- and 2-year Treasury yields, prime rate. 109 target
  changes on the timeline as `fomc` events ("Fed −0.25"), below the axis with the Court. The Fed is
  retiring its Data Download Program (notice in the file): the H.15 download may move
- [x] Band scale fitted to the data (up to six round gridlines, zero not forced; zero line darker)

- [x] Provenance (2026-10-10): `description` is always GovGraph's (EIA's four replaced by our own);
  `publisher_title` / `publisher_title_from` read verbatim from the publishers' files (25 of 41 series;
  none for Freddie Mac, FHFA, Michigan, the Census API, or computed series); `computedFrom` in the API.
  Treasury's field labels and CDC's dataset metadata are now saved with their downloads

- [x] Oil demand (2026-10-10): EIA "product supplied" in thousand barrels per day for all petroleum,
  distillate (diesel), gasoline and jet fuel; EIA's own four-week averages (frequency
  `four-week-average`, dated by the last week's end) and the monthly series. Oil tab split into
  Prices and Demand (`group` on a tab's series, `seriesGroups`); on the timeline through the picker

- [x] Period slider (2026-10-11): two handles under the facts, spanning the series' own first to last
  month (`RangeSlider.jsx`; drag, or arrow keys / Page Up-Down). The Period presets move the
  handles; dragging clears the preset and keeps the range in the address (`?from=2012-03&to=2019-08`).
  A custom range longer than five years is shown as weekly averages, like the long presets

- [x] Taxes (2026-10-11): federal revenue from every publisher found, each value stored as printed in
  its own unit (no rescaling, adjusting or joining; customs duties left for the tariff work). 82 series,
  three tabs on `/economy`:
  - **Tax revenue** (`tax-revenue`): BEA NIPA Table 3.2, quarterly at annual rates, `$m` (7 lines: current
    receipts, tax receipts, personal, corporate, excise, rest of the world, social contributions);
    Treasury Monthly Treasury Statement Table 9, monthly in dollars from March 2015 (9 receipt lines);
    Daily Treasury Statement tax deposits, `$m`, as two sets that are not joined: Table II's nine
    "Taxes - …" lines from 2023-02-14 and Table IV's seven from 2005-10 to 2023-02-13. Daily
    deposits are never averaged into weeks (`asPublished` on the tab's series, on the page and the
    timeline) and have no "over a year" change
  - **Revenue since 1934** (`tax-history`): OMB Historical Tables (FY 2027 Budget) 1.1, 1.2, 2.1–2.5:
    totals, five sources in dollars, as shares and as percents of GDP, payroll and excise detail, estate
    and gift, Federal Reserve deposits. New frequency `fiscal-year`, dated by the year's first day
    (July 1 to FY 1976, October 1 after; the 1976 transition quarter is its own value, "TQ 1976").
    Estimate rows not loaded; "*" (too small to show) left blank
  - **Tax rates** (`tax-rates`): CBO, The Distribution of Household Income, 2022: average federal tax
    rate and share of federal taxes for ten income groups, 1979–2022 (cbo.gov refuses scripts; the
    file is the Internet Archive's capture, `archive` on the series). IRS SOI Historical Table 23:
    lowest and highest bracket rates and where the top bracket starts, 1913–2018 (footnote marks such
    as "[24] 70.0" are not part of the value)
  - `lib/xls.js` reads old binary .xls (checked against xlrd: every cell of Tables 23 and 24 agrees);
    `lib/xlsx.js` reads a named tab (`readXlsx(file, sheet)`). New unit `$m`; dollar amounts too long
    to read are printed in words ("$360.03 billion"). Tab row on `/economy` now wraps instead of
    scrolling with a hidden scrollbar

- [x] Inflows against outflows (2026-10-11), 56 more series, every side and every difference as its
  publisher prints it (nothing computed):
  - **Refunds** (Tax revenue tab): Monthly Treasury Statement Table 4, gross receipts and refunds for all
    receipts, individual, corporate, excise, estate and gift, social insurance (`treasury-mts-4`, field
    in `field`); Daily Treasury Statement refunds paid electronically (Table II withdrawals,
    `withdrawal`): individual and business 2012–Feb 2023 and from Feb 2023, Economic Impact Payments
    (Dec 2020–Sep 2022) and the advance Child Tax Credit (Jul 2021–Sep 2022)
  - **Receipts & outlays** tab (`budget`): OMB Tables 1.1/1.2 outlays and surplus or deficit (dollars,
    percent of GDP); BEA Table 3.2 total receipts, total expenditures (1959 on) and net lending or
    borrowing; Treasury Table 9 total outlays and 19 functions, Table 1's monthly deficit
    (`treasury-mts-1`, from each month's own statement; later ones revise slightly). Signs as printed:
    OMB and BEA negative for a deficit, Treasury positive
  - Pairs: a tab item with `compare: { inflow, outflow, inflowLabel, outflowLabel }` draws both series
    on one chart (`PriceChart` `compare`), the space between shaded in the colour of the higher line
    (`--outflow` token for the second line); facts give each side's latest value and year's change,
    uncoloured; the rail lists both sources. Pairs are not offered on the timeline (their series are) — superseded 2026-10-11: the timeline draws pairs as two lines

## Todo

- [ ] Check the Trade & tariffs tab and the timeline's exports/imports pair in Chrome (extension was not connected).
- [ ] Customs duties before 1891 (Census, Historical Statistics of the United States) — no machine-readable government file found.
- [ ] Taxes: IRS Table 24 (corporate brackets by period, 1909–2010) is downloaded but not shown; it
  would need a table view, not a chart
- [ ] Taxes: CBO's other columns (individual income, payroll, corporate, excise rates by group) and
  Table 7 (taxes in 2022 dollars) are in the file but not loaded
- [ ] Taxes: the other series in this section still rescale (BEA and Treasury debt to billions); the
  tax series do not
- [ ] Refined products wholesale (NY Harbor / Gulf Coast gasoline, diesel, jet fuel spot) if wanted
- [ ] CPI (BLS or FRED) for inflation-adjusted prices
- [ ] Keeping it current: re-run fetch + load weekly
