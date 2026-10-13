#!/usr/bin/env node
/**
 * Load govinfo bill text zips → legislative_documents (+ legislative_document_sections)
 *
 * Every bill version in a zip is parsed once (lib/parse-bill-xml.js) and stored the way
 * load-bill-text.js stores a single bill (lib/bill-text-storage.js), raw XML included.
 * A bill with no `legislation` row yet gets a minimal one, so no text is left unattached;
 * run load-bill-status-bulk.js first and those rows will already have their full details.
 *
 * Usage:
 *   node --env-file=server/.env server/seed/load-bill-text-bulk.js --congress 119 [--session 1] [--type hr] [--force] [--dry-run]
 *   node --env-file=server/.env server/seed/load-bill-text-bulk.js --congress 115-119
 *
 * Download the zips first: fetch-govinfo-bulk.js --collection BILLS --congress 115-119
 *
 * Env:
 *   DATABASE_URL — Supabase Postgres connection URI
 *
 * Safe to re-run — versions already stored are skipped unless `--force`, which replaces
 * them (needed after a change to the converter).
 */

import fs from 'fs';
import pg from 'pg';
import { BILL_TYPES, bulkFile, congressRange, openZip, valuesClause } from '../lib/data-dir.js';
import { parseBillXml } from '../lib/parse-bill-xml.js';
import { SCHEMA, splitForStorage, parsePackageId } from '../lib/bill-text-storage.js';

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');
const arg = name => {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
};
if (!arg('--congress')) {
  console.error('Usage: --congress 119 | 115-119 [--session 1] [--type hr] [--force] [--dry-run]');
  process.exit(1);
}
const CONGRESSES = congressRange(arg('--congress'));
const SESSIONS = arg('--session') ? [Number(arg('--session'))] : [1, 2];
const TYPES = arg('--type') ? [arg('--type').toLowerCase()] : BILL_TYPES;

// A batch is one transaction: it closes at this many versions or this much raw XML,
// whichever comes first (one omnibus bill is several megabytes on its own).
const BATCH_VERSIONS = 40;
const BATCH_BYTES = 4 * 1024 * 1024;
// Sections go in several rows per statement, bounded the same two ways.
const SECTION_ROWS = 300;
const SECTION_BYTES = 2 * 1024 * 1024;

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function storeBatch(client, versions, bills) {
  // Bills the status files did not have: a minimal row, so the text has something to belong to.
  const missing = new Map();
  for (const v of versions) {
    if (!bills.has(v.billSourceId) && !missing.has(v.billSourceId)) missing.set(v.billSourceId, v);
  }
  if (missing.size) {
    const rows = valuesClause([...missing.values()].map(v => [
      v.parsed.title ?? `${v.id.type.toUpperCase()} ${v.id.number}`, v.id.number, v.id.type, v.id.congress, v.billSourceId,
    ]));
    const inserted = await client.query(
      `INSERT INTO legislation (title, bill_number, bill_type, congress_number, source_id)
       SELECT v.title, v.number, v.type, v.congress::int, v.source_id
         FROM (VALUES ${rows.sql}) AS v(title, number, type, congress, source_id)
       ON CONFLICT (source_id) DO UPDATE SET source_id = EXCLUDED.source_id
       RETURNING id, source_id, title`,
      rows.params
    );
    const corpus = valuesClause(inserted.rows.map(r => [r.id, r.title]));
    await client.query(
      `INSERT INTO corpus (entity_type, entity_id, title, branch)
       SELECT 'legislation', v.id::uuid, v.title, 'legislative' FROM (VALUES ${corpus.sql}) AS v(id, title)
       ON CONFLICT (entity_type, entity_id) DO NOTHING`,
      corpus.params
    );
    for (const row of inserted.rows) bills.set(row.source_id, { id: row.id, versions: {} });
  }

  const documents = valuesClause(versions.map(v => [
    v.id.code, v.label, v.date, bills.get(v.billSourceId).id, v.packageId,
    `https://www.govinfo.gov/app/details/${v.packageId}`, JSON.stringify(v.head), v.xml,
  ]));
  const { rows } = await client.query(
    `INSERT INTO legislative_documents (doc_type, title, date, legislation_id, source_id, source_url, structure, source_xml)
     SELECT v.code, v.label, v.date::date, v.bill::uuid, v.package, v.url, v.structure::jsonb, v.xml
       FROM (VALUES ${documents.sql}) AS v(code, label, date, bill, package, url, structure, xml)
     ON CONFLICT (source_id) DO UPDATE
       SET doc_type = EXCLUDED.doc_type, title = EXCLUDED.title, date = EXCLUDED.date,
           legislation_id = EXCLUDED.legislation_id, structure = EXCLUDED.structure, source_xml = EXCLUDED.source_xml
     RETURNING id, source_id`,
    documents.params
  );
  const documentId = Object.fromEntries(rows.map(r => [r.source_id, r.id]));

  await client.query('DELETE FROM legislative_document_sections WHERE document_id = ANY($1::uuid[])', [rows.map(r => r.id)]);

  let chunk = [];
  let bytes = 0;
  const flush = async () => {
    if (chunk.length === 0) return;
    const values = valuesClause(chunk);
    await client.query(
      `INSERT INTO legislative_document_sections (document_id, position, section_id, number, heading, structure)
       SELECT v.document::uuid, v.position::int, v.section, v.number, v.heading, v.structure::jsonb
         FROM (VALUES ${values.sql}) AS v(document, position, section, number, heading, structure)`,
      values.params
    );
    chunk = [];
    bytes = 0;
  };
  for (const v of versions) {
    for (const [position, section] of v.sections.entries()) {
      const json = JSON.stringify(section);
      chunk.push([documentId[v.packageId], position, section.id, section.number, section.title, json]);
      bytes += json.length;
      if (chunk.length >= SECTION_ROWS || bytes >= SECTION_BYTES) await flush();
    }
  }
  await flush();
}

