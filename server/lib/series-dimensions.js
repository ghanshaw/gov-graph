// What each economic series is, as dimensions: the measure (federal revenue, unemployment), the
// form it is printed in (an amount, a share of GDP, a rate), and the breakdowns that apply to that
// measure (which tax, which group of workers). Frequency, fiscal or calendar year and publisher are
// read from the series itself. The timeline's picker will offer only the combinations that exist.
//
// Labels follow the reader's idea of the thing, not each publisher's exact definition: BEA's
// "personal current taxes" and OMB's "individual income taxes" are both individual income taxes,
// and the description says how each differs. Series stored apart are separate series, never
// joined: two that share every dimension (the daily deposits before and after February 2023) are
// told apart by the years they cover.

// Every dimension and its values. A value may name a `parent`, for values that sit inside another
// (Medicare payroll taxes are payroll taxes).
import { NIPA_MEASURES, NIPA_EXTRA_DIMENSIONS, nipaSeries } from './nipa-series.js';

const V = (label, parent) => (parent ? { label, parent } : { label });
export const DIMENSIONS = {
  measure: { label: 'Measure', values: {} }, // filled from MEASURES below
  form: { label: 'Measured as', values: {
    level: V('Amount'), rate: V('Rate'), index: V('Index'), 'growth-rate': V('Growth rate'),
    'share-of-gdp': V('Share of GDP'), 'share-of-total': V('Share of the total'), 'share-of-income': V('Share of income'),
    'share-of-expected': V('Share of expected'), 'share-of-national-income': V('Share of national income'),
    'per-person': V('Per person'), 'per-employee': V('Per full-time employee'),
  } },
  adjustment: { label: 'Dollars', values: { nominal: V('Dollars of the day'), real: V('Adjusted for inflation') } },
  seasonal: { label: 'Seasonal adjustment', values: {
    sa: V('Seasonally adjusted'), saar: V('Seasonally adjusted, at annual rates'), nsa: V('Not seasonally adjusted'),
  } },

  // Read from the series, not labelled by hand.
  frequency: { label: 'How often', values: {
    daily: V('Daily'), weekly: V('Weekly'), 'four-week': V('Four-week average'), monthly: V('Monthly'), quarterly: V('Quarterly'), yearly: V('Yearly'), irregular: V('When changed'),
  } },
  year: { label: 'Year', values: { calendar: V('Calendar year'), fiscal: V('Fiscal year') } },
  publisher: { label: 'Source', values: {
    eia: V('EIA'), bls: V('BLS'), bea: V('BEA'), treasury: V('Treasury'), omb: V('OMB'), cbo: V('CBO'), irs: V('IRS'), usitc: V('USITC'),
    census: V('Census'), umich: V('U. of Michigan'), freddiemac: V('Freddie Mac'), fhfa: V('FHFA'), atlantafed: V('Atlanta Fed'),
    cdc: V('CDC'), fed: V('Federal Reserve'),
  } },

  // Breakdowns, each used by some measures.
  benchmark: { label: 'Benchmark', values: { wti: V('WTI (U.S.)'), brent: V('Brent (world)') } },
  fuel: { label: 'Fuel', values: { gasoline: V('Regular gasoline'), diesel: V('Diesel') } },
  product: { label: 'Product', values: {
    all: V('All petroleum products'), distillate: V('Diesel and heating oil', 'all'), gasoline: V('Gasoline', 'all'), 'jet-fuel': V('Jet fuel', 'all'),
  } },
  definition: { label: 'Definition', values: { u3: V('Official rate (U-3)'), u6: V('Broad rate (U-6)') } },
  sex: { label: 'Sex', values: { men: V('Men'), women: V('Women') } },
  race: { label: 'Race and ethnicity', values: { white: V('White'), black: V('Black'), asian: V('Asian'), hispanic: V('Hispanic') } },
  age: { label: 'Age', values: {
    '16-19': V('16–19'), '20-24': V('20–24'), '25-34': V('25–34'), '35-44': V('35–44'), '45-54': V('45–54'), '55-over': V('55 and over'),
  } },
  education: { label: 'Education', values: {
    'no-diploma': V('No high school diploma'), 'high-school': V('High school, no college'), 'some-college': V('Some college'),
    bachelors: V('College graduates'),
  } },
  price_index: { label: 'Index', values: { cpi: V('Consumer Price Index'), pce: V('PCE price index') } },
  scope: { label: 'Items', values: { 'all-items': V('All items'), core: V('Core (without food and energy)') } },
  homes: { label: 'Homes', values: { existing: V('Existing homes'), new: V('New homes') } },
  term: { label: 'Term', values: { '30-year': V('30-year') } },
  interest_rate: { label: 'Rate', values: {
    'federal-funds': V('Federal funds rate'), 'federal-funds-target': V('Fed’s target for the federal funds rate'), prime: V('Prime rate'),
    'treasury-2y': V('2-year Treasury'), 'treasury-10y': V('10-year Treasury'),
  } },
  bound: { label: 'End of range', values: { lower: V('Lower end'), upper: V('Upper end') } },
  cause: { label: 'Cause of death', values: { 'covid-19': V('COVID-19'), 'all-causes': V('All causes') } },
  holder: { label: 'Held by', values: { all: V('Everyone (total debt)'), public: V('The public', 'all') } },
  revenue_source: { label: 'Revenue', values: {
    all: V('All revenue'),
    'all-current': V('Current revenue (taxes, contributions, income on assets)', 'all'),
    taxes: V('All taxes', 'all'),
    'individual-income': V('Individual income taxes', 'taxes'),
    'individual-income-and-payroll': V('Income and payroll taxes together', 'taxes'),
    'corporate-income': V('Corporate income taxes', 'taxes'),
    business: V('Business taxes', 'taxes'),
    payroll: V('Payroll taxes', 'taxes'),
    'social-security-medicare': V('Social Security and Medicare taxes', 'payroll'),
    'social-security-retirement': V('Social Security retirement taxes', 'social-security-medicare'),
    'social-security-disability': V('Social Security disability taxes', 'social-security-medicare'),
    medicare: V('Medicare taxes', 'social-security-medicare'),
    'unemployment-insurance': V('Unemployment insurance taxes', 'payroll'),
    'railroad-retirement': V('Railroad retirement taxes', 'payroll'),
    'federal-employee-retirement': V('Federal employee retirement contributions', 'payroll'),
    excise: V('Excise taxes', 'taxes'),
    alcohol: V('Alcohol taxes', 'excise'),
    tobacco: V('Tobacco taxes', 'excise'),
    highway: V('Highway and transit taxes (gas tax)', 'excise'),
    airport: V('Airport and airway taxes', 'excise'),
    'estate-gift': V('Estate and gift taxes', 'taxes'),
    'estate-gift-other': V('Estate, gift and other IRS taxes', 'taxes'),
    customs: V('Tariffs (customs duties)', 'taxes'),
    'from-abroad': V('Taxes paid from abroad', 'taxes'),
    'fed-reserve-earnings': V('Federal Reserve earnings', 'all'),
    miscellaneous: V('Miscellaneous revenue (mostly Federal Reserve earnings)', 'all'),
    other: V('Other revenue', 'all'),
  } },
  flow: { label: 'Counted', values: {
    net: V('After refunds'), gross: V('Before refunds'), refunds: V('Refunds'), deposits: V('Deposited that day'),
  } },
  payment: { label: 'Paid', values: {
    withheld: V('Withheld from paychecks'), 'paid-directly': V('Paid directly'),
    'paid-directly-electronic': V('Paid directly, electronically', 'paid-directly'), 'paid-directly-other': V('Paid directly, other means', 'paid-directly'),
  } },
  program: { label: 'Program', values: {
    'economic-impact-payments': V('Economic Impact Payments (stimulus checks)'), 'advance-child-tax-credit': V('Advance Child Tax Credit'),
  } },
  function: { label: 'Spent on', values: {
    all: V('All spending'), defense: V('National defense', 'all'), international: V('International affairs', 'all'),
    science: V('Science, space and technology', 'all'), energy: V('Energy', 'all'), environment: V('Natural resources and environment', 'all'),
    agriculture: V('Agriculture', 'all'), 'commerce-housing': V('Commerce and housing credit', 'all'), transportation: V('Transportation', 'all'),
    community: V('Community development', 'all'), education: V('Education and social services', 'all'), health: V('Health, excluding Medicare', 'all'),
    medicare: V('Medicare', 'all'), 'income-security': V('Income security', 'all'), 'social-security': V('Social Security', 'all'),
    veterans: V('Veterans', 'all'), justice: V('Justice', 'all'), 'general-government': V('General government', 'all'),
    'net-interest': V('Net interest on the debt', 'all'), 'offsetting-receipts': V('Offsetting receipts', 'all'),
  } },
  sign: { label: 'Sign', values: { 'deficit-negative': V('A deficit is negative'), 'deficit-positive': V('A deficit is positive') } },
  rate_kind: { label: 'Tax rate', values: {
    average: V('Average rate (taxes as a share of income)'), 'top-statutory': V('Top bracket rate'), 'bottom-statutory': V('Lowest bracket rate'),
  } },
  income_group: { label: 'Households', values: {
    all: V('All households'), 'lowest-quintile': V('Lowest fifth', 'all'), 'second-quintile': V('Second fifth', 'all'),
    'middle-quintile': V('Middle fifth', 'all'), 'fourth-quintile': V('Fourth fifth', 'all'), 'highest-quintile': V('Highest fifth', 'all'),
    '81-90': V('81st–90th percentiles', 'highest-quintile'), '91-95': V('91st–95th percentiles', 'highest-quintile'),
    '96-99': V('96th–99th percentiles', 'highest-quintile'), 'top-1': V('Top 1 percent', 'highest-quintile'),
  } },
  base: { label: 'Of', values: { 'all-imports': V('All imports'), 'dutiable-imports': V('Imports subject to tariffs') } },
  goods_services: { label: 'Trade in', values: { all: V('Goods and services'), goods: V('Goods', 'all'), services: V('Services', 'all') } },
};

