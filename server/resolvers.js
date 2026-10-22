import axios from 'axios';
import NodeCache from 'node-cache';
import { GraphQLScalarType } from 'graphql';
import { NATURAL_COURTS, naturalCourtOn } from './naturalCourts.js';
import { CONGRESSES } from './congresses.js';
import { pool } from './db.js';
import { enactedLaws } from './lib/enacted-laws.js';
import { peopleQueries, BillSponsor } from './people.js';
import { timelineQueries } from './timeline.js';
import { reportQueries } from './reports.js';
import { sourceQueries, sourceResolvers } from './sources.js';
import { economicQueries, economicResolvers } from './economic.js';
import { uscQueries } from './usc.js';
import { tagQueries, tagMutations } from './tags.js';
import { userQueries } from './users.js';
import { favoriteQueries, favoriteMutations } from './favorites.js';
import { populationQueries } from './population.js';
import { withUscReferences } from './lib/usc-references.js';
import { parseBillQuery, KIND_WEIGHT } from './lib/bill-search.js';

const cache = new NodeCache({ stdTTL: 600 });

// ---------------------------------------------------------------------------
// Court decisions (court_decisions; lib/decision-storage.js). Nothing here asks CourtListener:
// its ids are kept on `cases` rows only to redirect old links.

const DECISION_COLUMNS = `
  d.id, d.court, d.slug, d.name, d.docket_numbers, d.date_argued::text AS date_argued,
  d.date_decided::text AS date_decided, d.kind, d.citation, d.slip_citation, d.disposition,
  d.vote_majority, d.vote_minority, d.vote_inferred, d.pdf_url, d.date_decided AS decided_on`;

function mapDecision(row, withStructure = false) {
  return {
    id: row.id,
    court: row.court,
    slug: row.slug,
    naturalCourt: naturalCourtOn(row.date_decided),
    name: row.name,
    docketNumbers: row.docket_numbers,
    dateArgued: row.date_argued,
    dateDecided: row.date_decided,
    kind: row.kind,
    citation: row.citation,
    slipCitation: row.slip_citation,
    disposition: row.disposition,
    voteMajority: row.vote_majority,
    voteMinority: row.vote_minority,
    voteInferred: row.vote_inferred,
    pdfUrl: row.pdf_url,
    ...(withStructure && { structure: row.structure }),
  };
}

/** A decision as a row of a list (ScotusCase). */
function decisionListItem(row) {
  return {
    id: row.slug,
    caseName: row.name,
    dateFiled: row.date_decided,
    citation: row.citation ?? row.slip_citation,
    docketNumber: row.docket_numbers.join(', '),
    year: Number(row.date_decided.slice(0, 4)),
    kind: row.kind,
    disposition: row.disposition,
    votesMajority: row.vote_majority,
    votesMinority: row.vote_minority,
    decisionDirection: null,
  };
}

/** A natural court's decisions, newest or oldest first; `loaded` is false when it has none yet. */
async function naturalCourtDecisions({ court, page = 1, perPage = 20, search, orderBy, year }) {
  const from = year ? `${year}-01-01` : court.startDate;
  const to = year ? `${year}-12-31` : court.endDate;
  const inCourt = [`d.court = 'scotus'`, `d.date_decided >= $1`, ...(court.endDate ? [`d.date_decided <= $2`] : [])];
  const params = [court.startDate, ...(court.endDate ? [court.endDate] : [])];
  const { rows: [{ n: courtTotal }] } = await pool.query(`SELECT count(*)::int AS n FROM court_decisions d WHERE ${inCourt.join(' AND ')}`, params);
  if (!courtTotal) return { cases: [], totalCount: 0, currentPage: 1, totalPages: 1, loaded: false };

  const where = [`d.court = 'scotus'`];
  const values = [];
  const add = (sql, value) => { values.push(value); where.push(sql.replace('?', `$${values.length}`)); };
  add('d.date_decided >= ?', from);
  if (to) add('d.date_decided <= ?', to);
  if (search) add('d.name ILIKE ?', `%${search}%`);
  const dir = /asc/i.test(orderBy ?? '') ? 'ASC' : 'DESC';
  const filter = where.join(' AND ');
  const [{ rows }, { rows: [{ n }] }] = await Promise.all([
    pool.query(
      `SELECT ${DECISION_COLUMNS} FROM court_decisions d WHERE ${filter}
        ORDER BY d.date_decided ${dir}, d.name LIMIT ${Number(perPage)} OFFSET ${(Number(page) - 1) * Number(perPage)}`,
      values
    ),
    pool.query(`SELECT count(*)::int AS n FROM court_decisions d WHERE ${filter}`, values),
  ]);
  return { cases: rows.map(decisionListItem), totalCount: n, currentPage: page, totalPages: Math.ceil(n / perPage) || 1, loaded: true };
}

const CONGRESS_BASE = 'https://api.congress.gov/v3';

function congressParams(extra = {}) {
  return { api_key: process.env.CONGRESS_API_KEY, format: 'json', ...extra };
}

