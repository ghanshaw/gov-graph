// How a parsed court decision (parse-slip-opinion.js) is laid out in the database. Used by
// seed/load-case-text.js, seed/load-case-text-bulk.js and seed/migrate-case-decisions.js.
//
//   court_decisions: one row per decision, addressed within its court by `slug`, the court's
//     own docket number ("25-332"; "145-orig"; a second decision on one docket adds its date).
//     `structure` is everything except the opinions' text: caption, outcome, syllabus,
//     citations, and for each opinion its author and an outline.
//   case_opinions: one row per writing (opinion of the Court, each concurrence and dissent), in
//     printed order, so a long decision can be loaded one opinion at a time. `author_id` is the
//     Justice (people), where known.
//   court_votes: one row per Justice per decision: side, what they wrote and joined.
//   cases: one row per CourtListener record. CourtListener keeps several for one decision (the
//     slip opinion, revisions, the Reporter's version); `decision_id` points each at its decision.
//     The app does not call CourtListener; these rows are kept so its ids can be redirected.

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { mirrorFile } from './data-dir.js';
import { NATURAL_COURTS } from '../naturalCourts.js';

export const SCHEMA = `
  CREATE TABLE IF NOT EXISTS court_decisions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    court            TEXT NOT NULL,          -- 'scotus'
    docket_numbers   TEXT[] NOT NULL,        -- {'25-332'}; {'20-1199','21-707'}; {'145, Orig.'}
    slug             TEXT NOT NULL,          -- address within the court: '25-332'
    name             TEXT NOT NULL,
    term             INT,                    -- October Term
    date_argued      DATE,
    date_decided     DATE NOT NULL,
    kind             TEXT NOT NULL,          -- 'argued' | 'per_curiam' | 'original'
    citation         TEXT,                   -- '592 U.S. 261' once paginated
    slip_citation    TEXT,                   -- '609 U. S. ___ (2026)'
    govinfo_id       TEXT,                   -- 'USREPORTS-561-1', once in a bound volume
    disposition      TEXT,
    vote_majority    INT,
    vote_minority    INT,
    vote_inferred    BOOLEAN NOT NULL DEFAULT false,
    natural_court_id UUID REFERENCES courts(id),
    pdf_url          TEXT,
    structure        JSONB,
    loaded_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (court, slug)
  );
  CREATE INDEX IF NOT EXISTS court_decisions_natural_court_idx ON court_decisions (court, natural_court_id, date_decided);
  CREATE INDEX IF NOT EXISTS court_decisions_dockets_idx ON court_decisions USING gin (docket_numbers);

  CREATE TABLE IF NOT EXISTS court_votes (
    decision_id UUID NOT NULL REFERENCES court_decisions(id) ON DELETE CASCADE,
    person_id   UUID NOT NULL REFERENCES people(id),
    side        TEXT NOT NULL,              -- 'majority' | 'dissent' | 'mixed' | 'none'
    wrote       TEXT[] NOT NULL DEFAULT '{}',
    joined      JSONB NOT NULL DEFAULT '[]',
    PRIMARY KEY (decision_id, person_id)
  );
  CREATE INDEX IF NOT EXISTS court_votes_person_idx ON court_votes (person_id);

  ALTER TABLE cases ADD COLUMN IF NOT EXISTS decision_id UUID REFERENCES court_decisions(id);
  CREATE INDEX IF NOT EXISTS cases_decision_id_idx ON cases (decision_id);
  -- CourtListener writes some dockets "No. 19-547"; records are matched on the bare number.
  CREATE INDEX IF NOT EXISTS cases_bare_docket_idx ON cases ((regexp_replace(docket_number, '^No\.\s*', '')));

  ALTER TABLE case_opinions
    ADD COLUMN IF NOT EXISTS position INT,
    ADD COLUMN IF NOT EXISTS structure JSONB,
    ADD COLUMN IF NOT EXISTS decision_id UUID REFERENCES court_decisions(id) ON DELETE CASCADE,
    ALTER COLUMN case_id DROP NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS case_opinions_source_id_key ON case_opinions (source_id);
  CREATE INDEX IF NOT EXISTS case_opinions_decision_id_idx ON case_opinions (decision_id);
`;

/** The Justices sitting on a date, by surname, Chief Justice first (naturalCourts.js). */
export function membersOn(date) {
  const court = NATURAL_COURTS.find(c => c.startDate <= date && (!c.endDate || date <= c.endDate));
  if (!court) return [];
  const surname = name => name.replace(/,? Jr\.$/, '').split(' ').at(-1);
  const chief = surname(court.chiefJustice);
  return [chief, ...court.justices.map(surname).filter(n => n !== chief)];
}

const chars = items => items.reduce((n, item) => n + item.text.length, 0);

