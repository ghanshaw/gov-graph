// Economic time series: which ones we keep, where their files live, how each publisher's rows are
// read, and how they are stored.
//
// A series is one published line of numbers (WTI daily spot price, the monthly unemployment rate,
// …); an observation is one value of it on one date. The tables are not specific to a subject, so
// other series need only an entry in SERIES.
//
// Sources:
//   eia  U.S. Energy Information Administration: the petroleum bulk file (PET.zip, no key; one JSON line per
//        series in PET.txt, updated weekly). A series is its id and frequency (RWTC daily is "PET.RWTC.D"; a
//        four-week average ends ".4"). The API v2 (with EIA_API_KEY) was used until 2026-10-13; same values.
//   bea  U.S. Bureau of Economic Analysis, the national accounts as flat files (no key): every
//        quarterly NIPA series in one file, by series code (A191RC = GDP in current dollars).
//   treasury  U.S. Treasury, Fiscal Data API (no key): Debt to the Penny, daily from April 1993.
//   umich     University of Michigan Surveys of Consumers (not a government agency): the Index of
//        Consumer Sentiment as a CSV of final monthly values, from 1952 (every few months until 1978).
//   census    Census Bureau tables published as .xlsx (read by lib/xlsx.js): household income
//        (CPS ASEC Table H-5) and homeownership rates (Housing Vacancy Survey Table 14).
//   census-nrs  Census Bureau New Residential Sales, the published history spreadsheet (no key): median and
//        average sales price of new homes, monthly from 1963 (price_cust.xlsx, sheet Monthly; dates are Excel
//        day numbers). The Census API (CENSUS_API_KEY) was used until 2026-10-13; same values.
//   freddiemac  Freddie Mac's Primary Mortgage Market Survey, weekly from 1971 (a CSV).
//   fhfa      Federal Housing Finance Agency House Price Index, every index in one CSV.
//   fed-h15   Federal Reserve Board H.15 Selected Interest Rates, the whole release (263 series,
//        SDMX XML in a zip) from the Data Download Program; a series is its SERIES_NAME.
//   fed-omo   the FOMC's target federal funds rate or range, from the Board's Open Market
//        Operations page (2003 on) and its archive (1990–2002), kept as published HTML. Stored as
//        the target's lower and upper bound on each date a change took effect ('irregular').
//   atlantafed  Federal Reserve Bank of Atlanta, Home Ownership Affordability Monitor (HOAM): the
//        national workbook (.xlsx), monthly from 2005; a series is a column, named by its heading.
//   cdc       CDC National Center for Health Statistics, provisional COVID-19 death counts by week
//        and state (data.cdc.gov r8kw-7aab), one CSV.
// Taxes (federal revenue; customs duties are with trade, below):
//   treasury-mts  Treasury's Monthly Treasury Statement, Table 9 (receipts by source), from the
//        Fiscal Data API (no key), monthly from FY 2015, in dollars.
//   treasury-mts-1  its Table 1: each month's receipts, outlays and deficit (printed positive) or surplus
//        (negative), as the statement for that month prints it.
//   treasury-mts-4  its Table 4: gross receipts, refunds and net receipts of each tax, monthly.
//   treasury-dts  Treasury's Daily Treasury Statement, tax deposits each business day, in millions:
//        the "Taxes - …" lines of Table II (Deposits and Withdrawals of Operating Cash) from
//        February 14, 2023, and Table IV (Federal Tax Deposits) from October 2005 to February 13, 2023,
//        when the statement was redesigned. Kept as two sets of series, not joined. Refunds paid
//        electronically (and the 2020–22 Economic Impact Payments and advance Child Tax Credit) are
//        Table II withdrawal lines (`withdrawal`), 2012 on.
//   omb       OMB Historical Tables (the President's Budget), .xlsx per table, by fiscal year, from
//        1934. A series is a column (`column`), or in Table 2.4, whose years run across, a row (`row`,
//        under the heading `under`). Rows marked "estimate" are projections and are not loaded.
//   cbo       CBO, The Distribution of Household Income (supplemental data, one table per tab):
//        average federal tax rates and shares of federal taxes by income group, 1979–2022. cbo.gov
//        refuses scripted requests, so the file comes from the Internet Archive (`archive`).
//   irs-soi   IRS Statistics of Income historical tables, old .xls (lib/xls.js): Table 23, the lowest
//        and highest individual income tax brackets, tax years 1913–2018.
// Every value is stored as the publisher printed it, in its own unit (dollars, millions, percent):
// nothing is rescaled, adjusted or joined.
// Sources read from one published file name it as `url`; the file is kept at its mirror path.
// Trade and tariffs:
//   usitc     U.S. International Trade Commission, "U.S. imports for consumption, duties collected, and
//        ratio of duties to value" (Table 1 of ave_table.pdf, a PDF only), 1891 on: fiscal years
//        (July–June) to 1917, calendar years from 1919; 1918 and 1930 are printed in parts. usitc.gov
//        refuses scripted requests, so the file comes from the Internet Archive (`archive`).
//   census-trade  Census Bureau, U.S. trade in goods and services on a balance of payments basis
//        (the FT-900 history), .xlsx: by year from 1960 (gands.xlsx) and by month, seasonally
//        adjusted, from 1992 (exhibit_history.xlsx). A series is a column.
//   BEA's exports, imports and their balance come from the same flat files as GDP, quarterly from
//   1947 and by year from 1929 (NipaDataA.txt); customs duties from NIPA Table 3.2.
//   bls-bulk  a series read from a BLS survey downloaded whole (fetch-bls-bulk.js): `file` names
//        the survey file that holds its whole history (cu.data.0.Current starts in 1997; the topic
//        files go back as far as the series does).
// Every series is stored as its publisher printed it: GovGraph computes no series of its own.

import path from 'path';
import { DATA_DIR, mirrorFile } from './data-dir.js';
import { nipaSeries, nameNipaSeries } from './nipa-series.js';
import { cpiSeries } from './cpi-series.js';

export const EIA_PET_BULK = 'https://www.eia.gov/opendata/bulk/PET.zip';
const EIA_FREQUENCY = { daily: 'D', weekly: 'W', 'four-week-average': '4', monthly: 'M' };
/** An EIA series' id in the bulk file: RWTC daily → "PET.RWTC.D". */
export const eiaBulkId = s => `PET.${s.source_id}.${EIA_FREQUENCY[s.frequency]}`;
export const BEA_FILES = ['NipaDataQ.txt', 'NipaDataM.txt', 'NipaDataA.txt', 'SeriesRegister.txt', 'TablesRegister.txt']
  .map(name => `https://apps.bea.gov/national/Release/TXT/${name}`);
export const BEA_QUARTERLY = BEA_FILES[0];
export const BEA_MONTHLY = BEA_FILES[1];
export const UMICH_SENTIMENT = 'https://www.sca.isr.umich.edu/files/tbmics.csv';
const CENSUS_INCOME = 'https://www2.census.gov/programs-surveys/cps/tables/time-series/historical-income-households/h05.xlsx';
const CENSUS_HOMEOWNERSHIP = 'https://www.census.gov/housing/hvs/data/histtab14.xlsx';
const FREDDIE_PMMS = 'https://www.freddiemac.com/pmms/docs/PMMS_history.csv';
const FHFA_HPI = 'https://www.fhfa.gov/hpi/download/monthly/hpi_master.csv';
export const FED_H15 = 'https://www.federalreserve.gov/datadownload/Output.aspx?rel=H15&filetype=zip';
export const FED_H15_FILE = () => path.join(DATA_DIR, 'federalreserve.gov', 'datadownload', 'H15_data.zip');
export const FED_OMO_PAGES = ['https://www.federalreserve.gov/monetarypolicy/openmarket.htm',
  'https://www.federalreserve.gov/monetarypolicy/openmarket_archive.htm'];
const ATLANTA_FED_HOAM = 'https://www.atlantafed.org/-/media/Project/Atlanta/FRBA/Documents/research-and-data/data/hoam/HOAM_US_Affordability_Index.xlsx';
export const USITC_DUTIES = 'https://www.usitc.gov/documents/dataweb/ave_table.pdf';
const CENSUS_TRADE_ANNUAL = 'https://www.census.gov/foreign-trade/statistics/historical/gands.xlsx';
const CENSUS_TRADE_MONTHLY = 'https://www.census.gov/foreign-trade/statistics/historical/exhibit_history.xlsx';
const CDC_COVID_DEATHS = 'https://data.cdc.gov/api/views/r8kw-7aab/rows.csv';
export const CDC_COVID_META = 'https://data.cdc.gov/api/views/r8kw-7aab.json';
/** Sources read from one published file (`url` on the series), downloaded whole. */
export const FILE_SOURCES = ['umich', 'census', 'census-nrs', 'freddiemac', 'fhfa', 'atlantafed', 'cdc', 'omb', 'cbo', 'irs-soi', 'usitc', 'census-trade'];
const FISCAL_DATA = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service';
export const DEBT_TO_PENNY = `${FISCAL_DATA}/v2/accounting/od/debt_to_penny`;
// Fiscal Data datasets kept whole (`filter`: the query a download is limited to, by field).
export const FISCAL_DATASETS = {
  'treasury-mts': { url: `${FISCAL_DATA}/v1/accounting/mts/mts_table_9`, name: 'Monthly Treasury Statement, Table 9' },
  'treasury-mts-1': { url: `${FISCAL_DATA}/v1/accounting/mts/mts_table_1`, name: 'Monthly Treasury Statement, Table 1' },
  'treasury-mts-4': { url: `${FISCAL_DATA}/v1/accounting/mts/mts_table_4`, name: 'Monthly Treasury Statement, Table 4' },
  'treasury-dts': { url: `${FISCAL_DATA}/v1/accounting/dts/deposits_withdrawals_operating_cash`, name: 'Daily Treasury Statement, Table II', filter: 'transaction_catg' },
  'treasury-dts-iv': { url: `${FISCAL_DATA}/v1/accounting/dts/federal_tax_deposits`, name: 'Daily Treasury Statement, Table IV' },
};
const OMB_TABLE = table => `https://www.whitehouse.gov/wp-content/uploads/2026/04/hist${table}_fy2027.xlsx`;
const CBO_DISTRIBUTION = 'https://www.cbo.gov/system/files/2026-01/61911-supplemental-data.xlsx';
const IRS_TABLE_23 = 'https://www.irs.gov/pub/irs-soi/histab23.xls';
// Kept with the others but not loaded: Table 24 lists the corporate brackets of each period of
// years (1909–2010), not one value a year.
export const IRS_TABLE_24 = 'https://www.irs.gov/pub/irs-soi/histabb.xls';

/**
 * slug: our own address for the series. source + source_id: where the publisher keeps it.
 * `description` is always written by GovGraph. The publisher's own title for the series, where its
 * files carry one, is read from them verbatim (publisherTitle) and stored separately.
 * BLS series are fetched from `from` (the first year published).
 */