async function loadZip(client, congress, session, type, totals) {
  const zipFile = bulkFile('BILLS', congress, type, session);
  if (!fs.existsSync(zipFile)) return; // a session that has not been published

  // This type's bills (with the labels and dates the status files give their versions)
  // and the versions already stored.
  const billRows = await client.query(
    `SELECT id, source_id, details->'textVersions' AS versions FROM legislation
      WHERE congress_number = $1 AND lower(bill_type) = $2`,
    [congress, type]
  );
  const bills = new Map(billRows.rows.map(r => [r.source_id, {
    id: r.id,
    versions: Object.fromEntries((r.versions ?? []).filter(v => v.packageId).map(v => [v.packageId, v])),
  }]));
  const storedRows = await client.query(
    `SELECT source_id FROM legislative_documents WHERE source_id ~ $1 AND structure IS NOT NULL`,
    [`^BILLS-${congress}${type}[0-9]`]
  );
  const stored = new Set(storedRows.rows.map(r => r.source_id));

  const zip = openZip(zipFile);
  const counts = { versions: 0, skipped: 0, sections: 0, failed: 0 };
  try {
    let batch = [];
    let bytes = 0;
    // One transaction per batch; a dry run is already inside one that will be rolled back.
    const flush = async () => {
      if (batch.length === 0) return;
      if (!DRY_RUN) await client.query('BEGIN');
      try {
        await storeBatch(client, batch, bills);
        if (!DRY_RUN) await client.query('COMMIT');
      } catch (err) {
        if (!DRY_RUN) await client.query('ROLLBACK');
        throw err;
      }
      batch = [];
      bytes = 0;
    };

    for (const name of zip.files) {
      const packageId = name.replace(/\.xml$/, '');
      const id = parsePackageId(packageId);
      if (!id) { counts.failed++; totals.failures.push(`${name}: unexpected file name`); continue; }
      if (!FORCE && stored.has(packageId)) { counts.skipped++; continue; }

      const xml = zip.read(name);
      let parsed;
      try {
        parsed = parseBillXml(xml, {
          package_id: packageId, congress: id.congress, bill_type: id.type.toUpperCase(), number: id.number,
        });
      } catch (err) {
        counts.failed++;
        totals.failures.push(`${name}: ${err.message}`);
        continue;
      }
      const billSourceId = `${id.congress}-${id.type.toUpperCase()}-${id.number}`;
      // The official label and date, where the status file lists this version; otherwise the XML's own.
      const listed = bills.get(billSourceId)?.versions[packageId];
      const label = listed?.label ?? (parsed.version.stage ?? id.code).replace(/-/g, ' ');
      const date = listed?.date ?? parsed.date;
      parsed.version = { ...parsed.version, code: id.code, label, date };

      const { head, sections } = splitForStorage(parsed);
      batch.push({ packageId, id, billSourceId, label, date, parsed, head, sections, xml });
      bytes += xml.length;
      counts.versions++;
      counts.sections += sections.length;
      if (batch.length >= BATCH_VERSIONS || bytes >= BATCH_BYTES) await flush();
    }
    await flush();
  } finally {
    zip.cleanup();
  }

  console.log(`  ${congress}-${session} ${type}: ${counts.versions} versions stored (${counts.sections} sections), ${counts.skipped} already stored${counts.failed ? `, ${counts.failed} failed` : ''}`);
  for (const key of ['versions', 'skipped', 'sections']) totals[key] += counts[key];
}

async function run() {
  console.log(`Loading bill text for Congress ${CONGRESSES.join(', ')}${FORCE ? ' (replacing stored versions)' : ''}${DRY_RUN ? ' (dry run)' : ''}...`);
  const totals = { versions: 0, skipped: 0, sections: 0, failures: [] };
  const started = Date.now();
  const client = await pool.connect();
  try {
    // A dry run does everything inside one transaction and undoes it.
    if (DRY_RUN) await client.query('BEGIN');
    await client.query(SCHEMA);
    for (const congress of CONGRESSES) {
      for (const session of SESSIONS) {
        for (const type of TYPES) await loadZip(client, congress, session, type, totals);
      }
    }
  } finally {
    if (DRY_RUN) await client.query('ROLLBACK').catch(() => {});
    client.release();
    await pool.end();
  }
  const minutes = ((Date.now() - started) / 60000).toFixed(1);
  console.log(`\n${totals.versions} versions stored (${totals.sections} sections), ${totals.skipped} already stored, in ${minutes} min`);
  if (totals.failures.length) console.log(`Failed files (${totals.failures.length}):\n  ${totals.failures.slice(0, 30).join('\n  ')}`);
  console.log(DRY_RUN ? '\nDry run — nothing written.' : '\nLoad complete.');
}

run().catch(err => { console.error(err); process.exit(1); });
