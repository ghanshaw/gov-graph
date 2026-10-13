// The Statistical Abstract of the United States, 2012 (131st edition), as the Census Bureau left it online
// (features/statistical-abstract, Phase 2): the index page, one page per section listing its tables under
// headings, and every table as a binary Excel file (12sNNNN.xls). Read here; fetched by
// seed/fetch-statistical-abstract.js and written to a file by seed/build-abstract-tables.js.

import fs from 'fs';
import path from 'path';
import { mirrorFile } from './data-dir.js';
import { readXls } from './xls.js';
import { readXlsx } from './xlsx.js';

export const PAGES = 'https://www.census.gov/library/publications/2011/compendia/statab/131ed';
export const INDEX_URL = `${PAGES}.html`;
export const FILES = 'https://www2.census.gov/library/publications/2011/compendia/statab/131ed/';

// Pages linked from the index that are not sections of the book: kept, but they hold no tables of their own.
export const OTHER_PAGES = ['brief', 'fed-reports', 'guide-to-sources', 'maps', 'rankings', 'st-abstracts'];

export const pageUrl = slug => `${PAGES}/${slug}.html`;
export const pageFile = slug => mirrorFile(pageUrl(slug));

const decode = s => s
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&#39;|&rsquo;|&#8217;/g, '’').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
  .replace(/&ndash;/g, '–').replace(/&mdash;/g, '—').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ').trim();

const absolute = href => new URL(href, PAGES + '/').href;

/** The index page → the slugs of the pages it links (sections and others) and the files (PDFs) it links. */
export function parseIndexPage(html) {
  const slugs = [...new Set([...html.matchAll(/href="\/library\/publications\/2011\/compendia\/statab\/131ed\/([a-z0-9-]+)\.html"/g)].map(m => m[1]))];
  return {
    sections: slugs.filter(s => !OTHER_PAGES.includes(s)),
    others: slugs.filter(s => OTHER_PAGES.includes(s)),
    files: filesLinked(html),
  };
}

/** Every file under 131ed/ that a page links, as absolute URLs, in page order. */
export function filesLinked(html) {
  return [...new Set([...html.matchAll(/href="((?:https?:)?\/\/www2\.census\.gov\/library\/publications\/2011\/compendia\/statab\/131ed\/[^"]+)"/g)]
    .map(m => absolute(m[1])))];
}

const TABLE_FILE = /\/tables\/12s(\d{4})([a-z]*)\.xlsx?$/i;

/**
 * A section page → { number, name, groups: [{ name, position, tables: [{ number, suffix, title, url }] }],
 * files }. Groups are listed alphabetically on the page; `position` is their order in the book, by their
 * first table.
 */
export function parseSectionPage(html) {
  const tokens = [...html.matchAll(/<h[1-3][^>]*class="[^"]*cmp-title__text[^"]*"[^>]*>([\s\S]*?)<\/h[1-3]>|<a[^>]*class="[^"]*uscb-list-attachment__title[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>|<a[^>]*href="([^"]+)"[^>]*class="[^"]*uscb-list-attachment__title[^"]*"[^>]*>([\s\S]*?)<\/a>/g)];
  let heading = null;
  let current = null;
  const groups = [];
  for (const t of tokens) {
    if (t[1] !== undefined) {
      const text = decode(t[1]);
      const section = text.match(/^Section (\d+)\.\s*(.+)$/);
      if (section) { heading ??= { number: Number(section[1]), name: section[2] }; current = null; continue; }
      current = { name: text, tables: [] };
      groups.push(current);
      continue;
    }
    const href = t[2] ?? t[4];
    const label = decode(t[3] ?? t[5]);
    const url = absolute(href);
    const file = url.match(TABLE_FILE);
    if (!file) continue;
    const m = label.match(/^(\d+)([A-Za-z]*)\s*[-–]\s*(.+)$/);
    if (!current) { current = { name: null, tables: [] }; groups.push(current); }
    current.tables.push({ number: Number(file[1]), suffix: file[2].toLowerCase(), title: m ? m[3] : label, url });
  }
  if (!heading) throw new Error('no "Section N." heading on the page');
  const withTables = groups.filter(s => s.tables.length);
  const first = s => Math.min(...s.tables.map(t => t.number));
  withTables.sort((a, b) => first(a) - first(b)).forEach((s, i) => { s.position = i + 1; });
  return { ...heading, groups: withTables, files: filesLinked(html) };
}

// ---------------------------------------------------------------------------
// A table file. Each keeps the printed table's layout, in the same order:
//   0  a description for screen readers: "Table with row headers in column A and column headers in rows 4 through 6."
//   1  "Table 973. Price Indexes of New One-Family Houses Sold, by Region: 1990 to 2010"
//   2  the headnote, in brackets
//      the column heads (the rows the description names), then the body: row labels in column A ("..": one level in)
//      symbols ("X Not applicable."), "FOOTNOTES:" with "\1 …" lines, "Source: …", "For more information:" with
//      links, and "Internet release date: …".

