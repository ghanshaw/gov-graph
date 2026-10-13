#!/usr/bin/env node
/**
 * Download the reports listed in seed/data/reports.json into the data directory, whole:
 *   - the publisher's edition (each part's HTML and PDF, the notes, the full PDF), at its own path:
 *     9-11commission.gov/report/911Report_Ch1.htm
 *   - GPO's edition from govinfo: the package PDF, each part's (granule's) PDF and the MODS record:
 *     govinfo.gov/content/pkg/GPO-911REPORT/pdf/GPO-911REPORT-7.pdf
 * A report is a few tens of MB. Re-running fetches everything again.
 *
 * Usage:
 *   node server/seed/fetch-reports.js [--report 9-11-commission]
 */

import fs from 'fs';
import path from 'path';
import { DATA_DIR, mirrorFile } from '../lib/data-dir.js';
import { readReports, reportFileUrl, reportFile, govinfoPdfUrl, govinfoModsUrl } from '../lib/reports.js';

const arg = name => {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
};
const only = arg('--report');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchTo(url, file) {
  const contact = process.env.BLS_CONTACT_EMAIL;
  const res = await fetch(url, { headers: { 'User-Agent': `govgraph public records research${contact ? ` (${contact})` : ''}` } });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const body = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
  console.log(`  ${path.relative(DATA_DIR, file)}: ${(body.length / 1e6).toFixed(2)} MB`);
  await sleep(200);
}

async function run() {
  const reports = readReports().filter(r => !only || r.slug === only);
  if (!reports.length) throw new Error(`Unknown report; known: ${readReports().map(r => r.slug).join(', ')}`);
  for (const report of reports) {
    console.log(`${report.short_title} → ${DATA_DIR}`);
    const names = new Set([report.notes_file, ...report.files, ...report.parts.flatMap(p => [p.file, p.pdf])].filter(Boolean));
    for (const name of names) {
      // The index page is the folder's own address.
      const url = name === 'index.htm' ? report.base_url : reportFileUrl(report, name);
      await fetchTo(url, name === 'index.htm' ? reportFile(report, name) : mirrorFile(url));
    }
    if (report.source_id?.startsWith('GPO-')) {
      await fetchTo(govinfoModsUrl(report.source_id), mirrorFile(govinfoModsUrl(report.source_id)));
      await fetchTo(govinfoPdfUrl(report.source_id), mirrorFile(govinfoPdfUrl(report.source_id)));
      for (const part of report.parts.filter(p => p.granule)) {
        await fetchTo(govinfoPdfUrl(report.source_id, part.granule), mirrorFile(govinfoPdfUrl(report.source_id, part.granule)));
      }
    }
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
