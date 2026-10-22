// Tags (tags, item_tags; created by seed/create-tag-tables.js): words applied by hand to any item.
// A tag is never derived by a rule; collections draw on tags (features/collections). Items are addressed
// by a ref string, as periods.json and reports.json address documents:
//   fr:<document number>   an executive order or memorandum (executive_documents.source_id)
//   bill:<source_id>       a bill ("119-HR-1")
//   scotus:<docket slug>   a Supreme Court decision ("25-332")
//   usc:<identifier>       a U.S. Code section ("/us/usc/t19/s1862")
//   report:<slug>          a report of an investigation
// Pages: client/src/pages/TagsIndex.jsx, TagPage.jsx; TagPanel on each item page.

import { pool } from './db.js';
import { naturalCourtOn } from './naturalCourts.js';
import { presidentSlugOn } from './timeline.js';

export const SCHEMA = `
  CREATE TABLE IF NOT EXISTS item_tags (
    tag_id      INT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    ref         TEXT NOT NULL,
    note        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tag_id, ref)
  );
  CREATE INDEX IF NOT EXISTS item_tags_ref ON item_tags (ref);
`;

// "Clean Energy " → "clean-energy": the word is also the tag's address (/tags/clean-energy).
export const normalizeWord = word =>
  (word ?? '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');

export const REF = /^(fr|bill|scotus|usc|report):(.+)$/;

const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');

const BILL_LABEL = { hr: 'H.R.', s: 'S.', hjres: 'H.J.Res.', sjres: 'S.J.Res.', hconres: 'H.Con.Res.', sconres: 'S.Con.Res.', hres: 'H.Res.', sres: 'S.Res.' };

// Each kind, in the order the tag page lists them: its heading and how to look up its items.
const KINDS = {
  fr: {
    async items(ids) {
      const { rows } = await pool.query(
        `SELECT source_id, doc_type, number, title, signed_date::text AS date
           FROM executive_documents WHERE source_id = ANY($1)`, [ids]);
      return rows.map(r => {
        const slug = r.date && presidentSlugOn(r.date);
        const order = r.doc_type === 'executive_order';
        return {
          id: r.source_id, kind: order ? 'eo' : 'memo', date: r.date, title: r.title,
          label: order ? `EO ${r.number ?? ''}`.trim() : 'Memorandum',
          href: !slug ? null : order && r.number ? `/${slug}/executive-orders/eo/${r.number}`
            : r.doc_type === 'memorandum' ? `/${slug}/memoranda/doc/${r.source_id}` : null,
        };
      });
    },
  },
  bill: {
    async items(ids) {
      const { rows } = await pool.query(
        `SELECT source_id, congress_number, bill_type, bill_number, title, introduced_date::text AS date
           FROM legislation WHERE source_id = ANY($1)`, [ids]);
      return rows.map(r => ({
        id: r.source_id, kind: 'bill', date: r.date, title: r.title,
        label: `${BILL_LABEL[r.bill_type] ?? r.bill_type.toUpperCase()} ${r.bill_number} (${ordinal(r.congress_number)})`,
        href: `/congress/${r.congress_number}/${r.bill_type}/${r.bill_number}`,
      }));
    },
  },
  scotus: {
    async items(ids) {
      const { rows } = await pool.query(
        `SELECT slug, name, docket_numbers, date_decided::text AS date
           FROM court_decisions WHERE court = 'scotus' AND slug = ANY($1)`, [ids]);
      return rows.map(r => {
        const court = r.date && naturalCourtOn(r.date);
        return {
          id: r.slug, kind: 'scotus', date: r.date, title: r.name, label: `No. ${r.docket_numbers?.[0] ?? r.slug}`,
          href: court ? `/supreme-court/${court}/${r.slug}` : null,
        };
      });
    },
  },
  usc: {
    async items(ids) {
      const { rows } = await pool.query(
        `SELECT identifier, title_number, number, slug, heading FROM usc_nodes WHERE identifier = ANY($1)`, [ids]);
      return rows.map(r => ({
        id: r.identifier, kind: 'usc', date: null, title: r.heading,
        label: `${r.title_number} U.S.C. § ${r.number}`,
        href: r.slug ? `/code/${r.title_number}/${r.slug}` : null,
      }));
    },
  },
  report: {
    async items(ids) {
      const { rows } = await pool.query(
        `SELECT slug, title, issuer_short, date_issued::text AS date FROM reports WHERE slug = ANY($1)`, [ids]);
      return rows.map(r => ({
        id: r.slug, kind: 'report', date: r.date, title: r.title, label: r.issuer_short ?? 'Report',
        href: `/reports/${r.slug}`,
      }));
    },
  },
};

