#!/usr/bin/env node
/**
 * Find House and Senate bills that are one proposal although Congress.gov does not mark them
 * "Identical bill", by comparing their texts, and record them as our own relationships.
 *
 * Congress.gov's "identical" means word for word; bills filed in both chambers with small
 * differences are only "Related bill", or not linked at all yet (CRS adds links weeks later).
 * Compared: every House/Senate pair of a Congress that Congress.gov calls "Related bill", or
 * whose titles are the same. Each bill's earliest stored text version (usually as introduced)
 * is compared (lib/text-similarity.js: share of five-word runs in common):
 *   90% or more  → 'Same text'
 *   60% to 90%   → 'Similar text'   (the same effort, its versions drifted apart)
 *   below 60%    → nothing (a shared title is often a shared name only)
 * Rows have source 'govgraph', identified_by 'text-match' and the percentage in `note`; each run
 * replaces the previous run's rows for the Congress (manual rows are untouched). Then the
 * Congress's proposals are rebuilt (lib/proposals.js), where these links pair bills after
 * Congress.gov's identical ones.
 *
 * Usage (after load-bill-status-bulk.js and load-bill-text-bulk.js):
 *   node --env-file=server/.env server/seed/match-bill-texts.js --congress 119 [--dry-run]
 *
 * Env:
 *   DATABASE_URL — Supabase Postgres connection URI
 */

import pg from 'pg';
import { congressRange, valuesClause } from '../lib/data-dir.js';
import { words, shingleHashes, hashSimilarity } from '../lib/text-similarity.js';
import { buildProposals } from '../lib/proposals.js';

const SAME = 0.9;
const SIMILAR = 0.6;
const CHUNK = 150; // bills whose text is fetched per query

const DRY_RUN = process.argv.includes('--dry-run');
const i = process.argv.indexOf('--congress');
if (i === -1) {
  console.error('Usage: --congress 119 | 115-119 [--dry-run]');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const HOUSE = `('hr', 'hres', 'hjres', 'hconres')`;

// House/Senate pairs worth comparing: Congress.gov calls them related, or they share a title.
async function candidates(client, congress) {
  // Two joins and a union: one condition with OR would compare every House bill with every Senate bill.
  const { rows } = await client.query(
    `WITH b AS (
       SELECT id, source_id, title, lower(title) AS key, lower(bill_type) IN ${HOUSE} AS house
         FROM legislation WHERE congress_number = $1),
     pairs AS (
       SELECT h.id AS h, s.id AS s FROM b h JOIN b s ON s.key = h.key AND h.house AND NOT s.house
       UNION
       SELECT CASE WHEN x.house THEN x.id ELSE y.id END, CASE WHEN x.house THEN y.id ELSE x.id END
         FROM bill_relationships r
         JOIN b x ON x.id = r.legislation_id
         JOIN b y ON y.id = r.related_legislation_id
        WHERE r.relationship = 'Related bill' AND x.house <> y.house)
     SELECT h.id AS h, s.id AS s, h.source_id AS hs, s.source_id AS ss, s.title AS stitle, h.title AS htitle
       FROM pairs p JOIN b h ON h.id = p.h JOIN b s ON s.id = p.s`,
    [congress]
  );
  return rows;
}

// Each bill's earliest stored version, preamble and sections, as shingle hashes.
async function texts(client, billIds) {
  const result = new Map();
  for (let start = 0; start < billIds.length; start += CHUNK) {
    const ids = billIds.slice(start, start + CHUNK);
    const { rows } = await client.query(
      `WITH first AS (
         SELECT DISTINCT ON (legislation_id) legislation_id, id, structure->'preamble' AS preamble
           FROM legislative_documents
          WHERE legislation_id = ANY($1::uuid[]) AND structure IS NOT NULL
          ORDER BY legislation_id, date NULLS LAST)
       SELECT f.legislation_id AS id, f.preamble,
              (SELECT json_agg(s.structure->'items' ORDER BY s.position)
                 FROM legislative_document_sections s WHERE s.document_id = f.id) AS sections
         FROM first f`,
      [ids]
    );
    for (const row of rows) {
      const parts = [...(row.preamble ?? []), ...(row.sections ?? []).flat()].map(item => item?.text ?? '');
      result.set(row.id, shingleHashes(words(parts.join(' '))));
    }
  }
  return result;
}

async function matchCongress(client, congress) {
  const pairs = await candidates(client, congress);
  const billIds = [...new Set(pairs.flatMap(p => [p.h, p.s]))];
  const hashes = await texts(client, billIds);

  const counts = { candidates: pairs.length, noText: 0, same: 0, similar: 0, below: 0 };
  const rows = [];
  for (const p of pairs) {
    const score = hashes.has(p.h) && hashes.has(p.s) ? hashSimilarity(hashes.get(p.h), hashes.get(p.s)) : null;
    if (score == null) { counts.noText++; continue; }
    if (score < SIMILAR) { counts.below++; continue; }
    const type = score >= SAME ? 'Same text' : 'Similar text';
    counts[score >= SAME ? 'same' : 'similar']++;
    const note = `${Math.floor(score * 100)}% of the text is the same (earliest stored versions compared)`;
    const [hc, ht, hn] = p.hs.split('-');
    const [sc, st, sn] = p.ss.split('-');
    rows.push([p.h, sc, st.toLowerCase(), sn, p.s, p.stitle, type, note]);
    rows.push([p.s, hc, ht.toLowerCase(), hn, p.h, p.htitle, type, note]);
  }

  await client.query(
    `DELETE FROM bill_relationships r USING legislation l
      WHERE l.id = r.legislation_id AND l.congress_number = $1
        AND r.source = 'govgraph' AND r.identified_by = 'text-match'`,
    [congress]
  );
  for (let start = 0; start < rows.length; start += 1000) {
    const chunk = valuesClause(rows.slice(start, start + 1000));
    await client.query(
      `INSERT INTO bill_relationships
         (legislation_id, related_congress, related_type, related_number, related_legislation_id, related_title,
          relationship, identified_by, source, note)
       SELECT v.id::uuid, v.congress::int, v.type, v.number, v.related::uuid, v.title, v.relationship, 'text-match', 'govgraph', v.note
         FROM (VALUES ${chunk.sql}) AS v(id, congress, type, number, related, title, relationship, note)
       ON CONFLICT DO NOTHING`,
      chunk.params
    );
  }
  const built = await buildProposals(client, congress);
  return { ...counts, ...built };
}

const client = await pool.connect();
try {
  await client.query('BEGIN');
  for (const congress of congressRange(process.argv[i + 1])) {
    const c = await matchCongress(client, congress);
    console.log(`${congress}: ${c.candidates} House/Senate pairs compared — ${c.same} same text, ${c.similar} similar text, `
      + `${c.below} below ${SIMILAR * 100}%, ${c.noText} without stored text. `
      + `Proposals: ${c.proposals} (${c.paired} House–Senate pairs)`);
  }
  await client.query(DRY_RUN ? 'ROLLBACK' : 'COMMIT');
  console.log(DRY_RUN ? 'Dry run — nothing written.' : 'Done.');
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  throw err;
} finally {
  client.release();
  await pool.end();
}
