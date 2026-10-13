// How the U.S. Code (parse-uscode-xml.js) is laid out in the database. Used by seed/load-uscode.js.
//
//   usc_release_points: one row per release point loaded ("119-36": the Code as of Public Law
//     119-36). `seq` orders them (congress × 10000 + law), whatever order they were loaded in.
//   usc_titles: one row per title (and appendix title), with the latest release loaded.
//   usc_nodes: the hierarchy: every title's subtitles, chapters, … and sections (or rules and
//     plans in the appendices), with no text. `first_seq` / `last_seq` are the first and last
//     release the unit appears in; the current Code is the units whose `last_seq` is the title's.
//   usc_section_versions: one row per distinct text of a section, keyed by a hash of its
//     structure (items, source credit, notes), as git keeps one blob per distinct file. Loading
//     a release whose text of a section is unchanged only widens that version's range.
//   usc_source_credits: the laws in each section's source credit as of its current version, in
//     printed order, linked to `legislation` where we hold the bill that became the law.
//
// Raw XML is not stored: the release point zips stay in the data directory.

import crypto from 'crypto';
import { valuesClause } from './data-dir.js';

export const SCHEMA = `
  CREATE TABLE IF NOT EXISTS usc_release_points (
    id          TEXT PRIMARY KEY,               -- '119-36'
    congress    INT NOT NULL,
    law         INT NOT NULL,
    seq         INT NOT NULL UNIQUE,            -- 1190036
    source_url  TEXT,
    loaded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS usc_titles (
    number        TEXT PRIMARY KEY,             -- '10', '5a'
    position      INT NOT NULL,                 -- reading order: 1, 2, …, 5, 5a, 6, …
    identifier    TEXT NOT NULL UNIQUE,         -- '/us/usc/t10'
    label         TEXT,                         -- 'Title 10—'
    name          TEXT,                         -- 'ARMED FORCES'
    positive_law  BOOLEAN,
    appendix      BOOLEAN NOT NULL DEFAULT false,
    release_id    TEXT NOT NULL REFERENCES usc_release_points(id),
    section_count INT NOT NULL DEFAULT 0        -- sections in force (no status) in that release
  );

  CREATE TABLE IF NOT EXISTS usc_nodes (
    identifier        TEXT PRIMARY KEY,         -- '/us/usc/t10/s1074c' ('~2' on a duplicated number)
    title_number      TEXT NOT NULL REFERENCES usc_titles(number),
    kind              TEXT NOT NULL,            -- 'chapter', 'section', 'courtRule', …
    number            TEXT,                     -- '1074c', '55', '71 to 71l'
    label             TEXT,                     -- '§ 1074c.', 'CHAPTER 55—'
    slug              TEXT,                     -- address under /code/<title>/ (units only)
    heading           TEXT,
    parent_identifier TEXT,
    depth             INT NOT NULL,
    position          INT NOT NULL,             -- reading order within the title
    status            TEXT,                     -- 'repealed', 'transferred', 'omitted', …
    first_seq         INT NOT NULL,
    last_seq          INT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS usc_nodes_parent_idx ON usc_nodes (parent_identifier, position);
  CREATE INDEX IF NOT EXISTS usc_nodes_title_idx ON usc_nodes (title_number, position);
  CREATE UNIQUE INDEX IF NOT EXISTS usc_nodes_slug_idx ON usc_nodes (title_number, slug) WHERE slug IS NOT NULL;

  CREATE TABLE IF NOT EXISTS usc_section_versions (
    id            BIGSERIAL PRIMARY KEY,
    identifier    TEXT NOT NULL REFERENCES usc_nodes(identifier),
    content_hash  TEXT NOT NULL,
    structure     JSONB NOT NULL,
    first_seq     INT NOT NULL,
    last_seq      INT NOT NULL,
    UNIQUE (identifier, content_hash)
  );
  CREATE INDEX IF NOT EXISTS usc_section_versions_current_idx ON usc_section_versions (identifier, last_seq DESC);

  CREATE TABLE IF NOT EXISTS usc_source_credits (
    identifier     TEXT NOT NULL REFERENCES usc_nodes(identifier),
    position       INT NOT NULL,
    title_number   TEXT NOT NULL,
    public_law     TEXT,                        -- '119-21'
    cite           TEXT NOT NULL,               -- 'Pub. L. 119–21, title VII, § 70302(a)'
    enacted        DATE,
    statute        TEXT,                        -- '139 Stat. 72'
    legislation_id UUID REFERENCES legislation(id),
    PRIMARY KEY (identifier, position)
  );
  CREATE INDEX IF NOT EXISTS usc_source_credits_law_idx ON usc_source_credits (public_law);
  CREATE INDEX IF NOT EXISTS usc_source_credits_legislation_idx ON usc_source_credits (legislation_id);
`;

