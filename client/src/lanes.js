// Lanes on the timeline: each lane is one chart of economic series under the events. A lane has one
// scale, or two (left and right) when a series measured differently is dragged onto it; never three.
// Series share a scale when measured alike: the same unit, and dollars only beside dollars published
// for the same period (a month's receipts and a year's are not on one axis). An index never shares:
// each has its own base year.

import { asPublished } from './economy';

export const DOLLAR_UNITS = { $: 1, $k: 1e3, $m: 1e6, $bn: 1e9 };
const UNIT_NAMES = {
  '%': 'Percent', '$/bbl': 'Dollars a barrel', '$/gal': 'Dollars a gallon', thousands: 'People (thousands)',
  'kb/d': 'Barrels a day (thousands)', deaths: 'Deaths', x: 'Ratio', index: 'Index',
};
const FREQUENCY_WORDS = {
  daily: 'daily', weekly: 'weekly', 'four-week-average': 'four-week averages', monthly: 'monthly', quarterly: 'quarterly',
  annual: 'yearly', 'fiscal-year': 'by fiscal year', irregular: 'as changed',
};

/** The scale a series is drawn against: '%', '$|monthly', 'index|cpi', … */
export function scaleOf(series) {
  if (!series) return null;
  if (series.unit === 'index') return `index|${series.slug}`;
  if (series.unit in DOLLAR_UNITS) return `$|${series.frequency}`;
  return series.unit;
}

/** A scale as words: "Percent", "Dollars, monthly", "Index". */
export function scaleName(key) {
  if (!key) return '';
  if (key.startsWith('$|')) return `Dollars, ${FREQUENCY_WORDS[key.slice(2)] ?? key.slice(2)}`;
  if (key.startsWith('index|')) return 'Index';
  return UNIT_NAMES[key] ?? key;
}

/** The scales a lane holds, in the order its series were added. */
export const laneScales = (lane, bySlug) => [...new Set(lane.items.map(i => scaleOf(bySlug.get(i.slug))).filter(Boolean))];

/** Whether a series may join a lane: 'ok' (a scale it has), 'axis' (a second scale, on the right), 'no' (a third). */
export function laneVerdict(lane, slug, bySlug) {
  const scale = scaleOf(bySlug.get(slug));
  const others = laneScales({ items: lane.items.filter(i => i.slug !== slug) }, bySlug);
  if (!others.length || others.includes(scale)) return 'ok';
  return others.length === 1 ? 'axis' : 'no';
}

/**
 * The lane a new series joins: one on its scale that already holds the same subject (the Black
 * unemployment rate beside the unemployment rate, wherever that was dragged), else any on its scale,
 * else none (a new lane).
 */
export function laneFor(lanes, slug, bySlug) {
  const s = bySlug.get(slug);
  const fits = lanes.filter(l => laneScales(l, bySlug).includes(scaleOf(s)));
  return fits.find(l => l.items.some(i => bySlug.get(i.slug)?.category === s?.category)) ?? fits[0] ?? null;
}

/** How often a series' values come as drawn: daily series as weekly averages, except those always shown as published. */
export const shownFrequency = s => (s.frequency === 'daily' && !asPublished(s.slug) ? 'weekly' : s.frequency);

// Publishers as named beside a series in lists (the full names are in economy.js SOURCES).
const SOURCE_SHORT = {
  eia: 'EIA', bls: 'BLS', 'bls-bulk': 'BLS', bea: 'BEA', treasury: 'Treasury', 'treasury-mts': 'Treasury', 'treasury-mts-1': 'Treasury',
  'treasury-mts-4': 'Treasury', 'treasury-dts': 'Treasury', 'treasury-dts-iv': 'Treasury', omb: 'OMB', cbo: 'CBO', 'irs-soi': 'IRS',
  usitc: 'USITC', census: 'Census', 'census-nrs': 'Census', 'census-trade': 'Census', umich: 'U. of Michigan', freddiemac: 'Freddie Mac',
  fhfa: 'FHFA', atlantafed: 'Atlanta Fed', cdc: 'CDC', 'fed-h15': 'Federal Reserve', 'fed-omo': 'Federal Reserve',
};
export const sourceShort = source => SOURCE_SHORT[source] ?? source;

// How often a series is published, as a badge: D, W, 4W, M, Q, Y, FY.
export const FREQUENCY_CODES = {
  daily: ['D', 'Daily'], weekly: ['W', 'Weekly'], 'four-week-average': ['4W', 'Four-week average'], monthly: ['M', 'Monthly'],
  quarterly: ['Q', 'Quarterly'], annual: ['Y', 'Yearly'], 'fiscal-year': ['FY', 'Fiscal year'], irregular: ['·', 'When changed'],
};
