# Obama Executive Orders

A full-stack web app that displays all of Barack Obama's executive orders,
sourced live from the Federal Register API.

## Stack

| Layer    | Tech                                      |
|----------|-------------------------------------------|
| Backend  | Node.js, Express, Apollo Server, GraphQL  |
| Frontend | React, Vite, Apollo Client, Tailwind CSS  |
| Data     | Federal Register API (no key required)    |
| Caching  | node-cache (10 min TTL, server-side)      |

## Project Structure

```
obama-eo/
├── server/
│   ├── index.js       ← Express + Apollo Server entrypoint
│   ├── schema.js      ← GraphQL type definitions
│   ├── resolvers.js   ← Data fetching + caching logic
│   └── package.json
└── client/
    ├── src/
    │   ├── apollo.js               ← Apollo Client instance
    │   ├── queries.js              ← GQL query definitions
    │   ├── App.jsx                 ← Router + ApolloProvider
    │   ├── index.css               ← Global styles / theme
    │   ├── components/
    │   │   ├── Header.jsx
    │   │   ├── ExecutiveOrderCard.jsx
    │   │   └── Pagination.jsx
    │   └── pages/
    │       ├── Home.jsx            ← List, search, filter
    │       └── Detail.jsx          ← Single EO detail view
    └── vite.config.js
```

## Setup & Run

You need Node.js 18+ installed.

### 1. Start the backend

```bash
cd server
npm install
node index.js
```

GraphQL playground available at: http://localhost:9001/graphql

### 2. Start the frontend (new terminal)

```bash
cd client
npm install
npm run dev
```

App running at: http://localhost:9000

## GraphQL API

The backend exposes a single GraphQL endpoint at `/graphql`.

### Queries

**List executive orders** (paginated, filterable):
```graphql
query {
  executiveOrders(page: 1, perPage: 20, search: "healthcare", year: 2010) {
    orders {
      number
      title
      dateSigned
      abstract
      url
      topics
    }
    totalCount
    currentPage
    totalPages
  }
}
```

**Single executive order** by EO number:
```graphql
query {
  executiveOrder(number: "13489") {
    number
    title
    dateSigned
    abstract
    url
    fullTextUrl
    topics
  }
}
```

## Features

- Browse all ~276 Obama executive orders
- Search by keyword
- Filter by year (2009–2017)
- Paginate through results (20 per page)
- Click any order for a full detail view
- Links to full text on federalregister.gov
- Server-side caching (10 min) to avoid hammering the API

## Data Source

All data comes from the official [Federal Register API](https://www.federalregister.gov/developers/api/v1).
No API key required. Data is public domain.
