#!/usr/bin/env node
/**
 * Load a U.S. Code release point → usc_titles, usc_nodes, usc_section_versions, usc_source_credits
 * (see lib/usc-storage.js). Each title is parsed (lib/parse-uscode-xml.js) and stored in its own
 * transaction.
 *
 * Usage:
 *   node --env-file=server/.env server/seed/load-uscode.js --release 119-36 [--titles 5,10,42] [--dry-run]
 *
 * Download the zip first: fetch-uscode-releases.js --release 119-36
 *
 * Safe to re-run: a section whose text is unchanged keeps its version row. Loading an older
 * release after a newer one only adds the versions it had and widens the ranges.
 */

import fs from 'fs';
import pg from 'pg';
import { mirrorFile, openZip, uscodeReleaseUrl } from '../lib/data-dir.js';
import { parseUscodeTitle } from '../lib/parse-uscode-xml.js';
import { SCHEMA, lawIndex, releasePoint, storeTitle } from '../lib/usc-storage.js';

const DRY_RUN = process.argv.includes('--dry-run');
const arg = name => {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
};
if (!arg('--release')) {
  console.error('Usage: --release 119-36 [--titles 5,10,42] [--dry-run]');
  process.exit(1);
}
const RELEASE = { ...releasePoint(arg('--release')), source_url: uscodeReleaseUrl(arg('--release')) };
const TITLES = arg('--titles')?.split(',').map(t => t.trim().toLowerCase());
// usc05A.xml → '5a'
const titleOfFile = name => /^usc0*(\w+)\.xml$/.exec(name)?.[1].toLowerCase();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const zipFile = mirrorFile(RELEASE.source_url);
  if (!fs.existsSync(zipFile)) throw new Error(`Missing ${zipFile}; run fetch-uscode-releases.js --release ${RELEASE.id}`);
  const zip = openZip(zipFile);
  const client = await pool.connect();
  const totals = { titles: 0, nodes: 0, sections: 0, versionsAdded: 0, versionsKept: 0, credits: 0, linked: 0 };
  const failures = [];
  try {
    await client.query(SCHEMA);
    const laws = await lawIndex(client);
    if (DRY_RUN) await client.query('BEGIN');
    const files = zip.files.filter(f => !TITLES || TITLES.includes(titleOfFile(f)));
    console.log(`Release point ${RELEASE.id}: ${files.length} title files${DRY_RUN ? ' (dry run)' : ''}`);

    for (const file of files) {
      const started = Date.now();
      let parsed;
      try {
        parsed = parseUscodeTitle(zip.read(file));
      } catch (err) {
        failures.push(`${file}: ${err.message}`);
        continue;
      }
      if (parsed.title.release && parsed.title.release !== RELEASE.id) {
        failures.push(`${file}: says it is release ${parsed.title.release}, not ${RELEASE.id}`);
        continue;
      }
      try {
        if (!DRY_RUN) await client.query('BEGIN');
        const result = await storeTitle(client, parsed, RELEASE, laws);
        if (!DRY_RUN) await client.query('COMMIT');
        for (const key of Object.keys(totals)) totals[key] += key === 'titles' ? 1 : result[key] ?? 0;
        const empty = parsed.nodes.filter(n => n.structure && !n.status && n.structure.items.length === 0).length;
        console.log(
          `  ${`Title ${parsed.title.number}`.padEnd(10)} ${String(result.sections).padStart(5)} sections`
          + ` (${result.inForce} in force), ${result.versionsAdded} new versions, ${result.versionsKept} unchanged,`
          + ` ${result.credits} credits (${result.linked} to bills)`
          + `${empty ? `, ${empty} with no text` : ''}${parsed.warnings.length ? `, ${parsed.warnings.length} warnings` : ''}`
          + ` — ${((Date.now() - started) / 1000).toFixed(1)}s`,
        );
        for (const warning of parsed.warnings.slice(0, 3)) console.log(`      ${warning}`);
      } catch (err) {
        if (!DRY_RUN) await client.query('ROLLBACK');
        else throw err; // a failed statement aborts the dry run's one transaction
        failures.push(`${file}: ${err.message}`);
      }
    }
    if (DRY_RUN) await client.query('ROLLBACK');
  } finally {
    client.release();
    zip.cleanup();
    await pool.end();
  }

  console.log(`\n${DRY_RUN ? 'Would store' : 'Stored'} ${totals.titles} titles: ${totals.nodes} units, ${totals.sections} sections`
    + ` (${totals.versionsAdded} new versions, ${totals.versionsKept} unchanged), ${totals.credits} source credits (${totals.linked} linked to bills)`);
  if (failures.length) {
    console.log(`\n${failures.length} failures:`);
    for (const f of failures.slice(0, 30)) console.log(`  ${f}`);
    process.exitCode = 1;
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
