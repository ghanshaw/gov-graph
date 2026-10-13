#!/usr/bin/env node
/**
 * Store every taxonomy (seed/data/taxonomies/) as `categories`, and every placement (seed/data/placements.json) as
 * `category_items`: one row per measure ('measure:gdp') and per series placed apart from its measure ('series:<slug>'),
 * per taxonomy. The files are the originals; re-running replaces the rows. Checks the placements first, as
 * lib/taxonomies.test.js does, and stores nothing if they are wrong.
 *
 *   node --env-file=server/.env server/seed/load-taxonomies.js [--dry-run]
 */

import pg from 'pg';
import { readTaxonomies, readPlacements, placementProblems, flatten, SCHEMA } from '../lib/taxonomies.js';
import { MEASURES, seriesDimensions } from '../lib/series-dimensions.js';
import { SERIES } from '../lib/economic-series.js';

const DRY_RUN = process.argv.includes('--dry-run');

const taxonomies = readTaxonomies();
const placements = readPlacements();
const problems = placementProblems(placements, taxonomies, MEASURES, new Map(SERIES.map(s => [s.slug, seriesDimensions(s).measure])));
if (problems.length) {
  for (const p of problems) console.error(`  ${p}`);
  throw new Error(`${problems.length} problems in placements.json`);
}

const categories = taxonomies.flatMap(t => flatten(t).map(c => ({ taxonomy: t.id, ...c })));
const items = taxonomies.flatMap(t => [
  ...Object.entries(placements[t.id].measures).map(([key, p]) => ({ taxonomy: t.id, item: `measure:${key}`, ...p })),
  ...Object.entries(placements[t.id].series ?? {}).map(([slug, p]) => ({ taxonomy: t.id, item: `series:${slug}`, ...p })),
]);
for (const t of taxonomies) {
  const mine = items.filter(i => i.taxonomy === t.id);
  console.log(`${t.id}: ${categories.filter(c => c.taxonomy === t.id).length} categories; ${mine.filter(i => i.item.startsWith('measure:')).length} measures and ${mine.filter(i => i.item.startsWith('series:')).length} series placed apart (${mine.filter(i => i.basis === 'table').length} by table, ${mine.filter(i => i.basis === 'judgement').length} by judgement, ${mine.filter(i => i.left_out).length} left out)`);
}
if (DRY_RUN) process.exit(0);

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
try {
  await client.query(SCHEMA);
  await client.query('BEGIN');
  await client.query('DELETE FROM category_items');
  await client.query('DELETE FROM categories');
  for (const c of categories) {
    await client.query(
      'INSERT INTO categories (taxonomy, id, parent, position, depth, name, code, description) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [c.taxonomy, c.id, c.parent, c.position, c.depth, c.category.name, c.category.code ?? null, c.category.description ?? null],
    );
  }
  for (const i of items) {
    await client.query(
      'INSERT INTO category_items (taxonomy, item, category, left_out, basis, tables, reason) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [i.taxonomy, i.item, i.category ?? null, !!i.left_out, i.basis ?? null, i.tables?.map(String) ?? null, i.reason ?? null],
    );
  }
  await client.query('COMMIT');
  console.log(`Stored ${categories.length} categories and ${items.length} placements.`);
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release();
  await pool.end();
}
