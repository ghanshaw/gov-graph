# Executive Orders

## Status
In Progress

## Goal
Surface presidential executive orders (and related documents — memoranda, proclamations) from the
Federal Register API. Each president has a profile page; documents are browsable by type with
search and year filtering. Individual orders have detail and full-text views.

## Done
- [x] Federal Register API integration (no key required, 10-min node-cache TTL)
- [x] GraphQL: `executiveOrders(president, documentType, page, perPage, search, year)` query
- [x] GraphQL: `executiveOrder(number)` and `executiveOrderText(number)` queries
- [x] Presidents list page (`/`)
- [x] President profile page (`/:slug`) with document type nav
- [x] Paginated list page with search + year filter (`/:slug/:docType`)
- [x] Order detail page (`/:slug/:docType/eo/:number`)
- [x] Full text page (`/:slug/:docType/eo/:number/text`)
- [x] Obama and Biden coverage

## Todo
- [ ] Add remaining presidents (Trump I, Bush, Clinton)
- [ ] Add Proclamations document type
- [ ] Add Notices / Rules document type
- [ ] Fix search function (currently broken — may require own DB table)

## Decisions / Notes
- `:slug` param is the Federal Register president slug (e.g. `barack-obama`, `donald-trump`)
- `president` field on Federal Register API returns `{ identifier, name }` object — extract `.identifier` in `mapOrder`
- Search and year filter are server-side via Federal Register API query params
