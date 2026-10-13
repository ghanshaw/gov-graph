// Reports of investigations (reports, report_parts; seed/load-reports.js): the list, one report with
// its outline, and one part's text. Pages: client/src/pages/Reports.jsx, ReportDetail.jsx.

import { pool } from './db.js';
import { documentHref } from './timeline.js';

const KIND_LABEL = { commission: 'Commission', congressional: 'Congressional investigation', special_counsel: 'Special counsel' };

const REPORT_COLUMNS = `slug, kind, title, short_title AS "shortTitle", issuer, issuer_short AS "issuerShort",
  date_issued::text AS "dateIssued", source_id AS "sourceId", source_url AS "sourceUrl", govinfo_url AS "govinfoUrl"`;

const withKind = r => ({ ...r, kindLabel: KIND_LABEL[r.kind] ?? r.kind });

export const reportQueries = {
  reports: async () => {
    const { rows } = await pool.query(
      `SELECT ${REPORT_COLUMNS}, (structure->'counts')::jsonb AS counts FROM reports ORDER BY date_issued DESC`);
    return rows.map(withKind);
  },

  // The report and its outline; `related` documents get an in-app link where they are loaded.
  report: async (_, { slug }) => {
    const { rows: [r] } = await pool.query(`SELECT ${REPORT_COLUMNS}, related, structure FROM reports WHERE slug = $1`, [slug]);
    if (!r) return null;
    const related = await Promise.all((r.related ?? []).map(async d => ({ ...d, href: await documentHref(d.document) })));
    return withKind({ ...r, related });
  },

  // One part's sections and notes.
  reportPart: async (_, { slug, partId }) => {
    const { rows: [p] } = await pool.query(
      `SELECT p.structure FROM report_parts p JOIN reports r ON r.id = p.report_id WHERE r.slug = $1 AND p.part_id = $2`,
      [slug, partId]);
    return p?.structure ?? null;
  },
};
