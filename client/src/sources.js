// Printing the sources (pages/DataSources.jsx, SourceProgram.jsx).

/** 31959786 → "32.0 MB" */
export function bytes(n) {
  if (!n) return '—';
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`;
  if (n >= 1e3) return `${Math.round(n / 1e3)} KB`;
  return `${n} B`;
}

// What the terms allow, as a chip: free to reuse is "ok", conditions "warn", not ours to collect "danger".
export const LICENCE_CHIP = {
  'public-domain': 'chip ok', 'open-licence': 'chip ok', 'free-with-terms': 'chip warn', licensed: 'chip danger', unchecked: 'chip',
};

// A key is what we want to stop depending on.
export const accessChip = a => (a === 'api-key' ? 'chip warn' : 'chip');

/** Whether the 2012 Statistical Abstract cites the program: true, false or null (not yet compared). */
export const abstractLabel = inAbstract =>
  inAbstract === true ? 'In the Statistical Abstract' : inAbstract === false ? 'Not in the Statistical Abstract' : 'Not yet compared';

export const ABSTRACT_OPTIONS = [
  { value: 'yes', label: 'In it', test: d => d.inAbstract === true },
  { value: 'no', label: 'Not in it', test: d => d.inAbstract === false },
  { value: 'unknown', label: 'Not yet compared', test: d => d.inAbstract == null },
];

export const publishers = d => d.organizations.filter(o => o.role === 'publisher').map(o => o.organization);
