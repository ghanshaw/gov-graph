// Phase 3 of the Statistical Abstract (features/statistical-abstract): for each table, the programs its
// source note names and how much of them GovGraph holds. Written by hand in
// seed/data/statistical-abstract-coverage.json, a section at a time; checked here against the tables
// (statistical-abstract-tables.json) and the sources (sources.json).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { nipaTable } from './nipa-series.js';
import { cpsTable } from './cps-series.js';

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'seed', 'data');
const read = name => JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8'));

export const readCoverage = () => read('statistical-abstract-coverage.json');
export const readAbstractTables = () => read('statistical-abstract-tables.json').tables;

export const COVERAGE = {
  have: 'Have', // every series the table prints is loaded, as its publisher prints it today
  partly: 'Partly', // some are
  wanted: 'Wanted', // none are; the publisher still prints it
  licensed: 'Licensed', // sold or restricted: listed, not collected (user, 2026-10-13)
  discontinued: 'Discontinued', // the publisher stopped; the note names any successor
  unpublished: 'Unpublished', // the source note cites unpublished data: nothing to collect, no program
  compiled: 'Compiled', // the Abstract compiled it from sources named in its footnotes, still to be traced; no program yet
};
const NO_PROGRAM = ['unpublished', 'compiled'];
export const SHAPES = {
  'time-series': 'Time series', // years (or months) down the side
  'by-place': 'By place', // states, cities or countries, for one year or several
  snapshot: 'Snapshot', // one year broken down by something other than place
};

/** Every problem in the coverage file, as sentences; [] when it is sound. */
export function checkCoverage({ sections, tables: covered }, tables, programs) {
  const problems = [];
  const bySlug = new Map(programs.map(p => [p.slug, p]));
  const byId = new Map(tables.map(t => [t.id, t]));
  for (const t of tables) {
    if (sections.includes(t.section) && !covered[t.id]) problems.push(`table ${t.id}: section ${t.section} is done, but the table is not covered`);
  }
  for (const [id, c] of Object.entries(covered)) {
    const name = `table ${id}`;
    const table = byId.get(id);
    if (!table) { problems.push(`${name}: no such table`); continue; }
    if (!sections.includes(table.section)) problems.push(`${name}: its section ${table.section} is not in sections`);
    if (!COVERAGE[c.coverage]) problems.push(`${name}: unknown coverage ${c.coverage}`);
    if (!SHAPES[c.shape]) problems.push(`${name}: unknown shape ${c.shape}`);
    const none = NO_PROGRAM.includes(c.coverage);
    if (none ? c.programs?.length : !c.programs?.length) problems.push(`${name}: ${none ? `${c.coverage}, but names programs` : 'no programs'}`);
    const found = (c.programs ?? []).map(slug => bySlug.get(slug) ?? problems.push(`${name}: unknown program ${slug}`)).filter(p => typeof p === 'object');
    const licensed = found.some(p => p.licence?.type === 'licensed');
    if ((c.coverage === 'licensed') !== licensed) problems.push(`${name}: coverage licensed only for a licensed program`);
    if (['have', 'partly'].includes(c.coverage) && !found.some(p => p.collected !== false)) problems.push(`${name}: ${c.coverage}, but no program is collected`);
    if (['partly', 'discontinued', ...NO_PROGRAM].includes(c.coverage) && !c.note) problems.push(`${name}: ${c.coverage} needs a note`);
    if (c.in_hand && !found.some(p => p.collected !== false)) problems.push(`${name}: in hand, but no program is collected`);
    // What is loaded is named for the tables that have some of it, and only for them.
    const held = ['have', 'partly'].includes(c.coverage);
    if (held && !c.series?.length) problems.push(`${name}: ${c.coverage}, but no series named`);
    if (!held && c.series) problems.push(`${name}: series named, but coverage is ${c.coverage}`);
    for (const s of c.series ?? []) {
      if (/^nipa:T/.test(s)) { if (!nipaTable(s.slice(5))) problems.push(`${name}: ${s} is not a NIPA table GovGraph collects (lib/nipa-series.js)`); }
      else if (/^cps:\d+$/.test(s)) { if (!cpsTable(s.slice(4))) problems.push(`${name}: ${s} has no series in cps-series.json (lib/cps-series.js)`); }
      else if (!/^[a-z0-9-]+(--\*)?$/.test(s)) problems.push(`${name}: series ${s} is not a slug, a measure, a prefix--*, nipa:<table> or cps:<table>`);
    }
  }
  return problems;
}

/** Programs cited by the covered tables, each with its table ids. */
export function tablesByProgram({ tables: covered }) {
  const out = new Map();
  for (const [id, c] of Object.entries(covered)) for (const slug of c.programs) out.set(slug, [...(out.get(slug) ?? []), id]);
  return out;
}

const FILES = ['statistical-abstract-coverage.json', 'statistical-abstract-tables.json', 'taxonomies/statistical-abstract.json'];
let cache = null;

/**
 * Every table of the Abstract with its coverage, in book order, and the sections with their subsections' names:
 * { sections: [{ number, id, name }], tables: [{ id, section, sectionName, category, categoryName, page, title, online, url,
 * coverage, shape, inHand, note, programs }], byProgram: Map(slug → tables) }. Read from the files (nothing is in the
 * database) and kept until one of them changes.
 */
export function coverageReport() {
  const stamp = FILES.map(f => fs.statSync(path.join(DATA, f)).mtimeMs).join();
  if (cache?.stamp === stamp) return cache;
  const { tables: covered } = readCoverage();
  const taxonomy = read('taxonomies/statistical-abstract.json');
  const names = new Map(taxonomy.categories.flatMap(s => [[s.id, s.name], ...(s.children ?? []).map(c => [c.id, c.name])]));
  const sectionNames = new Map(taxonomy.categories.map(s => [Number(s.code), s.name]));
  const tables = readAbstractTables().map(t => {
    const c = covered[t.id] ?? {};
    return {
      id: t.id, section: t.section, sectionName: sectionNames.get(t.section) ?? null,
      category: t.category, categoryName: names.get(t.category) ?? null, page: t.page,
      title: t.title, online: t.online, url: t.url ?? null,
      coverage: c.coverage ?? null, shape: c.shape ?? null, inHand: Boolean(c.in_hand), note: c.note ?? null, programs: c.programs ?? [],
      series: c.series ?? [],
    };
  }).sort((a, b) => Number(a.id) - Number(b.id));
  const byProgram = new Map();
  for (const t of tables) for (const slug of t.programs) byProgram.set(slug, [...(byProgram.get(slug) ?? []), t]);
  const sections = taxonomy.categories.map(s => ({ number: Number(s.code), id: s.id, name: s.name }));
  cache = { stamp, sections, tables, byProgram };
  return cache;
}
