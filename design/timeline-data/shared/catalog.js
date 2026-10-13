// What people search for, and what GovGraph has that answers it. Shared by every variant.
//
// A topic is a word people bring from the news ("unemployment", "taxes", "gas prices"). Its
// `aliases` are the other words they use for it, including talking points ("tax the rich", "the
// real unemployment rate"). `intents` are the different things the word can mean, each answered by
// published series; `headline` marks the one the news usually means. `missing` names what people
// expect that is not loaded, so search can say so instead of silently showing something else.

window.GG_TOPICS = [
  {
    id: 'unemployment',
    label: 'Unemployment',
    aliases: ['jobs', 'jobless', 'joblessness', 'unemployment rate', 'jobs report', 'labor market', 'employment',
      'layoffs', 'u-3', 'u3', 'u-6', 'u6', 'real unemployment rate', 'out of work', 'black unemployment'],
    heard: '“The unemployment rate rose to 4.2 percent in September” (the BLS jobs report, the first Friday of each month)',
    headline: 'unemployment-rate',
    intents: [
      { label: 'The rate in the news', series: [
        { slug: 'unemployment-rate', role: 'Headline', why: 'Share of the labor force without a job and looking for one (U-3). The number in the jobs report.' },
        { slug: 'unemployment-u6', role: 'Broadest', why: 'Adds people who gave up looking and part-timers who want full-time work. Often called “the real unemployment rate”.' },
      ] },
      { label: 'How many people', series: [
        { slug: 'unemployed-persons', role: 'Count', why: 'The number of people, not a share.' },
      ] },
      { label: 'For groups of people', note: 'Published by BLS for each group; nothing is computed.', series: [
        { slug: 'unemployment-rate--black', short: 'Black', role: 'Race', why: 'Black or African American, 16 and over.' },
        { slug: 'unemployment-rate--hispanic', short: 'Hispanic or Latino', role: 'Ethnicity', why: 'Hispanic or Latino, of any race.' },
        { slug: 'unemployment-rate--white', short: 'White', role: 'Race', why: 'White, 16 and over.' },
        { slug: 'unemployment-rate--asian', short: 'Asian', role: 'Race', why: 'Asian, from 2003.' },
        { slug: 'unemployment-rate--women', short: 'Women', role: 'Sex', why: 'Women, 16 and over.' },
        { slug: 'unemployment-rate--men', short: 'Men', role: 'Sex', why: 'Men, 16 and over.' },
        { slug: 'unemployment-rate--16-19', short: 'Ages 16–19', role: 'Age', why: 'Teenagers, 16 to 19.' },
        { slug: 'unemployment-rate--bachelors', short: 'Bachelor’s degree +', role: 'Education', why: 'Bachelor’s degree or higher, 25 and over.' },
        { slug: 'unemployment-rate--black-women', short: 'Black women', role: 'Combined', why: 'Black women, 16 and over.' },
      ] },
    ],
    missing: ['“The economy added 150,000 jobs”: payroll employment, from a different BLS survey (CES), is not loaded yet.'],
    events: ['recessions'],
  },
  {
    id: 'inflation',
    label: 'Inflation',
    aliases: ['prices', 'cost of living', 'inflation rate', 'cpi', 'pce', 'core inflation', 'groceries', 'price of eggs', 'affordability'],
    heard: '“Consumer prices rose … percent over the last year” (BLS, mid-month)',
    headline: 'cpi',
    intents: [
      { label: 'Consumer prices', series: [
        { slug: 'cpi', role: 'Headline', why: 'The cost of a fixed basket of what city households buy. The news reports its change over twelve months.' },
        { slug: 'cpi-core', role: 'Core', why: 'Leaves out food and energy, whose prices swing the most.' },
      ] },
      { label: 'What the Fed watches', series: [
        { slug: 'pce-price', role: 'Fed’s measure', why: 'All consumer spending, including what employers and government pay for. The Fed’s 2 percent target is for this index.' },
        { slug: 'pce-price-core', role: 'Core', why: 'Without food and energy.' },
      ] },
    ],
    missing: ['“Inflation was 2.9 percent” is a 12-month change. BLS prints it in its release, but GovGraph holds the index only and computes nothing of its own; the percent-change series would have to be loaded as published.',
      'Prices of single items (eggs, rent) are separate BLS series, not loaded.'],
  },
  {
    id: 'gas',
    label: 'Gas & oil prices',
    aliases: ['gas', 'gas prices', 'gasoline', 'fuel', 'pump', 'oil', 'oil prices', 'crude', 'diesel', 'energy prices', 'drill baby drill'],
    heard: '“Gas is averaging $4.35 a gallon” (EIA, Mondays) · “Oil is near $100 a barrel” (spot prices, daily)',
    headline: 'gasoline-retail',
    intents: [
      { label: 'At the pump', series: [
        { slug: 'gasoline-retail', role: 'Headline', why: 'Regular gasoline, U.S. average, weekly.' },
        { slug: 'diesel-retail', role: 'Diesel', why: 'What trucking and farming pay.' },
      ] },
      { label: 'Crude oil', series: [
        { slug: 'wti-spot', role: 'U.S. benchmark', why: 'West Texas Intermediate, per barrel, daily.' },
        { slug: 'brent-spot', role: 'World benchmark', why: 'Brent, from the North Sea, per barrel, daily.' },
      ] },
    ],
  },
  {
    id: 'fed',
    label: 'Interest rates & the Fed',
    aliases: ['fed', 'the fed', 'interest rates', 'rates', 'rate cut', 'rate hike', 'fomc', 'federal funds', 'powell', 'treasury yields', 'bonds', '10-year'],
    heard: '“The Fed raised rates by a quarter point” (FOMC statement, eight meetings a year)',
    headline: 'fed-funds',
    intents: [
      { label: 'The Fed’s rate', series: [
        { slug: 'fed-funds', role: 'Headline', why: 'What banks pay each other overnight; drawn inside the FOMC’s target range.', band: ['fed-target-lower', 'fed-target-upper'] },
      ] },
      { label: 'Market rates', series: [
        { slug: 'treasury-10y', role: '10-year', why: 'Sets the pace for mortgages and long loans.' },
        { slug: 'treasury-2y', role: '2-year', why: 'Moves with where the Fed is expected to go.' },
        { slug: 'mortgage-rate', role: 'Mortgages', why: '30-year fixed, Freddie Mac’s weekly survey.' },
      ] },
    ],
    events: ['fomc'],
  },
  {
    id: 'taxes',
    label: 'Taxes',
    aliases: ['tax', 'irs', 'tax revenue', 'tax cuts', 'tax rates', 'tax the rich', 'fair share', 'who pays', 'income tax',
      'corporate tax', 'corporate taxes', 'tax day', 'withholding', 'refunds', 'tax refund', 'tcja', 'trump tax cuts', 'bush tax cuts', 'big beautiful bill'],
    heard: '“The rich don’t pay their fair share” · “The top earners pay most of the taxes” · “Corporate tax receipts fell after the 2017 cut” · “Tariffs are a tax”',
    headline: 'mts-total-receipts',
    intents: [
      { label: 'How much the government collects', series: [
        { slug: 'mts-total-receipts', role: 'Monthly', why: 'All federal receipts each month (Treasury). Swings with tax deadlines.' },
        { slug: 'omb-receipts', role: 'Yearly', why: 'By fiscal year (OMB Historical Tables), the figure budget debates use.' },
        { slug: 'omb-receipts-gdp', role: 'Share of the economy', why: 'Receipts as a percent of GDP, as OMB prints it.' },
        { slug: 'federal-tax-receipts', role: 'Quarterly', why: 'Taxes only, each quarter at a yearly pace (BEA, national accounts).' },
      ] },
      { label: 'Income taxes, people and companies', series: [
        { slug: 'mts-individual-income-taxes', role: 'Individuals, monthly', why: 'Withheld and paid with returns, less refunds.' },
        { slug: 'mts-corporation-income-taxes', role: 'Corporations, monthly', why: 'Less refunds; can go negative.' },
        { slug: 'omb-individual-gdp', role: 'Individuals, % of GDP', why: 'Yearly, OMB.' },
        { slug: 'omb-corporate-gdp', role: 'Corporations, % of GDP', why: 'Yearly, OMB. Behind “corporations don’t pay their fair share”.' },
      ] },
      { label: 'Tax rates and who pays', series: [
        { slug: 'irs-top-rate', role: 'Top rate', why: 'The rate on the highest bracket (“the top rate is 37 percent”). IRS, to 2018.' },
        { slug: 'cbo-tax-rate--highest', role: 'Top fifth', why: 'Average federal tax rate of the highest-income fifth of households. CBO, to 2022.' },
        { slug: 'cbo-tax-rate--middle', role: 'Middle fifth', why: 'The middle class, as CBO measures it.' },
        { slug: 'cbo-tax-rate--lowest', role: 'Bottom fifth', why: 'The lowest-income fifth.' },
        { slug: 'cbo-tax-share--highest', role: 'Share paid by top fifth', why: 'Share of all federal taxes the top fifth pays.' },
      ] },
      { label: 'Refunds and paychecks', series: [
        { slug: 'mts-individual-refunds', role: 'Refunds', why: 'Income tax refunds paid each month: the spring wave.' },
        { slug: 'dts-withheld', role: 'Daily withholding', why: 'Income and payroll tax taken from paychecks, each business day, as published.' },
      ] },
    ],
    related: ['tariffs', 'debt'],
    events: ['tax-laws'],
    missing: ['State and local taxes are not collected.', '“The top 1 percent” is a different CBO and IRS table; the quintiles are loaded.'],
  },
  {
    id: 'tariffs',
    label: 'Tariffs',
    aliases: ['tariff', 'tariffs', 'customs', 'duties', 'trade war', 'liberation day', 'reciprocal tariffs', 'tariff revenue', 'effective tariff rate', 'smoot-hawley', 'trade', 'trade deficit', 'imports'],
    heard: '“Tariff revenue hit a record $31 billion in a month” · “The highest average tariff since the 1930s”',
    headline: 'mts-customs-duties',
    intents: [
      { label: 'Tariff money collected', series: [
        { slug: 'mts-customs-duties', role: 'Headline', why: 'Customs duties received each month, less refunds (Treasury).' },
      ] },
      { label: 'The average tariff', series: [
        { slug: 'usitc-duties-ratio-total', role: 'Since 1891', why: 'Duties as a percent of all imports (USITC): the figure behind “highest since the 1930s”.' },
      ] },
      { label: 'Trade', series: [
        { slug: 'trade-balance-monthly', role: 'Trade deficit', why: 'Exports less imports of goods and services, monthly (Census).' },
      ] },
    ],
    events: ['tariff-actions'],
  },
  {
    id: 'debt',
    label: 'Debt & deficit',
    aliases: ['debt', 'national debt', 'deficit', 'budget', 'spending', 'government spending', 'debt ceiling', 'borrowing', 'balanced budget'],
    heard: '“The national debt passed $40 trillion” (Treasury, daily) · “The deficit was … percent of GDP” (yearly)',
    headline: 'debt-total',
    intents: [
      { label: 'The national debt', series: [
        { slug: 'debt-total', role: 'Headline', why: 'Everything owed, including to Social Security’s trust funds. Daily.' },
        { slug: 'debt-public', role: 'Held by the public', why: 'Leaves out what the government owes itself; the measure CBO uses.' },
      ] },
      { label: 'The deficit', series: [
        { slug: 'omb-surplus-gdp', role: 'Percent of GDP', why: 'Yearly surplus or deficit as OMB prints it.' },
        { slug: 'mts-deficit', role: 'Monthly', why: 'Treasury’s monthly figure; a deficit is positive.' },
      ] },
      { label: 'Spending', series: [
        { slug: 'mts-total-outlays', role: 'Monthly', why: 'Everything paid out each month.' },
        { slug: 'omb-outlays-gdp', role: 'Percent of GDP', why: 'Yearly, OMB.' },
      ] },
    ],
  },
  {
    id: 'economy',
    label: 'The economy (GDP)',
    aliases: ['economy', 'gdp', 'growth', 'recession', 'economic growth', 'output', 'consumer spending', 'vibes', 'sentiment', 'consumer confidence'],
    heard: '“The economy grew at a … annual rate last quarter” (BEA, about a month after each quarter)',
    headline: 'gdp-growth',
    intents: [
      { label: 'Growth', series: [
        { slug: 'gdp-growth', role: 'Headline', why: 'Real GDP, percent change from the quarter before, as BEA publishes it.' },
        { slug: 'gdp', role: 'Size', why: 'GDP in current dollars, at an annual rate.' },
        { slug: 'gdp-real', role: 'After inflation', why: 'In 2017 dollars.' },
      ] },
      { label: 'Households', series: [
        { slug: 'spending', role: 'Spending', why: 'Consumer spending, about two thirds of GDP.' },
        { slug: 'sentiment', role: 'Mood', why: 'University of Michigan’s consumer sentiment (not government data).' },
      ] },
    ],
    events: ['recessions'],
  },
  {
    id: 'housing',
    label: 'Housing',
    aliases: ['housing', 'home prices', 'house prices', 'homes', 'mortgage', 'mortgages', 'rent', 'housing affordability', 'homeownership', 'first-time buyers'],
    heard: '“Mortgage rates rose to 7.4 percent” (Freddie Mac, Thursdays)',
    headline: 'mortgage-rate',
    intents: [
      { label: 'Buying a home', series: [
        { slug: 'mortgage-rate', role: 'Headline', why: '30-year fixed, weekly.' },
        { slug: 'home-price', role: 'New homes', why: 'Median sales price of new houses (Census).' },
        { slug: 'house-prices', role: 'Price index', why: 'FHFA purchase-only index of all houses.' },
        { slug: 'hoam-share', role: 'Affordability', why: 'Cost of owning as a share of income (Atlanta Fed).' },
      ] },
      { label: 'Owning', series: [
        { slug: 'homeownership', role: 'Homeownership', why: 'Share of households that own (Census, quarterly).' },
      ] },
    ],
    missing: ['Rents and existing-home prices (NAR) are not loaded; NAR’s data is licensed.'],
  },
];

