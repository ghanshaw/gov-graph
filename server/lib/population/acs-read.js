// One ACS table for one geography, read from the summary files on disk (see acs.js for their
// layout). Each year is indexed once: its geographies (nation, states, congressional districts)
// and, for the sequence years, its lookup.

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import * as XLSX from 'xlsx';
import NodeCache from 'node-cache';
import { ROOT } from './files.js';
import { ACS_TABLES, ACS_SUMLEVELS, ACS_SEQUENCE_YEARS, ACS_TABLE_YEARS } from './sources.js';
import { LOOKUP_PATHS, readLookup, parseGeoLine, congressOf } from './acs.js';

const BASE = path.join(ROOT, 'programs-surveys', 'acs', 'summary_file');
const years = new Map(); // year → index
const files = new NodeCache({ stdTTL: 900, useClones: false, maxKeys: 60 }); // parsed data files

const walk = (dir, out = []) => {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
};

// "Congressional District 1 (116th Congress), California"; the nation; "California"
const geography = (geoid, name, sumlev) => ({
  geoid, name, level: ACS_SUMLEVELS[sumlev], congress: sumlev === '500' ? congressOf(name) : null,
});

function sequenceYear(year) {
  const dir = path.join(BASE, String(year));
  const all = walk(dir);
  const lookupFile = path.join(BASE, LOOKUP_PATHS[year]);
  if (!fs.existsSync(lookupFile)) return null;
  const { tables } = readLookup(fs.readFileSync(lookupFile), lookupFile, XLSX);

  // 2005 lists no row labels: they are taken from 2006 where the table has as many cells.
  if (year === 2005) {
    const next = path.join(BASE, LOOKUP_PATHS[2006]);
    if (fs.existsSync(next)) {
      const later = readLookup(fs.readFileSync(next), next, XLSX).tables;
      for (const t of tables.values()) {
        const match = later.get(t.id);
        if (match && match.cells === t.cells) {
          t.lines = match.lines;
          t.universe = match.universe;
          t.labelsFrom = 2006;
        }
      }
    }
  }

  const geos = new Map();
  for (const file of all.filter(f => /(^|\/)g\d{5}[a-z]{2}\.txt$|geo\.\d{4}-1yr$/i.test(f))) {
    const folder = path.dirname(file);
    for (const line of fs.readFileSync(file, 'latin1').split(/\r?\n/)) {
      const g = parseGeoLine(line);
      if (!ACS_SUMLEVELS[g.sumlev] || g.component !== '00' || !g.geoid) continue;
      // The nation appears in every state's file too; the U.S. folder's copy is the one kept.
      if (geos.has(g.geoid) && g.sumlev === '010' && !/united|0us|\/us$/i.test(folder)) continue;
      geos.set(g.geoid, { ...geography(g.geoid, g.name, g.sumlev), folder, logrecno: g.logrecno });
    }
  }
  const zips = all.filter(f => /\.zip$/i.test(f));
  return { year, kind: 'sequence', tables, geos, zips };
}

// The shells file: one line per table row, "Table ID|Line Number|Indent|Label|…" (pipe-separated,
// with a header). Its exact columns are read from that header.
function readShells(file) {
  const tables = new Map();
  if (!fs.existsSync(file)) return tables;
  const lines = fs.readFileSync(file, 'latin1').split(/\r?\n/).filter(Boolean);
  const head = lines[0].split('|').map(h => h.toLowerCase().replace(/[^a-z]/g, ''));
  const at = (...names) => head.findIndex(h => names.includes(h));
  const c = { table: at('tableid'), line: at('line', 'linenumber', 'order'), indent: at('indent'), label: at('label', 'stub', 'title'), unique: at('uniqueid') };
  for (const raw of lines.slice(1)) {
    const f = raw.split('|');
    const id = f[c.table];
    if (!id) continue;
    if (!tables.has(id)) tables.set(id, { id, title: null, universe: null, lines: [] });
    const t = tables.get(id);
    const lineNo = Number(f[c.line]);
    const label = f[c.label]?.trim() ?? '';
    if (!lineNo) {
      if (/^universe:/i.test(label)) t.universe = label.replace(/^universe:\s*/i, '');
      else if (!t.title && label) t.title = label;
      continue;
    }
    t.lines.push({ line: lineNo, label, indent: Number(f[c.indent]) || 0, cell: true });
  }
  return tables;
}

