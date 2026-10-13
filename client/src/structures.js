// Category structures: ways of sorting everything GovGraph holds into nested subjects. Each is a JSON file in
// server/seed/data/structures/ ({ id, name, basis, levels, source, categories }); a category is
// { id, name, children } with whatever else its scheme gives (code, description, page, …).
import statisticalAbstract from '@data/structures/statistical-abstract.json';
import comparativeAgendas from '@data/structures/comparative-agendas.json';
import placements from '@data/placements.json';

export const STRUCTURES = [statisticalAbstract, comparativeAgendas];

// Where each measure sits in each structure: { [structure id]: { [measure]: { category, basis, tables | reason }
// | { left_out, reason } } }, checked by server/lib/placements.test.js.
export const PLACEMENTS = placements;

/**
 * A structure down to the measures placed in it, for Build mode: categories as printed, each with the measures
 * placed at it (`measures`, in the order of `keys`). `keys`: the measures that have datasets. Returns
 * { categories, leftOut: measures not in this structure, pathOf: measure → [category names above it] }.
 */
export function withMeasures(structure, keys) {
  const own = PLACEMENTS[structure.id] ?? {};
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
  return { categories: walk(structure.categories, []), leftOut, pathOf };
}