// Each measure and the breakdowns that apply to it. `form`, `adjustment` and `seasonal` apply to all.
export const MEASURES = {
  'prices/fuel-prices/crude-oil-price': { label: 'Crude oil price', dims: ['benchmark'] },
  'prices/fuel-prices/fuel-price-at-the-pump': { label: 'Fuel price at the pump', dims: ['fuel'] },
  'energy-and-utilities/crude-oil-petroleum/oil-demand': { label: 'Oil demand', dims: ['product'] },
  'labor-force-employment-and-earnings/unemployed-persons/unemployment': { label: 'Unemployment', dims: ['definition', 'sex', 'race', 'age', 'education'] },
  // A measure is one thing measured in one place (GLOSSARY.md), keyed by that place: its Statistical Abstract category
  // and its name. Where the Abstract prints a measure's series in two subsections they are two measures, which may share a
  // name (Consumer prices: the CPI, and the PCE index under Price Indexes).
  'prices/consumer-price-indexes-cost-of-living-index/consumer-prices': { label: 'Consumer prices', dims: ['price_index', 'scope'] },
  'prices/price-indexes/consumer-prices': { label: 'Consumer prices', dims: ['price_index', 'scope'] },
  'income-expenditures-poverty-and-wealth/gross-domestic-product-gdp/consumer-spending': { label: 'Consumer spending', dims: [] },
  'business-enterprise/economic-indicators/consumer-sentiment': { label: 'Consumer sentiment', dims: [] },
  'banking-finance-and-insurance/money-stock-interest-rates-bond-yields/mortgage-rate': { label: 'Mortgage rate', dims: ['term'] },
  'construction-and-housing/housing-sales/home-prices': { label: 'Home prices', dims: ['homes'] },
  'prices/consumer-price-indexes-cost-of-living-index/home-prices': { label: 'Home prices', dims: ['homes'] },
  'construction-and-housing/homeownership-and-housing-costs/home-affordability': { label: 'Home affordability', dims: [] },
  'construction-and-housing/homeownership-and-housing-costs/homeownership': { label: 'Homeownership', dims: [] },
  'income-expenditures-poverty-and-wealth/household-income/household-income': { label: 'Household income', dims: [] },
  'banking-finance-and-insurance/money-stock-interest-rates-bond-yields/interest-rates': { label: 'Interest rates', dims: ['interest_rate', 'bound'] },
  'births-deaths-marriages-and-divorces/deaths/deaths': { label: 'Deaths', dims: ['cause'] },
  'income-expenditures-poverty-and-wealth/gross-domestic-product-gdp/gdp': { label: 'GDP', dims: [] },
  'federal-government-finances-and-employment/federal-budget-receipts-outlays-and-debt/federal-debt': { label: 'Federal debt', dims: ['holder'] },
  'federal-government-finances-and-employment/federal-budget-receipts-outlays-and-debt/federal-revenue': { label: 'Federal revenue', dims: ['revenue_source', 'flow', 'payment'] },
  'federal-government-finances-and-employment/federal-individual-income-tax-returns/tax-credit-payments': { label: 'Tax credit payments', dims: ['program'] },
  'federal-government-finances-and-employment/federal-budget-receipts-outlays-and-debt/federal-spending': { label: 'Federal spending', dims: ['function'] },
  'federal-government-finances-and-employment/federal-budget-receipts-outlays-and-debt/federal-budget-balance': { label: 'Federal budget balance', dims: ['sign'] },
  'federal-government-finances-and-employment/federal-individual-income-tax-returns/tax-rates': { label: 'Tax rates', dims: ['rate_kind', 'income_group'] },
  'federal-government-finances-and-employment/federal-individual-income-tax-returns/share-of-federal-taxes-paid': { label: 'Share of federal taxes paid', dims: ['income_group'] },
  'federal-government-finances-and-employment/federal-individual-income-tax-returns/where-the-top-tax-rate-starts': { label: 'Where the top tax rate starts', dims: [] },
  'foreign-commerce-and-aid/exports-and-imports/average-tariff-rate': { label: 'Average tariff rate', dims: ['base'] },
  'foreign-commerce-and-aid/exports-and-imports/exports': { label: 'Exports', dims: ['goods_services'] },
  'foreign-commerce-and-aid/exports-and-imports/imports': { label: 'Imports', dims: ['goods_services'] },
  'foreign-commerce-and-aid/exports-and-imports/trade-balance': { label: 'Trade balance', dims: ['goods_services'] },
};
// The national accounts' measures and their breakdowns (lib/nipa-series.js): a measure already above gains the breakdown.
const NIPA = nipaSeries();
Object.assign(DIMENSIONS, NIPA_EXTRA_DIMENSIONS);
for (const [id, d] of Object.entries(NIPA.dimensions)) DIMENSIONS[id] = { label: d.label, values: { ...(DIMENSIONS[id]?.values ?? {}), ...d.values } };
for (const m of NIPA_MEASURES) {
  const dims = [m.dim, ...(m.dims ?? [])];
  if (MEASURES[m.key]) MEASURES[m.key].dims = [...new Set([...MEASURES[m.key].dims, ...dims])];
  else MEASURES[m.key] = { label: m.label, dims };
}
for (const [key, m] of Object.entries(MEASURES)) DIMENSIONS.measure.values[key] = V(m.label);

