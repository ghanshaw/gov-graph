// Users of the app (not `people`, who are legislators, presidents and justices; the two are never joined).
// There is no sign-in yet: the current user is the one named by CURRENT_USER_ID in server/.env, so every
// visitor acts as that user. When authentication arrives, only currentUser changes (it reads a session);
// resolvers keep reading context.user. Created by seed/create-user.js.

import { pool } from './db.js';

export const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    email       TEXT UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

let cached; // { id, user }: the row for CURRENT_USER_ID, looked up once

// The user a request acts as, or null when CURRENT_USER_ID is unset or names no user.
// `req` is unused until there is a session to read.
// eslint-disable-next-line no-unused-vars
export async function currentUser(req) {
  const id = process.env.CURRENT_USER_ID?.trim();
  if (!id) return null;
  if (cached?.id === id) return cached.user;
  try {
    const { rows: [row] } = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [id]);
    cached = { id, user: row ?? null };
    if (!row) console.warn(`CURRENT_USER_ID ${id} names no user; run server/seed/create-user.js`);
  } catch (err) {
    // A missing users table or a malformed id should not take every request down.
    console.warn(`Could not look up CURRENT_USER_ID: ${err.message}`);
    return null;
  }
  return cached.user;
}

export const userQueries = {
  me: (_, __, { user }) => user,
};