// A bill as stored in `legislation` (seed/load-bill-status-bulk.js) → the API's Bill.
const STORED_BILL_COLUMNS = `l.congress_number, l.bill_type, l.bill_number, l.title, l.introduced_date::text AS introduced, l.details`;
const storedBill = row => mapBill({
  congress: row.congress_number,
  type: row.bill_type.toUpperCase(),
  number: row.bill_number,
  title: row.title,
  introducedDate: row.introduced,
  latestAction: row.details?.latestAction && { actionDate: row.details.latestAction.date, text: row.details.latestAction.text },
  sponsors: row.details?.sponsors,
  policyArea: row.details?.policyArea ? { name: row.details.policyArea } : null,
  url: row.details?.url,
});

/**
 * A page of a Congress's bills from the database, by introduction date (bills introduced the
 * same day by number). Null when the Congress's bill history has not been loaded.
 *
 * Where the Congress's proposals are built (lib/proposals.js), a page lists proposals: an
 * identical House and Senate bill share a row, led by the earlier one, with the other in
 * `companions`. A proposal is listed when any of its bills matches the filters.
 */
async function storedBills({ congress, billType, page, perPage, search, year, oldest }) {
  const loaded = await pool.query(
    'SELECT 1 FROM legislation WHERE congress_number = $1 AND introduced_date IS NOT NULL LIMIT 1',
    [congress]
  );
  if (!loaded.rows.length) return null;

  const where = ['l.congress_number = $1', 'l.introduced_date IS NOT NULL'];
  const params = [congress];
  if (billType) { params.push(billType.toLowerCase()); where.push(`lower(l.bill_type) = $${params.length}`); }
  if (year) { params.push(year); where.push(`extract(year FROM l.introduced_date) = $${params.length}`); }
  if (search) { params.push(`%${search}%`); where.push(`l.title ILIKE $${params.length}`); }
  const dir = oldest ? 'ASC' : 'DESC';
  const filter = where.join(' AND ');
  const limit = `LIMIT ${Number(perPage)} OFFSET ${(Number(page) - 1) * Number(perPage)}`;
  const order = oldest ? 'introduced-oldest' : 'introduced';

  const grouped = await pool.query('SELECT 1 FROM proposals WHERE congress = $1 LIMIT 1', [congress])
    .then(res => res.rows.length > 0, () => false);

  if (!grouped) {
    const [{ rows }, count] = await Promise.all([
      pool.query(
        `SELECT ${STORED_BILL_COLUMNS} FROM legislation l WHERE ${filter}
          ORDER BY l.introduced_date ${dir}, l.bill_number::int ${dir} ${limit}`,
        params
      ),
      pool.query(`SELECT count(*)::int AS n FROM legislation l WHERE ${filter}`, params),
    ]);
    const totalCount = count.rows[0].n;
    return {
      bills: rows.map(storedBill), totalCount, billCount: totalCount, currentPage: page,
      totalPages: Math.ceil(totalCount / perPage) || 1, order,
    };
  }

  const matched = `SELECT DISTINCT l.proposal_id FROM legislation l WHERE ${filter} AND l.proposal_id IS NOT NULL`;
  const [{ rows }, count] = await Promise.all([
    pool.query(
      `SELECT p.id AS proposal_id, l.id AS lead_id, ${STORED_BILL_COLUMNS}
         FROM proposals p
         JOIN (${matched}) m ON m.proposal_id = p.id
         JOIN legislation l ON l.id = p.lead_legislation_id
        ORDER BY p.introduced_date ${dir} NULLS LAST, l.bill_number::int ${dir} ${limit}`,
      params
    ),
    pool.query(
      `SELECT (SELECT count(*)::int FROM (${matched}) m) AS proposals,
              (SELECT count(*)::int FROM legislation l WHERE ${filter}) AS bills`,
      params
    ),
  ]);

  // The other bills of the proposals on this page, in one query.
  const { rows: others } = rows.length
    ? await pool.query(
        `SELECT l.proposal_id, ${STORED_BILL_COLUMNS} FROM legislation l
          WHERE l.proposal_id = ANY($1) AND NOT (l.id = ANY($2::uuid[]))
          ORDER BY l.introduced_date, l.bill_number::int`,
        [rows.map(r => r.proposal_id), rows.map(r => r.lead_id)]
      )
    : { rows: [] };

  const totalCount = count.rows[0].proposals;
  return {
    bills: rows.map(row => ({
      ...storedBill(row),
      companions: others.filter(o => o.proposal_id === row.proposal_id).map(storedBill),
    })),
    totalCount,
    billCount: count.rows[0].bills,
    currentPage: page,
    totalPages: Math.ceil(totalCount / perPage) || 1,
    order,
  };
}

/**
 * Bills matching a search box, best match first, across every Congress or one.
 *
 * A search that is a bill or law number ("H.R. 1", "119-hr-1", "P.L. 119-21"; lib/bill-search.js)
 * finds that bill, in every Congress loaded unless one is named. Anything else is matched word by
 * word (Postgres full-text search, English stemming) against every title a bill has been known by
 * (`bill_titles`, including our own names), and against `legislation.title` for bills whose
 * status file is not loaded. A match
 * on a popular or short title counts more than one on the long official title, the whole phrase
 * more than scattered words, and an enacted bill a little more. Where proposals are built, an
 * identical House and Senate bill share a row, as in the session list.
 */
