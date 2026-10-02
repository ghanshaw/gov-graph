# Executive Orders

This folder tracks work on the executive orders feature of GovLens.

## What It Does

Surfaces presidential executive orders (and related documents like memoranda and proclamations) sourced from the **Federal Register API** — no API key required. Each president has a profile page, and their documents are browsable by type with search and year filtering. Individual orders have detail and full-text views.

## Routes

| Route | Page |
|-------|------|
| `/` | Presidents list |
| `/:slug` | President profile + document type nav |
| `/:slug/:docType` | Paginated list with search/year filter |
| `/:slug/:docType/eo/:number` | Order detail |
| `/:slug/:docType/eo/:number/text` | Full text |

The `:slug` param is the Federal Register president slug (e.g. `barack-obama`, `donald-trump`).

## Data Source

Federal Register API — fetched server-side in `resolvers.js` with a 10-minute `node-cache` TTL. The `president` param on the `executiveOrders` GraphQL query maps directly to the Federal Register slug format.

## Document Types

- Executive Orders
- Presidential Memoranda
- Proclamations
- Notices / Rules (planned)
