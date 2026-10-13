// Where the data comes from (source_organizations, source_lineage, source_datasets, source_files;
// seed/load-sources.js): every dataset with its publishers, terms and files, and one dataset with its
// folders, files and series. Pages: client/src/pages/DataSources.jsx, SourceDataset.jsx.

import { pool } from './db.js';
import { documentHref } from './timeline.js';
import { ORGANIZATION_KINDS, DATASET_KINDS, LICENCES, ACCESS, STATUSES } from './lib/sources.js';

const DATASET_COLUMNS = `d.slug, d.name, d.kind, d.description, d.homepage, d.licence, d.licence_detail AS "licenceDetail",
  d.access_used AS "accessUsed", d.access_best AS "accessBest", d.access_key AS "accessKey", d.access_contact AS "accessContact",
  d.access_note AS "accessNote", d.status, d.ended::text AS ended, d.successor, s.name AS "successorName", d.collected,
  d.in_abstract AS "inAbstract", d.outside_abstract AS "outsideAbstract", d.paths, d.notes,
  coalesce(f.count, 0)::int AS "fileCount", coalesce(f.bytes, 0)::float AS "fileBytes", f.last::text AS "lastModified",
  coalesce(e.count, 0)::int AS "seriesCount"`;

// Files and series per dataset, counted once for the whole list.
const DATASET_FROM = `source_datasets d
  LEFT JOIN source_datasets s ON s.slug = d.successor
  LEFT JOIN (SELECT dataset, count(*) AS count, sum(size) AS bytes, max(modified_at) AS last FROM source_files GROUP BY dataset) f
    ON f.dataset = d.slug
  LEFT JOIN (SELECT dataset, count(*) AS count FROM economic_series GROUP BY dataset) e ON e.dataset = d.slug`;

async function organizationsOf(slugs) {
  const { rows } = await pool.query(
    `SELECT x.dataset, x.role, o.slug, o.name, o.short_name AS "shortName", o.kind, o.branch, o.url, o.notes,
            o.parent, p.name AS "parentName"
     FROM source_dataset_organizations x JOIN source_organizations o ON o.slug = x.org
     LEFT JOIN source_organizations p ON p.slug = o.parent
     WHERE x.dataset = ANY($1)
     ORDER BY CASE x.role WHEN 'publisher' THEN 0 WHEN 'producer' THEN 1 ELSE 2 END, o.name`, [slugs]);
  const by = new Map();
  for (const { dataset, role, ...o } of rows) {
    if (!by.has(dataset)) by.set(dataset, []);
    by.get(dataset).push({ role, organization: { ...o, kindLabel: ORGANIZATION_KINDS[o.kind] ?? o.kind } });
  }
  return by;
}

const labelled = d => ({
  ...d,
  kindLabel: DATASET_KINDS[d.kind] ?? d.kind,
  licenceLabel: LICENCES[d.licence] ?? d.licence,
  statusLabel: STATUSES[d.status] ?? d.status,
});

export const sourceQueries = {
  // The labels of every value the registry uses (lib/sources.js), for the page's filters.
  sourceVocabulary: () => ({ organizationKinds: ORGANIZATION_KINDS, datasetKinds: DATASET_KINDS, licences: LICENCES, access: ACCESS, statuses: STATUSES }),

  // Every dataset in the order of sources.json, with its organizations and counts.
  sourceDatasets: async () => {
    const { rows } = await pool.query(`SELECT ${DATASET_COLUMNS} FROM ${DATASET_FROM} ORDER BY d.position`);
    const orgs = await organizationsOf(rows.map(r => r.slug));
    return rows.map(d => labelled({ ...d, organizations: orgs.get(d.slug) ?? [] }));
  },

  // One dataset, with what the list leaves out: lineage of its organizations, folders, files, series.
  sourceDataset: async (_, { slug }) => {
    const { rows: [d] } = await pool.query(`SELECT ${DATASET_COLUMNS} FROM ${DATASET_FROM} WHERE d.slug = $1`, [slug]);
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

  // A dataset's files in path order; with `folder`, only those directly in it. A query of its own, so
  // opening a folder does not replace the dataset the page holds.
  sourceFiles: async (_, { dataset, folder, limit }) => {
    const { rows } = await pool.query(
      `SELECT path, size::float AS size, sha256, modified_at::text AS "modifiedAt", url, url_inferred AS "urlInferred", archive,
              fetched_at::text AS "fetchedAt"
       FROM source_files WHERE dataset = $1 AND ($2::text IS NULL OR regexp_replace(path, '/[^/]*$', '') = $2)
       ORDER BY path LIMIT $3`, [dataset, folder ?? null, Math.min(limit ?? 100, 1000)]);
    return rows;
  },
};

export const sourceResolvers = {
  SourceDataset: {
    // Files by the folder they are in, in path order.
    folders: async (d, { limit }) => {
      const { rows } = await pool.query(
        `SELECT regexp_replace(path, '/[^/]*$', '') AS path, count(*)::int AS count, sum(size)::float AS bytes,
                max(modified_at)::text AS "lastModified"
         FROM source_files WHERE dataset = $1 GROUP BY 1 ORDER BY 1 LIMIT $2`, [d.slug, Math.min(limit ?? 100, 500)]);
      return rows;
    },
    // National series only (demographic series by place are counted in seriesCount).
    series: async (d, { limit }) => {
      const { rows } = await pool.query(
        `SELECT slug, name, frequency, unit, first_date::text AS "firstDate", last_date::text AS "lastDate"
         FROM economic_series WHERE dataset = $1 AND place IS NULL ORDER BY name LIMIT $2`, [d.slug, Math.min(limit ?? 200, 1000)]);
      return rows;
    },
  },
};