function tableYear(year) {
  const dir = path.join(BASE, String(year), 'table-based-SF');
  const geoFile = path.join(dir, 'documentation', `Geos${year}1YR.txt`);
  if (!fs.existsSync(geoFile)) return null;
  const lines = fs.readFileSync(geoFile, 'latin1').split(/\r?\n/).filter(Boolean);
  const head = lines[0].split('|');
  const ci = name => head.indexOf(name);
  const geos = new Map();
  for (const l of lines.slice(1)) {
    const f = l.split('|');
    const sumlev = f[ci('SUMLEVEL')];
    if (!ACS_SUMLEVELS[sumlev] || f[ci('COMPONENT')] !== '00') continue;
    const geoid = f[ci('GEO_ID')];
    geos.set(geoid, geography(geoid, f[ci('NAME')], sumlev));
  }
  const shells = readShells(path.join(dir, 'documentation', `ACS${year}1YR_Table_Shells.txt`));
  return { year, kind: 'table', dir, geos, shells };
}

function yearIndex(year) {
  if (!years.has(year)) {
    const index = ACS_SEQUENCE_YEARS.includes(year) ? sequenceYear(year) : ACS_TABLE_YEARS.includes(year) ? tableYear(year) : null;
    years.set(year, index);
  }
  return years.get(year);
}

/** Years with files on disk, and for each the tables it has. */
export function acsYears() {
  return [...ACS_SEQUENCE_YEARS, ...ACS_TABLE_YEARS].map(year => {
    const index = yearIndex(year);
    if (!index) return null;
    const tables = ACS_TABLES.filter(([id]) => (index.kind === 'sequence'
      ? index.tables.has(id) && index.tables.get(id).parts.length
      : fs.existsSync(path.join(index.dir, 'data', '1YRData', `acsdt1y${year}-${id.toLowerCase()}.dat`))))
      .map(([id]) => id);
    return { year, geographies: index.geos.size, tables };
  }).filter(Boolean);
}

/** A year's nation, states and districts: [{ geoid, name, level, congress }] */
export function acsGeographies(year) {
  const index = yearIndex(year);
  if (!index) return [];
  return [...index.geos.values()].map(({ geoid, name, level, congress }) => ({ geoid, name, level, congress }));
}

// Rows of a comma- or pipe-separated data file by key (logical record number or GEO_ID).
function rowsOf(key, read, keyOf) {
  let rows = files.get(key);
  if (!rows) {
    rows = new Map();
    for (const line of read().split(/\r?\n/)) {
      if (!line) continue;
      const k = keyOf(line);
      if (k != null) rows.set(k, line);
    }
    // The cache holds at most maxKeys files; the oldest gives way (node-cache refuses a new key when full).
    if (files.keys().length >= files.options.maxKeys) files.del(files.keys()[0]);
    files.set(key, rows);
  }
  return rows;
}

// The entries of each zip, listed once.
const listings = new Map();
const zipEntries = zip => {
  if (!listings.has(zip)) listings.set(zip, execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).split('\n').filter(Boolean));
  return listings.get(zip);
};