const COMMON = ['measure', 'form', 'adjustment', 'seasonal'];
const DERIVED = ['frequency', 'year', 'publisher'];

// The labels, by slug. Unemployment by group and CBO's tax rates and shares are read from their slugs below.
const rev = (revenue_source, flow, more) => ({ measure: 'federal-government-finances-and-employment/federal-budget-receipts-outlays-and-debt/federal-revenue', form: 'level', revenue_source, flow, ...more });
const share = (revenue_source, form) => ({ measure: 'federal-government-finances-and-employment/federal-budget-receipts-outlays-and-debt/federal-revenue', form, revenue_source, flow: 'net' });
const spend = fn => ({ measure: 'federal-government-finances-and-employment/federal-budget-receipts-outlays-and-debt/federal-spending', form: 'level', function: fn, seasonal: 'nsa' });
// Trade measures sit in Foreign Commerce and Aid → Exports And Imports; `name` is the last part of the key.
const trade = (name, goods_services, more) => ({ measure: `foreign-commerce-and-aid/exports-and-imports/${name}`, form: 'level', goods_services, ...more });
const NSA = { seasonal: 'nsa' };
const SAAR = { seasonal: 'saar' };
const REAL = { adjustment: 'real' };

const LABELS = {
  'wti-spot': { measure: 'prices/fuel-prices/crude-oil-price', form: 'level', benchmark: 'wti' },
  'brent-spot': { measure: 'prices/fuel-prices/crude-oil-price', form: 'level', benchmark: 'brent' },
  'gasoline-retail': { measure: 'prices/fuel-prices/fuel-price-at-the-pump', form: 'level', fuel: 'gasoline' },
  'diesel-retail': { measure: 'prices/fuel-prices/fuel-price-at-the-pump', form: 'level', fuel: 'diesel' },
  'demand-total-4wk': { measure: 'energy-and-utilities/crude-oil-petroleum/oil-demand', form: 'level', product: 'all' },
  'demand-distillate-4wk': { measure: 'energy-and-utilities/crude-oil-petroleum/oil-demand', form: 'level', product: 'distillate' },
  'demand-gasoline-4wk': { measure: 'energy-and-utilities/crude-oil-petroleum/oil-demand', form: 'level', product: 'gasoline' },
  'demand-jet-4wk': { measure: 'energy-and-utilities/crude-oil-petroleum/oil-demand', form: 'level', product: 'jet-fuel' },
  'demand-total-monthly': { measure: 'energy-and-utilities/crude-oil-petroleum/oil-demand', form: 'level', product: 'all' },
  'demand-distillate-monthly': { measure: 'energy-and-utilities/crude-oil-petroleum/oil-demand', form: 'level', product: 'distillate' },
  'demand-gasoline-monthly': { measure: 'energy-and-utilities/crude-oil-petroleum/oil-demand', form: 'level', product: 'gasoline' },
  'demand-jet-monthly': { measure: 'energy-and-utilities/crude-oil-petroleum/oil-demand', form: 'level', product: 'jet-fuel' },

  'unemployment-rate': { measure: 'labor-force-employment-and-earnings/unemployed-persons/unemployment', form: 'rate', definition: 'u3', seasonal: 'sa' },
  'unemployment-u6': { measure: 'labor-force-employment-and-earnings/unemployed-persons/unemployment', form: 'rate', definition: 'u6', seasonal: 'sa' },
  'unemployed-persons': { measure: 'labor-force-employment-and-earnings/unemployed-persons/unemployment', form: 'level', definition: 'u3', seasonal: 'sa' },

  cpi: { measure: 'prices/consumer-price-indexes-cost-of-living-index/consumer-prices', form: 'index', price_index: 'cpi', scope: 'all-items', ...NSA },
  'cpi-core': { measure: 'prices/consumer-price-indexes-cost-of-living-index/consumer-prices', form: 'index', price_index: 'cpi', scope: 'core', ...NSA },
  'pce-price': { measure: 'prices/price-indexes/consumer-prices', form: 'index', price_index: 'pce', scope: 'all-items', spending_on: 'dpcer', seasonal: 'sa' },
  'pce-price-core': { measure: 'prices/price-indexes/consumer-prices', form: 'index', price_index: 'pce', scope: 'core', seasonal: 'sa' },
  spending: { measure: 'income-expenditures-poverty-and-wealth/gross-domestic-product-gdp/consumer-spending', form: 'level', spending_on: 'dpcer', ...SAAR },
  'spending-real': { measure: 'income-expenditures-poverty-and-wealth/gross-domestic-product-gdp/consumer-spending', form: 'level', spending_on: 'dpcer', ...REAL, ...SAAR },
  sentiment: { measure: 'business-enterprise/economic-indicators/consumer-sentiment', form: 'index' },

  'mortgage-rate': { measure: 'banking-finance-and-insurance/money-stock-interest-rates-bond-yields/mortgage-rate', form: 'rate', term: '30-year' },
  'house-prices': { measure: 'prices/consumer-price-indexes-cost-of-living-index/home-prices', form: 'index', homes: 'existing', seasonal: 'sa' },
  'home-price': { measure: 'construction-and-housing/housing-sales/home-prices', form: 'level', homes: 'new', ...NSA },
  'hoam-share': { measure: 'construction-and-housing/homeownership-and-housing-costs/home-affordability', form: 'share-of-income' },
  'hoam-index': { measure: 'construction-and-housing/homeownership-and-housing-costs/home-affordability', form: 'index' },
  homeownership: { measure: 'construction-and-housing/homeownership-and-housing-costs/homeownership', form: 'rate' },
  'household-income': { measure: 'income-expenditures-poverty-and-wealth/household-income/household-income', form: 'level' },
  'household-income-real': { measure: 'income-expenditures-poverty-and-wealth/household-income/household-income', form: 'level', ...REAL },

  'fed-funds': { measure: 'banking-finance-and-insurance/money-stock-interest-rates-bond-yields/interest-rates', form: 'rate', interest_rate: 'federal-funds' },
  'fed-target-lower': { measure: 'banking-finance-and-insurance/money-stock-interest-rates-bond-yields/interest-rates', form: 'rate', interest_rate: 'federal-funds-target', bound: 'lower' },
  'fed-target-upper': { measure: 'banking-finance-and-insurance/money-stock-interest-rates-bond-yields/interest-rates', form: 'rate', interest_rate: 'federal-funds-target', bound: 'upper' },
  'treasury-10y': { measure: 'banking-finance-and-insurance/money-stock-interest-rates-bond-yields/interest-rates', form: 'rate', interest_rate: 'treasury-10y' },
  'treasury-2y': { measure: 'banking-finance-and-insurance/money-stock-interest-rates-bond-yields/interest-rates', form: 'rate', interest_rate: 'treasury-2y' },
  'prime-rate': { measure: 'banking-finance-and-insurance/money-stock-interest-rates-bond-yields/interest-rates', form: 'rate', interest_rate: 'prime' },

  'covid-deaths': { measure: 'births-deaths-marriages-and-divorces/deaths/deaths', form: 'level', cause: 'covid-19' },
  'deaths-vs-expected': { measure: 'births-deaths-marriages-and-divorces/deaths/deaths', form: 'share-of-expected', cause: 'all-causes' },

  gdp: { measure: 'income-expenditures-poverty-and-wealth/gross-domestic-product-gdp/gdp', form: 'level', gdp_component: 'a191r', ...SAAR },
  'gdp-real': { measure: 'income-expenditures-poverty-and-wealth/gross-domestic-product-gdp/gdp', form: 'level', gdp_component: 'a191r', ...REAL, ...SAAR },
  'gdp-growth': { measure: 'income-expenditures-poverty-and-wealth/gross-domestic-product-gdp/gdp', form: 'growth-rate', gdp_component: 'a191r', ...REAL, ...SAAR },
  'debt-total': { measure: 'federal-government-finances-and-employment/federal-budget-receipts-outlays-and-debt/federal-debt', form: 'level', holder: 'all' },
  'debt-public': { measure: 'federal-government-finances-and-employment/federal-budget-receipts-outlays-and-debt/federal-debt', form: 'level', holder: 'public' },

  // BEA, NIPA Table 3.2
  'federal-total-receipts': rev('all', 'net', SAAR),
  'federal-current-receipts': rev('all-current', 'net', SAAR),
  'federal-tax-receipts': rev('taxes', 'net', SAAR),
  'federal-personal-taxes': rev('individual-income', 'net', SAAR),
  'federal-corporate-taxes': rev('corporate-income', 'net', SAAR),
  'federal-excise-taxes': rev('excise', 'net', SAAR),
  'federal-taxes-rest-of-world': rev('from-abroad', 'net', SAAR),
  'federal-social-contributions': rev('payroll', 'net', SAAR),
  'federal-customs-duties': rev('customs', 'net', SAAR),
  'federal-customs-duties-annual': rev('customs', 'net'),
  'federal-total-expenditures': { ...spend('all'), ...SAAR },
  'federal-net-borrowing': { measure: 'federal-government-finances-and-employment/federal-budget-receipts-outlays-and-debt/federal-budget-balance', form: 'level', sign: 'deficit-negative', ...SAAR },

  // Monthly Treasury Statement
  'mts-total-receipts': rev('all', 'net', NSA),
  'mts-individual-income-taxes': rev('individual-income', 'net', NSA),
  'mts-corporation-income-taxes': rev('corporate-income', 'net', NSA),
  'mts-employment-retirement': rev('social-security-medicare', 'net', NSA),
  'mts-unemployment-insurance': rev('unemployment-insurance', 'net', NSA),
  'mts-other-retirement': rev('federal-employee-retirement', 'net', NSA),
  'mts-excise-taxes': rev('excise', 'net', NSA),
  'mts-estate-gift-taxes': rev('estate-gift', 'net', NSA),
  'mts-miscellaneous-receipts': rev('miscellaneous', 'net', NSA),
  'mts-customs-duties': rev('customs', 'net', NSA),
  'mts-total-gross': rev('all', 'gross', NSA),
  'mts-total-refunds': rev('all', 'refunds', NSA),
  'mts-individual-gross': rev('individual-income', 'gross', NSA),
  'mts-individual-refunds': rev('individual-income', 'refunds', NSA),
  'mts-corporate-gross': rev('corporate-income', 'gross', NSA),
  'mts-corporate-refunds': rev('corporate-income', 'refunds', NSA),
  'mts-excise-gross': rev('excise', 'gross', NSA),
  'mts-excise-refunds': rev('excise', 'refunds', NSA),
  'mts-estate-gift-gross': rev('estate-gift', 'gross', NSA),
  'mts-estate-gift-refunds': rev('estate-gift', 'refunds', NSA),
  'mts-social-insurance-gross': rev('payroll', 'gross', NSA),
  'mts-social-insurance-refunds': rev('payroll', 'refunds', NSA),
  'mts-customs-gross': rev('customs', 'gross', NSA),
  'mts-customs-refunds': rev('customs', 'refunds', NSA),
  'mts-total-outlays': spend('all'),
  'mts-outlays-defense': spend('defense'),
  'mts-outlays-international': spend('international'),
  'mts-outlays-science': spend('science'),
  'mts-outlays-energy': spend('energy'),
  'mts-outlays-environment': spend('environment'),
  'mts-outlays-agriculture': spend('agriculture'),
  'mts-outlays-commerce-housing': spend('commerce-housing'),
  'mts-outlays-transportation': spend('transportation'),
  'mts-outlays-community': spend('community'),
  'mts-outlays-education': spend('education'),
  'mts-outlays-health': spend('health'),
  'mts-outlays-medicare': spend('medicare'),
  'mts-outlays-income-security': spend('income-security'),
  'mts-outlays-social-security': spend('social-security'),
  'mts-outlays-veterans': spend('veterans'),
  'mts-outlays-justice': spend('justice'),
  'mts-outlays-general-government': spend('general-government'),
  'mts-outlays-net-interest': spend('net-interest'),
  'mts-outlays-offsetting-receipts': spend('offsetting-receipts'),
  'mts-deficit': { measure: 'federal-government-finances-and-employment/federal-budget-receipts-outlays-and-debt/federal-budget-balance', form: 'level', sign: 'deficit-positive', ...NSA },

  // Daily Treasury Statement: deposits (Table II from February 14, 2023; Table IV before)
  'dts-withheld': rev('individual-income-and-payroll', 'deposits', { payment: 'withheld', ...NSA }),
  'dts-nonwithheld-electronic': rev('individual-income', 'deposits', { payment: 'paid-directly-electronic', ...NSA }),
  'dts-nonwithheld-other': rev('individual-income', 'deposits', { payment: 'paid-directly-other', ...NSA }),
  'dts-corporate': rev('corporate-income', 'deposits', NSA),
  'dts-excise': rev('excise', 'deposits', NSA),
  'dts-estate-gift': rev('estate-gift', 'deposits', NSA),
  'dts-irs-estate-gift-misc': rev('estate-gift-other', 'deposits', NSA),
  'dts-futa': rev('unemployment-insurance', 'deposits', NSA),
  'dts-railroad': rev('railroad-retirement', 'deposits', NSA),
  'dts-iv-withheld': rev('individual-income-and-payroll', 'deposits', { payment: 'withheld', ...NSA }),
  'dts-iv-individual': rev('individual-income', 'deposits', { payment: 'paid-directly', ...NSA }),
  'dts-iv-corporate': rev('corporate-income', 'deposits', NSA),
  'dts-iv-excise': rev('excise', 'deposits', NSA),
  'dts-iv-estate-gift': rev('estate-gift-other', 'deposits', NSA),
  'dts-iv-futa': rev('unemployment-insurance', 'deposits', NSA),
  'dts-iv-railroad': rev('railroad-retirement', 'deposits', NSA),
  'dts-customs': rev('customs', 'deposits', NSA),
  'dts-customs-dhs': rev('customs', 'deposits', NSA),
  'dts-customs-old': rev('customs', 'deposits', NSA),
  // Daily Treasury Statement: withdrawals
  'dts-refunds-individual': rev('individual-income', 'refunds', NSA),
  'dts-refunds-business': rev('business', 'refunds', NSA),
  'dts-old-refunds-individual': rev('individual-income', 'refunds', NSA),
  'dts-old-refunds-business': rev('business', 'refunds', NSA),
  'dts-economic-impact-payments': { measure: 'federal-government-finances-and-employment/federal-individual-income-tax-returns/tax-credit-payments', form: 'level', program: 'economic-impact-payments', ...NSA },
  'dts-advance-child-tax-credit': { measure: 'federal-government-finances-and-employment/federal-individual-income-tax-returns/tax-credit-payments', form: 'level', program: 'advance-child-tax-credit', ...NSA },

  // OMB Historical Tables, by fiscal year
  'omb-receipts': rev('all', 'net'),
  'omb-receipts-gdp': share('all', 'share-of-gdp'),
  'omb-outlays': spend('all'),
  'omb-outlays-gdp': { measure: 'federal-government-finances-and-employment/federal-budget-receipts-outlays-and-debt/federal-spending', form: 'share-of-gdp', function: 'all' },
  'omb-surplus': { measure: 'federal-government-finances-and-employment/federal-budget-receipts-outlays-and-debt/federal-budget-balance', form: 'level', sign: 'deficit-negative' },
  'omb-surplus-gdp': { measure: 'federal-government-finances-and-employment/federal-budget-receipts-outlays-and-debt/federal-budget-balance', form: 'share-of-gdp', sign: 'deficit-negative' },
  'omb-individual': rev('individual-income', 'net'),
  'omb-corporate': rev('corporate-income', 'net'),
  'omb-social-insurance': rev('payroll', 'net'),
  'omb-excise': rev('excise', 'net'),
  'omb-other': rev('other', 'net'),
  'omb-individual-share': share('individual-income', 'share-of-total'),
  'omb-corporate-share': share('corporate-income', 'share-of-total'),
  'omb-social-insurance-share': share('payroll', 'share-of-total'),
  'omb-excise-share': share('excise', 'share-of-total'),
  'omb-other-share': share('other', 'share-of-total'),
  'omb-individual-gdp': share('individual-income', 'share-of-gdp'),
  'omb-corporate-gdp': share('corporate-income', 'share-of-gdp'),
  'omb-social-insurance-gdp': share('payroll', 'share-of-gdp'),
  'omb-excise-gdp': share('excise', 'share-of-gdp'),
  'omb-other-gdp': share('other', 'share-of-gdp'),
  'omb-oasi': rev('social-security-retirement', 'net'),
  'omb-di': rev('social-security-disability', 'net'),
  'omb-hi': rev('medicare', 'net'),
  'omb-unemployment': rev('unemployment-insurance', 'net'),
  'omb-excise-alcohol': rev('alcohol', 'net'),
  'omb-excise-tobacco': rev('tobacco', 'net'),
  'omb-excise-transportation': rev('highway', 'net'),
  'omb-excise-airport': rev('airport', 'net'),
  'omb-estate-gift': rev('estate-gift', 'net'),
  'omb-fed-reserve': rev('fed-reserve-earnings', 'net'),
  'omb-customs': rev('customs', 'net'),

  // IRS Statistics of Income, Table 23
  'irs-top-rate': { measure: 'federal-government-finances-and-employment/federal-individual-income-tax-returns/tax-rates', form: 'rate', rate_kind: 'top-statutory' },
  'irs-bottom-rate': { measure: 'federal-government-finances-and-employment/federal-individual-income-tax-returns/tax-rates', form: 'rate', rate_kind: 'bottom-statutory' },
  'irs-top-bracket': { measure: 'federal-government-finances-and-employment/federal-individual-income-tax-returns/where-the-top-tax-rate-starts', form: 'level' },

  // USITC duties table. Whether "duties collected" is after refunds is not stated, so no `flow`.
  'usitc-duties': { measure: 'federal-government-finances-and-employment/federal-budget-receipts-outlays-and-debt/federal-revenue', form: 'level', revenue_source: 'customs' },
  'usitc-duties-ratio-total': { measure: 'foreign-commerce-and-aid/exports-and-imports/average-tariff-rate', form: 'rate', base: 'all-imports' },
  'usitc-duties-ratio-dutiable': { measure: 'foreign-commerce-and-aid/exports-and-imports/average-tariff-rate', form: 'rate', base: 'dutiable-imports' },
  'usitc-imports': trade('imports', 'goods'),

  // Trade: BEA (quarterly at annual rates, and yearly) and Census (FT-900, monthly and yearly)
  'bea-exports': trade('exports', 'all', SAAR),
  'bea-imports': trade('imports', 'all', SAAR),
  'bea-net-exports': trade('trade-balance', 'all', SAAR),
  'bea-exports-goods': trade('exports', 'goods', SAAR),
  'bea-exports-services': trade('exports', 'services', SAAR),
  'bea-imports-goods': trade('imports', 'goods', SAAR),
  'bea-imports-services': trade('imports', 'services', SAAR),
  'bea-exports-annual': trade('exports', 'all'),
  'bea-imports-annual': trade('imports', 'all'),
  'bea-net-exports-annual': trade('trade-balance', 'all'),
};
for (const period of ['monthly', 'annual']) {
  const more = period === 'monthly' ? { seasonal: 'sa' } : {};
  for (const [kind, measure] of [['balance', 'trade-balance'], ['exports', 'exports'], ['imports', 'imports']]) {
    LABELS[`trade-${kind}-${period}`] = trade(measure, 'all', more);
    LABELS[`trade-${kind}-goods-${period}`] = trade(measure, 'goods', more);
    LABELS[`trade-${kind}-services-${period}`] = trade(measure, 'services', more);
  }
}

