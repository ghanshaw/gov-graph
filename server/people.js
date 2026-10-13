// People: members of Congress, presidents and vice presidents (seed/load-people.js), their
// roles, and what they did in each: votes (member_votes), bills sponsored and cosponsored
// (bill_sponsors), bills signed or vetoed (bill_actions) and presidential documents.

import { pool } from './db.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const date = value => (DATE.test(value ?? '') ? value : null);
const today = () => new Date().toISOString().slice(0, 10);

// Terms a year or less apart are one stint (historical Congresses met months after the term began).
const STINT_GAP_DAYS = 366;
const daysBetween = (a, b) => (Date.parse(b) - Date.parse(a)) / 86400000;

// The existing president pages, by the year a presidency began.
export const PRESIDENT_SLUGS = { 2009: 'barack-obama', 2017: 'donald-trump', 2021: 'joseph-biden', 2025: 'donald-trump-47' };

// Bill actions recorded once per bill by the Library of Congress.
const PRESIDENTIAL_ACTION = `a.source_system = 'Library of Congress'
  AND a.description ~ '^(Signed|Vetoed|Pocket Vetoed) by President'`;

// Orders for the people list. Dates are those of the latest office (as the list shows them); no end
// date means still serving (Justices), so it counts as the latest.
const PEOPLE_ORDER = {
  name: 'p.sort_name, p.id',
  start_desc: 'x.start DESC NULLS LAST, p.sort_name, p.id',
  start_asc: 'x.start ASC NULLS LAST, p.sort_name, p.id',
  end_desc: 'x."end" DESC NULLS FIRST, p.sort_name, p.id',
  end_asc: 'x."end" ASC NULLS LAST, p.sort_name, p.id',
};

const ROLE_COLUMNS = `role_type AS "roleType", started_at::text AS start, ended_at::text AS "end", party, caucus,
  state, district, senate_class AS "senateClass", chamber, how`;

function groupStints(roles) {
  const stints = [];
  for (const role of roles) {
    const last = stints[stints.length - 1];
    const same = last && last.roleType === role.roleType && last.state === role.state
      && daysBetween(last.end ?? role.start, role.start) <= STINT_GAP_DAYS;
    if (same) {
      last.end = role.end;
      last.roles.push(role);
    } else {
      stints.push({ roleType: role.roleType, chamber: role.chamber, state: role.state, start: role.start, end: role.end, roles: [role] });
    }
  }
  return stints.map(stint => {
    const parties = [];
    for (const r of stint.roles) {
      const previous = parties[parties.length - 1];
      if (previous && previous.party === r.party) previous.end = r.end;
      else parties.push({ party: r.party, start: r.start, end: r.end });
    }
    const terms = new Set(stint.roles.map(r => r.start)).size - (parties.length - 1);
    return {
      key: `${stint.roleType}-${stint.start}`,
      roleType: stint.roleType,
      chamber: stint.chamber,
      state: stint.state,
      start: stint.start,
      end: stint.end,
      current: !stint.end || stint.end >= today(),
      terms: Math.max(1, terms),
      districts: [...new Set(stint.roles.map(r => r.district).filter(d => d != null))],
      parties,
      presidentSlug: stint.roleType === 'president' ? PRESIDENT_SLUGS[stint.start.slice(0, 4)] ?? null : null,
      // Justices (load-justices.js): "appointed by Ronald Reagan"
      appointedBy: /^appointed by /.test(stint.roles[0].how ?? '') ? stint.roles[0].how.replace(/^appointed by /, '') : null,
    };
  });
}

// What is stored for one stint, and the Congresses it falls in.
async function stintRecord(personId, stint) {
  const from = stint.start;
  const to = stint.end ?? '9999-12-31';
  const legislative = stint.roleType === 'representative' || stint.roleType === 'senator';
  const counts = { votes: 0, sponsored: 0, cosponsored: 0, signed: 0, vetoed: 0, orders: 0, memoranda: 0 };
  const congresses = new Set();

  if (legislative) {
    const { rows } = await pool.query(
      `SELECT 'votes' AS kind, r.congress_number AS congress, count(*)::int AS n
         FROM member_votes m JOIN roll_calls r ON r.id = m.roll_call_id
        WHERE m.person_id = $1 AND r.chamber = $4 AND r.vote_date >= $2 AND r.vote_date < $3
        GROUP BY r.congress_number
       UNION ALL
       SELECT CASE WHEN s.role = 'sponsor' THEN 'sponsored' ELSE 'cosponsored' END, l.congress_number, count(*)::int
         FROM bill_sponsors s JOIN legislation l ON l.id = s.legislation_id
        WHERE s.person_id = $1 AND COALESCE(s.sponsorship_date, l.introduced_date) >= $2
          AND COALESCE(s.sponsorship_date, l.introduced_date) < $3
        GROUP BY 1, l.congress_number`,
      [personId, from, to, stint.chamber]
    );
    for (const r of rows) { counts[r.kind] += r.n; congresses.add(r.congress); }
  }
  if (stint.roleType === 'president') {
    const { rows } = await pool.query(
      `SELECT CASE WHEN a.description LIKE 'Signed%' THEN 'signed' ELSE 'vetoed' END AS kind, l.congress_number AS congress,
              count(DISTINCT l.id)::int AS n
         FROM bill_actions a JOIN legislation l ON l.id = a.legislation_id
        WHERE ${PRESIDENTIAL_ACTION} AND a.action_date >= $1 AND a.action_date < $2
        GROUP BY 1, 2
       UNION ALL
       SELECT CASE WHEN doc_type = 'memorandum' THEN 'memoranda' ELSE 'orders' END, NULL, count(*)::int
         FROM executive_documents
        WHERE president_id = $3 AND signed_date >= $1 AND signed_date < $2
          AND source_id !~ '^[CR][0-9]-'
        GROUP BY 1`,
      [from, to, personId]
    );
    for (const r of rows) { counts[r.kind] += r.n; if (r.congress) congresses.add(r.congress); }
  }
  return { ...stint, counts, congresses: [...congresses].sort((a, b) => b - a) };
}

