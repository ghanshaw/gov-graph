#!/usr/bin/env node
/**
 * Create item_tags (which items carry which tag; server/tags.js) beside the existing tags table.
 * It replaces entity_tags, which no longer exists. Safe to re-run.
 *
 * Usage:
 *   node --env-file=server/.env server/seed/create-tag-tables.js
 *
 * Env:
 *   DATABASE_URL — Supabase Postgres connection URI
 */

import { pool } from '../db.js';
import { SCHEMA } from '../tags.js';

await pool.query(SCHEMA);
const { rows: [{ tags }] } = await pool.query('SELECT COUNT(*)::int AS tags FROM tags');
const { rows: [{ items }] } = await pool.query('SELECT COUNT(*)::int AS items FROM item_tags');
console.log(`item_tags ready: ${tags} tags, ${items} tagged items`);
await pool.end();