const CBO_GROUPS = { all: 'all', lowest: 'lowest-quintile', second: 'second-quintile', middle: 'middle-quintile', fourth: 'fourth-quintile',
  highest: 'highest-quintile', '81-90': '81-90', '91-95': '91-95', '96-99': '96-99', 'top-1': 'top-1' };

// Labels read from a series' own fields: unemployment by group, CBO by income group.
function readLabels(s) {
  if (s.breakdown) {
    const { of, ages, ...dims } = s.breakdown;
    return { measure: 'labor-force-employment-and-earnings/unemployed-persons/unemployment', form: of === 'unemployment-rate' ? 'rate' : 'level', definition: 'u3', seasonal: 'sa', ...dims };
  }
  const cbo = s.slug.match(/^cbo-tax-(rate|share)--(.+)$/);
  if (cbo) {
    const income_group = CBO_GROUPS[cbo[2]];
    return cbo[1] === 'rate' ? { measure: 'federal-government-finances-and-employment/federal-individual-income-tax-returns/tax-rates', form: 'rate', rate_kind: 'average', income_group }
      : { measure: 'federal-government-finances-and-employment/federal-individual-income-tax-returns/share-of-federal-taxes-paid', form: 'share-of-total', income_group };
  }
  return null;
}

const FREQUENCY = { daily: 'daily', weekly: 'weekly', 'four-week-average': 'four-week', monthly: 'monthly', quarterly: 'quarterly',
  annual: 'yearly', 'fiscal-year': 'yearly', irregular: 'irregular' };
