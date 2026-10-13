// Printing economic series (Economy.jsx, PriceChart.jsx, the timeline's band): values by unit,
// dates by how often the series is published, and where each publisher shows a series.

import { shortDate } from './dates';

const MONTH = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

// Dollar amounts too long to read whole are printed in words; the value stored is the publisher's.
function dollarsInWords(dollars) {
  const sign = dollars < 0 ? '−' : '';
  const n = Math.abs(dollars);
  if (n >= 1e12) return `${sign}$${(n / 1e12).toFixed(2)} trillion`;
  if (n >= 1e9) return `${sign}$${(n / 1e9).toFixed(2)} billion`;
  if (n >= 1e6) return `${sign}$${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1)} million`;
  return `${sign}$${Math.round(n).toLocaleString()}`;
}
const dollarsTick = dollars => {
  const n = Math.abs(dollars);
  const [d, s] = n >= 1e12 ? [1e12, 'T'] : n >= 1e9 ? [1e9, 'B'] : n >= 1e6 ? [1e6, 'M'] : n >= 1e3 ? [1e3, 'k'] : [1, ''];
  return `${dollars < 0 ? '−' : ''}$${+(n / d).toFixed(2)}${s}`;
};

/**
 * 96.24 '$/bbl' → "$96.24"; 4.2 '%' → "4.2%"; 7109 'thousands' → "7.11 million"; 32563 '$bn' → "$32.56 trillion";
 * 3760747 '$m' → "$3.76 trillion"; 263994460 '$k' → "$264 billion"; 360032735841.42 '$' → "$360.03 billion".
 */
export function formatValue(value, unit) {
  if (value === null || value === undefined) return '—';
  if (unit === '$bn') return value >= 1000 ? `$${(value / 1000).toFixed(2)} trillion` : `$${value.toFixed(1)} billion`;
  if (unit === '$m') return dollarsInWords(value * 1e6);
  if (unit === '$k') return dollarsInWords(value * 1e3);
  if (unit === '$' && Math.abs(value) >= 1e8) return dollarsInWords(value);
  if (unit?.startsWith('$')) return `$${value.toFixed(2)}`;
  if (unit === '%') return `${value.toFixed(1)}%`;
  if (unit === 'thousands') return value >= 1000 ? `${(value / 1000).toFixed(2)} million` : `${Math.round(value).toLocaleString()},000`;
  if (unit === 'index') return value.toFixed(1);
  if (unit === '$') return `$${Math.round(value).toLocaleString()}`;
  if (unit === 'x') return `${value.toFixed(1)}×`;
  if (unit === 'deaths') return `${Math.round(value).toLocaleString()} deaths`;
  // Demographic counts (lib/population/series.js): whole people, households, seats.
  if (unit === 'people' || unit === 'households') return Math.abs(value) >= 1e6 ? `${(value / 1e6).toFixed(1)} million` : Math.round(value).toLocaleString();
  if (unit === 'seats') return `${value} ${value === 1 ? 'seat' : 'seats'}`;
  if (unit === 'years') return `${value.toFixed(1)} years`;
  if (unit === 'gini') return value.toFixed(3);
  if (unit === 'kb/d') return value >= 1000 ? `${(value / 1000).toFixed(2)} million barrels/day` : `${Math.round(value).toLocaleString()},000 barrels/day`;
  return value.toLocaleString();
}

/** An axis label: shorter than formatValue. */
export function formatTick(value, unit) {
  if (unit === '$bn') return value >= 1000 ? `$${+(value / 1000).toFixed(2)}T` : `$${value}B`;
  if (unit === '$m') return dollarsTick(value * 1e6);
  if (unit === '$k') return dollarsTick(value * 1e3);
  if (unit === '$' && Math.abs(value) >= 1e6) return dollarsTick(value);
  if (unit === '%') return `${value}%`;
  if (unit === '$') return value >= 1000 ? `$${value / 1000}k` : `$${value}`;
  if (unit === 'x') return `${value}×`;
  if (unit === 'deaths') return value >= 1000 ? `${value / 1000}k` : String(value);
  if (unit === 'people' || unit === 'households') {
    const a = Math.abs(value);
    return a >= 1e6 ? `${+(value / 1e6).toFixed(2)}M` : a >= 1e3 ? `${+(value / 1e3).toFixed(1)}k` : String(value);
  }
  if (unit === 'kb/d') return value >= 1000 ? `${+(value / 1000).toFixed(2)}M` : `${value}k`;
  if (unit === 'thousands') return value >= 1000 ? `${value / 1000}M` : `${value}k`;
  return unit === '$/gal' ? value.toFixed(2) : String(value);
}

/** The change from `before` to `after`: percentage points for a rate, percent otherwise. */
export function formatChange(before, after, unit) {
  if (unit === '%') {
    const pts = after - before;
    return `${pts > 0 ? '+' : pts < 0 ? '−' : ''}${Math.abs(pts).toFixed(1)} pts`;
  }
  // Seats, ages and the Gini index change by amounts, not by percent.
  if (unit === 'seats' || unit === 'years' || unit === 'gini') {
    const d = after - before;
    const sign = d > 0 ? '+' : d < 0 ? '−' : '';
    if (unit === 'seats') return `${sign}${Math.abs(d)} ${Math.abs(d) === 1 ? 'seat' : 'seats'}`;
    return unit === 'years' ? `${sign}${Math.abs(d).toFixed(1)} years` : `${sign}${Math.abs(d).toFixed(3)}`;
  }
  const pct = ((after - before) / Math.abs(before)) * 100;
  return `${pct > 0 ? '+' : pct < 0 ? '−' : ''}${Math.abs(pct).toFixed(1)}%`;
}

/**
 * The period a value stands for, as printed: "Oct 6, 2026" (a day), "week of Oct 5, 2026", "Sep 2026".
 * `frequency` is how the values are shown: 'daily', 'weekly' (also daily prices averaged by week), 'monthly'.
 */
export function periodLabel(iso, frequency) {
  if (frequency === 'annual') return iso.slice(0, 4);
  // A fiscal year is dated by its first day: FY 2025 began October 1, 2024 (July 1 through FY 1976);
  // the transition quarter of July–September 1976 stands between the two.
  if (frequency === 'fiscal-year') return iso === '1976-07-01' ? 'TQ 1976' : `FY ${Number(iso.slice(0, 4)) + 1}`;
  if (frequency === 'irregular') return `from ${shortDate(iso)}`;
  if (frequency === 'four-week-average') return `4 weeks to ${shortDate(iso)}`;
  if (frequency === 'quarterly') return `Q${Math.floor(Number(iso.slice(5, 7)) / 3) + 1} ${iso.slice(0, 4)}`;
  if (frequency === 'monthly') return MONTH.format(new Date(iso + 'T00:00:00Z'));
  if (frequency === 'weekly') return `week of ${shortDate(iso)}`;
  return shortDate(iso);
}

/** Days between two values of a series as shown; more than this may be a gap in the publisher's data. */
export const GAP_DAYS = { daily: 10, weekly: 10, 'four-week-average': 10, monthly: 45, quarterly: 100, annual: 400, 'fiscal-year': 400, irregular: Infinity };

