// Shared wording for people and their roles (pages/People.jsx, pages/Person.jsx).

export const STATES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut',
  DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan',
  MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia',
  WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia', PR: 'Puerto Rico', GU: 'Guam',
  VI: 'Virgin Islands', AS: 'American Samoa', MP: 'Northern Mariana Islands',
  DK: 'Dakota Territory', OL: 'Orleans Territory', PI: 'Philippine Islands',
};

export const ROLE_LABELS = {
  representative: 'Representative',
  senator: 'Senator',
  vice_president: 'Vice President',
  president: 'President',
  justice: 'Associate Justice',
  chief_justice: 'Chief Justice',
};

// The roles people can be listed by, for the rail.
export const ROLE_OPTIONS = [
  { value: null, label: 'All' },
  { value: 'senator', label: 'Senators' },
  { value: 'representative', label: 'Representatives' },
  { value: 'president', label: 'Presidents' },
  { value: 'vice_president', label: 'Vice Presidents' },
  { value: 'justice', label: 'Justices' },
];

// Parties as the legislators list names them ("Democrat") or as votes print them ("D").
const PARTY_CLASSES = { Democrat: 'dem', D: 'dem', Republican: 'rep', R: 'rep', Independent: 'ind', I: 'ind', ID: 'ind' };
export const partyClass = party => PARTY_CLASSES[party] ?? '';

const TYPE_CODE = {
  hr: 'H.R.', s: 'S.', hjres: 'H.J.Res.', sjres: 'S.J.Res.',
  hconres: 'H.Con.Res.', sconres: 'S.Con.Res.', hres: 'H.Res.', sres: 'S.Res.',
};
export const billCode = bill => `${TYPE_CODE[bill.type.toLowerCase()] ?? bill.type} ${bill.number}`;
export const billPath = bill => `/congress/${bill.congress}/${bill.type.toLowerCase()}/${bill.number}`;

export const year = iso => (iso ? iso.slice(0, 4) : '');

// "2007 – present", or "1973 – 2009"
export function years(start, end, current) {
  return `${year(start)} – ${current ? 'present' : year(end)}`;
}

export function formatDate(iso) {
  if (!iso) return null;
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function ordinal(n) {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

// "Representative, Florida 12th district" / "… Florida 9th → 12th district" (redistricted) /
// "Senator, Delaware" / "President"
export function roleTitle({ roleType, state, districts = [] }) {
  const label = ROLE_LABELS[roleType] ?? roleType;
  if (!state) return label;
  let district = '';
  if (roleType === 'representative' && districts.length) {
    district = districts.length === 1 && districts[0] === 0
      ? ' at large'
      : ` ${districts.map(d => (d === 0 ? 'at large' : ordinal(d))).join(' → ')} district`;
  }
  return `${label}, ${STATES[state] ?? state}${district}`;
}