async function billSearch({ query, congress, billType, year, page = 1, perPage = 20 }) {
  const identifier = parseBillQuery(query);
  const params = [];
  const param = value => { params.push(value); return `$${params.length}`; };

  let hits;
  if (identifier?.kind === 'bill') {
    hits = `SELECT l.id, NULL::text AS title, NULL::text AS title_type, 100::float AS score FROM legislation l
      WHERE lower(l.bill_type) = ${param(identifier.type)} AND l.bill_number = ${param(identifier.number)}
      ${identifier.congress ? `AND l.congress_number = ${param(identifier.congress)}` : ''}`;
  } else if (identifier?.kind === 'law') {
    const law = JSON.stringify([{ type: identifier.lawType === 'private' ? 'Private Law' : 'Public Law', number: `${identifier.congress}-${identifier.number}` }]);
    hits = `SELECT l.id, NULL::text AS title, NULL::text AS title_type, 100::float AS score FROM legislation l
      WHERE l.congress_number = ${param(identifier.congress)} AND l.details->'laws' @> ${param(law)}::jsonb`;
  } else {
    const q = param(query.trim());
    const weight = `CASE t.kind ${Object.entries(KIND_WEIGHT).map(([k, w]) => `WHEN '${k}' THEN ${w}`).join(' ')} ELSE 1 END`;
    // Exact title 20, whole phrase 6, then the kind of title, then rank (shorter titles rank higher).
    // The search is parsed once (q), not for every title it is compared with.
    const score = (title, words, kindWeight) => `${kindWeight}
      + CASE WHEN lower(${title}) = q.raw THEN 20 WHEN ${words} @@ q.phrase THEN 6 ELSE 0 END
      + ts_rank_cd(${words}, q.words, 2)`;
    hits = `WITH q AS MATERIALIZED (
        SELECT websearch_to_tsquery('english', ${q}) AS words, phraseto_tsquery('english', ${q}) AS phrase, lower(${q}) AS raw
      )
      SELECT DISTINCT ON (id) id, title, title_type, score FROM (
        SELECT t.legislation_id AS id, t.title, t.title_type, ${score('t.title', 't.search', weight)} AS score
          FROM q JOIN bill_titles t ON t.search @@ q.words
        UNION ALL
        -- Bills whose status file is not loaded have only the title on their row.
        SELECT l.id, l.title, NULL, ${score('l.title', 'l.title_search', KIND_WEIGHT.display)}
          FROM q JOIN legislation l ON l.title_search @@ q.words AND l.details IS NULL
      ) h ORDER BY id, score DESC`;
  }

  const where = [];
  if (congress) where.push(`l.congress_number = ${param(congress)}`);
  if (billType) where.push(`lower(l.bill_type) = ${param(billType.toLowerCase())}`);
  if (year) where.push(`extract(year FROM l.introduced_date) = ${param(year)}`);

  // A number names one bill, so it leads its own row; words group a proposal's bills.
  const group = identifier ? `l.id::text` : `coalesce(l.proposal_id, l.id::text)`;
  const matched = `
    WITH hits AS (${hits}),
    scored AS (
      SELECT l.id, l.congress_number, l.introduced_date, ${group} AS grp, h.title, h.title_type,
             h.score + CASE WHEN l.public_law_number IS NOT NULL THEN 4 ELSE 0 END AS score
        FROM hits h JOIN legislation l ON l.id = h.id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    )`;
  const groups = `SELECT DISTINCT ON (grp) * FROM scored ORDER BY grp, score DESC`;

  const limit = `LIMIT ${Number(perPage)} OFFSET ${(Number(page) - 1) * Number(perPage)}`;
  // One query, so the matching is done once: the counts on a one-row head, the page joined to it.
  const { rows: result } = await pool.query(
    `${matched}, g AS (${groups}),
     stats AS (
       SELECT (SELECT count(*)::int FROM g) AS row_count, (SELECT count(*)::int FROM scored) AS bill_count,
              (SELECT coalesce(json_agg(c ORDER BY c.congress DESC), '[]')
                 FROM (SELECT congress_number AS congress, count(*)::int AS count FROM scored GROUP BY 1) c) AS by_congress
     )
     SELECT stats.*, page.* FROM stats LEFT JOIN LATERAL (
       SELECT g.title AS matched_title, g.title_type AS matched_title_type, l.id AS lead_id, l.proposal_id, ${STORED_BILL_COLUMNS}
         FROM g
         LEFT JOIN proposals p ON p.id = g.grp
         JOIN legislation l ON l.id = CASE WHEN p.id IS NULL THEN g.id ELSE p.lead_legislation_id END
        ORDER BY g.score DESC, g.congress_number DESC, g.introduced_date DESC NULLS LAST ${limit}
     ) page ON true`,
    params
  );
  const count = { rows: result[0].row_count, bills: result[0].bill_count };
  const byCongress = result[0].by_congress;
  const rows = result.filter(r => r.lead_id);

  // The other bills of the proposals on this page, in one query.
  const { rows: others } = rows.some(r => r.proposal_id)
    ? await pool.query(
      `SELECT l.proposal_id, ${STORED_BILL_COLUMNS} FROM legislation l
        WHERE l.proposal_id = ANY($1) AND NOT (l.id = ANY($2::uuid[]))
        ORDER BY l.introduced_date, l.bill_number::int`,
      [rows.map(r => r.proposal_id).filter(Boolean), rows.map(r => r.lead_id)]
    )
    : { rows: [] };

  return {
    bills: rows.map(row => ({
      ...storedBill(row),
      // Shown only where it says something the bill's own title does not.
      matchedTitle: row.matched_title && row.matched_title.toLowerCase() !== (row.title ?? '').toLowerCase() ? row.matched_title : null,
      matchedTitleType: row.matched_title_type,
      companions: row.proposal_id ? others.filter(o => o.proposal_id === row.proposal_id).map(storedBill) : [],
    })),
    totalCount: count.rows,
    billCount: count.bills,
    currentPage: page,
    totalPages: Math.ceil(count.rows / perPage) || 1,
    identifier,
    congressCounts: byCongress,
  };
}

