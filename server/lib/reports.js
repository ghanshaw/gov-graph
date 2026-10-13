// Reports of investigations (commissions, congressional inquiries, special counsels): the list in
// seed/data/reports.json, where their files are kept, and the tables they are stored in.
// Used by seed/fetch-reports.js, seed/load-reports.js and server/reports.js.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { mirrorFile } from './data-dir.js';

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'seed', 'data', 'reports.json');

export const readReports = () => JSON.parse(fs.readFileSync(FILE, 'utf8')).reports;

/** A file of the publisher's edition, by name → its URL and where it is kept. */
export const reportFileUrl = (report, name) => new URL(name, report.base_url).href;
export const reportFile = (report, name) => mirrorFile(reportFileUrl(report, name));

// govinfo: GPO's edition. Package and granule PDFs, and the package's MODS record.
const GOVINFO = 'https://www.govinfo.gov/content/pkg';
export const govinfoPdfUrl = (packageId, granuleId = packageId) => `${GOVINFO}/${packageId}/pdf/${granuleId}.pdf`;
export const govinfoModsUrl = packageId => `https://www.govinfo.gov/metadata/pkg/${packageId}/mods.xml`;

export const SCHEMA = `
  CREATE TABLE IF NOT EXISTS reports (
    id              SERIAL PRIMARY KEY,
    slug            TEXT NOT NULL UNIQUE,     -- '9-11-commission'; the page is /reports/<slug>
    kind            TEXT NOT NULL,            -- 'commission' | 'congressional' | 'special_counsel' | …
    title           TEXT NOT NULL,            -- as published
    short_title     TEXT,
    issuer          TEXT NOT NULL,            -- 'National Commission on Terrorist Attacks Upon the United States'
    issuer_short    TEXT,                     -- '9/11 Commission'
    date_issued     DATE NOT NULL,
    source_id       TEXT UNIQUE,              -- govinfo package id: 'GPO-911REPORT'
    source_url      TEXT,                     -- where the text was read from
    govinfo_url     TEXT,
    related         JSONB NOT NULL DEFAULT '[]',  -- [{ relation: created_by | followed_by, citation, title, date, document, url, notes }]
    structure       JSONB,                    -- parts (outline only: sections with opening words), recommendations, counts, source
    loaded_at       TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  -- One row per part (chapter, preface, appendix, the summary), in reading order.
  CREATE TABLE IF NOT EXISTS report_parts (
    id              SERIAL PRIMARY KEY,
    report_id       INT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    position        INT NOT NULL,
    part_id         TEXT NOT NULL,            -- 'ch1', 'preface', 'app-b', 'summary'
    kind            TEXT NOT NULL,            -- 'chapter' | 'preface' | 'appendix' | 'summary'
    number          TEXT,                     -- '1', 'B'
    title           TEXT NOT NULL,
    pdf_url         TEXT,
    structure       JSONB NOT NULL,           -- sections → items (the shared shape), notes
    UNIQUE (report_id, part_id)
  );
`;
