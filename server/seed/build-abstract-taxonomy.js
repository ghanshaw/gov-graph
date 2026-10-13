#!/usr/bin/env node
/**
 * Build the Statistical Abstract's taxonomy for the Taxonomies page. Sections from the book itself (2012-statab.pdf in
 * the data folder): the contents (pages vii–x) give the sections, table ranges, pages, the topics listed under each, and
 * the appendices; each section's opening page gives its code (the section number) and its description (the first
 * paragraph of its introduction, "This section presents …"). Subsections are the groups each section's web page puts
 * its tables in (saved by fetch-statistical-abstract.js): the contents' topics do not divide the tables (2026-10-13).
 *   → server/seed/data/taxonomies/statistical-abstract.json
 *
 * The downloaded PDF prints Education's pages (145–192) twice and ends at page 876, so a printed page after 192 is
 * 64 file pages on, not 16. Each section's page is checked to open with "Section N".
 *
 * Usage:
 *   node server/seed/build-abstract-taxonomy.js [--dry-run] [--allow-removing] [--new-subsections]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { writeTaxonomy } from '../lib/taxonomies.js';
import { readSavedPages } from '../lib/statab.js';
import { DATA_DIR } from '../lib/data-dir.js';

const PDF = path.join(DATA_DIR, 'www2.census.gov/library/publications/2011/compendia/statab/131ed/2012-statab.pdf');
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'taxonomies', 'statistical-abstract.json');
const CONTENTS = [6, 7, 8, 9]; // file pages of the contents, printed vii–x
const filePage = printed => printed + (printed <= 192 ? 16 : 64);
const dryRun = process.argv.includes('--dry-run');
const allowRemoving = process.argv.includes('--allow-removing');
// Once only (2026-10-13): subsections moved from the contents' topics to the website's groups.
const newSubcategories = process.argv.includes('--new-subsections');

const slug = text => text.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// A page's printed lines, top to bottom; with `column`, only the left (x < 210) or right half of a two-column page.
async function pageLines(doc, number, column = null) {
  const { items } = await (await doc.getPage(number)).getTextContent();
  const rows = new Map();
  for (const i of items) {
    if (!i.str.trim()) continue;
    if (column === 'left' && i.transform[4] >= 210) continue;
    const y = Math.round(i.transform[5]);
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y).push({ x: i.transform[4], text: i.str, size: i.transform[3] });
  }
  return [...rows.entries()].sort((a, b) => b[0] - a[0]).map(([y, row]) => ({
    y,
    size: Math.max(...row.map(i => i.size)),
    text: row.sort((a, b) => a.x - b.x).map(i => i.text).join(' ').replace(/\s+/g, ' ').trim(),
  }));
}

// "Sec. 8. State and Local … Employment" may run onto a second line before "(Tables 428–468) . . . 265".
function parseContents(lines) {
  const sections = [];
  const appendices = [];
  let section = null;
  let appendix = null;
  let pending = null;
  let indexPage = null;
  const leader = /^(.*?)\s*(?:\.\s?){2,}\s*([ivx\d]+)$/;
  for (let { text } of lines) {
    if (/^(Page|Contents|\[Numbers|U\.S\. Census Bureau|[ivx]+$)/.test(text) || /—Con\.$/.test(text)) continue;
    if (pending) { text = `${pending} ${text}`; pending = null; }
    let m = text.match(/^Sec\. (\d+)\. (.*)$/);
    if (m) {
      const t = m[2].match(/^(.*?) \(Tables (\d+)–(\d+)\)\s*(?:\.\s?)+\s*(\d+)$/);
      if (!t) { pending = text; continue; }
      sections.push(section = { number: +m[1], title: t[1], tables: [+t[2], +t[3]], page: +t[4], subsections: [] });
      appendix = null;
      continue;
    }
    if ((m = text.match(/^Appendix ([IVX]+)\.$/))) {
      appendices.push(appendix = { number: m[1], parts: [] });
      section = null;
      continue;
    }
    if ((m = text.match(leader))) {
      const entry = { title: m[1], page: /^\d+$/.test(m[2]) ? +m[2] : m[2] };
      if (entry.title === 'Index') indexPage = entry.page;
      else if (appendix) appendix.parts.push(entry);
      else if (section) section.subsections.push(entry);
      continue;
    }
    if (appendix) pending = text; // an appendix title running onto a second line
  }
  return { sections, appendices, indexPage };
}

// The PDF's text layer splits some words and marks: rejoin them as printed.
const tidy = text => text
  .replace(/\s+([,.;:])/g, '$1')
  .replace(/<([^>]+)>/g, (_, url) => `<${url.replace(/\s+/g, '')}>`)
  .replace(/\bRepor t\b/g, 'Report')
  .replace(/‘‘/g, '“').replace(/’’/g, '”')
  .replace(/(\w)–\s?(\w)/g, '$1-$2')
  .trim();

// The first paragraph under "Section N" in the left column: lines no more than 12 points apart.
async function openingParagraph(doc, section) {
  const page = filePage(section.page);
  const lines = await pageLines(doc, page, 'left');
  const head = lines.find(l => /^Section \d+$/.test(l.text));
  if (head?.text !== `Section ${section.number}`) {
    throw new Error(`Section ${section.number}: file page ${page} opens with “${lines[0]?.text}”, not “Section ${section.number}”`);
  }
  const body = lines.filter(l => l.size < 9 && l.y < head.y);
  const paragraph = [body[0]];
  for (let i = 1; i < body.length && body[i - 1].y - body[i].y <= 12; i++) paragraph.push(body[i]);
  let text = '';
  for (const l of paragraph) text = /\s-$/.test(text) ? text.replace(/\s-$/, '') + l.text : text ? `${text} ${l.text}` : l.text;
  return tidy(text);
}

// The website's groups of a section (lib/statab.js), in book order: { id, name, first_table }. A table listed under two
// groups (587, 868) counts in the first.
const web = new Map(readSavedPages().sections.map(s => [s.number, s]));
function subsectionsOf(number, sectionId) {
  const s = web.get(number);
  if (!s) throw new Error(`Section ${number}: no saved page; run fetch-statistical-abstract.js`);
  const seen = new Set();
  return s.groups.map(g => ({ name: g.name ?? s.name, tables: g.tables.map(t => `${t.number}${t.suffix}`).filter(id => !seen.has(id) && seen.add(id)) }))
    .filter(g => g.tables.length)
    .map(g => ({ id: `${sectionId}/${slug(g.name)}`, name: g.name, first_table: parseInt(g.tables[0], 10) }));
}

async function run() {
  const doc = await getDocument({ data: new Uint8Array(fs.readFileSync(PDF)), verbosity: 0 }).promise;
  const lines = [];
  for (const p of CONTENTS) lines.push(...await pageLines(doc, p));
  const { sections, appendices, indexPage } = parseContents(lines);

  const categories = [];
  for (const s of sections) {
    categories.push({
      id: slug(s.title),
      code: String(s.number),
      name: s.title,
      description: await openingParagraph(doc, s),
      tables: s.tables,
      page: s.page,
      // The contents as printed (for the page's book view): selected topics and where they start. They do not divide
      // the section's tables (the mining tables have no entry), so they are not the subsections.
      contents: s.subsections.map(sub => ({ name: sub.title, page: sub.page })),
      // The subsections: the Census website's groups, which put every online table in exactly one; in book order
      // (by their first table). The page lists them alphabetically.
      children: subsectionsOf(s.number, slug(s.title)),
    });
  }
  const taxonomy = {
    id: 'statistical-abstract',
    name: 'Statistical Abstract',
    basis: 'Follows the sections of the Statistical Abstract of the United States, 2012, and the subsections the Census Bureau grouped its tables into online.',
    levels: ['section', 'subsection'],
    source: {
      title: 'Statistical Abstract of the United States: 2012 (131st edition), U.S. Census Bureau',
      url: 'https://www.census.gov/library/publications/2011/compendia/statab/131ed.html',
      read: new Date().toISOString().slice(0, 10),
      program: 'statistical-abstract',
      note: 'Sections from 2012-statab.pdf in the data folder: the contents (pages vii–x), and each section’s opening paragraph as its description; a section’s code is its number. Subsections are the groups each section’s web page lists its tables under (census.gov/…/131ed/<section>.html), in the order of their first table; every online table is in one. The contents’ own topics, which do not divide the tables, are kept as `contents` with their printed pages. That PDF prints Education twice and ends at page 876.',
      pages: 'https://www.census.gov/library/publications/2011/compendia/statab/131ed.html',
    },
    categories,
    appendices,
    index_page: indexPage,
  };

  const subsections = categories.reduce((n, c) => n + c.children.length, 0);
  console.log(`${categories.length} sections, ${subsections} subsections, ${appendices.length} appendices; index p. ${indexPage}`);
  if (sections.length !== 30 || sections.at(-1).tables[1] !== 1406) throw new Error('The contents did not read as 30 sections and 1,406 tables');
  // Category ids never change once made: the file's existing ids are kept (lib/taxonomies.js, keepIds).
  writeTaxonomy(OUT, taxonomy, { allowRemoving, dryRun, newSubcategories });
  if (!dryRun) console.log(`  → ${path.relative(process.cwd(), OUT)}`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