const line = r => r.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

/** "rows 4 through 6" / "rows 4 and 5" / "row 4" → [4, 6] (1-based, as the description counts). */
function headRows(description) {
  const m = description?.match(/column headers? in rows? (\d+)(?:\s*(?:through|to|and|-)\s*(\d+))?/i);
  return m ? [Number(m[1]), Number(m[2] ?? m[1])] : null;
}

// A symbol's line in the foot: "X Not applicable.", "NA Not available.", "- Represents zero.", "Z Less than …".
const SYMBOL = /^(\(?[A-Z]{1,2}\)?|-|—|\(-\)|\*+)\s+[A-Z][a-z]/;

const STATES = ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia',
  'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York',
  'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'];

/**
 * The rows of a table file → { number, suffix, title, headnote, columnHeads, stub, symbols, footnotes, source,
 * moreInfo, released, years, rows, columns }. `title` is the file's own without "Table N."; `stub` the row labels
 * of the body, with their depth; `years` the lowest and highest year from 1790 to 2100 named in the title,
 * headnote, column heads or row labels, and `yearCount` how many distinct years; `byState` whether the row labels
 * are the states (45 or more of them).
 */
export function readTableRows(rows) {
  const lines = rows.map(line);
  const titleAt = lines.findIndex(l => /^Table\.?\s*\d+[A-Za-z]*\.?\s/i.test(l));
  if (titleAt === -1) throw new Error('no "Table N." row');
  const [, number, suffix, title] = lines[titleAt].match(/^Table\.?\s*(\d+)([A-Za-z]*)\.?\s*(.*)$/i);
  const description = titleAt > 0 ? lines.slice(0, titleAt).join(' ') : null;

  // The headnote runs from "[" to "]", but never into the column heads (some files leave off the "]").
  const head = headRows(description);
  let at = titleAt + 1;
  let headnote = null;
  if (lines[at]?.startsWith('[')) {
    const last = head ? head[0] - 2 : at + 2;
    const parts = [];
    for (; at < lines.length && at <= last; at++) {
      parts.push(lines[at]);
      if (/\]\.?$/.test(lines[at])) { at++; break; }
    }
    headnote = parts.join(' ').replace(/^\[|\]\.?$/g, '').trim();
  }

  // The foot starts at the first symbol line, "FOOTNOTES:", "Source:" or "For more information:" after the body.
  const isFoot = l => /^(FOOTNOTES?\b|Sources?:|For more information|Internet release date|Note:|Notes:)/i.test(l);
  let footAt = lines.findIndex((l, i) => i >= at && isFoot(l));
  if (footAt === -1) footAt = lines.length;
  while (footAt > at && (!lines[footAt - 1] || SYMBOL.test(lines[footAt - 1]) && rows[footAt - 1].filter(Boolean).length === 1)) footAt--;

  const headEnd = head ? head[1] : at; // the description counts rows from 1, so its last head row is index head[1] - 1
  const columnHeads = (head ? rows.slice(head[0] - 1, head[1]) : []).map(r => r.filter(Boolean));
  const stub = rows.slice(Math.max(at, headEnd), footAt)
    .map(r => r[0] ?? '').filter(Boolean)
    .map(label => {
      const dots = label.match(/^\.*/)[0].length;
      return { label: label.slice(dots).trim(), depth: Math.floor(dots / 2) };
    });

  const foot = lines.slice(footAt).filter(Boolean);
  const symbols = [];
  const footnotes = [];
  const notes = [];
  const moreInfo = [];
  let source = null;
  let released = null;
  let part = 'symbols';
  for (const l of foot) {
    if (/^FOOTNOTES?:?$/i.test(l)) { part = 'footnotes'; continue; }
    if (/^For more information/i.test(l)) { part = 'more'; continue; }
    const r = l.match(/^Internet release date:?\s*(.*)$/i);
    if (r) { released = r[1].trim(); part = 'done'; continue; }
    const src = l.match(/^Sources?:\s*(.*)$/i);
    if (src) { source = src[1]; part = 'source'; continue; }
    if (part === 'more') moreInfo.push(l);
    else if (part === 'source') source += ` ${l}`;
    else if (part === 'footnotes') {
      if (/^\\\d+/.test(l) || !footnotes.length) footnotes.push(l.replace(/^\\(\d+)\s*/, '$1 '));
      else footnotes[footnotes.length - 1] += ` ${l}`;
    } else if (/^Notes?:/i.test(l)) notes.push(l.replace(/^Notes?:\s*/i, ''));
    else symbols.push(l);
  }

  const named = [title, headnote, ...columnHeads.flat(), ...stub.map(s => s.label)].join(' ');
  const years = [...named.matchAll(/\b(1[789]\d\d|20\d\d)\b/g)].map(m => Number(m[1])).filter(y => y >= 1790 && y <= 2100);

  const distinct = new Set(years);
  const labels = new Set(stub.map(x => x.label.replace(/\s*\\\d+$/, '')));

  return {
    number: Number(number),
    suffix: suffix.toLowerCase(),
    title,
    description,
    headnote,
    columnHeads,
    stub,
    symbols,
    footnotes,
    notes,
    source,
    moreInfo,
    released,
    years: years.length ? [Math.min(...years), Math.max(...years)] : null,
    yearCount: distinct.size,
    byState: STATES.filter(x => labels.has(x)).length >= 45,
    rows: rows.length,
    columns: Math.max(0, ...rows.map(r => r.length)),
  };
}

