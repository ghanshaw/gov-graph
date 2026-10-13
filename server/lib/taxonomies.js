// Taxonomies (GLOSSARY.md) and where series sit in them (features/taxonomies, "Measures and placements").
// The taxonomies stay as their publishers print them (seed/data/taxonomies/); the measures are GovGraph's own flat list
// (MEASURES in series-dimensions.js); placements.json joins the two. A measure is placed, its series follow it, and a
// series is placed apart only where it differs (`series`). The client imports the same files; nothing is in the database.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'seed', 'data');
export const TAXONOMY_DIR = path.join(DATA, 'taxonomies');

export const BASES = ['table', 'judgement'];
export const readPlacements = () => JSON.parse(fs.readFileSync(path.join(DATA, 'placements.json'), 'utf8'));
// The Abstract's tables, as evidence (seed/build-abstract-tables.js): id → { section, category, page, title, source, … }.
export const readAbstractTables = () => new Map(JSON.parse(fs.readFileSync(path.join(DATA, 'statistical-abstract-tables.json'), 'utf8'))
  .tables.map(t => [t.id, t]));
export const readTaxonomies = () => fs.readdirSync(TAXONOMY_DIR).filter(f => f.endsWith('.json')).sort()
  .map(f => JSON.parse(fs.readFileSync(path.join(TAXONOMY_DIR, f), 'utf8')));

/** Every category of a taxonomy, parents before children: { id, parent, position, depth, category }. */
export function flatten(taxonomy) {
  const out = [];
  const walk = (cats, parent, depth) => (cats ?? []).forEach((c, i) => {
    out.push({ id: c.id, parent, position: i + 1, depth, category: c });
    walk(c.children, c.id, depth + 1);
  });
  walk(taxonomy.categories, null, 0);
  return out;
}

/** Every category id in a taxonomy, at any depth. */
export const categoryIds = taxonomy => new Set(flatten(taxonomy).map(c => c.id));

/**
 * One placement's problems: an unknown category, a basis without its evidence, a table that does not exist or is
 * printed in another category (`tables`: the Abstract's, for the Abstract's own taxonomy only).
 */
function problemsOf(at, p, ids, tables) {
  const problems = [];
  if (p.left_out) {
    if (!p.reason) problems.push(`${at}: left out without a reason`);
    if (p.category) problems.push(`${at}: left out but given a category`);
    return problems;
  }
  if (!ids.has(p.category)) problems.push(`${at}: unknown category ${p.category}`);
  if (!BASES.includes(p.basis)) problems.push(`${at}: basis must be ${BASES.join(' or ')}`);
  if (p.basis === 'table' && !p.tables?.length) problems.push(`${at}: table without table numbers`);
  if (p.basis === 'judgement' && !p.reason) problems.push(`${at}: judgement without a reason`);
  if (tables && p.basis === 'table') {
    for (const n of p.tables ?? []) {
      const t = tables.get(String(n));
      if (!t) problems.push(`${at}: no Table ${n}`);
      else if (t.category !== p.category && !t.category?.startsWith(`${p.category}/`)) problems.push(`${at}: Table ${n} is printed under ${t.category}`);
    }
  }
  return problems;
}

/**
 * What is wrong with the placements: a taxonomy or measure missing or unknown, a category that does not exist, a basis
 * without its evidence (`table` needs table numbers, `judgement` and `left_out` a reason), a series placed apart that
 * does not exist or sits where its measure already does. `seriesMeasure`: slug → measure, for every series.
 * `abstractTables` (readAbstractTables): a `table` placement in the Abstract must cite tables printed in its category.
 */
export function placementProblems(placements, taxonomies, measures, seriesMeasure = new Map(), abstractTables = null) {
  const problems = [];
  const known = new Set(Object.keys(measures));
  for (const taxonomy of taxonomies) {
    const own = placements[taxonomy.id];
    if (!own) { problems.push(`${taxonomy.id}: no placements`); continue; }
    const ids = categoryIds(taxonomy);
    const tables = taxonomy.id === 'statistical-abstract' ? abstractTables : null;
    const byMeasure = own.measures ?? {};
    for (const key of known) if (!byMeasure[key]) problems.push(`${taxonomy.id}: ${key} is neither placed nor left out`);
    for (const [key, p] of Object.entries(byMeasure)) {
      if (!known.has(key)) problems.push(`${taxonomy.id}: ${key}: unknown measure`);
      problems.push(...problemsOf(`${taxonomy.id}: ${key}`, p, ids, tables));
    }
    for (const [slug, p] of Object.entries(own.series ?? {})) {
      const at = `${taxonomy.id}: series ${slug}`;
      if (!seriesMeasure.has(slug)) { problems.push(`${at}: unknown series`); continue; }
      problems.push(...problemsOf(at, p, ids, tables));
      const m = byMeasure[seriesMeasure.get(slug)];
      if (m && (m.category ?? null) === (p.category ?? null) && !!m.left_out === !!p.left_out) problems.push(`${at}: sits where its measure does`);
    }
  }
  const taxonomyIds = new Set(taxonomies.map(s => s.id));
  for (const id of Object.keys(placements)) if (id !== 'about' && !taxonomyIds.has(id)) problems.push(`${id}: unknown taxonomy`);
  return problems;
}

