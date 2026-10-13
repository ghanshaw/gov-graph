#!/usr/bin/env node
/**
 * Download a U.S. Code release point (every title in USLM XML, one zip) into the data directory,
 * at the publisher's path: <data dir>/uscode.house.gov/download/releasepoints/us/pl/119/36/xml_uscAll@119-36.zip
 *
 * Usage:
 *   node server/seed/fetch-uscode-releases.js                  # the current release point
 *   node server/seed/fetch-uscode-releases.js --release 119-36
 *   node server/seed/fetch-uscode-releases.js --release 119-36 --archive
 *
 * `--archive` fetches the Internet Archive's copy of the same file (web.archive.org), for when
 * uscode.house.gov is unavailable; the newest complete capture is used. No key needed.
 * A zip already on disk that opens cleanly is kept.
 */

import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { execFileSync } from 'child_process';
import axios from 'axios';
import { mirrorFile, recordFetch, uscodeReleaseUrl } from '../lib/data-dir.js';

const arg = name => {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
};
const ARCHIVE = process.argv.includes('--archive');
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (govgraph research)' };

// A truncated download still has a .zip name; `unzip -t` reads it through to the end.
const zipIsWhole = file => {
  try {
    execFileSync('unzip', ['-tq', file], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

/** The release point named on the download page ("xml_uscAll@119-36.zip"). */
async function currentRelease() {
  const { data } = await axios.get('https://uscode.house.gov/download/download.shtml', { headers: HEADERS });
  const m = /xml_uscAll@(\d+-\d+)\.zip/.exec(data);
  if (!m) throw new Error('No release point found on uscode.house.gov/download (the site may be down; use --release with --archive)');
  return m[1];
}

/** Archived captures of a URL, newest first: [{ timestamp, length }]. */
async function captures(url) {
  const { data } = await axios.get('https://web.archive.org/cdx/search/cdx', {
    params: { url, output: 'json', filter: 'statuscode:200' },
  });
  return data.slice(1).map(row => ({ timestamp: row[1], length: Number(row[6]) })).reverse();
}

async function save(url, file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const response = await axios.get(url, { responseType: 'stream', headers: HEADERS, maxRedirects: 5 });
  await pipeline(response.data, fs.createWriteStream(`${file}.part`));
  if (!zipIsWhole(`${file}.part`)) {
    fs.rmSync(`${file}.part`);
    return false;
  }
  fs.renameSync(`${file}.part`, file);
  return true;
}

async function run() {
  const release = arg('--release') ?? await currentRelease();
  const url = uscodeReleaseUrl(release);
  const file = mirrorFile(url);
  if (fs.existsSync(file) && zipIsWhole(file)) {
    console.log(`Kept ${file}`);
    return;
  }

  if (!ARCHIVE) {
    if (!(await save(url, file))) throw new Error(`${url} did not download whole`);
    recordFetch(file, url);
    console.log(`Downloaded ${url}\n  → ${file}`);
    return;
  }
  const list = await captures(url);
  if (list.length === 0) throw new Error(`The Internet Archive has no capture of ${url}`);
  for (const { timestamp, length } of list) {
    process.stdout.write(`Archive capture ${timestamp} (${(length / 1e6).toFixed(0)} MB) … `);
    // "id_" asks for the file exactly as captured, without the archive's page around it.
    if (await save(`https://web.archive.org/web/${timestamp}id_/${url}`, file)) {
      recordFetch(file, url, { archive: timestamp });
      console.log(`whole\n  → ${file}`);
      return;
    }
    console.log('truncated, trying an older capture');
  }
  throw new Error(`No whole capture of ${url} in the Internet Archive`);
}

run().catch(err => {
  console.error(err.message);
  process.exit(1);
});
