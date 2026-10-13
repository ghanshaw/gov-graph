// Reading the American Community Survey's summary files, as the Census Bureau publishes them.
//
// 2005–2019 (sequence files): each state folder has a geography file (one line per geography,
// keyed by logical record number) and numbered sequence files; each sequence file has an estimate
// file (e…) and a margin-of-error file (m…), one comma-separated row per geography:
//   FILEID, FILETYPE, STUSAB, CHARITER, SEQUENCE, LOGRECNO, value, value, …
// The year's lookup says which sequence holds a table and at which column its cells start. The
// lookup's format changed over the years (an .xls list in 2005, tab-separated in 2006, .xls in
// 2007–2008, comma-separated after), but its content did not.
//
// 2021– (table files): one pipe-separated file per table for every geography,
//   GEO_ID | B01001_E001 | B01001_M001 | …
// with the geographies in Geos<year>1YR.txt and the row labels in the table shells.

export const LOOKUP_PATHS = {
  2005: '2005/documentation/Chapter_5_tables_summary_list.xls',
  2006: '2006/documentation/merge_5_6_final.txt',
  2007: '2007/documentation/1_year/merge_5_6_final.xls',
  2008: '2008/documentation/1_year/user_tools/merge_5_6.xls',
  2009: '2009/documentation/1_year/user_tools/merge_5_6.txt',
  2010: '2010/documentation/1_year/user_tools/Sequence_Number_and_Table_Number_Lookup.txt',
  2011: '2011/documentation/1_year/user_tools/Sequence_Number_and_Table_Number_Lookup.txt',
  2012: '2012/documentation/1_year/user_tools/Sequence_Number_and_Table_Number_Lookup.txt',
  2013: '2013/documentation/user_tools/ACS_1yr_Seq_Table_Number_Lookup.txt',
  2014: '2014/documentation/user_tools/ACS_1yr_Seq_Table_Number_Lookup.txt',
  2015: '2015/documentation/user_tools/ACS_1yr_Seq_Table_Number_Lookup.txt',
  2016: '2016/documentation/user_tools/ACS_1yr_Seq_Table_Number_Lookup.txt',
  2017: '2017/documentation/user_tools/ACS_1yr_Seq_Table_Number_Lookup.txt',
  2018: '2018/documentation/user_tools/ACS_1yr_Seq_Table_Number_Lookup.txt',
  2019: '2019/documentation/user_tools/ACS_1yr_Seq_Table_Number_Lookup.txt',
};

/** A line of comma-separated values, with quoted fields. */
export function splitCsv(line, sep = ',') {
  const out = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { out.push(field); field = ''; }
    else field += ch;
  }
  out.push(field);
  return out;
}

const blank = v => v == null || String(v).trim() === '' || String(v).trim() === '.';
const num = v => (blank(v) ? null : Number(String(v).trim()));

/**
 * A year's lookup → Map of table id → { id, title, universe, parts: [{ sequence, start, cells }],
 * lines: [{ line, label }] }. `start` is the 1-based column of the table's first cell in the
 * sequence file; a table that runs over two sequence files has two parts.
 * @param XLSX the SheetJS module, for the .xls lookups
 */
export function readLookup(buffer, filename, XLSX) {
  let rows;
  if (/\.xls$/i.test(filename)) {
    const wb = XLSX.read(buffer);
    rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });
  } else {
    const text = buffer.toString('latin1');
    const sep = text.split('\n')[0].includes('\t') ? '\t' : ',';
    rows = text.split(/\r?\n/).filter(Boolean).map(l => splitCsv(l, sep));
  }
  const head = rows[0].map(h => String(h).toLowerCase().replace(/[^a-z]/g, ''));
  const col = (...names) => head.findIndex(h => names.includes(h));
  const c = {
    table: col('tableid', 'tblid'),
    sequence: col('sequencenumber', 'seq'),
    line: col('linenumber', 'order', 'linenumberdecimalmlines'), // the last as 2011 heads it
    start: col('startposition', 'position'),
    cells: col('totalcellsintable', 'cells', 'numberofcells'),
    title: col('tabletitle', 'title', 'longtabletitle'),
  };
  if (c.table < 0 || c.sequence < 0 || c.start < 0) throw new Error(`unrecognized lookup header in ${filename}: ${rows[0].join(' | ')}`);

  const tables = new Map();
  let current = null;
  let part = null;
  for (const row of rows.slice(1)) {
    const id = String(row[c.table] ?? '').trim();
    const title = String(row[c.title] ?? '').trim();
    if (id) {
      if (!tables.has(id)) tables.set(id, { id, title: '', universe: null, parts: [], lines: [] });
      current = tables.get(id);
    } else if (!current) continue;
    const start = num(row[c.start]);
    const line = c.line >= 0 ? num(row[c.line]) : null;
    if (start && start > 0) {
      const cells = /(\d+)\s*CELL/i.exec(String(row[c.cells] ?? ''))?.[1];
      part = { sequence: num(row[c.sequence]), start, cells: cells ? Number(cells) : null, lines: [] };
      current.parts.push(part);
      if (!current.title) current.title = title;
    } else if (/^Universe:/i.test(title)) {
      current.universe ??= title.replace(/^Universe:\s*/i, '');
    } else if (line != null && title && part) {
      // Whole numbers are cells; 0.5, 2.7 … are headings printed between them.
      part.lines.push({ line, label: title, cell: Number.isInteger(line) && line > 0 });
    }
  }

  for (const t of tables.values()) {
    // Some tables are printed in full twice (a second copy for Puerto Rico): a part whose lines
    // start again at 1 repeats the table. A table split over two sequence files continues its
    // numbering in the second part.
    const parts = [];
    for (const p of t.parts) {
      const first = p.lines.find(l => l.cell)?.line;
      if (parts.length && (first === 1 || (first == null && p.cells === parts[0].cells))) continue;
      parts.push(p);
    }
    t.lines = parts.flatMap(p => p.lines);
    t.parts = parts.map(p => ({ sequence: p.sequence, start: p.start, cells: p.lines.filter(l => l.cell).length || p.cells }));
    t.cells = t.parts.reduce((sum, p) => sum + (p.cells ?? 0), 0);
  }
  return { tables };
}

/**
 * A line of a sequence-era geography file → { sumlev, component, logrecno, geoid, name }.
 * The columns moved between years; these do not: summary level at 9–11, geographic component at
 * 12–13, logical record number at 14–20, and the GEOID ("04000US06") with the name after it.
 */
export function parseGeoLine(line) {
  const m = /\b(\d{5}US[0-9A-Z]*)\s+(.*?)\s*$/.exec(line);
  return {
    sumlev: line.slice(8, 11),
    component: line.slice(11, 13),
    logrecno: Number(line.slice(13, 20)),
    geoid: m?.[1] ?? null,
    name: m?.[2] ?? null,
  };
}

/** "Congressional District 1 (116th Congress), California" → 116 */
export const congressOf = name => Number(/\((\d+)(?:st|nd|rd|th) Congress\)/.exec(name ?? '')?.[1]) || null;
