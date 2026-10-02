# Feature Tracking

## Status
Complete

## Goal
A lightweight system for tracking feature development across the govgraph project.
Each feature lives in its own subfolder under `features/` with an `index.md` as the
canonical status file. A Node.js script generates a static dashboard HTML from all
feature files, runnable via `npm run dashboard`.

## Done
- [x] Define index.md format
- [x] Design generate-dashboard.js script
- [x] Design dashboard HTML/CSS layout
- [x] Create root package.json with dashboard script
- [x] Update CLAUDE.md with feature tracking instructions

## Todo
- [x] Verify dashboard renders correctly in browser

## Decisions / Notes
- Zero npm dependencies for the generator script (Node built-ins only)
- Dashboard is a static file — open directly in browser, no server needed
- `features/dashboard.html` is generated, not hand-edited
