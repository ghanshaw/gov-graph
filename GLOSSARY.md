# Glossary

The words GovGraph uses for its data, in code and on screen. Agreed 2026-10-13.

The levels, top to bottom: **publisher → program (or collection) → file → series**. A series has one **measure**
and, through it, one **category** in each **taxonomy**.

## Where data comes from

| Term | Meaning | Example | In GovGraph |
|---|---|---|---|
| **Sources** | The list of everyone whose data GovGraph uses (governments, international bodies, universities, industry) and what each publishes: publishers, their history, programs and collections, terms, how each is fetched, the files downloaded | the Sources page | `server/seed/data/sources.json` (written by hand), the `source_*` tables, `/sources` |
| **Publisher** | The organization that puts the numbers or documents out. FRED calls this the *source*. | BEA, BLS, the Census Bureau, Freddie Mac, GPO | `source_organizations`, with kind (federal, international, academic, …), parent and lineage |
| **Program** | The ongoing survey or accounting system that produces statistics | the Current Population Survey; the National Income and Product Accounts; the Consumer Price Index; Debt to the Penny | `source_programs` (kind `statistics`), `/sources/<program>` |
| **Collection** | A program's counterpart for documents: a body of documents published together | the Federal Register; govinfo's bill status files; Supreme Court slip opinions; the U.S. Code | `source_programs` too (kind `documents`); govinfo's own word |
| **Release** | One scheduled publication of a program's numbers; one release can draw on several programs | "The Employment Situation" (CPS and the payroll survey); "GDP, Advance Estimate"; the Fed's H.15 | Not modelled |
| **File** | What is downloaded; usually holds many series | `NipaDataQ.txt`, `ln.data.1.AllData`, the H.15 zip, `12s0973.xls` | `source_files`; kept in the data folder at the publisher's own path |

## What is shown

| Term | Meaning | Example | In GovGraph |
|---|---|---|---|
| **Series** | One thing measured over time, in one unit, at one frequency: a date and a value per row, as a CSV | Real GDP, quarterly, from 1947 (FRED's GDPC1); the unemployment rate of Black women | `economic_series`; what the catalogue lists and the timeline draws |
| **Measure** | One thing measured, in one place: it sits in one category of the Statistical Abstract, and its series always follow it. Names may repeat; the place tells two apart, so where the Abstract prints series in two subsections they are two measures | "Consumer prices" under Consumer Price Indexes (the CPI) and "Consumer prices" under Price Indexes (the PCE index); GDP (current dollars, real, growth) | `MEASURES` in `server/lib/series-dimensions.js` (keyed by place and name: `prices/price-indexes/consumer-prices`); every series has exactly one. In another taxonomy, measures of the same name in one category are shown as one |
| **Dimension** | One way series of a measure differ: the form printed in (level, rate, index, adjusted for inflation), a breakdown (sex, race, age, education, place), frequency | "Adjusted for inflation"; "Women" | `series-dimensions.js`; the catalogue's Build mode narrows a measure by them |
| **Publisher title** | The publisher's own name for a series, read from its files; GovGraph's name and description are written apart from it | "Real Gross Domestic Product" | `economic_series.publisher_title` |

## How it is organised

| Term | Meaning | Example | In GovGraph |
|---|---|---|---|
| **Taxonomy** | An official hierarchy of categories, used as published | the Statistical Abstract; the Comparative Agendas Project's topics | `server/seed/data/taxonomies/<id>.json`, `/taxonomies` |
| **Category** | Any node of a taxonomy, at any level. "Construction and Housing → Home sales" is a path through two categories, parent to child | Construction and Housing; Home sales; CAP 1803 Exports | a node in its taxonomy's file. Its id never changes once made, even if its name does |
| **Section** | A top-level category of the Statistical Abstract: one of its 30 numbered chapters | 20. Construction and Housing | the category's `code` is the section number |
| **Subsection** | A category inside an Abstract section: one of the groups the Census website lists the section's tables under, every online table in exactly one (the book's contents only point at selected topics, which do not divide the tables). Where series are placed | Housing Sales; Mining, Mineral Industries | no code; ordered by their first table |
| **Placement** | Where a measure sits in a taxonomy, and how that was decided; its series follow it | Consumer prices → Price Indexes, by Table 739 | `server/seed/data/placements.json`, one per measure per taxonomy |
| **Evidence** | Why a placement is where it is: `table` when an Abstract table prints the series' own data, from the same publisher (by number; the table must be printed in that category), else `judgement` (a sentence saying why, naming the nearest table where there is one) | "Table 667"; "Table 1197 prints a 30-year mortgage rate, but from Bankrate, not Freddie Mac" | `basis`, `tables`, `reason` on a placement |
| **Table** | A printed grid: slices of series for chosen years. The Abstract's tables are evidence and the shopping list, never shown as data | Abstract Table 973; NIPA Table 1.1.6; OMB Historical Table 1.1 | `server/seed/data/statistical-abstract-tables.json` (number, page, category, source note) |

The Comparative Agendas Project calls its levels *major topic* and *subtopic*; each taxonomy keeps its own level names
(`levels` in its file), and *category* is the word for any of them.

## Words to avoid

- **Dataset**: publishers use it for whole collections (data.gov, the Census API's `acs/acs1`), so it is ambiguous.
  Say *series* for one measured thing over time, *program* or *collection* for what a publisher runs, *file* for a
  download.
- **Source** (one): not a level. Say *publisher* or *program*. *Sources* (plural) is the whole list, above.
- **Source note**: the line under a printed table naming where its numbers came from ("Source: U.S. Census Bureau,
  New Residential Sales"). It points to a program; it is not one.
- **Registry**: suggests something was registered or made official. Say *sources*.
- **Structure** (for a taxonomy): too general. A document's parsed `structure` (sections → items) is unrelated.
