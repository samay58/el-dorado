# Project Roadmap (rev May 2025)

Our objective remains: **surface the best-aligned SF real-estate listings quickly and beautifully.**

---

## Phase Overview
1. ✅ Foundations – monorepo, Prisma schema, scraper MVP, scoring v2, core UI primitives
2. 🚀 Frontend Excellence (current sprint) – polish dashboard + map, auth, perf, tests
3. 🔧 Backend Hardening – scraper locks, error logging, nightly cron, scoped Prisma
4. 🏷 Valuation Engine V1 – hold until after Hardening
5. 📦 CI / Delivery – GH Actions (lint, type, test, build, deploy)

> We freeze lower phases until the one above reaches "green".

---

## Current Sprint – Frontend Excellence

• Finalise Tailwind tokens (colour, spacing, type)  
• Implemented light-default theme & dark-mode toggle (✅)  
• Dashboard: filter drawer (beds, baths, sqft, status), column toggles, responsive grid  
• Map: cluster spiderfy, pin colour by alignment quantile  
• Auth: Supabase magic-link, guard `/admin` + `/criteria`  
• State: TanStack Query cache, SWR fallback  
• Quality: Vitest comps, Playwright smoke, Lighthouse ≥ 90  

Dependencies: `GET /listings` already supports photo thumbnails and required filters.

---

## Next – Backend Hardening

• `SCRAPE_MAX_ENDPOINT_CALLS` env flag  
• `ScrapeRun` + dedup lock (≤30 min)  
• Fastify-scoped Prisma client  
• Global error handler → `EtlError`  
• Nightly cron `/scrape/discovery/zillow`  

---

## Deferred / Stretch

• Valuation Engine V1 (after Hardening)  
• Full CI pipeline  
• Additional portals (Trulia, Redfin)  

---

*Roadmap is single-source-of-truth for priority. Update when strategy shifts.* 