// Breakdowns: the same measure for a group of people, each a series BLS publishes (seasonally adjusted,
// from the downloaded `ln` survey). A rate and a count share the id after the prefix
// (LNS14000008 = rate, LNS13000008 = count, Black women). `breakdown` names the group by dimension;
// each is a series of its own on the timeline. A combination BLS does not publish (Asian men) has no series.
const UNEMPLOYMENT_MEASURES = [
  { of: 'unemployment-rate', prefix: 'LNS14', name: 'Unemployment rate', unit: '%', title: who => `Unemployment Rate for ${who}` },
  { of: 'unemployed-persons', prefix: 'LNS13', name: 'Unemployed persons', unit: 'thousands', title: who => `Number of Unemployed ${who}` },
];
const B = (id, dims, who, ages = null) => ({ id, dims, who, ages });
const UNEMPLOYMENT_GROUPS = [
  B('000003', { race: 'white' }, 'White'),
  B('000006', { race: 'black' }, 'Black or African American'),
  B('032183', { race: 'asian' }, 'Asian'),
  B('000009', { race: 'hispanic' }, 'Hispanic or Latino'),
  B('000001', { sex: 'men' }, 'men'),
  B('000002', { sex: 'women' }, 'women'),
  B('000004', { race: 'white', sex: 'men' }, 'White men'),
  B('000005', { race: 'white', sex: 'women' }, 'White women'),
  B('000007', { race: 'black', sex: 'men' }, 'Black or African American men'),
  B('000008', { race: 'black', sex: 'women' }, 'Black or African American women'),
  B('000034', { race: 'hispanic', sex: 'men' }, 'Hispanic or Latino men', '20 years and over'),
  B('000035', { race: 'hispanic', sex: 'women' }, 'Hispanic or Latino women', '20 years and over'),
  B('000012', { age: '16-19' }, 'people', '16 to 19 years'),
  B('000036', { age: '20-24' }, 'people', '20 to 24 years'),
  B('000089', { age: '25-34' }, 'people', '25 to 34 years'),
  B('000091', { age: '35-44' }, 'people', '35 to 44 years'),
  B('000093', { age: '45-54' }, 'people', '45 to 54 years'),
  B('024230', { age: '55-over' }, 'people', '55 years and over'),
  B('000013', { age: '16-19', sex: 'men' }, 'men', '16 to 19 years'),
  B('000014', { age: '16-19', sex: 'women' }, 'women', '16 to 19 years'),
  B('000037', { age: '20-24', sex: 'men' }, 'men', '20 to 24 years'),
  B('000038', { age: '20-24', sex: 'women' }, 'women', '20 to 24 years'),
  B('000164', { age: '25-34', sex: 'men' }, 'men', '25 to 34 years'),
  B('000327', { age: '25-34', sex: 'women' }, 'women', '25 to 34 years'),
  B('000173', { age: '35-44', sex: 'men' }, 'men', '35 to 44 years'),
  B('000334', { age: '35-44', sex: 'women' }, 'women', '35 to 44 years'),
  B('000182', { age: '45-54', sex: 'men' }, 'men', '45 to 54 years'),
  B('000341', { age: '45-54', sex: 'women' }, 'women', '45 to 54 years'),
  B('024231', { age: '55-over', sex: 'men' }, 'men', '55 years and over'),
  B('024232', { age: '55-over', sex: 'women' }, 'women', '55 years and over'),
  B('000015', { age: '16-19', race: 'white' }, 'White people', '16 to 19 years'),
  B('000018', { age: '16-19', race: 'black' }, 'Black or African American people', '16 to 19 years'),
  B('000021', { age: '16-19', race: 'hispanic' }, 'Hispanic or Latino people', '16 to 19 years'),
  B('000016', { age: '16-19', race: 'white', sex: 'men' }, 'White men', '16 to 19 years'),
  B('000017', { age: '16-19', race: 'white', sex: 'women' }, 'White women', '16 to 19 years'),
  B('000019', { age: '16-19', race: 'black', sex: 'men' }, 'Black or African American men', '16 to 19 years'),
  B('000020', { age: '16-19', race: 'black', sex: 'women' }, 'Black or African American women', '16 to 19 years'),
  B('000022', { age: '16-19', race: 'hispanic', sex: 'men' }, 'Hispanic or Latino men', '16 to 19 years'),
  B('000023', { age: '16-19', race: 'hispanic', sex: 'women' }, 'Hispanic or Latino women', '16 to 19 years'),
  B('027659', { education: 'no-diploma' }, 'people without a high school diploma', '25 years and over'),
  B('027660', { education: 'high-school' }, 'high school graduates with no college', '25 years and over'),
  B('027689', { education: 'some-college' }, 'people with some college or an associate degree', '25 years and over'),
  B('027662', { education: 'bachelors' }, 'people with a bachelor\'s degree or higher', '25 years and over'),
];
const DIMENSION_ORDER = ['age', 'race', 'sex', 'education'];
// A group as its name says it (NAMING.md): "Black Women", "Workers Aged 16–19", "College Graduates".
// The exact BLS definition (16 and over, 25 and over, Hispanic of any race) is in the description.
const RACE_NAMES = { white: 'White', black: 'Black', asian: 'Asian', hispanic: 'Hispanic' };
const EDUCATION_NAMES = { 'no-diploma': 'Workers Without a High School Diploma', 'high-school': 'High School Graduates, No College',
  'some-college': 'Workers with Some College', bachelors: 'College Graduates' };
function groupName({ race, sex, age, education }) {
  if (education) return EDUCATION_NAMES[education];
  const who = race && sex ? `${RACE_NAMES[race]} ${sex === 'men' ? 'Men' : 'Women'}`
    : race ? `${RACE_NAMES[race]} Workers` : sex ? (sex === 'men' ? 'Men' : 'Women') : 'Workers';
  return age ? `${who} Aged ${age === '55-over' ? '55 and Over' : age.replace('-', '–')}` : who;
}
const unemploymentBreakdowns = () => UNEMPLOYMENT_MEASURES.flatMap(m => UNEMPLOYMENT_GROUPS.map(g => {
  const who = `${g.who}, ${g.ages ?? '16 years and over'}`;
  return {
    slug: `${m.of}--${DIMENSION_ORDER.filter(d => g.dims[d]).map(d => g.dims[d]).join('-')}`,
    source: 'bls-bulk', source_id: `${m.prefix}${g.id}`, frequency: 'monthly', file: 'ln/ln.data.1.AllData',
    name: m.title(groupName(g.dims)), category: 'unemployment', unit: m.unit,
    breakdown: { of: m.of, ...g.dims, ages: g.ages },
    description: `${m.name} for ${who}, seasonally adjusted. ${g.dims.race === 'hispanic' ? 'Hispanic or Latino people may be of any race. ' : ''}Current Population Survey`,
  };
}));

// Federal tax revenue. Each publisher's own lines, in its own units.
const bea = (slug, id, name, line, description) => ({
  slug, source: 'bea', source_id: id, frequency: 'quarterly', name, category: 'tax-receipts', unit: '$m',
  description: `${description}, in millions of dollars, seasonally adjusted at annual rates. NIPA Table 3.2, line ${line}`,
});
// Receipts lines are listed under "Receipts" (sequence 1.x), outlays under "Net Outlays" (2.x); an
// outlays line's source_id carries that heading, since both lists end in a "Total".
const MTS_OUTLAYS = 'Net Outlays: ';
const mts = (slug, line, name, description) => ({
  slug, source: 'treasury-mts', source_id: line, frequency: 'monthly', name, category: 'tax-receipts', unit: '$',
  description: `${description}, in dollars, as received in the month (not seasonally adjusted). Monthly Treasury Statement, Table 9`,
});
const mtsOutlays = (slug, line, name, description) => ({
  slug, source: 'treasury-mts', source_id: `${MTS_OUTLAYS}${line}`, frequency: 'monthly', name, category: 'outlays', unit: '$',
  description: `${description}, in dollars, paid out in the month, net of offsetting receipts. Monthly Treasury Statement, Table 9`,
});
// Table 4: one tax's gross receipts or refunds (`field`), named in source_id by the publisher's field label.
const MTS_4_FIELDS = { gross: ['current_month_gross_rcpt_amt', 'Current Month Gross Receipts Amount'], refunds: ['current_month_refund_amt', 'Current Month Refund Amount'] };
const mts4 = (slug, line, kind, name, description) => ({
  slug, source: 'treasury-mts-4', source_id: `${line}: ${MTS_4_FIELDS[kind][1]}`, line, field: MTS_4_FIELDS[kind][0],
  frequency: 'monthly', name, category: 'tax-refunds', unit: '$',
  description: `${description}, in dollars, in the month. Monthly Treasury Statement, Table 4`,
});
const dtsRefund = (slug, line, name, description, from) => ({
  slug, source: 'treasury-dts', source_id: line, withdrawal: true, frequency: 'daily', name, category: 'tax-refunds', unit: '$m',
  description: `${description}, in millions of dollars, paid that business day by electronic transfer (refunds by check are not in this line). Daily Treasury Statement, Table II, ${from}`,
});
const dts = (slug, source, line, name, description) => ({
  slug, source, source_id: line, frequency: 'daily', name, category: 'tax-deposits', unit: '$m',
  description: `${description}, in millions of dollars, deposited that business day. Daily Treasury Statement, ${source === 'treasury-dts' ? 'Table II, from February 14, 2023' : 'Table IV (Federal Tax Deposits), October 2005 to February 13, 2023'}`,
});
const omb = (slug, table, at, name, unit, description) => ({
  slug, source: 'omb', source_id: `Table ${table.replace(/^0/, '').replace('z', '.')}: ${at.label}`, url: OMB_TABLE(table),
  frequency: 'fiscal-year', name, category: 'tax-history', unit, ...at,
  description: `${description}. OMB Historical Tables, Table ${table.replace(/^0/, '').replace('z', '.')}; by fiscal year (October–September from 1977, July–June before; the 1976 transition quarter, July–September, is its own value)`,
});
// [key, column, OMB's heading, what (for the description), the source as named: in dollars, and as a share]
const OMB_SOURCES = [
  ['individual', 1, 'Individual Income Taxes', 'Individual income taxes', 'Yearly Individual Income Taxes', 'Individual Income Taxes'],
  ['corporate', 2, 'Corporation Income Taxes', 'Corporation income taxes', 'Yearly Corporate Income Taxes', 'Corporate Income Taxes'],
  ['social-insurance', 3, 'Social Insurance and Retirement Receipts', 'Social insurance and retirement receipts (payroll taxes)', 'Yearly Payroll Taxes', 'Payroll Taxes'],
  ['excise', 6, 'Excise Taxes', 'Excise taxes', 'Yearly Excise Taxes', 'Excise Taxes'],
  ['other', 7, 'Other', 'Other receipts (estate and gift taxes, customs duties, Federal Reserve earnings and the rest)', 'Yearly Other Federal Revenue', 'Other Revenue'],
];
// [key, CBO's row label, who (for the description), the group as named: "of …" and "…’s"]
const CBO_GROUPS = [
  ['all', 'All quintiles', 'all households', 'All Households', 'All Households’'],
  ['lowest', 'Lowest quintile', 'the lowest fifth of households by income', 'the Lowest Quintile', 'Lowest Quintile’s'],
  ['second', 'Second quintile', 'the second fifth', 'the Second Quintile', 'Second Quintile’s'],
  ['middle', 'Middle quintile', 'the middle fifth', 'the Middle Quintile', 'Middle Quintile’s'],
  ['fourth', 'Fourth quintile', 'the fourth fifth', 'the Fourth Quintile', 'Fourth Quintile’s'],
  ['highest', 'Highest quintile', 'the highest fifth', 'the Highest Quintile', 'Highest Quintile’s'],
  ['81-90', '81st to 90th percentiles', 'households in the 81st to 90th percentiles', 'the 81st–90th Percentiles', '81st–90th Percentiles’'],
  ['91-95', '91st to 95th percentiles', 'households in the 91st to 95th percentiles', 'the 91st–95th Percentiles', '91st–95th Percentiles’'],
  ['96-99', '96th to 99th percentiles', 'households in the 96th to 99th percentiles', 'the 96th–99th Percentiles', '96th–99th Percentiles’'],
  ['top-1', 'Top 1 percent', 'the top 1 percent', 'the Top 1 Percent', 'Top 1 Percent’s'],
];
const cbo = (measure, sheet, what) => CBO_GROUPS.map(([key, group, who, of, whose]) => ({
  slug: `cbo-${measure}--${key}`, source: 'cbo', source_id: `${sheet}: ${group}, Federal taxes`, url: CBO_DISTRIBUTION,
  archive: '20260620001727', sheet, group, column: 2, frequency: 'annual', category: 'tax-rates', unit: '%',
  name: what === 'Average federal tax rate' ? `Average Federal Tax Rate of ${of}` : `${whose} Share of Federal Taxes`,
  description: `${what === 'Average federal tax rate'
    ? `Federal taxes paid by ${who} (individual income, payroll, corporate and excise taxes) as a percent of their income before transfers and taxes`
    : `The share of all federal taxes paid by ${who}`}, by calendar year. CBO, The Distribution of Household Income, 2022 (January 2026), supplemental data`,
}));
const irs = (slug, column, label, name, unit, description) => ({
  slug, source: 'irs-soi', source_id: `Table 23: ${label}`, url: IRS_TABLE_23, column, frequency: 'annual',
  name, category: 'tax-rates', unit,
  description: `${description}, by tax year. IRS Statistics of Income, Historical Table 23 (1913–2018; not updated since)`,
});