/** Where one series sits in one taxonomy: its own placement, else its measure's. null when neither exists. */
export function placementOf(placements, taxonomyId, slug, measure) {
  const own = placements[taxonomyId] ?? {};
  return own.series?.[slug] ?? own.measures?.[measure] ?? null;
}

const slugOf = text => text.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Category ids never change once made (user, 2026-10-13). A rebuilt taxonomy (`next`) takes the ids of the categories
 * it had before (`previous`), matched level by level within the same parent: by code, then by name, then by position
 * among those left. A matched category keeps its id even if its name changed; a new one gets an id from its name
 * under its parent's. Returns { taxonomy, renamed, added, removed }; `removed` lists ids no longer present, which the
 * caller must refuse unless told otherwise.
 */
export function keepIds(previous, next) {
  const renamed = [];
  const added = [];
  const used = new Set();
  const match = (olds = [], news = [], parentId) => {
    const left = [...olds];
    const take = test => {
      const i = left.findIndex(test);
      return i === -1 ? null : left.splice(i, 1)[0];
    };
    const pairs = news.map(c => [c, c.code != null ? take(o => o.code === c.code) : null]);
    for (const p of pairs) if (!p[1]) p[1] = take(o => o.name === p[0].name);
    for (const p of pairs) {
      const at = news.indexOf(p[0]);
      if (!p[1]) p[1] = take(o => olds.indexOf(o) === at);
    }
    return pairs.map(([c, old]) => {
      let id = old?.id;
      if (id) {
        if (old.name !== c.name) renamed.push({ id, from: old.name, to: c.name });
      } else {
        // The builder's id (CAP: the code), under the parent's kept id; else one from the name.
        const own = c.id ? c.id.split('/').pop() : slugOf(c.name);
        id = parentId && (!c.id || c.id.includes('/')) ? `${parentId}/${own}` : own;
        while (used.has(id)) id += '-2';
        added.push(id);
      }
      used.add(id);
      return { ...c, id, ...(c.children ? { children: match(old?.children, c.children, id) } : {}) };
    });
  };
  const categories = match(previous?.categories, next.categories, null);
  const before = previous ? categoryIds(previous) : new Set();
  const removed = [...before].filter(id => !used.has(id));
  return { taxonomy: { ...next, categories }, renamed, added, removed };
}

/**
 * Write a rebuilt taxonomy to its file, keeping the ids of the categories already there (keepIds). Reports renamed and
 * added categories; refuses to drop one unless `allowRemoving`, since something may be placed in it (placements.json).
 */
export function writeTaxonomy(file, next, { allowRemoving = false, dryRun = false, newSubcategories = false } = {}) {
  const previous = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  // newSubcategories: the levels below the top come from somewhere else now, so none of their ids is matched (by
  // name or position) to the old ones; top-level ids are still kept. Needs allowRemoving.
  const matchAgainst = previous && newSubcategories ? { ...previous, categories: previous.categories.map(c => ({ ...c, children: [] })) } : previous;
  const result = keepIds(matchAgainst, next);
  const { taxonomy, renamed, added } = result;
  const removed = previous ? [...categoryIds(previous)].filter(id => !categoryIds(taxonomy).has(id)) : [];
  for (const r of renamed) console.log(`  renamed ${r.id}: "${r.from}" → "${r.to}" (id kept)`);
  if (previous && added.length) console.log(`  added ${added.length}: ${added.slice(0, 12).join(', ')}${added.length > 12 ? ', …' : ''}`);
  if (removed.length) {
    console.log(`  no longer in the source (${removed.length}): ${removed.slice(0, 12).join(', ')}${removed.length > 12 ? ', …' : ''}`);
    if (!allowRemoving) throw new Error('Category ids would be removed; re-run with --allow-removing once nothing is placed in them');
  }
  if (!dryRun) fs.writeFileSync(file, `${JSON.stringify(taxonomy, null, 2)}\n`);
  return taxonomy;
}