const billRef = r => (r.bill_type ? { congress: r.congress_number, type: r.bill_type, number: r.bill_number, title: r.title } : null);

const page = (value, fallback) => Math.max(1, Number(value) || fallback);

// Bioguide id → person id, read once (about 13,000 rows) for linking names from Congress.gov.
let personIds = null;
async function personIdByBioguide(bioguideId) {
  if (!bioguideId) return null;
  if (!personIds) {
    personIds = pool.query('SELECT id, bioguide_id FROM people WHERE bioguide_id IS NOT NULL')
      .then(({ rows }) => new Map(rows.map(r => [r.bioguide_id, r.id])))
      .catch(err => { personIds = null; throw err; });
  }
  return (await personIds).get(bioguideId) ?? null;
}

export const BillSponsor = {
  personId: sponsor => personIdByBioguide(sponsor.bioguideId).catch(() => null),
};

export const peopleQueries = {
  person: async (_, { id }) => {
    if (!UUID.test(id)) return null;
    const { rows: [person] } = await pool.query(
      `SELECT id, name, sort_name AS "sortName", gender, birth_date::text AS "birthDate", death_date::text AS "deathDate",
              bioguide_id AS "bioguideId", lis_id AS "lisId", wikidata_id AS "wikidataId", other_ids AS "otherIds"
         FROM people WHERE id = $1`,
      [id]
    );
    if (!person) return null;
    const { rows: roles } = await pool.query(
      `SELECT ${ROLE_COLUMNS} FROM person_roles WHERE person_id = $1 ORDER BY started_at, ended_at`,
      [id]
    );
    const stints = await Promise.all(groupStints(roles).map(stint => stintRecord(id, stint)));
    return { ...person, roles, stints: stints.reverse() };
  },

  people: async (_, { search, roleType, current, party, state, sort, page: pageNumber, perPage }) => {
    const size = Math.min(page(perPage, 50), 200);
    const current_ = page(pageNumber, 1);
    const where = [];
    const params = [];
    const add = (sql, value) => { params.push(value); where.push(sql.replace('?', `$${params.length}`)); };
    if (search?.trim()) add(`p.name ILIKE ?`, `%${search.trim()}%`);
    // "justice" includes the Chief Justice (a separate role, which some held without the other).
    if (roleType === 'justice') add(`x.role_types && ?::text[]`, ['justice', 'chief_justice']);
    else if (roleType) add(`? = ANY(x.role_types)`, roleType);
    // A Justice serves with no end date.
    if (current) add(`(x."end" IS NULL OR x."end" >= ?)`, today());
    if (party) add(`x.party = ?`, party);
    if (state) add(`x.state = ?`, state);
    const { rows } = await pool.query(
      `WITH latest AS (
         SELECT DISTINCT ON (person_id) person_id, role_type, state, party, ended_at
           FROM person_roles ORDER BY person_id, started_at DESC
       ), x AS (
         SELECT l.person_id, l.role_type, l.state, l.party, l.ended_at::text AS "end",
                (SELECT min(started_at)::text FROM person_roles r WHERE r.person_id = l.person_id AND r.role_type = l.role_type) AS start,
                (SELECT array_agg(DISTINCT role_type) FROM person_roles r WHERE r.person_id = l.person_id) AS role_types
           FROM latest l
       )
       SELECT p.id, p.name, p.sort_name AS "sortName", x.role_type AS "roleType", x.state, x.party, x.start, x."end",
              (x."end" IS NULL OR x."end" >= '${today()}') AS current, x.role_types AS "roleTypes", count(*) OVER ()::int AS total
         FROM people p JOIN x ON x.person_id = p.id
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY ${PEOPLE_ORDER[sort] ?? PEOPLE_ORDER.name}
        LIMIT ${size} OFFSET ${(current_ - 1) * size}`,
      params
    );
    const totalCount = rows[0]?.total ?? 0;
    return { people: rows, totalCount, currentPage: current_, totalPages: Math.ceil(totalCount / size) || 1 };
  },

  personVotes: async (_, { id, from, to, congress, position, page: pageNumber, perPage }) => {
    if (!UUID.test(id)) return { votes: [], totalCount: 0, positions: [] };
    const size = Math.min(page(perPage, 25), 100);
    const params = [id, date(from) ?? '0001-01-01', date(to) ?? '9999-12-31'];
    let filter = '';
    if (congress) { params.push(congress); filter += ` AND r.congress_number = $${params.length}`; }
    const base = `FROM member_votes m JOIN roll_calls r ON r.id = m.roll_call_id
                  LEFT JOIN legislation l ON l.id = r.legislation_id
                 WHERE m.person_id = $1 AND r.vote_date >= $2 AND r.vote_date < $3${filter}`;
    const { rows: positions } = await pool.query(
      `SELECT m.position, count(*)::int AS count ${base} GROUP BY m.position ORDER BY count DESC`, params
    );
    if (position) { params.push(position); filter = ` AND m.position = $${params.length}`; } else filter = '';
    const { rows } = await pool.query(
      `SELECT r.id, r.vote_date::text AS date, r.chamber, r.congress_number AS congress, r.session, r.roll_number,
              r.question, r.result, r.amendment, m.position, m.party,
              l.congress_number, l.bill_type, l.bill_number, l.title, count(*) OVER ()::int AS total
         ${base}${filter}
        ORDER BY r.vote_date DESC, r.roll_number DESC
        LIMIT ${size} OFFSET ${(page(pageNumber, 1) - 1) * size}`,
      params
    );
    return {
      votes: rows.map(r => ({
        rollCallId: r.id, date: r.date, chamber: r.chamber, congress: r.congress, session: r.session,
        rollNumber: r.roll_number, question: r.question, result: r.result, amendment: r.amendment,
        position: r.position, party: r.party, bill: billRef(r),
      })),
      totalCount: rows[0]?.total ?? 0,
      positions,
    };
  },

  personBills: async (_, { id, role, from, to, congress, page: pageNumber, perPage }) => {
    if (!UUID.test(id) || !['sponsor', 'cosponsor'].includes(role)) return { bills: [], totalCount: 0 };
    const size = Math.min(page(perPage, 25), 100);
    const params = [id, role, date(from) ?? '0001-01-01', date(to) ?? '9999-12-31'];
    let filter = '';
    if (congress) { params.push(congress); filter = ` AND l.congress_number = $${params.length}`; }
    const { rows } = await pool.query(
      `SELECT l.congress_number, l.bill_type, l.bill_number, l.title, l.introduced_date::text AS introduced,
              s.sponsorship_date::text AS sponsored, s.is_original, s.withdrawn_date::text AS withdrawn,
              l.details->'latestAction'->>'text' AS latest, l.details->'latestAction'->>'date' AS latest_date,
              count(*) OVER ()::int AS total
         FROM bill_sponsors s JOIN legislation l ON l.id = s.legislation_id
        WHERE s.person_id = $1 AND s.role = $2
          AND COALESCE(s.sponsorship_date, l.introduced_date) >= $3 AND COALESCE(s.sponsorship_date, l.introduced_date) < $4${filter}
        ORDER BY COALESCE(s.sponsorship_date, l.introduced_date) DESC, l.bill_type, l.bill_number::int DESC
        LIMIT ${size} OFFSET ${(page(pageNumber, 1) - 1) * size}`,
      params
    );
    return {
      bills: rows.map(r => ({
        bill: billRef(r), introducedDate: r.introduced, sponsorshipDate: r.sponsored, isOriginal: r.is_original,
        withdrawnDate: r.withdrawn, latestAction: r.latest, latestActionDate: r.latest_date,
      })),
      totalCount: rows[0]?.total ?? 0,
    };
  },

  personPresidentialActions: async (_, { from, to }) => {
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (l.id, kind) a.action_date::text AS date,
              CASE WHEN a.description LIKE 'Signed%' THEN 'signed'
                   WHEN a.description LIKE 'Pocket%' THEN 'pocket vetoed' ELSE 'vetoed' END AS kind,
              l.congress_number, l.bill_type, l.bill_number, l.title, l.public_law_number
         FROM bill_actions a JOIN legislation l ON l.id = a.legislation_id
        WHERE ${PRESIDENTIAL_ACTION} AND a.action_date >= $1 AND a.action_date < $2
        ORDER BY l.id, kind, a.action_date`,
      [date(from) ?? '0001-01-01', date(to) ?? '9999-12-31']
    );
    return rows
      .map(r => ({ date: r.date, action: r.kind, bill: billRef(r), law: r.public_law_number }))
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  },
};
