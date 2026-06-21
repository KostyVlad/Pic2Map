---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: checkpoint
stopped_at: "02-03 Task 2: human-check (live email reset walkthrough with RESEND_API_KEY)"
last_updated: "2026-06-21T00:00:00Z"
last_activity: "2026-06-21 -- Phase 2 Plan 03 all tasks implemented; paused at Task 2 human email-reset browser walkthrough"
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 5
  completed_plans: 3
  percent: 40
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-17)

**Core value:** Browse your travels on a world map organized by the countries you've visited — click a country to add and view its photos — with photos auto-placing by GPS over time.
**Current focus:** Phase 2 — accounts-private-maps

## Current Position

Phase: 2 (accounts-private-maps) — CHECKPOINT
Plan: 3 of 3 (all tasks implemented; paused at Task 2 human email-reset walkthrough)
Status: Awaiting human: live password-reset email walkthrough with RESEND_API_KEY set
Last activity: 2026-06-21 -- Phase 2 Plan 03 all 2 tasks implemented and committed; paused at human-check

Progress: [####░░░░░░] 40% (checkpoint at 02-03 Task 2 human-check)

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
- Phase 2 Plan 2: requireAuth mounted at router level in app.js (not per-route). File IDOR returns 404 not 403 (no existence leak). ObjectId cast required in aggregate $match. AuthProvider inside BrowserRouter so screens can use react-router Link/Navigate.
- Phase 2 Plan 3: Email adapter defaults to Resend (smtp.js is a documented stub). Rate limiter on /forgot-password is stricter than /login (5 vs 10/15min). sendEmail in route wrapped in try/catch — mail failure does NOT affect 200 response. ResetPasswordScreen treats missing-token-in-URL and server-400 as the same expired state.

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

Last session: 2026-06-21T00:00:00Z
Stopped at: 02-03 Task 2 — human-check (live password-reset email walkthrough)
Resume file: .planning/phases/02-accounts-private-maps/02-03-PLAN.md (after human approval)