const TAX_SERIES = [
  bea('federal-current-receipts', 'W005RC', 'Quarterly Federal Current Revenue (Annualized)', 1, 'All current receipts of the federal government: taxes, social insurance contributions, income on assets and transfers'),
  bea('federal-tax-receipts', 'W006RC', 'Quarterly Federal Tax Revenue (Annualized)', 2, 'Taxes received by the federal government'),
  bea('federal-personal-taxes', 'A074RC', 'Quarterly Personal Taxes (Annualized)', 3, 'Taxes on personal income, mostly the individual income tax'),
  bea('federal-corporate-taxes', 'B075RC', 'Quarterly Corporate Income Taxes (Annualized)', 8, 'Taxes on corporate income received by the federal government'),
  bea('federal-excise-taxes', 'B234RC', 'Quarterly Excise Taxes (Annualized)', 5, 'Federal excise taxes (fuel, alcohol, tobacco, air travel and others)'),
  bea('federal-taxes-rest-of-world', 'W008RC', 'Quarterly Taxes Paid from Abroad (Annualized)', 9, 'Taxes paid to the federal government from abroad'),
  bea('federal-social-contributions', 'W780RC', 'Quarterly Payroll Taxes (Annualized)', 10, 'Contributions for government social insurance: Social Security, Medicare and unemployment payroll taxes'),
  bea('federal-total-receipts', 'W018RC', 'Quarterly Federal Revenue (Annualized)', 40, 'All federal receipts, current and capital'),
  { ...bea('federal-total-expenditures', 'W019RC', 'Quarterly Federal Spending (Annualized)', 43, 'All federal expenditures, current and capital'), category: 'outlays' },
  { ...bea('federal-net-borrowing', 'AD02RC', 'Quarterly Federal Budget Balance (Annualized)', 49, 'Total receipts less total expenditures as BEA prints it: net borrowing (a deficit) is negative'), category: 'outlays' },

  mts('mts-total-receipts', 'Total', 'Monthly Federal Revenue', 'All federal receipts in the month'),
  mts('mts-individual-income-taxes', 'Individual Income Taxes', 'Monthly Individual Income Taxes', 'Individual income taxes received in the month, withheld and paid with returns, less refunds'),
  mts('mts-corporation-income-taxes', 'Corporation Income Taxes', 'Monthly Corporate Income Taxes', 'Corporation income taxes received in the month, less refunds (negative in some months)'),
  mts('mts-employment-retirement', 'Employment and General Retirement', 'Monthly Payroll Taxes (Social Security and Medicare)', 'Social Security and Medicare payroll taxes and railroad retirement received in the month'),
  mts('mts-unemployment-insurance', 'Unemployment Insurance', 'Monthly Unemployment Insurance Taxes', 'Unemployment insurance taxes received in the month'),
  mts('mts-other-retirement', 'Other Retirement', 'Monthly Federal Employee Retirement Contributions', 'Federal employees\' retirement contributions received in the month'),
  mts('mts-excise-taxes', 'Excise Taxes', 'Monthly Excise Taxes', 'Excise taxes received in the month'),
  mts('mts-estate-gift-taxes', 'Estate and Gift Taxes', 'Monthly Estate and Gift Taxes', 'Estate and gift taxes received in the month'),
  mts('mts-miscellaneous-receipts', 'Miscellaneous Receipts', 'Monthly Miscellaneous Revenue', 'Miscellaneous receipts in the month, chiefly the Federal Reserve\'s deposits of its earnings'),

  // [key, Table 4 line, what (for the description), name before refunds, name of the refunds]
  ...[['total', 'Total -- Receipts', 'All receipts', 'Federal Revenue', 'Tax Refunds, All Federal Revenue'],
    ['individual', 'Total -- Individual Income Taxes', 'Individual income taxes', 'Individual Income Taxes', 'Individual Income Tax Refunds'],
    ['corporate', 'Corporation Income Taxes', 'Corporation income taxes', 'Corporate Income Taxes', 'Corporate Income Tax Refunds'],
    ['excise', 'Total -- Excise Taxes', 'Excise taxes', 'Excise Taxes', 'Excise Tax Refunds'],
    ['estate-gift', 'Estate and Gift Taxes', 'Estate and gift taxes', 'Estate and Gift Taxes', 'Estate and Gift Tax Refunds'],
    ['social-insurance', 'Total -- Social Insurance and Retirement Receipts', 'Social insurance and retirement receipts', 'Payroll Taxes', 'Payroll Tax Refunds']]
    .flatMap(([key, line, what, gross, refunds]) => [
      mts4(`mts-${key}-gross`, line, 'gross', `Monthly ${gross} Before Refunds`, `${what} received before refunds`),
      mts4(`mts-${key}-refunds`, line, 'refunds', `Monthly ${refunds}`, `Refunds of ${what.toLowerCase()} paid`),
    ]),
  dtsRefund('dts-refunds-individual', 'Taxes - Individual Tax Refunds (EFT)', 'Daily Individual Tax Refunds (Since 2023)', 'Individual income tax refunds', 'from February 14, 2023'),
  dtsRefund('dts-refunds-business', 'Taxes - Business Tax Refunds (EFT)', 'Daily Business Tax Refunds (Since 2023)', 'Business tax refunds', 'from February 14, 2023'),
  dtsRefund('dts-old-refunds-individual', 'IRS Tax Refunds Individual (EFT)', 'Daily Individual Tax Refunds (2012–2023)', 'Individual income tax refunds', 'October 2012 to February 13, 2023'),
  dtsRefund('dts-old-refunds-business', 'IRS Tax Refunds Business (EFT)', 'Daily Business Tax Refunds (2012–2023)', 'Business tax refunds', 'October 2012 to February 13, 2023'),
  dtsRefund('dts-economic-impact-payments', 'IRS - Economic Impact Payments (EFT)', 'Economic Impact Payments (Stimulus Checks)', 'COVID-19 Economic Impact Payments paid through the IRS (payments, not refunds of tax paid; the line begins December 24, 2020, after the first round)', 'December 2020 to September 2022'),
  dtsRefund('dts-advance-child-tax-credit', 'IRS - Advanced Child Tax Credit (EFT)', 'Advance Child Tax Credit Payments', 'Advance Child Tax Credit payments paid through the IRS (payments, not refunds of tax paid)', 'July 2021 to September 2022'),

  mtsOutlays('mts-total-outlays', 'Total', 'Monthly Federal Spending', 'All federal outlays in the month'),
  // [Table 9 line (the budget function), key, name]
  ...[['National Defense', 'defense', 'Spending on National Defense'], ['International Affairs', 'international', 'Spending on International Affairs'],
    ['General Science, Space, and Technology', 'science', 'Spending on Science, Space and Technology'], ['Energy', 'energy', 'Spending on Energy'],
    ['Natural Resources and Environment', 'environment', 'Spending on Natural Resources and Environment'], ['Agriculture', 'agriculture', 'Spending on Agriculture'],
    ['Commerce and Housing Credit', 'commerce-housing', 'Spending on Commerce and Housing Credit'], ['Transportation', 'transportation', 'Spending on Transportation'],
    ['Community and Regional Development', 'community', 'Spending on Community Development'],
    ['Education, Training, Employment, and Social Services', 'education', 'Spending on Education and Social Services'],
    ['Health', 'health', 'Spending on Health, Excluding Medicare'], ['Medicare', 'medicare', 'Spending on Medicare'],
    ['Income Security', 'income-security', 'Spending on Income Security'], ['Social Security', 'social-security', 'Spending on Social Security'],
    ['Veterans Benefits and Services', 'veterans', 'Spending on Veterans'], ['Administration of Justice', 'justice', 'Spending on Justice'],
    ['General Government', 'general-government', 'Spending on General Government'], ['Net Interest', 'net-interest', 'Net Interest on the National Debt'],
    ['Undistributed Offsetting Receipts', 'offsetting-receipts', 'Offsetting Receipts']]
    .map(([line, key, name]) => mtsOutlays(`mts-outlays-${key}`, line, `Monthly ${name}`, `Outlays for ${line.toLowerCase()}${key === 'offsetting-receipts' ? ' (receipts counted against outlays, so negative)' : ''}`)),
  {
    slug: 'mts-deficit', source: 'treasury-mts-1', source_id: 'Current Month Deficit Surplus Amount', frequency: 'monthly',
    name: 'Monthly Federal Deficit', category: 'outlays', unit: '$',
    description: 'Outlays less receipts in the month as Treasury prints it: a deficit is positive and a surplus negative (OMB and BEA print the opposite sign), in dollars. Monthly Treasury Statement, Table 1, from the statement for that month',
  },

  dts('dts-withheld', 'treasury-dts', 'Taxes - Withheld Individual/FICA', 'Taxes Withheld from Paychecks (Since 2023)', 'Income tax and Social Security and Medicare (FICA) tax withheld from paychecks'),
  dts('dts-nonwithheld-electronic', 'treasury-dts', 'Taxes - Non Withheld Ind/SECA Electronic', 'Individual Taxes Paid Directly, Electronic', 'Individual income and self-employment taxes paid directly (estimated payments and payments with returns), electronically'),
  dts('dts-nonwithheld-other', 'treasury-dts', 'Taxes - Non Withheld Ind/SECA Other', 'Individual Taxes Paid Directly, Other Means', 'Individual income and self-employment taxes paid directly, by other means'),
  dts('dts-corporate', 'treasury-dts', 'Taxes - Corporate Income', 'Daily Corporate Income Taxes (Since 2023)', 'Corporate income taxes'),
  dts('dts-excise', 'treasury-dts', 'Taxes - Miscellaneous Excise', 'Daily Excise Taxes (Since 2023)', 'Excise taxes'),
  dts('dts-estate-gift', 'treasury-dts', 'Taxes - Estate and Gift', 'Daily Estate and Gift Taxes (Since 2023)', 'Estate and gift taxes'),
  dts('dts-irs-estate-gift-misc', 'treasury-dts', 'Taxes - IRS Collected Estate, Gift, misc', 'Daily Estate, Gift and Other IRS Taxes (Since 2023)', 'Estate, gift and miscellaneous taxes collected by the IRS'),
  dts('dts-futa', 'treasury-dts', 'Taxes - Federal Unemployment (FUTA)', 'Daily Federal Unemployment Tax (Since 2023)', 'Federal unemployment (FUTA) tax'),
  dts('dts-railroad', 'treasury-dts', 'Taxes - Railroad Retirement', 'Daily Railroad Retirement Taxes (Since 2023)', 'Railroad retirement taxes'),
  dts('dts-iv-withheld', 'treasury-dts-iv', 'Withheld Income and Employment Taxes', 'Taxes Withheld from Paychecks (2005–2023)', 'Income and employment taxes withheld from paychecks'),
  dts('dts-iv-individual', 'treasury-dts-iv', 'Individual Income Taxes', 'Daily Individual Taxes Paid Directly (2005–2023)', 'Individual income taxes paid directly'),
  dts('dts-iv-corporate', 'treasury-dts-iv', 'Corporation Income Taxes', 'Daily Corporate Income Taxes (2005–2023)', 'Corporation income taxes'),
  dts('dts-iv-excise', 'treasury-dts-iv', 'Excise Taxes', 'Daily Excise Taxes (2005–2023)', 'Excise taxes'),
  dts('dts-iv-estate-gift', 'treasury-dts-iv', 'Estate and Gift Taxes & Misc IRS Rcpts.', 'Daily Estate, Gift and Other IRS Taxes (2005–2023)', 'Estate and gift taxes and miscellaneous IRS receipts'),
  dts('dts-iv-futa', 'treasury-dts-iv', 'Federal Unemployment Taxes', 'Daily Federal Unemployment Tax (2005–2023)', 'Federal unemployment taxes'),
  dts('dts-iv-railroad', 'treasury-dts-iv', 'Railroad Retirement Taxes', 'Daily Railroad Retirement Taxes (2005–2023)', 'Railroad retirement taxes'),

  omb('omb-receipts', '01z1', { label: 'Total, Receipts', column: 1 }, 'Yearly Federal Revenue', '$m', 'All federal receipts in the fiscal year, in millions of dollars'),
  omb('omb-outlays', '01z1', { label: 'Total, Outlays', column: 2, category: 'outlays' }, 'Yearly Federal Spending', '$m', 'All federal outlays (spending) in the fiscal year, in millions of dollars'),
  omb('omb-surplus', '01z1', { label: 'Total, Surplus or Deficit (-)', column: 3, category: 'outlays' }, 'Yearly Federal Budget Balance', '$m', 'Receipts less outlays in the fiscal year as OMB prints it, a deficit negative, in millions of dollars'),
  omb('omb-outlays-gdp', '01z2', { label: 'Total, Outlays', column: 3, category: 'outlays' }, 'Federal Spending as a Share of GDP', '%', 'All federal outlays in the fiscal year as a percent of GDP, as OMB prints it'),
  omb('omb-surplus-gdp', '01z2', { label: 'Total, Surplus or Deficit (-)', column: 4, category: 'outlays' }, 'Federal Budget Balance as a Share of GDP', '%', 'The surplus or deficit (negative) as a percent of GDP, as OMB prints it'),
  omb('omb-receipts-gdp', '01z2', { label: 'Total, Receipts', column: 2 }, 'Federal Revenue as a Share of GDP', '%', 'All federal receipts in the fiscal year as a percent of GDP, as OMB prints it'),
  ...OMB_SOURCES.map(([key, column, label, what, name]) => omb(`omb-${key}`, '02z1', { label, column }, name, '$m', `${what}, in millions of dollars`)),
  ...OMB_SOURCES.map(([key, column, label, what, , part]) => omb(`omb-${key}-share`, '02z2', { label, column }, `${part} as a Share of All Revenue`, '%', `${what} as a percent of all federal receipts`)),
  ...OMB_SOURCES.map(([key, column, label, what, , part]) => omb(`omb-${key}-gdp`, '02z3', { label, column }, `${part} as a Share of GDP`, '%', `${what} as a percent of GDP`)),
  omb('omb-oasi', '02z4', { label: 'Old-age and survivors insurance: Trust funds (Off-Budget)', under: 'Old-age and survivors insurance:', row: 'Trust funds (Off-Budget)' }, 'Social Security Retirement Payroll Taxes', '$m', 'Payroll taxes for Social Security\'s old-age and survivors insurance trust fund, in millions of dollars'),
  omb('omb-di', '02z4', { label: 'Disability insurance (Off-Budget)', row: 'Disability insurance (Off-Budget)' }, 'Social Security Disability Payroll Taxes', '$m', 'Payroll taxes for Social Security\'s disability insurance trust fund, in millions of dollars'),
  omb('omb-hi', '02z4', { label: 'Hospital insurance', row: 'Hospital insurance' }, 'Medicare Payroll Taxes', '$m', 'Payroll taxes for Medicare\'s hospital insurance trust fund, in millions of dollars'),
  omb('omb-unemployment', '02z4', { label: 'Unemployment insurance: Total', under: 'Unemployment insurance:', row: 'Total' }, 'Yearly Unemployment Insurance Taxes', '$m', 'Unemployment insurance taxes, in millions of dollars'),
  omb('omb-excise-alcohol', '02z4', { label: 'Excise Taxes, Federal funds: Alcohol', under: 'Federal funds:', row: 'Alcohol' }, 'Alcohol Taxes', '$m', 'Excise taxes on alcohol, in millions of dollars'),
  omb('omb-excise-tobacco', '02z4', { label: 'Excise Taxes, Federal funds: Tobacco', under: 'Federal funds:', row: 'Tobacco' }, 'Tobacco Taxes', '$m', 'Excise taxes on tobacco, in millions of dollars'),
  omb('omb-excise-transportation', '02z4', { label: 'Excise Taxes, Trust funds: Transportation', under: 'Trust funds:', row: 'Transportation' }, 'Highway and Transit Taxes (Gas Tax)', '$m', 'Excise taxes paid into the transportation (highway) trust fund, chiefly fuel taxes, in millions of dollars'),
  omb('omb-excise-airport', '02z4', { label: 'Excise Taxes, Trust funds: Airport and airway', under: 'Trust funds:', row: 'Airport and airway' }, 'Airport and Airway Taxes', '$m', 'Excise taxes paid into the airport and airway trust fund, chiefly on air tickets, in millions of dollars'),
  omb('omb-estate-gift', '02z5', { label: 'Estate and Gift Taxes', column: 2 }, 'Yearly Estate and Gift Taxes', '$m', 'Estate and gift taxes, in millions of dollars'),
  omb('omb-fed-reserve', '02z5', { label: 'Miscellaneous Receipts: Federal Reserve Deposits', column: 5 }, 'Federal Reserve Earnings Paid to the Treasury', '$m', 'The Federal Reserve\'s deposits of its earnings with the Treasury, in millions of dollars'),

  ...cbo('tax-rate', '9. Federal Tax Rates', 'Average federal tax rate'),
  ...cbo('tax-share', '12. Federal Taxes Shares', 'Share of federal taxes'),

  irs('irs-top-rate', 6, 'Highest bracket, Tax rate (percent)', 'Top Income Tax Rate', '%', 'The tax rate on the highest bracket of the individual income tax'),
  irs('irs-top-bracket', 7, 'Highest bracket, Taxable income over', 'Income Where the Top Tax Rate Starts', '$', 'The taxable income above which the highest rate applied, in dollars (the table\'s notes say which filing status each year\'s amount is for)'),
  irs('irs-bottom-rate', 4, 'Lowest bracket, Tax rate (percent)', 'Lowest Income Tax Rate', '%', 'The tax rate on the lowest bracket of the individual income tax'),
];

