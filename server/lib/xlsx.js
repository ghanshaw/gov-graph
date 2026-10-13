// Reading the first worksheet of an .xlsx file (zipped XML) as rows of strings, without a
// spreadsheet library: the Census tables we read (household income, homeownership rates) are
// plain grids of text and numbers. Uses the system `unzip`, as data-dir.js does for zips.
// Old binary .xls files are not readable here.

import { execFileSync } from 'child_process';

const unzipPart = (file, part) => {
  try {
    return execFileSync('unzip', ['-p', file, part], { maxBuffer: 256 * 1024 * 1024 }).toString('utf8');
  } catch {
    return '';
  }
};

const XML_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unescape = text => text.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi, (m, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
  return XML_ENTITIES[e.toLowerCase()];
});

/** The text of every <t> in a fragment (a shared string may be split into rich-text runs). */
const textOf = xml => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m => unescape(m[1])).join('');

/** "AB" → 27 (0-based column index 27). */
function columnIndex(ref) {
  let n = 0;
  for (const ch of ref.replace(/\d+$/, '')) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** A worksheet's part in the zip, by its tab name (workbook.xml → workbook.xml.rels). */
function sheetPart(file, name) {
  const workbook = unzipPart(file, 'xl/workbook.xml');
  const sheet = [...workbook.matchAll(/<sheet\b([^>]*)\/>/g)].find(m => unescape(/\bname="([^"]*)"/.exec(m[1])?.[1] ?? '') === name);
  const rid = sheet && /\br:id="([^"]*)"/.exec(sheet[1])?.[1];
  if (!rid) throw new Error(`${file}: no worksheet "${name}"`);
  const rels = unzipPart(file, 'xl/_rels/workbook.xml.rels');
  const target = [...rels.matchAll(/<Relationship\b([^>]*)\/>/g)].map(m => m[1]).find(a => a.includes(`Id="${rid}"`));
  const to = /\bTarget="([^"]*)"/.exec(target ?? '')?.[1];
  if (!to) throw new Error(`${file}: no part for worksheet "${name}"`);
  return to.startsWith('/') ? to.slice(1) : `xl/${to}`;
}

/** The names of a workbook's worksheets, in tab order. */
export function xlsxSheetNames(file) {
  return [...unzipPart(file, 'xl/workbook.xml').matchAll(/<sheet\b[^>]*\bname="([^"]*)"/g)].map(m => unescape(m[1]));
}

/**
 * A worksheet → rows (arrays of trimmed strings; empty cells are ''). The first worksheet unless
 * `sheetName` names another (CBO's workbooks hold a table per tab).
 */
export function readXlsx(file, sheetName = null) {
  const shared = [...unzipPart(file, 'xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => textOf(m[1]));
  const sheet = unzipPart(file, sheetName ? sheetPart(file, sheetName) : 'xl/worksheets/sheet1.xml');
  if (!sheet) throw new Error(`${file}: no worksheet ${sheetName ? `"${sheetName}"` : '1'}`);
  const rows = [];
  for (const row of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [];
    for (const cell of row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cell[1];
      const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1];
      const type = /\bt="(\w+)"/.exec(attrs)?.[1];
      const body = cell[2] ?? '';
      const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let value = '';
      if (type === 's') value = shared[Number(raw)] ?? '';
      else if (type === 'inlineStr') value = textOf(body);
      else if (raw !== undefined) value = unescape(raw);
      cells[ref ? columnIndex(ref) : cells.length] = value.trim();
    }
    rows.push(Array.from(cells, c => c ?? ''));
  }
  return rows;
}
