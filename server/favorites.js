// Favorites: items a user keeps, addressed by the same refs as tags (server/tags.js):
// fr:<document number>, bill:<source_id>, scotus:<docket slug>, usc:<identifier>, report:<slug>.
// A favorite is a personal bookmark; a tag is a shared, deliberate classification. They are kept apart.
// Created by seed/create-user.js. Page: client/src/pages/Favorites.jsx; FavoriteButton on each item page.

import { pool } from './db.js';
import { REF, resolveRefs } from './tags.js';

export const SCHEMA = `
  CREATE TABLE IF NOT EXISTS favorites (
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ref           TEXT NOT NULL,
    favorited_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, ref)
  );
`;

// Anyone can reach the API until there is sign-in, so a user's list is capped.
const MAX_FAVORITES = 5000;

function requireUser(user) {
  if (!user) throw new Error('No current user: set CURRENT_USER_ID in server/.env (see server/seed/create-user.js)');
  return user;
}

export const favoriteQueries = {
  // The current user's favorites, most recently added first. Items no longer stored keep only their ref.
  favorites: async (_, __, { user }) => {
    if (!user) return [];
    const { rows } = await pool.query(
      'SELECT ref, favorited_at FROM favorites WHERE user_id = $1 ORDER BY favorited_at DESC', [user.id]);
    const added = new Map(rows.map(r => [r.ref, r.favorited_at.toISOString()]));
    return (await resolveRefs(rows.map(r => r.ref))).map(item => ({ ...item, favoritedAt: added.get(item.ref) }));
  },

  isFavorite: async (_, { ref }, { user }) => {
    if (!user) return false;
    const { rowCount } = await pool.query('SELECT 1 FROM favorites WHERE user_id = $1 AND ref = $2', [user.id, ref]);
    return rowCount > 0;
  },
};

export const favoriteMutations = {
  addFavorite: async (_, { ref }, { user }) => {
    requireUser(user);
    if (!REF.test(ref)) throw new Error(`Not an item reference: ${ref}`);
    const { rows: [{ count }] } = await pool.query('SELECT COUNT(*)::int AS count FROM favorites WHERE user_id = $1', [user.id]);
    if (count >= MAX_FAVORITES) throw new Error(`Favorites are limited to ${MAX_FAVORITES}`);
    await pool.query('INSERT INTO favorites (user_id, ref) VALUES ($1, $2) ON CONFLICT DO NOTHING', [user.id, ref]);
    return true;
  },

  removeFavorite: async (_, { ref }, { user }) => {
    requireUser(user);
    await pool.query('DELETE FROM favorites WHERE user_id = $1 AND ref = $2', [user.id, ref]);
    return false;
  },
};