/**
 * Where the line breaks: the indexes of values preceded by a gap in the publisher's data. A gap is
 * longer than the series' usual step (GAP_DAYS) and clearly longer than the steps either side of
 * it, so a stretch published less often (debt held by the public: yearly until 2001, then monthly)
 * is drawn as a line, while a missing month (October 2025 in the BLS series) is a break.
 */
export function gapBreaks(dates, frequency) {
  const day = iso => Date.parse(iso + 'T00:00:00Z') / 864e5;
  const steps = dates.map((d, i) => (i ? day(d) - day(dates[i - 1]) : null));
  const breaks = new Set();
  for (let i = 1; i < dates.length; i++) {
    const near = Math.max(steps[i - 1] ?? 0, steps[i + 1] ?? 0) || steps[i];
    if (steps[i] > (GAP_DAYS[frequency] ?? 45) && steps[i] > 1.8 * near) breaks.add(i);
  }
  return breaks;
}

export const SOURCES = {
  eia: 'U.S. Energy Information Administration',
  bls: 'U.S. Bureau of Labor Statistics',
  bea: 'U.S. Bureau of Economic Analysis',
  treasury: 'U.S. Department of the Treasury',
  'bls-bulk': 'U.S. Bureau of Labor Statistics',
  umich: 'University of Michigan, Surveys of Consumers',
  census: 'U.S. Census Bureau',
  'census-api': 'U.S. Census Bureau and HUD, New Residential Sales',
  freddiemac: 'Freddie Mac',
  fhfa: 'Federal Housing Finance Agency',
  atlantafed: 'Federal Reserve Bank of Atlanta, Home Ownership Affordability Monitor',
  cdc: 'CDC National Center for Health Statistics',
  'fed-h15': 'Federal Reserve Board, H.15 Selected Interest Rates',
  'fed-omo': 'Federal Reserve Board, Open Market Operations',
  'treasury-mts': 'U.S. Department of the Treasury, Monthly Treasury Statement',
  'treasury-dts': 'U.S. Department of the Treasury, Daily Treasury Statement',
  'treasury-dts-iv': 'U.S. Department of the Treasury, Daily Treasury Statement',
  omb: 'Office of Management and Budget, Historical Tables',
  cbo: 'Congressional Budget Office',
  'irs-soi': 'Internal Revenue Service, Statistics of Income',
  usitc: 'U.S. International Trade Commission',
  'census-trade': 'U.S. Census Bureau and BEA, U.S. International Trade in Goods and Services',
  'census-popest': 'U.S. Census Bureau, Population Estimates',
  'census-decennial': 'U.S. Census Bureau, Decennial Census',
  'census-apportionment': 'U.S. Census Bureau, Apportionment of the House',
  'census-acs': 'U.S. Census Bureau, American Community Survey',
};

/** A price per unit ("$/bbl", "$/gal"): printed in dollars and cents with its unit, nominal dollars. */
export const isPrice = unit => /^\$\//.test(unit ?? '');

/** The publisher's own page for a series: { href, label }, or null where it has none. */
export function sourceLink(series) {
  switch (series.source) {
    case 'bls':
    case 'bls-bulk': return { href: `https://data.bls.gov/timeseries/${series.sourceId}`, label: 'BLS series page' };
    case 'bea': return { href: 'https://apps.bea.gov/iTable/?reqid=19&step=2&isuri=1&categories=survey', label: 'BEA national accounts tables' };
    case 'umich': return { href: 'https://www.sca.isr.umich.edu/', label: 'Surveys of Consumers' };
    case 'census-api': return { href: 'https://www.census.gov/construction/nrs/index.html', label: 'Census New Residential Sales' };
    case 'freddiemac': return { href: 'https://www.freddiemac.com/pmms', label: 'Freddie Mac mortgage rates' };
    case 'fed-h15': return { href: 'https://www.federalreserve.gov/releases/h15/', label: 'Federal Reserve H.15' };
    case 'fed-omo': return { href: 'https://www.federalreserve.gov/monetarypolicy/openmarket.htm', label: 'FOMC target changes' };
    case 'cdc': return { href: 'https://data.cdc.gov/d/r8kw-7aab', label: 'CDC provisional death counts' };
    case 'atlantafed': return { href: 'https://www.atlantafed.org/research-and-data/data/home-ownership-affordability-monitor', label: 'Atlanta Fed HOAM' };
    case 'fhfa': return { href: 'https://www.fhfa.gov/data/hpi', label: 'FHFA House Price Index' };
    case 'census': return series.slug.startsWith('household-income')
      ? { href: 'https://www.census.gov/data/tables/time-series/demo/income-poverty/historical-income-households.html', label: 'Census income tables' }
      : { href: 'https://www.census.gov/housing/hvs/index.html', label: 'Census Housing Vacancy Survey' };
    case 'treasury': return { href: 'https://fiscaldata.treasury.gov/datasets/debt-to-the-penny/', label: 'Debt to the Penny on Fiscal Data' };
    case 'treasury-mts': return { href: 'https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/', label: 'Monthly Treasury Statement on Fiscal Data' };
    case 'treasury-dts':
    case 'treasury-dts-iv': return { href: 'https://fiscaldata.treasury.gov/datasets/daily-treasury-statement/', label: 'Daily Treasury Statement on Fiscal Data' };
    case 'omb': return { href: 'https://www.whitehouse.gov/omb/information-resources/budget/historical-tables/', label: 'OMB Historical Tables' };
    case 'cbo': return { href: 'https://www.cbo.gov/publication/61911', label: 'CBO, The Distribution of Household Income, 2022' };
    case 'usitc': return { href: 'https://www.usitc.gov/documents/dataweb/ave_table.pdf', label: 'USITC duties and ratio of duties to value (PDF)' };
    case 'census-trade': return { href: `https://www.census.gov/foreign-trade/statistics/historical/${series.sourceId.split(':')[0]}.xlsx`, label: 'Census trade history (.xlsx)' };
    case 'irs-soi': return { href: 'https://www.irs.gov/statistics/soi-tax-stats-historical-table-23', label: 'IRS SOI Historical Table 23' };
    case 'eia': return {
      href: `https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=${series.sourceId}&f=${series.frequency === 'daily' ? 'D' : 'W'}`,
      label: 'EIA series page',
    };
    case 'census-popest': return { href: 'https://www.census.gov/programs-surveys/popest.html', label: 'Census population estimates' };
    case 'census-decennial': return { href: 'https://www.census.gov/programs-surveys/decennial-census.html', label: 'Decennial census' };
    case 'census-apportionment': return { href: 'https://www.census.gov/data/tables/2020/dec/2020-apportionment-data.html', label: '2020 apportionment data' };
    case 'census-acs': return { href: 'https://www.census.gov/programs-surveys/acs.html', label: 'American Community Survey' };
    default: return null;
  }
}

