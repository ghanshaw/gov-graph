#!/usr/bin/env node
/**
 * Load the text of every Supreme Court decision in a range of terms → cases.structure (+ case_opinions)
 *
 * The Court lists each term's opinions at supremecourt.gov/opinions/slipopinion/<yy>. Once the
 * Reporter's paginated version is out, that list links to it instead of the slip opinion; the
 * Reporter's PDFs drop the letters of "fi" and "fl" ligatures from their text ("fled" for
 * "filed"), so the slip opinion is read instead. CourtListener records the slip opinion's
 * address for each decision, and the Court still serves those files.
 *
 * For each decision in the list: find its CourtListener cluster by docket number and date,
 * take the slip opinion PDF, parse it (lib/parse-slip-opinion.js), check it (checkDecision),
 * and store it (lib/decision-storage.js). Decisions already stored from the same PDF are
 * skipped unless --force.
 *
 * Usage:
 *   node --env-file=server/.env server/seed/load-case-text-bulk.js --terms 2020-2025 [--from 2020-10-27] [--to 2026-07-01]
 *        [--only 25-332] [--dry-run] [--force] [--refresh] [--report report.json]
 *
 * --terms    October Terms, by the year they begin
 * --refresh  fetch the term lists again (otherwise the copy in the data directory is used)
 *
 * Env:
 *   DATABASE_URL — Supabase Postgres connection URI
 *   COURTLISTENER_TOKEN — CourtListener API token
 *
 * The term lists, the cluster each decision was matched to, and the PDFs are kept in the data
 * directory (supremecourt.gov/…, courtlistener.com/scotus-slip-opinions.json).
 */

import fs from 'fs';
import path from 'path';
import pg from 'pg';
import axios from 'axios';
import { extractPdfLines } from '../lib/pdf-lines.js';
import { parseSlipOpinion, checkDecision } from '../lib/parse-slip-opinion.js';
import { SCHEMA, readPdf, storeDecision, membersOn, retrying } from '../lib/decision-storage.js';
import { DATA_DIR, mirrorFile, recordFetch } from '../lib/data-dir.js';

const arg = name => {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
};
const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');
const REFRESH = process.argv.includes('--refresh');
const [FIRST, LAST = FIRST] = (arg('--terms') ?? '').split('-').map(Number);
const FROM = arg('--from') ?? '0000';
const TO = arg('--to') ?? '9999';
const ONLY = arg('--only');
const REPORT = arg('--report');

if (!FIRST || LAST < FIRST) {
  console.error('Usage: --terms 2020-2025 [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--only <docket>] [--dry-run] [--force] [--refresh] [--report file]');
  process.exit(1);
}

const COURT = 'https://www.supremecourt.gov';
const COURTLISTENER = 'https://www.courtlistener.com/api/rest/v4';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = { 'User-Agent': 'Mozilla/5.0 (govgraph)' };

// ---------------------------------------------------------------------------
// The Court's list of a term's opinions

const decode = text => text
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, '’').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ').trim();

