#!/usr/bin/env node
/**
 * Load demographic series (lib/population/series.js) from the Census Bureau files on disk
 * (fetch-population.js) → economic_series + economic_observations, one series per measure and place.
 *
 * The national series (place null) are named by the same rules as the economic series and must not
 * repeat one of their names; a place series is named "<measure>, <place>" and may run longer than
 * the 60 characters a national name is held to, since it is shown only on the Demographic Data page.
 * Re-running replaces each series' observations, so years downloaded since are picked up.
 *
 * Usage:
 *   node --env-file=server/.env server/seed/load-demographic-series.js [--measure population,median-age]
 *     [--level nation,state,district] [--dry-run]
 *
 * Env:
 *   DATABASE_URL — Supabase Postgres connection URI
 */

import pg from 'pg';
import { demographicSeries } from '../lib/population/series.js';
import { SERIES, SCHEMA } from '../lib/economic-series.js';
import { nameProblems, seriesNameProblems } from '../lib/series-names.js';
import { storeSeriesMany } from '../lib/series-storage.js';

const arg = name => {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
};
const DRY_RUN = process.argv.includes('--dry-run');
const only = arg('--measure')?.split(',') ?? null;
const levels = arg('--level')?.split(',') ?? null;

async function run() {
  console.log(`Reading demographic series${DRY_RUN ? ' (dry run)' : ''}...`);
  const list = demographicSeries({ only, levels, log: console.log });

  const national = list.filter(s => !s.place);
  const problems = [
    ...seriesNameProblems([...SERIES, ...national]).filter(p => national.some(s => p.startsWith(`${s.slug}:`) || p.includes(`of ${s.slug}`))),
    ...list.filter(s => s.place).flatMap(s => nameProblems(s.name).filter(p => !/characters/.test(p)).map(p => `${s.slug}: “${s.name}” ${p}`)),
  ];
  if (problems.length) throw new Error(`Series names break the naming rules (lib/series-names.js):\n  ${problems.slice(0, 40).join('\n  ')}`);

  // Per measure: how many places at each level, the years covered, the observations.
  const byMeasure = new Map();
  for (const s of list) {
    if (!byMeasure.has(s.measure)) byMeasure.set(s.measure, { nation: 0, state: 0, district: 0, first: null, last: null, n: 0 });
    const m = byMeasure.get(s.measure);
    m[s.placeLevel]++;
    m.n += s.observations.length;
    const first = s.observations[0][0].slice(0, 4), last = s.observations.at(-1)[0].slice(0, 4);
    if (!m.first || first < m.first) m.first = first;
    if (!m.last || last > m.last) m.last = last;
  }
  for (const [slug, m] of byMeasure) {
    console.log(`  ${slug.padEnd(30)} nation ${m.nation}, states ${String(m.state).padStart(2)}, districts ${String(m.district).padStart(4)}  ${m.first}–${m.last}  ${m.n} values`);
  }
  console.log(`${list.length} series, ${list.reduce((n, s) => n + s.observations.length, 0)} observations.`);
  if (DRY_RUN) return;

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    // The schema first, on its own: ALTER TABLE locks the table against every reader until its transaction ends,
    // so inside the load's transaction it would hold the site's economic pages for the whole load.
    await client.query(SCHEMA);
    await client.query('BEGIN');
    const stored = await storeSeriesMany(client, list.map(s => ({ s, observations: s.observations })));
    await client.query('COMMIT');
    console.log(`Stored ${list.length} series, ${stored} observations.`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
