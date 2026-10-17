// BLS's Consumer Price Index (CPI-U) collected for the Statistical Abstract (Phase 5, tables 142 and 724–727): every
// item for the U.S. city average, monthly, seasonally adjusted and not, and all items for each area. The series are
// kept in server/seed/data/cpi-series.json (seed/build-cpi-series.js, from BLS's survey files).
//
// Each index is a series of the consumer-prices measure, with its item (`cpi_item`, BLS's list with its levels) and
// area (`cpi_area`) as breakdowns; the purchasing power of the dollar, printed in dollars, is a measure of its own.
// Names are the item or area in Title Case ("Consumer Price Index for Food Away from Home"), with hand names in
// server/seed/data/cpi-names.json; where a name passes the limit, "CPI" is used for "Consumer Price Index". BLS's own
// title is kept as publisher_title (economic-series.js, from cu.series).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MAX_NAME } from './series-names.js';
import { titleCase } from './nipa-series.js';

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'seed', 'data');
let cache = null;
const read = () => (cache ??= {
  ...JSON.parse(fs.readFileSync(path.join(DATA, 'cpi-series.json'), 'utf8')),
  names: JSON.parse(fs.readFileSync(path.join(DATA, 'cpi-names.json'), 'utf8')),
});

const CATEGORY = 'prices/consumer-price-indexes-cost-of-living-index';
export const CPI_MEASURE = `${CATEGORY}/consumer-prices`;
export const PURCHASING_POWER = `${CATEGORY}/purchasing-power-of-the-dollar`;
const PURCHASING_ITEMS = { SA0R: '1982-84', AA0R: '1967' };

/** The breakdowns: items (under their group) and areas (under their region or size class). */
export function cpiDimensions() {
  const { items, areas } = read();
  const item = Object.fromEntries(items.filter(i => !PURCHASING_ITEMS[i.code])
    .map(i => [i.code.toLowerCase(), { label: i.name, ...(i.parent ? { parent: i.parent.toLowerCase() } : {}) }]));
  // A level-1 area sits under the level-0 area before it (New England under Northeast, Boston under Size Class A).
  const area = {};
  let top = null;
  for (const a of areas) {
    const key = a.code.toLowerCase();
    if (a.level === 0) top = key;
    area[key] = { label: a.name, ...(a.level === 1 && top && top !== '0000' ? { parent: top } : {}) };
  }
  return {
    cpi_item: { label: 'Item', values: item },
    cpi_area: { label: 'Area', values: area },
    dollar_base: { label: 'Dollar of', values: { '1982-84': { label: '1982–84' }, 1967: { label: '1967' } } },
  };
}

export const CPI_MEASURES = {
  [CPI_MEASURE]: { dims: ['cpi_item', 'cpi_area'] },
  [PURCHASING_POWER]: { label: 'Purchasing power of the dollar', dims: ['dollar_base'] },
};

const areaWords = name => name
  .replace(/^Size Class A$/, 'Large Metro Areas')
  .replace(/^Size Class B\/C$/, 'Small Metro Areas')
  .replace(/^Size Class D$/, 'Nonmetro Areas')
  .replace(/^(\w+) - Size Class A$/, 'Large Metro Areas in the $1')
  .replace(/^(\w+) - Size Class B\/C$/, 'Small Metro Areas in the $1')
  .replace(/^(\w+) - Size Class D$/, 'Nonmetro Areas in the $1')
  .replace(/^(Northeast|Midwest|South|West|Middle Atlantic|South Atlantic)$/, 'the $1')
  .replace(/^(East North Central|West North Central|East South Central|West South Central|Mountain|Pacific)$/, 'the $1 States');

/** The CPI series, leaving out those already written by hand (`existing`, by BLS id). */
export function cpiSeries(existing = []) {
  const { series, items, areas, names } = read();
  const have = new Set(existing.filter(s => s.source === 'bls-bulk').map(s => s.source_id));
  const itemOf = new Map(items.map(i => [i.code, i]));
  const areaOf = new Map(areas.map(a => [a.code, a]));
  const out = [];
  for (const b of series) {
    if (have.has(b.id)) continue;
    const item = itemOf.get(b.item);
    const area = areaOf.get(b.area);
    const sa = b.seasonal === 'S';
    const s = { source: 'bls-bulk', source_id: b.id, frequency: 'monthly', file: b.file, category: 'inflation' };
    const adjusted = sa ? 'seasonally adjusted' : 'not seasonally adjusted';
    if (PURCHASING_ITEMS[b.item]) {
      const base = PURCHASING_ITEMS[b.item];
      Object.assign(s, {
        slug: `purchasing-power-of-the-dollar${base === '1967' ? '-1967' : ''}${sa ? '-sa' : ''}`, unit: '$',
        name: `Purchasing Power of the Consumer Dollar${base === '1967' ? ' (1967 Dollars)' : ''}${sa ? ' (Seasonally Adjusted)' : ''}`,
        description: `What a dollar of ${base === '1967' ? '1967' : '1982–84'} buys at today's consumer prices (all items, U.S. city average), ${adjusted}. BLS, Consumer Price Index for All Urban Consumers`,
        labels: { measure: PURCHASING_POWER, form: 'purchasing-power', dollar_base: base, seasonal: sa ? 'sa' : 'nsa' },
      });
    } else {
      const local = b.area !== '0000';
      const what = local ? (names.areas[b.area] ?? areaWords(area.name)) : names.items[b.item] ?? (['SA0', 'AA0'].includes(b.item) ? null : titleCase(item.name));
      const base = b.base === 'A' ? ' (1967 Base)' : '';
      const full = what ? `Consumer Price Index for ${what}${base}` : `Consumer Price Index${base}`;
      Object.assign(s, {
        slug: local ? `cpi--area-${b.area.toLowerCase()}` : `cpi--${b.item.toLowerCase()}${b.base === 'A' ? '-1967' : ''}${sa ? '-sa' : ''}`,
        unit: 'index',
        name: `${full}${sa ? ' (Seasonally Adjusted)' : ''}`,
        description: `Consumer Price Index for All Urban Consumers (CPI-U): ${item.name.charAt(0).toLowerCase() + item.name.slice(1)}, ${area.name}, ${b.base_period.replace('=', ' = ')}, ${adjusted}. BLS item ${b.item}, area ${b.area}`,
        labels: {
          measure: CPI_MEASURE, form: 'index', price_index: 'cpi', cpi_item: b.item.toLowerCase(), cpi_area: b.area.toLowerCase(),
          ...(b.item === 'SA0' && !local ? { scope: 'all-items' } : {}), ...(b.item === 'SA0L1E' ? { scope: 'core' } : {}), seasonal: sa ? 'sa' : 'nsa',
        },
      });
    }
    out.push(s);
  }
  // Where an item's name is too long in either version, both versions say "CPI".
  const short = new Set(out.filter(s => s.name.length > MAX_NAME).map(s => s.labels.cpi_item));
  for (const s of out) if (short.has(s.labels.cpi_item) && s.labels.cpi_area === '0000') s.name = s.name.replace(/^Consumer Price Index/, 'CPI');
  return out;
}
