---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: checkpoint
stopped_at: "02-01 Task 4: supply-chain + JWT_SECRET checkpoint (blocking)"
last_updated: "2026-06-19T20:45:44Z"
last_activity: "2026-06-19 -- Phase 2 Plan 01 paused at human checkpoint (Tasks 1-3 complete)"
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 5
  completed_plans: 2
  percent: 25
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-17)

**Core value:** Browse your travels on a world map organized by the countries you've visited — click a country to add and view its photos — with photos auto-placing by GPS over time.
**Current focus:** Phase 2 — accounts-private-maps

## Current Position

Phase: 2 (accounts-private-maps) — CHECKPOINT
Plan: 1 of 3 (Tasks 1-3 committed; paused at Task 4 blocking human checkpoint)
Status: Awaiting human: supply-chain package verification + JWT_SECRET in server/.env
Last activity: 2026-06-19 -- Phase 2 Plan 01 Tasks 1-3 committed; paused at checkpoint

Progress: [##░░░░░░░░] 25% (checkpoint at 02-01 Task 4)

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Restructured to country-first model: Phase 1 = country map + per-country photos (no accounts); Phase 2 = accounts/isolation; Phase 3 = EXIF auto-placement & pins; Phase 4 = cities/edit/polish.
- Phase 1: No auth (single local user); design data model so adding userId in Phase 2 is a clean migration. Key photos to ISO country codes for Phase 3 point-in-polygon alignment.
- Phase 1: StorageAdapter (local disk, swappable to S3/R2); strip EXIF from served files from day one; multer v2.2.0+; sharp for thumbnails/HEIC→JPEG.
- Phase 2: argon2id passwords, jose JWT in httpOnly cookie (never localStorage).
- Phase 3: react-leaflet v5 ↔ React 19 hard pairing; use-supercluster for clustering; auto-assign country from GPS by point-in-polygon.
- Phase 4: Nominatim geocoding must run async (≤1 req/s) — never inline with upload or it IP-bans the app.
- Phase 1 Plan 1: Backend ESM ("type":"module") for file-type v22 compatibility. sharp.withMetadata(false) retains EXIF in 0.34.5 — omit the call entirely to strip (see ingest.js comments). CountryLayer key prop forces re-mount on photoCounts change (Pitfall 3 fix).
- Phase 2 Plan 1: Signup 400 "Email already registered" IS intentional (UI-SPEC accepts enumeration on signup). Login always returns identical 401 (T-02-ENUM). COOKIE_SECURE=false in dev (Pitfall 3). clearCookie options must match setAuthCookie options or browser won't clear.

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 1 Plan 1 Task 6: User must provide MONGODB_URI (Atlas M0 or local mongod) in server/.env before the skeleton can be fully smoke-tested.
- Phase 1: Confirm sharp HEIC support in target deploy environment (Render/Railway) — heic-convert is used (pure JS, no libheif), so HEIC works without custom Docker; low risk.
- Phase 1/3: Stadia Maps alidade_smooth used for tiles; works on localhost without API key. Production deployment will need key or switch to OSM/MapTiler.
- Phase 4: Decide geocoding worker mechanism (setInterval vs BullMQ + Redis) based on expected upload volume.

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-06-19T20:45:44Z
Stopped at: 02-01 Task 4 — blocking human checkpoint (supply-chain + JWT_SECRET)
Resume file: .planning/phases/02-accounts-private-maps/02-01-PLAN.md (Task 4 onward)
