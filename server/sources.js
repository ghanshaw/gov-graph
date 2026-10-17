// Where the data comes from (source_organizations, source_lineage, source_programs, source_files;
// seed/load-sources.js): every program with its publishers, terms and files, and one program with its
// folders, files and series; and the Statistical Abstract's tables with the programs they cite and how much of each
// GovGraph holds (lib/abstract-coverage.js, read from the files). Pages: client/src/pages/DataSources.jsx,
// SourceProgram.jsx, AbstractCoverage.jsx.

import { pool } from './db.js';
import { documentHref } from './timeline.js';
import { ORGANIZATION_KINDS, PROGRAM_KINDS, LICENCES, ACCESS, STATUSES } from './lib/sources.js';
import { nipaTable } from './lib/nipa-series.js';
import { cpsTable } from './lib/cps-series.js';
import { coverageReport, COVERAGE, SHAPES } from './lib/abstract-coverage.js';

const PROGRAM_COLUMNS = `d.slug, d.name, d.kind, d.description, d.homepage, d.licence, d.licence_detail AS "licenceDetail",
  d.access_used AS "accessUsed", d.access_best AS "accessBest", d.access_key AS "accessKey", d.access_contact AS "accessContact",
  d.access_note AS "accessNote", d.status, d.ended::text AS ended, d.successor, s.name AS "successorName", d.collected,
  d.in_abstract AS "inAbstract", d.outside_abstract AS "outsideAbstract", d.paths, d.notes,
  coalesce(f.count, 0)::int AS "fileCount", coalesce(f.bytes, 0)::float AS "fileBytes", f.last::text AS "lastModified",
  coalesce(e.count, 0)::int AS "seriesCount"`;

// Files and series per program, counted once for the whole list.
const PROGRAM_FROM = `source_programs d
  LEFT JOIN source_programs s ON s.slug = d.successor
  LEFT JOIN (SELECT program, count(*) AS count, sum(size) AS bytes, max(modified_at) AS last FROM source_files GROUP BY program) f
    ON f.program = d.slug
  LEFT JOIN (SELECT program, count(*) AS count FROM economic_series GROUP BY program) e ON e.program = d.slug`;

async function organizationsOf(slugs) {
  const { rows } = await pool.query(
    `SELECT x.program, x.role, o.slug, o.name, o.short_name AS "shortName", o.kind, o.branch, o.url, o.notes,
            o.parent, p.name AS "parentName"
     FROM source_program_organizations x JOIN source_organizations o ON o.slug = x.org
     LEFT JOIN source_organizations p ON p.slug = o.parent
     WHERE x.program = ANY($1)
     ORDER BY CASE x.role WHEN 'publisher' THEN 0 WHEN 'producer' THEN 1 ELSE 2 END, o.name`, [slugs]);
  const by = new Map();
  for (const { program, role, ...o } of rows) {
    if (!by.has(program)) by.set(program, []);
    by.get(program).push({ role, organization: { ...o, kindLabel: ORGANIZATION_KINDS[o.kind] ?? o.kind } });
  }
  return by;
}

// A program a table cites is in the Abstract, whatever sources.json says (in_abstract is set there only to say why
// one is not).
const labelled = d => ({
  ...d,
  inAbstract: coverageReport().byProgram.has(d.slug) ? true : d.inAbstract,
  abstractTableCount: coverageReport().byProgram.get(d.slug)?.length ?? 0,
  kindLabel: PROGRAM_KINDS[d.kind] ?? d.kind,
  licenceLabel: LICENCES[d.licence] ?? d.licence,
  statusLabel: STATUSES[d.status] ?? d.status,
});

