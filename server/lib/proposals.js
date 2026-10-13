/**
 * Proposals: what the public sees as one attempt at one law. Every bill belongs to one. A House
 * bill and a Senate bill that are the same proposal share one; any other bill is one of its own.
 *
 * Built from `bill_relationships` (seed/load-bill-status-bulk.js, seed/add-bill-relationship.js)
 * and rebuilt whole for a Congress each time, so the relationships stay the only source of truth.
 *
 * What counts as the same proposal, strongest first:
 *   'Identical bill' — Congress.gov's (identified by CRS, the House or the Senate) or ours;
 *   'Same text'      — ours, at least 90% of the introduced texts in common (seed/match-bill-texts.js);
 *   'Similar text'   — ours, 60–90% in common: the same effort, its versions drifted apart.
 * Congress.gov often marks such bills only "Related bill", because its "identical" means word for word.
 *
 * Pairing rule. These links, taken transitively, merge bills that are separate measures:
 * same-text resolutions filed one after another in one chamber, or a resolution re-filed each
 * year with CRS linking every year's copies. So a House bill and a Senate bill are paired only
 * when each is the other's best match in the other chamber: the strongest link, then the
 * closest introduction date, then the lower number. A bill matching several bills in the other
 * chamber may therefore stay unpaired; its links still show on the bill page.
 */

import { valuesClause } from './data-dir.js';

export const PROPOSALS_SCHEMA = `
  CREATE TABLE IF NOT EXISTS proposals (
    id                  TEXT PRIMARY KEY,      -- the lead bill, lower case: '119-hr-2'
    congress            INT  NOT NULL,
    lead_legislation_id UUID NOT NULL REFERENCES legislation(id) ON DELETE CASCADE,
    title               TEXT,                  -- the lead bill's title
    introduced_date     DATE,                  -- the earliest of its bills
    latest_action_date  DATE                   -- the latest of its bills
  );
  CREATE INDEX IF NOT EXISTS proposals_congress_idx ON proposals (congress, introduced_date);
  ALTER TABLE legislation ADD COLUMN IF NOT EXISTS proposal_id TEXT REFERENCES proposals(id) ON DELETE SET NULL;
  CREATE INDEX IF NOT EXISTS legislation_proposal_id_idx ON legislation (proposal_id);
`;

const HOUSE_TYPES = new Set(['hr', 'hres', 'hjres', 'hconres']);
const chamber = bill => (HOUSE_TYPES.has(bill.type) ? 'House' : 'Senate');
const day = date => (date ? Date.parse(date) / 86_400_000 : null);
const gap = (a, b) => (a.day == null || b.day == null ? Infinity : Math.abs(a.day - b.day));

// Lead bill of a proposal: earliest introduced, House before Senate on the same day, then lower number.
function leadOrder(a, b) {
  return (a.day ?? Infinity) - (b.day ?? Infinity)
    || (chamber(a) === chamber(b) ? 0 : chamber(a) === 'House' ? -1 : 1)
    || Number(a.number) - Number(b.number);
}

// How strongly a kind of link says two bills are one proposal (see above).
export const PAIRING_STRENGTH = { 'Identical bill': 3, 'Same text': 2, 'Similar text': 1 };

/**
 * Pairs of bill ids to put together, from links between bills of the same Congress.
 * bills: Map id → { id, type, number, day }; links: [{ a, b, strength }] (either direction,
 * repeats allowed; strength defaults to 1); excluded: Set of "id~id" keys (sorted) never to pair.
 */