// Tariffs and trade. Customs duties from five publishers at five speeds; exports, imports and the
// balance as BEA (national accounts) and Census (balance of payments basis) each print them.
const USITC_COLUMNS = { imports: [5, 'Total'], duties: [6, 'Duties collected'], 'ratio-dutiable': [7, 'Ratio of values (%): Duties collected/dutiable imports'], 'ratio-total': [8, 'Ratio of values (%): Duties collected/total imports'] };
const usitc = (slug, key, name, unit, description) => ({
  slug, source: 'usitc', source_id: `Table 1: ${USITC_COLUMNS[key][1]}`, column: USITC_COLUMNS[key][0], url: USITC_DUTIES,
  archive: '20260927200604', frequency: 'annual', name, category: 'tariffs', unit,
  description: `${description}. USITC, U.S. imports for consumption, duties collected, and ratio of duties to value, Table 1 (March 2026); fiscal years (July–June) for 1891–1917, calendar years from 1919. USITC prints 1918 in two parts (the change from fiscal to calendar years) and 1930 in two parts (before and after the Tariff Act of 1930); parts of years are not shown here, so those two years have no value`,
});
const beaTrade = (slug, id, frequency, name, line, description) => ({
  slug, source: 'bea', source_id: id, frequency, name, category: 'trade', unit: '$m',
  description: `${description}, in millions of dollars${frequency === 'quarterly' ? ', seasonally adjusted at annual rates' : ', by calendar year'}. NIPA Table 1.1.5, line ${line}`,
});
// [key, column, side, part, name, description]. A yearly total BEA (or USITC) also prints yearly is
// named with "(Census)" to tell them apart.
const CENSUS_TRADE_COLUMNS = [
  ['balance', 1, 'Balance', 'Total', 'Trade Balance', 'Exports less imports of goods and services (a deficit negative)'],
  ['balance-goods', 2, 'Balance', 'Goods', 'Trade Balance in Goods', 'Exports less imports of goods (a deficit negative)'],
  ['balance-services', 3, 'Balance', 'Services', 'Trade Balance in Services', 'Exports less imports of services (a deficit negative)'],
  ['exports', 4, 'Exports', 'Total', 'Exports', 'Exports of goods and services'],
  ['exports-goods', 5, 'Exports', 'Goods', 'Exports of Goods', 'Exports of goods'],
  ['exports-services', 6, 'Exports', 'Services', 'Exports of Services', 'Exports of services'],
  ['imports', 7, 'Imports', 'Total', 'Imports', 'Imports of goods and services'],
  ['imports-goods', 8, 'Imports', 'Goods', 'Imports of Goods', 'Imports of goods'],
  ['imports-services', 9, 'Imports', 'Services', 'Imports of Services', 'Imports of services'],
];
const CENSUS_YEARLY_ALSO_ELSEWHERE = new Set(['balance', 'exports', 'imports', 'imports-goods']);
const censusTrade = monthly => CENSUS_TRADE_COLUMNS.map(([key, column, side, part, name, what]) => ({
  slug: `trade-${key}-${monthly ? 'monthly' : 'annual'}`, source: 'census-trade', url: monthly ? CENSUS_TRADE_MONTHLY : CENSUS_TRADE_ANNUAL,
  source_id: `${monthly ? 'exhibit_history' : 'gands'}: ${side}, ${part}`, column, frequency: monthly ? 'monthly' : 'annual',
  name: monthly ? `Monthly ${name}` : `Yearly ${name}${CENSUS_YEARLY_ALSO_ELSEWHERE.has(key) ? ' (Census)' : ''}`, category: 'trade', unit: '$m',
  description: `${what}, in millions of dollars, on a balance of payments basis${monthly ? ', seasonally adjusted, by month from 1992' : ', by calendar year from 1960'}. Census Bureau and BEA, U.S. International Trade in Goods and Services (FT-900), historical series`,
}));

const TRADE_SERIES = [
  usitc('usitc-duties', 'duties', 'Yearly Tariff Revenue (USITC)', '$k', 'Duties collected on imports for consumption, in thousands of dollars'),
  usitc('usitc-duties-ratio-total', 'ratio-total', 'Average Tariff Rate on All Imports', '%', 'Duties collected as a percent of the value of all imports for consumption, dutiable and duty-free, as USITC prints it (it warns that this ratio should be used "with great reservation" as a measure of how high the tariff is)'),
  usitc('usitc-duties-ratio-dutiable', 'ratio-dutiable', 'Average Tariff Rate on Imports Subject to Tariffs', '%', 'Duties collected as a percent of the value of dutiable imports, as USITC prints it'),
  usitc('usitc-imports', 'imports', 'Yearly Imports of Goods (USITC)', '$k', 'The customs value of all imports for consumption, dutiable and duty-free, in thousands of dollars'),
  omb('omb-customs', '02z5', { label: 'Customs Duties and Fees', column: 3, category: 'tariffs' }, 'Yearly Tariff Revenue (OMB)', '$m', 'Customs duties and fees, in millions of dollars'),
  { ...bea('federal-customs-duties', 'B235RC', 'Quarterly Tariff Revenue (Annualized)', 6, 'Customs and other import duties received by the federal government'), category: 'tariffs' },
  { slug: 'federal-customs-duties-annual', source: 'bea', source_id: 'B235RC', frequency: 'annual', name: 'Yearly Tariff Revenue (BEA)', category: 'tariffs', unit: '$m',
    description: 'Customs and other import duties received by the federal government, in millions of dollars, by calendar year. NIPA Table 3.2, line 6' },
  { ...mts('mts-customs-duties', 'Customs Duties', 'Monthly Tariff Revenue', 'Customs duties received in the month, less refunds'), category: 'tariffs' },
  { ...mts4('mts-customs-gross', 'Customs Duties', 'gross', 'Monthly Tariff Revenue Before Refunds', 'Customs duties received before refunds'), category: 'tariffs' },
  { ...mts4('mts-customs-refunds', 'Customs Duties', 'refunds', 'Monthly Tariff Refunds', 'Refunds of customs duties paid'), category: 'tariffs' },
  { ...dts('dts-customs', 'treasury-dts', 'DHS - Customs Duties, Taxes, and Fees', 'Daily Tariff Revenue (Since Nov 2025)', 'Customs duties, taxes and fees collected by the Department of Homeland Security (Customs and Border Protection)'), category: 'tariffs',
    description: 'Customs duties, taxes and fees collected by the Department of Homeland Security (Customs and Border Protection), in millions of dollars, deposited that business day. Daily Treasury Statement, Table II, from November 10, 2025' },
  { ...dts('dts-customs-dhs', 'treasury-dts', 'DHS - Customs and Certain Excise Taxes', 'Daily Tariff Revenue (2020–2025)', ''), category: 'tariffs',
    description: 'Customs duties and the excise taxes Customs collects at the border, deposited by the Department of Homeland Security, in millions of dollars, that business day. Daily Treasury Statement, Table II, May 2020 to November 2025' },
  { ...dts('dts-customs-old', 'treasury-dts', 'Customs and Certain Excise Taxes', 'Daily Tariff Revenue (2005–2020)', ''), category: 'tariffs',
    description: 'Customs duties and the excise taxes Customs collects at the border, in millions of dollars, deposited that business day. Daily Treasury Statement, Table II, October 2005 to May 2020' },

  beaTrade('bea-exports', 'B020RC', 'quarterly', 'Quarterly Exports (Annualized)', 16, 'Exports of goods and services'),
  beaTrade('bea-imports', 'B021RC', 'quarterly', 'Quarterly Imports (Annualized)', 19, 'Imports of goods and services'),
  beaTrade('bea-net-exports', 'A019RC', 'quarterly', 'Quarterly Trade Balance (Annualized)', 15, 'Exports less imports of goods and services as BEA prints it (a deficit negative)'),
  beaTrade('bea-exports-goods', 'A253RC', 'quarterly', 'Quarterly Exports of Goods (Annualized)', 17, 'Exports of goods'),
  beaTrade('bea-exports-services', 'A646RC', 'quarterly', 'Quarterly Exports of Services (Annualized)', 18, 'Exports of services'),
  beaTrade('bea-imports-goods', 'A255RC', 'quarterly', 'Quarterly Imports of Goods (Annualized)', 20, 'Imports of goods'),
  beaTrade('bea-imports-services', 'B656RC', 'quarterly', 'Quarterly Imports of Services (Annualized)', 21, 'Imports of services'),
  beaTrade('bea-exports-annual', 'B020RC', 'annual', 'Yearly Exports (BEA)', 16, 'Exports of goods and services'),
  beaTrade('bea-imports-annual', 'B021RC', 'annual', 'Yearly Imports (BEA)', 19, 'Imports of goods and services'),
  beaTrade('bea-net-exports-annual', 'A019RC', 'annual', 'Yearly Trade Balance (BEA)', 15, 'Exports less imports of goods and services as BEA prints it (a deficit negative)'),
  ...censusTrade(true),
  ...censusTrade(false),
];