// The economic series offered, by subject: the tabs of the Economic Data page (Economy.jsx) and the
// subjects of the timeline's catalogue (SeriesSearch.jsx). Series are economic_series slugs
// (seed/load-economic-series.js); each is shown by its stored name. A tab lists its series in the
// order offered; the first is the default. A series may name a `group`, a heading it is listed under
// (Oil: Prices, Demand). A pair (`compare`) is two series offered as one choice, named here. `note` is
// printed under the chart. `search` is for the catalogue: the words people use for the subject (from
// the news and talking points), what the news says, the series the news usually means, what people
// expect that is not loaded, and the series whose published breakdowns (unemployment by group) are
// offered with the tab's own.
export const ECONOMY_TABS = [
  {
    slug: 'oil',
    label: 'Oil',
    search: {
      words: ['oil', 'oil prices', 'crude', 'gas', 'gas prices', 'gasoline', 'fuel', 'pump', 'diesel', 'energy', 'opec', 'drill baby drill'],
      heard: '“Gas is averaging $4.35 a gallon” (EIA, Mondays) · “Oil is near $100 a barrel” (spot prices, daily)',
      headline: 'gasoline-retail',
    },
    lede: 'Crude oil is what “oil prices” in the news usually means: WTI is the U.S. benchmark, Brent the international one, per barrel. Retail gasoline and diesel, per gallon, are what drivers pay. Demand is how much the country uses, in barrels a day: EIA\'s weekly estimate, averaged over four weeks, and its monthly figure, which is more complete and comes two months later.',
    series: [
      { value: 'wti-spot', group: 'Prices' },
      { value: 'brent-spot', group: 'Prices' },
      { value: 'gasoline-retail', group: 'Prices' },
      { value: 'diesel-retail', group: 'Prices' },
      { value: 'demand-total-4wk', group: 'Demand' },
      { value: 'demand-distillate-4wk', group: 'Demand' },
      { value: 'demand-gasoline-4wk', group: 'Demand' },
      { value: 'demand-jet-4wk', group: 'Demand' },
      { value: 'demand-total-monthly', group: 'Demand' },
      { value: 'demand-distillate-monthly', group: 'Demand' },
      { value: 'demand-gasoline-monthly', group: 'Demand' },
      { value: 'demand-jet-monthly', group: 'Demand' },
    ],
    note: 'Diesel demand is EIA\'s distillate fuel oil: mostly diesel, plus heating oil. Demand is “product supplied”, what leaves refineries, pipelines and terminals for use.',
  },
  {
    slug: 'unemployment',
    label: 'Unemployment',
    search: {
      words: ['jobs', 'jobless', 'joblessness', 'jobs report', 'labor market', 'layoffs', 'out of work', 'u-3', 'u-6', 'real unemployment rate', 'black unemployment', 'youth unemployment'],
      heard: '“The unemployment rate rose to 4.2 percent in September” (the BLS jobs report, the first Friday of each month)',
      headline: 'unemployment-rate',
      missing: ['“The economy added 150,000 jobs”: payroll employment, from a different BLS survey (CES), is not loaded yet.'],
      breakdowns: ['unemployment-rate', 'unemployed-persons'],
    },
    lede: 'The unemployment rate is the share of the labor force without a job and looking for one, from the monthly Current Population Survey. U-6 is the broadest measure: it also counts people who want work but have stopped looking, and part-time workers who want full-time work.',
    series: [
      { value: 'unemployment-rate' },
      { value: 'unemployment-u6' },
      { value: 'unemployed-persons' },
    ],
    note: 'On the timeline, the unemployment rate and unemployed persons can be broken down by sex, race and ethnicity, age and education. October 2025 has no value: the survey was not collected during the 2025 lapse in appropriations.',
  },
  {
    slug: 'inflation',
    label: 'Inflation',
    search: {
      words: ['prices', 'cost of living', 'inflation rate', 'cpi', 'pce', 'core inflation', 'groceries', 'price of eggs', 'affordability'],
      heard: '“Consumer prices rose … percent over the last year” (BLS, mid-month)',
      headline: 'cpi',
      missing: ['“Inflation was 2.9 percent” is a change over twelve months. BLS prints it in its release; GovGraph holds the index and computes nothing of its own.', 'Prices of single items (eggs, rent) are separate BLS series, not loaded.'],
    },
    lede: 'Inflation is measured by price indexes. The Consumer Price Index is the cost of a fixed basket of goods and services bought by people in cities; the core index leaves out food and energy, whose prices swing the most. The PCE price index, the measure the Federal Reserve targets, covers all consumer spending.',
    series: [
      { value: 'cpi' },
      { value: 'cpi-core' },
      { value: 'pce-price' },
      { value: 'pce-price-core' },
    ],
    note: 'CPI is from the Bureau of Labor Statistics; PCE from the Bureau of Economic Analysis, covering all consumer spending, including what employers and government pay for, such as health care. October 2025 has no CPI value: prices were not collected during the 2025 lapse in appropriations.',
  },
  {
    slug: 'consumers',
    label: 'Consumers',
    search: {
      words: ['consumer spending', 'spending', 'consumer sentiment', 'consumer confidence', 'vibes', 'vibecession', 'shoppers', 'retail'],
      heard: '“Consumer sentiment fell for a third month” (University of Michigan, twice a month)',
      headline: 'sentiment',
      missing: ['The Conference Board’s Consumer Confidence Index is licensed data and is not shown.'],
    },
    lede: 'Consumer spending, about two thirds of GDP, is what households pay for goods and services each month, at an annual rate. Consumer sentiment is how people feel about their finances and the economy, from the University of Michigan\'s monthly survey.',
    series: [
      { value: 'sentiment' },
      { value: 'spending' },
      { value: 'spending-real' },
    ],
    note: 'Consumer sentiment is published by the University of Michigan, not a government agency; before 1978 the survey was taken every few months. The Conference Board\'s Consumer Confidence Index is licensed data and is not shown. Real spending is in 2017 dollars and starts in 2007, as BEA\'s monthly tables do.',
  },
  {
    slug: 'housing',
    label: 'Housing',
    search: {
      words: ['home prices', 'house prices', 'homes', 'mortgage', 'mortgages', 'mortgage rates', 'rent', 'housing affordability', 'homeownership', 'first-time buyers', 'household income', 'income'],
      heard: '“Mortgage rates rose to 7.4 percent” (Freddie Mac, Thursdays)',
      headline: 'mortgage-rate',
      missing: ['Rents and the prices of existing homes (the National Association of Realtors’ figures, which are licensed) are not loaded.'],
    },
    lede: 'Whether a home is within reach depends on its price, the mortgage rate and what households earn. The Atlanta Fed\'s Home Ownership Affordability Monitor puts them together: the yearly cost of owning the median-priced home as a share of median household income, and as an index where 100 is the break-even point. The homeownership rate shows the result: the share of households that own their home.',
    series: [
      { value: 'hoam-share' },
      { value: 'hoam-index' },
      { value: 'home-price' },
      { value: 'mortgage-rate' },
      { value: 'house-prices' },
      { value: 'homeownership' },
      { value: 'household-income' },
      { value: 'household-income-real' },
    ],
    note: 'The Atlanta Fed\'s measure counts the median existing home with 10 percent down, principal and interest at the Freddie Mac rate, mortgage insurance, property taxes and insurance, against median household income, monthly from 2005; above 30 percent of income (an index below 100) is unaffordable. The median new-home price is for newly built houses: the median for existing homes comes from the National Association of Realtors, whose data is licensed. Household income is published each September for the year before. The homeownership rate for Q4 2025 rests on two months: October 2025 was not collected during the lapse in appropriations.',
  },
  {
    slug: 'rates',
    label: 'Interest rates',
    search: {
      words: ['fed', 'the fed', 'interest rates', 'rates', 'rate cut', 'rate hike', 'fomc', 'federal funds', 'powell', 'treasury yields', 'bonds', '10-year', 'prime rate'],
      heard: '“The Fed raised rates by a quarter point” (FOMC statement, eight meetings a year)',
      headline: 'fed-funds',
    },
    lede: 'When the news says the Fed raised or cut rates, it means the target range the Federal Open Market Committee sets for the federal funds rate, what banks charge each other overnight. The band shows that target; the line is the rate banks actually paid. Treasury yields are set in the market: the 10-year yield drives mortgage rates, the 2-year follows where the Fed is expected to go.',
    series: [
      { value: 'fed-funds', band: { lower: 'fed-target-lower', upper: 'fed-target-upper', label: 'The Fed’s Target Range' } },
      { value: 'treasury-10y' },
      { value: 'treasury-2y' },
      { value: 'prime-rate' },
    ],
    note: 'The FOMC target is from the Federal Reserve\'s tables of target changes, which begin in July 1990 (the Fed began announcing its target in 1994); before then only the rate banks paid is shown. A single target until December 2008, a range a quarter point wide since. Dates are when each change took effect.',
  },
  {
    slug: 'health',
    label: 'Health',
    search: {
      words: ['covid', 'covid-19', 'coronavirus', 'pandemic', 'deaths', 'excess deaths', 'mortality'],
      heard: '“COVID deaths fell for a sixth straight week” (CDC, weekly)',
      headline: 'covid-deaths',
    },
    lede: 'The COVID-19 pandemic, counted in deaths. Weekly COVID-19 deaths are those with COVID-19 on the death certificate; deaths from all causes as a percent of expected shows how far the weekly toll ran above normal, whatever was recorded as the cause.',
    series: [
      { value: 'covid-deaths' },
      { value: 'deaths-vs-expected' },
    ],
    note: 'Provisional counts from the CDC\'s National Center for Health Statistics, revised as death certificates arrive. The most recent eight weeks before each release are left out because they are incomplete.',
  },
  {
    slug: 'gdp',
    label: 'GDP & Debt',
    search: {
      words: ['economy', 'gdp', 'growth', 'recession', 'economic growth', 'output', 'national debt', 'debt', 'debt ceiling', 'borrowing'],
      heard: '“The economy grew at a … annual rate last quarter” (BEA) · “The national debt passed $40 trillion” (Treasury, daily)',
      headline: 'gdp-growth',
    },
    lede: 'Gross domestic product is the value of everything produced in the U.S., published each quarter at an annual rate. Total public debt includes what the government owes its own trust funds, such as Social Security; debt held by the public, the measure the Congressional Budget Office uses, leaves those out.',
    series: [
      { value: 'gdp' },
      { value: 'gdp-real' },
      { value: 'gdp-growth' },
      { value: 'debt-total' },
      { value: 'debt-public' },
    ],
    note: 'A quarter\'s GDP is published about a month after it ends and revised later. Treasury\'s daily figures begin in April 1993, and its split of debt held by the public in September 1997 (yearly until 2001).',
  },
  {
    slug: 'trade',
    label: 'Trade & tariffs',
    search: {
      words: ['tariff', 'tariffs', 'customs', 'duties', 'trade', 'trade war', 'trade deficit', 'imports', 'exports', 'liberation day', 'reciprocal tariffs', 'smoot-hawley', 'tariff revenue'],
      heard: '“Tariff revenue hit a record $31 billion in a month” · “The highest average tariff since the 1930s”',
      headline: 'mts-customs-duties',
    },
    lede: 'Tariffs are customs duties on imports, collected at the border by Customs and Border Protection and counted by Treasury as federal receipts. They are shown here with the trade they fall on: exports, imports and the balance between them. The U.S. International Trade Commission\'s table goes back to 1891 and prints both the duties collected and duties as a share of the value of imports. Where imports run above exports, the space between the two lines is the trade deficit.',
    series: [
      { value: 'mts-customs-duties', group: 'Monthly tariff revenue (Treasury)' },
      { label: 'Monthly Tariff Revenue and Refunds', value: 'pair-customs-refunds', group: 'Monthly tariff revenue (Treasury)', compare: { inflow: 'mts-customs-gross', outflow: 'mts-customs-refunds' } },
      { value: 'mts-customs-refunds', group: 'Monthly tariff revenue (Treasury)' },
      { value: 'dts-customs', group: 'Daily tariff deposits (Treasury)', asPublished: true },
      { value: 'dts-customs-dhs', group: 'Daily tariff deposits (Treasury)', asPublished: true },
      { value: 'dts-customs-old', group: 'Daily tariff deposits (Treasury)', asPublished: true },
      { value: 'usitc-duties', group: 'Yearly tariff revenue' },
      { value: 'usitc-duties-ratio-total', group: 'Yearly tariff revenue' },
      { value: 'usitc-duties-ratio-dutiable', group: 'Yearly tariff revenue' },
      { value: 'usitc-imports', group: 'Yearly tariff revenue' },
      { value: 'omb-customs', group: 'Yearly tariff revenue' },
      { value: 'federal-customs-duties-annual', group: 'Yearly tariff revenue' },
      { value: 'federal-customs-duties', group: 'Yearly tariff revenue' },
      { label: 'Monthly Exports and Imports', value: 'pair-trade-monthly', group: 'Monthly trade since 1992 (Census)', compare: { inflow: 'trade-exports-monthly', outflow: 'trade-imports-monthly' } },
      { value: 'trade-balance-monthly', group: 'Monthly trade since 1992 (Census)' },
      { label: 'Monthly Exports and Imports of Goods', value: 'pair-trade-goods-monthly', group: 'Monthly trade since 1992 (Census)', compare: { inflow: 'trade-exports-goods-monthly', outflow: 'trade-imports-goods-monthly' } },
      { value: 'trade-balance-goods-monthly', group: 'Monthly trade since 1992 (Census)' },
      { label: 'Monthly Exports and Imports of Services', value: 'pair-trade-services-monthly', group: 'Monthly trade since 1992 (Census)', compare: { inflow: 'trade-exports-services-monthly', outflow: 'trade-imports-services-monthly' } },
      { value: 'trade-balance-services-monthly', group: 'Monthly trade since 1992 (Census)' },
      { label: 'Yearly Exports and Imports (Census)', value: 'pair-trade-annual', group: 'Yearly trade since 1960 (Census)', compare: { inflow: 'trade-exports-annual', outflow: 'trade-imports-annual' } },
      { value: 'trade-balance-annual', group: 'Yearly trade since 1960 (Census)' },
      { label: 'Yearly Exports and Imports of Goods', value: 'pair-trade-goods-annual', group: 'Yearly trade since 1960 (Census)', compare: { inflow: 'trade-exports-goods-annual', outflow: 'trade-imports-goods-annual' } },
      { value: 'trade-balance-goods-annual', group: 'Yearly trade since 1960 (Census)' },
      { label: 'Yearly Exports and Imports of Services', value: 'pair-trade-services-annual', group: 'Yearly trade since 1960 (Census)', compare: { inflow: 'trade-exports-services-annual', outflow: 'trade-imports-services-annual' } },
      { value: 'trade-balance-services-annual', group: 'Yearly trade since 1960 (Census)' },
      { label: 'Quarterly Exports and Imports (Annualized)', value: 'pair-bea-trade', group: 'Quarterly trade since 1947 (BEA)', compare: { inflow: 'bea-exports', outflow: 'bea-imports' } },
      { value: 'bea-net-exports', group: 'Quarterly trade since 1947 (BEA)' },
      { label: 'Quarterly Exports and Imports of Goods (Annualized)', value: 'pair-bea-trade-goods', group: 'Quarterly trade since 1947 (BEA)', compare: { inflow: 'bea-exports-goods', outflow: 'bea-imports-goods' } },
      { label: 'Quarterly Exports and Imports of Services (Annualized)', value: 'pair-bea-trade-services', group: 'Quarterly trade since 1947 (BEA)', compare: { inflow: 'bea-exports-services', outflow: 'bea-imports-services' } },
      { label: 'Yearly Exports and Imports (BEA)', value: 'pair-bea-trade-annual', group: 'Yearly trade since 1929 (BEA)', compare: { inflow: 'bea-exports-annual', outflow: 'bea-imports-annual' } },
      { value: 'bea-net-exports-annual', group: 'Yearly trade since 1929 (BEA)' },
    ],
    note: 'Each series is printed as its publisher printed it, in its own unit: USITC in thousands of dollars, Treasury\'s monthly statement in dollars, the others in millions. Treasury\'s monthly customs duties are net of refunds: refunds rose from May 2026 (about $49 billion in June) and net receipts were negative in May, June and July; the gross and refunds lines show both sides. USITC counts fiscal years (July–June) to 1917 and calendar years from 1919; it prints 1918 and 1930 in parts (the change to calendar years; the Tariff Act of 1930), which are not shown, so those years are blank. USITC warns that duties as a share of imports should be used with great reservation as a measure of how high tariffs are. The daily lines include some excise taxes Customs collects at the border and were renamed twice; they are listed separately, not joined. Monthly trade figures are seasonally adjusted; BEA\'s quarterly figures are at annual rates, so a quarter reads about four times a month. Census and BEA measure trade slightly differently (balance of payments basis against the national accounts), so their totals differ.',
  },
  {
    slug: 'tax-revenue',
    label: 'Tax revenue',
    search: {
      words: ['taxes', 'tax', 'tax revenue', 'irs', 'income tax', 'income taxes', 'corporate tax', 'corporate taxes', 'refunds', 'tax refund', 'withholding', 'payroll taxes', 'tax day', 'stimulus checks'],
      heard: '“Corporate tax receipts fell after the 2017 cut” · “Refunds are running ahead of last year”',
      headline: 'mts-total-receipts',
      missing: ['State and local taxes are not collected.'],
    },
    lede: 'What the federal government collects, from three publishers at three speeds. The Bureau of Economic Analysis gives taxes each quarter at an annual rate, seasonally adjusted, so quarters can be compared. Treasury\'s Monthly Treasury Statement gives what came in each month, with April\'s tax-filing surge and the quarterly estimated-tax months left in. Its Daily Treasury Statement gives each business day\'s tax deposits.',
    series: [
      { value: 'federal-tax-receipts', group: 'Quarterly, at annual rates (BEA)' },
      { value: 'federal-current-receipts', group: 'Quarterly, at annual rates (BEA)' },
      { value: 'federal-personal-taxes', group: 'Quarterly, at annual rates (BEA)' },
      { value: 'federal-corporate-taxes', group: 'Quarterly, at annual rates (BEA)' },
      { value: 'federal-excise-taxes', group: 'Quarterly, at annual rates (BEA)' },
      { value: 'federal-social-contributions', group: 'Quarterly, at annual rates (BEA)' },
      { value: 'federal-taxes-rest-of-world', group: 'Quarterly, at annual rates (BEA)' },
      { value: 'mts-total-receipts', group: 'Monthly collections (Treasury)' },
      { value: 'mts-individual-income-taxes', group: 'Monthly collections (Treasury)' },
      { value: 'mts-corporation-income-taxes', group: 'Monthly collections (Treasury)' },
      { value: 'mts-employment-retirement', group: 'Monthly collections (Treasury)' },
      { value: 'mts-unemployment-insurance', group: 'Monthly collections (Treasury)' },
      { value: 'mts-other-retirement', group: 'Monthly collections (Treasury)' },
      { value: 'mts-excise-taxes', group: 'Monthly collections (Treasury)' },
      { value: 'mts-estate-gift-taxes', group: 'Monthly collections (Treasury)' },
      { value: 'mts-miscellaneous-receipts', group: 'Monthly collections (Treasury)' },
      { value: 'mts-customs-duties', group: 'Monthly collections (Treasury)' },
      { value: 'dts-withheld', group: 'Daily deposits since Feb 2023 (Treasury)', asPublished: true },
      { value: 'dts-nonwithheld-electronic', group: 'Daily deposits since Feb 2023 (Treasury)', asPublished: true },
      { value: 'dts-nonwithheld-other', group: 'Daily deposits since Feb 2023 (Treasury)', asPublished: true },
      { value: 'dts-corporate', group: 'Daily deposits since Feb 2023 (Treasury)', asPublished: true },
      { value: 'dts-excise', group: 'Daily deposits since Feb 2023 (Treasury)', asPublished: true },
      { value: 'dts-estate-gift', group: 'Daily deposits since Feb 2023 (Treasury)', asPublished: true },
      { value: 'dts-irs-estate-gift-misc', group: 'Daily deposits since Feb 2023 (Treasury)', asPublished: true },
      { value: 'dts-futa', group: 'Daily deposits since Feb 2023 (Treasury)', asPublished: true },
      { value: 'dts-railroad', group: 'Daily deposits since Feb 2023 (Treasury)', asPublished: true },
      { value: 'dts-iv-withheld', group: 'Daily deposits, 2005 – Feb 2023 (Treasury)', asPublished: true },
      { value: 'dts-iv-individual', group: 'Daily deposits, 2005 – Feb 2023 (Treasury)', asPublished: true },
      { value: 'dts-iv-corporate', group: 'Daily deposits, 2005 – Feb 2023 (Treasury)', asPublished: true },
      { value: 'dts-iv-excise', group: 'Daily deposits, 2005 – Feb 2023 (Treasury)', asPublished: true },
      { value: 'dts-iv-estate-gift', group: 'Daily deposits, 2005 – Feb 2023 (Treasury)', asPublished: true },
      { value: 'dts-iv-futa', group: 'Daily deposits, 2005 – Feb 2023 (Treasury)', asPublished: true },
      { value: 'dts-iv-railroad', group: 'Daily deposits, 2005 – Feb 2023 (Treasury)', asPublished: true },
      { label: 'Monthly Federal Revenue and Tax Refunds', value: 'pair-total-refunds', group: 'Monthly gross and refunds (Treasury)', compare: { inflow: 'mts-total-gross', outflow: 'mts-total-refunds' } },
      { label: 'Monthly Individual Income Taxes and Refunds', value: 'pair-individual-refunds', group: 'Monthly gross and refunds (Treasury)', compare: { inflow: 'mts-individual-gross', outflow: 'mts-individual-refunds' } },
      { label: 'Monthly Corporate Income Taxes and Refunds', value: 'pair-corporate-refunds', group: 'Monthly gross and refunds (Treasury)', compare: { inflow: 'mts-corporate-gross', outflow: 'mts-corporate-refunds' } },
      { label: 'Monthly Excise Taxes and Refunds', value: 'pair-excise-refunds', group: 'Monthly gross and refunds (Treasury)', compare: { inflow: 'mts-excise-gross', outflow: 'mts-excise-refunds' } },
      { label: 'Monthly Estate and Gift Taxes and Refunds', value: 'pair-estate-gift-refunds', group: 'Monthly gross and refunds (Treasury)', compare: { inflow: 'mts-estate-gift-gross', outflow: 'mts-estate-gift-refunds' } },
      { label: 'Monthly Payroll Taxes and Refunds', value: 'pair-social-insurance-refunds', group: 'Monthly gross and refunds (Treasury)', compare: { inflow: 'mts-social-insurance-gross', outflow: 'mts-social-insurance-refunds' } },
      { value: 'mts-total-refunds', group: 'Monthly gross and refunds (Treasury)' },
      { value: 'mts-individual-refunds', group: 'Monthly gross and refunds (Treasury)' },
      { value: 'mts-corporate-refunds', group: 'Monthly gross and refunds (Treasury)' },
      { value: 'dts-refunds-individual', group: 'Daily refunds paid (Treasury)', asPublished: true },
      { value: 'dts-refunds-business', group: 'Daily refunds paid (Treasury)', asPublished: true },
      { value: 'dts-old-refunds-individual', group: 'Daily refunds paid (Treasury)', asPublished: true },
      { value: 'dts-old-refunds-business', group: 'Daily refunds paid (Treasury)', asPublished: true },
      { value: 'dts-economic-impact-payments', group: 'Daily refunds paid (Treasury)', asPublished: true },
      { value: 'dts-advance-child-tax-credit', group: 'Daily refunds paid (Treasury)', asPublished: true },
    ],
    note: 'Each series is shown as its publisher printed it: BEA and the daily statement in millions of dollars, the monthly statement in dollars (printed here in billions for reading). Daily deposits and refunds are each day\'s own figure, never averaged; the daily refund lines count refunds paid electronically only. Gross receipts and refunds come from the monthly statement\'s Table 4, whose net is the monthly figures above; Treasury redesigned the daily statement on February 14, 2023, and its tax lines before and after are listed separately because they are drawn differently. The monthly statement\'s data on Fiscal Data begins in March 2015. Customs duties (tariffs) are listed too, and are shown with trade on the Trade & tariffs tab.',
  },
  {
    slug: 'budget',
    label: 'Receipts & outlays',
    search: {
      words: ['budget', 'deficit', 'spending', 'government spending', 'outlays', 'balanced budget', 'interest on the debt', 'social security', 'medicare', 'defense spending', 'shutdown'],
      heard: '“The deficit was … percent of GDP” (OMB, yearly) · “Interest on the debt now tops defense spending” (Treasury, monthly)',
      headline: 'omb-surplus-gdp',
    },
    lede: 'What the federal government takes in against what it pays out. Each publisher prints both sides and its own difference: OMB by fiscal year back to 1901 (and as a percent of GDP from 1930), BEA each quarter at an annual rate, Treasury each month. Where outlays run above receipts the space between the lines is a deficit; above it, a surplus.',
    series: [
      { label: 'Federal Revenue and Spending as a Share of GDP', value: 'pair-omb-gdp', group: 'Yearly since 1901, by fiscal year (OMB)', compare: { inflow: 'omb-receipts-gdp', outflow: 'omb-outlays-gdp' } },
      { label: 'Yearly Federal Revenue and Spending', value: 'pair-omb', group: 'Yearly since 1901, by fiscal year (OMB)', compare: { inflow: 'omb-receipts', outflow: 'omb-outlays' } },
      { value: 'omb-surplus-gdp', group: 'Yearly since 1901, by fiscal year (OMB)' },
      { value: 'omb-surplus', group: 'Yearly since 1901, by fiscal year (OMB)' },
      { value: 'omb-outlays', group: 'Yearly since 1901, by fiscal year (OMB)' },
      { value: 'omb-outlays-gdp', group: 'Yearly since 1901, by fiscal year (OMB)' },
      { label: 'Quarterly Federal Revenue and Spending (Annualized)', value: 'pair-bea', group: 'Quarterly, at annual rates (BEA)', compare: { inflow: 'federal-total-receipts', outflow: 'federal-total-expenditures' } },
      { value: 'federal-net-borrowing', group: 'Quarterly, at annual rates (BEA)' },
      { value: 'federal-total-expenditures', group: 'Quarterly, at annual rates (BEA)' },
      { value: 'federal-total-receipts', group: 'Quarterly, at annual rates (BEA)' },
      { label: 'Monthly Federal Revenue and Spending', value: 'pair-mts', group: 'Monthly totals (Treasury)', compare: { inflow: 'mts-total-receipts', outflow: 'mts-total-outlays' } },
      { value: 'mts-deficit', group: 'Monthly totals (Treasury)' },
      { value: 'mts-total-outlays', group: 'Monthly totals (Treasury)' },
      { value: 'mts-outlays-defense', group: 'Monthly spending by function (Treasury)' },
      { value: 'mts-outlays-international', group: 'Monthly spending by function (Treasury)' },
      { value: 'mts-outlays-science', group: 'Monthly spending by function (Treasury)' },
      { value: 'mts-outlays-energy', group: 'Monthly spending by function (Treasury)' },
      { value: 'mts-outlays-environment', group: 'Monthly spending by function (Treasury)' },
      { value: 'mts-outlays-agriculture', group: 'Monthly spending by function (Treasury)' },
      { value: 'mts-outlays-commerce-housing', group: 'Monthly spending by function (Treasury)' },
      { value: 'mts-outlays-transportation', group: 'Monthly spending by function (Treasury)' },
      { value: 'mts-outlays-community', group: 'Monthly spending by function (Treasury)' },
      { value: 'mts-outlays-education', group: 'Monthly spending by function (Treasury)' },
      { value: 'mts-outlays-health', group: 'Monthly spending by function (Treasury)' },
      { value: 'mts-outlays-medicare', group: 'Monthly spending by function (Treasury)' },
      { value: 'mts-outlays-income-security', group: 'Monthly spending by function (Treasury)' },
      { value: 'mts-outlays-social-security', group: 'Monthly spending by function (Treasury)' },
      { value: 'mts-outlays-veterans', group: 'Monthly spending by function (Treasury)' },
      { value: 'mts-outlays-justice', group: 'Monthly spending by function (Treasury)' },
      { value: 'mts-outlays-general-government', group: 'Monthly spending by function (Treasury)' },
      { value: 'mts-outlays-net-interest', group: 'Monthly spending by function (Treasury)' },
      { value: 'mts-outlays-offsetting-receipts', group: 'Monthly spending by function (Treasury)' },
    ],
    note: 'Signs follow each publisher: OMB prints a deficit as negative, BEA its net borrowing as negative, and the Monthly Treasury Statement its deficit as positive (a surplus negative). Treasury\'s monthly deficit is taken from the statement for that month; later statements sometimes revise it slightly. Outlays are net of offsetting receipts, which is why "undistributed offsetting receipts" is negative. OMB figures are actual through FY 2025 (its estimates are not shown); BEA\'s expenditures begin in 1959. Amounts are as printed: OMB and BEA in millions of dollars, Treasury in dollars.',
  },
  {
    slug: 'tax-history',
    label: 'Revenue since 1934',
    search: {
      words: ['tax history', 'revenue history', 'taxes as a share of gdp', 'payroll taxes', 'social security taxes', 'gas tax', 'alcohol tax', 'tobacco tax', 'estate tax', 'excise taxes'],
      heard: '“Federal revenue is near its long-run average as a share of the economy”',
      headline: 'omb-receipts-gdp',
    },
    lede: 'Federal receipts by fiscal year from the Office of Management and Budget\'s Historical Tables, published with each President\'s Budget: in dollars, as a share of all receipts and as a percent of GDP. Individual income taxes and payroll taxes have grown to most of the total, while excise taxes, the largest source in the 1930s, have shrunk.',
    series: [
      { value: 'omb-receipts', group: 'Yearly totals (OMB)' },
      { value: 'omb-receipts-gdp', group: 'Yearly totals (OMB)' },
      { value: 'omb-individual', group: 'Yearly, in dollars (OMB Table 2.1)' },
      { value: 'omb-corporate', group: 'Yearly, in dollars (OMB Table 2.1)' },
      { value: 'omb-social-insurance', group: 'Yearly, in dollars (OMB Table 2.1)' },
      { value: 'omb-excise', group: 'Yearly, in dollars (OMB Table 2.1)' },
      { value: 'omb-other', group: 'Yearly, in dollars (OMB Table 2.1)' },
      { value: 'omb-individual-share', group: 'Yearly, percent of all receipts (OMB Table 2.2)' },
      { value: 'omb-corporate-share', group: 'Yearly, percent of all receipts (OMB Table 2.2)' },
      { value: 'omb-social-insurance-share', group: 'Yearly, percent of all receipts (OMB Table 2.2)' },
      { value: 'omb-excise-share', group: 'Yearly, percent of all receipts (OMB Table 2.2)' },
      { value: 'omb-other-share', group: 'Yearly, percent of all receipts (OMB Table 2.2)' },
      { value: 'omb-individual-gdp', group: 'Yearly, percent of GDP (OMB Table 2.3)' },
      { value: 'omb-corporate-gdp', group: 'Yearly, percent of GDP (OMB Table 2.3)' },
      { value: 'omb-social-insurance-gdp', group: 'Yearly, percent of GDP (OMB Table 2.3)' },
      { value: 'omb-excise-gdp', group: 'Yearly, percent of GDP (OMB Table 2.3)' },
      { value: 'omb-other-gdp', group: 'Yearly, percent of GDP (OMB Table 2.3)' },
      { value: 'omb-oasi', group: 'Yearly payroll and excise detail (OMB Table 2.4)' },
      { value: 'omb-di', group: 'Yearly payroll and excise detail (OMB Table 2.4)' },
      { value: 'omb-hi', group: 'Yearly payroll and excise detail (OMB Table 2.4)' },
      { value: 'omb-unemployment', group: 'Yearly payroll and excise detail (OMB Table 2.4)' },
      { value: 'omb-excise-alcohol', group: 'Yearly payroll and excise detail (OMB Table 2.4)' },
      { value: 'omb-excise-tobacco', group: 'Yearly payroll and excise detail (OMB Table 2.4)' },
      { value: 'omb-excise-transportation', group: 'Yearly payroll and excise detail (OMB Table 2.4)' },
      { value: 'omb-excise-airport', group: 'Yearly payroll and excise detail (OMB Table 2.4)' },
      { value: 'omb-estate-gift', group: 'Yearly other receipts (OMB Table 2.5)' },
      { value: 'omb-customs', group: 'Yearly other receipts (OMB Table 2.5)' },
      { value: 'omb-fed-reserve', group: 'Yearly other receipts (OMB Table 2.5)' },
    ],
    note: 'From the FY 2027 Budget (April 2026), actual figures through FY 2025; OMB\'s estimates for later years are not shown. Fiscal years ran July to June until 1976, then October to September; the three months between (July–September 1976, the "transition quarter") are a value of their own, not a year. Amounts are in millions of dollars, not adjusted for inflation; a value OMB prints as "*" (too small to show) is left blank.',
  },
  {
    slug: 'tax-rates',
    label: 'Tax rates',
    search: {
      words: ['tax rates', 'top rate', 'tax brackets', 'tax the rich', 'fair share', 'who pays', 'tax cuts', 'the rich', 'quintile', 'top 1 percent', '1 percent', 'middle class'],
      heard: '“The rich don’t pay their fair share” · “The top 1 percent pay the most taxes”',
      headline: 'irs-top-rate',
    },
    lede: 'Who pays, and at what rate. The Congressional Budget Office estimates each income group\'s federal taxes of every kind (income, payroll, corporate and excise) as a share of its income, and its share of all federal taxes. The IRS\'s historical table gives the income tax\'s lowest and highest bracket rates from 1913.',
    series: [
      { value: 'cbo-tax-rate--all', group: 'Average federal tax rate (CBO)' },
      { value: 'cbo-tax-rate--lowest', group: 'Average federal tax rate (CBO)' },
      { value: 'cbo-tax-rate--second', group: 'Average federal tax rate (CBO)' },
      { value: 'cbo-tax-rate--middle', group: 'Average federal tax rate (CBO)' },
      { value: 'cbo-tax-rate--fourth', group: 'Average federal tax rate (CBO)' },
      { value: 'cbo-tax-rate--highest', group: 'Average federal tax rate (CBO)' },
      { value: 'cbo-tax-rate--81-90', group: 'Average federal tax rate (CBO)' },
      { value: 'cbo-tax-rate--91-95', group: 'Average federal tax rate (CBO)' },
      { value: 'cbo-tax-rate--96-99', group: 'Average federal tax rate (CBO)' },
      { value: 'cbo-tax-rate--top-1', group: 'Average federal tax rate (CBO)' },
      { value: 'cbo-tax-share--all', group: 'Share of all federal taxes (CBO)' },
      { value: 'cbo-tax-share--lowest', group: 'Share of all federal taxes (CBO)' },
      { value: 'cbo-tax-share--second', group: 'Share of all federal taxes (CBO)' },
      { value: 'cbo-tax-share--middle', group: 'Share of all federal taxes (CBO)' },
      { value: 'cbo-tax-share--fourth', group: 'Share of all federal taxes (CBO)' },
      { value: 'cbo-tax-share--highest', group: 'Share of all federal taxes (CBO)' },
      { value: 'cbo-tax-share--81-90', group: 'Share of all federal taxes (CBO)' },
      { value: 'cbo-tax-share--91-95', group: 'Share of all federal taxes (CBO)' },
      { value: 'cbo-tax-share--96-99', group: 'Share of all federal taxes (CBO)' },
      { value: 'cbo-tax-share--top-1', group: 'Share of all federal taxes (CBO)' },
      { value: 'irs-top-rate', group: 'Income tax brackets (IRS)' },
      { value: 'irs-top-bracket', group: 'Income tax brackets (IRS)' },
      { value: 'irs-bottom-rate', group: 'Income tax brackets (IRS)' },
    ],
    note: 'CBO\'s figures are from The Distribution of Household Income, 2022 (January 2026), 1979 to 2022; a negative rate means refundable credits exceeded the taxes an income group paid. The IRS table covers tax years 1913 to 2018 and has not been updated since; its footnotes qualify many years\' rates, and the bracket amounts are not adjusted for inflation. The IRS\'s table of corporate tax brackets (Table 24, 1909–2010) is kept but not shown: it lists each period\'s brackets rather than one value a year.',
  },
];

