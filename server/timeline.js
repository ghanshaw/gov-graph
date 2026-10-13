// The timeline (client/src/pages/Timeline.jsx): every stored executive order, memorandum, enacted
// law, report of an investigation and Supreme Court decision as a dated event linking to its page. Everything comes from the
// database, so the timeline shows what is loaded; the client filters by kind and date range.

import NodeCache from 'node-cache';
import { pool } from './db.js';
import { naturalCourtOn } from './naturalCourts.js';
import { PRESIDENT_SLUGS } from './people.js';

const cache = new NodeCache({ stdTTL: 600 });

// The president page for a signing date: a presidency runs from its inauguration on January 20.
// Presidents without a page (Bush) get none.
const INAUGURATIONS = Object.entries(PRESIDENT_SLUGS)
  .map(([year, slug]) => ({ from: `${year}-01-20`, slug }))
  .sort((a, b) => b.from.localeCompare(a.from));
export const presidentSlugOn = date => INAUGURATIONS.find(p => date >= p.from)?.slug ?? null;

const KINDS = {
  // Correction and republication notices (source_id "C1-…", "R1-…") repeat an order.
  async eo() {
    const { rows } = await pool.query(
      `SELECT source_id, number, title, signed_date::text AS date FROM executive_documents
        WHERE doc_type = 'executive_order' AND signed_date IS NOT NULL AND source_id !~ '^[CR][0-9]-'`
    );
    return rows.map(r => {
      const slug = presidentSlugOn(r.date);
      return {
        id: `eo-${r.source_id}`, kind: 'eo', date: r.date, title: r.title,
        label: r.number ? `EO ${r.number}` : 'EO',
        href: slug && r.number ? `/${slug}/executive-orders/eo/${r.number}` : null,
      };
    });
  },

  async memo() {
    const { rows } = await pool.query(
      `SELECT source_id, title, signed_date::text AS date FROM executive_documents
        WHERE doc_type = 'memorandum' AND signed_date IS NOT NULL`
    );
    return rows.map(r => {
      const slug = presidentSlugOn(r.date);
      return {
        id: `memo-${r.source_id}`, kind: 'memo', date: r.date, title: r.title, label: 'Memo',
        href: slug ? `/${slug}/memoranda/doc/${r.source_id}` : null,
      };
    });
  },

  // FOMC target changes (economic_series 'fed-target-lower' / 'fed-target-upper'; seed/load-economic-series.js),
  // each the date a new target took effect, with the size of the move.
  async fomc() {
    const { rows } = await pool.query(
      `SELECT lo.date::text AS date, lo.value::float AS lower, up.value::float AS upper
         FROM economic_observations lo
         JOIN economic_series ls ON ls.id = lo.series_id AND ls.slug = 'fed-target-lower'
         JOIN economic_series us ON us.slug = 'fed-target-upper'
         JOIN economic_observations up ON up.series_id = us.id AND up.date = lo.date
        ORDER BY lo.date`
    );
    const level = r => (r.lower === r.upper ? `${r.upper.toFixed(2)}%` : `${r.lower.toFixed(2)}–${r.upper.toFixed(2)}%`);
    return rows.slice(1).map((r, i) => {
      const bp = Math.round((r.upper - rows[i].upper) * 100);
      return {
        id: `fomc-${r.date}`, kind: 'fomc', date: r.date,
        title: `The Fed ${bp > 0 ? 'raises' : 'cuts'} its target to ${level(r)}`,
        label: `Fed ${bp > 0 ? '+' : '−'}${(Math.abs(bp) / 100).toFixed(2)}`,
        href: '/economy/rates',
      };
    });
  },

  // A bill's history records "Became Public Law No: 119-73." (several times, once per source).
  async law() {
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (l.id) l.id, l.congress_number, l.bill_type, l.bill_number, l.title,
              a.action_date::text AS date,
              substring(a.description from 'Became (Public|Private) Law') AS law_type,
              substring(a.description from 'Law No: ([0-9]+-[0-9]+)') AS law_number
         FROM bill_actions a JOIN legislation l ON l.id = a.legislation_id
        WHERE a.description ILIKE 'Became % Law%'
        ORDER BY l.id, a.action_date`
    );
    return rows.map(r => ({
      id: `law-${r.id}`, kind: 'law', date: r.date, title: r.title,
      label: r.law_number
        ? `${r.law_type === 'Private' ? 'Priv.' : 'Pub.'} L. ${r.law_number}`
        : `${r.bill_type.toUpperCase()} ${r.bill_number}`,
      href: `/congress/${r.congress_number}/${r.bill_type}/${r.bill_number}`,
    }));
  },

  // Reports of investigations (reports; seed/load-reports.js), on the day each was released.
  async report() {
    const { rows } = await pool.query(
      `SELECT slug, title, short_title, issuer_short, date_issued::text AS date FROM reports`
    );
    return rows.map(r => ({
      id: `report-${r.slug}`, kind: 'report', date: r.date, title: r.short_title ?? r.title,
      label: r.issuer_short ?? 'Report', href: `/reports/${r.slug}`,
    }));
  },

  async scotus() {
    const { rows } = await pool.query(
      `SELECT id, slug, name, docket_numbers, date_decided::text AS date FROM court_decisions
        WHERE court = 'scotus' AND date_decided IS NOT NULL`
    );
    return rows.map(r => {
      const court = naturalCourtOn(r.date);
      return {
        id: `scotus-${r.id}`, kind: 'scotus', date: r.date, title: r.name,
        label: r.docket_numbers?.[0] ?? r.slug,
        href: court ? `/supreme-court/${court}/${r.slug}` : null,
      };
    });
  },
};

// A period's document reference → its page in this app, once that document is loaded:
// 'fr:<number>' an order or memorandum (proclamations are not stored yet), 'bill:<source_id>' a bill
// whose history is loaded. Otherwise null, and the page links to the source instead.
export async function documentHref(ref) {
  const [kind, id] = (ref ?? '').split(/:(.*)/);
  if (kind === 'fr') {
    const { rows: [doc] } = await pool.query(
      `SELECT doc_type, number, signed_date::text AS date FROM executive_documents WHERE source_id = $1`, [id]);
    const slug = doc && presidentSlugOn(doc.date);
    if (!slug) return null;
    if (doc.doc_type === 'executive_order' && doc.number) return `/${slug}/executive-orders/eo/${doc.number}`;
    if (doc.doc_type === 'memorandum') return `/${slug}/memoranda/doc/${id}`;
    return null;
  }
  if (kind === 'bill') {
    const { rows: [bill] } = await pool.query(
      `SELECT congress_number, bill_type, bill_number FROM legislation WHERE source_id = $1 AND details IS NOT NULL`, [id]);
    return bill ? `/congress/${bill.congress_number}/${bill.bill_type}/${bill.bill_number}` : null;
  }
  return null;
}

export const timelineQueries = {
  // Recessions and emergencies (periods; seed/load-periods.js), oldest first.
  periods: async () => {
    const cached = cache.get('periods');
    if (cached) return cached;
    const { rows } = await pool.query(
      `SELECT slug, kind, name, start_date::text AS start, end_date::text AS "end",
              start_by AS "startBy", start_source AS "startSource", start_url AS "startUrl", start_document,
              end_by AS "endBy", end_source AS "endSource", end_url AS "endUrl", end_document, notes
         FROM periods ORDER BY start_date`
    );
    const periods = await Promise.all(rows.map(async ({ start_document, end_document, ...p }) => ({
      ...p, startHref: await documentHref(start_document), endHref: await documentHref(end_document),
    })));
    cache.set('periods', periods);
    return periods;
  },


  // Every presidential term (person_roles, from the @unitedstates executive list via
  // load-people.js), oldest first. A term cut short (death, resignation) ends on the day its
  // successor's begins.
  presidentialTerms: async () => {
    const cached = cache.get('presidential-terms');
    if (cached) return cached;
    const { rows } = await pool.query(
      `SELECT r.person_id AS "personId", p.name, p.last_name AS "lastName", r.party, r.how,
              r.started_at::text AS start, r.ended_at::text AS "end"
         FROM person_roles r JOIN people p ON p.id = r.person_id
        WHERE r.role_type = 'president'
        ORDER BY r.started_at`
    );
    const terms = rows.map(r => ({ ...r, href: `/people/${r.personId}` }));
    cache.set('presidential-terms', terms);
    return terms;
  },

  timelineEvents: async (_, { kinds }) => {
    const wanted = [...new Set(kinds)].filter(k => KINDS[k]).sort();
    const key = `timeline:${wanted.join(',')}`;
    const cached = cache.get(key);
    if (cached) return cached;
    const events = (await Promise.all(wanted.map(k => KINDS[k]())))
      .flat()
      .sort((a, b) => a.date.localeCompare(b.date));
    cache.set(key, events);
    return events;
  },
};
