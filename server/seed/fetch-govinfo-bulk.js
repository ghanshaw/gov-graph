#!/usr/bin/env node
/**
 * Download govinfo bulk data zips for bills into the data directory (see lib/data-dir.js).
 *
 *   BILLS      — the text of every bill version, one zip per Congress, session and bill type
 *   BILLSTATUS — each bill's status file (titles, sponsors, actions, text versions),
 *                one zip per Congress and bill type
 *
 * Usage:
 *   node server/seed/fetch-govinfo-bulk.js --collection BILLS --congress 115-119
 *   node server/seed/fetch-govinfo-bulk.js --collection BILLSTATUS --congress 119 [--refresh]
 *
 * No key needed. Safe to re-run — a zip already on disk at the size the server reports is
 * skipped; `--refresh` downloads it again regardless (the current Congress keeps changing).
 */

import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import axios from 'axios';
import { BILL_TYPES, bulkFile, bulkPath, congressRange, DATA_DIR, recordFetch } from '../lib/data-dir.js';

const arg = name => {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
};
const COLLECTION = arg('--collection');
const REFRESH = process.argv.includes('--refresh');
if (!['BILLS', 'BILLSTATUS'].includes(COLLECTION) || !arg('--congress')) {
  console.error('Usage: --collection BILLS | BILLSTATUS --congress 115-119 [--refresh]');
  process.exit(1);
}
const CONGRESSES = congressRange(arg('--congress'));
const BASE_URL = 'https://www.govinfo.gov/bulkdata';

async function download(collection, congress, type, session) {
  const url = `${BASE_URL}/${bulkPath(collection, congress, type, session)}`;
  const file = bulkFile(collection, congress, type, session);

  let head;
  try {
    head = await axios.head(url);
  } catch (err) {
    if (err.response?.status === 404) return 'missing'; // e.g. a session that has not begun
    throw err;
  }
  const size = Number(head.headers['content-length']);
  if (!REFRESH && fs.existsSync(file) && fs.statSync(file).size === size) return 'kept';

  fs.mkdirSync(path.dirname(file), { recursive: true });
  const response = await axios.get(url, { responseType: 'stream' });
  // Write beside the target and rename, so an interrupted download is never mistaken for a whole one.
  await pipeline(response.data, fs.createWriteStream(`${file}.part`));
  fs.renameSync(`${file}.part`, file);
  recordFetch(file, url);
  return 'downloaded';
}

async function run() {
  console.log(`Fetching ${COLLECTION} for Congress ${CONGRESSES.join(', ')} into ${DATA_DIR}`);
  const counts = { downloaded: 0, kept: 0, missing: 0 };
  let bytes = 0;
  for (const congress of CONGRESSES) {
    for (const type of BILL_TYPES) {
      for (const session of COLLECTION === 'BILLS' ? [1, 2] : [null]) {
        const result = await download(COLLECTION, congress, type, session);
        counts[result]++;
        if (result !== 'missing') bytes += fs.statSync(bulkFile(COLLECTION, congress, type, session)).size;
      }
    }
    console.log(`  Congress ${congress} done (${(bytes / 1048576).toFixed(0)} MB so far)`);
  }
  console.log(`\n${counts.downloaded} downloaded, ${counts.kept} already on disk, ${counts.missing} not published`);
}

run().catch(err => { console.error(err.message); process.exit(1); });