function mapBill(doc) {
  const date = doc.introducedDate || null;
  const latest = doc.latestAction || {};
  const sponsor = (doc.sponsors || [])[0] || null;
  return {
    id: `${doc.congress}-${doc.type}-${doc.number}`,
    number: String(doc.number),
    type: doc.type,
    congress: doc.congress,
    title: doc.title || null,
    introducedDate: date,
    latestActionDate: latest.actionDate || null,
    latestActionText: latest.text || null,
    sponsor: sponsor ? {
      fullName: sponsor.fullName || null,
      party: sponsor.party || null,
      state: sponsor.state || null,
      bioguideId: sponsor.bioguideId || null,
    } : null,
    policyArea: doc.policyArea?.name || null,
    url: doc.url || null,
    year: date ? parseInt(date.split('-')[0]) : null,
  };
}

const BASE_URL = 'https://www.federalregister.gov/api/v1/documents';

const PRESIDENT_API_SLUG = {
  'barack-obama': 'barack-obama',
  'donald-trump':    'donald-trump',
  'donald-trump-47': 'donald-trump',
  'joseph-biden': 'joe-biden',
};

// The Federal Register has one identifier for both Trump terms; a term is told apart by signing date.
const TERM_SIGNING_DATES = {
  'donald-trump':    { lte: '2021-01-20' },
  'donald-trump-47': { gte: '2025-01-20' },
};

// Federal Register search conditions shared by the order list and its year counts.
function orderConditions({ president, documentType, search, year }) {
  const params = { 'conditions[presidential_document_type]': documentType };
  if (president) params['conditions[president]'] = PRESIDENT_API_SLUG[president] || president;
  if (search) params['conditions[term]'] = search;
  if (year) {
    params['conditions[signing_date][gte]'] = `${year}-01-01`;
    params['conditions[signing_date][lte]'] = `${year}-12-31`;
  } else {
    const term = TERM_SIGNING_DATES[president] || {};
    if (term.gte) params['conditions[signing_date][gte]'] = term.gte;
    if (term.lte) params['conditions[signing_date][lte]'] = term.lte;
  }
  return params;
}

function mapOrder(doc) {
  const date = doc.signing_date || doc.publication_date || null;
  return {
    number: doc.executive_order_number ? String(doc.executive_order_number) : null,
    documentNumber: doc.document_number || null,
    citation: doc.citation || null,
    title: doc.title || null,
    dateSigned: date,
    abstract: doc.abstract || null,
    url: doc.html_url || null,
    fullTextUrl: doc.full_text_xml_url || doc.raw_text_url || null,
    bodyHtmlUrl: doc.body_html_url || null,
    pdfUrl: doc.pdf_url || null,
    topics: doc.topics || [],
    year: date ? parseInt(date.split('-')[0]) : null,
    president: doc.president?.identifier || (typeof doc.president === 'string' ? doc.president : null),
  };
}