const PUBLISHER = { eia: 'eia', bls: 'bls', 'bls-bulk': 'bls', bea: 'bea', treasury: 'treasury', 'treasury-mts': 'treasury',
  'treasury-mts-1': 'treasury', 'treasury-mts-4': 'treasury', 'treasury-dts': 'treasury', 'treasury-dts-iv': 'treasury', omb: 'omb',
  cbo: 'cbo', 'irs-soi': 'irs', usitc: 'usitc', census: 'census', 'census-nrs': 'census', 'census-trade': 'census', umich: 'umich',
  freddiemac: 'freddiemac', fhfa: 'fhfa', atlantafed: 'atlantafed', cdc: 'cdc', 'fed-h15': 'fed', 'fed-omo': 'fed' };
const DOLLARS = /^\$/;

// A NIPA line's twin (lib/nipa-series.js) is labelled as the hand-written series at its other frequency; a yearly
// value is not seasonally adjusted.
function twinLabels(s) {
  const labels = { ...LABELS[s.twin_of] };
  if (!labels.measure) return null;
  if (s.frequency === 'annual') delete labels.seasonal;
  return labels;
}

/** A series' dimensions: its labels, plus what is read from the series (frequency, year, publisher; dollars of the day unless labelled real). */
export function seriesDimensions(s) {
  const labels = LABELS[s.slug] ?? (s.twin_of ? twinLabels(s) : s.labels) ?? readLabels(s);
  if (!labels) return null;
  const dims = { ...labels, frequency: FREQUENCY[s.frequency], publisher: PUBLISHER[s.source] };
  if (s.frequency === 'fiscal-year') dims.year = 'fiscal';
  else if (s.frequency === 'annual') dims.year = 'calendar';
  if (DOLLARS.test(s.unit) && !dims.adjustment) dims.adjustment = 'nominal';
  return dims;
}