/** A series as an AboutData item: GovGraph's description, the publisher's title, the source. */
export function seriesAbout(series, meta) {
  const link = sourceLink(series);
  return {
    key: series.slug,
    name: series.name,
    meta,
    swatch: 'economic',
    description: series.description,
    publisherTitle: series.publisherTitle,
    publisherTitleFrom: series.publisherTitleFrom,
    source: { label: SOURCES[series.source] ?? series.source, href: link?.href, note: series.sourceId ? `series ${series.sourceId}` : null },
  };
}

/** Whether a series is always shown value by value, never averaged into weeks (daily tax deposits: an average of daily flows is not a published figure). */
export function asPublished(slug) {
  return ECONOMY_TABS.some(tab => tab.series.some(s => s.value === slug && s.asPublished));
}

/** A pair offered as one choice (exports and imports): { label, inflow, outflow }, or null. */
export function pairFor(value) {
  for (const tab of ECONOMY_TABS) {
    const item = tab.series.find(s => s.value === value);
    if (item) return item.compare ? { label: item.label, ...item.compare } : null;
  }
  return null;
}

/** The band drawn with a series (the FOMC target range with the federal funds rate), if any. */
export function bandFor(slug) {
  for (const tab of ECONOMY_TABS) {
    const item = tab.series.find(s => s.value === slug);
    if (item) return item.band ?? null;
  }
  return null;
}

