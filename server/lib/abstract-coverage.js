// Phase 3 of the Statistical Abstract (features/statistical-abstract): for each table, the programs its
// source note names and how much of them GovGraph holds. Written by hand in
// seed/data/statistical-abstract-coverage.json, a section at a time; checked here against the tables
// (statistical-abstract-tables.json) and the sources (sources.json).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
};
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
    if (c.coverage === 'unpublished' ? c.programs?.length : !c.programs?.length) problems.push(`${name}: ${c.coverage === 'unpublished' ? 'unpublished, but names programs' : 'no programs'}`);
    const found = (c.programs ?? []).map(slug => bySlug.get(slug) ?? problems.push(`${name}: unknown program ${slug}`)).filter(p => typeof p === 'object');
    const licensed = found.some(p => p.licence?.type === 'licensed');
    if ((c.coverage === 'licensed') !== licensed) problems.push(`${name}: coverage licensed only for a licensed program`);
    if (['have', 'partly'].includes(c.coverage) && !found.some(p => p.collected !== false)) problems.push(`${name}: ${c.coverage}, but no program is collected`);
    if (['partly', 'discontinued', 'unpublished'].includes(c.coverage) && !c.note) problems.push(`${name}: ${c.coverage} needs a note`);
    if (c.in_hand && !found.some(p => p.collected !== false)) problems.push(`${name}: in hand, but no program is collected`);
  }
  return problems;
}

/** Programs cited by the covered tables, each with its table ids. */
export function tablesByProgram({ tables: covered }) {
  const out = new Map();
  for (const [id, c] of Object.entries(covered)) for (const slug of c.programs) out.set(slug, [...(out.get(slug) ?? []), id]);
  return out;
}
