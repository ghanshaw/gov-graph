// The tabs of the Demographic Data page (pages/Demographics.jsx), shaped like ECONOMY_TABS
// (economy.js): each series is a measure (server/lib/population/series.js), published for the nation
// and, where the Census Bureau publishes it, for each state and congressional district. The last tab
// lists the Census Bureau's files as downloaded.

const ACS_NOTE = 'American Community Survey 1-year estimates: places of 65,000 people or more, every year from 2005 except 2020, when no 1-year estimates were released. Each figure is an estimate with a margin of error (shown in the source files). Districts are kept by the lines they were drawn on.';

export const DEMOGRAPHY_TABS = [
  {
    slug: 'population',
    label: 'Population',
    lede: 'How many people live in the country and each state: the Census Bureau’s estimate for July 1 of every year since 1900, the count of every census since 1790, the House seats each census apportioned, and the births, deaths and migration behind each year’s change.',
    series: [
      { value: 'population', group: 'Population' },
      { value: 'census-population', group: 'Population' },
      { value: 'house-seats', label: 'House Seats', group: 'Population' }, // states only: no national series to take its name from
      { value: 'births', group: 'Change' },
      { value: 'deaths', group: 'Change' },
      { value: 'natural-increase', group: 'Change' },
      { value: 'international-migration', group: 'Change' },
      { value: 'domestic-migration', group: 'Change' },
    ],
    note: 'Estimates are the Census Bureau’s, one file per decade; where a later file revised a year, the later figure is shown. House seats are by state only.',
  },
  {
    slug: 'age-sex',
    label: 'Age & Sex',
    lede: 'Median age, and the number of men and women, from the American Community Survey.',
    series: [
      { value: 'median-age', group: 'Age' },
      { value: 'median-age-men', group: 'Age' },
      { value: 'median-age-women', group: 'Age' },
      { value: 'men', group: 'Sex' },
      { value: 'women', group: 'Sex' },
    ],
    note: ACS_NOTE,
  },
  {
    slug: 'race',
    label: 'Race & Origin',
    lede: 'People by race, as they report it, and Hispanic or Latino origin, which the Census Bureau asks separately: Hispanic or Latino people may be of any race.',
    series: [
      { value: 'race-white', group: 'Race' },
      { value: 'race-black', group: 'Race' },
      { value: 'race-american-indian', group: 'Race' },
      { value: 'race-asian', group: 'Race' },
      { value: 'race-pacific-islander', group: 'Race' },
      { value: 'race-other', group: 'Race' },
      { value: 'race-two-or-more', group: 'Race' },
      { value: 'hispanic', group: 'Origin' },
    ],
    note: ACS_NOTE,
  },
  {
    slug: 'income',
    label: 'Income & Poverty',
    lede: 'Household and per person income, inequality, and the number of people below the federal poverty line. The ACS prints dollars of each survey year; the Current Population Survey’s national median goes back to 1967.',
    series: [
      { value: 'acs-median-household-income', group: 'Income' },
      { value: 'per-capita-income', group: 'Income' },
      { value: 'household-income', group: 'Income' },
      { value: 'household-income-real', group: 'Income' },
      { value: 'gini-index', group: 'Inequality' },
      { value: 'below-poverty', group: 'Poverty' },
    ],
    note: `${ACS_NOTE} The Current Population Survey series are national only.`,
  },
  {
    slug: 'education-work',
    label: 'Education & Work',
    lede: 'The highest level of school completed by people 25 and over, the labor force, and veterans.',
    series: [
      { value: 'high-school-diploma', group: 'Education' },
      { value: 'bachelors-degree', group: 'Education' },
      { value: 'masters-degree', group: 'Education' },
      { value: 'doctorate-degree', group: 'Education' },
      { value: 'in-labor-force', group: 'Work' },
      { value: 'acs-unemployed', group: 'Work' },
      { value: 'veterans', group: 'Work' },
    ],
    note: `${ACS_NOTE} Educational attainment (table B15003) and employment status (B23025) were added to the ACS after 2005; each chart starts with the first year published.`,
  },
  {
    slug: 'households',
    label: 'Households & Housing',
    lede: 'Households, homes owned and rented, and couples of the same sex: unmarried partners of the same sex (table B11009), and same-sex spouses and partners where the ACS prints them (B09019).',
    series: [
      { value: 'households', group: 'Households' },
      { value: 'owner-occupied', group: 'Housing' },
      { value: 'renter-occupied', group: 'Housing' },
      { value: 'male-couple-households', group: 'Same-sex couples' },
      { value: 'female-couple-households', group: 'Same-sex couples' },
      { value: 'same-sex-spouse', group: 'Same-sex couples' },
      { value: 'same-sex-partner', group: 'Same-sex couples' },
    ],
    note: `${ACS_NOTE} The Census Bureau does not ask about sexual orientation or gender identity in the census or the ACS.`,
  },
  {
    slug: 'nativity',
    label: 'Nativity & Language',
    lede: 'People born abroad, by citizenship, and people who speak only English at home.',
    series: [
      { value: 'foreign-born', group: 'Nativity' },
      { value: 'naturalized', group: 'Nativity' },
      { value: 'not-a-citizen', group: 'Nativity' },
      { value: 'english-only', group: 'Language' },
    ],
    note: ACS_NOTE,
  },
  { slug: 'files', label: 'Source Files', files: true },
];