/** '119-36' → { id, congress, law, seq } */
export function releasePoint(id) {
  const m = /^(\d+)-(\d+)$/.exec(id ?? '');
  if (!m) throw new Error(`Expected a release point like 119-36, got ${id}`);
  const congress = Number(m[1]);
  const law = Number(m[2]);
  return { id, congress, law, seq: congress * 10000 + law };
}

/** Reading order of titles: 5 before 5a before 6. */
export const titlePosition = number => {
  const m = /^(\d+)([a-z]?)$/i.exec(number);
  return m ? Number(m[1]) * 10 + (m[2] ? 1 : 0) : 9999;
};

const MAX_ROWS = 500;
const MAX_BYTES = 2_000_000;

// Rows in batches small enough for one statement each.
function* batches(rows, size = row => 0) {
  let batch = [];
  let bytes = 0;
  for (const row of rows) {
    const b = size(row);
    if (batch.length && (batch.length >= MAX_ROWS || bytes + b > MAX_BYTES)) {
      yield batch;
      batch = [];
      bytes = 0;
    }
    batch.push(row);
    bytes += b;
  }
  if (batch.length) yield batch;
}

/** Every Public Law we hold a bill for: '119-21' → legislation id. */
export async function lawIndex(client) {
  const { rows } = await client.query(`
    SELECT l.id, law->>'number' AS number
    FROM legislation l, jsonb_array_elements(coalesce(l.details->'laws', '[]'::jsonb)) law
    WHERE law->>'type' = 'Public Law'`);
  return new Map(rows.map(r => [r.number, r.id]));
}

/**
 * Store one parsed title as of a release point. The caller holds the transaction.
 * @returns {{ nodes, sections, versionsAdded, versionsKept, credits, linked }}
 */