export const sourceQueries = {
  // The labels of every value the sources use (lib/sources.js), for the page's filters.
  sourceVocabulary: () => ({ organizationKinds: ORGANIZATION_KINDS, programKinds: PROGRAM_KINDS, licences: LICENCES, access: ACCESS, statuses: STATUSES,
    coverage: COVERAGE, shapes: SHAPES }),

  // Every table of the Statistical Abstract in book order, with the programs it cites and its coverage, and the sections.
  abstractCoverage: () => {
    const { sections, tables } = coverageReport();
    return { sections, tables };
  },

  // Every program in the order of sources.json, with its organizations and counts.
  sourcePrograms: async () => {
    const { rows } = await pool.query(`SELECT ${PROGRAM_COLUMNS} FROM ${PROGRAM_FROM} ORDER BY d.position`);
    const orgs = await organizationsOf(rows.map(r => r.slug));
    return rows.map(d => labelled({ ...d, organizations: orgs.get(d.slug) ?? [] }));
  },

  // One program, with what the list leaves out: lineage of its organizations, folders, files, series.
  sourceProgram: async (_, { slug }) => {
    const { rows: [d] } = await pool.query(`SELECT ${PROGRAM_COLUMNS} FROM ${PROGRAM_FROM} WHERE d.slug = $1`, [slug]);
    if (!d) return null;
    const organizations = (await organizationsOf([slug])).get(slug) ?? [];
    const orgSlugs = organizations.map(o => o.organization.slug);
    const { rows: lineage } = await pool.query(
      `SELECT l.from_org AS "from", f.name AS "fromName", l.to_org AS "to", t.name AS "toName", l.date::text AS date, l.kind,
              l.citation, l.document, l.notes
       FROM source_lineage l JOIN source_organizations f ON f.slug = l.from_org LEFT JOIN source_organizations t ON t.slug = l.to_org
       WHERE l.from_org = ANY($1) OR l.to_org = ANY($1) ORDER BY l.date`, [orgSlugs]);
    return labelled({
      ...d,
      organizations,
      lineage: await Promise.all(lineage.map(async l => ({ ...l, href: await documentHref(l.document) }))),
    });
  },

  // A program's files in path order; with `folder`, only those directly in it. A query of its own, so
  // opening a folder does not replace the program the page holds.
  sourceFiles: async (_, { program, folder, limit }) => {
    const { rows } = await pool.query(
      `SELECT path, size::float AS size, sha256, modified_at::text AS "modifiedAt", url, url_inferred AS "urlInferred", archive,
              fetched_at::text AS "fetchedAt"
       FROM source_files WHERE program = $1 AND ($2::text IS NULL OR regexp_replace(path, '/[^/]*$', '') = $2)
       ORDER BY path LIMIT $3`, [program, folder ?? null, Math.min(limit ?? 100, 1000)]);
    return rows;
  },
};

// A table's programs by name; one query for every program, shared by all the tables a request resolves at once.
let programNames = null;
function namesOfPrograms() {
  if (!programNames) {
    programNames = pool.query('SELECT slug, name, licence, collected FROM source_programs')
      .then(({ rows }) => new Map(rows.map(r => [r.slug, r])))
      .catch(e => { programNames = null; throw e; });
    setTimeout(() => { programNames = null; }, 60_000);
  }
  return programNames;
}

// What a table names as loaded (coverage `series`): a series slug, a measure (its national series and every place) or
// `prefix--*` (a family of published groups). One query for all, refreshed with the program names.
let seriesIndex = null;
function indexOfSeries() {
  if (!seriesIndex) {
    seriesIndex = pool.query(
      `SELECT slug, source, source_id AS "sourceId", measure, place, regexp_replace(name, ', [^,]*$', '') AS "placeName", name, frequency,
              first_date::text AS "firstDate", last_date::text AS "lastDate"
       FROM economic_series`)
      .then(({ rows }) => rows)
      .catch(e => { seriesIndex = null; throw e; });
    setTimeout(() => { seriesIndex = null; }, 60_000);
  }
  return seriesIndex;
}

