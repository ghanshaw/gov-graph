// EIA's petroleum series (the PET.zip bulk file) collected for the Statistical Abstract (Phase 5, tables 731, 911, 916
// and 937): the series printing each table's rows, at the finest frequency EIA prints them, listed by hand in
// server/seed/data/eia-tables.json with EIA's own names and units.
//
// Names are EIA's in the reader's order: "Regular Gas Price in Boston", "Crude Oil Imports from Algeria", and for
// supply and disposition EIA's own words without "U.S." ("Field Production of Crude Oil", "Ending Stocks of Propane").

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'seed', 'data', 'eia-tables.json');
let cache = null;
const read = () => (cache ??= JSON.parse(fs.readFileSync(FILE, 'utf8')).tables);

const PUMP = 'prices/fuel-prices/fuel-price-at-the-pump';
const IMPORTS = 'energy-and-utilities/crude-oil-petroleum/crude-oil-imports';
const SUPPLY = 'forestry-fishing-and-mining/petroleum-industry-natural-gas/petroleum-supply-and-disposition';
const FREQUENCY = { W: 'weekly', M: 'monthly' };
const UNITS = { 'Dollars per Gallon': '$/gal', 'Thousand Barrels per Day': 'kb/d', 'Thousand Barrels': 'kbbl' };

const slug = text => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const COUNTRY_WORDS = {
  'Bahama Islands': 'the Bahamas', "Ivory Coast (Cote d'Ivore)": 'Ivory Coast', Turkiye: 'Türkiye', Netherlands: 'the Netherlands',
  'Netherlands Antilles': 'the Netherlands Antilles', 'United Kingdom': 'the United Kingdom', 'United Arab Emirates': 'the United Arab Emirates',
  'Virgin Islands': 'the U.S. Virgin Islands',
};
const COUNTRY_TOTALS = { MCRIMXX2: ['opec', 'OPEC countries'], MCRIMUSVV2: ['non-opec', 'Non-OPEC countries'] };

// Supply and disposition: "U.S. Ending Stocks excluding SPR of Crude Oil", "U.S. Crude Oil Stock Change".
const FLOWS = [
  [/^(?:U\.S\.|Alaska) Field Production of (.+)$/, 'field-production', 'Field production'],
  [/^U\.S\. Refinery and Blender Net Production of (.+)$/, 'refinery-production', 'Refinery and blender net production'],
  [/^U\.S\. Imports of (.+)$/, 'imports', 'Imports'],
  [/^U\.S\. Supply Adjustment of (.+)$/, 'adjustment', 'Supply adjustment'],
  [/^U\.S\. (.+) Stock Change$/, 'stock-change', 'Stock change'],
  [/^U\.S\. Stock Change of (.+)$/, 'stock-change', 'Stock change'],
  [/^U\.S\. Refinery and Blender Net Input of (.+)$/, 'refinery-input', 'Refinery and blender net input'],
  [/^U\.S\. Exports of (.+)$/, 'exports', 'Exports'],
  [/^U\.S\. Product Supplied of (.+)$/, 'product-supplied', 'Product supplied'],
  [/^U\.S\. Ending Stocks excluding SPR of (.+)$/, 'ending-stocks-commercial', 'Ending stocks excluding the SPR'],
  [/^U\.S\. Ending Stocks of (.+) in SPR$/, 'ending-stocks-spr', 'Ending stocks in the SPR'],
  [/^U\.S\. Ending Stocks of (.+)$/, 'ending-stocks', 'Ending stocks'],
];
function flowOf(name) {
  for (const [re, key, label] of FLOWS) {
    const m = re.exec(name);
    if (m) return { key, label, product: m[1], alaska: name.startsWith('Alaska') };
  }
  throw new Error(`eia-tables.json: no flow in "${name}"`);
}

/** The EIA ids (without "PET." and the frequency) of the series printing an Abstract table's rows (coverage's `eia:731`), or null. */
export function eiaTable(table) {
  const rows = read()[String(table)];
  return rows ? new Set(rows.map(r => /^PET\.(.+)\.\w$/.exec(r.id)[1])) : null;
}