/** Split a parsed decision into what is stored on the decision row and its opinion rows. */
export function splitForStorage(parsed) {
  const head = {
    ...parsed,
    // What the page needs before any opinion text: who wrote what, and its parts.
    opinions: parsed.opinions.map(({ sections, footnotes, ...opinion }) => ({
      ...opinion,
      chars: chars(sections.flatMap(s => s.items)) + chars(footnotes.flatMap(n => n.items)),
      footnote_count: footnotes.length,
      outline: sections.map(s => ({
        id: s.id,
        heading: s.heading,
        path: s.path,
        level: s.level,
        pdf_page: s.pdf_page,
        // The parts have no titles; their opening words say where one is in the contents.
        opening: s.items[0]?.text.slice(0, 80) ?? null,
      })),
    })),
  };
  return { head, opinions: parsed.opinions };
}

/** "25-332" → "25-332"; "145, Orig." → "145-orig"; "24A884" → "24a884" */
export const slugOfDocket = docket => docket.toLowerCase().replace(/,?\s*orig\.?$/, '-orig').replace(/[^a-z0-9-]+/g, '-');

/** How the decision came to be: on argument, summarily (per curiam without argument), or an original action. */
export function kindOf(parsed) {
  if ((parsed.docket_numbers ?? [parsed.docket_number]).some(d => /Orig/.test(d ?? ''))) return 'original';
  if (!parsed.argued_date && parsed.opinions[0]?.kind === 'per_curiam') return 'per_curiam';
  return 'argued';
}

/** Retry a request that failed for want of a connection (not one the server refused). */
export async function retrying(request, tries = 4) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await request();
    } catch (err) {
      if (attempt >= tries || err.response) throw err;
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
}

/** A PDF from the web, kept in the data directory after the first download (or a local file). */
export async function readPdf(url) {
  if (!/^https?:/.test(url)) return fs.readFileSync(url);
  const file = mirrorFile(url);
  if (!fs.existsSync(file)) {
    // supremecourt.gov turns away requests that do not look like a browser.
    const { data } = await retrying(() => axios.get(url, { responseType: 'arraybuffer', headers: { 'User-Agent': 'Mozilla/5.0 (govgraph)' } }));
    if (Buffer.from(data).subarray(0, 5).toString() !== '%PDF-') throw new Error(`not a PDF: ${url}`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(data));
  }
  return fs.readFileSync(file);
}

const normalName = name => (name ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, "'").toLowerCase();

/**
 * Votes and opinion authors as people: each surname in the outcome and on the opinions is
 * matched to the Justice of that name whose service covers the decision date (load-justices.js).
 * @returns names that matched no Justice
 */
export async function writeJustices(client, decisionId, date, head) {
  const { rows } = await client.query(
    `SELECT p.id, p.last_name FROM people p JOIN person_roles r ON r.person_id = p.id
      WHERE r.role_type IN ('justice', 'chief_justice') AND r.started_at <= $1 AND (r.ended_at IS NULL OR $1 <= r.ended_at)`,
    [date]
  );
  const idOf = new Map(rows.map(r => [normalName(r.last_name), r.id]));
  const unmatched = new Set();
  const find = name => {
    const id = idOf.get(normalName(name));
    if (name && !id) unmatched.add(name);
    return id ?? null;
  };

  await client.query('DELETE FROM court_votes WHERE decision_id = $1', [decisionId]);
  for (const justice of head.outcome?.justices ?? []) {
    const personId = find(justice.name);
    if (!personId) continue;
    await client.query(
      `INSERT INTO court_votes (decision_id, person_id, side, wrote, joined) VALUES ($1, $2, $3, $4, $5)`,
      [decisionId, personId, justice.side ?? 'none', justice.wrote ?? [], JSON.stringify(justice.joined ?? [])]
    );
  }
  for (const opinion of head.opinions ?? []) {
    await client.query(
      `UPDATE case_opinions SET author_id = $3 WHERE decision_id = $1 AND source_id LIKE '%/' || $2`,
      [decisionId, opinion.id, opinion.author ? find(opinion.author) : null]
    );
  }
  return [...unmatched];
}

/**
 * Store one parsed decision (created, or replacing the same decision loaded before) with its
 * opinions and votes, and point CourtListener's records of it at it.
 * @param link { clusterId, caseName, dateFiled, url } — the CourtListener record it was found by, if any
 * @returns { id, slug, unmatched }
 */
