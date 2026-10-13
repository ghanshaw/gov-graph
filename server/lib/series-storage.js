// Storing one series (economic_series + economic_observations; schema in lib/economic-series.js),
// for load-economic-series.js and load-demographic-series.js. The row is matched by slug, so its id
// is kept; its observations are replaced by the file's, which picks up the publisher's revisions.

import { valuesClause } from './data-dir.js';
import { readSources, seriesMatcher } from './sources.js';

// Each series' program (seed/data/sources.json), matched by its file or its source.
let programMatcher;
const programOf = s => (programMatcher ??= seriesMatcher(readSources().programs))(s);

const BATCH = 2000;

/**
 * `s`: { slug, source, source_id, route?, frequency, name, description, category, unit, measure?, place? };
 * `observations`: [[date, value], …] oldest first; `title`: the publisher's own { title, from } or null.
 */
export async function storeSeries(client, s, observations, title = null) {
  const { rows: [{ id }] } = await client.query(
    `INSERT INTO economic_series (slug, source, source_id, route, frequency, name, description, category, unit, first_date, last_date,
                                  publisher_title, publisher_title_from, measure, place, program, loaded_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, now())
     ON CONFLICT (slug) DO UPDATE SET source = $2, source_id = $3, route = $4, frequency = $5, name = $6,
       description = $7, category = $8, unit = $9, first_date = $10, last_date = $11,
       publisher_title = $12, publisher_title_from = $13, measure = $14, place = $15, program = $16, loaded_at = now()
     RETURNING id`,
    // The description is ours; the publisher's title is read from its files.
    [s.slug, s.source, s.source_id, s.route ?? null, s.frequency, s.name, s.description, s.category, s.unit,
      observations[0]?.[0] ?? null, observations.at(-1)?.[0] ?? null, title?.title ?? null, title?.from ?? null,
      s.measure ?? null, s.place ?? null, programOf(s)],
  );
  await client.query('DELETE FROM economic_observations WHERE series_id = $1', [id]);
  for (let i = 0; i < observations.length; i += BATCH) {
    const { sql, params } = valuesClause(observations.slice(i, i + BATCH).map(([date, value]) => [id, date, value]));
    await client.query(`INSERT INTO economic_observations (series_id, date, value) VALUES ${sql}`, params);
  }
  return id;
}

/**
 * Many series at once, as storeSeries does one (thousands of demographic series would otherwise be
 * three round trips each): `list` is [{ s, observations }]. Returns how many observations were stored.
 */
export async function storeSeriesMany(client, list, { batch = 400, obsBatch = 5000 } = {}) {
  let stored = 0;
  for (let i = 0; i < list.length; i += batch) {
    const chunk = list.slice(i, i + batch);
    const { sql, params } = valuesClause(chunk.map(({ s, observations }) => [
      s.slug, s.source, s.source_id, s.route ?? null, s.frequency, s.name, s.description, s.category, s.unit,
      observations[0]?.[0] ?? null, observations.at(-1)?.[0] ?? null, s.measure ?? null, s.place ?? null, programOf(s),
    ]));
    const { rows } = await client.query(
      `INSERT INTO economic_series (slug, source, source_id, route, frequency, name, description, category, unit,
                                    first_date, last_date, measure, place, program)
       VALUES ${sql}
       ON CONFLICT (slug) DO UPDATE SET source = EXCLUDED.source, source_id = EXCLUDED.source_id, route = EXCLUDED.route,
         frequency = EXCLUDED.frequency, name = EXCLUDED.name, description = EXCLUDED.description,
         category = EXCLUDED.category, unit = EXCLUDED.unit, first_date = EXCLUDED.first_date, last_date = EXCLUDED.last_date,
         measure = EXCLUDED.measure, place = EXCLUDED.place, program = EXCLUDED.program, loaded_at = now()
       RETURNING id, slug`,
      params,
    );
    const idOf = new Map(rows.map(r => [r.slug, r.id]));
    await client.query('DELETE FROM economic_observations WHERE series_id = ANY($1)', [rows.map(r => r.id)]);
    const observations = chunk.flatMap(({ s, observations: obs }) => obs.map(([date, value]) => [idOf.get(s.slug), date, value]));
    for (let j = 0; j < observations.length; j += obsBatch) {
      const v = valuesClause(observations.slice(j, j + obsBatch));
      await client.query(`INSERT INTO economic_observations (series_id, date, value) VALUES ${v.sql}`, v.params);
    }
    stored += observations.length;
  }
  return stored;
}
