// The U.S. Code pages (client/src/pages/UsCode*.jsx): titles, a title's outline, one section.
// Everything comes from the tables load-uscode.js fills (lib/usc-storage.js). "Current" is the
// newest release loaded for a title: units whose range reaches that release.

import NodeCache from 'node-cache';
import { pool } from './db.js';

const cache = new NodeCache({ stdTTL: 600 });

const TITLE_SQL = `
  SELECT t.number, t.identifier, t.label, t.name, t.positive_law AS "positiveLaw", t.appendix,
         t.section_count AS "sectionCount", t.release_id AS release, r.seq
  FROM usc_titles t JOIN usc_release_points r ON r.id = t.release_id`;

async function titleRow(number) {
  const { rows } = await pool.query(`${TITLE_SQL} WHERE t.number = $1`, [String(number).toLowerCase()]);
  return rows[0] ?? null;
}

const UNIT = `identifier, kind, number, label, slug, heading, status, depth, position`;

export const uscQueries = {
  // Every title, in reading order.
  uscTitles: async () => {
    const cached = cache.get('titles');
    if (cached) return cached;
    const { rows } = await pool.query(`${TITLE_SQL} ORDER BY t.position`);
    const titles = rows.map(({ seq, ...t }) => t);
    cache.set('titles', titles);
    return titles;
  },

  // A title and the containers of its outline (subtitles, chapters, …), each with how many
  // sections sit directly under it and the first and last of them. Sections come per container
  // (uscChildren), so the largest titles are not sent whole.
  uscTitle: async (_, { number }) => {
    const title = await titleRow(number);
    if (!title) return null;
    const key = `title:${title.number}:${title.seq}`;
    const cached = cache.get(key);
    if (cached) return cached;
    const { rows } = await pool.query(
      `WITH current AS (
         SELECT * FROM usc_nodes WHERE title_number = $1 AND last_seq = $2
       ), counts AS (
         SELECT parent_identifier, count(*)::int AS sections,
                (array_agg(label ORDER BY position))[1] AS first_label,
                (array_agg(label ORDER BY position DESC))[1] AS last_label
         FROM current WHERE slug IS NOT NULL GROUP BY parent_identifier
       )
       SELECT c.identifier, c.kind, c.number, c.label, c.heading, c.status, c.depth, c.parent_identifier AS parent,
              coalesce(n.sections, 0) AS sections, n.first_label AS "firstLabel", n.last_label AS "lastLabel"
       FROM current c LEFT JOIN counts n ON n.parent_identifier = c.identifier
       WHERE c.slug IS NULL ORDER BY c.position`,
      [title.number, title.seq],
    );
    const top = await pool.query(
      `SELECT count(*)::int AS n FROM usc_nodes WHERE title_number = $1 AND last_seq = $2 AND slug IS NOT NULL AND parent_identifier = (SELECT identifier FROM usc_titles WHERE number = $1)`,
      [title.number, title.seq],
    );
    const { seq, ...rest } = title;
    const result = { ...rest, directSections: top.rows[0].n, containers: rows };
    cache.set(key, result);
    return result;
  },

  // The units directly under a container (or under the title), in reading order.
  uscChildren: async (_, { identifier }) => {
    const { rows } = await pool.query(
      `SELECT ${UNIT} FROM usc_nodes n
       WHERE n.parent_identifier = $1
         AND n.last_seq = (SELECT r.seq FROM usc_titles t JOIN usc_release_points r ON r.id = t.release_id WHERE t.number = n.title_number)
       ORDER BY n.position`,
      [identifier],
    );
    return rows;
  },

  // One section (or rule, or plan) by its address: /code/10/1074c → ("10", "1074c").
  uscSection: async (_, { title: number, section: slug }) => {
    const title = await titleRow(number);
    if (!title) return null;
    const { rows: [node] } = await pool.query(
      `SELECT ${UNIT}, parent_identifier, first_seq, last_seq FROM usc_nodes WHERE title_number = $1 AND slug = $2`,
      [title.number, slug],
    );
    if (!node) return null;

    const [ancestors, version, neighbours, credits] = await Promise.all([
      pool.query(
        `WITH RECURSIVE up AS (
           SELECT identifier, kind, number, label, heading, parent_identifier, 0 AS step FROM usc_nodes WHERE identifier = $1
           UNION ALL
           SELECT n.identifier, n.kind, n.number, n.label, n.heading, n.parent_identifier, up.step + 1
           FROM usc_nodes n JOIN up ON n.identifier = up.parent_identifier
         )
         SELECT identifier, kind, number, label, heading FROM up ORDER BY step DESC`,
        [node.parent_identifier],
      ),
      pool.query(
        `SELECT v.structure, v.first_seq, v.last_seq, f.id AS first_release, l.id AS last_release
         FROM usc_section_versions v
         LEFT JOIN usc_release_points f ON f.seq = v.first_seq
         LEFT JOIN usc_release_points l ON l.seq = v.last_seq
         WHERE v.identifier = $1 ORDER BY v.last_seq DESC LIMIT 1`,
        [node.identifier],
      ),
      pool.query(
        `(SELECT 'previous' AS side, slug, label, heading, status FROM usc_nodes
           WHERE title_number = $1 AND last_seq = $2 AND slug IS NOT NULL AND position < $3 ORDER BY position DESC LIMIT 1)
         UNION ALL
         (SELECT 'next', slug, label, heading, status FROM usc_nodes
           WHERE title_number = $1 AND last_seq = $2 AND slug IS NOT NULL AND position > $3 ORDER BY position LIMIT 1)`,
        [title.number, title.seq, node.position],
      ),
      pool.query(
        `SELECT c.position, c.public_law AS "publicLaw", c.cite, c.enacted::text AS enacted, c.statute,
                l.congress_number AS congress, l.bill_type AS "billType", l.bill_number AS "billNumber"
         FROM usc_source_credits c LEFT JOIN legislation l ON l.id = c.legislation_id
         WHERE c.identifier = $1 ORDER BY c.position`,
        [node.identifier],
      ),
    ]);

    const { seq, ...titleOut } = title;
    const side = name => neighbours.rows.find(r => r.side === name) ?? null;
    const v = version.rows[0];
    return {
      title: titleOut,
      identifier: node.identifier,
      kind: node.kind,
      number: node.number,
      label: node.label,
      slug: node.slug,
      heading: node.heading,
      status: node.status,
      // In the newest release loaded for its title, or only in older ones.
      current: node.last_seq === title.seq,
      ancestors: ancestors.rows.filter(a => a.kind !== 'title' && a.kind !== 'appendix'),
      structure: v?.structure ?? null,
      version: v ? { from: v.first_release, to: v.last_release } : null,
      previous: side('previous'),
      next: side('next'),
      credits: credits.rows,
    };
  },
};
