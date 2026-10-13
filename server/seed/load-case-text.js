#!/usr/bin/env node
/**
 * Load the text of one Supreme Court decision → court_decisions (+ case_opinions, court_votes)
 *
 * The Court publishes a decision only as a PDF (the slip opinion). This finds the PDF through
 * the case's CourtListener record, keeps a copy in the data directory, reads its printed
 * lines (lib/pdf-lines.js), parses them once (lib/parse-slip-opinion.js) and stores:
 *   - court_decisions: one row per decision, addressed by docket number, with `structure` =
 *     everything except the opinions' text (lib/decision-storage.js)
 *   - case_opinions: one row per writing, in printed order, with its sections and footnotes
 *   - court_votes: one row per Justice (people; run load-justices.js first)
 *   - cases: the CourtListener record it was found by, and its other records, point at it.
 *
 * Usage:
 *   node --env-file=server/.env server/seed/load-case-text.js --cluster 10881681 [--dry-run] [--json out.json]
 *   … --pdf <url or file>   use this PDF instead of the one CourtListener points to
 *
 * Env:
 *   DATABASE_URL — Supabase Postgres connection URI
 *   COURTLISTENER_TOKEN — CourtListener API token
 *
 * Safe to re-run — adds the columns if missing, and replaces the stored structure and opinions.
 */

import fs from 'fs';
import pg from 'pg';
import axios from 'axios';
import { extractPdfLines } from '../lib/pdf-lines.js';
import { parseSlipOpinion } from '../lib/parse-slip-opinion.js';
import { SCHEMA, readPdf, storeDecision, membersOn } from '../lib/decision-storage.js';

const DRY_RUN = process.argv.includes('--dry-run');
const arg = name => {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
};
const CLUSTER = arg('--cluster');
const PDF = arg('--pdf');
const JSON_OUT = arg('--json');

if (!/^\d+$/.test(CLUSTER ?? '')) {
  console.error('Usage: --cluster <CourtListener cluster id> [--pdf <url or file>] [--dry-run] [--json out.json]');
  process.exit(1);
}

const COURTLISTENER = 'https://www.courtlistener.com/api/rest/v4';
const courtlistener = url => axios.get(url, { headers: { Authorization: `Token ${process.env.COURTLISTENER_TOKEN}` } });

async function run() {
  console.log(`Loading the text of cluster ${CLUSTER}${DRY_RUN ? ' (dry run)' : ''}...`);
  const { data: cluster } = await courtlistener(`${COURTLISTENER}/clusters/${CLUSTER}/`);
  let pdfUrl = PDF;
  for (const url of PDF ? [] : cluster.sub_opinions ?? []) {
    const { data: opinion } = await courtlistener(url);
    if (/supremecourt\.gov\/.+\.pdf$/.test(opinion.download_url ?? '')) pdfUrl = opinion.download_url;
  }
  if (!pdfUrl) throw new Error('CourtListener has no supremecourt.gov PDF for this case; pass --pdf');
  console.log(`  ${cluster.case_name} — ${pdfUrl}`);

  const pages = await extractPdfLines(await readPdf(pdfUrl));
  const parsed = parseSlipOpinion(pages, {
    case_name: cluster.case_name,
    members: membersOn(cluster.date_filed),
    pdf_url: /^https?:/.test(pdfUrl) ? pdfUrl : null,
    source: { courtlistener_cluster: Number(CLUSTER) },
  });
  for (const opinion of parsed.opinions) {
    console.log(`  ${opinion.label}: ${opinion.sections.length} parts, ${opinion.sections.reduce((n, s) => n + s.items.length, 0)} paragraphs, ${opinion.footnotes.length} footnotes`);
  }
  console.log(`  ${parsed.syllabus?.items.length ?? 0} syllabus paragraphs, ${parsed.citations.length} authorities cited`);
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(parsed, null, 1) + '\n');
  if (DRY_RUN) return;

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(SCHEMA);
    const stored = await storeDecision(client, parsed, {
      clusterId: cluster.id,
      caseName: cluster.case_name,
      dateFiled: cluster.date_filed,
      url: `https://www.courtlistener.com${cluster.absolute_url}`,
    });
    await client.query('COMMIT');
    console.log(`Stored as scotus/${stored.slug}.${stored.unmatched.length ? ` Names with no Justice: ${stored.unmatched.join(', ')}` : ''}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
