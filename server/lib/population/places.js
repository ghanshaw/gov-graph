// The places demographic series are kept for: the nation, the states (with D.C. and Puerto Rico,
// where a file publishes them) and congressional districts, by the lines they were drawn on.

export const STATES = [
  ['01', 'al', 'Alabama'], ['02', 'ak', 'Alaska'], ['04', 'az', 'Arizona'], ['05', 'ar', 'Arkansas'],
  ['06', 'ca', 'California'], ['08', 'co', 'Colorado'], ['09', 'ct', 'Connecticut'], ['10', 'de', 'Delaware'],
  ['11', 'dc', 'District of Columbia'], ['12', 'fl', 'Florida'], ['13', 'ga', 'Georgia'], ['15', 'hi', 'Hawaii'],
  ['16', 'id', 'Idaho'], ['17', 'il', 'Illinois'], ['18', 'in', 'Indiana'], ['19', 'ia', 'Iowa'],
  ['20', 'ks', 'Kansas'], ['21', 'ky', 'Kentucky'], ['22', 'la', 'Louisiana'], ['23', 'me', 'Maine'],
  ['24', 'md', 'Maryland'], ['25', 'ma', 'Massachusetts'], ['26', 'mi', 'Michigan'], ['27', 'mn', 'Minnesota'],
  ['28', 'ms', 'Mississippi'], ['29', 'mo', 'Missouri'], ['30', 'mt', 'Montana'], ['31', 'ne', 'Nebraska'],
  ['32', 'nv', 'Nevada'], ['33', 'nh', 'New Hampshire'], ['34', 'nj', 'New Jersey'], ['35', 'nm', 'New Mexico'],
  ['36', 'ny', 'New York'], ['37', 'nc', 'North Carolina'], ['38', 'nd', 'North Dakota'], ['39', 'oh', 'Ohio'],
  ['40', 'ok', 'Oklahoma'], ['41', 'or', 'Oregon'], ['42', 'pa', 'Pennsylvania'], ['44', 'ri', 'Rhode Island'],
  ['45', 'sc', 'South Carolina'], ['46', 'sd', 'South Dakota'], ['47', 'tn', 'Tennessee'], ['48', 'tx', 'Texas'],
  ['49', 'ut', 'Utah'], ['50', 'vt', 'Vermont'], ['51', 'va', 'Virginia'], ['53', 'wa', 'Washington'],
  ['54', 'wv', 'West Virginia'], ['55', 'wi', 'Wisconsin'], ['56', 'wy', 'Wyoming'], ['72', 'pr', 'Puerto Rico'],
].map(([fips, abbr, name]) => ({ fips, abbr, name }));

export const stateByFips = new Map(STATES.map(s => [s.fips, s]));
export const stateByAbbr = new Map(STATES.map(s => [s.abbr, s]));
export const stateByName = new Map(STATES.map(s => [s.name.toLowerCase(), s]));

// Districts are comparable only while their lines stay the same. Lines are redrawn after each census
// (taking effect with the 113th Congress in the 2010 cycle, the 118th in the 2020 cycle; the 2000
// cycle's lines were in place by the 109th, the first the ACS reports), and some states redrew
// between censuses. Mid-cycle redraws by the Congress they took effect with, as listed in the
// Census Bureau's TIGER/Line notes for each Congress's districts.
const CYCLE_STARTS = [109, 113, 118];
export const MID_CYCLE_REDRAWS = {
  110: ['ga', 'tx'],
  115: ['fl', 'nc', 'va'],
  116: ['pa'],
  117: ['nc'],
  119: ['al', 'ga', 'la', 'ny', 'nc'],
};

/** The first Congress of the lines a state's districts were on in a Congress: 109, 113, 115, … */
export function linesOf(abbr, congress) {
  let start = CYCLE_STARTS.filter(c => c <= congress).at(-1) ?? congress;
  for (const [c, states] of Object.entries(MID_CYCLE_REDRAWS)) {
    if (Number(c) > start && Number(c) <= congress && states.includes(abbr)) start = Number(c);
  }
  return start;
}

const ordinal = n => `${n}${[11, 12, 13].includes(n % 100) ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;

/**
 * A place: { key, level, label, state?, district?, lines? }. `key` is the slug suffix
 * ('ca', 'ca-12-l113'); nation has key null. `lastCongress` closes a district's lines in its label.
 */
export const NATION = { key: null, level: 'nation', label: 'United States' };
export const statePlace = s => ({ key: s.abbr, level: 'state', label: s.name, state: s.abbr });
export function districtPlace(s, district, lines, lastCongress) {
  const atLarge = district === '00' || district === '98';
  const range = lastCongress && lastCongress > lines ? `${ordinal(lines)}–${ordinal(lastCongress)}` : `${ordinal(lines)}`;
  return {
    key: `${s.abbr}-${district}-l${lines}`, level: 'district', state: s.abbr, district, lines,
    label: `${s.name} ${atLarge ? 'at Large' : `District ${Number(district)}`} (${range} Congress Lines)`,
  };
}
