#!/usr/bin/env node
/**
 * Parse seed/data/fr-eos-<president>.json → executive_documents.structure (+ source_html)
 *
 * Each order's Federal Register HTML is parsed once into the structured form
 * (sections → items → spans, plus citations; see lib/parse-executive-order.js) and stored;
 * the client renders it. The raw HTML is kept alongside in `source_html`. Where a govinfo
 * data file exists for the president, its package id, subjects and references are added
 * to the structure as a `govinfo` block.
 *
 * Usage:
 *   node --env-file=server/.env server/seed/load-executive-order-structure.js --president barack-obama [--number 13636] [--dry-run]
 *   node --env-file=server/.env server/seed/load-executive-order-structure.js --president donald-trump-47
 *
 * Build the data file first with fetch-federal-register-executive-orders.js.
 *
 * Env:
 *   DATABASE_URL — Supabase Postgres connection URI
 *
 * Safe to re-run — adds the columns if missing and overwrites the stored structure.
 * Orders with no row yet are inserted (source_id = Federal Register document number).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { parseExecutiveOrder, govinfoTextToHtml, isNotice } from '../lib/parse-executive-order.js';

const DRY_RUN = process.argv.includes('--dry-run');
const arg = name => {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
};
const PRESIDENT = arg('--president');
const ONLY_NUMBER = arg('--number');

const GOVINFO_FILES = {
  'barack-obama': 'govinfo-obama-eos.json',
  'donald-trump': 'govinfo-donald-trump-eos.json',
  'joseph-biden': 'govinfo-joseph-biden-eos.json',
  'donald-trump-47': 'govinfo-donald-trump-47-eos.json',
};

if (!PRESIDENT) {
  console.error(`Usage: --president ${Object.keys(GOVINFO_FILES).join(' | ')} [--number N] [--dry-run]`);
  process.exit(1);
}

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');
const DATA_FILE = path.join(DATA_DIR, `fr-eos-${PRESIDENT}.json`);
const GOVINFO_FILE = GOVINFO_FILES[PRESIDENT] ? path.join(DATA_DIR, GOVINFO_FILES[PRESIDENT]) : null;

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// govinfo's extracted references → the same target shape the parser gives citations.
function govinfoReferences(references = []) {
  return references.flatMap(ref => (ref.contents || []).flatMap(c => {
    if (ref.collectionCode === 'USCODE') return (c.sections || []).map(section => ({ type: 'usc', title: c.title, section }));
    if (ref.collectionCode === 'PLAW') return [{ type: 'public_law', congress: c.congress, number: c.number }];
    return [{ type: ref.collectionCode.toLowerCase(), ...c }];
  }));
}

function govinfoBlock(record) {
  const levels = entry => [entry.level1, entry.level2, entry.level3].filter(Boolean).join(' : ');
  return {
    package_id: record.source_id,
    details_url: record.source_url,
    pdf_url: record.pdf_url,
    categories: (record.categories || []).map(c => c.level2 || c.level1).filter(Boolean),
    subjects: (record.subjects || []).map(levels),
    references: govinfoReferences(record.references),
  };
}

async function store(client, doc, structure) {
  const updated = await client.query(
    `UPDATE executive_documents
        SET structure = $1, source_html = $2
      WHERE source_id = $3
      RETURNING id`,
    [JSON.stringify(structure), doc.html, doc.document_number]
  );
  if (updated.rows.length > 0) return 'updated';

  const date = doc.signing_date || doc.publication_date || null;
  const inserted = await client.query(
    `INSERT INTO executive_documents
       (doc_type, number, title, signed_date, source_id, source_url, structure, source_html)
     VALUES ('executive_order', $1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [structure.number, doc.title, date, doc.document_number, doc.html_url, JSON.stringify(structure), doc.html]
  );
  await client.query(
    `INSERT INTO corpus (entity_type, entity_id, title, date, branch)
     VALUES ('executive_document', $1, $2, $3, 'executive')
     ON CONFLICT (entity_type, entity_id) DO NOTHING`,
    [inserted.rows[0].id, doc.title, date]
  );
  return 'inserted';
}

async function run() {
  let docs = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  if (ONLY_NUMBER) docs = docs.filter(d => String(d.executive_order_number) === ONLY_NUMBER);

  const govinfo = new Map();
  if (GOVINFO_FILE && fs.existsSync(GOVINFO_FILE)) {
    for (const record of JSON.parse(fs.readFileSync(GOVINFO_FILE, 'utf8'))) govinfo.set(String(record.number), record);
  }

  console.log(
    `Parsing ${docs.length} documents from ${path.basename(DATA_FILE)}` +
    ` (${govinfo.size} govinfo records)${DRY_RUN ? ' (dry run)' : ''}...`
  );

  const counts = { updated: 0, inserted: 0, notice: 0, 'no text': 0 };
  const noText = [];
  const fallbacks = [];
  let sections = 0;
  let items = 0;
  let withGovinfo = 0;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `ALTER TABLE executive_documents
         ADD COLUMN IF NOT EXISTS structure JSONB,
         ADD COLUMN IF NOT EXISTS source_html TEXT`
    );
    for (const doc of docs) {
      // Corrections and republications share the order's number; unnumbered documents
      // are other presidential orders the Federal Register files under the same type.
      if (isNotice(doc.document_number) || !doc.executive_order_number) { counts.notice++; continue; }
      const record = govinfo.get(String(doc.executive_order_number));
      // A few orders have no HTML at the Federal Register; fall back to govinfo's plain text.
      const fromGovinfo = !doc.html && Boolean(record?.body);
      if (!doc.html && !fromGovinfo) { counts['no text']++; noText.push(doc.executive_order_number); continue; }

      const structure = parseExecutiveOrder(fromGovinfo ? govinfoTextToHtml(record.body) : doc.html, doc);
      if (fromGovinfo) { structure.source.name = 'govinfo'; fallbacks.push(doc.executive_order_number); }
      if (record) { structure.govinfo = govinfoBlock(record); withGovinfo++; }
      sections += structure.sections.length;
      items += structure.sections.reduce((n, s) => n + s.items.length, 0);

      counts[await store(client, doc, structure)]++;
    }
    await client.query(DRY_RUN ? 'ROLLBACK' : 'COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }

  console.log(`  ${counts.updated} rows updated, ${counts.inserted} inserted (${sections} sections, ${items} items)`);
  console.log(`  ${withGovinfo} with govinfo details`);
  if (fallbacks.length) console.log(`  parsed from govinfo plain text (no Federal Register HTML): EO ${fallbacks.join(', ')}`);
  console.log(`  skipped: ${counts.notice} notices / unnumbered, ${counts['no text']} with no Federal Register text${noText.length ? ` (EO ${noText.join(', ')})` : ''}`);
  console.log(DRY_RUN ? '\nDry run — nothing written.' : '\nLoad complete.');
}

run().catch(err => { console.error(err); process.exit(1); });