// Series written here by hand; the national accounts' tables (lib/nipa-series.js) are added after them.
const HAND_SERIES = [
  {
    slug: 'wti-spot', source: 'eia', source_id: 'RWTC', frequency: 'daily',
    name: 'U.S. Crude Oil Price (WTI)', category: 'crude', unit: '$/bbl',
    description: 'The price of a barrel of West Texas Intermediate crude, the U.S. benchmark, for delivery at Cushing, Oklahoma, each trading day (spot price)',
  },
  {
    slug: 'brent-spot', source: 'eia', source_id: 'RBRTE', frequency: 'daily',
    name: 'World Crude Oil Price (Brent)', category: 'crude', unit: '$/bbl',
    description: 'The price of a barrel of Brent crude from the North Sea, the international benchmark, each trading day (spot price)',
  },
  {
    slug: 'gasoline-retail', source: 'eia', source_id: 'EMM_EPMR_PTE_NUS_DPG', frequency: 'weekly',
    name: 'Regular Gas Price at the Pump', category: 'retail', unit: '$/gal',
    description: 'The average price of a gallon of regular gasoline at the pump across the U.S., all formulations, surveyed weekly',
  },
  {
    slug: 'diesel-retail', source: 'eia', source_id: 'EMD_EPD2D_PTE_NUS_DPG', frequency: 'weekly',
    name: 'Diesel Price at the Pump', category: 'retail', unit: '$/gal',
    description: 'The average price of a gallon of No. 2 diesel at the pump across the U.S., surveyed weekly',
  },
  {
    slug: 'demand-total-4wk', source: 'eia', source_id: 'WRPUPUS2', frequency: 'four-week-average',
    name: 'Oil Demand, All Products (4-Week Average)', category: 'oil-demand', unit: 'kb/d',
    description: 'All petroleum products supplied to the U.S. market (gasoline, diesel, jet fuel, heating oil, propane and the rest), the standard measure of how much oil the country uses, in barrels per day, averaged over the four weeks to the date shown. EIA\'s weekly estimate (Weekly Petroleum Status Report)',
  },
  {
    slug: 'demand-distillate-4wk', source: 'eia', source_id: 'WDIUPUS2', frequency: 'four-week-average',
    name: 'Diesel Demand (4-Week Average)', category: 'oil-demand', unit: 'kb/d',
    description: 'Distillate fuel oil supplied to the U.S. market: mostly diesel for trucks, trains, farms and ships, plus heating oil. Watched as a sign of how much freight is moving, in barrels per day, averaged over the four weeks to the date shown. EIA\'s weekly estimate (Weekly Petroleum Status Report)',
  },
  {
    slug: 'demand-gasoline-4wk', source: 'eia', source_id: 'WGFUPUS2', frequency: 'four-week-average',
    name: 'Gasoline Demand (4-Week Average)', category: 'oil-demand', unit: 'kb/d',
    description: 'Finished motor gasoline supplied to the U.S. market, in barrels per day, averaged over the four weeks to the date shown. EIA\'s weekly estimate (Weekly Petroleum Status Report)',
  },
  {
    slug: 'demand-jet-4wk', source: 'eia', source_id: 'WKJUPUS2', frequency: 'four-week-average',
    name: 'Jet Fuel Demand (4-Week Average)', category: 'oil-demand', unit: 'kb/d',
    description: 'Kerosene-type jet fuel supplied to the U.S. market, in barrels per day, averaged over the four weeks to the date shown. EIA\'s weekly estimate (Weekly Petroleum Status Report)',
  },
  {
    slug: 'demand-total-monthly', source: 'eia', source_id: 'MTTUPUS2', frequency: 'monthly',
    name: 'Monthly Oil Demand, All Products', category: 'oil-demand', unit: 'kb/d',
    description: 'All petroleum products supplied to the U.S. market (gasoline, diesel, jet fuel, heating oil, propane and the rest), the standard measure of how much oil the country uses, in barrels per day over the month. From EIA\'s Petroleum Supply Monthly: more complete than the weekly estimates, published about two months later',
  },
  {
    slug: 'demand-distillate-monthly', source: 'eia', source_id: 'MDIUPUS2', frequency: 'monthly',
    name: 'Monthly Diesel Demand', category: 'oil-demand', unit: 'kb/d',
    description: 'Distillate fuel oil supplied to the U.S. market: mostly diesel for trucks, trains, farms and ships, plus heating oil. Watched as a sign of how much freight is moving, in barrels per day over the month. From EIA\'s Petroleum Supply Monthly: more complete than the weekly estimates, published about two months later',
  },
  {
    slug: 'demand-gasoline-monthly', source: 'eia', source_id: 'MGFUPUS2', frequency: 'monthly',
    name: 'Monthly Gasoline Demand', category: 'oil-demand', unit: 'kb/d',
    description: 'Finished motor gasoline supplied to the U.S. market, in barrels per day over the month. From EIA\'s Petroleum Supply Monthly: more complete than the weekly estimates, published about two months later',
  },
  {
    slug: 'demand-jet-monthly', source: 'eia', source_id: 'MKJUPUS2', frequency: 'monthly',
    name: 'Monthly Jet Fuel Demand', category: 'oil-demand', unit: 'kb/d',
    description: 'Kerosene-type jet fuel supplied to the U.S. market, in barrels per day over the month. From EIA\'s Petroleum Supply Monthly: more complete than the weekly estimates, published about two months later',
  },
  {
    slug: 'unemployment-rate', source: 'bls-bulk', source_id: 'LNS14000000', frequency: 'monthly', file: 'ln/ln.data.1.AllData',
    name: 'Unemployment Rate', category: 'unemployment', unit: '%',
    description: 'Unemployment rate (U-3), 16 years and over, seasonally adjusted. Current Population Survey',
  },
  {
    slug: 'unemployment-u6', source: 'bls-bulk', source_id: 'LNS13327709', frequency: 'monthly', file: 'ln/ln.data.1.AllData',
    name: 'Broad Unemployment Rate (U-6)', category: 'unemployment', unit: '%',
    description: 'Total unemployed, plus all persons marginally attached to the labor force, plus total employed part time for economic reasons, as a percent of the civilian labor force plus all persons marginally attached (U-6), seasonally adjusted. Current Population Survey',
  },
  {
    slug: 'unemployed-persons', source: 'bls-bulk', source_id: 'LNS13000000', frequency: 'monthly', file: 'ln/ln.data.1.AllData',
    name: 'Number of Unemployed People', category: 'unemployment', unit: 'thousands',
    description: 'Unemployment level, 16 years and over, in thousands, seasonally adjusted. Current Population Survey',
  },
  {
    slug: 'cpi', source: 'bls-bulk', source_id: 'CUUR0000SA0', frequency: 'monthly', file: 'cu/cu.data.1.AllItems',
    name: 'Consumer Price Index (CPI)', category: 'inflation', unit: 'index',
    description: 'Consumer Price Index for All Urban Consumers (CPI-U), all items in U.S. city average, 1982–84 = 100, not seasonally adjusted',
  },
  {
    slug: 'cpi-core', source: 'bls-bulk', source_id: 'CUUR0000SA0L1E', frequency: 'monthly', file: 'cu/cu.data.20.USCommoditiesServicesSpecial',
    name: 'Core Consumer Price Index', category: 'inflation', unit: 'index',
    description: 'Consumer Price Index for All Urban Consumers (CPI-U), all items less food and energy in U.S. city average, 1982–84 = 100, not seasonally adjusted',
  },
  {
    slug: 'pce-price', source: 'bea', source_id: 'DPCERG', frequency: 'monthly',
    name: 'PCE Price Index', category: 'inflation', unit: 'index',
    description: 'Personal consumption expenditures price index, 2017 = 100, seasonally adjusted. NIPA Table 2.8.4, line 1',
  },
  {
    slug: 'pce-price-core', source: 'bea', source_id: 'DPCCRG', frequency: 'monthly',
    name: 'Core PCE Price Index', category: 'inflation', unit: 'index',
    description: 'Personal consumption expenditures excluding food and energy, price index, 2017 = 100, seasonally adjusted. NIPA Table 2.8.4, line 25',
  },
  {
    slug: 'spending', source: 'bea', source_id: 'DPCERC', frequency: 'monthly',
    name: 'Consumer Spending (Annualized)', category: 'consumers', unit: '$bn',
    description: 'Personal consumption expenditures, current dollars, seasonally adjusted at annual rates. NIPA Table 2.8.5, line 1',
  },
  {
    slug: 'spending-real', source: 'bea', source_id: 'DPCERX', frequency: 'monthly',
    name: 'Inflation-Adjusted Consumer Spending (Annualized)', category: 'consumers', unit: '$bn',
    description: 'Real personal consumption expenditures, chained 2017 dollars, seasonally adjusted at annual rates. NIPA Table 2.8.6, line 1',
  },
  {
    slug: 'sentiment', source: 'umich', source_id: 'ICS_ALL', frequency: 'monthly', url: UMICH_SENTIMENT,
    name: 'Consumer Sentiment', category: 'consumers', unit: 'index',
    description: 'University of Michigan Index of Consumer Sentiment, 1966 Q1 = 100. Surveys of Consumers',
  },
  {
    slug: 'mortgage-rate', source: 'freddiemac', source_id: 'pmms30', frequency: 'weekly', url: FREDDIE_PMMS,
    name: '30-Year Mortgage Rate', category: 'housing', unit: '%',
    description: '30-year fixed-rate mortgage, average rate offered to borrowers with good credit and a 20 percent down payment, weekly. Freddie Mac Primary Mortgage Market Survey',
  },
  {
    slug: 'house-prices', source: 'fhfa', source_id: 'USA purchase-only SA', frequency: 'monthly', url: FHFA_HPI,
    name: 'Home Price Index', category: 'housing', unit: 'index',
    description: 'FHFA House Price Index, United States, purchase-only, seasonally adjusted, January 1991 = 100: repeat sales of the same houses with mortgages bought or guaranteed by Fannie Mae and Freddie Mac',
  },
  {
    slug: 'home-price', source: 'census-nrs', source_id: 'Median sales price', frequency: 'monthly',
    url: 'https://www.census.gov/construction/nrs/xls/price_cust.xlsx', sheet: 'Monthly',
    name: 'Median Price of a New Home', category: 'housing', unit: '$',
    description: 'Median sales price of new single-family houses sold, United States, not seasonally adjusted. Census Bureau and HUD, New Residential Sales',
  },
  {
    slug: 'hoam-share', source: 'atlantafed', source_id: 'Annual Payment Share of Income', frequency: 'monthly', url: ATLANTA_FED_HOAM, percent: true,
    name: 'Cost of Owning a Home as a Share of Income', category: 'housing', unit: '%',
    description: 'The yearly cost of owning the median-priced existing home (principal and interest with 10 percent down on a 30-year loan at the Freddie Mac rate, private mortgage insurance, property taxes and insurance) as a percent of median household income. Above 30 percent counts as unaffordable. Federal Reserve Bank of Atlanta, Home Ownership Affordability Monitor',
  },
  {
    slug: 'hoam-index', source: 'atlantafed', source_id: 'Affordability Index', frequency: 'monthly', url: ATLANTA_FED_HOAM,
    name: 'Home Affordability Index', category: 'housing', unit: 'index',
    description: 'Median household income as a percent of the income needed to own the median-priced existing home for no more than 30 percent of income: 100 is the break-even point, below 100 unaffordable. Federal Reserve Bank of Atlanta, Home Ownership Affordability Monitor',
  },
  {
    slug: 'homeownership', source: 'census', source_id: 'HVS Table 14, United States', frequency: 'quarterly', url: CENSUS_HOMEOWNERSHIP,
    name: 'Homeownership Rate', category: 'housing', unit: '%',
    description: 'Share of occupied housing units lived in by their owners, United States, not seasonally adjusted. Census Bureau, Housing Vacancy Survey, Table 14',
  },
  {
    slug: 'household-income', source: 'census', source_id: 'CPS ASEC Table H-5, all races, current dollars', frequency: 'annual', url: CENSUS_INCOME, column: 2,
    name: 'Median Household Income', category: 'housing', unit: '$',
    description: 'Median household income, all households, current dollars. Census Bureau, Current Population Survey Annual Social and Economic Supplement, Table H-5',
  },
  {
    slug: 'household-income-real', source: 'census', source_id: 'CPS ASEC Table H-5, all races, 2025 dollars', frequency: 'annual', url: CENSUS_INCOME, column: 3,
    name: 'Median Household Income Adjusted for Inflation', category: 'housing', unit: '$',
    description: 'Median household income, all households, in 2025 dollars (adjusted with the Census Bureau\'s chained CPI-U). Current Population Survey Annual Social and Economic Supplement, Table H-5',
  },
  {
    slug: 'fed-funds', source: 'fed-h15', source_id: 'RIFSPFF_N.D', frequency: 'daily',
    name: 'Federal Funds Rate', category: 'rates', unit: '%',
    description: 'Federal funds effective rate: the average rate banks paid each other for overnight loans, every day. Federal Reserve Board, H.15 Selected Interest Rates',
  },
  {
    slug: 'fed-target-lower', source: 'fed-omo', source_id: 'lower', frequency: 'irregular',
    name: 'Lower End of the Fed’s Target Range', category: 'rates', unit: '%',
    description: 'The FOMC\'s target for the federal funds rate, lower bound of the range (the single target before December 2008), from the date each change took effect. Federal Reserve Board, Open Market Operations',
  },
  {
    slug: 'fed-target-upper', source: 'fed-omo', source_id: 'upper', frequency: 'irregular',
    name: 'Upper End of the Fed’s Target Range', category: 'rates', unit: '%',
    description: 'The FOMC\'s target for the federal funds rate, upper bound of the range (the single target before December 2008), from the date each change took effect. Federal Reserve Board, Open Market Operations',
  },
  {
    slug: 'treasury-10y', source: 'fed-h15', source_id: 'RIFLGFCY10_N.B', frequency: 'daily',
    name: '10-Year Treasury Yield', category: 'rates', unit: '%',
    description: 'Market yield on U.S. Treasury securities at 10-year constant maturity, business days. Federal Reserve Board, H.15 Selected Interest Rates',
  },
  {
    slug: 'treasury-2y', source: 'fed-h15', source_id: 'RIFLGFCY02_N.B', frequency: 'daily',
    name: '2-Year Treasury Yield', category: 'rates', unit: '%',
    description: 'Market yield on U.S. Treasury securities at 2-year constant maturity, business days. Federal Reserve Board, H.15 Selected Interest Rates',
  },
  {
    slug: 'prime-rate', source: 'fed-h15', source_id: 'RIFSPBLP_N.B', frequency: 'daily',
    name: 'Prime Rate', category: 'rates', unit: '%',
    description: 'Bank prime loan rate: the rate posted by a majority of the top 25 banks, business days. Federal Reserve Board, H.15 Selected Interest Rates',
  },
  {
    slug: 'covid-deaths', source: 'cdc', source_id: 'COVID-19 Deaths', frequency: 'weekly', url: CDC_COVID_DEATHS,
    name: 'COVID-19 Deaths', category: 'health', unit: 'deaths',
    description: 'Deaths with COVID-19 listed on the death certificate, United States, by week (Sunday to Saturday). CDC National Center for Health Statistics, provisional counts',
  },
  {
    slug: 'deaths-vs-expected', source: 'cdc', source_id: 'Percent of Expected Deaths', frequency: 'weekly', url: CDC_COVID_DEATHS,
    name: 'Deaths from All Causes as a Share of Expected', category: 'health', unit: '%',
    description: 'Deaths from all causes in the week as a percent of the number expected from the same week in earlier years (100 = normal), United States. CDC National Center for Health Statistics, provisional counts',
  },
  {
    slug: 'gdp', source: 'bea', source_id: 'A191RC', frequency: 'quarterly',
    name: 'GDP (Annualized)', category: 'gdp', unit: '$bn',
    description: 'Gross domestic product, current dollars, seasonally adjusted at annual rates. NIPA Table 1.1.5, line 1',
  },
  {
    slug: 'gdp-real', source: 'bea', source_id: 'A191RX', frequency: 'quarterly',
    name: 'GDP Adjusted for Inflation (Annualized)', category: 'gdp', unit: '$bn',
    description: 'Real gross domestic product, chained 2017 dollars, seasonally adjusted at annual rates. NIPA Table 1.1.6, line 1',
  },
  {
    slug: 'gdp-growth', source: 'bea', source_id: 'A191RL', frequency: 'quarterly',
    name: 'GDP Growth Rate (Adjusted for Inflation)', category: 'gdp', unit: '%',
    description: 'Real gross domestic product, percent change from the preceding quarter, seasonally adjusted at annual rates. NIPA Table 1.1.1, line 1',
  },
  {
    slug: 'debt-total', source: 'treasury', source_id: 'tot_pub_debt_out_amt', frequency: 'daily',
    name: 'National Debt', category: 'debt', unit: '$bn',
    description: 'Total public debt outstanding: debt held by the public plus intragovernmental holdings (trust funds such as Social Security). Debt to the Penny',
  },
  {
    slug: 'debt-public', source: 'treasury', source_id: 'debt_held_public_amt', frequency: 'daily',
    name: 'National Debt Held by the Public', category: 'debt', unit: '$bn',
    description: 'Debt held by the public: federal debt owned by investors, the Federal Reserve and foreign governments, not by federal trust funds. Debt to the Penny',
  },
  ...unemploymentBreakdowns(),
  ...TAX_SERIES,
  ...TRADE_SERIES,
];

