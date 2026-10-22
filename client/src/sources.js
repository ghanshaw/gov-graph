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

// Where a program stands on the download list (server/sources.js, downloadPlan); a program may be in more than one.
export const DOWNLOAD_OPTIONS = [
  { value: 'files', label: 'Files on disk', test: d => d.fileCount > 0 },
  { value: 'to-get', label: 'Still to get', test: d => d.downloadState === 'to-get' },
  { value: 'nothing', label: 'No file to get', test: d => d.downloadState === 'nothing' },
  { value: 'none', label: 'Nothing downloaded', test: d => d.fileCount === 0 },
];

export const publishers = d => d.organizations.filter(o => o.role === 'publisher').map(o => o.organization);

// How much of an Abstract table GovGraph holds (lib/abstract-coverage.js), as a chip; the order the report counts them in.
export const COVERAGE_ORDER = ['have', 'partly', 'wanted', 'licensed', 'discontinued', 'unpublished', 'compiled'];
export const COVERAGE_CHIP = {
  have: 'chip ok', partly: 'chip accent', wanted: 'chip', licensed: 'chip danger', discontinued: 'chip warn', unpublished: 'chip', compiled: 'chip',
};
