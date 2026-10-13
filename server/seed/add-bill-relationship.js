#!/usr/bin/env node
/**
 * Add (or remove) a relationship between two bills that Congress.gov does not record — or
 * overrule one it does — then rebuild the affected Congresses' proposals.
 *
 * Our rows have source 'govgraph' and identified_by 'manual'; reloading bill status files never
 * touches them. Use Congress.gov's wording when the meaning is the same ("Identical bill",
 * "Related bill"), so they count like theirs. "Not identical" stops an identical link from
 * pairing two bills into one proposal without deleting the imported row (a reload would restore it).
 * Symmetric types ("Identical bill", "Not identical", "Related bill") are stored in both directions.
 *
 * Usage:
 *   node --env-file=server/.env server/seed/add-bill-relationship.js \
 *     --from 119-hr-2 --to 119-s-2824 --type "Identical bill" --note "Same text as introduced"
 *   node --env-file=server/.env server/seed/add-bill-relationship.js --from 119-hr-2 --to 119-s-2824 --type "Identical bill" --remove
 *
 * Env:
 *   DATABASE_URL — Supabase Postgres connection URI
 */

import pg from 'pg';
import { buildProposals } from '../lib/proposals.js';

const SYMMETRIC = new Set(['Identical bill', 'Not identical', 'Related bill']);

const arg = name => {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
};
const REMOVE = process.argv.includes('--remove');
const [from, to, type, note] = [arg('--from'), arg('--to'), arg('--type'), arg('--note')];
if (!from || !to || !type) {
  console.error('Usage: --from 119-hr-2 --to 119-s-2824 --type "Identical bill" [--note "…"] [--remove]');
  process.exit(1);
}

// "119-hr-2" → { congress: 119, type: 'hr', number: '2', sourceId: '119-HR-2' }
function billRef(value) {
  const m = /^(\d+)-([a-z]+)-(\d+)$/i.exec(value);
  if (!m) throw new Error(`not a bill reference like 119-hr-2: ${value}`);
  return { congress: Number(m[1]), type: m[2].toLowerCase(), number: m[3], sourceId: `${m[1]}-${m[2].toUpperCase()}-${m[3]}` };
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
try {
  const a = billRef(from), b = billRef(to);
  const { rows } = await client.query('SELECT id, source_id, title FROM legislation WHERE source_id = ANY($1)', [[a.sourceId, b.sourceId]]);
  const found = Object.fromEntries(rows.map(r => [r.source_id, r]));
  for (const ref of [a, b]) if (!found[ref.sourceId]) throw new Error(`${ref.sourceId} is not in the database (load its Congress first)`);

  const directions = SYMMETRIC.has(type) ? [[a, b], [b, a]] : [[a, b]];
  await client.query('BEGIN');
  for (const [x, y] of directions) {
    const key = [found[x.sourceId].id, y.congress, y.type, y.number, type];
    if (REMOVE) {
      await client.query(
        `DELETE FROM bill_relationships WHERE source = 'govgraph' AND legislation_id = $1
            AND related_congress = $2 AND related_type = $3 AND related_number = $4 AND relationship = $5`,
        key
      );
    } else {
      await client.query(
        `INSERT INTO bill_relationships
           (legislation_id, related_congress, related_type, related_number, related_legislation_id, related_title,
            relationship, identified_by, source, note)
         VALUES ($1, $2, $3, $4, $6, $7, $5, 'manual', 'govgraph', $8)
         ON CONFLICT (legislation_id, related_congress, related_type, related_number, relationship, source)
         DO UPDATE SET note = EXCLUDED.note, fetched_at = now()`,
        [...key, found[y.sourceId].id, found[y.sourceId].title, note]
      );
    }
  }
  for (const congress of new Set([a.congress, b.congress])) {
    const { paired } = await buildProposals(client, congress);
    console.log(`${congress}: proposals rebuilt (${paired} identical House–Senate pairs)`);
  }
  await client.query('COMMIT');
  console.log(`${REMOVE ? 'Removed' : 'Stored'}: ${a.sourceId} → ${b.sourceId} "${type}"${directions.length > 1 ? ' (both directions)' : ''}`);
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