/** What is wrong with the labels of these series: unlabelled, unknown values, a breakdown the measure does not have, a form its unit contradicts. */
export function dimensionProblems(series) {
  const problems = [];
  const slugs = new Set(series.map(s => s.slug));
  for (const slug of Object.keys(LABELS)) if (!slugs.has(slug)) problems.push(`${slug}: labelled but not a series`);
  for (const s of series) {
    const dims = seriesDimensions(s);
    if (!dims) { problems.push(`${s.slug}: not labelled`); continue; }
    const measure = MEASURES[dims.measure];
    if (!measure) { problems.push(`${s.slug}: unknown measure ${dims.measure}`); continue; }
    if (!dims.form) problems.push(`${s.slug}: no form`);
    const allowed = new Set([...COMMON, ...DERIVED, ...measure.dims]);
    for (const [dim, value] of Object.entries(dims)) {
      if (!allowed.has(dim)) problems.push(`${s.slug}: ${dims.measure} has no ${dim}`);
      else if (!DIMENSIONS[dim]?.values[value]) problems.push(`${s.slug}: ${dim} has no value ${value}`);
    }
    const percent = ['rate', 'growth-rate', 'share-of-gdp', 'share-of-total', 'share-of-income', 'share-of-expected', 'share-of-national-income'].includes(dims.form);
    if (percent !== (s.unit === '%')) problems.push(`${s.slug}: form ${dims.form} but unit ${s.unit}`);
    if ((dims.form === 'index') !== (s.unit === 'index')) problems.push(`${s.slug}: form ${dims.form} but unit ${s.unit}`);
    if (dims.adjustment && !DOLLARS.test(s.unit) && dims.form !== 'growth-rate') problems.push(`${s.slug}: adjustment on a series not in dollars`);
  }
  return problems;
}

/** Series that share every dimension, as lists of slugs: told apart only by the years they cover. */
export function sameDimensions(series) {
  const groups = new Map();
  for (const s of series) {
    const dims = seriesDimensions(s);
    if (!dims) continue;
    const key = JSON.stringify(Object.entries(dims).sort());
    groups.set(key, [...(groups.get(key) ?? []), s.slug]);
  }
  return [...groups.values()].filter(g => g.length > 1);
}