export function pairBills(bills, links, excluded = new Set()) {
  const pairKey = (a, b) => [a, b].sort().join('~');
  const candidates = new Map(); // bill id → Map(id of a bill in the other chamber → strongest link)
  for (const { a, b, strength = 1 } of links) {
    const x = bills.get(a), y = bills.get(b);
    if (!x || !y || a === b || chamber(x) === chamber(y) || excluded.has(pairKey(a, b))) continue;
    for (const [from, to] of [[a, b], [b, a]]) {
      if (!candidates.has(from)) candidates.set(from, new Map());
      const others = candidates.get(from);
      others.set(to, Math.max(others.get(to) ?? 0, strength));
    }
  }
  const closest = new Map();
  for (const [id, others] of candidates) {
    const self = bills.get(id);
    const [best] = [...others].sort(([p, ps], [q, qs]) => qs - ps
      || gap(self, bills.get(p)) - gap(self, bills.get(q))
      || Number(bills.get(p).number) - Number(bills.get(q).number));
    closest.set(id, best[0]);
  }
  const pairs = [];
  for (const [id, other] of closest) {
    if (id < other && closest.get(other) === id) pairs.push([id, other]);
  }
  return pairs;
}

/**
 * Rebuild the proposals of one Congress. Runs inside the caller's transaction (the bulk
 * loader's dry run wraps everything in one it rolls back). Returns { proposals, paired }.
 */
export async function buildProposals(client, congress) {
  const { rows } = await client.query(
    `SELECT id, lower(bill_type) AS type, bill_number AS number, title,
            introduced_date::text AS introduced, details->'latestAction'->>'date' AS latest
       FROM legislation WHERE congress_number = $1`,
    [congress]
  );
  const bills = new Map(rows.map(r => [r.id, { ...r, day: day(r.introduced) }]));

  const { rows: links } = await client.query(
    `SELECT r.legislation_id AS a, r.related_legislation_id AS b, r.relationship
       FROM bill_relationships r
       JOIN legislation l ON l.id = r.legislation_id
      WHERE l.congress_number = $1 AND r.related_legislation_id IS NOT NULL
        AND r.relationship = ANY($2)`,
    [congress, [...Object.keys(PAIRING_STRENGTH), 'Not identical']]
  );
  // "Not identical" is our own override of any of these links (seed/add-bill-relationship.js).
  const excluded = new Set(links.filter(l => l.relationship === 'Not identical').map(l => [l.a, l.b].sort().join('~')));
  const pairs = pairBills(
    bills,
    links.filter(l => PAIRING_STRENGTH[l.relationship]).map(l => ({ ...l, strength: PAIRING_STRENGTH[l.relationship] })),
    excluded
  );

  const groups = pairs.map(pair => pair.map(id => bills.get(id)));
  const paired = new Set(pairs.flat());
  for (const bill of bills.values()) if (!paired.has(bill.id)) groups.push([bill]);

  const proposals = groups.map(members => {
    const sorted = [...members].sort(leadOrder);
    const lead = sorted[0];
    const latest = members.map(m => m.latest).filter(Boolean).sort().at(-1) ?? null;
    return {
      id: `${congress}-${lead.type}-${lead.number}`,
      lead, members, latest,
      introduced: sorted.map(m => m.introduced).find(Boolean) ?? null,
    };
  });

  await client.query('UPDATE legislation SET proposal_id = NULL WHERE congress_number = $1 AND proposal_id IS NOT NULL', [congress]);
  await client.query('DELETE FROM proposals WHERE congress = $1', [congress]);
  for (let start = 0; start < proposals.length; start += 1000) {
    const chunk = proposals.slice(start, start + 1000);
    const values = valuesClause(chunk.map(p => [p.id, congress, p.lead.id, p.lead.title, p.introduced, p.latest]));
    await client.query(
      `INSERT INTO proposals (id, congress, lead_legislation_id, title, introduced_date, latest_action_date)
       SELECT v.id, v.congress::int, v.lead::uuid, v.title, v.introduced::date, v.latest::date
         FROM (VALUES ${values.sql}) AS v(id, congress, lead, title, introduced, latest)`,
      values.params
    );
    const members = valuesClause(chunk.flatMap(p => p.members.map(m => [m.id, p.id])));
    await client.query(
      `UPDATE legislation l SET proposal_id = v.proposal
         FROM (VALUES ${members.sql}) AS v(id, proposal)
        WHERE l.id = v.id::uuid`,
      members.params
    );
  }
  return { proposals: proposals.length, paired: pairs.length };
}