// Every line of the NIPA tables the Statistical Abstract reprints, yearly and quarterly (Phase 5); a line already
// written above at one frequency is added at the other as its twin.
// Then every CPI-U item (U.S. city average) and every area's all-items index (lib/cpi-series.js).
export const SERIES = [...HAND_SERIES, ...nameNipaSeries(nipaSeries(HAND_SERIES).series, new Set(HAND_SERIES.map(s => s.name))),
  ...cpiSeries(HAND_SERIES)];

/**
 * Where a series' downloaded rows are kept, under the API's own path with the series as the file
 * name (the key is never part of it):
 *   api.eia.gov/v2/petroleum/pri/spt/RWTC-daily.json
 *   api.bls.gov/publicAPI/timeseries/data/LNS14000000-monthly.json
 */
export function seriesFile(s) {
  if (s.source === 'bea') return mirrorFile({ monthly: BEA_MONTHLY, annual: BEA_FILES[2] }[s.frequency] ?? BEA_QUARTERLY);
  if (s.url) return mirrorFile(s.url);
  if (s.source === 'eia') return mirrorFile(EIA_PET_BULK);
  if (s.source === 'fed-h15') return FED_H15_FILE();
  if (s.source === 'fed-omo') return mirrorFile(FED_OMO_PAGES[0]);
  if (s.source === 'treasury') return `${mirrorFile(DEBT_TO_PENNY)}.json`;
  if (FISCAL_DATASETS[s.source]) return `${mirrorFile(FISCAL_DATASETS[s.source].url)}.json`;
  if (s.source === 'bls-bulk') return path.join(DATA_DIR, 'download.bls.gov', 'pub', 'time.series', ...s.file.split('/'));
  throw new Error(`${s.slug}: no file for source ${s.source}`);
}

const QUARTER_START = { 1: '01', 2: '04', 3: '07', 4: '10' };

/**
 * BEA's quarterly, monthly or annual flat file ("A191RC,1947Q1,\"243,164\"", "DPCERC,2026M08,…",
 * "A019RC,1929,\"383\""; levels in millions) → that series' [date, billions or value].
 */
// A flat file's lines by series code, so each file is split once however many of its series are read
// (the loader keeps each file's text, so the text itself is the key).
const beaLines = new Map();
function beaSeriesLines(text) {
  if (!beaLines.has(text)) {
    const byCode = new Map();
    for (const line of text.split('\n')) {
      const code = line.slice(0, line.indexOf(','));
      if (!byCode.has(code)) byCode.set(code, []);
      byCode.get(code).push(line.replace(/\r$/, ''));
    }
    beaLines.set(text, byCode);
  }
  return beaLines.get(text);
}

function readBea(s, text) {
  const observations = [];
  for (const line of beaSeriesLines(text).get(s.source_id) ?? []) {
    const m = /^[^,]+,(\d{4})(?:Q([1-4])|M(\d{2}))?,"?([-\d,.]+)"?\s*$/.exec(line);
    if (!m) throw new Error(`${s.slug}: unexpected line ${line}`);
    const value = Number(m[4].replace(/,/g, ''));
    const month = m[2] ? QUARTER_START[m[2]] : m[3] ?? '01';
    // Levels are in millions of dollars (DefaultScale -6 in the series register); rates and indexes as printed.
    observations.push([`${m[1]}-${month}-01`, String(s.unit === '$bn' ? value / 1000 : value)]);
  }
  return observations;
}

/**
 * A downloaded file's rows → { description, observations: [[date, value]], skipped }, oldest first.
 * Rows without a value are skipped: EIA's blanks, and BLS's "-" (October 2025 was not collected,
 * during the lapse in appropriations).
 */
/**
 * A BLS survey data file (tab-separated, padded: "CUUR0000SA0      \t2025\tM09\t     324.800\t")
 * → that series' [date, value]; "-" (not collected) and the annual average (M13) are left out.
 */
// A survey file's lines for the series we keep, by id: the file is scanned once, however many of
// its series are read (ln.data.1.AllData is 392 MB, every CPS series).
const blsBulkLines = new Map();
function blsBulkSeriesLines(s, text) {
  if (!blsBulkLines.has(s.file)) {
    const wanted = new Set(SERIES.filter(x => x.file === s.file).map(x => x.source_id));
    const byId = new Map([...wanted].map(id => [id, []]));
    let at = 0;
    while (at < text.length) {
      let end = text.indexOf('\n', at);
      if (end < 0) end = text.length;
      const tab = text.indexOf('\t', at);
      // Ids are padded with spaces, and one id can begin another (CUUR0000SA0, CUUR0000SA0L1E).
      const id = tab > at && tab < end ? text.slice(at, tab).trim() : null;
      if (id && wanted.has(id)) byId.get(id).push(text.slice(at, end));
      at = end + 1;
    }
    blsBulkLines.set(s.file, byId);
  }
  return blsBulkLines.get(s.file).get(s.source_id) ?? [];
}

function readBlsBulk(s, text) {
  const observations = [];
  let skipped = 0;
  for (const line of blsBulkSeriesLines(s, text)) {
    const [, year, period, raw] = line.split('\t').map(x => x.trim());
    if (!/^M(0[1-9]|1[0-2])$/.test(period)) continue;
    const value = Number(raw);
    if (raw === '-' || raw === '' || !Number.isFinite(value)) { skipped++; continue; }
    observations.push([`${year}-${period.slice(1)}-01`, raw]);
  }
  observations.sort((a, b) => a[0].localeCompare(b[0]));
  return { description: s.description, observations, skipped };
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Michigan's CSV ("Month,YYYY,ICS_ALL" then "September,2026,48.1") → [date, value]. */
function readUmich(s, text) {
  const observations = [];
  for (const line of text.split(/\r?\n/).slice(1)) {
    if (!line.trim()) continue;
    const [month, year, value] = line.split(',').map(x => x.trim());
    const m = MONTHS.indexOf(month);
    if (m < 0 || !/^\d{4}$/.test(year) || !Number.isFinite(Number(value)) || value === '') throw new Error(`${s.slug}: unexpected line ${line}`);
    observations.push([`${year}-${String(m + 1).padStart(2, '0')}-01`, value]);
  }
  return { description: s.description, observations, skipped: 0 };
}

/**
 * Census Table H-5 (rows from lib/xlsx.js): the "All Races" block, newest year first. A year printed
 * twice (2013, 2017: survey changes) is taken from its first row, the method later years use.
 */
function readCensusIncome(s, rows) {
  const start = rows.findIndex(r => r[0] === 'All Races');
  if (start < 0) throw new Error(`${s.slug}: no "All Races" block`);
  const byYear = new Map();
  for (const row of rows.slice(start + 1)) {
    const year = /^(\d{4})\b/.exec(row[0] ?? '')?.[1];
    if (!year) {
      if (byYear.size && row[0]) break; // the next block begins
      continue;
    }
    if (!byYear.has(year) && Number.isFinite(Number(row[s.column]))) byYear.set(year, row[s.column]);
  }
  const observations = [...byYear].map(([year, value]) => [`${year}-01-01`, value]);
  observations.sort((a, b) => a[0].localeCompare(b[0]));
  return { description: s.description, observations, skipped: 0 };
}

/**
 * Census HVS Table 14: a year row, then "United States……" with its four quarters. A value marked
 * "*" (Q4 2025: October was not collected, so it rests on two months) is kept without the mark.
 */
function readHomeownership(s, rows) {
  const observations = [];
  let year = null;
  for (const row of rows) {
    const y = /^(\d{4})\b/.exec(row[0] ?? '')?.[1];
    if (y) { year = y; continue; }
    if (!year || !/^United States/.test(row[0] ?? '')) continue;
    row.slice(1, 5).forEach((raw, q) => {
      const cell = raw.replace(/^\*/, '');
      const value = Number(cell);
      if (cell !== '' && Number.isFinite(value)) observations.push([`${year}-${['01', '04', '07', '10'][q]}-01`, value.toFixed(1)]);
    });
    year = null;
  }
  observations.sort((a, b) => a[0].localeCompare(b[0]));
  return { description: s.description, observations, skipped: 0 };
}

/** Freddie Mac's PMMS CSV ("4/2/1971,7.33,…"): the survey week's date and the 30-year rate. */
function readFreddie(s, text) {
  const [head, ...lines] = text.trim().split(/\r?\n/);
  const col = head.split(',').indexOf(s.source_id);
  const observations = [];
  for (const line of lines) {
    const cells = line.split(',');
    const [m, d, y] = cells[0].split('/');
    const value = cells[col]?.trim();
    if (!y || !value || !Number.isFinite(Number(value))) continue;
    observations.push([`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`, value]);
  }
  observations.sort((a, b) => a[0].localeCompare(b[0]));
  return { description: s.description, observations, skipped: 0 };
}

/** FHFA's master CSV: the U.S. purchase-only monthly index, seasonally adjusted. */
function readFhfa(s, text) {
  const [head, ...lines] = text.trim().split(/\r?\n/);
  const cols = head.split(',');
  const at = name => cols.indexOf(name);
  const observations = [];
  for (const line of lines) {
    const c = line.split(',');
    if (c[at('hpi_type')] !== 'traditional' || c[at('hpi_flavor')] !== 'purchase-only'
      || c[at('frequency')] !== 'monthly' || c[at('place_id')] !== 'USA') continue;
    const value = c[at('index_sa')];
    if (!Number.isFinite(Number(value)) || value === '') continue;
    observations.push([`${c[at('yr')]}-${String(c[at('period')]).padStart(2, '0')}-01`, value]);
  }
  observations.sort((a, b) => a[0].localeCompare(b[0]));
  return { description: s.description, observations, skipped: 0 };
}

/** A CSV line → fields (double-quoted fields may hold commas). */
function csvFields(line) {
  const out = [];
  let field = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { out.push(field); field = ''; }
    else field += ch;
  }
  out.push(field);
  return out;
}

// CDC: counts for recent weeks are incomplete (death certificates arrive over weeks), so the weeks
// ending within this many days of the release are left out rather than shown as a false drop.
const CDC_INCOMPLETE_DAYS = 56;

/** CDC's weekly counts (r8kw-7aab): the national "By Week" rows, each dated by the week's Sunday. */
function readCdc(s, text) {
  const [head, ...lines] = text.trim().split(/\r?\n/);
  const cols = csvFields(head);
  const at = name => cols.indexOf(name);
  const mdy = v => { const [m, d, y] = v.split('/'); return `${y}-${m}-${d}`; };
  const observations = [];
  let skipped = 0;
  for (const line of lines) {
    const c = csvFields(line);
    if (c[at('State')] !== 'United States' || c[at('Group')] !== 'By Week') continue;
    const asOf = Date.parse(mdy(c[at('Data as of')]));
    if (asOf - Date.parse(mdy(c[at('End Date')])) < CDC_INCOMPLETE_DAYS * 864e5) { skipped++; continue; }
    const value = c[at(s.source_id)];
    if (value === '' || !Number.isFinite(Number(value))) { skipped++; continue; }
    observations.push([mdy(c[at('Start Date')]), value]);
  }
  observations.sort((a, b) => a[0].localeCompare(b[0]));
  return { description: s.description, observations, skipped };
}

/** H.15's SDMX XML (unzipped): one series' <frb:Obs OBS_VALUE TIME_PERIOD> with status "A" (available). */
function readH15(s, xml) {
  const start = xml.indexOf(`SERIES_NAME="${s.source_id}"`);
  if (start < 0) throw new Error(`${s.slug}: ${s.source_id} not in H.15`);
  const block = xml.slice(start, xml.indexOf('</kf:Series>', start));
  const observations = [];
  let skipped = 0;
  for (const m of block.matchAll(/<frb:Obs ([^>]*)\/>/g)) {
    const attr = name => new RegExp(`${name}="([^"]*)"`).exec(m[1])?.[1];
    const value = attr('OBS_VALUE');
    if (attr('OBS_STATUS') !== 'A' || !Number.isFinite(Number(value))) { skipped++; continue; }
    observations.push([attr('TIME_PERIOD'), value]);
  }
  return { description: s.description, observations, skipped };
}

const MONTH_NAMES = 'January|February|March|April|May|June|July|August|September|October|November|December';

