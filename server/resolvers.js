import axios from 'axios';
import NodeCache from 'node-cache';
import { GraphQLScalarType } from 'graphql';
import { NATURAL_COURTS } from './naturalCourts.js';
import { CONGRESSES } from './congresses.js';
import { pool } from './db.js';

const cache = new NodeCache({ stdTTL: 600 });

const COURTLISTENER_BASE = 'https://www.courtlistener.com/api/rest/v4';

function courtlistenerHeaders() {
  const token = process.env.COURTLISTENER_TOKEN;
  return token ? { Authorization: `Token ${token}` } : {};
}

const OPINION_TYPE_ORDER = [
  'unanimous-opinion', 'lead-opinion', 'combined-opinion',
  'plurality-opinion', 'concurrence-opinion', 'in-part-opinion', 'dissent',
  'addendum', 'rehearing', 'remittitur', 'on-the-merits', 'on-motion-to-strike',
];

function normalizeOpinionType(raw) {
  if (!raw) return 'combined-opinion';
  // legacy numeric codes
  if (/^010|^015/.test(raw)) return 'lead-opinion';
  if (/^020/.test(raw)) return 'unanimous-opinion';
  if (/^025|^030/.test(raw)) return 'concurrence-opinion';
  if (/^035/.test(raw)) return 'in-part-opinion';
  if (/^040/.test(raw)) return 'dissent';
  if (/^050/.test(raw)) return 'plurality-opinion';
  return raw;
}

function opinionTypeLabel(type) {
  const labels = {
    'lead-opinion': 'Majority Opinion',
    'unanimous-opinion': 'Majority Opinion',
    'combined-opinion': 'Majority Opinion',
    'plurality-opinion': 'Plurality Opinion',
    'concurrence-opinion': 'Concurrence',
    'in-part-opinion': 'Concurrence in Part / Dissent in Part',
    'dissent': 'Dissent',
    'addendum': 'Addendum',
    'rehearing': 'Rehearing',
    'remittitur': 'Remittitur',
    'on-the-merits': 'On the Merits',
    'on-motion-to-strike': 'On Motion to Strike',
  };
  return labels[type] || type;
}

