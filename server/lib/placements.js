// Where each measure sits in each category structure (features/category-breakdowns, "Measures and placements").
// The structures stay as their publishers print them (seed/data/structures/); the measures are GovGraph's own flat
// list (MEASURES in series-dimensions.js); placements.json joins the two. The client imports the same files.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'seed', 'data');

export const BASES = ['table', 'judgement'];
export const readPlacements = () => JSON.parse(fs.readFileSync(path.join(DATA, 'placements.json'), 'utf8'));
export const readStructures = () => fs.readdirSync(path.join(DATA, 'structures')).filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(fs.readFileSync(path.join(DATA, 'structures', f), 'utf8')));

/** Every category id in a structure, at any depth. */
export function categoryIds(structure) {
  const ids = new Set();
  const walk = cats => { for (const c of cats ?? []) { ids.add(c.id); walk(c.children); } };
  walk(structure.categories);
  return ids;
}

/**
 * What is wrong with the placements: a structure or measure missing or unknown, a category that does not exist,
 * a basis without its evidence (`table` needs table numbers, `judgement` and `left_out` a reason).
 */
export function placementProblems(placements, structures, measures) {
  const problems = [];
  const known = new Set(Object.keys(measures));
  for (const structure of structures) {
    const own = placements[structure.id];
    if (!own) { problems.push(`${structure.id}: no placements`); continue; }
    const ids = categoryIds(structure);
    for (const key of known) if (!own[key]) problems.push(`${structure.id}: ${key} is neither placed nor left out`);
    for (const [key, p] of Object.entries(own)) {
      const at = `${structure.id}: ${key}`;
      if (!known.has(key)) problems.push(`${at}: unknown measure`);
      if (p.left_out) {
        if (!p.reason) problems.push(`${at}: left out without a reason`);
        if (p.category) problems.push(`${at}: left out but given a category`);
        continue;
      }
      if (!ids.has(p.category)) problems.push(`${at}: unknown category ${p.category}`);
      if (!BASES.includes(p.basis)) problems.push(`${at}: basis must be ${BASES.join(' or ')}`);
      if (p.basis === 'table' && !p.tables?.length) problems.push(`${at}: table without table numbers`);
      if (p.basis === 'judgement' && !p.reason) problems.push(`${at}: judgement without a reason`);
    }
  }
  const structureIds = new Set(structures.map(s => s.id));
  for (const id of Object.keys(placements)) if (id !== 'about' && !structureIds.has(id)) problems.push(`${id}: unknown structure`);
  return problems;
}