function describeSeries(key, rows) {
  const span = list => ({
    firstDate: list.map(r => r.firstDate).filter(Boolean).sort()[0] ?? null,
    lastDate: list.map(r => r.lastDate).filter(Boolean).sort().at(-1) ?? null,
  });
  // nipa:T20100: every series loaded from that NIPA table's lines, whichever measure they belong to.
  if (key.startsWith('nipa:')) {
    const table = nipaTable(key.slice(5));
    const list = rows.filter(r => r.source === 'bea' && table?.codes.has(r.sourceId) && !r.place);
    const words = ['annual', 'quarterly', 'monthly'].filter(f => list.some(r => r.frequency === f)).map(f => (f === 'annual' ? 'yearly' : f));
    const frequency = words.length ? words.slice(0, -1).join(', ') + (words.length > 1 ? ' and ' : '') + words.at(-1) : null;
    return { key, name: `NIPA ${table?.title.replace(/\.$/, '') ?? key}`, groups: 0, count: list.length, places: 0, frequency, ...span(list), found: list.length > 0 };
  }
  // cps:586: every series printing that Abstract table's rows (lib/cps-series.js), BLS's ids.
  if (key.startsWith('cps:')) {
    const ids = cpsTable(key.slice(4));
    const list = rows.filter(r => r.source === 'bls-bulk' && ids?.has(r.sourceId) && !r.place);
    const words = ['annual', 'quarterly', 'monthly'].filter(f => list.some(r => r.frequency === f)).map(f => (f === 'annual' ? 'yearly' : f));
    const frequency = words.length ? words.slice(0, -1).join(', ') + (words.length > 1 ? ' and ' : '') + words.at(-1) : null;
    return { key, name: `Current Population Survey, the rows of Table ${key.slice(4)}`, groups: 0, count: list.length, places: 0, frequency, ...span(list), found: list.length > 0 };
  }
  if (key.endsWith('--*')) {
    const base = key.slice(0, -3);
    const list = rows.filter(r => r.slug.startsWith(`${base}--`) && !r.place);
    const head = rows.find(r => r.slug === base);
    return { key, name: head?.name ?? base, groups: 0, count: list.length, places: 0, frequency: head?.frequency ?? list[0]?.frequency ?? null, ...span(list), found: list.length > 0 };
  }
  const national = rows.find(r => r.slug === key);
  const places = rows.filter(r => r.measure === key && r.place);
  const list = [national, ...places].filter(Boolean);
  // States (districts counted with theirs), then DC and Puerto Rico by name: "50 states, DC and Puerto Rico".
  const codes = new Set(places.map(r => r.place.split('-')[0]));
  const states = [...codes].filter(c => !['dc', 'pr'].includes(c)).length;
  const where = [states && `${states} states`, codes.has('dc') && 'DC', codes.has('pr') && 'Puerto Rico'].filter(Boolean);
  return {
    key, name: national?.name ?? places[0]?.placeName ?? key, groups: 0, places: codes.size,
    placesLabel: where.length ? where.slice(0, -1).join(', ') + (where.length > 1 ? ' and ' : '') + where.at(-1) : null,
    national: Boolean(national), frequency: list[0]?.frequency ?? null, ...span(list), found: list.length > 0,
  };
}

export const sourceResolvers = {
  AbstractTable: {
    series: async t => {
      if (!t.series.length) return [];
      const rows = await indexOfSeries();
      return t.series.map(key => describeSeries(key, rows));
    },
    programs: async t => {
      const names = await namesOfPrograms();
      return t.programs.map(slug => ({ slug, name: names.get(slug)?.name ?? slug, licence: names.get(slug)?.licence ?? null,
        collected: names.get(slug)?.collected ?? false }));
    },
  },
  SourceProgram: {
    // The Abstract's tables that cite this program.
    abstractTables: d => coverageReport().byProgram.get(d.slug) ?? [],
    // Files by the folder they are in, in path order.
    folders: async (d, { limit }) => {
      const { rows } = await pool.query(
        `SELECT regexp_replace(path, '/[^/]*$', '') AS path, count(*)::int AS count, sum(size)::float AS bytes,
                max(modified_at)::text AS "lastModified"
         FROM source_files WHERE program = $1 GROUP BY 1 ORDER BY 1 LIMIT $2`, [d.slug, Math.min(limit ?? 100, 500)]);
      return rows;
    },
    // National series only (demographic series by place are counted in seriesCount).
    series: async (d, { limit }) => {
      const { rows } = await pool.query(
        `SELECT slug, name, frequency, unit, first_date::text AS "firstDate", last_date::text AS "lastDate"
         FROM economic_series WHERE program = $1 AND place IS NULL ORDER BY name LIMIT $2`, [d.slug, Math.min(limit ?? 200, 1000)]);
      return rows;
    },
  },
};
