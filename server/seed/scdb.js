#!/usr/bin/env node
/**
 * Seed script: SCDB CSV → cg_scdb_cases + treatment on cg_case_relationships
 *
 * Download the CSV first:
 *   curl -L -o server/seed/data/SCDB_Modern_01_justiceCentered_Citation.csv \
 *     "http://scdb.wustl.edu/data/Legacy_01_justiceCentered_Citation.csv.zip"
 *
 * Or the case-centered version (one row per case, easier):
 *   Download from: http://scdb.wustl.edu/data.php
 *   File: "SCDB_Modern_01_caseCentered_Citation.csv"
 *   Save to: server/seed/data/scdb.csv
 *
 * Usage:
 *   node scdb.js --file server/seed/data/scdb.csv
 *
 * Required env vars:
 *   DATABASE_URL — Supabase Postgres connection URI
 */

import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { createInterface } from "node:readline";

const { Pool } = pg;

// ── SCDB disposition codes → label ────────────────────────────────────────────
// From SCDB codebook: http://scdb.wustl.edu/documentation.php?var=caseDisposition
const DISPOSITION_LABELS = {
  1:  "stay_petition_or_motion_granted",
  2:  "affirmed",
  3:  "reversed",
  4:  "reversed_and_remanded",
  5:  "vacated_and_remanded",
  6:  "affirmed_and_reversed_in_part",
  7:  "affirmed_and_reversed_in_part_and_remanded",
  8:  "vacated",
  9:  "remanded",
  10: "affirmed_and_remanded",
  11: "affirmed_and_vacated_in_part",
  12: "reversed_and_vacated_in_part",
  13: "reversed_and_vacated_in_part_and_remanded",
  14: "vacated_and_reversed_in_part",
  15: "vacated_and_reversed_in_part_and_remanded",
  16: "jurisdiction_postponed",
  17: "injunction_granted",
  18: "injunction_denied",
  19: "affirmed_equally_divided",
  20: "vacated",
  21: "reversed_in_part",
  22: "dismissed",
};

// Simplified treatment for cg_case_relationships.treatment column
function toTreatment(dispositionCode) {
  const label = DISPOSITION_LABELS[dispositionCode];
  if (!label) return null;
  if (label.startsWith("affirmed")) return "affirmed";
  if (label.startsWith("reversed")) return "reversed";
  if (label.startsWith("vacated")) return "vacated";
  if (label.startsWith("remanded")) return "remanded";
  return null;
}

// ── CLI args ──────────────────────────────────────────────────────────────────

const { values: args } = parseArgs({
  options: {
    file: { type: "string" },
  },
});

if (!args.file) {
  console.error("Usage: node scdb.js --file <path/to/scdb.csv>");
  process.exit(1);
}

const CSV_PATH = path.resolve(args.file);
const CSV_URL = `file://${CSV_PATH}`;

// ── DB ────────────────────────────────────────────────────────────────────────

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function registerSource(client) {
  const res = await client.query(
    `INSERT INTO cg_data_sources (name, url, notes)
     VALUES ('scdb', $1, 'SCDB Modern case-centered CSV, all terms 1946–present')
     RETURNING id`,
    [CSV_URL]
  );
  return res.rows[0].id;
}

async function upsertScdbCase(client, row, sourceId) {
  const dispositionCode = row.caseDisposition ? parseInt(row.caseDisposition, 10) : null;
  const dispositionLabel = dispositionCode ? (DISPOSITION_LABELS[dispositionCode] ?? null) : null;

  // Parse date — SCDB format is typically "MM/DD/YYYY"
  let dateDecision = null;
  if (row.dateDecision) {
    const [m, d, y] = row.dateDecision.split("/");
    if (y && m && d) dateDecision = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const res = await client.query(
    `INSERT INTO cg_scdb_cases
       (scdb_case_id, us_cite, case_name, term, date_decision,
        disposition_code, disposition_label, raw, source_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (scdb_case_id) DO UPDATE
       SET us_cite           = EXCLUDED.us_cite,
           case_name         = EXCLUDED.case_name,
           term              = EXCLUDED.term,
           date_decision     = EXCLUDED.date_decision,
           disposition_code  = EXCLUDED.disposition_code,
           disposition_label = EXCLUDED.disposition_label,
           raw               = EXCLUDED.raw
     RETURNING id`,
    [
      row.caseId ?? null,
      row.usCite ?? null,
      row.caseName ?? null,
      row.term ? parseInt(row.term, 10) : null,
      dateDecision,
      dispositionCode,
      dispositionLabel,
      JSON.stringify(row),
      sourceId,
    ]
  );
  return { scdbRowId: res.rows[0].id, dispositionCode };
}

async function linkToCase(client, scdbRowId, usCite, dispositionCode, sourceId) {
  if (!usCite) return;

  // Find matching case by citation
  const caseRes = await client.query(
    `SELECT id FROM cg_cases WHERE citation = $1 LIMIT 1`,
    [usCite.trim()]
  );
  if (caseRes.rows.length === 0) return;

  const caseId = caseRes.rows[0].id;

  // Set scdb_id on the cases row
  await client.query(
    `UPDATE cg_cases SET scdb_id = $1 WHERE id = $2`,
    [scdbRowId, caseId]
  );

  // Update treatment on any existing cg_case_relationships where this case is the citing case
  const treatment = toTreatment(dispositionCode);
  if (treatment) {
    await client.query(
      `UPDATE cg_case_relationships
       SET treatment = $1, source = 'scdb', source_id = $2
       WHERE citing_case_id = $3 AND treatment IS NULL`,
      [treatment, sourceId, caseId]
    );
  }

  return caseId;
}

// ── CSV parsing ───────────────────────────────────────────────────────────────

async function parseCSV(filePath) {
  const rows = [];
  const rl = createInterface({ input: fs.createReadStream(filePath) });
  let headers = null;

  for await (const line of rl) {
    const cols = line.split(",").map((v) => v.replace(/^"|"$/g, "").trim());
    if (!headers) {
      headers = cols;
      continue;
    }
    const row = {};
    headers.forEach((h, i) => { row[h] = cols[i] ?? null; });
    rows.push(row);
  }

  return rows;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`Reading ${CSV_PATH}...`);
  const rows = await parseCSV(CSV_PATH);
  console.log(`Parsed ${rows.length} rows`);

  const client = await pool.connect();
  const sourceId = await registerSource(client);
  console.log(`Registered data_source id=${sourceId}`);

  let inserted = 0;
  let linked = 0;

  try {
    for (const row of rows) {
      const { scdbRowId, dispositionCode } = await upsertScdbCase(client, row, sourceId);
      const caseId = await linkToCase(client, scdbRowId, row.usCite, dispositionCode, sourceId);
      inserted++;
      if (caseId) linked++;
      if (inserted % 500 === 0) console.log(`  ${inserted}/${rows.length} rows processed, ${linked} linked to cases`);
    }
  } finally {
    client.release();
    await pool.end();
  }

  console.log(`\nDone. ${inserted} cg_scdb_cases upserted, ${linked} linked to existing cases.`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
