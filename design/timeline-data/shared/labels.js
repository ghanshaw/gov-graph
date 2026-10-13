// Every dataset's name as a reader sees it, in the two conventions being compared (NAMING.md).
//
//   [phrase, measure, qualifier]
//   phrase    → x.1.1 "reads as a phrase":    "Monthly Individual Income Taxes"
//   measure + qualifier → x.1.2 "measure first": "Individual Income Taxes: Monthly"
//
// One name per dataset, used everywhere (search, chips, lanes, legends, the cursor card). It must make
// sense with nothing around it: no "Yearly" or "Top fifth" that only reads under a heading.

window.GG_LABELS = {
  'unemployment-rate': ['Unemployment Rate', 'Unemployment Rate'],
  'unemployment-u6': ['Broad Unemployment Rate (U-6)', 'Unemployment Rate', 'Broad Measure (U-6)'],
  'unemployed-persons': ['Number of Unemployed People', 'Unemployed People', 'Number'],
  'unemployment-rate--black': ['Unemployment Rate for Black Workers', 'Unemployment Rate', 'Black Workers'],
  'unemployment-rate--hispanic': ['Unemployment Rate for Hispanic Workers', 'Unemployment Rate', 'Hispanic Workers'],
  'unemployment-rate--white': ['Unemployment Rate for White Workers', 'Unemployment Rate', 'White Workers'],
  'unemployment-rate--asian': ['Unemployment Rate for Asian Workers', 'Unemployment Rate', 'Asian Workers'],
  'unemployment-rate--women': ['Unemployment Rate for Women', 'Unemployment Rate', 'Women'],
  'unemployment-rate--men': ['Unemployment Rate for Men', 'Unemployment Rate', 'Men'],
  'unemployment-rate--16-19': ['Unemployment Rate for Teenagers (16–19)', 'Unemployment Rate', 'Teenagers (16–19)'],
  'unemployment-rate--bachelors': ['Unemployment Rate for College Graduates', 'Unemployment Rate', 'College Graduates'],
  'unemployment-rate--black-women': ['Unemployment Rate for Black Women', 'Unemployment Rate', 'Black Women'],

  cpi: ['Consumer Price Index (CPI)', 'Consumer Price Index (CPI)', 'All Items'],
  'cpi-core': ['Core Consumer Price Index', 'Consumer Price Index (CPI)', 'Core'],
  'pce-price': ['PCE Price Index (The Fed’s Inflation Measure)', 'PCE Price Index', 'All Items'],
  'pce-price-core': ['Core PCE Price Index', 'PCE Price Index', 'Core'],

  'fed-funds': ['Federal Funds Rate', 'Federal Funds Rate'],
  'fed-target': ['The Fed’s Target Range', 'Federal Funds Rate', 'The Fed’s Target Range'],
  'treasury-10y': ['10-Year Treasury Yield', 'Treasury Yield', '10-Year'],
  'treasury-2y': ['2-Year Treasury Yield', 'Treasury Yield', '2-Year'],
  'mortgage-rate': ['30-Year Mortgage Rate', 'Mortgage Rate', '30-Year Fixed'],

  'gasoline-retail': ['Regular Gas Price at the Pump', 'Pump Price', 'Regular Gasoline'],
  'diesel-retail': ['Diesel Price at the Pump', 'Pump Price', 'Diesel'],
  'wti-spot': ['U.S. Crude Oil Price (WTI)', 'Crude Oil Price', 'U.S. Benchmark (WTI)'],
  'brent-spot': ['World Crude Oil Price (Brent)', 'Crude Oil Price', 'World Benchmark (Brent)'],

  'mts-total-receipts': ['Monthly Federal Revenue', 'Federal Revenue', 'Monthly'],
  'omb-receipts': ['Yearly Federal Revenue', 'Federal Revenue', 'Yearly'],
  'omb-receipts-gdp': ['Federal Revenue as a Share of GDP', 'Federal Revenue', 'Share of GDP'],
  'federal-tax-receipts': ['Quarterly Federal Tax Revenue (Annualized)', 'Federal Tax Revenue', 'Quarterly, Annualized'],
  'mts-individual-income-taxes': ['Monthly Individual Income Taxes', 'Individual Income Taxes', 'Monthly'],
  'mts-corporation-income-taxes': ['Monthly Corporate Income Taxes', 'Corporate Income Taxes', 'Monthly'],
  'omb-individual-gdp': ['Individual Income Taxes as a Share of GDP', 'Individual Income Taxes', 'Share of GDP'],
  'omb-corporate-gdp': ['Corporate Income Taxes as a Share of GDP', 'Corporate Income Taxes', 'Share of GDP'],
  'irs-top-rate': ['Top Income Tax Rate', 'Income Tax Rate', 'Top Bracket'],
  'cbo-tax-rate--highest': ['Average Federal Tax Rate of the Highest Quintile', 'Average Federal Tax Rate', 'Highest Quintile'],
  'cbo-tax-rate--middle': ['Average Federal Tax Rate of the Middle Quintile', 'Average Federal Tax Rate', 'Middle Quintile'],
  'cbo-tax-rate--lowest': ['Average Federal Tax Rate of the Lowest Quintile', 'Average Federal Tax Rate', 'Lowest Quintile'],
  'cbo-tax-share--highest': ['Highest Quintile’s Share of Federal Taxes', 'Share of Federal Taxes Paid', 'Highest Quintile'],
  'mts-individual-refunds': ['Monthly Income Tax Refunds', 'Income Tax Refunds', 'Monthly'],
  'dts-withheld': ['Taxes Withheld from Paychecks', 'Taxes Withheld from Paychecks'],

  'mts-customs-duties': ['Monthly Tariff Revenue', 'Tariff Revenue', 'Monthly'],
  'usitc-duties-ratio-total': ['Average Tariff Rate on All Imports', 'Average Tariff Rate', 'All Imports'],
  'trade-balance-monthly': ['Monthly Trade Balance', 'Trade Balance', 'Monthly'],

  gdp: ['GDP (Annualized)', 'GDP', 'Annualized'],
  'gdp-real': ['GDP Adjusted for Inflation (Annualized)', 'GDP', 'Adjusted for Inflation, Annualized'],
  'gdp-growth': ['GDP Growth Rate (Adjusted for Inflation)', 'GDP Growth Rate', 'Adjusted for Inflation'],
  sentiment: ['Consumer Sentiment', 'Consumer Sentiment'],
  spending: ['Consumer Spending (Annualized)', 'Consumer Spending', 'Monthly, Annualized'],

  'debt-total': ['National Debt', 'National Debt', 'Total'],
  'debt-public': ['National Debt Held by the Public', 'National Debt', 'Held by the Public'],
  'mts-deficit': ['Monthly Federal Deficit', 'Federal Deficit', 'Monthly'],
  'omb-surplus-gdp': ['Federal Budget Balance as a Share of GDP', 'Federal Budget Balance', 'Share of GDP'],
  'mts-total-outlays': ['Monthly Federal Spending', 'Federal Spending', 'Monthly'],
  'omb-outlays-gdp': ['Federal Spending as a Share of GDP', 'Federal Spending', 'Share of GDP'],

  'home-price': ['Median Price of a New Home', 'Home Price', 'Median New Home'],
  'house-prices': ['Home Price Index (FHFA)', 'Home Price', 'Index of All Sales (FHFA)'],
  'hoam-share': ['Cost of Owning a Home as a Share of Income', 'Cost of Owning a Home', 'Share of Income'],
  homeownership: ['Homeownership Rate', 'Homeownership Rate'],
};

// The name under the convention in force (window.GG_NAMING: 'phrase' | 'measure').
window.GG_LABEL = (slug, naming = window.GG_NAMING ?? 'phrase') => {
  const l = window.GG_LABELS[slug];
  if (!l) return window.GG_SERIES[slug]?.name ?? slug;
  if (naming === 'phrase') return l[0];
  return l[2] ? `${l[1]}: ${l[2]}` : l[1];
};