function sequenceRow(index, geo, sequence, which) {
  // Sequence zips: 20091ca0001000.zip (2006–), ca0000001.2005-1yr.zip (2005)
  const zip = index.zips.find(z => path.dirname(z) === geo.folder && (
    Number(/^\d{5}[a-z]{2}(\d{4})000\.zip$/i.exec(path.basename(z))?.[1]) === sequence
    || Number(/^[a-z]{2}(\d{7})\.\d{4}-1yr\.zip$/i.exec(path.basename(z))?.[1]) === sequence));
  if (!zip) return null;
  const entries = zipEntries(zip);
  // e…/m… files (2006–), or …e.2005-1yr / …m.2005-1yr (2005)
  const entry = entries.find(e => new RegExp(`(^|/)${which}\\d{5}[a-z]{2}\\d+\\.txt$|\\d${which}\\.\\d{4}-1yr$`, 'i').test(e));
  if (!entry) return null;
  const rows = rowsOf(`${zip}:${entry}`, () => execFileSync('unzip', ['-p', zip, entry], { encoding: 'latin1', maxBuffer: 1 << 30 }),
    line => Number(line.split(',', 6)[5]));
  return rows.get(geo.logrecno)?.split(',') ?? null;
}

const value = v => (v == null || v === '' || v === '.' ? null : v);

/**
 * One table for one geography: { year, geoid, name, table, title, universe, rows: [{ line, label,
 * indent, estimate, moe }] }. Values are strings, as published (some are annotations: "-", "N").
 * Rows without a line number are headings printed between cells.
 */
export function acsTable(year, geoid, tableId) {
  const index = yearIndex(year);
  const geo = index?.geos.get(geoid);
  if (!geo) return null;
  const id = tableId.toUpperCase();
  const title = ACS_TABLES.find(([t]) => t === id)?.[1] ?? null;

  if (index.kind === 'sequence') {
    const table = index.tables.get(id);
    if (!table?.parts.length) return null;
    const estimates = [];
    const moes = [];
    for (const part of table.parts) {
      const e = sequenceRow(index, geo, part.sequence, 'e');
      const m = sequenceRow(index, geo, part.sequence, 'm');
      for (let i = 0; i < part.cells; i++) {
        estimates.push(value(e?.[part.start - 1 + i]));
        moes.push(value(m?.[part.start - 1 + i]));
      }
    }
    // The table's cells are its whole-numbered lines, in order; the values follow the same order.
    let k = 0;
    const rows = table.lines.length
      ? table.lines.map(l => {
        if (!l.cell) return { line: null, label: l.label, indent: 0, estimate: null, moe: null };
        const i = k++;
        return { line: l.line, label: l.label, indent: 0, estimate: estimates[i] ?? null, moe: moes[i] ?? null };
      })
      : estimates.map((e, i) => ({ line: i + 1, label: null, indent: 0, estimate: e, moe: moes[i] }));
    return {
      year, geoid, name: geo.name, level: geo.level, congress: geo.congress, table: id,
      title: table.title || title, universe: table.universe, rows,
      ...(year === 2005 ? { labels_from: table.labelsFrom ?? null } : {}),
    };
  }

  const file = path.join(index.dir, 'data', '1YRData', `acsdt1y${year}-${id.toLowerCase()}.dat`);
  if (!fs.existsSync(file)) return null;
  const header = fs.readFileSync(file, 'latin1').split('\n', 1)[0].split('|');
  const rows = rowsOf(file, () => fs.readFileSync(file, 'latin1'), line => line.split('|', 1)[0]);
  const fields = rows.get(geoid)?.split('|');
  if (!fields) return null;
  const shell = index.shells.get(id);
  const byLine = new Map();
  header.forEach((h, i) => {
    const m = /_([EM])(\d+)$/.exec(h);
    if (!m) return;
    const line = Number(m[2]);
    if (!byLine.has(line)) byLine.set(line, {});
    byLine.get(line)[m[1] === 'E' ? 'estimate' : 'moe'] = value(fields[i]);
  });
  const lines = shell?.lines.length ? shell.lines : [...byLine.keys()].map(line => ({ line, label: null, indent: 0 }));
  return {
    year, geoid, name: geo.name, level: geo.level, congress: geo.congress, table: id,
    title: shell?.title ?? title, universe: shell?.universe ?? null,
    rows: lines.map(l => ({ line: l.line, label: l.label, indent: l.indent ?? 0, estimate: byLine.get(l.line)?.estimate ?? null, moe: byLine.get(l.line)?.moe ?? null })),
  };
}
