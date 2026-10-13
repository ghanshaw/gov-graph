#!/usr/bin/env node
/**
 * Load the sources: organizations, lineage and programs from seed/data/sources.json, every
 * file in the data folder (matched to a program by its path), and each economic series' program.
 *
 * The file is the original; re-running replaces the tables' rows with it. Files are hashed (sha-256)
 * once and hashed again only when their size or modification time changes. A file's URL comes from
 * the fetch log (lib/data-dir.js, recordFetch) where it was recorded, otherwise it is guessed from
 * the path (url_inferred).
 *
 * Usage:
 *   node --env-file=server/.env server/seed/load-sources.js [--dry-run] [--no-files]
 *
 *   --dry-run   check the file and report what would be stored; nothing is hashed or written
 *   --no-files  leave source_files as it is (no scan of the data folder)
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pg from 'pg';
import { DATA_DIR, valuesClause } from '../lib/data-dir.js';
import { readSources, checkSources, pathMatcher, seriesMatcher, readFetchLog, urlFromPath, SCHEMA } from '../lib/sources.js';
import { SCHEMA as SERIES_SCHEMA } from '../lib/economic-series.js';

const DRY_RUN = process.argv.includes('--dry-run');
const FILES = !process.argv.includes('--no-files');

// Not data: the folder's own notes and logs, unfinished downloads, Finder's files.
const SKIP = name => name === '.DS_Store' || name.endsWith('.part') || name === 'README.md' || name === 'fetch-log.jsonl';

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

const sha256 = file => new Promise((resolve, reject) => {
  const hash = crypto.createHash('sha256');
  fs.createReadStream(file).on('data', chunk => hash.update(chunk)).on('end', () => resolve(hash.digest('hex'))).on('error', reject);
});

const megabytes = bytes => `${(bytes / 1e6).toFixed(1)} MB`;

/** Every file in the data folder: { path, program, size, modified_at }. */
function scan(programs) {
  const programOf = pathMatcher(programs);
  const files = [];
  for (const full of walk(DATA_DIR)) {
    const stat = fs.statSync(full);
    const rel = path.relative(DATA_DIR, full).split(path.sep).join('/');
    files.push({ full, path: rel, program: programOf(rel), size: stat.size, modified_at: stat.mtime });
  }
  return files;
}

function report(programs, files) {
  const byProgram = new Map(programs.map(d => [d.slug, { count: 0, size: 0 }]));
  const unmatched = new Map();
  for (const f of files) {
    if (f.program) {
      const t = byProgram.get(f.program);
      t.count += 1;
      t.size += f.size;
    } else {
      const folder = f.path.split('/').slice(0, 3).join('/');
      unmatched.set(folder, (unmatched.get(folder) ?? 0) + 1);
    }
  }
  console.log(`\n${files.length} files in ${DATA_DIR}:`);
  for (const d of programs) {
    const t = byProgram.get(d.slug);
    if (t.count) console.log(`  ${String(t.count).padStart(6)}  ${megabytes(t.size).padStart(10)}  ${d.slug}`);
  }
  if (unmatched.size) {
    console.log('Files matching no program (by folder):');
    for (const [folder, count] of [...unmatched].sort()) console.log(`  ${String(count).padStart(6)}  ${folder}`);
  }
}

async function storeFiles(client, files) {
  const { rows } = await client.query('SELECT path, size, modified_at, sha256 FROM source_files');
  const known = new Map(rows.map(r => [r.path, r]));
  const log = readFetchLog();
  let hashed = 0;
  for (const f of files) {
    const k = known.get(f.path);
    if (k && Number(k.size) === f.size && k.modified_at.getTime() === f.modified_at.getTime()) {
      f.sha256 = k.sha256;
    } else {
      f.sha256 = await sha256(f.full);
      hashed += 1;
      if (hashed % 1000 === 0) console.log(`  hashed ${hashed}…`);
    }
    const entry = log.get(f.path);
    f.url = entry?.url ?? urlFromPath(f.path);
    f.url_inferred = !entry?.url && Boolean(f.url);
    f.archive = entry?.archive ?? null;
    f.fetched_at = entry?.fetched_at ?? null;
  }
  console.log(`Hashed ${hashed} new or changed files; ${files.length - hashed} unchanged.`);

  await client.query('DELETE FROM source_files');
  for (let i = 0; i < files.length; i += 1000) {
    const { sql, params } = valuesClause(files.slice(i, i + 1000).map(f =>
      [f.path, f.program, f.size, f.sha256, f.modified_at, f.url, f.url_inferred, f.archive, f.fetched_at]));
    await client.query(
      `INSERT INTO source_files (path, program, size, sha256, modified_at, url, url_inferred, archive, fetched_at) VALUES ${sql}`, params);
  }
}

