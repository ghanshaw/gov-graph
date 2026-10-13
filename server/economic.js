// Economic series (seed/load-economic-series.js; lib/economic-series.js lists them): oil and fuel
// prices so far. A series' observations can be averaged into weeks, months or years, since forty
// years of a daily price is 10,000 points and a chart seldom needs them all.

import NodeCache from 'node-cache';
import { pool } from './db.js';
import { SERIES } from './lib/economic-series.js';
import { DIMENSIONS, MEASURES, seriesDimensions } from './lib/series-dimensions.js';

const cache = new NodeCache({ stdTTL: 600 });

const SERIES_COLUMNS = `id, slug, source, source_id AS "sourceId", frequency, name, description, category, unit,
  first_date::text AS "firstDate", last_date::text AS "lastDate",
  publisher_title AS "publisherTitle", publisher_title_from AS "publisherTitleFrom", measure, place`;

// date_trunc unit for each resampling; a week starts on Monday, as EIA dates its weeks.
const RESAMPLE = { week: 'week', month: 'month', year: 'year' };
// A series is never resampled to its own period or a finer one (weeks of a monthly series would
// redate each month to the Monday before it), so the page can ask for weeks of any series.
const FINENESS = { daily: 0, weekly: 1, week: 1, 'four-week-average': 1, monthly: 2, month: 2, quarterly: 2.5, annual: 3, 'fiscal-year': 3, year: 3 };

const SERIES_BY_SLUG = new Map(SERIES.map(s => [s.slug, s]));

export const economicQueries = {
  seriesDimensionVocabulary: () => ({ dimensions: DIMENSIONS, measures: MEASURES }),

  economicSeriesList: async () => {
    // National series only: the thousands kept per state and district are reached through seriesPlaces.
    const { rows } = await pool.query(`SELECT ${SERIES_COLUMNS} FROM economic_series WHERE place IS NULL ORDER BY category, name`);
    return rows;
  },

  seriesPlaces: async (_, { measure }) => {
    const key = `places:${measure}`;
    const cached = cache.get(key);
    if (cached) return cached;
    const { rows } = await pool.query(
      `SELECT slug, place, name, first_date::text AS "firstDate", last_date::text AS "lastDate"
         FROM economic_series WHERE measure = $1`, [measure]);
    const places = rows.map(r => {
      const level = !r.place ? 'nation' : r.place.includes('-') ? 'district' : 'state';
      // The place is what the name says after its last comma: "Median Age, California" → "California".
      return { ...r, level, label: level === 'nation' ? 'United States' : r.name.slice(r.name.lastIndexOf(', ') + 2) };
    });
    const rank = { nation: 0, state: 1, district: 2 };
    // States by name; districts by state, then number, then lines (the page groups them under their state).
    const sortKey = p => [rank[p.level], p.level === 'state' ? p.label : p.place?.split('-')[0] ?? '', p.place?.split('-')[1] ?? '', Number(p.place?.split('-l')[1] ?? 0)];
    places.sort((a, b) => {
      const [x, y] = [sortKey(a), sortKey(b)];
      for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
      return 0;
    });
    cache.set(key, places);
    return places;
  },

  economicSeries: async (_, { slug }) => {
    const { rows } = await pool.query(`SELECT ${SERIES_COLUMNS} FROM economic_series WHERE slug = $1`, [slug]);
    return rows[0] ?? null;
  },

  economicSeriesSet: async (_, { slugs }) => {
    const { rows } = await pool.query(`SELECT ${SERIES_COLUMNS} FROM economic_series WHERE slug = ANY($1)`, [slugs]);
    const bySlug = new Map(rows.map(r => [r.slug, r]));
    return slugs.map(slug => bySlug.get(slug)).filter(Boolean);
  },
};

export const economicResolvers = {
  EconomicSeries: {
    dimensions: (series) => {
      const def = SERIES_BY_SLUG.get(series.slug);
      return def ? seriesDimensions(def) : null;
    },
    breakdowns: (series) => SERIES.filter(s => s.breakdown?.of === series.slug)
      .map(s => ({ slug: s.slug, ...s.breakdown })),
    // Oldest first. `resample` averages each week / month / year, dated by its first day.
    observations: async (series, { from, to, resample }) => {
      if (resample && !RESAMPLE[resample]) throw new Error(`resample must be one of ${Object.keys(RESAMPLE).join(', ')}`);
      const unit = resample && FINENESS[resample] > FINENESS[series.frequency] ? RESAMPLE[resample] : null;
      const key = `obs:${series.id}:${from}:${to}:${unit}`;
      const cached = cache.get(key);
      if (cached) return cached;
      const where = `series_id = $1 AND ($2::date IS NULL OR date >= $2) AND ($3::date IS NULL OR date <= $3)`;
      const sql = unit
        ? `SELECT date_trunc('${unit}', date)::date::text AS date, round(avg(value), 3)::float AS value
             FROM economic_observations WHERE ${where} GROUP BY 1 ORDER BY 1`
        : `SELECT date::text AS date, value::float AS value FROM economic_observations WHERE ${where} ORDER BY date`;
      const { rows } = await pool.query(sql, [series.id, from ?? null, to ?? null]);
      cache.set(key, rows);
      return rows;
    },
  },
};
