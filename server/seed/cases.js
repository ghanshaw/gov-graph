#!/usr/bin/env node
/**
 * Seed script: CourtListener → cases + case_relationships
 *
 * Usage:
 *   node cases.js --opinion <opinion_id> [--depth <n>]
 *
 * Required env vars:
 *   COURTLISTENER_TOKEN  — CourtListener API token
 *   DATABASE_URL         — Supabase Postgres connection URI
 *
 * Run from repo root:
 *   node --env-file=server/.env server/seed/cases.js --opinion 10516255 --depth 1
 */

import pg from "pg";
import { parseArgs } from "node:util";

const { Pool } = pg;
const BASE = "https://www.courtlistener.com/api/rest/v4";
const DELAY_MS = 1100;

// ── CLI args ──────────────────────────────────────────────────────────────────

const { values: args } = parseArgs({
  options: {
    opinion: { type: "string" },
    depth:   { type: "string", default: "1" },
  },
});

if (!args.opinion) {
  console.error("Usage: node cases.js --opinion <opinion_id> [--depth <n>]");
  process.exit(1);
}

const ROOT_OPINION_ID = args.opinion;
const MAX_DEPTH = parseInt(args.depth, 10);

// ── DB ────────────────────────────────────────────────────────────────────────

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function registerSource(client) {
  const res = await client.query(
    `INSERT INTO cg_data_sources (name, url, notes)
     VALUES ('courtlistener', $1, $2)
     RETURNING id`,
    [
      `${BASE}/opinions/`,
      `CourtListener opinion crawl, root=${ROOT_OPINION_ID}, depth=${MAX_DEPTH}`,
    ]
  );
  return res.rows[0].id;
}

async function upsertCase(client, { name, citation, court, date_decided, courtlistener_id, url }, sourceId) {
  const res = await client.query(
    `INSERT INTO cg_cases (name, citation, court, date_decided, courtlistener_id, url, source, source_id)
     VALUES ($1, $2, $3, $4, $5, $6, 'courtlistener', $7)
     ON CONFLICT (courtlistener_id) DO UPDATE
       SET name         = EXCLUDED.name,
           citation     = EXCLUDED.citation,
           court        = EXCLUDED.court,
           date_decided = EXCLUDED.date_decided,
           url          = EXCLUDED.url
     RETURNING id`,
    [name, citation, court, date_decided ?? null, courtlistener_id, url ?? null, sourceId]
  );
  return res.rows[0].id;
}

async function upsertRelationship(client, { citing_case_id, cited_case_id }, sourceId) {
  await client.query(
    `INSERT INTO cg_case_relationships (citing_case_id, cited_case_id, source, source_id)
     VALUES ($1, $2, 'courtlistener', $3)
     ON CONFLICT (citing_case_id, cited_case_id) DO NOTHING`,
    [citing_case_id, cited_case_id, sourceId]
  );
}

// ── CourtListener API ─────────────────────────────────────────────────────────

const headers = {
  Authorization: `Token ${process.env.COURTLISTENER_TOKEN}`,
  Accept: "application/json",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function clGet(url, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, { headers });
    if (res.ok) return res.json();
    if (res.status === 404) throw new Error(`CourtListener 404: ${url}`);
    if (attempt < retries) {
      const wait = DELAY_MS * 2 ** attempt;
      console.warn(`  CourtListener ${res.status} on attempt ${attempt + 1}, retrying in ${wait}ms...`);
      await sleep(wait);
    } else {
      throw new Error(`CourtListener ${res.status}: ${url}`);
    }
  }
}

function extractCitation(cluster) {
  const c = cluster.citations?.[0];
  if (!c) return null;
  return `${c.volume} ${c.reporter} ${c.page}`;
}