async function termList(term) {
  const url = `${COURT}/opinions/slipopinion/${String(term).slice(2)}`;
  const file = `${mirrorFile(url)}.html`;
  if (REFRESH || !fs.existsSync(file)) {
    const { data } = await axios.get(url, { headers: browser, responseType: 'text' });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, data);
    recordFetch(file, url);
  }
  const html = fs.readFileSync(file, 'utf8');
  const rows = [];
  // Columns: R-number, date, docket, name, author's initials, citation; the name links to the PDF.
  for (const [, row] of html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => decode(m[1]));
    const pdf = /href=['"]?([^'" >]+\.pdf)/.exec(row)?.[1];
    if (cells.length < 6 || !/^\d+$/.test(cells[0]) || !pdf) continue;
    const [m, d, y] = cells[1].split('/');
    rows.push({
      term,
      date: `20${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`,
      // "21-588 (21A85)": the application number the case began under is kept in brackets.
      docket: cells[2].replace(/\s*\(.*\)$/, ''),
      name: cells[3].replace(/\s*Revisions\s*:.*$/, ''),
      pdf: new URL(pdf, url).href,
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// The CourtListener cluster for a decision, and its slip opinion

const MATCHES_FILE = path.join(DATA_DIR, 'courtlistener.com', 'scotus-slip-opinions.json');
const matches = fs.existsSync(MATCHES_FILE) ? JSON.parse(fs.readFileSync(MATCHES_FILE, 'utf8')) : {};
const saveMatches = () => {
  fs.mkdirSync(path.dirname(MATCHES_FILE), { recursive: true });
  fs.writeFileSync(MATCHES_FILE, JSON.stringify(matches, null, 1));
};

// A slip opinion: /opinions/25pdf/25-332_qn12.pdf. Not the Reporter's version (609us2r62_…),
// a preliminary print, or a revision ("…diff_…", "…new_…").
const isSlip = url => /supremecourt\.gov\/opinions\/\d\dpdf\/[^/]+\.pdf$/i.test(url ?? '')
  && !/\/\d+us\d+r\d+_|diff|new_|preliminaryprint/i.test(url);

async function findCluster(decision) {
  const key = `${decision.term}:${decision.docket}`;
  if (matches[key]) return matches[key];
  // Original actions are numbered "142, Orig."; CourtListener writes them "142 Orig".
  const docket = decision.docket.replace(/, Orig\.$/, ' Orig');
  const { data } = await retrying(() => axios.get(`${COURTLISTENER}/search/`, {
    params: { type: 'o', court: 'scotus', docket_number: docket },
    headers: { Authorization: `Token ${process.env.COURTLISTENER_TOKEN}` },
  }));
  await sleep(800);
  const results = (data.results ?? []).filter(r => r.dateFiled === decision.date);
  const withSlip = results.find(r => r.opinions?.some(o => isSlip(o.download_url)));
  const chosen = withSlip ?? results[0];
  const match = chosen ? {
    clusterId: chosen.cluster_id,
    caseName: chosen.caseName,
    dateFiled: chosen.dateFiled,
    url: `https://www.courtlistener.com${chosen.absolute_url}`,
    slip: chosen.opinions?.map(o => o.download_url).find(isSlip) ?? null,
  } : null;
  if (match) {
    matches[key] = match;
    saveMatches();
  }
  return match;
}

// ---------------------------------------------------------------------------

async function run() {
  const decisions = [];
  for (let term = FIRST; term <= LAST; term++) decisions.push(...await termList(term));
  const chosen = decisions
    .filter(d => d.date >= FROM && d.date <= TO && (!ONLY || d.docket === ONLY))
    .sort((a, b) => a.date.localeCompare(b.date));
  console.log(`${chosen.length} decisions, ${FROM} to ${TO}${DRY_RUN ? ' (dry run)' : ''}`);

  const pool = DRY_RUN ? null : new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  if (pool) await pool.query(SCHEMA);
  const stored = new Map();
  if (pool) {
    // Decisions already stored, by the slip opinion they were read from.
    const { rows } = await pool.query(`SELECT pdf_url FROM court_decisions WHERE pdf_url IS NOT NULL`);
    for (const row of rows) stored.set(row.pdf_url, true);
  }

  const report = [];
  for (const [i, decision] of chosen.entries()) {
    const label = `[${i + 1}/${chosen.length}] ${decision.date} ${decision.docket} ${decision.name}`;
    const entry = { ...decision };
    report.push(entry);
    try {
      const match = await findCluster(decision);
      if (!match) throw new Error('no CourtListener cluster with this docket number and date');
      // The Court's own list still links to the slip opinion for the newest decisions.
      const pdfUrl = match.slip ?? (isSlip(decision.pdf) ? decision.pdf : null);
      if (!pdfUrl) throw new Error(`no slip opinion PDF (only ${decision.pdf})`);
      Object.assign(entry, { clusterId: match.clusterId, pdfUrl });
      if (!FORCE && stored.has(pdfUrl)) {
        entry.status = 'already stored';
        console.log(`${label}: already stored`);
        continue;
      }

      const pages = await extractPdfLines(await readPdf(pdfUrl));
      const parsed = parseSlipOpinion(pages, {
        case_name: match.caseName,
        pdf_url: pdfUrl,
        members: membersOn(decision.date),
        source: { courtlistener_cluster: match.clusterId },
      });
      entry.problems = checkDecision(parsed);
      entry.summary = {
        opinions: parsed.opinions.map(o => `${o.kind}${o.author ? `:${o.author}` : ''}`),
        vote: parsed.outcome?.vote ?? null,
        footnotes: parsed.opinions.reduce((n, o) => n + o.footnotes.length, 0),
        citations: parsed.citations.length,
      };
      const vote = parsed.outcome ? ` ${parsed.outcome.vote.majority}–${parsed.outcome.vote.dissent}` : '';
      console.log(`${label}: ${parsed.opinions.length} opinions${vote}${entry.problems.length ? ` — ${entry.problems.join('; ')}` : ''}`);
      if (pool) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await storeDecision(client, parsed, match);
          await client.query('COMMIT');
          entry.status = 'stored';
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      } else {
        entry.status = 'parsed';
      }
    } catch (err) {
      entry.status = 'failed';
      entry.error = err.message;
      console.log(`${label}: FAILED — ${err.message}`);
    }
  }

  const count = status => report.filter(e => e.status === status).length;
  console.log(`\nStored ${count('stored')}, parsed (dry run) ${count('parsed')}, already stored ${count('already stored')}, failed ${count('failed')}; ` +
    `${report.filter(e => e.problems?.length).length} with problems.`);
  if (REPORT) fs.writeFileSync(REPORT, JSON.stringify(report, null, 1));
  await pool?.end();
}

run().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
