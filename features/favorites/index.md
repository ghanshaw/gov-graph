# Favorites

## Status
First cut built 2026-10-21, not yet run: the `users` and `favorites` tables are not created in the live
database (`server/seed/create-user.js` has to be run from the Mac), and the button and page have not been checked by eye.

## Goal
Let a user keep items they care about (orders, memoranda, bills and laws, decisions, U.S. Code sections,
reports) and find them again on one page. Later: people, economic series, proposals, and saved timeline views.

## Done
- [x] `users` (`id` uuid, `name`, `email` unique, `created_at`) in `server/users.js`; separate from `people`
- [x] `favorites` (`user_id` → users, `ref`, `favorited_at`, primary key `(user_id, ref)`) in `server/favorites.js`;
      refs are the tag refs (`fr:`, `bill:`, `scotus:`, `usc:`, `report:`), resolved by `resolveRefs` in `server/tags.js`
- [x] Current user without sign-in: `currentUser(req)` reads `CURRENT_USER_ID` from `server/.env`; Apollo context
      carries `context.user`, which resolvers read
- [x] GraphQL: `me`, `favorites`, `isFavorite(ref)`; `addFavorite(ref)`, `removeFavorite(ref)` (each returns the new
      state); 5,000 favorites per user at most
- [x] `server/seed/create-user.js`: creates both tables, `--name` adds a user and prints its id
- [x] `FavoriteButton` (☆ Add to favorites / ★ In favorites) first in the row of buttons on order, memorandum, bill,
      decision, U.S. Code section and report pages; hidden when there is no current user
- [x] `/favorites` page grouped by kind like a tag page, most recently added first, ★ to remove; "Favorites" in the nav

## Todo
- [ ] Run `node --env-file=server/.env server/seed/create-user.js --name "…"`, put the id in `server/.env` as
      `CURRENT_USER_ID`, restart the server
- [ ] Check the button and the page by eye
- [ ] Before the app is on a public URL: require a token for `addFavorite` / `removeFavorite` (every visitor acts
      as `CURRENT_USER_ID` until there is sign-in)
- [ ] Favorites for items with pages but no tag ref yet: people (`person:<uuid>`), economic series, proposals
- [ ] Saved timeline views: first make the timeline's whole state (years, toggles, series, lanes, scales) serializable
      in the URL, then a `timeline_views` table favorited as `timeline:<id>`
- [ ] Collections could take "favorites of a user" as a source (`features/collections`)
- [ ] Sign-in (later): `currentUser` reads a session instead of the env var; nothing else changes

## Decisions / Notes
- (2026-10-21) Called favorites, not stars, on screen and in code; the icon is still ☆ / ★.
- (2026-10-21) Favorites are not a tag. Tags are shared, deliberate classification; a favorite is a personal bookmark.
  Both address items by the same ref, so collections can draw on either.
- (2026-10-21) A real `users` table now, without authentication. Rejected: anonymous cookie owners (stars stuck in
  one browser) and localStorage (lost when site data is cleared). Supabase Auth remains the likely sign-in, and maps
  onto `users` one to one.
- (2026-10-21) `isFavorite(ref)` is a query by ref, like `tagsForItem`, rather than a field on each document type, so
  one button serves every kind of item.
