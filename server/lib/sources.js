// Where GovGraph's data comes from: organizations (who publishes), their lineage (renamed, merged,
// moved, abolished), programs (what they publish, the terms, how we get it) and files (what was
// downloaded). Organizations, lineage and programs are written by hand in seed/data/sources.json;
// files are found in the data folder. Used by seed/load-sources.js, server/sources.js and the test.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DATA_DIR, FETCH_LOG } from './data-dir.js';
import { SERIES, seriesFile } from './economic-series.js';

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'seed', 'data', 'sources.json');

export const readSources = () => JSON.parse(fs.readFileSync(FILE, 'utf8'));

// Vocabularies. A value outside these is refused by checkSources.
export const ORGANIZATION_KINDS = {
  federal: 'U.S. federal', 'federal-reserve-bank': 'Federal Reserve Bank', 'government-sponsored': 'Government-sponsored',
  state: 'State or local', international: 'International', 'foreign-government': 'Foreign government',
  industry: 'Industry', academic: 'Academic', nonprofit: 'Nonprofit', community: 'Community project', private: 'Private',
};
export const BRANCHES = ['executive', 'legislative', 'judicial'];
export const LINEAGE_KINDS = ['renamed', 'merged', 'transferred', 'split', 'abolished'];
// A classification is a scheme for sorting other data (a codebook of topics), shown on the Taxonomies page.
// A program produces statistics; a collection publishes documents (GLOSSARY.md). Both are rows of source_programs.
export const PROGRAM_KINDS = { statistics: 'Programs', documents: 'Collections', classification: 'Classifications' };
export const ROLES = ['publisher', 'producer', 'distributor', 'former-publisher'];
// What a program's terms allow. Federal works are public domain (17 U.S.C. 105); anything else is
// read on the publisher's site and dated (`checked`).
export const LICENCES = {
  'public-domain': 'Public domain', 'open-licence': 'Open licence', 'free-with-terms': 'Free, with terms',
  licensed: 'Licensed', unchecked: 'Not checked',
};
// How a program is fetched, most preferred first.
export const ACCESS = {
  bulk: 'Bulk download', file: 'File', api: 'API', 'api-key': 'API with key', page: 'Web page', archive: 'Internet Archive',
};
export const STATUSES = {
  active: 'Active', final: 'Final edition', discontinued: 'Discontinued', moved: 'Moved',
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Every problem in sources.json, as sentences; [] when it is sound. */
export function checkSources({ organizations, lineage, programs }) {
  const problems = [];
  const orgs = new Set();
  for (const o of organizations) {
    if (orgs.has(o.slug)) problems.push(`organization ${o.slug} is listed twice`);
    orgs.add(o.slug);
    for (const key of ['slug', 'name', 'short_name', 'kind']) if (!o[key]) problems.push(`organization ${o.slug}: no ${key}`);
    if (!ORGANIZATION_KINDS[o.kind]) problems.push(`organization ${o.slug}: unknown kind ${o.kind}`);
    if (o.kind === 'federal' && !BRANCHES.includes(o.branch)) problems.push(`organization ${o.slug}: a federal body needs a branch`);
  }
  for (const o of organizations) if (o.parent && !orgs.has(o.parent)) problems.push(`organization ${o.slug}: unknown parent ${o.parent}`);
  for (const l of lineage) {
    const name = `lineage ${l.from} → ${l.to}`;
    if (!orgs.has(l.from)) problems.push(`${name}: unknown organization ${l.from}`);
    if (l.to !== null && !orgs.has(l.to)) problems.push(`${name}: unknown organization ${l.to}`);
    if ((l.to === null) !== (l.kind === 'abolished')) problems.push(`${name}: only an abolished body has no successor`);
    if (!LINEAGE_KINDS.includes(l.kind)) problems.push(`${name}: unknown kind ${l.kind}`);
    if (!DATE.test(l.date ?? '')) problems.push(`${name}: date must be YYYY-MM-DD`);
    if (l.document && !/^(fr|bill|usc):\S+$/.test(l.document)) problems.push(`${name}: document must be fr:, bill: or usc:`);
  }
  const slugs = new Set(programs.map(d => d.slug));
  const prefixes = new Map();
  const seriesSources = new Map();
  for (const d of programs) {
    const name = `program ${d.slug}`;
    for (const key of ['slug', 'name', 'kind', 'description', 'homepage', 'status']) if (!d[key]) problems.push(`${name}: no ${key}`);
    if (!PROGRAM_KINDS[d.kind]) problems.push(`${name}: unknown kind ${d.kind}`);
    if (!STATUSES[d.status]) problems.push(`${name}: unknown status ${d.status}`);
    if (!d.organizations?.some(o => o.role === 'publisher')) problems.push(`${name}: no publisher`);
    for (const o of d.organizations ?? []) {
      if (!orgs.has(o.org)) problems.push(`${name}: unknown organization ${o.org}`);
      if (!ROLES.includes(o.role)) problems.push(`${name}: unknown role ${o.role}`);
    }
    const { licence = {}, access = {} } = d;
    if (!LICENCES[licence.type]) problems.push(`${name}: unknown licence ${licence.type}`);
    // Terms other than a federal work's are read on the publisher's site, so say where and when.
    if (['open-licence', 'free-with-terms'].includes(licence.type) && !(licence.url && DATE.test(licence.checked ?? ''))) {
      problems.push(`${name}: ${licence.type} needs the terms' url and the date they were checked`);
    }
    if (licence.type === 'free-with-terms' && !licence.limits) problems.push(`${name}: free-with-terms needs the limits`);
    if (licence.type === 'open-licence' && !licence.name) problems.push(`${name}: open-licence needs the licence's name`);
    // Licensed data is listed, not collected (user, 2026-10-13).
    if (licence.type === 'licensed' && (d.collected !== false || d.paths?.length)) problems.push(`${name}: licensed data is not collected`);
    for (const a of [...(access.used ?? []), access.best].filter(Boolean)) if (!ACCESS[a]) problems.push(`${name}: unknown access ${a}`);
    if (access.used?.includes('api-key') && !access.key) problems.push(`${name}: an API key needs its variable (access.key)`);
    if (d.successor && !slugs.has(d.successor)) problems.push(`${name}: unknown successor ${d.successor}`);
    if (d.ended && !DATE.test(d.ended)) problems.push(`${name}: ended must be YYYY-MM-DD`);
    // Not in the Statistical Abstract: say why it was added (user, 2026-10-13).
    if (![true, false, undefined].includes(d.in_abstract)) problems.push(`${name}: in_abstract is true, false or absent`);
    if (d.in_abstract === false && !d.outside_abstract) problems.push(`${name}: not in the Abstract, but no outside_abstract reason`);
    if (d.in_abstract !== false && d.outside_abstract) problems.push(`${name}: outside_abstract without in_abstract: false`);
    if (!Array.isArray(d.paths)) problems.push(`${name}: paths must be a list`);
    for (const p of d.paths ?? []) {
      if (prefixes.has(p)) problems.push(`${name}: path ${p} is also ${prefixes.get(p)}'s`);
      prefixes.set(p, d.slug);
    }
    for (const s of d.series_sources ?? []) {
      if (seriesSources.has(s)) problems.push(`${name}: series source ${s} is also ${seriesSources.get(s)}'s`);
      seriesSources.set(s, d.slug);
    }
  }
  return problems;
}

/** A matcher from a path in the data folder ('download.bls.gov/pub/…') to its program's slug: the longest prefix wins. */
export function pathMatcher(programs) {
  const prefixes = programs.flatMap(d => (d.paths ?? []).map(p => [p, d.slug])).sort((a, b) => b[0].length - a[0].length);
  return rel => prefixes.find(([p]) => rel.startsWith(p))?.[1] ?? null;
}

/** A path in the data folder, relative and with forward slashes. */
export const dataPath = file => path.relative(DATA_DIR, file).split(path.sep).join('/');

/**
 * A matcher from a series (economic_series row or SERIES entry) to its program's slug. Series read
 * from one file (every SERIES entry) go by that file's path; demographic series, read from many files,
 * by their `source` key (`series_sources`).
 */
export function seriesMatcher(programs) {
  const byPath = pathMatcher(programs);
  const bySource = new Map(programs.flatMap(d => (d.series_sources ?? []).map(s => [s, d.slug])));
  const fileOf = new Map(SERIES.map(s => [s.slug, s]));
  return s => {
    if (bySource.has(s.source)) return bySource.get(s.source);
    const def = fileOf.get(s.slug) ?? (s.source_id && s.frequency ? s : null);
    if (!def) return null;
    try {
      return byPath(dataPath(seriesFile(def)));
    } catch {
      return null;
    }
  };
}

/** The latest entry for each path in the fetch log (data-dir.js, recordFetch). */
export function readFetchLog() {
  const latest = new Map();
  if (!fs.existsSync(FETCH_LOG)) return latest;
  for (const line of fs.readFileSync(FETCH_LOG, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const entry = JSON.parse(line);
    latest.set(entry.path, entry);
  }
  return latest;
}

// Hosts whose "www." mirrorFile drops (data-dir.js), so a file's URL can be guessed from its path.
const WWW_HOSTS = new Set(['census.gov', 'govinfo.gov', 'federalreserve.gov', 'senate.gov', 'supremecourt.gov', 'fjc.gov',
  'fhfa.gov', 'freddiemac.com', 'irs.gov', 'cbo.gov', 'atlantafed.org', 'usitc.gov', 'sca.isr.umich.edu', 'whitehouse.gov',
  'courtlistener.com', '9-11commission.gov']);

/** A file's URL guessed from where it is kept, for files fetched before the fetch log. */
export function urlFromPath(rel) {
  if (rel.startsWith('govinfo/bulkdata/')) return `https://www.govinfo.gov/${rel.slice('govinfo/'.length)}`;
  const [host, ...rest] = rel.split('/');
  if (!host.includes('.')) return null;
  return `https://${WWW_HOSTS.has(host) ? `www.${host}` : host}/${rest.join('/')}`;
}

export const SCHEMA = `
  CREATE TABLE IF NOT EXISTS source_organizations (
    slug        TEXT PRIMARY KEY,             -- 'bls'
    name        TEXT NOT NULL,                -- 'Bureau of Labor Statistics'
    short_name  TEXT NOT NULL,                -- 'BLS'
    kind        TEXT NOT NULL,                -- 'federal' | 'federal-reserve-bank' | 'international' | 'industry' | … (lib/sources.js)
    branch      TEXT,                         -- federal bodies: 'executive' | 'legislative' | 'judicial'
    parent      TEXT,                         -- its department or parent body, by slug
    country     TEXT,                         -- outside the U.S. only
    url         TEXT,
    notes       TEXT
  );

  -- Predecessor → successor (to is null when a body was abolished).
  CREATE TABLE IF NOT EXISTS source_lineage (
    id          SERIAL PRIMARY KEY,
    from_org    TEXT NOT NULL,
    to_org      TEXT,
    date        DATE NOT NULL,
    kind        TEXT NOT NULL,                -- 'renamed' | 'merged' | 'transferred' | 'split' | 'abolished'
    citation    TEXT,                         -- the act, plan or order, as cited
    document    TEXT,                         -- 'bill:110-HR-3221' | 'fr:…' | 'usc:…', linked once loaded
    notes       TEXT
  );

  CREATE TABLE IF NOT EXISTS source_programs (
    slug              TEXT PRIMARY KEY,       -- 'bls-current-population-survey'
    name              TEXT NOT NULL,
    kind              TEXT NOT NULL,          -- 'statistics' | 'documents' | 'classification'
    description       TEXT NOT NULL,          -- GovGraph's own words
    homepage          TEXT NOT NULL,
    licence           TEXT NOT NULL,          -- 'public-domain' | 'open-licence' | 'free-with-terms' | 'licensed' | 'unchecked'
    licence_detail    JSONB NOT NULL,         -- { name, url, checked, attribution, limits, note }
    access_used       TEXT[] NOT NULL,        -- how it is fetched now: 'bulk' | 'file' | 'api' | 'api-key' | 'page' | 'archive'
    access_best       TEXT,                   -- the best way the publisher offers, where it is not what is used
    access_key        TEXT,                   -- the .env variable of a key
    access_contact    BOOLEAN NOT NULL DEFAULT false,  -- the publisher requires a contact address with each request
    access_note       TEXT,
    status            TEXT NOT NULL,          -- 'active' | 'final' | 'discontinued' | 'moved'
    ended             DATE,
    successor         TEXT,                   -- another program's slug
    collected         BOOLEAN NOT NULL DEFAULT true,   -- false: listed only (licensed data)
    in_abstract       BOOLEAN,                -- cited in the 2012 Statistical Abstract; null until compared
    outside_abstract  TEXT,                   -- why a program the Abstract does not cite was added
    paths             TEXT[] NOT NULL,        -- prefixes of its files' paths in the data folder
    notes             TEXT,
    position          INT NOT NULL            -- order in sources.json
  );

  CREATE TABLE IF NOT EXISTS source_program_organizations (
    program     TEXT NOT NULL REFERENCES source_programs(slug) ON DELETE CASCADE,
    org         TEXT NOT NULL REFERENCES source_organizations(slug) ON DELETE CASCADE,
    role        TEXT NOT NULL,                -- 'publisher' | 'producer' | 'distributor' | 'former-publisher'
    PRIMARY KEY (program, org, role)
  );

  -- Every file in the data folder (path relative to it). The checksum is kept until the file's size
  -- or modification time changes.
  CREATE TABLE IF NOT EXISTS source_files (
    path          TEXT PRIMARY KEY,           -- 'download.bls.gov/pub/time.series/ln/ln.series'
    program       TEXT,                       -- null: matches no program's paths
    size          BIGINT NOT NULL,
    sha256        TEXT NOT NULL,
    modified_at   TIMESTAMPTZ NOT NULL,       -- the file's own time, which is when it was fetched unless copied
    url           TEXT,
    url_inferred  BOOLEAN NOT NULL DEFAULT false,  -- true: guessed from the path, not recorded when fetched
    archive       TEXT,                       -- Internet Archive capture (timestamp) it came from
    fetched_at    TIMESTAMPTZ,                -- from the fetch log
    scanned_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS source_files_program ON source_files (program);

  ALTER TABLE economic_series ADD COLUMN IF NOT EXISTS program TEXT;
`;