/**
 * A step band clipped to [from, to]: the lower and upper bound in effect on each date a change took
 * effect, starting with the one in force on `from` and held to `to`. `lower` and `upper` share dates.
 * → [{ date, lower, upper }]
 */
export function stepBand(lower, upper, from, to) {
  const highs = new Map(upper.map(o => [o.date, o.value]));
  const steps = lower.map(o => ({ date: o.date, lower: o.value, upper: highs.get(o.date) ?? o.value }));
  const before = steps.filter(s => s.date <= from).at(-1);
  const inside = steps.filter(s => s.date > from && s.date <= to);
  const points = [...(before ? [{ ...before, date: from }] : []), ...inside];
  if (points.length) points.push({ ...points.at(-1), date: to });
  return points;
}

/** The band's bounds on a date (the last change on or before it), or null. */
export function bandOn(points, iso) {
  const step = points.filter(p => p.date <= iso).at(-1);
  return step && iso <= points.at(-1).date ? step : null;
}

/** "3.75–4.00%", or "5.25%" for a single target. */
export const formatBand = b => (b.lower === b.upper ? `${b.upper.toFixed(2)}%` : `${b.lower.toFixed(2)}–${b.upper.toFixed(2)}%`);

/**
 * A tab's series as [{ group, heading, source, options }] in order: one entry with group null when
 * none is named. A group names its publisher in brackets at the end ("Monthly collections (Treasury)"),
 * printed apart from the heading.
 */