async function resolveOpinionToCase(opinionId) {
  await sleep(DELAY_MS);
  const opinion = await clGet(`${BASE}/opinions/${opinionId}/`);

  const clusterUrl = opinion.cluster;
  if (!clusterUrl) return null;
  const clusterId = clusterUrl.match(/\/clusters\/(\d+)\//)?.[1];
  if (!clusterId) return null;

  await sleep(DELAY_MS);
  const cluster = await clGet(`${BASE}/clusters/${clusterId}/`);

  let courtName = null;
  if (cluster.court) {
    await sleep(DELAY_MS);
    const courtData = await clGet(cluster.court);
    courtName = courtData.full_name ?? courtData.short_name ?? null;
  }

  const absoluteUrl = cluster.absolute_url ?? null;
  const url = absoluteUrl ? `https://www.courtlistener.com${absoluteUrl}` : null;

  return {
    name:              cluster.case_name ?? "Unknown",
    citation:          extractCitation(cluster),
    court:             courtName,
    date_decided:      cluster.date_filed ?? null,
    courtlistener_id:  String(opinionId),
    url,
  };
}

async function fetchOutboundCitations(opinionId) {
  const ids = [];
  let url = `${BASE}/opinions-cited/?citing_opinion=${opinionId}&page_size=50`;
  while (url) {
    await sleep(DELAY_MS);
    const data = await clGet(url);
    for (const row of data.results ?? []) {
      const match = (row.cited_opinion ?? "").match(/\/opinions\/(\d+)\//);
      if (match) ids.push(match[1]);
    }
    url = data.next ?? null;
  }
  return ids;
}

async function fetchInboundCitations(opinionId) {
  const ids = [];
  let url = `${BASE}/opinions-cited/?cited_opinion=${opinionId}&page_size=50`;
  while (url) {
    await sleep(DELAY_MS);
    const data = await clGet(url);
    for (const row of data.results ?? []) {
      const match = (row.citing_opinion ?? "").match(/\/opinions\/(\d+)\//);
      if (match) ids.push(match[1]);
    }
    url = data.next ?? null;
  }
  return ids;
}

// ── Crawl ─────────────────────────────────────────────────────────────────────

async function crawl(rootOpinionId, maxDepth) {
  const client = await pool.connect();
  const sourceId = await registerSource(client);
  console.log(`Registered data_source id=${sourceId}`);

  const visited = new Set();
  const queue = [[rootOpinionId, 0]];

  try {
    while (queue.length > 0) {
      const [opinionId, depth] = queue.shift();
      if (visited.has(opinionId)) continue;
      visited.add(opinionId);

      console.log(`\n[depth ${depth}] Processing opinion ${opinionId}...`);

      let caseData;
      try {
        caseData = await resolveOpinionToCase(opinionId);
      } catch (err) {
        console.warn(`  Could not resolve opinion ${opinionId}: ${err.message}`);
        continue;
      }
      if (!caseData) { console.warn(`  No cluster found for ${opinionId}`); continue; }

      const caseId = await upsertCase(client, caseData, sourceId);
      console.log(`  Upserted: "${caseData.name}" → DB id ${caseId}`);

      if (depth >= maxDepth) continue;

      console.log(`  Fetching outbound citations...`);
      const outbound = await fetchOutboundCitations(opinionId);
      console.log(`  Found ${outbound.length} outbound`);

      for (const citedId of outbound) {
        if (!visited.has(citedId)) queue.push([citedId, depth + 1]);
        try {
          const data = await resolveOpinionToCase(citedId);
          if (!data) continue;
          const dbId = await upsertCase(client, data, sourceId);
          await upsertRelationship(client, { citing_case_id: caseId, cited_case_id: dbId }, sourceId);
        } catch (err) {
          console.warn(`  Skipping cited opinion ${citedId}: ${err.message}`);
        }
      }

      console.log(`  Fetching inbound citations...`);
      const inbound = await fetchInboundCitations(opinionId);
      console.log(`  Found ${inbound.length} inbound`);

      for (const citingId of inbound) {
        if (!visited.has(citingId)) queue.push([citingId, depth + 1]);
        try {
          const data = await resolveOpinionToCase(citingId);
          if (!data) continue;
          const dbId = await upsertCase(client, data, sourceId);
          await upsertRelationship(client, { citing_case_id: dbId, cited_case_id: caseId }, sourceId);
        } catch (err) {
          console.warn(`  Skipping citing opinion ${citingId}: ${err.message}`);
        }
      }
    }
  } finally {
    client.release();
    await pool.end();
  }

  console.log(`\nDone. Visited ${visited.size} opinions.`);
}

crawl(ROOT_OPINION_ID, MAX_DEPTH).catch((err) => {
  console.error(err);
  process.exit(1);
});
