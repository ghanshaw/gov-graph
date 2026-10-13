#!/usr/bin/env node
/**
 * Download the roll call vote files that bills refer to, into the data directory.
 *
 * The bill status zips (fetch-govinfo-bulk.js --collection BILLSTATUS) name every recorded
 * vote taken on a bill, with the address of its file at the House Clerk or the Senate.
 * Each file is kept under its publisher's own path (lib/data-dir.js, mirrorFile):
 *   clerk.house.gov/evs/2025/roll190.xml
 *   senate.gov/legislative/LIS/roll_call_votes/vote1191/vote_119_1_00372.xml
 * Also fetches the @unitedstates legislators lists (names and ids of all members).
 *
 * Usage:
 *   node server/seed/fetch-roll-calls.js --congress 119 [--refresh]
 *
 * No key needed. Safe to re-run — files already on disk are kept unless `--refresh`.
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { BILL_TYPES, bulkFile, congressRange, openZip, mirrorFile, LEGISLATOR_FILES, DATA_DIR, recordFetch } from '../lib/data-dir.js';
import { parseBillStatus } from '../lib/parse-bill-status.js';

const arg = name => {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
};
if (!arg('--congress')) {
  console.error('Usage: --congress 119 | 115-119 [--refresh]');
  process.exit(1);
}
const CONGRESSES = congressRange(arg('--congress'));
const REFRESH = process.argv.includes('--refresh');
const DELAY_MS = 150;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// senate.gov turns away requests that do not look like a browser's.
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (govgraph; public records research)' };

async function download(url) {
  const file = mirrorFile(url);
  if (!REFRESH && fs.existsSync(file)) return 'kept';
  const { data } = await axios.get(url, { responseType: 'text', headers: HEADERS, transformResponse: x => x });
  // A missing vote comes back as an HTML page with status 200.
  if (url.endsWith('.xml') && !/^\s*<\?xml/.test(data)) throw new Error('not an XML file');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
  recordFetch(file, url);
  await sleep(DELAY_MS);
  return 'downloaded';
}

async function run() {
  console.log(`Fetching roll call files for Congress ${CONGRESSES.join(', ')} into ${DATA_DIR}`);
  for (const url of LEGISLATOR_FILES) console.log(`  ${path.basename(url)}: ${await download(url)}`);

  const urls = new Set();
  for (const congress of CONGRESSES) {
    for (const type of BILL_TYPES) {
      const zipFile = bulkFile('BILLSTATUS', congress, type);
      if (!fs.existsSync(zipFile)) continue;
      const zip = openZip(zipFile);
      try {
        for (const name of zip.files) {
          for (const vote of parseBillStatus(zip.read(name)).recordedVotes) urls.add(vote.url);
        }
      } finally {
        zip.cleanup();
      }
    }
  }
  console.log(`  ${urls.size} roll calls referred to by bills`);

  const counts = { downloaded: 0, kept: 0, failed: 0 };
  const failures = [];
  for (const [i, url] of [...urls].entries()) {
    try {
      counts[await download(url)]++;
    } catch (err) {
      counts.failed++;
      failures.push(`${url}: ${err.message}`);
    }
    if ((i + 1) % 200 === 0) console.log(`  ${i + 1}/${urls.size}`);
  }
  console.log(`\n${counts.downloaded} downloaded, ${counts.kept} already on disk, ${counts.failed} failed`);
  if (failures.length) console.log(`  ${failures.slice(0, 20).join('\n  ')}`);
}

run().catch(err => { console.error(err.message); process.exit(1); });
