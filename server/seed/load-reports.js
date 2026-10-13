#!/usr/bin/env node
/**
 * Load the reports in seed/data/reports.json → reports, report_parts.
 *
 * Reads the files fetch-reports.js downloaded, parses each part once (lib/parse-commission-html.js),
 * puts each chapter's endnotes with it, and stores:
 *   - reports: one row, with the hand-entered facts (issuer, date, the law that created the body,
 *     the laws that followed) and `structure`: every part's outline (sections with their opening
 *     words), the recommendations, counts and where the text and PDFs come from.
 *   - report_parts: one row per part in reading order, `structure` = its sections and notes.
 * Prints what looks wrong in each part (notes never called, calls without a note).
 *
 * Usage:
 *   node --env-file=server/.env server/seed/load-reports.js [--report 9-11-commission] [--dry-run] [--json out.json]
 *
 * Env:
 *   DATABASE_URL — Supabase Postgres connection URI
 *
 * Safe to re-run: replaces the report's row and parts.
 */

import fs from 'fs';
import pg from 'pg';
import { readReports, reportFile, govinfoPdfUrl, SCHEMA } from '../lib/reports.js';
import { decodeFile, contentOf, readBlocks, readPart, splitByHeading, readNotes, recoverCalls, checkPart } from '../lib/parse-commission-html.js';

const DRY_RUN = process.argv.includes('--dry-run');
const arg = name => {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
};
const only = arg('--report');
const JSON_OUT = arg('--json');

const LABEL = { chapter: n => `Chapter ${n}`, appendix: n => `Appendix ${n}`, preface: () => 'Preface', summary: () => 'Executive Summary' };

/** The first words of a section, for the contents list. */
const opening = section => {
  const first = section.items.find(i => typeof i.text === 'string' && i.text);
  const words = (first?.text ?? '').split(/\s+/).slice(0, 8).join(' ');
  return words ? `${words}…` : null;
};

function parseReport(report) {
  const blocksOf = name => readBlocks(contentOf(decodeFile(fs.readFileSync(reportFile(report, name)))));
  const notes = readNotes(blocksOf(report.notes_file));
  const recommendations = [];
  const parts = report.parts.map((cfg, position) => {
    let blocks = blocksOf(cfg.file);
    if (cfg.heading) {
      blocks = splitByHeading(blocks).find(p => p.heading.startsWith(cfg.heading))?.blocks;
      if (!blocks) throw new Error(`${cfg.id}: no heading "${cfg.heading}" in ${cfg.file}`);
    }
    const parsed = readPart(blocks, cfg.id, { titleHeadings: cfg.title_headings ?? 1 });
    const part = { sections: parsed.sections, notes: cfg.kind === 'chapter' ? notes.get(cfg.number) ?? [] : [] };
    const recovered = recoverCalls(part);
    const problems = checkPart(part);
    // The recommendations, numbered in reading order as an address (the Commission does not number them).
    for (const section of part.sections) {
      for (const item of section.items.filter(i => i.recommendation)) {
        item.anchor = `${cfg.id}-rec-${recommendations.length + 1}`;
        item.number = recommendations.length + 1;
        recommendations.push({ id: item.anchor, number: item.number, part: cfg.id, section: section.id, text: item.text });
      }
    }
    const label = LABEL[cfg.kind](cfg.number);
    console.log(`  ${label.padEnd(18)} ${String(part.sections.length).padStart(2)} sections ${String(part.sections.reduce((n, s) => n + s.items.length, 0)).padStart(4)} items ${String(part.notes.length).padStart(4)} notes`
      + `${recovered.length ? `  (calls read from plain digits: ${recovered.join(', ')})` : ''}${problems.length ? `  ⚠ ${problems.join('; ')}` : ''}`);
    return {
      position, part_id: cfg.id, kind: cfg.kind, number: cfg.number ?? null, title: cfg.title, label,
      pdf_url: cfg.granule ? govinfoPdfUrl(report.source_id, cfg.granule) : null,
      note: cfg.note ?? null,
      printed_title: parsed.title,
      structure: { ...part, printed_title: parsed.title },
    };
  });

  const structure = {
    parts: parts.map(p => ({
      id: p.part_id, kind: p.kind, number: p.number, title: p.title, label: p.label, note: p.note, pdf_url: p.pdf_url,
      sections: p.structure.sections.map(s => ({ id: s.id, number: s.number, heading: s.heading, opening: s.heading ? null : opening(s) })),
      note_count: p.structure.notes.length,
    })),
    recommendations,
    counts: {
      chapters: parts.filter(p => p.kind === 'chapter').length,
      notes: parts.reduce((n, p) => n + p.structure.notes.length, 0),
      recommendations: recommendations.length,
    },
    source: {
      text_from: report.text_from, text_url: report.source_url,
      pdf_from: report.pdf_from, pdf_url: report.source_id ? govinfoPdfUrl(report.source_id) : null,
    },
  };
  return { structure, parts };
}

async function run() {
  const reports = readReports().filter(r => !only || r.slug === only);
  if (!reports.length) throw new Error(`Unknown report; known: ${readReports().map(r => r.slug).join(', ')}`);
  const parsed = reports.map(report => {
    console.log(`${report.short_title}`);
    return { report, ...parseReport(report) };
  });
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(parsed.map(p => ({ structure: p.structure, parts: p.parts })), null, 1));
  if (DRY_RUN) return;

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(SCHEMA);
    for (const { report: r, structure, parts } of parsed) {
      const { rows: [{ id }] } = await client.query(
        `INSERT INTO reports (slug, kind, title, short_title, issuer, issuer_short, date_issued, source_id, source_url, govinfo_url, related, structure, loaded_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())
         ON CONFLICT (slug) DO UPDATE SET kind = $2, title = $3, short_title = $4, issuer = $5, issuer_short = $6, date_issued = $7,
           source_id = $8, source_url = $9, govinfo_url = $10, related = $11, structure = $12, loaded_at = now()
         RETURNING id`,
        [r.slug, r.kind, r.title, r.short_title, r.issuer, r.issuer_short, r.date_issued, r.source_id, r.source_url, r.govinfo_url,
          JSON.stringify(r.related ?? []), JSON.stringify(structure)],
      );
      await client.query('DELETE FROM report_parts WHERE report_id = $1', [id]);
      for (const p of parts) {
        await client.query(
          `INSERT INTO report_parts (report_id, position, part_id, kind, number, title, pdf_url, structure) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [id, p.position, p.part_id, p.kind, p.number, p.title, p.pdf_url, JSON.stringify(p.structure)],
        );
      }
      console.log(`Stored ${r.slug}: ${parts.length} parts.`);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
