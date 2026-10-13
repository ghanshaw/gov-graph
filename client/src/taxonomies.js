// Taxonomies (GLOSSARY.md): official ways of sorting everything GovGraph holds into nested subjects. Each is a JSON file in
// server/seed/data/taxonomies/ ({ id, name, basis, levels, source, categories }); a category is
// { id, name, children } with whatever else its scheme gives (code, description, page, …).
import statisticalAbstract from '@data/taxonomies/statistical-abstract.json';
import comparativeAgendas from '@data/taxonomies/comparative-agendas.json';
import placements from '@data/placements.json';

export const TAXONOMIES = [statisticalAbstract, comparativeAgendas];

// Where measures sit in each taxonomy: { [taxonomy id]: { measures: { [measure]: placement } } }, a placement being
// { category, basis, tables | reason } or { left_out, reason }; checked by server/lib/taxonomies.test.js.
export const PLACEMENTS = placements;

/**
 * A taxonomy down to the measures placed in it, for Build mode: categories as printed, each with the measures
 * placed at it (`measures`, in the order of `keys`). `keys`: the measures that have series; `label(key)`: a measure's
 * name. A measure is a name in a place (GLOSSARY.md), so measures of the same name in one category of a taxonomy other
 * than the one that defines them (CAP's Interest Rates holds both "Consumer prices") are shown as one leaf, whose key
 * joins theirs with "+" (`partsOf`). Returns { categories, leftOut: measures not in this taxonomy, pathOf: leaf →
 * [category names above it] }.
 */
export function withMeasures(taxonomy, keys, label = key => key) {
  const own = PLACEMENTS[taxonomy.id]?.measures ?? {};
  const at = new Map();
  const leftOut = [];
  for (const key of keys) {
    const p = own[key];
    if (!p || p.left_out) leftOut.push(key);
    else at.set(p.category, [...(at.get(p.category) ?? []), key]);
  }
  // Same name, same place: one leaf.
  const leaves = list => {
    const byName = new Map();
    for (const key of list) byName.set(label(key), [...(byName.get(label(key)) ?? []), key]);
    return [...byName.values()].map(parts => parts.join('+'));
  };
  const pathOf = new Map();
  const walk = (cats, above) => (cats ?? []).map(c => {
    const path = [...above, c.name];
    const measures = leaves(at.get(c.id) ?? []);
    for (const key of measures) pathOf.set(key, path);
    return { id: c.id, name: c.name, description: c.description ?? null, measures, children: walk(c.children, path) };
  });
  return { categories: walk(taxonomy.categories, []), leftOut: leaves(leftOut), pathOf };
}

/** The measures a leaf stands for: two keys joined by "+" → both. */
export const partsOf = leaf => leaf.split('+');