function mapScotusCase(doc, opinions = null, syllabus = null) {
  const date = doc.dateFiled || doc.date_filed || null;
  const id = String(doc.cluster_id || doc.id);
  const cite = Array.isArray(doc.citation) ? doc.citation[0] : doc.citation || null;
  const slug = doc.absolute_url
    ? doc.absolute_url.replace(/^\/opinion\/\d+\//, '').replace(/\/$/, '')
    : id;
  return {
    id,
    caseName: doc.caseName || doc.case_name || 'Untitled',
    dateFiled: date,
    citation: cite || null,
    docketNumber: doc.docketNumber || doc.docket_number || null,
    url: `https://www.courtlistener.com/opinion/${id}/${slug}/`,
    year: date ? parseInt(date.split('-')[0]) : null,
    syllabus,
    votesMajority: doc.scdb_votes_majority ?? null,
    votesMinority: doc.scdb_votes_minority ?? null,
    decisionDirection: doc.scdb_decision_direction || null,
    opinions: opinions || [],
  };
}

function extractSyllabus(plainText) {
  if (!plainText) return null;
  const m = plainText.match(
    /Syllabus\s+NOTE:.*?See United States.*?\n\n(.*?)(?=\n\s*CHIEF JUSTICE|\n\s*JUSTICE [A-Z]+,|\nI\.)/s
  );
  return m ? m[1].trim() : null;
}

const CONGRESS_BASE = 'https://api.congress.gov/v3';

function congressParams(extra = {}) {
  return { api_key: process.env.CONGRESS_API_KEY, format: 'json', ...extra };
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
    executiveOrders: async (_, { president, documentType = 'executive_order', page = 1, perPage = 20, search, year, order }) => {
      // Federal Register sort orders; anything else falls back to oldest first.
      const sortOrder = ['newest', 'oldest', 'relevance'].includes(order) ? order : 'oldest';
      const cacheKey = `eos:${president || 'all'}:${documentType}:${page}:${perPage}:${search || ''}:${year || ''}:${sortOrder}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const params = {
        ...orderConditions({ president, documentType, search, year }),
        'fields[]': [
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

    scotusCases: async (_, { courtSlug, page = 1, perPage = 20, search, orderBy = 'dateFiled asc', year }) => {
      const court = NATURAL_COURTS.find(c => c.slug === courtSlug);
      if (!court) return { cases: [], totalCount: 0, currentPage: 1, totalPages: 1 };

      const cacheKey = `scotus:${courtSlug}:${page}:${perPage}:${search || ''}:${orderBy}:${year || ''}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const filedAfter = year ? `${year}-01-01` : court.startDate;
      const filedBefore = year ? `${year}-12-31` : court.endDate;

      // CourtListener v4 search uses cursor-based pagination — the page param is ignored.
      // Walk the cursor chain from page 1 up to the requested page, caching each step.
      const baseParams = {
        type: 'o',
        court: 'scotus',
        filed_after: filedAfter,
        order_by: orderBy,
        page_size: perPage,
      };
      if (filedBefore) baseParams.filed_before = filedBefore;
      if (search) baseParams.q = search;

      const cursorCacheKey = (p) => `scotus-cursor:${courtSlug}:${p}:${perPage}:${search || ''}:${orderBy}:${year || ''}`;

      // Find the highest cached cursor we can start from
      let startPage = 1;
      let nextUrl = null;
      for (let p = page - 1; p >= 2; p--) {
        const c = cache.get(cursorCacheKey(p));
        if (c) { startPage = p; nextUrl = c; break; }
      }

      let response;
      if (startPage === 1 && page === 1) {
        response = await axios.get(`${COURTLISTENER_BASE}/search/`, {
          params: baseParams,
          headers: courtlistenerHeaders(),
        });
      } else {
        // Walk from startPage to the target page
        if (!nextUrl) {
          // Need to get cursor for startPage by fetching page 1 first
          const r = await axios.get(`${COURTLISTENER_BASE}/search/`, {
            params: baseParams,
            headers: courtlistenerHeaders(),
          });
          nextUrl = r.data.next;
          cache.set(cursorCacheKey(2), nextUrl);
          startPage = 1;
        }

        response = null;
        for (let p = startPage + 1; p <= page; p++) {
          if (!nextUrl) break;
          response = await axios.get(nextUrl, { headers: courtlistenerHeaders() });
          if (p < page && response.data.next) {
            cache.set(cursorCacheKey(p + 1), response.data.next);
            nextUrl = response.data.next;
          }
        }
      }

      if (!response) return { cases: [], totalCount: 0, currentPage: page, totalPages: 1 };

      // Cache the cursor for the next page
      if (response.data.next) {
        cache.set(cursorCacheKey(page + 1), response.data.next);
      }

      const { results, count } = response.data;
      const totalPages = Math.ceil((count || 0) / perPage);

      // Dedupe by docket number — keep the entry with a citation, or the higher citeCount
      const seen = new Map();
      for (const doc of (results || [])) {
        const key = doc.docketNumber || doc.docket_number;
        if (!key) { seen.set(doc.cluster_id || doc.id, doc); continue; }
        const existing = seen.get(key);
        if (!existing) { seen.set(key, doc); continue; }
        const hasCite = !!(doc.citation?.length ?? doc.citation);
        const existingHasCite = !!(existing.citation?.length ?? existing.citation);
        if (hasCite && !existingHasCite) seen.set(key, doc);
        else if (!hasCite && !existingHasCite && (doc.citeCount || 0) > (existing.citeCount || 0)) seen.set(key, doc);
      }

      const result = {
        cases: [...seen.values()].map(doc => mapScotusCase(doc)),
        totalCount: count || 0,
        currentPage: page,
        totalPages,
      };

      cache.set(cacheKey, result);
      return result;
    },

    allScotusCases: async (_, { courtSlug }) => {
      const court = NATURAL_COURTS.find(c => c.slug === courtSlug);
      if (!court) return [];

      const cacheKey = `scotus-all:${courtSlug}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const params = {
        type: 'o',
        court: 'scotus',
        filed_after: court.startDate,
        order_by: 'dateFiled asc',
        page_size: 100,
      };
      if (court.endDate) params.filed_before = court.endDate;

      const allResults = [];
      let nextUrl = null;

      // Fetch first page
      const first = await axios.get(`${COURTLISTENER_BASE}/search/`, {
        params,
        headers: courtlistenerHeaders(),
      });
      allResults.push(...(first.data.results || []));
      nextUrl = first.data.next;

      // Walk remaining pages
      while (nextUrl) {
        const res = await axios.get(nextUrl, { headers: courtlistenerHeaders() });
        allResults.push(...(res.data.results || []));
        nextUrl = res.data.next;
      }

      // Dedupe by docket number
      const seen = new Map();
      for (const doc of allResults) {
        const key = doc.docketNumber || doc.docket_number;
        if (!key) { seen.set(doc.cluster_id || doc.id, doc); continue; }
        const existing = seen.get(key);
        if (!existing) { seen.set(key, doc); continue; }
        const hasCite = !!(doc.citation?.length ?? doc.citation);
        const existingHasCite = !!(existing.citation?.length ?? existing.citation);
        if (hasCite && !existingHasCite) seen.set(key, doc);
        else if (!hasCite && !existingHasCite && (doc.citeCount || 0) > (existing.citeCount || 0)) seen.set(key, doc);
      }

      const result = [...seen.values()].map(doc => mapScotusCase(doc));
      cache.set(cacheKey, result, 3600);
      return result;
    },

    congresses: () => CONGRESSES,

    bills: async (_, { congress, billType, page = 1, perPage = 20, search, year }) => {
      const cacheKey = `bills:${congress}:${billType || ''}:${page}:${perPage}:${search || ''}:${year || ''}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const offset = (page - 1) * perPage;
      const endpoint = billType
        ? `${CONGRESS_BASE}/bill/${congress}/${billType.toLowerCase()}`
        : `${CONGRESS_BASE}/bill/${congress}`;

      const params = congressParams({ limit: perPage, offset, sort: 'updateDate+desc' });
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
      };

      cache.set(cacheKey, result);
      return result;
    },

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

    bill: async (_, { congress, billType, billNumber }) => {
      const cacheKey = `bill:${congress}:${billType}:${billNumber}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const base = `${CONGRESS_BASE}/bill/${congress}/${billType.toLowerCase()}/${billNumber}`;

      const [billRes, actionsRes, textRes] = await Promise.allSettled([
        axios.get(base, { params: congressParams() }),
        axios.get(`${base}/actions`, { params: congressParams({ limit: 250 }) }),
        axios.get(`${base}/text`, { params: congressParams() }),
      ]);

      const doc = billRes.status === 'fulfilled' ? billRes.value.data?.bill : null;
      if (!doc) return null;

      const result = mapBill(doc);

      if (actionsRes.status === 'fulfilled') {
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

    caseInGraph: async (_, { clusterId }) => {
      const { rows } = await pool.query('SELECT id FROM cg_cases WHERE cluster_id = $1 LIMIT 1', [clusterId]);
      return rows.length ? rows[0].id : null;
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

    tagsForEntity: async (_, { entityType, entityId }) => {
      const { rows } = await pool.query(
        `SELECT t.* FROM tags t
         JOIN entity_tags et ON et.tag_id = t.id
         WHERE et.entity_type = $1 AND et.entity_id = $2
         ORDER BY t.word`,
        [entityType, entityId]
      );
      return rows.map(r => ({ id: r.id, word: r.word, source: r.source, createdAt: r.created_at }));
    },

    allTags: async () => {
      const { rows } = await pool.query(
        `SELECT t.word, COUNT(et.id)::int AS count
         FROM tags t LEFT JOIN entity_tags et ON et.tag_id = t.id
         GROUP BY t.word ORDER BY count DESC, t.word ASC`
      );
      return rows;
    },

    tagPage: async (_, { word }) => {
      const normalized = word.trim().toLowerCase();
      const tagRes = await pool.query('SELECT * FROM tags WHERE word = $1', [normalized]);
      if (!tagRes.rows.length) return { tag: null, executiveOrders: [], scotusCases: [], legislation: [] };
      const tag = tagRes.rows[0];
      const tagGql = { id: tag.id, word: tag.word, source: tag.source, createdAt: tag.created_at };

      const { rows: entities } = await pool.query(
        'SELECT entity_type, entity_id FROM entity_tags WHERE tag_id = $1',
        [tag.id]
      );

      const eoIds = entities.filter(e => e.entity_type === 'executive_order').map(e => e.entity_id);
      const scotusIds = entities.filter(e => e.entity_type === 'scotus_case').map(e => e.entity_id);
      const legIds = entities.filter(e => e.entity_type === 'legislation').map(e => e.entity_id);

      const eoResults = await Promise.allSettled(
        eoIds.map(async (num) => {
          const cacheKey = `eo:${num}`;
          const cached = cache.get(cacheKey);
          if (cached) return { entityId: num, order: cached };
          const params = {
            'conditions[presidential_document_type]': 'executive_order',
            'conditions[executive_order_numbers][]': parseInt(num, 10),
            'fields[]': [
              'executive_order_number', 'title', 'signing_date', 'publication_date',
              'abstract', 'html_url', 'full_text_xml_url', 'raw_text_url', 'body_html_url', 'pdf_url', 'topics', 'president',
            ],
            per_page: 1,
          };
          const res = await axios.get(BASE_URL, { params });
          const order = (res.data.results || []).map(mapOrder)[0] || null;
          if (order) cache.set(cacheKey, order);
          return { entityId: num, order };
        })
      );

      const scotusResults = await Promise.allSettled(
        scotusIds.map(async (id) => {
          const cacheKey = `scotus-case:${id}`;
          const cached = cache.get(cacheKey);
          if (cached) return { entityId: id, case: cached };
          const res = await axios.get(`${COURTLISTENER_BASE}/clusters/${id}/`, {
            headers: courtlistenerHeaders(),
          });
          const scotusCase = mapScotusCase(res.data);
          cache.set(cacheKey, scotusCase);
          return { entityId: id, case: scotusCase };
        })
      );

      const legResults = await Promise.allSettled(
        legIds.map(async (compositeId) => {
          const cacheKey = `bill-tag:${compositeId}`;
          const cached = cache.get(cacheKey);
          if (cached) return { entityId: compositeId, bill: cached };
          // Format: "119-HR-4741"
          const parts = compositeId.split('-');
          const congress = parts[0];
          const billType = parts[1].toLowerCase();
          const billNumber = parts[2];
          const base = `${CONGRESS_BASE}/bill/${congress}/${billType}/${billNumber}`;
          const res = await axios.get(base, { params: congressParams() });
          const bill = res.data?.bill ? mapBill(res.data.bill) : null;
          if (bill) cache.set(cacheKey, bill);
          return { entityId: compositeId, bill };
        })
      );

      return {
        tag: tagGql,
        executiveOrders: eoResults.filter(r => r.status === 'fulfilled').map(r => r.value),
        scotusCases: scotusResults.filter(r => r.status === 'fulfilled').map(r => r.value),
        legislation: legResults.filter(r => r.status === 'fulfilled').map(r => r.value),
      };
    },

    scotusCase: async (_, { id }) => {
      const cacheKey = `scotus-case:${id}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const clusterRes = await axios.get(`${COURTLISTENER_BASE}/clusters/${id}/`, {
        headers: courtlistenerHeaders(),
      });
      const cluster = clusterRes.data;

      // Fetch all opinions in parallel
      const opinionUrls = cluster.sub_opinions || [];
      const opinionResults = await Promise.allSettled(
        opinionUrls.map(url => {
          const opId = String(url).match(/\/opinions\/(\d+)\//)?.[1];
          return opId
            ? axios.get(`${COURTLISTENER_BASE}/opinions/${opId}/`, { headers: courtlistenerHeaders() })
            : Promise.reject();
        })
      );

      let syllabus = null;
      const opinions = [];

      for (const r of opinionResults) {
        if (r.status !== 'fulfilled') continue;
        const op = r.value.data;
        const type = normalizeOpinionType(op.type);

        // Extract syllabus from first majority-type opinion
        if (!syllabus && ['lead-opinion', 'unanimous-opinion', 'combined-opinion'].includes(type)) {
          syllabus = extractSyllabus(op.plain_text);
        }

        opinions.push({
          id: String(op.id),
          type: opinionTypeLabel(type),
          author: op.author_str || null,
          perCuriam: op.per_curiam || false,
          url: `https://www.courtlistener.com${op.absolute_url || `/opinion/${op.id}/`}`,
        });
      }

      // Sort opinions: majority first, then plurality, concurrences, dissents
      opinions.sort((a, b) => {
        const order = ['Majority Opinion', 'Plurality Opinion', 'Concurrence',
          'Concurrence in Part / Dissent in Part', 'Dissent'];
        return (order.indexOf(a.type) ?? 99) - (order.indexOf(b.type) ?? 99);
      });

      const result = mapScotusCase(cluster, opinions, syllabus);
      cache.set(cacheKey, result);
      return result;
    },
  },

  ExecutiveOrder: {
    // Full text from executive_documents (loaded from govinfo). Only runs when a query asks for `body`.
    body: async (order) => {
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
      if (!order.number) return null;
      try {
        const { rows } = await pool.query(
          `SELECT structure FROM executive_documents
            WHERE doc_type = 'executive_order' AND number = $1 AND structure IS NOT NULL
              AND (source_id IS NULL OR source_id !~ '^[CR][0-9]-')
            LIMIT 1`,
          [order.number]
        );
        return rows[0]?.structure ?? null;
      } catch (err) {
        console.error(`executive order ${order.number} structure lookup failed:`, err.message);
        return null;
      }
    },
  },

  Mutation: {
    applyTag: async (_, { word, entityType, entityId }) => {
      const normalized = word.trim().toLowerCase();
      const tagRes = await pool.query(
        `INSERT INTO tags (word) VALUES ($1)
         ON CONFLICT (word) DO UPDATE SET word = EXCLUDED.word RETURNING *`,
        [normalized]
      );
      const tag = tagRes.rows[0];
      await pool.query(
        `INSERT INTO entity_tags (tag_id, entity_type, entity_id)
         VALUES ($1, $2, $3) ON CONFLICT (tag_id, entity_type, entity_id) DO NOTHING`,
        [tag.id, entityType, entityId]
      );
      return { id: tag.id, word: tag.word, source: tag.source, createdAt: tag.created_at };
    },

    removeTag: async (_, { word, entityType, entityId }) => {
      const normalized = word.trim().toLowerCase();
      const tagRes = await pool.query('SELECT id FROM tags WHERE word = $1', [normalized]);
      if (!tagRes.rows.length) return false;
      await pool.query(
        'DELETE FROM entity_tags WHERE tag_id = $1 AND entity_type = $2 AND entity_id = $3',
        [tagRes.rows[0].id, entityType, entityId]
      );
      return true;
    },
  },
};