// Context drawn on every chart: presidencies, recessions (NBER) and hand-picked events. Events here are
// entered for the mocks; in the app they come from timelineEvents.
window.GG_CONTEXT = {
  presidents: [
    ['Reagan', 'R', '1981-01-20'], ['G. H. W. Bush', 'R', '1989-01-20'], ['Clinton', 'D', '1993-01-20'], ['G. W. Bush', 'R', '2001-01-20'],
    ['Obama', 'D', '2009-01-20'], ['Trump', 'R', '2017-01-20'], ['Biden', 'D', '2021-01-20'], ['Trump', 'R', '2025-01-20'],
  ],
  recessions: [['1980-02-01', '1980-07-31'], ['1981-08-01', '1982-11-30'], ['1990-08-01', '1991-03-31'], ['2001-04-01', '2001-11-30'],
    ['2008-01-01', '2009-06-30'], ['2020-03-01', '2020-04-30']],
  events: [
    { date: '1981-08-13', label: 'Economic Recovery Tax Act of 1981', ref: 'Pub. L. 97-34', set: 'tax-laws' },
    { date: '1986-10-22', label: 'Tax Reform Act of 1986', ref: 'Pub. L. 99-514', set: 'tax-laws' },
    { date: '1993-08-10', label: 'Omnibus Budget Reconciliation Act of 1993', ref: 'Pub. L. 103-66', set: 'tax-laws' },
    { date: '2001-06-07', label: 'Economic Growth and Tax Relief Reconciliation Act of 2001', ref: 'Pub. L. 107-16', set: 'tax-laws' },
    { date: '2009-02-17', label: 'American Recovery and Reinvestment Act of 2009', ref: 'Pub. L. 111-5', set: 'relief' },
    { date: '2017-12-22', label: 'Tax Cuts and Jobs Act', ref: 'Pub. L. 115-97', set: 'tax-laws' },
    { date: '2020-03-27', label: 'CARES Act', ref: 'Pub. L. 116-136', set: 'relief' },
    { date: '2021-03-11', label: 'American Rescue Plan Act of 2021', ref: 'Pub. L. 117-2', set: 'relief' },
    { date: '2022-08-16', label: 'Inflation Reduction Act of 2022', ref: 'Pub. L. 117-169', set: 'tax-laws' },
    { date: '2025-04-02', label: 'Reciprocal tariffs ordered', ref: 'E.O. 14257', set: 'tariff-actions' },
    { date: '2025-07-04', label: 'One Big Beautiful Bill Act', ref: 'Pub. L. 119-21', set: 'tax-laws' },
  ],
  eventSets: {
    'tax-laws': 'Tax laws', relief: 'Relief laws', 'tariff-actions': 'Tariff orders', fomc: 'Fed rate decisions', recessions: 'Recessions',
  },
};