/** The breakdowns: cities, countries, and the products and flows of supply and disposition. */
export function eiaDimensions() {
  const tables = read();
  const city = { us: { label: 'United States' } };
  for (const r of tables['731']) city[slug(r.city)] = { label: r.city };
  const country = { opec: { label: 'OPEC countries' }, 'non-opec': { label: 'Non-OPEC countries' } };
  for (const r of tables['937']) if (r.country) country[slug(r.country)] = { label: COUNTRY_WORDS[r.country]?.replace(/^the /, '') ?? r.country };
  const product = {};
  const flow = {};
  for (const r of [...tables['911'], ...tables['916']]) {
    const f = flowOf(r.name.replace(/, Monthly$/, ''));
    product[f.alaska ? 'crude-oil-alaska' : slug(f.product)] = { label: f.alaska ? 'Alaskan crude oil' : f.product, ...(f.alaska ? { parent: 'crude-oil' } : {}) };
    flow[f.key] = { label: f.label };
  }
  return {
    fuel_area: { label: 'Where', values: city },
    country: { label: 'From', values: country },
    oil_product: { label: 'Product', values: product },
    oil_flow: { label: 'Supply or disposition', values: flow },
  };
}

export const EIA_MEASURES = {
  [PUMP]: { dims: ['fuel_area'] },
  [IMPORTS]: { label: 'Crude oil imports', dims: ['country'] },
  [SUPPLY]: { label: 'Petroleum supply and disposition', dims: ['oil_product', 'oil_flow'] },
};

/** The EIA series of the Abstract's tables, leaving out those already written by hand (`existing`). */
export function eiaSeries(existing = []) {
  const have = new Set(existing.filter(s => s.source === 'eia').map(s => `${s.source_id}|${s.frequency}`));
  const seen = new Set();
  const out = [];
  // Crude oil imports in total belong to Table 937's measure, so it goes before 911 (numeric keys would put it after).
  for (const table of ['731', '937', '911', '916']) {
    for (const r of read()[table]) {
      const [, id, f] = /^PET\.(.+)\.(\w)$/.exec(r.id);
      const frequency = FREQUENCY[f];
      if (seen.has(r.id) || have.has(`${id}|${frequency}`)) continue;
      seen.add(r.id);
      const name = r.name.replace(/, (Weekly|Monthly)$/, '');
      const s = { slug: `eia--${id.toLowerCase().replace(/_/g, '-')}`, source: 'eia', source_id: id, frequency, unit: UNITS[r.units], category: 'petroleum', eia: { table: Number(table) } };
      if (table === '731') {
        Object.assign(s, {
          name: `Regular Gas Price in ${r.city}`, category: 'retail',
          description: `The average retail price of a gallon of regular gasoline (all formulations) in ${r.city}, each week. EIA, Gasoline and Diesel Fuel Update`,
          labels: { measure: PUMP, form: 'level', fuel: 'gasoline', fuel_area: slug(r.city) },
        });
      } else if (table === '937') {
        const total = COUNTRY_TOTALS[id];
        const who = r.country ? COUNTRY_WORDS[r.country] ?? r.country : total?.[1].replace('OPEC countries', 'OPEC Countries').replace('Non-OPEC countries', 'Non-OPEC Countries');
        Object.assign(s, {
          name: who ? `Crude Oil Imports from ${who}` : 'Crude Oil Imports',
          description: `Crude oil imported into the United States${who ? ` from ${who}` : ''}, in thousand barrels a day, each month. EIA, Petroleum Supply Monthly`,
          labels: { measure: IMPORTS, form: 'level', ...(r.country ? { country: slug(r.country) } : total ? { country: total[0] } : {}) },
        });
      } else {
        const fl = flowOf(name);
        Object.assign(s, {
          name: name.replace(/^U\.S\. /, '').replace(/ excluding SPR/, ' Excluding the SPR').replace(/ in SPR$/, ' in the SPR'),
          description: `${name}, in ${r.units.toLowerCase()}, each month. EIA, Petroleum Supply Monthly`,
          labels: { measure: SUPPLY, form: 'level', oil_product: fl.alaska ? 'crude-oil-alaska' : slug(fl.product), oil_flow: fl.key },
        });
      }
      out.push(s);
    }
  }
  return out;
}