export const resolvers = {
  JSON: new GraphQLScalarType({
    name: 'JSON',
    description: 'Arbitrary JSON value, passed through as stored.',
  }),

  Query: {
    ...peopleQueries,
    ...timelineQueries,
    ...reportQueries,
    ...sourceQueries,
    ...economicQueries,
    ...uscQueries,
    ...tagQueries,
    ...userQueries,
    ...favoriteQueries,
    ...populationQueries,
    executiveOrders: async (_, { president, documentType = 'executive_order', page = 1, perPage = 20, search, year, order }) => {
      // Federal Register sort orders; anything else falls back to oldest first.
      const sortOrder = ['newest', 'oldest', 'relevance'].includes(order) ? order : 'oldest';
      const cacheKey = `eos:${president || 'all'}:${documentType}:${page}:${perPage}:${search || ''}:${year || ''}:${sortOrder}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const params = {
        ...orderConditions({ president, documentType, search, year }),
        'fields[]': [
          'document_number',
          'citation',
          'executive_order_number',
          'title',
          'signing_date',
          'publication_date',
          'abstract',
          'html_url',
          'full_text_xml_url',
          'raw_text_url',
          'topics',
          'president',
        ],
        per_page: perPage,
        page,
        order: sortOrder,
      };

      const response = await axios.get(BASE_URL, { params });
      const { results, count, total_pages } = response.data;

      const result = {
        orders: (results || []).map(mapOrder),
        totalCount: count || 0,
        currentPage: page,
        totalPages: total_pages || 1,
      };

      cache.set(cacheKey, result);
      return result;
    },

    // One count request per year, with the list's own conditions, so each number matches
    // what choosing that year shows. (The Federal Register's yearly facets count by
    // publication date, not signing date.)
    executiveOrderYearCounts: async (_, { president, documentType = 'executive_order', search, years }) => {
      const cacheKey = `eo-years:${president || 'all'}:${documentType}:${search || ''}:${years.join(',')}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const result = await Promise.all(years.map(async year => {
        const params = {
          ...orderConditions({ president, documentType, search, year }),
          'fields[]': ['document_number'],
          per_page: 1,
        };
        const response = await axios.get(BASE_URL, { params });
        return { year, count: response.data.count || 0 };
      }));

      cache.set(cacheKey, result);
      return result;
    },

    executiveOrder: async (_, { number }) => {
      const cacheKey = `eo:${number}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const params = {
        'conditions[presidential_document_type]': 'executive_order',
        'conditions[executive_order_numbers][]': parseInt(number, 10),
        'fields[]': [
          'document_number', 'executive_order_number', 'title', 'signing_date', 'publication_date',
          'abstract', 'html_url', 'full_text_xml_url', 'raw_text_url', 'body_html_url', 'pdf_url', 'topics', 'president',
        ],
        per_page: 5,
      };

      const response = await axios.get(BASE_URL, { params });
      const results = response.data.results || [];
      if (!results.length) return null;

      // Correction / republication notices (C1-…, R1-…) share the order's number.
      const order = mapOrder(results.find(r => !/^[CRZ]\d-/.test(r.document_number ?? '')) ?? results[0]);
      cache.set(cacheKey, order);
      return order;
    },

    presidentialDocument: async (_, { documentNumber }) => {
      if (!/^[A-Za-z0-9-]+$/.test(documentNumber)) return null;
      const cacheKey = `doc:${documentNumber}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      try {
        const response = await axios.get(`${BASE_URL}/${documentNumber}.json`, {
          params: {
            'fields[]': [
              'document_number', 'executive_order_number', 'title', 'signing_date', 'publication_date',
              'abstract', 'html_url', 'full_text_xml_url', 'raw_text_url', 'body_html_url', 'pdf_url', 'topics', 'president',
            ],
          },
        });
        const document = mapOrder(response.data);
        cache.set(cacheKey, document);
        return document;
      } catch (err) {
        if (err.response?.status === 404) return null;
        throw err;
      }
    },

    executiveOrderText: async (_, { number }) => {
      const cacheKey = `eo-text:${number}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const params = {
        'conditions[presidential_document_type]': 'executive_order',
        'conditions[executive_order_numbers][]': parseInt(number, 10),
        'fields[]': ['body_html_url'],
        per_page: 1,
      };

      const metaResponse = await axios.get(BASE_URL, { params });
      const results = metaResponse.data.results || [];
      if (!results.length || !results[0].body_html_url) return null;

      const textResponse = await axios.get(results[0].body_html_url);
      const html = textResponse.data;
      cache.set(cacheKey, html);
      return html;
    },

    naturalCourts: () => NATURAL_COURTS,

    naturalCourt: (_, { slug }) => NATURAL_COURTS.find(c => c.slug === slug) || null,

    scotusCases: async (_, { courtSlug, page = 1, perPage = 20, search, orderBy = 'dateFiled desc', year }) => {
      const court = NATURAL_COURTS.find(c => c.slug === courtSlug);
      if (!court) return { cases: [], totalCount: 0, currentPage: 1, totalPages: 1, loaded: false };
      return naturalCourtDecisions({ court, page, perPage, search, orderBy, year });
    },

    allScotusCases: async (_, { courtSlug }) => {
      const court = NATURAL_COURTS.find(c => c.slug === courtSlug);
      if (!court) return [];
      const { cases } = await naturalCourtDecisions({ court, page: 1, perPage: 5000, orderBy: 'dateFiled asc' });
      return cases;
    },

    congresses: () => CONGRESSES,

    bills: async (_, { congress, billType, page = 1, perPage = 20, search, year, order }) => {
      // By introduction date: from the database (seed/load-bill-status-bulk.js), for a Congress
      // whose bill history is loaded. Congress.gov cannot sort that way.
      if (order === 'introduced' || order === 'introduced-oldest') {
        const stored = await storedBills({ congress, billType, page, perPage, search, year, oldest: order === 'introduced-oldest' });
        if (stored) return stored;
        order = 'newest'; // not loaded for this Congress: fall back to Congress.gov's order
      }
      // Congress.gov can only sort bills by when their record was last updated.
      // The direction must be separated by a space; "updateDate+desc" is ignored.
      const sort = order === 'oldest' ? 'updateDate asc' : 'updateDate desc';
      const cacheKey = `bills:${congress}:${billType || ''}:${page}:${perPage}:${search || ''}:${year || ''}:${sort}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const offset = (page - 1) * perPage;
      const endpoint = billType
        ? `${CONGRESS_BASE}/bill/${congress}/${billType.toLowerCase()}`
        : `${CONGRESS_BASE}/bill/${congress}`;

      const params = congressParams({ limit: perPage, offset, sort });
      if (year) {
        params.fromDateTime = `${year}-01-01T00:00:00Z`;
        params.toDateTime = `${year}-12-31T23:59:59Z`;
      }
      if (search) params.q = search;

      const response = await axios.get(endpoint, { params });
      const data = response.data;
      const bills = (data.bills || []).map(mapBill);
      const totalCount = data.pagination?.count || bills.length;

      const result = {
        bills,
        totalCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / perPage) || 1,
        order: order === 'oldest' ? 'oldest' : 'newest',
      };

      cache.set(cacheKey, result);
      return result;
    },

    billSearch: (_, args) => billSearch(args),

    laws: async (_, { congress, lawType = 'pub', page = 1, perPage = 20 }) => {
      const cacheKey = `laws:${congress}:${lawType}:${page}:${perPage}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const offset = (page - 1) * perPage;
      const endpoint = `${CONGRESS_BASE}/law/${congress}/${lawType}`;
      const params = congressParams({ limit: perPage, offset });

      const response = await axios.get(endpoint, { params });
      const data = response.data;
      const bills = (data.bills || []).map(mapBill);
      const totalCount = data.pagination?.count || bills.length;

      const result = {
        bills,
        totalCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / perPage) || 1,
      };

      cache.set(cacheKey, result);
      return result;
    },

    enactedLaws: async (_, { congress, lawType = 'pub' }) => {
      const type = lawType === 'priv' ? 'priv' : 'pub';
      const cacheKey = `enacted-laws:${congress}:${type}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;
      // For a bill whose latest action is no longer its enactment, the stored history has it.
      const becameLawDate = async sourceId => {
        const { rows } = await pool.query(
          `SELECT a.action_date::text AS date FROM bill_actions a JOIN legislation l ON l.id = a.legislation_id
            WHERE l.source_id = $1 AND a.description ILIKE 'Became % Law%' ORDER BY a.action_date LIMIT 1`,
          [sourceId]
        ).catch(() => ({ rows: [] }));
        return rows[0]?.date ?? null;
      };
      const laws = await enactedLaws(congress, type, becameLawDate);
      laws.sort((a, b) => Number(b.number.split('-')[1]) - Number(a.number.split('-')[1]));
      cache.set(cacheKey, laws);
      return laws;
    },

    bill: async (_, { congress, billType, billNumber }) => {
      const cacheKey = `bill:${congress}:${billType}:${billNumber}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const base = `${CONGRESS_BASE}/bill/${congress}/${billType.toLowerCase()}/${billNumber}`;

      // The bill's history comes from the database where it has been loaded
      // (seed/load-bill-status-bulk.js); otherwise it is asked of Congress.gov.
      const storedActions = await pool.query(
        `SELECT a.action_date::text AS "actionDate", a.description AS text, a.action_type AS type, a.action_code AS "actionCode"
           FROM bill_actions a
           JOIN legislation l ON l.id = a.legislation_id
          WHERE l.source_id = $1
          ORDER BY a.position`,
        [`${congress}-${billType.toUpperCase()}-${billNumber}`]
      ).then(res => (res.rows.length ? res.rows : null)).catch(() => null);

      const [billRes, actionsRes, textRes] = await Promise.allSettled([
        axios.get(base, { params: congressParams() }),
        storedActions ? null : axios.get(`${base}/actions`, { params: congressParams({ limit: 250 }) }),
        axios.get(`${base}/text`, { params: congressParams() }),
      ]);

      const doc = billRes.status === 'fulfilled' ? billRes.value.data?.bill : null;
      if (!doc) return null;

      const result = mapBill(doc);

      if (storedActions) {
        result.actions = storedActions;
      } else if (actionsRes.status === 'fulfilled') {
        result.actions = (actionsRes.value.data?.actions || []).map(a => ({
          actionDate: a.actionDate || null,
          text: a.text || null,
          type: a.type || null,
          actionCode: a.actionCode || null,
        }));
      } else {
        result.actions = [];
      }

      if (textRes.status === 'fulfilled') {
        result.textVersions = (textRes.value.data?.textVersions || []).map(v => ({
          type: v.type || null,
          date: v.date || null,
          formats: (v.formats || []).map(f => ({ type: f.type || null, url: f.url || null })),
        }));
      } else {
        result.textVersions = [];
      }

      cache.set(cacheKey, result);
      return result;
    },

    rollCallMembers: async (_, { id }) => {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return [];
      const { rows } = await pool.query(
        `SELECT name, party, state, position, bioguide_id AS "bioguideId", person_id AS "personId"
           FROM member_votes WHERE roll_call_id = $1
          ORDER BY state, name`,
        [id]
      );
      return rows;
    },

    billText: async (_, { packageId }) => {
      const { rows } = await pool.query(
        'SELECT structure FROM legislative_documents WHERE source_id = $1 AND structure IS NOT NULL LIMIT 1',
        [packageId]
      );
      return rows[0]?.structure ?? null;
    },

    billTextSections: async (_, { packageId, from, count }) => {
      const { rows } = await pool.query(
        `SELECT s.position, s.structure
           FROM legislative_document_sections s
           JOIN legislative_documents d ON d.id = s.document_id
          WHERE d.source_id = $1 AND s.position >= $2 AND s.position < $3
          ORDER BY s.position`,
        [packageId, Math.max(0, from), Math.max(0, from) + Math.min(Math.max(count, 1), 50)]
      );
      // References written out without markup ("Section 1074c of title 10, United States
      // Code") link to the Code too; found as the text is served, so nothing is reloaded.
      return rows.map(row => ({
        position: row.position,
        ...row.structure,
        items: (row.structure.items ?? []).map(withUscReferences),
      }));
    },

    courtDecision: async (_, { court, slug }) => {
      const { rows } = await pool.query(
        `SELECT ${DECISION_COLUMNS}, d.structure FROM court_decisions d WHERE d.court = $1 AND d.slug = $2`,
        [court, slug.toLowerCase()]
      );
      return rows[0] ? mapDecision(rows[0], true) : null;
    },

    courtDecisionByCourtListenerId: async (_, { id }) => {
      const { rows } = await pool.query(
        `SELECT ${DECISION_COLUMNS}, d.structure FROM cases c JOIN court_decisions d ON d.id = c.decision_id WHERE c.source_id = $1`,
        [String(id)]
      );
      return rows[0] ? mapDecision(rows[0], true) : null;
    },

    decisionOpinion: async (_, { decisionId, opinionId }) => {
      const { rows } = await pool.query(
        `SELECT o.structure FROM case_opinions o JOIN court_decisions d ON d.id = o.decision_id
          WHERE o.decision_id = $1 AND o.source_id = d.court || '/' || d.slug || '/' || $2`,
        [decisionId, opinionId]
      );
      return rows[0]?.structure ?? null;
    },

    caseGraph: async (_, { caseId }) => {
      const edgeQuery = `
        SELECT
          cr.citing_case_id, cr.cited_case_id, cr.treatment, cr.is_direct,
          c1.id AS n1_id, c1.name AS n1_name, c1.court AS n1_court,
          EXTRACT(YEAR FROM c1.date_decided)::int AS n1_year, c1.url AS n1_url,
          c2.id AS n2_id, c2.name AS n2_name, c2.court AS n2_court,
          EXTRACT(YEAR FROM c2.date_decided)::int AS n2_year, c2.url AS n2_url
        FROM cg_case_relationships cr
        JOIN cg_cases c1 ON c1.id = cr.citing_case_id
        JOIN cg_cases c2 ON c2.id = cr.cited_case_id
        WHERE cr.citing_case_id = ANY($1) OR cr.cited_case_id = ANY($1)
      `;

      // First pass: find all neighbors of the seed
      const { rows: firstRows } = await pool.query(edgeQuery, [[caseId]]);

      const nodeMap = new Map();
      const addNodes = (row) => {
        if (!nodeMap.has(row.n1_id)) nodeMap.set(row.n1_id, { id: String(row.n1_id), name: row.n1_name, court: row.n1_court, year: row.n1_year, url: row.n1_url, isSeed: row.n1_id === caseId });
        if (!nodeMap.has(row.n2_id)) nodeMap.set(row.n2_id, { id: String(row.n2_id), name: row.n2_name, court: row.n2_court, year: row.n2_year, url: row.n2_url, isSeed: row.n2_id === caseId });
      };
      firstRows.forEach(addNodes);

      // Second pass: fetch edges between neighbors (captures sibling relationships)
      const neighborIds = [...nodeMap.keys()];
      const { rows: secondRows } = await pool.query(edgeQuery, [neighborIds]);
      secondRows.forEach(addNodes);

      const edgeSet = new Map();
      const addEdge = (row) => {
        const key = `${row.citing_case_id}-${row.cited_case_id}`;
        if (!edgeSet.has(key)) edgeSet.set(key, { source: String(row.citing_case_id), target: String(row.cited_case_id), treatment: row.treatment ?? null, isDirect: row.is_direct ?? null });
      };
      firstRows.forEach(addEdge);
      secondRows.forEach(addEdge);

      return { nodes: [...nodeMap.values()], edges: [...edgeSet.values()] };
    },
  },

  BillSponsor,

  ...economicResolvers,
  ...sourceResolvers,

  CourtDecision: {
    // Each Justice's vote, in the order the outcome lists them (the Court's order of seniority).
    votes: async (decision) => {
      const { rows } = await pool.query(
        `SELECT v.person_id AS "personId", p.last_name AS name, v.side, v.wrote, v.joined
           FROM court_votes v JOIN people p ON p.id = v.person_id WHERE v.decision_id = $1`,
        [decision.id]
      );
      const order = (decision.structure?.outcome?.justices ?? []).map(j => j.name);
      return rows.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
    },
    courtListenerUrl: async (decision) => {
      const { rows } = await pool.query(
        `SELECT source_url FROM cases WHERE decision_id = $1 AND source_url IS NOT NULL
          ORDER BY (citation IS NOT NULL) DESC, date_decided LIMIT 1`,
        [decision.id]
      );
      return rows[0]?.source_url ?? null;
    },
    caseGraphId: async (decision) => {
      const { rows } = await pool.query(
        `SELECT g.id FROM cg_cases g JOIN cases c ON c.source_id = g.cluster_id::text WHERE c.decision_id = $1 LIMIT 1`,
        [decision.id]
      ).catch(() => ({ rows: [] }));
      return rows[0]?.id ?? null;
    },
  },

  Bill: {
    // The other bills of the bill's proposal: an identical bill in the other chamber
    // (lib/proposals.js). The session page's list fills it already; otherwise it is looked up.
    companions: async (bill) => {
      if (Array.isArray(bill.companions)) return bill.companions;
      try {
        const { rows } = await pool.query(
          `SELECT ${STORED_BILL_COLUMNS}
             FROM legislation me
             JOIN legislation l ON l.proposal_id = me.proposal_id AND l.id <> me.id
            WHERE me.source_id = $1
            ORDER BY l.introduced_date, l.bill_number::int`,
          [`${bill.congress}-${String(bill.type).toUpperCase()}-${bill.number}`]
        );
        return rows.map(storedBill);
      } catch (err) {
        console.error(`bill ${bill.id} companions lookup failed:`, err.message);
        return [];
      }
    },

    // Bills related to this one: Congress.gov's relationships (who identified each, e.g. CRS)
    // and our own (source 'govgraph'). Empty where the bill's history is not loaded.
    relatedBills: async (bill) => {
      try {
        const { rows } = await pool.query(
          `SELECT r.related_congress AS congress, upper(r.related_type) AS type, r.related_number AS number,
                  coalesce(t.title, r.related_title) AS title, r.relationship, r.identified_by AS "identifiedBy",
                  r.source, r.note, r.related_legislation_id IS NOT NULL AS loaded
             FROM bill_relationships r
             JOIN legislation l ON l.id = r.legislation_id
             LEFT JOIN legislation t ON t.id = r.related_legislation_id
            WHERE l.source_id = $1
            ORDER BY r.related_congress DESC, r.related_type, r.related_number::int, r.relationship`,
          [`${bill.congress}-${String(bill.type).toUpperCase()}-${bill.number}`]
        );
        return rows;
      } catch (err) {
        console.error(`bill ${bill.id} related bills lookup failed:`, err.message);
        return [];
      }
    },

    // Recorded votes on the bill, newest first, each with its counts by party.
    rollCalls: async (bill) => {
      try {
        const { rows } = await pool.query(
          `SELECT r.id, r.chamber, r.congress_number AS congress, r.session, r.roll_number AS "rollNumber",
                  r.vote_date::text AS date, r.question, r.description, r.result, r.yea, r.nay, r.present,
                  r.not_voting AS "notVoting", r.tie_breaker AS "tieBreaker", r.amendment, r.source_url AS "sourceUrl",
                  (SELECT json_agg(b) FROM (
                     SELECT party, position, count(*)::int AS count
                       FROM member_votes m WHERE m.roll_call_id = r.id GROUP BY party, position
                   ) b) AS breakdown
             FROM roll_calls r
             JOIN legislation l ON l.id = r.legislation_id
            WHERE l.source_id = $1
            ORDER BY r.vote_date DESC NULLS LAST, r.roll_number DESC`,
          [`${bill.congress}-${String(bill.type).toUpperCase()}-${bill.number}`]
        );
        return rows;
      } catch (err) {
        console.error(`bill ${bill.id} roll calls lookup failed:`, err.message);
        return [];
      }
    },

    // Only runs when a query asks for it. A bill with nothing loaded returns an empty list.
    textDocuments: async (bill) => {
      try {
        const { rows } = await pool.query(
          `SELECT d.source_id, d.doc_type, d.title, d.date::text AS date,
                  (SELECT count(*)::int FROM legislative_document_sections s WHERE s.document_id = d.id) AS sections
             FROM legislative_documents d
             JOIN legislation l ON l.id = d.legislation_id
            WHERE l.congress_number = $1 AND lower(l.bill_type) = lower($2) AND l.bill_number = $3
              AND d.structure IS NOT NULL
            -- The enrolled bill has no date of its own and is the final text.
            ORDER BY d.date DESC NULLS FIRST`,
          [bill.congress, bill.type, bill.number]
        );
        return rows.map(row => ({
          packageId: row.source_id, code: row.doc_type, label: row.title, date: row.date, sectionCount: row.sections,
        }));
      } catch (err) {
        console.error(`bill ${bill.id} text documents lookup failed:`, err.message);
        return [];
      }
    },
  },

  ExecutiveOrder: {
    // Full text from executive_documents (loaded from govinfo). Only runs when a query asks for `body`.
    body: async (order) => {
      // Only executive orders have govinfo plain text loaded.
      if (!order.number) return null;
      try {
        const { rows } = await pool.query(
          `SELECT body FROM executive_documents
            WHERE doc_type = 'executive_order' AND number = $1 AND body IS NOT NULL
            LIMIT 1`,
          [order.number]
        );
        return rows[0]?.body ?? null;
      } catch (err) {
        // The rest of the order comes from the Federal Register, so a database
        // outage should not take the whole page down.
        console.error(`executive order ${order.number} body lookup failed:`, err.message);
        return null;
      }
    },

    // Parsed form of the order (sections → items → spans, citations), stored once by
    // seed/load-executive-order-structure.js and rendered by the client.
    structure: async (order) => {
      if (!order.number && !order.documentNumber) return null;
      try {
        // Executive orders are looked up by number; documents without one (memoranda)
        // by their Federal Register document number.
        const { rows } = order.number
          ? await pool.query(
            `SELECT structure FROM executive_documents
              WHERE doc_type = 'executive_order' AND number = $1 AND structure IS NOT NULL
                AND (source_id IS NULL OR source_id !~ '^[CR][0-9]-')
              LIMIT 1`,
            [order.number]
          )
          : await pool.query(
            `SELECT structure FROM executive_documents
              WHERE source_id = $1 AND structure IS NOT NULL
              LIMIT 1`,
            [order.documentNumber]
          );
        return rows[0]?.structure ?? null;
      } catch (err) {
        console.error(`document ${order.number ?? order.documentNumber} structure lookup failed:`, err.message);
        return null;
      }
    },
  },

  Mutation: {
    ...tagMutations,
    ...favoriteMutations,
  },
};
