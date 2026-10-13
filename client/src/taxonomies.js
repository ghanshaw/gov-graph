// Taxonomies (GLOSSARY.md): official ways of sorting everything GovGraph holds into nested subjects. Each is a JSON file in
// server/seed/data/taxonomies/ ({ id, name, basis, levels, source, categories }); a category is
// { id, name, children } with whatever else its scheme gives (code, description, page, …).
import statisticalAbstract from '@data/taxonomies/statistical-abstract.json';
import comparativeAgendas from '@data/taxonomies/comparative-agendas.json';
import placements from '@data/placements.json';

export const TAXONOMIES = [statisticalAbstract, comparativeAgendas];

// Where series sit in each taxonomy: { [taxonomy id]: { measures: { [measure]: placement }, series: { [slug]: placement } } },
// a placement being { category, basis, tables | reason } or { left_out, reason }; checked by server/lib/taxonomies.test.js.
// Build mode places measures; a series placed apart from its measure (`series`) is not shown apart yet.
export const PLACEMENTS = placements;

/**
 * A taxonomy down to the measures placed in it, for Build mode: categories as printed, each with the measures
 * placed at it (`measures`, in the order of `keys`). `keys`: the measures that have series. Returns
 * { categories, leftOut: measures not in this taxonomy, pathOf: measure → [category names above it] }.
 */
export function withMeasures(taxonomy, keys) {
  const own = PLACEMENTS[taxonomy.id]?.measures ?? {};
  const at = new Map();
  const leftOut = [];
  for (const key of keys) {
    const p = own[key];
    if (!p || p.left_out) leftOut.push(key);
    else at.set(p.category, [...(at.get(p.category) ?? []), key]);
  }
  const pathOf = new Map();
  const walk = (cats, above) => (cats ?? []).map(c => {
    const path = [...above, c.name];
    for (const key of at.get(c.id) ?? []) pathOf.set(key, path);
    return { id: c.id, name: c.name, description: c.description ?? null, measures: at.get(c.id) ?? [], children: walk(c.children, path) };
  });
  return { categories: walk(taxonomy.categories, []), leftOut, pathOf };
}
