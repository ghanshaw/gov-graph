#!/usr/bin/env node
/**
 * Build server/seed/data/statistical-abstract-tables.json: every table of the 2012 Statistical Abstract, as evidence
 * (GLOSSARY.md: tables are never shown as data). It says where series belong (a table's place in the book's
 * subsections) and what to collect (its source note). Read from what seed/fetch-statistical-abstract.js saved:
 *
 * - the section pages: which tables the website links, and their files;
 * - each table's file: its source note (lib/statab.js, readTableFile);
 * - each section's PDF: every table's printed page, and so its `category` in the book's taxonomy
 *   (taxonomies/statistical-abstract.json): the last subsection starting on or before the page, or the section itself
 *   before its first subsection. The PDF also lists tables the website does not link (`online: false`).
 *
 *   node server/seed/build-abstract-tables.js [--dry-run]
 *
 * Nothing goes in the database. Re-running rewrites the file from the data folder.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { mirrorFile } from '../lib/data-dir.js';
import { readSavedPages, readTableFile, sectionPdf, readSectionPdfLines, categoryAt } from '../lib/statab.js';
import { extractPdfLines } from '../lib/pdf-lines.js';

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');
const OUT = path.join(DATA, 'statistical-abstract-tables.json');
const DRY_RUN = process.argv.includes('--dry-run');

const book = JSON.parse(fs.readFileSync(path.join(DATA, 'taxonomies', 'statistical-abstract.json'), 'utf8'));
const bookSection = new Map(book.categories.map(c => [Number(c.code), c]));

const { sections } = readSavedPages();
const tables = new Map();
const note = (id, text) => { const t = tables.get(id); t.notes = [...(t.notes ?? []), text]; };

// The website's tables and their files.
for (const s of sections) {
  for (const group of s.groups) {
    for (const t of group.tables) {
      const id = `${t.number}${t.suffix}`;
      if (tables.has(id)) continue; // listed under two of the website's headings (587, 868)
      tables.set(id, { id, section: s.number, category: null, page: null, title: t.title, online: true, url: t.url, source: null });
      const file = mirrorFile(t.url);
      if (!fs.existsSync(file)) { note(id, 'file not downloaded'); continue; }
      try {
        const f = readTableFile(file);
        tables.get(id).source = f.source;
        if (f.number !== t.number) note(id, `the file is headed Table ${f.number}${f.suffix}`);
        if (!f.source) note(id, 'the file has no source note');
      } catch (err) {
        note(id, `file not read: ${err.message}`);
      }
    }
  }
}

// Printed pages, the book's categories, and the tables printed but not linked.
for (const s of sections) {
  const section = bookSection.get(s.number);
  const url = sectionPdf(s.files);
  if (!url || !fs.existsSync(mirrorFile(url))) { console.log(`  Section ${s.number}: no PDF`); continue; }
  const printed = readSectionPdfLines(await extractPdfLines(fs.readFileSync(mirrorFile(url))), section.tables);
  for (const p of printed) {
    const id = `${p.number}${p.suffix}`;
    if (!tables.has(id)) tables.set(id, { id, section: s.number, category: null, page: null, title: p.title, online: false, url: null, source: null });
    Object.assign(tables.get(id), { page: p.page, title: p.title, category: categoryAt(section, p.page) });
  }
  for (const t of tables.values()) {
    if (t.section === s.number && !printed.some(p => `${p.number}${p.suffix}` === t.id)) note(t.id, 'not found in the section PDF');
  }
}

const list = [...tables.values()].sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10) || a.id.localeCompare(b.id));
for (const t of list) if (!t.online) delete t.url;

// Report: per section, tables per category of the book.
for (const s of sections) {
  const section = bookSection.get(s.number);
  const mine = list.filter(t => t.section === s.number);
  const counts = [section, ...section.children].map(c => [c === section ? '(section)' : c.name, mine.filter(t => t.category === c.id).length])
    .filter(([, n]) => n);
  const printedOnly = mine.filter(t => !t.online).map(t => t.id);
  console.log(`${String(s.number).padStart(2)}. ${s.name}: ${mine.length} tables${printedOnly.length ? ` (printed only: ${printedOnly.join(', ')})` : ''}`);
  console.log(`    ${counts.map(([name, n]) => `${name} ${n}`).join('; ')}`);
}
const noted = list.filter(t => t.notes);
console.log(`${list.length} tables; ${list.filter(t => t.online).length} on the website; ${list.filter(t => t.source).length} source notes; ${list.filter(t => t.page == null).length} without a page; ${noted.length} with notes:`);
for (const t of noted) console.log(`  ${t.id}: ${t.notes.join('; ')}`);

if (DRY_RUN) process.exit(0);
// One table per line, so changes read well in git.
const about = 'Every table of the Statistical Abstract of the United States, 2012, as evidence: where series belong (`category`, '
  + 'the book\'s subsection by printed page; taxonomies/statistical-abstract.json) and what to collect (`source`, the table\'s '
  + 'source note). `online` false: printed in the book, not linked on the website. Built by server/seed/build-abstract-tables.js '
  + 'from the files in the data folder; never edited by hand. See GLOSSARY.md and features/statistical-abstract.';
fs.writeFileSync(OUT, `{\n  "about": ${JSON.stringify(about)},\n  "tables": [\n${list.map(t => `    ${JSON.stringify(t)}`).join(',\n')}\n  ]\n}\n`);
console.log(`→ ${path.relative(process.cwd(), OUT)} (${(fs.statSync(OUT).size / 1e3).toFixed(0)} KB)`);
