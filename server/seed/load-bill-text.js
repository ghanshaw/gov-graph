#!/usr/bin/env node
/**
 * Load the text versions of one bill → legislative_documents (+ legislative_document_sections)
 *
 * Lists the bill's text versions from the Congress.gov API, downloads each version's XML
 * from govinfo, parses it once (lib/parse-bill-xml.js) and stores it:
 *   - legislative_documents: one row per version. `doc_type` is the version code ("rh",
 *     "enr"), `source_id` the govinfo package id (BILLS-119hr1enr), `structure` everything
 *     except the section text (title, version, outline, citations), `source_xml` the raw file.
 *   - legislative_document_sections: one row per section, in reading order, so the client
 *     can load a long bill a few sections at a time.
 *
 * Usage:
 *   node --env-file=server/.env server/seed/load-bill-text.js --congress 119 --type hr --number 1 [--dry-run]
 *
 * Env:
 *   DATABASE_URL — Supabase Postgres connection URI
 *   CONGRESS_API_KEY — api.congress.gov key
 *
 * Safe to re-run — adds the columns and table if missing, and replaces a version's
 * stored structure and sections.
 */

import pg from 'pg';
import axios from 'axios';
import { parseBillXml } from '../lib/parse-bill-xml.js';
import { SCHEMA, splitForStorage } from '../lib/bill-text-storage.js';

const DRY_RUN = process.argv.includes('--dry-run');
const arg = name => {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
};
const CONGRESS = Number(arg('--congress'));
const TYPE = (arg('--type') ?? '').toLowerCase();
const NUMBER = arg('--number');

if (!CONGRESS || !TYPE || !NUMBER) {
  console.error('Usage: --congress 119 --type hr --number 1 [--dry-run]');
  process.exit(1);
}

const DELAY_MS = 300;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function listVersions() {
  const url = `https://api.congress.gov/v3/bill/${CONGRESS}/${TYPE}/${NUMBER}/text`;
  const { data } = await axios.get(url, { params: { api_key: process.env.CONGRESS_API_KEY, format: 'json', limit: 250 } });
  const versions = [];
  for (const v of data.textVersions || []) {
    // The bill-format XML is BILLS-…xml; public laws are published in another format (USLM).
    const xml = (v.formats || []).find(f => /\/(BILLS-[0-9a-z]+)\.xml$/.test(f.url ?? ''));
    if (!xml) { console.log(`  skipped "${v.type}": no bill-format XML`); continue; }
    const packageId = /(BILLS-[0-9a-z]+)\.xml$/.exec(xml.url)[1];
    versions.push({
      packageId,
      code: packageId.replace(/^BILLS-\d+[a-z]+\d+/, ''),
      label: v.type,
      date: v.date ? v.date.slice(0, 10) : null,
    });
  }
  return versions;
}

async function legislationId(client) {
  const { rows } = await client.query(
    `SELECT id FROM legislation WHERE congress_number = $1 AND lower(bill_type) = $2 AND bill_number = $3 LIMIT 1`,
    [CONGRESS, TYPE, NUMBER]
  );
  if (rows.length === 0) throw new Error(`no legislation row for ${CONGRESS} ${TYPE} ${NUMBER}; run ingest-legislation.js first`);
  return rows[0].id;
}

async function store(client, billId, version, xml, parsed) {
  const { head, sections } = splitForStorage(parsed);

  const sourceUrl = `https://www.govinfo.gov/app/details/${version.packageId}`;
  const { rows } = await client.query(
    `INSERT INTO legislative_documents (doc_type, title, date, legislation_id, source_id, source_url, structure, source_xml)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (source_id) DO UPDATE
       SET doc_type = EXCLUDED.doc_type, title = EXCLUDED.title, date = EXCLUDED.date,
           structure = EXCLUDED.structure, source_xml = EXCLUDED.source_xml
     RETURNING id`,
    [version.code, version.label, version.date, billId, version.packageId, sourceUrl, JSON.stringify(head), xml]
  );
  const documentId = rows[0].id;

  await client.query('DELETE FROM legislative_document_sections WHERE document_id = $1', [documentId]);
  // Insert in chunks: one statement per section would be hundreds of round trips.
  for (let start = 0; start < sections.length; start += 100) {
    const chunk = sections.slice(start, start + 100);
    const values = [];
    const params = [];
    chunk.forEach((s, i) => {
      const n = i * 6;
      values.push(`($${n + 1}, $${n + 2}, $${n + 3}, $${n + 4}, $${n + 5}, $${n + 6})`);
      params.push(documentId, start + i, s.id, s.number, s.title, JSON.stringify(s));
    });
    await client.query(
      `INSERT INTO legislative_document_sections (document_id, position, section_id, number, heading, structure)
       VALUES ${values.join(', ')}`,
      params
    );
  }
}

async function run() {
  console.log(`Listing text versions of ${TYPE.toUpperCase()} ${NUMBER} (${CONGRESS}th Congress)${DRY_RUN ? ' (dry run)' : ''}...`);
  const versions = await listVersions();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(SCHEMA);
    const billId = await legislationId(client);

    for (const version of versions) {
      const url = `https://www.govinfo.gov/content/pkg/${version.packageId}/xml/${version.packageId}.xml`;
      const { data: xml } = await axios.get(url, { responseType: 'text' });
      const parsed = parseBillXml(xml, {
        package_id: version.packageId,
        congress: CONGRESS,
        bill_type: TYPE.toUpperCase(),
        number: NUMBER,
        version: { code: version.code, label: version.label, date: version.date },
      });
      await store(client, billId, version, xml, parsed);
      const items = parsed.sections.reduce((n, s) => n + s.items.length, 0);
      console.log(`  ${version.packageId} (${version.label}): ${parsed.sections.length} sections, ${items} items, ${parsed.citations.length} citations`);
      await sleep(DELAY_MS);
    }
    await client.query(DRY_RUN ? 'ROLLBACK' : 'COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }

  console.log(DRY_RUN ? '\nDry run — nothing written.' : `\nLoaded ${versions.length} versions.`);
}

run().catch(err => { console.error(err.response?.data || err); process.exit(1); });