export async function storeTitle(client, parsed, release, laws) {
  const { title, nodes } = parsed;
  const sections = nodes.filter(n => n.structure);
  const inForce = sections.filter(n => !n.status).length;

  await client.query(
    `INSERT INTO usc_release_points (id, congress, law, seq, source_url) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET source_url = coalesce(EXCLUDED.source_url, usc_release_points.source_url)`,
    [release.id, release.congress, release.law, release.seq, release.source_url ?? null],
  );
  // The title row follows the newest release loaded.
  await client.query(
    `INSERT INTO usc_titles (number, position, identifier, label, name, positive_law, appendix, release_id, section_count)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (number) DO UPDATE SET
       identifier = EXCLUDED.identifier, label = EXCLUDED.label, name = EXCLUDED.name,
       positive_law = EXCLUDED.positive_law, appendix = EXCLUDED.appendix,
       release_id = EXCLUDED.release_id, section_count = EXCLUDED.section_count
     WHERE (SELECT seq FROM usc_release_points WHERE id = usc_titles.release_id) <= $10`,
    [title.number, titlePosition(title.number), title.identifier, title.label, title.name,
      title.positive_law, title.appendix, release.id, inForce, release.seq],
  );
  const current = (await client.query(
    `SELECT r.seq FROM usc_titles t JOIN usc_release_points r ON r.id = t.release_id WHERE t.number = $1`, [title.number],
  )).rows[0].seq === release.seq;

  // Nodes: an older release only widens ranges; the newest one also sets names and places.
  const nodeRows = nodes.map((n, position) => [
    n.identifier, title.number, n.kind, n.number, n.label, n.slug, n.heading, n.parent,
    n.depth, position, n.status, release.seq,
  ]);
  for (const batch of batches(nodeRows)) {
    const { sql, params } = valuesClause(batch);
    await client.query(
      `INSERT INTO usc_nodes (identifier, title_number, kind, number, label, slug, heading, parent_identifier, depth, position, status, first_seq, last_seq)
       SELECT v.identifier, v.title_number, v.kind, v.number, v.label, v.slug, v.heading, v.parent, v.depth::int, v.position::int, v.status, v.seq::int, v.seq::int
       FROM (VALUES ${sql}) AS v(identifier, title_number, kind, number, label, slug, heading, parent, depth, position, status, seq)
       ON CONFLICT (identifier) DO UPDATE SET
         first_seq = least(usc_nodes.first_seq, EXCLUDED.first_seq),
         last_seq = greatest(usc_nodes.last_seq, EXCLUDED.last_seq)
         ${current ? `, kind = EXCLUDED.kind, number = EXCLUDED.number, label = EXCLUDED.label, slug = EXCLUDED.slug,
           heading = EXCLUDED.heading, parent_identifier = EXCLUDED.parent_identifier, depth = EXCLUDED.depth,
           position = EXCLUDED.position, status = EXCLUDED.status` : ''}`,
      params,
    );
  }

  // Loading a release again (after a change to the parser) replaces what only it holds,
  // rather than leaving the earlier parse beside the new one.
  await client.query(
    `DELETE FROM usc_section_versions v USING usc_nodes n
     WHERE n.identifier = v.identifier AND n.title_number = $1 AND v.first_seq = $2 AND v.last_seq = $2`,
    [title.number, release.seq],
  );

  // Section texts, one row per distinct version.
  let versionsAdded = 0;
  const withHash = sections.map(n => {
    const json = JSON.stringify(n.structure);
    return { identifier: n.identifier, json, hash: crypto.createHash('sha256').update(json).digest('hex') };
  });
  for (const batch of batches(withHash, row => row.json.length)) {
    const { sql, params } = valuesClause(batch.map(v => [v.identifier, v.hash, v.json, release.seq]));
    const { rows } = await client.query(
      `INSERT INTO usc_section_versions (identifier, content_hash, structure, first_seq, last_seq)
       SELECT v.identifier, v.hash, v.structure::jsonb, v.seq::int, v.seq::int
       FROM (VALUES ${sql}) AS v(identifier, hash, structure, seq)
       ON CONFLICT (identifier, content_hash) DO UPDATE SET
         first_seq = least(usc_section_versions.first_seq, EXCLUDED.first_seq),
         last_seq = greatest(usc_section_versions.last_seq, EXCLUDED.last_seq)
       RETURNING (xmax = 0) AS inserted`,
      params,
    );
    versionsAdded += rows.filter(r => r.inserted).length;
  }

  // Source credits describe the current text, so only the newest release writes them.
  let credits = 0;
  let linked = 0;
  if (current) {
    await client.query('DELETE FROM usc_source_credits WHERE title_number = $1', [title.number]);
    const rows = sections.flatMap(n => (n.structure.source_credit?.laws ?? []).map((law, position) => {
      const legislationId = law.public_law ? laws.get(law.public_law) ?? null : null;
      if (legislationId) linked++;
      return [n.identifier, position, title.number, law.public_law, law.cite, law.date, law.statute, legislationId];
    }));
    for (const batch of batches(rows)) {
      const { sql, params } = valuesClause(batch);
      await client.query(
        `INSERT INTO usc_source_credits (identifier, position, title_number, public_law, cite, enacted, statute, legislation_id)
         SELECT v.identifier, v.position::int, v.title_number, v.public_law, v.cite, v.enacted::date, v.statute, v.legislation_id::uuid
         FROM (VALUES ${sql}) AS v(identifier, position, title_number, public_law, cite, enacted, statute, legislation_id)`,
        params,
      );
    }
    credits = rows.length;
  }

  return {
    nodes: nodes.length, sections: sections.length, inForce,
    versionsAdded, versionsKept: sections.length - versionsAdded, credits, linked,
  };
}