async function storeSources(client, { organizations, lineage, programs }) {
  await client.query('DELETE FROM source_program_organizations');
  await client.query('DELETE FROM source_lineage');
  await client.query('DELETE FROM source_programs WHERE NOT (slug = ANY($1))', [programs.map(d => d.slug)]);
  await client.query('DELETE FROM source_organizations WHERE NOT (slug = ANY($1))', [organizations.map(o => o.slug)]);

  for (const o of organizations) {
    await client.query(
      `INSERT INTO source_organizations (slug, name, short_name, kind, branch, parent, country, url, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (slug) DO UPDATE SET name = $2, short_name = $3, kind = $4, branch = $5, parent = $6, country = $7, url = $8, notes = $9`,
      [o.slug, o.name, o.short_name, o.kind, o.branch ?? null, o.parent ?? null, o.country ?? null, o.url ?? null, o.notes ?? null]);
  }
  for (const l of lineage) {
    await client.query(
      'INSERT INTO source_lineage (from_org, to_org, date, kind, citation, document, notes) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [l.from, l.to, l.date, l.kind, l.citation ?? null, l.document ?? null, l.notes ?? null]);
  }
  for (const [position, d] of programs.entries()) {
    const { type, ...detail } = d.licence;
    const a = d.access;
    await client.query(
      `INSERT INTO source_programs (slug, name, kind, description, homepage, licence, licence_detail, access_used, access_best,
         access_key, access_contact, access_note, status, ended, successor, collected, in_abstract, outside_abstract, paths, notes, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
       ON CONFLICT (slug) DO UPDATE SET name = $2, kind = $3, description = $4, homepage = $5, licence = $6, licence_detail = $7,
         access_used = $8, access_best = $9, access_key = $10, access_contact = $11, access_note = $12, status = $13, ended = $14,
         successor = $15, collected = $16, in_abstract = $17, outside_abstract = $18, paths = $19, notes = $20, position = $21`,
      [d.slug, d.name, d.kind, d.description, d.homepage, type, detail, a.used ?? [], a.best ?? null, a.key ?? null,
        Boolean(a.contact), a.note ?? null, d.status, d.ended ?? null, d.successor ?? null, d.collected !== false,
        d.in_abstract ?? null, d.outside_abstract ?? null, d.paths, d.notes ?? null, position]);
    for (const o of d.organizations) {
      await client.query('INSERT INTO source_program_organizations (program, org, role) VALUES ($1, $2, $3)', [d.slug, o.org, o.role]);
    }
  }
}

/** Each economic series' program; returns the slugs that match none. */
async function storeSeriesPrograms(client, programs) {
  const programOf = seriesMatcher(programs);
  const { rows } = await client.query('SELECT slug, source, source_id, route, frequency FROM economic_series');
  const pairs = rows.map(s => [s.slug, programOf(s)]);
  for (let i = 0; i < pairs.length; i += 1000) {
    const { sql, params } = valuesClause(pairs.slice(i, i + 1000));
    await client.query(`UPDATE economic_series e SET program = v.program FROM (VALUES ${sql}) AS v(slug, program) WHERE e.slug = v.slug`, params);
  }
  const missing = pairs.filter(([, d]) => !d).map(([slug]) => slug);
  console.log(`Linked ${pairs.length - missing.length} of ${pairs.length} economic series to their programs.`);
  return missing;
}

async function run() {
  const sources = readSources();
  const problems = checkSources(sources);
  if (problems.length) throw new Error(`sources.json:\n  ${problems.join('\n  ')}`);
  const { organizations, lineage, programs } = sources;
  console.log(`${organizations.length} organizations, ${lineage.length} lineage entries, ${programs.length} programs${DRY_RUN ? ' (dry run)' : ''}.`);

  const files = FILES ? scan(programs) : [];
  if (FILES) report(programs, files);
  if (DRY_RUN) return;

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    await client.query(SERIES_SCHEMA);
    await client.query(SCHEMA);
    await client.query('BEGIN');
    await storeSources(client, sources);
    if (FILES) await storeFiles(client, files);
    const missing = await storeSeriesPrograms(client, programs);
    await client.query('COMMIT');
    if (missing.length) console.log(`No program for ${missing.length} series: ${missing.slice(0, 20).join(', ')}${missing.length > 20 ? ', …' : ''}`);
    console.log('Done.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
