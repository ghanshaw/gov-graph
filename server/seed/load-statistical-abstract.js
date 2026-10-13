#!/usr/bin/env node
/**
 * Store the 2012 Statistical Abstract's sections, subsections and tables (features/statistical-abstract, Phase 2),
 * read from what seed/fetch-statistical-abstract.js saved: the section pages say which tables there are and under
 * which subsection; each table's file gives its headnote, column heads, row labels, footnotes and source note.
 *
 *   node --env-file=server/.env server/seed/load-statistical-abstract.js [--dry-run] [--json out.json]
 *
 * Re-running replaces every row. A table whose file is missing or unreadable is stored from its page alone, with
 * `read_error` saying why. The report compares each section's tables with the range the book's contents give
 * (seed/data/structures/statistical-abstract.json).
 */

import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { DATA_DIR, mirrorFile, valuesClause } from '../lib/data-dir.js';
import { readSavedPages, readTableFile, SCHEMA } from '../lib/statab.js';

const arg = name => {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
};
const DRY_RUN = process.argv.includes('--dry-run');
const JSON_OUT = arg('--json');

const book = JSON.parse(fs.readFileSync(new URL('./data/structures/statistical-abstract.json', import.meta.url), 'utf8'));
const bookSection = new Map(book.categories.map(c => [Number(c.code), c]));

const { sections } = readSavedPages();
const tables = [];
const problems = [];
for (const s of sections) {
  for (const sub of s.subsections) {
    for (const t of sub.tables) {
      // A few tables are listed under two subsections (587, 868); the first in book order keeps them.
      if (tables.some(x => x.number === t.number && x.suffix === t.suffix)) {
        problems.push(`${t.number}${t.suffix}: listed again under "${sub.name}"; kept under the first`);
        continue;
      }
      const file = mirrorFile(t.url);
      const row = { id: `${t.number}${t.suffix}`, number: t.number, suffix: t.suffix, section: s.number, subsection: sub.position, title: t.title, url: t.url, path: path.relative(DATA_DIR, file).split(path.sep).join('/') };
      if (!fs.existsSync(file)) row.read_error = 'not downloaded';
      else {
        try {
          const f = readTableFile(file);
          if (f.number !== t.number) problems.push(`${row.id}: the file says Table ${f.number}${f.suffix}`);
          Object.assign(row, {
            file_title: f.title, description: f.description, headnote: f.headnote, column_heads: f.columnHeads, stub: f.stub,
            symbols: f.symbols, footnotes: f.footnotes, notes: f.notes, source: f.source, more_info: f.moreInfo,
            released: f.released, first_year: f.years?.[0] ?? null, last_year: f.years?.[1] ?? null, year_count: f.yearCount, by_state: f.byState,
            row_count: f.rows, column_count: f.columns,
          });
          if (!f.source) problems.push(`${row.id}: no source note`);
        } catch (err) {
          row.read_error = err.message;
        }
      }
      if (row.read_error) problems.push(`${row.id}: ${row.read_error}`);
      tables.push(row);
    }
  }
}

// Report: per section, tables on the page against the book's range.
console.log(`${sections.length} sections, ${sections.reduce((n, s) => n + s.subsections.length, 0)} subsections, ${tables.length} tables`);
for (const s of sections) {
  const mine = tables.filter(t => t.section === s.number);
  const range = bookSection.get(s.number)?.tables;
  const numbers = new Set(mine.map(t => t.number));
  const absent = range ? Array.from({ length: range[1] - range[0] + 1 }, (_, i) => range[0] + i).filter(n => !numbers.has(n)) : [];
  const read = mine.filter(t => !t.read_error).length;
  console.log(`  ${String(s.number).padStart(2)}. ${s.name}: ${mine.length} tables (${read} read)${range ? `, book ${range[0]}–${range[1]}` : ''}${absent.length ? `, not on the page: ${absent.join(', ')}` : ''}`);
}
const withSource = tables.filter(t => t.source).length;
console.log(`Source notes: ${withSource} of ${tables.length}. Problems: ${problems.length}`);
for (const p of problems.slice(0, 40)) console.log(`  ${p}`);
if (problems.length > 40) console.log(`  … ${problems.length - 40} more`);

if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ sections, tables }, null, 1));
if (DRY_RUN) process.exit(0);

const COLUMNS = ['id', 'number', 'suffix', 'section', 'subsection', 'title', 'url', 'path', 'file_title', 'description', 'headnote',
  'column_heads', 'stub', 'symbols', 'footnotes', 'notes', 'source', 'more_info', 'released', 'first_year', 'last_year',
  'year_count', 'by_state', 'row_count', 'column_count', 'read_error'];
const JSONB = new Set(['column_heads', 'stub']);

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
try {
  await client.query(SCHEMA);
  await client.query('ALTER TABLE statab_tables ADD COLUMN IF NOT EXISTS year_count INT, ADD COLUMN IF NOT EXISTS by_state BOOLEAN');
  await client.query('BEGIN');
  await client.query('DELETE FROM statab_sections');
  for (const s of sections) {
    await client.query('INSERT INTO statab_sections (number, slug, name, url) VALUES ($1, $2, $3, $4)', [s.number, s.slug, s.name, s.url]);
    for (const sub of s.subsections) {
      await client.query('INSERT INTO statab_subsections (section, position, name) VALUES ($1, $2, $3)', [s.number, sub.position, sub.name ?? s.name]);
    }
  }
  for (let i = 0; i < tables.length; i += 200) {
    const { sql, params } = valuesClause(tables.slice(i, i + 200).map(t => COLUMNS.map(c => (JSONB.has(c) && t[c] != null ? JSON.stringify(t[c]) : t[c] ?? null))));
    await client.query(`INSERT INTO statab_tables (${COLUMNS.join(', ')}) VALUES ${sql}`, params);
  }
  await client.query('COMMIT');
  console.log(`Stored ${sections.length} sections and ${tables.length} tables.`);
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release();
  await pool.end();
}