export function seriesGroups(series) {
  const groups = [];
  for (const item of series) {
    const group = item.group ?? null;
    if (groups.at(-1)?.group !== group || !groups.length) {
      const m = group?.match(/^(.*) \(([^)]+)\)$/);
      groups.push({ group, heading: m ? m[1] : group, source: m ? m[2] : null, options: [] });
    }
    groups.at(-1).options.push(item);
  }
  return groups;
}

/**
 * Colour slots (1–8) for the lines shown, by group: a group keeps its colour while it stays on,
 * and a new one takes the lowest free slot.
 */
export function assignSlots(previous, keys) {
  const slots = new Map([...previous].filter(([key]) => keys.includes(key)));
  for (const key of keys) {
    if (slots.has(key)) continue;
    const used = new Set(slots.values());
    let slot = 1;
    while (used.has(slot)) slot++;
    slots.set(key, slot);
  }
  return slots;
}

// Lines chosen together share a chart when they are measured alike: dollar amounts published for the
// same period (a month's receipts against a month's outlays), or the same unit otherwise (percent,
// dollars a gallon). Index numbers have their own bases, so each is drawn alone. Dollars printed in
// different units (millions, thousands) are shown in dollars: the same value, printed differently.
const DOLLAR_SCALE = { '$': 1, '$k': 1e3, '$m': 1e6, '$bn': 1e9 };
const UNIT_NAMES = {
  '%': 'Percent', '$/bbl': 'Dollars a barrel', '$/gal': 'Dollars a gallon', thousands: 'Thousands',
  'kb/d': 'Thousand barrels a day', deaths: 'Deaths', x: 'Ratio', index: 'Index',
  people: 'People', households: 'Households', seats: 'House seats', years: 'Years of age', gini: 'Gini index',
};
const FREQUENCY_NAMES = {
  daily: 'daily', weekly: 'weekly', 'four-week-average': 'four-week averages', monthly: 'monthly',
  quarterly: 'quarterly', annual: 'yearly', 'fiscal-year': 'by fiscal year', irregular: 'as changed',
};

/**
 * Lines ([{ key, unit, frequency, observations, … }]) as charts, in the order first chosen:
 * [{ key, unit, title, lines }]. A chart of dollars in mixed units has unit '$' and its lines' values
 * in dollars.
 */
export function chartGroups(lines) {
  const charts = new Map();
  for (const l of lines) {
    const dollars = l.unit in DOLLAR_SCALE;
    const key = dollars ? `$|${l.frequency}` : l.unit === 'index' ? `index|${l.key}` : l.unit;
    if (!charts.has(key)) {
      charts.set(key, {
        key,
        title: dollars ? `Dollars, ${FREQUENCY_NAMES[l.frequency] ?? l.frequency}` : UNIT_NAMES[l.unit] ?? l.unit,
        lines: [],
      });
    }
    charts.get(key).lines.push(l);
  }
  return [...charts.values()].map(chart => {
    const units = new Set(chart.lines.map(l => l.unit));
    if (units.size === 1) return { ...chart, unit: chart.lines[0].unit };
    return {
      ...chart,
      unit: '$',
      lines: chart.lines.map(l => ({ ...l, unit: '$', observations: l.observations.map(o => ({ ...o, value: o.value * DOLLAR_SCALE[l.unit] })) })),
    };
  });
}