export async function storeDecision(client, parsed, link = null) {
  const court = parsed.court ?? 'scotus';
  const dockets = parsed.docket_numbers ?? (parsed.docket_number ? [parsed.docket_number] : []);
  const date = parsed.decided_date ?? link?.dateFiled;
  if (!dockets.length || !date) throw new Error('no docket number or decision date');

  // The same decision loaded before: same court, a shared docket, within a month.
  const existing = await client.query(
    `SELECT id, slug FROM court_decisions
      WHERE court = $1 AND docket_numbers && $2::text[] AND abs(date_decided - $3::date) <= 30
      ORDER BY abs(date_decided - $3::date) LIMIT 1`,
    [court, dockets, date]
  );
  let slug = existing.rows[0]?.slug;
  if (!slug) {
    const base = slugOfDocket(dockets[0]);
    const taken = await client.query('SELECT 1 FROM court_decisions WHERE court = $1 AND slug = $2', [court, base]);
    slug = taken.rows.length ? `${base}-${date}` : base;
  }

  const { head, opinions } = splitForStorage(parsed);
  const { rows: [naturalCourt] } = await client.query(
    'SELECT id FROM courts WHERE start_date <= $1 AND (end_date IS NULL OR $1 <= end_date) ORDER BY start_date DESC LIMIT 1',
    [date]
  );
  const paginated = parsed.citation && !/_/.test(parsed.citation);
  const outcome = parsed.outcome;
  const { rows: [decision] } = await client.query(
    `INSERT INTO court_decisions (court, docket_numbers, slug, name, term, date_argued, date_decided, kind, citation,
                                  slip_citation, disposition, vote_majority, vote_minority, vote_inferred,
                                  natural_court_id, pdf_url, structure, loaded_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, now())
     ON CONFLICT (court, slug) DO UPDATE SET
       docket_numbers = EXCLUDED.docket_numbers, name = EXCLUDED.name, term = EXCLUDED.term,
       date_argued = EXCLUDED.date_argued, date_decided = EXCLUDED.date_decided, kind = EXCLUDED.kind,
       citation = COALESCE(EXCLUDED.citation, court_decisions.citation), slip_citation = EXCLUDED.slip_citation,
       disposition = EXCLUDED.disposition, vote_majority = EXCLUDED.vote_majority, vote_minority = EXCLUDED.vote_minority,
       vote_inferred = EXCLUDED.vote_inferred, natural_court_id = EXCLUDED.natural_court_id, pdf_url = EXCLUDED.pdf_url,
       structure = EXCLUDED.structure, loaded_at = now()
     RETURNING id`,
    [
      court, dockets, slug, parsed.case_name ?? link?.caseName ?? parsed.caption ?? dockets[0],
      Number(/\d{4}/.exec(parsed.term ?? '')?.[0]) || null, parsed.argued_date, date, kindOf(parsed),
      paginated ? parsed.citation.replace(/U\. S\./, 'U.S.') : null, paginated ? null : parsed.citation,
      outcome?.disposition ?? parsed.syllabus?.disposition ?? null,
      outcome?.vote?.majority ?? null, outcome?.vote?.dissent ?? null, Boolean(outcome?.inferred),
      naturalCourt?.id ?? null, parsed.source?.pdf_url ?? null, JSON.stringify(head),
    ]
  );

  await client.query('DELETE FROM case_opinions WHERE decision_id = $1', [decision.id]);
  for (const [position, opinion] of opinions.entries()) {
    await client.query(
      `INSERT INTO case_opinions (decision_id, opinion_type, source_id, position, structure) VALUES ($1, $2, $3, $4, $5)`,
      [decision.id, opinion.kind, `${court}/${slug}/${opinion.id}`, position, JSON.stringify(opinion)]
    );
  }
  const unmatched = await writeJustices(client, decision.id, date, head);

  // CourtListener's records of this decision: the one it was found by, then every record of the
  // same docket from the decision date to a year after (revisions and the Reporter's version
  // come later; an order granting review, earlier, is not the decision).
  if (link?.clusterId) {
    await client.query(
      `INSERT INTO cases (name, docket_number, date_decided, source_id, source_url, decision_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (source_id) DO UPDATE SET decision_id = EXCLUDED.decision_id`,
      [link.caseName ?? parsed.case_name, dockets[0], link.dateFiled ?? date, String(link.clusterId), link.url ?? null, decision.id]
    );
  }
  await client.query(
    `UPDATE cases SET decision_id = $1
      WHERE regexp_replace(docket_number, '^No\\.\\s*', '') = ANY($2::text[])
        AND date_decided BETWEEN $3::date - 3 AND $3::date + 365
        AND (decision_id IS NULL OR decision_id = $1)`,
    [decision.id, dockets, date]
  );
  await adoptCitation(client, decision.id);
  return { id: decision.id, slug, unmatched };
}

/**
 * The decision's U.S. Reports citation ("597 U.S. 697"), once one of its CourtListener records
 * has it; the slip opinion only has a blank page ("597 U. S. ___").
 */
export async function adoptCitation(client, decisionId = null) {
  const { rowCount } = await client.query(
    `UPDATE court_decisions d SET citation = c.citation
       FROM (SELECT DISTINCT ON (decision_id) decision_id, citation FROM cases
              WHERE decision_id IS NOT NULL AND citation ~ '^\\d+ U\\.S\\. \\d+$'
              ORDER BY decision_id, date_decided DESC) c
      WHERE c.decision_id = d.id AND d.citation IS DISTINCT FROM c.citation
        AND ($1::uuid IS NULL OR d.id = $1)`,
    [decisionId]
  );
  return rowCount;
}

/** Re-match every stored decision's votes and authors to the Justices (after load-justices.js). */
export async function linkAllJustices(client) {
  const { rows } = await client.query(`SELECT id, date_decided::text AS date, structure FROM court_decisions WHERE structure IS NOT NULL`);
  const unmatched = new Set();
  for (const row of rows) for (const name of await writeJustices(client, row.id, row.date, row.structure)) unmatched.add(name);
  return { decisions: rows.length, unmatched: [...unmatched] };
}