/**
 * Every FOMC target change from the Open Market Operations pages (HTML) → [{ date, lower, upper }],
 * oldest first. Each year's table reads "Date Increase Decrease Level (%)", one row per change:
 * "March 16 0 100 0-0.25", "December 16 ... 75-100 0-0.25", "May 16 50 ... 6.50"; a footnote
 * mark (*) may follow the date. A single target is its own lower and upper bound.
 */
export function fomcChanges(pages) {
  const changes = new Map();
  for (const html of pages) {
    const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
    const sections = text.split(/(\d{4}) Date Increase Decrease Level \(%\)/);
    for (let i = 1; i < sections.length; i += 2) {
      const year = sections[i];
      const body = sections[i + 1].split(/Back to (?:year navigation|Top)/)[0];
      const row = new RegExp(`(${MONTH_NAMES}) (\\d{1,2})\\s*\\*?\\s+(\\S+)\\s+(\\S+)\\s+(\\d+(?:\\.\\d+)?)(?:-(\\d+(?:\\.\\d+)?))?`, 'g');
      for (const m of body.matchAll(row)) {
        const month = MONTH_NAMES.split('|').indexOf(m[1]) + 1;
        const date = `${year}-${String(month).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
        const lower = Number(m[5]);
        const upper = m[6] !== undefined ? Number(m[6]) : lower;
        changes.set(date, { date, lower, upper });
      }
    }
  }
  return [...changes.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** `file`: the file's text, its parsed JSON, or (for .xlsx) its rows. */
/** The Census API's rows (a header row, then values): new-home sales, median price, not adjusted. */
/** Census's new-home price history (price_cust.xlsx, sheet Monthly): an Excel day number, then median and average. */
function readNrsPrice(s, rows) {
  const head = rows.findIndex(r => r.includes(s.source_id));
  const col = rows[head]?.indexOf(s.source_id);
  if (head < 0) throw new Error(`${s.slug}: no column "${s.source_id}"`);
  const observations = [];
  let skipped = 0;
  for (const r of rows.slice(head + 1)) {
    const day = Number(r[0]);
    if (!/^\d{5}$/.test(r[0] ?? '')) continue; // footnotes and source lines
    if (!/^\d+(\.\d+)?$/.test(r[col] ?? '')) { skipped++; continue; } // "(NA)"
    const date = new Date(Date.UTC(1899, 11, 30) + day * 864e5).toISOString().slice(0, 10);
    if (!date.endsWith('-01')) throw new Error(`${s.slug}: ${r[0]} is not the first of a month`);
    observations.push([date, r[col]]);
  }
  return sorted(s, observations, skipped);
}

/** EIA's bulk file, our series only (id → { name, data: [[YYYYMMDD | YYYYMM, value | null]] }) → [date, value]. */
function readEiaBulk(s, bulk) {
  const series = bulk.get(eiaBulkId(s));
  if (!series) throw new Error(`${s.slug}: ${eiaBulkId(s)} is not in the bulk file`);
  const observations = [];
  let skipped = 0;
  for (const [period, value] of series.data) {
    if (value === null || !Number.isFinite(Number(value))) { skipped++; continue; }
    const date = period.length === 6 ? `${period.slice(0, 4)}-${period.slice(4)}-01` : `${period.slice(0, 4)}-${period.slice(4, 6)}-${period.slice(6)}`;
    observations.push([date, String(value)]);
  }
  return sorted(s, observations, skipped);
}

/**
 * The Atlanta Fed's HOAM national workbook: a month ("2005-01") and one column per measure, named
 * by its heading. Shares are fractions in the file (0.39), stored as percents (39.0).
 */
function readHoam(s, rows) {
  const [head, ...data] = rows;
  const col = head.indexOf(s.source_id);
  if (col < 0) throw new Error(`${s.slug}: no column "${s.source_id}"`);
  const observations = [];
  for (const row of data) {
    const month = /^(\d{4}-\d{2})$/.exec(row[0] ?? '')?.[1];
    const value = Number(row[col]);
    if (!month || row[col] === '' || !Number.isFinite(value)) continue;
    observations.push([`${month}-01`, (s.percent ? value * 100 : value).toFixed(s.percent ? 2 : 1)]);
  }
  observations.sort((a, b) => a[0].localeCompare(b[0]));
  return { description: s.description, observations, skipped: 0 };
}

const sorted = (s, observations, skipped = 0) => {
  observations.sort((a, b) => a[0].localeCompare(b[0]));
  const dupe = observations.find((o, i) => i && o[0] === observations[i - 1][0]);
  if (dupe) throw new Error(`${s.slug}: two values for ${dupe[0]}`);
  return { description: s.description, observations, skipped };
};
/** A printed number as stored: "1,240.0" → "1240"; blank, "..........", "*" (too small to show) and "N/A" → null. */
const printed = cell => {
  const text = String(cell ?? '').replace(/^(\[[^\]]*\]\s*)+/, '').replace(/,/g, '').trim();
  return text !== '' && Number.isFinite(Number(text)) ? String(Number(text)) : null;
};

/** Monthly Treasury Statement Table 9: a receipts (1.x) or outlays (2.x) line, current month, dated by the month's 1st. */
function readMts(s, { rows }) {
  const outlays = s.source_id.startsWith(MTS_OUTLAYS);
  const line = outlays ? s.source_id.slice(MTS_OUTLAYS.length) : s.source_id;
  const observations = [];
  let skipped = 0;
  for (const r of rows) {
    if (r.classification_desc !== line || r.sequence_number_cd.split('.')[0] !== (outlays ? '2' : '1')) continue;
    const value = printed(r.current_month_rcpt_outly_amt === 'null' ? '' : r.current_month_rcpt_outly_amt);
    if (value === null) { skipped++; continue; }
    observations.push([`${r.record_calendar_year}-${r.record_calendar_month}-01`, value]);
  }
  return sorted(s, observations, skipped);
}

/** Monthly Treasury Statement Table 4: one tax's gross receipts or refunds (`field`) in the month. */
function readMts4(s, { rows }) {
  const observations = [];
  let skipped = 0;
  for (const r of rows) {
    if (r.classification_desc !== s.line) continue;
    const value = printed(r[s.field] === 'null' ? '' : r[s.field]);
    if (value === null) { skipped++; continue; }
    observations.push([`${r.record_calendar_year}-${r.record_calendar_month}-01`, value]);
  }
  return sorted(s, observations, skipped);
}

/**
 * Monthly Treasury Statement Table 1: each statement lists every month of the last and the current
 * fiscal year (later statements may revise them); a month's value is taken from its own statement,
 * the row of the statement's own month under its own fiscal year ("FY 2026").
 */
function readMts1(s, { rows }) {
  const byStatement = new Map();
  for (const r of rows) {
    if (!byStatement.has(r.record_date)) byStatement.set(r.record_date, []);
    byStatement.get(r.record_date).push(r);
  }
  const observations = [];
  let skipped = 0;
  for (const [, lines] of byStatement) {
    const { record_fiscal_year: fy, record_calendar_year: year, record_calendar_month: month } = lines[0];
    const heading = lines.find(r => r.classification_desc === `FY ${fy}`);
    const row = heading && lines.find(r => r.record_type_cd === 'MTH' && r.classification_desc === MONTHS[Number(month) - 1]
      && r.sequence_number_cd.split('.')[0] === heading.sequence_number_cd);
    const value = row ? printed(row.current_month_dfct_sur_amt === 'null' ? '' : row.current_month_dfct_sur_amt) : null;
    if (value === null) { skipped++; continue; }
    observations.push([`${year}-${month}-01`, value]);
  }
  return sorted(s, observations, skipped);
}

/** Daily Treasury Statement: one tax line's deposits (or, `withdrawal`, refunds paid) that day ("today"), in millions. */
function readDts(s, { rows }) {
  const [field, amount] = s.source === 'treasury-dts' ? ['transaction_catg', 'transaction_today_amt'] : ['tax_deposit_type', 'tax_deposit_today_amt'];
  const observations = [];
  let skipped = 0;
  for (const r of rows) {
    if (r[field] !== s.source_id || (r.transaction_type && r.transaction_type !== (s.withdrawal ? 'Withdrawals' : 'Deposits'))) continue;
    const value = printed(r[amount] === 'null' ? '' : r[amount]);
    if (value === null) { skipped++; continue; }
    observations.push([r.record_date, value]);
  }
  return sorted(s, observations, skipped);
}

/**
 * A fiscal year's first day: July 1 through FY 1976, October 1 from FY 1977; "TQ" is the transition
 * quarter between them (July–September 1976).
 */
function fiscalYearStart(label) {
  if (label === 'TQ') return '1976-07-01';
  const year = Number(label);
  return `${year - 1}-${year <= 1976 ? '07' : '10'}-01`;
}
const FISCAL_YEAR = /^(\d{4}|TQ)$/;

/** An OMB historical table: a column of the year rows, or (Table 2.4) a row across the year columns. */
function readOmb(s, rows) {
  const observations = [];
  let skipped = 0;
  const add = (label, cell) => {
    const value = printed(cell);
    if (value === null) skipped++;
    else observations.push([fiscalYearStart(label), value]);
  };
  if (s.row) {
    const years = rows.find(r => r[1] === '1940');
    const from = s.under ? rows.findIndex(r => r[0] === s.under) : 0;
    const row = rows.slice(from + 1).find(r => r[0] === s.row);
    if (from < 0 || !row) throw new Error(`${s.slug}: no row "${s.row}"${s.under ? ` under "${s.under}"` : ''}`);
    years.forEach((label, i) => { if (FISCAL_YEAR.test(label)) add(label, row[i]); });
  } else {
    for (const r of rows) if (FISCAL_YEAR.test(r[0])) add(r[0], r[s.column]); // "2026 estimate" rows are left out
  }
  return sorted(s, observations, skipped);
}

/** CBO's supplemental tables: an income group's rows, by year. */
function readCbo(s, rows) {
  const observations = rows.filter(r => r[0] === s.group && /^\d{4}$/.test(r[1]))
    .map(r => [`${r[1]}-01-01`, printed(r[s.column])]).filter(([, v]) => v !== null);
  return sorted(s, observations);
}

/** IRS SOI Table 23: the tax-year rows; a footnote mark before a value ("[24] 70.0") is not part of it. */
function readIrs(s, rows) {
  const observations = [];
  let skipped = 0;
  for (const r of rows) {
    if (!/^\d{4}$/.test(r[0])) continue;
    const value = printed(r[s.column]);
    if (value === null) skipped++;
    else observations.push([`${r[0]}-01-01`, value]);
  }
  return sorted(s, observations, skipped);
}

/**
 * USITC Table 1: the PDF's lines ([{ lines: [{ text }] }] per page, lib/pdf-lines.js), one row a year:
 * "1891 379,028 44.8 466,455 55.2 845,483 215,791 46.3 25.5" (duty free, %, dutiable, %, total, duties,
 * two ratios). Fiscal years (to 1917) are dated by their first day, July 1. A part of a year
 * ("1918 (July – Dec.)", "1930 (Jan. – June 17)") is skipped: it is not a year.
 */
const USITC_ROW = /^(\d{4})(?: \(([^)]+)\))? ([\d,]+) ([\d.]+) ([\d,]+) ([\d.]+) ([\d,]+) ([\d,]+) ([\d.]+) ([\d.]+)$/;
function readUsitc(s, pages) {
  const observations = [];
  let skipped = 0;
  for (const page of pages) {
    if (!page.lines.some(l => /^Table 1 /.test(l.text)) && !observations.length) continue;
    if (page.lines.some(l => /^Table 2/.test(l.text))) break;
    for (const { text } of page.lines) {
      const m = USITC_ROW.exec(text);
      if (!m) continue;
      if (m[2]) { skipped++; continue; }
      const year = Number(m[1]);
      observations.push([year < 1918 ? `${year - 1}-07-01` : `${year}-01-01`, printed(m[2 + s.column])]);
    }
  }
  if (!observations.length) throw new Error(`${s.slug}: no Table 1 rows`);
  return sorted(s, observations, skipped);
}

/**
 * Census trade history: gands.xlsx has a row a year ("1960", …); exhibit_history.xlsx a year heading
 * row, that year's total ("Jan. - Dec.", left out: it is not seasonally adjusted to the months) and a
 * row a month. Months not yet published are blank.
 */
function readCensusTrade(s, rows) {
  const observations = [];
  let skipped = 0;
  let year = null;
  for (const r of rows) {
    if (s.frequency === 'annual') {
      if (!/^\d{4}$/.test(r[0])) continue;
      const value = printed(r[s.column]);
      if (value === null) skipped++;
      else observations.push([`${r[0]}-01-01`, value]);
      continue;
    }
    if (/^\d{4}$/.test(r[0]) && !r[1]) { year = r[0]; continue; }
    const month = MONTHS.indexOf(r[0]);
    if (month < 0 || !year) continue;
    const value = printed(r[s.column]);
    if (value === null) skipped++;
    else observations.push([`${year}-${String(month + 1).padStart(2, '0')}-01`, value]);
  }
  return sorted(s, observations, skipped);
}

export function readObservations(s, file) {
  if (s.source === 'usitc') return readUsitc(s, file);
  if (s.source === 'census-trade') return readCensusTrade(s, file);
  if (s.source === 'treasury-mts') return readMts(s, file);
  if (s.source === 'treasury-mts-1') return readMts1(s, file);
  if (s.source === 'treasury-mts-4') return readMts4(s, file);
  if (s.source === 'treasury-dts' || s.source === 'treasury-dts-iv') return readDts(s, file);
  if (s.source === 'omb') return readOmb(s, file);
  if (s.source === 'cbo') return readCbo(s, file);
  if (s.source === 'irs-soi') return readIrs(s, file);
  if (s.source === 'atlantafed') return readHoam(s, file);
  if (s.source === 'census-nrs') return readNrsPrice(s, file);
  if (s.source === 'eia') return readEiaBulk(s, file);
  if (s.source === 'bls-bulk') return readBlsBulk(s, file);
  if (s.source === 'umich') return readUmich(s, file);
  if (s.source === 'census') return s.slug.startsWith('household-income') ? readCensusIncome(s, file) : readHomeownership(s, file);
  if (s.source === 'freddiemac') return readFreddie(s, file);
  if (s.source === 'fhfa') return readFhfa(s, file);
  if (s.source === 'cdc') return readCdc(s, file);
  if (s.source === 'fed-h15') return readH15(s, file);
  if (s.source === 'fed-omo') {
    const observations = fomcChanges(file).map(c => [c.date, String(c[s.source_id])]);
    return { description: s.description, observations, skipped: 0 };
  }
  if (s.source === 'bea') {
    const observations = readBea(s, file);
    return { description: s.description, observations, skipped: 0 };
  }
  if (s.source !== 'treasury') throw new Error(`${s.slug}: no reader for source ${s.source}`);
  // Debt to the Penny, in dollars → billions. Debt held by the public is "null" before September 1997.
  const observations = [];
  let skipped = 0;
  for (const row of file.rows) {
    const value = Number(row[s.source_id]);
    if (row[s.source_id] === 'null' || !Number.isFinite(value)) { skipped++; continue; }
    observations.push([row.record_date, String(value / 1e9)]);
  }
  observations.sort((a, b) => a[0].localeCompare(b[0]));
  return { description: s.description, observations, skipped };
}

// ---------------------------------------------------------------------------
// The publisher's own title for a series, verbatim from its files, and where it was read
// ({ title, from }), or null where the files carry none (codes only: Freddie Mac, FHFA, Michigan,
// the Census API) and for series computed here. `files` reads a downloaded file by path
// ({ text, json, rows }) so each is read once.

const blsSurveyFile = (survey, name) => path.join(DATA_DIR, 'download.bls.gov', 'pub', 'time.series', survey, name);

/** A BLS series' title from the survey's series list (<survey>.series, column series_title). */
function blsTitle(id, files) {
  const survey = id.slice(0, 2).toLowerCase();
  const text = files.text(blsSurveyFile(survey, `${survey}.series`));
  if (!text) return null;
  const [head, ...lines] = text.split('\n');
  const col = head.split('\t').map(c => c.trim()).indexOf('series_title');
  const line = lines.find(l => l.split('\t')[0].trim() === id);
  const title = line?.split('\t')[col]?.trim();
  return title ? { title, from: `BLS ${survey}.series, series_title` } : null;
}

// BEA's registers, read once: series code → [line, label, metric, calculation]; table id → title.
let beaRegisters = null;
function beaRegister(files) {
  if (!beaRegisters) {
    const series = new Map();
    for (const line of (files.text(mirrorFile(BEA_FILES[3])) ?? '').split('\n')) {
      const m = /^([^,]+),"([^"]*)","([^"]*)","([^"]*)"/.exec(line);
      if (m && !series.has(m[1])) series.set(m[1], m.slice(1));
    }
    const tables = new Map();
    for (const line of (files.text(mirrorFile(BEA_FILES[4])) ?? '').split('\n')) {
      const m = /^([^,]+),"([^"]*)"/.exec(line);
      if (m) tables.set(m[1], m[2]);
    }
    beaRegisters = { series, tables };
  }
  return beaRegisters;
}

export function publisherTitle(s, files) {
  switch (s.source) {
    case 'eia': {
      const title = files.eia()?.get(eiaBulkId(s))?.name;
      return title ? { title, from: 'EIA bulk file PET.txt, name' } : null;
    }
    case 'census-nrs': {
      const rows = files.rows(seriesFile(s), s.sheet);
      return rows?.[0]?.[0] ? { title: `${rows[0][0]}: ${s.source_id}`, from: 'Census price_cust.xlsx, Monthly sheet: title and column heading' } : null;
    }
    case 'bls-bulk':
      return blsTitle(s.source_id, files);
    case 'bea': {
      const m = beaRegister(files).series.get(s.source_id);
      if (!m) return null;
      // A NIPA table's line: the table as BEA titles it, the line number and the line's own label (the "original name").
      const table = s.nipa && beaRegister(files).tables.get(s.nipa.table);
      if (table) return { title: `${table}, line ${s.nipa.line}: ${m[1]} (${m[2]}, ${m[3]})`, from: 'BEA TablesRegister.txt TableTitle; SeriesRegister.txt SeriesLabel, MetricName, CalculationType' };
      return { title: `${m[1]}, ${m[2]}, ${m[3]}`, from: 'BEA SeriesRegister.txt: SeriesLabel, MetricName, CalculationType' };
    }
    case 'treasury': {
      const title = files.json(seriesFile(s))?.labels?.[s.source_id];
      return title ? { title, from: 'Treasury Fiscal Data API, Debt to the Penny field label' } : null;
    }
    case 'fed-h15': {
      const xml = files.h15();
      const at = xml?.indexOf(`SERIES_NAME="${s.source_id}"`) ?? -1;
      const title = at < 0 ? null : /Long Description<\/common:AnnotationType>\s*<common:AnnotationText>([^<]*)</.exec(xml.slice(at, at + 2000))?.[1];
      return title ? { title, from: 'Federal Reserve H.15 (H15_data.xml), Long Description' } : null;
    }
    case 'fed-omo': {
      // The heading has markup inside it (a footnote link), so it is read from the page's text.
      const text = (files.text(mirrorFile(FED_OMO_PAGES[0])) ?? '')
        .replace(/<[^>]+>/g, ' ').replace(/&#39;|&rsquo;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
      const title = /FOMC's target federal funds rate or range, change \(basis points\) and level/.exec(text)?.[0];
      return title ? { title, from: 'Federal Reserve, Open Market Operations page, table heading' } : null;
    }
    case 'census': {
      const rows = files.rows(seriesFile(s));
      if (!rows) return null;
      if (s.slug.startsWith('household-income')) {
        const units = rows.find(r => /Current/.test(r[2] ?? ''))?.[s.column]?.replace(/\s+/g, ' ');
        return { title: `${rows[1][0]}: All Races, Median income, ${units}`, from: 'Census Table H-5, title and column headings' };
      }
      return { title: `${rows[1][0]}: United States`, from: 'Census HVS Table 14, title and row heading' };
    }
    case 'atlantafed':
      return files.rows(seriesFile(s))?.[0]?.includes(s.source_id)
        ? { title: s.source_id, from: 'Atlanta Fed HOAM_US_Affordability_Index.xlsx, column heading' }
        : null;
    case 'cdc': {
      const meta = files.json(mirrorFile(CDC_COVID_META));
      const column = meta?.columns?.find(c => c.name === s.source_id);
      return meta && column ? { title: `${meta.name}: ${column.name} (${column.description})`, from: 'CDC data.cdc.gov metadata, dataset name and column' } : null;
    }
    case 'treasury-mts':
    case 'treasury-mts-1':
    case 'treasury-mts-4':
    case 'treasury-dts':
    case 'treasury-dts-iv': {
      const { name } = FISCAL_DATASETS[s.source];
      const field = s.field ?? { 'treasury-mts': 'current_month_rcpt_outly_amt', 'treasury-mts-1': 'current_month_dfct_sur_amt', 'treasury-dts': 'transaction_today_amt', 'treasury-dts-iv': 'tax_deposit_today_amt' }[s.source];
      const label = files.json(seriesFile(s))?.labels?.[field];
      const line = s.line ?? (s.source === 'treasury-mts-1' ? null : s.source_id);
      return label ? { title: line ? `${line}: ${label}` : label, from: `Treasury Fiscal Data API, ${name}: ${line ? 'line and ' : ''}field label` } : null;
    }
    case 'omb':
    case 'irs-soi': {
      const rows = files.rows(seriesFile(s));
      if (!rows) return null;
      const title = rows[0][0].replace(/\s+/g, ' ').trim();
      if (s.row) return { title: `${title}: ${s.label}`, from: 'OMB Historical Tables, table title and row headings' };
      // Heading rows lie between the title and the first year; a heading over several columns is
      // written in its first, so an empty cell takes the one to its left (never the year column's).
      const first = rows.findIndex(r => FISCAL_YEAR.test(r[0]));
      const heads = rows.slice(1, first).map((r, i, all) => {
        let col = s.column;
        if (i < all.length - 1) while (col > 1 && !r[col]) col--;
        return (r[col] ?? '').replace(/\s+/g, ' ').trim();
      }).filter(h => h && !/^\d+$/.test(h)); // IRS numbers its columns in a row of their own
      return { title: `${title}: ${heads.join(', ')}`, from: `${s.source === 'omb' ? 'OMB Historical Tables' : 'IRS SOI Historical Table 23'}, table title and column headings` };
    }
    case 'cbo': {
      const rows = files.rows(seriesFile(s), s.sheet);
      const title = rows?.find(r => /^Table \d+\./.test(r[0]))?.[0].replace(/\s+/g, ' ').trim();
      const head = rows?.find(r => r[0] === 'Income group')?.[s.column]?.replace(/\s+/g, ' ').trim();
      return title && head ? { title: `${title}: ${s.group}, ${head}`, from: `CBO supplemental data, tab "${s.sheet}": table title, income group and column heading` } : null;
    }
    case 'usitc': {
      const pages = files.pdf?.(seriesFile(s));
      const title = pages?.flatMap(p => p.lines).find(l => /^Table 1 /.test(l.text))?.text;
      return title ? { title: `${title}: ${USITC_COLUMNS[Object.keys(USITC_COLUMNS).find(k => USITC_COLUMNS[k][0] === s.column)][1]}`, from: 'USITC ave_table.pdf, table title and column heading' } : null;
    }
    case 'census-trade': {
      const rows = files.rows(seriesFile(s));
      if (!rows) return null;
      // "Balance", "Exports" and "Imports" each head three columns, centred over them, so the one a
      // column falls under is taken from the series and checked against the heading row.
      const head = rows.findIndex(r => r[0] === 'Period');
      const side = s.source_id.split(': ')[1].split(', ')[0];
      if (head < 1 || !rows[head - 1].includes(side)) return null;
      return { title: `${rows[0][0]}: ${side}, ${rows[head][s.column]}`, from: `Census ${path.basename(s.url)}, title and column headings` };
    }
    default:
      return null;
  }
}

export const SCHEMA = `
  CREATE TABLE IF NOT EXISTS economic_series (
    id           SERIAL PRIMARY KEY,
    slug         TEXT NOT NULL UNIQUE,          -- 'wti-spot'
    source       TEXT NOT NULL,                 -- how it is read: 'eia' | 'bls-bulk' | 'bea' | … (SERIES)
    source_id    TEXT NOT NULL,                 -- 'RWTC', 'LNS14000000'
    route        TEXT,                          -- 'petroleum/pri/spt' (EIA API path)
    frequency    TEXT NOT NULL,                 -- 'daily' | 'weekly' | 'four-week-average' (EIA's, dated by the last week's end) | 'monthly' | 'quarterly' | 'annual' | 'fiscal-year' (dated by its first day) | 'irregular' (a value from each date on)
    name         TEXT NOT NULL,                 -- 'U.S. Crude Oil Price (WTI)'
    description  TEXT,                          -- written by GovGraph (see publisher_title below)
    category     TEXT,                          -- 'crude' | 'retail' | 'unemployment' | 'inflation' | 'housing' | 'health' | 'rates' | …
    unit         TEXT NOT NULL,                 -- '$/bbl', '$/gal', '%', 'thousands', '$bn', '$m' (millions), 'index', '$', 'x', 'deaths', 'kb/d' (thousand barrels per day)
    first_date   DATE,
    last_date    DATE,
    loaded_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (source, source_id, frequency)
  );
  -- description: written by GovGraph. publisher_title: the publisher's own title, verbatim from
  -- its files (null where they carry none); publisher_title_from: the file and field it was read from.
  ALTER TABLE economic_series ADD COLUMN IF NOT EXISTS publisher_title TEXT;
  ALTER TABLE economic_series ADD COLUMN IF NOT EXISTS publisher_title_from TEXT;

  CREATE TABLE IF NOT EXISTS economic_observations (
    series_id  INT NOT NULL REFERENCES economic_series(id) ON DELETE CASCADE,
    date       DATE NOT NULL,                   -- the period's first day (a week's Monday, a month's or quarter's 1st)
    value      NUMERIC NOT NULL,
    PRIMARY KEY (series_id, date)
  );

  -- Demographic series (lib/population/series.js) are kept per place: measure is the national
  -- series' slug they belong to, place the place's key ('ca', 'ca-12-l113'). Both null for every
  -- other series, which are national.
  ALTER TABLE economic_series ADD COLUMN IF NOT EXISTS measure TEXT;
  ALTER TABLE economic_series ADD COLUMN IF NOT EXISTS place TEXT;
  CREATE INDEX IF NOT EXISTS economic_series_measure ON economic_series (measure);

  -- The program it comes from (source_programs; seed/data/sources.json, lib/sources.js).
  ALTER TABLE economic_series ADD COLUMN IF NOT EXISTS program TEXT;
`;
