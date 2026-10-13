#!/usr/bin/env node
/**
 * Fetch the Comparative Agendas Project's Master Topics Codebook page, and its Copyright and Legal page (the
 * licence: CC BY-NC-SA 4.0), into the data directory, and rebuild the structure the Structure page shows:
 *   comparativeagendas.net/pages/master-codebook, comparativeagendas.net/pages/Copyright-and-Legal
 *   → server/seed/data/structures/comparative-agendas.json
 *
 * Usage:
 *   node server/seed/fetch-cap-codebook.js [--dry-run]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DATA_DIR, mirrorFile, recordFetch } from '../lib/data-dir.js';
import { parseCapCodebook, capStructure } from '../lib/parse-cap-codebook.js';

const CODEBOOK = 'https://comparativeagendas.net/pages/master-codebook';
const LEGAL = 'https://comparativeagendas.net/pages/Copyright-and-Legal';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'structures', 'comparative-agendas.json');
const dryRun = process.argv.includes('--dry-run');

async function fetchTo(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'govgraph public records research' } });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const body = await res.text();
  if (!/<html/i.test(body)) throw new Error(`${url}: not an HTML page`);
  // Saved with .html: the address has no extension, and the data folder's file viewer goes by it.
  const file = `${mirrorFile(url)}.html`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
  recordFetch(file, url);
  console.log(`  ${path.relative(DATA_DIR, file)}: ${(body.length / 1e3).toFixed(0)} KB`);
  return body;
}

async function run() {
  const html = await fetchTo(CODEBOOK);
  const legal = await fetchTo(LEGAL);
  if (!/Attribution-NonCommercial-ShareAlike 4\.0/.test(legal)) {
    console.warn('  The Copyright and Legal page no longer names CC BY-NC-SA 4.0: check the licence in sources.json.');
  }
  const parsed = parseCapCodebook(html);
  const structure = capStructure(parsed, { url: CODEBOOK, fetched: new Date().toISOString().slice(0, 10) });
  const subtopics = parsed.topics.reduce((n, t) => n + t.children.length, 0);
  console.log(`Version ${parsed.version} (${parsed.date}): ${parsed.topics.length} major topics, ${subtopics} subtopics`);
  if (dryRun) return;
  fs.writeFileSync(OUT, `${JSON.stringify(structure, null, 2)}\n`);
  console.log(`  → ${path.relative(process.cwd(), OUT)}`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
