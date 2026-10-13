// What the population section is built from: Census Bureau files, downloaded as published into the
// data directory at their own paths (see lib/data-dir.js, mirrorFile) and read from there. Nothing
// is loaded into the database. Used by seed/fetch-population.js and server/population.js.
//
// Each collection is a directory on www2.census.gov that the fetch script lists (recursively) and
// mirrors, keeping data files and leaving out PDFs and county / city / metro detail.

export const CENSUS = 'https://www2.census.gov/';

// File types kept: data and spreadsheets. PDFs repeat the spreadsheets.
export const DATA_FILE = /\.(csv|txt|xls|xlsx|dat|zip)$|\.\d{4}-1yr$|geo\.\d{4}-1yr$/i;
// Below the state level, or other surveys mixed into a directory.
export const SKIP_DIR = /(^|\/)(count(y|ies)|cities|city|metro|places?|puerto-rico-commonwealth|cbsa|st-co|sub-?county|housing|css)\b/i;

export const COLLECTIONS = [
  {
    id: 'apportionment',
    title: 'Apportionment of the House',
    years: '1910–2020',
    description: 'Resident and apportionment population, seats, change in seats and people per seat by state, from each census since 1910; priority values and overseas counts for 2000–2020.',
    dirs: [
      'programs-surveys/decennial/2020/data/apportionment/',
      'programs-surveys/decennial/2010/data/apportionment/',
      'programs-surveys/decennial/2000/data/apportionment/',
    ],
  },
  {
    id: 'census-counts',
    title: 'Census counts of the states, 1790–1990',
    years: '1790–1990',
    description: 'Population of every state at every census from 1790 to 1990 (Population of States and Counties of the United States: 1790 to 1990).',
    dirs: ['programs-surveys/decennial/tables/1990/population-of-states-and-counties-us-1790-1990/'],
  },
  {
    id: 'race-1790',
    title: 'Population by race and Hispanic origin, 1790–1990',
    years: '1790–1990',
    description: 'Census counts by race (and by Hispanic origin from 1970), for the United States, regions, divisions and states (Working Paper 56, Gibson and Jung, 2002).',
    dirs: ['library/working-papers/2002/demo/pop-twps0056/'],
  },
  {
    id: 'estimates-national',
    title: 'National estimates by age, sex and race, 1900–',
    years: '1900–2025',
    description: 'The Census Bureau’s annual population estimates for the nation, by age, sex, race and Hispanic origin where published.',
    dirs: [
      'programs-surveys/popest/tables/1900-1980/national/',
      'programs-surveys/popest/datasets/1970-1980/national/',
      'programs-surveys/popest/tables/1980-1990/national/',
      'programs-surveys/popest/datasets/1980-1990/national/',
      'programs-surveys/popest/tables/1990-2000/national/',
      'programs-surveys/popest/datasets/1990-2000/national/',
      'programs-surveys/popest/datasets/2000-2010/intercensal/national/',
      'programs-surveys/popest/datasets/2010-2020/national/',
      'programs-surveys/popest/datasets/2020-2025/national/',
    ],
  },
  {
    id: 'estimates-state',
    title: 'State estimates by age, sex, race and Hispanic origin, 1900–',
    years: '1900–2025',
    description: 'Annual population estimates for each state: totals from 1900, and by age, sex, race and Hispanic origin from 1980; components of change (births, deaths, migration) from 2000.',
    dirs: [
      'programs-surveys/popest/tables/1900-1980/state/',
      'programs-surveys/popest/tables/1980-1990/state/',
      'programs-surveys/popest/datasets/1980-1990/state/',
      'programs-surveys/popest/tables/1990-2000/state/',
      'programs-surveys/popest/datasets/1990-2000/intercensal/',
      'programs-surveys/popest/datasets/2000-2010/intercensal/state/',
      'programs-surveys/popest/datasets/2010-2020/state/',
      'programs-surveys/popest/datasets/2020-2025/state/',
    ],
  },
  {
    id: 'income-states',
    title: 'Household income by state, 1959–',
    years: '1959–',
    description: 'Median household and family income by state from the decennial censuses, and the Current Population Survey’s historical household income tables (income by state since 1984 in h05; distribution, race, sex and other tables for the nation).',
    dirs: [
      'programs-surveys/decennial/tables/time-series/historical-income-states/',
      'programs-surveys/cps/tables/time-series/historical-income-households/',
    ],
  },
];

// The American Community Survey, 1-year estimates, for the nation, the states and the congressional
// districts. Its summary files carry every table for every geography; only these tables are kept.
// Some begin later than 2005 (the fetch script notes which years lack which).
export const ACS_TABLES = [
  ['B01001', 'Sex by age'],
  ['B01002', 'Median age by sex'],
  ['B02001', 'Race'],
  ['B03002', 'Hispanic or Latino origin by race'],
  ['B05002', 'Place of birth by nativity and citizenship status'],
  ['B11001', 'Household type'],
  ['B11009', 'Coupled-household type (same-sex and opposite-sex couples)'],
  ['B09019', 'Household type (including same-sex spouse and unmarried partner) by relationship'],
  ['B12001', 'Sex by marital status'],
  ['B15002', 'Sex by educational attainment, 25 years and over'],
  ['B15003', 'Educational attainment, 25 years and over'],
  ['B16001', 'Language spoken at home by ability to speak English'],
  ['B17001', 'Poverty status in the past 12 months by sex by age'],
  ['B18101', 'Sex by age by disability status'],
  ['B19001', 'Household income in the past 12 months'],
  ['B19013', 'Median household income in the past 12 months'],
  ['B19083', 'Gini index of income inequality'],
  ['B19301', 'Per capita income in the past 12 months'],
  ['B20002', 'Median earnings by sex'],
  ['B21001', 'Sex by age by veteran status'],
  ['B23001', 'Sex by age by employment status'],
  ['B23025', 'Employment status'],
  ['C24010', 'Sex by occupation'],
  ['B25003', 'Tenure (owner or renter occupied)'],
  ['B27001', 'Health insurance coverage status by sex by age'],
];

// 2005–2019 come as sequence files (several tables per file, one file per state); 2021 on as one file
// per table. There was no standard 1-year release for 2020.
export const ACS_SEQUENCE_YEARS = [2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019];
export const ACS_TABLE_YEARS = [2021, 2022, 2023, 2024, 2025];
export const ACS = `${CENSUS}programs-surveys/acs/summary_file/`;

// The summary levels kept: the nation, the states, the congressional districts.
export const ACS_SUMLEVELS = { '010': 'nation', '040': 'state', '500': 'district' };

export const STATE_FOLDERS = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware',
  'DistrictofColumbia', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas',
  'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
  'Missouri', 'Montana', 'Nebraska', 'Nevada', 'NewHampshire', 'NewJersey', 'NewMexico', 'NewYork',
  'NorthCarolina', 'NorthDakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'PuertoRico', 'RhodeIsland',
  'SouthCarolina', 'SouthDakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington',
  'WestVirginia', 'Wisconsin', 'Wyoming',
];
