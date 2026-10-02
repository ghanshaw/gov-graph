-- ─────────────────────────────────────────────────────────────────────────────
-- GovLens: Legal Case Relationship Schema
-- Paste into Supabase SQL editor and run in order.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Provenance: one row per import run
CREATE TABLE IF NOT EXISTS data_sources (
  id          SERIAL PRIMARY KEY,
  name        TEXT        NOT NULL,
  url         TEXT,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes       TEXT
);

-- 2. Cases (scdb_id added after scdb_cases is created below)
CREATE TABLE IF NOT EXISTS cases (
  id                SERIAL PRIMARY KEY,
  name              TEXT NOT NULL,
  citation          TEXT,
  court             TEXT,
  date_decided      DATE,
  courtlistener_id  TEXT UNIQUE,
  source            TEXT,
  source_id         INT REFERENCES data_sources(id)
);

-- 3. SCDB raw import (all columns preserved)
CREATE TABLE IF NOT EXISTS scdb_cases (
  id                SERIAL PRIMARY KEY,
  scdb_case_id      TEXT UNIQUE,
  us_cite           TEXT,
  case_name         TEXT,
  term              INT,
  date_decision     DATE,
  disposition_code  INT,
  disposition_label TEXT,
  raw               JSONB,
  source_id         INT REFERENCES data_sources(id)
);

-- FK from cases → scdb_cases (added after scdb_cases exists)
ALTER TABLE cases ADD COLUMN IF NOT EXISTS scdb_id INT REFERENCES scdb_cases(id);

-- 4. Case relationships (directed edges)
CREATE TABLE IF NOT EXISTS case_relationships (
  id                SERIAL PRIMARY KEY,
  citing_case_id    INT  NOT NULL REFERENCES cases(id),
  cited_case_id     INT  NOT NULL REFERENCES cases(id),
  relationship_type TEXT NOT NULL DEFAULT 'citation',
  treatment         TEXT,
  source            TEXT,
  source_id         INT REFERENCES data_sources(id),
  notes             TEXT,
  UNIQUE (citing_case_id, cited_case_id)
);