// Refs → items with a label, title, date and in-app link. A ref whose item is not stored (or no longer
// is) comes back with only its ref, so the tag can still be removed from it.
export async function resolveRefs(refs) {
  const byKind = {};
  for (const ref of refs) {
    const [, kind, id] = REF.exec(ref) ?? [];
    if (kind) (byKind[kind] ??= []).push(id);
  }
  const found = new Map();
  await Promise.all(Object.entries(byKind).map(async ([kind, ids]) => {
    for (const item of await KINDS[kind].items(ids)) found.set(`${kind}:${item.id}`, item);
  }));
  return refs.map(ref => {
    const { id, ...item } = found.get(ref) ?? { kind: null };
    return { ref, ...item };
  });
}

const tagRow = r => ({ id: r.id, word: r.word, description: r.description, count: r.count ?? null, createdAt: r.created_at });

async function findTag(word) {
  const { rows: [tag] } = await pool.query('SELECT * FROM tags WHERE word = $1', [normalizeWord(word)]);
  if (!tag) throw new Error(`No tag "${word}"`);
  return tag;
}

export const tagQueries = {
  // Every tag with how many items carry it, most used first.
  tags: async () => {
    const { rows } = await pool.query(
      `SELECT t.*, COUNT(it.ref)::int AS count
         FROM tags t LEFT JOIN item_tags it ON it.tag_id = t.id
        GROUP BY t.id ORDER BY count DESC, t.word`);
    return rows.map(tagRow);
  },

  tagsForItem: async (_, { ref }) => {
    const { rows } = await pool.query(
      `SELECT t.* FROM tags t JOIN item_tags it ON it.tag_id = t.id WHERE it.ref = $1 ORDER BY t.word`, [ref]);
    return rows.map(tagRow);
  },

  // A tag and its items, newest first (undated items last).
  tagPage: async (_, { word }) => {
    const { rows: [tag] } = await pool.query('SELECT * FROM tags WHERE word = $1', [normalizeWord(word)]);
    if (!tag) return null;
    const { rows } = await pool.query('SELECT ref, note FROM item_tags WHERE tag_id = $1', [tag.id]);
    const notes = new Map(rows.map(r => [r.ref, r.note]));
    const items = (await resolveRefs(rows.map(r => r.ref)))
      .map(item => ({ ...item, note: notes.get(item.ref) }))
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
    return { tag: tagRow({ ...tag, count: items.length }), items };
  },
};

export const tagMutations = {
  // Creating a tag is its own step, so a mistyped word is never made a tag by applying it.
  createTag: async (_, { word, description }) => {
    const normalized = normalizeWord(word);
    if (!normalized) throw new Error('A tag needs a word');
    const { rows: [tag] } = await pool.query(
      `INSERT INTO tags (word, description, source) VALUES ($1, $2, 'manual')
       ON CONFLICT (word) DO UPDATE SET word = EXCLUDED.word RETURNING *`,
      [normalized, description || null]);
    return tagRow(tag);
  },

  // Applies an existing tag only.
  applyTag: async (_, { word, ref }) => {
    if (!REF.test(ref)) throw new Error(`Not an item reference: ${ref}`);
    const tag = await findTag(word);
    await pool.query('INSERT INTO item_tags (tag_id, ref) VALUES ($1, $2) ON CONFLICT DO NOTHING', [tag.id, ref]);
    return tagRow(tag);
  },

  removeTag: async (_, { word, ref }) => {
    const tag = await findTag(word);
    const { rowCount } = await pool.query('DELETE FROM item_tags WHERE tag_id = $1 AND ref = $2', [tag.id, ref]);
    return rowCount > 0;
  },

  describeTag: async (_, { word, description }) => {
    const tag = await findTag(word);
    const { rows: [updated] } = await pool.query(
      'UPDATE tags SET description = $2 WHERE id = $1 RETURNING *', [tag.id, description?.trim() || null]);
    return tagRow(updated);
  },

  // Moves every item of one tag to another and deletes the first.
  mergeTag: async (_, { from, into }) => {
    const [source, target] = [await findTag(from), await findTag(into)];
    if (source.id === target.id) throw new Error('A tag cannot be merged into itself');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO item_tags (tag_id, ref, note, created_at)
         SELECT $2, ref, note, created_at FROM item_tags WHERE tag_id = $1 ON CONFLICT DO NOTHING`,
        [source.id, target.id]);
      await client.query('DELETE FROM tags WHERE id = $1', [source.id]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return tagRow(target);
  },

  // Only a tag on no items can be deleted; one in use is merged instead.
  deleteTag: async (_, { word }) => {
    const tag = await findTag(word);
    const { rows: [{ count }] } = await pool.query('SELECT COUNT(*)::int AS count FROM item_tags WHERE tag_id = $1', [tag.id]);
    if (count) throw new Error(`"${tag.word}" is on ${count} items; merge it into another tag instead`);
    await pool.query('DELETE FROM tags WHERE id = $1', [tag.id]);
    return true;
  },
};
