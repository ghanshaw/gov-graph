#!/usr/bin/env node
/**
 * Create the users and favorites tables (server/users.js, server/favorites.js) and, with --name, a user.
 * Prints the new user's id: put it in server/.env as CURRENT_USER_ID and restart the server.
 * Safe to re-run; without --name it only creates the tables and lists the users.
 *
 * Usage:
 *   node --env-file=server/.env server/seed/create-user.js --name "Greer" [--email you@example.com]
 *
 * Env:
 *   DATABASE_URL — Supabase Postgres connection URI
 */

import { pool } from '../db.js';
import { SCHEMA as USERS } from '../users.js';
import { SCHEMA as FAVORITES } from '../favorites.js';

const arg = flag => {
  const i = process.argv.indexOf(flag);
  return i > 0 ? process.argv[i + 1] : undefined;
};

await pool.query(USERS);
await pool.query(FAVORITES);

const name = arg('--name');
if (name) {
  const { rows: [user] } = await pool.query(
    'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id', [name, arg('--email') || null]);
  console.log(`Created ${name}. Add to server/.env:\nCURRENT_USER_ID=${user.id}`);
}

const { rows } = await pool.query(
  `SELECT u.id, u.name, COUNT(f.ref)::int AS favorites
     FROM users u LEFT JOIN favorites f ON f.user_id = u.id GROUP BY u.id ORDER BY u.created_at`);
console.log(rows.length ? rows.map(r => `${r.id}  ${r.name} (${r.favorites} favorites)`).join('\n') : 'No users yet; pass --name');
await pool.end();
