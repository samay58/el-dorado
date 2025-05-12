# Implementation Checklist (May 2025)

Legend `[x]` done `[>]` in-progress `[ ]` todo `[⚠]` deferred

---

## 0 Foundations (Completed)

[x] Monorepo & tooling
[x] Prisma schema + RLS
[x] Zillow scraper MVP
[x] Scoring Engine v2
[x] Core UI primitives

---

## 1 Active Sprint – Frontend Excellence

### 1.1 Design System
[>] Finalise colour / spacing / type tokens (`tailwind.config.ts`)
[x] Dark-mode palette
[x] Theme system: light default + dark toggle via `ThemeProvider`

### 1.2 Dashboard
[x] Photo thumbnail column
[>] Filter drawer – add beds • baths • sqft • status
[>] Column visibility toggles
[x] Sticky header • zebra rows • keyboard sorting
[>] Responsive tweaks (mobile scroll, md→grid)

### 1.3 Map
[x] Cluster circles + counts
[>] Spiderfy clusters on zoom-in
[>] Pin colour by `alignmentScore` quantile
[x] Popup carousel (primary photo)

### 1.4 Auth & Admin
[ ] Supabase magic-link flow
[ ] Guard `/admin` & `/criteria`

### 1.5 Data & State
[ ] TanStack Query setup + caching
[ ] SWR fallback for micro-pages

### 1.6 Quality
[ ] Vitest component tests
[ ] Playwright smoke tests
[ ] Lighthouse ≥ 90 • bundle-analyse Mapbox

---

## 2 Backend Hardening (post-Frontend)

[ ] `SCRAPE_MAX_ENDPOINT_CALLS` env flag
[ ] `ScrapeRun` model + 30 min dedup lock
[ ] Fastify-scoped Prisma plugin
[ ] Central error handler → `EtlError`
[ ] Nightly cron `/scrape/discovery/zillow`
[ ] DB-backed error logging for scraper & API

---

## 3 Deferred / Stretch

[⚠] Valuation Engine V1 (pause until after Hardening)
[⚠] Full CI (lint • type • test • build) via GH Actions

---

*This file is the canonical execution tracker. Keep it tight and up-to-date.*