/** A table file in the data folder → readTableRows of its first sheet. */
export function readTableFile(file) {
  // A few are Excel 2007 workbooks (a zip) under the .xls name.
  const zip = fs.readFileSync(file).subarray(0, 2).toString() === 'PK';
  return readTableRows(zip ? readXlsx(file) : readXls(file));
}

// ---------------------------------------------------------------------------
// A section's PDF: the printed pages, each with its page number in the running foot ("Construction and Housing 603",
// "604 Construction and Housing"), and every table's heading ("Table 961. Construction—Establishments, …"). Gives each
// table its printed page, which places it in the book's subsections (their pages come from the contents), and lists
// tables the website does not (966 and 967 are printed, not linked).

/** The section's own PDF among the files its page links (not a single table's, such as 12s0697.pdf). */
export const sectionPdf = files => files.find(f => /\/tables\/[a-z]+\.pdf$/.test(f)) ?? null;

/** The printed page number in a page's foot, or null. */
function printedPage(lines) {
  for (const l of lines.slice(-4).reverse()) {
    // The credit line is sometimes set on the same line ("792 Foreign Commerce and Aid U.S. Census Bureau, …").
    const text = l.text.replace(/\s*U\.S\. Census Bureau, Statistical Abstract of the United States.*$/i, '').trim();
    const m = text.match(/^(\d{1,4})\s+\D/) ?? text.match(/\D\s+(\d{1,4})$/);
    if (m) return Number(m[1]);
  }
  return null;
}

/**
 * A section PDF's pages (pdf-lines.js, extractPdfLines) → its tables: [{ number, suffix, title, page }], in
 * print order. A heading runs on over the lines below it until the headnote ("[") or a line in another type size.
 * Headings are "Table 961. …", sometimes "Table. 553. …", or the bare number ("1158. …") where "Table" was set apart;
 * a bare number counts only inside the section's `range` of table numbers ([first, last], from the contents).
 */
export function readSectionPdfLines(pages, range = null) {
  const tables = [];
  for (const p of pages) {
    const page = printedPage(p.lines);
    p.lines.forEach((l, i) => {
      let m = l.text.match(/^Table\.?\s*(\d+)([A-Za-z]?)\.\s+(.*)$/);
      if (!m && range) {
        m = l.text.match(/^(\d{1,4})([A-Za-z]?)\.\s+([A-Z].*)$/);
        if (m && (Number(m[1]) < range[0] || Number(m[1]) > range[1])) m = null;
      }
      if (!m) return;
      let title = m[3].trim();
      for (let j = i + 1; j < Math.min(p.lines.length, i + 3); j++) {
        const next = p.lines[j];
        if (next.size !== l.size || /^\[|^Table\s+\d/.test(next.text)) break;
        title += ` ${next.text.trim()}`;
      }
      // A table continued onto another page is printed again ("—Con."); its first page is kept.
      if (tables.some(t => t.number === Number(m[1]) && t.suffix === m[2].toLowerCase())) return;
      // The headnote can be set on the heading's line ("…: 1975 to 2010[In quadrillion …").
      title = title.split('[')[0];
      tables.push({ number: Number(m[1]), suffix: m[2].toLowerCase(), title: title.replace(/\s+/g, ' ').trim(), page });
    });
  }
  return tables;
}

/**
 * Where a printed page falls in a section of the book's taxonomy (taxonomies/statistical-abstract.json): the last
 * subsection starting on or before it, or the section itself for the pages before its first subsection.
 */
export function categoryAt(section, page) {
  let at = section.id;
  for (const sub of section.children ?? []) if (page != null && sub.page <= page) at = sub.id;
  return at;
}

/** Every saved page (index, then sections in the index's order) → parsed; missing pages are skipped. */
export function readSavedPages() {
  const indexFile = mirrorFile(INDEX_URL);
  if (!fs.existsSync(indexFile)) throw new Error(`${path.relative(process.cwd(), indexFile)}: fetch the Abstract first`);
  const index = parseIndexPage(fs.readFileSync(indexFile, 'utf8'));
  const sections = index.sections
    .filter(slug => fs.existsSync(pageFile(slug)))
    .map(slug => ({ slug, url: pageUrl(slug), ...parseSectionPage(fs.readFileSync(pageFile(slug), 'utf8')) }));
  return { index, sections };
}
