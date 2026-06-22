---
phase: 03-exif-auto-placement-pins
plan: 01
subsystem: api
tags: [exifr, turf, geojson, gps, point-in-polygon, react-query, leaflet]

# Dependency graph
requires:
  - phase: 02-accounts-private-maps
    provides: requireAuth middleware, userId scoping on Photo model, multer upload pipeline with rawBuffer

provides:
  - server/src/services/gps.js — extractGps(buffer) + isValidGps(lat, lng)
  - server/src/services/countryLookup.js — resolveCountry(lat, lng) via turf pip
  - server/src/data/countries.geojson — server-local copy of merged country polygons
  - server/src/utils/isoCode.js — SU_A3-chain extractIso (mirrors client)
  - server/src/routes/photos.js — enriched POST (GPS auto-assign) + GET (includes location)
  - client/src/api/photos.js — useUploadGlobal mutation
  - client/src/components/GpsResultSummary.jsx — auto-placed / no-GPS result rows
  - client/src/components/GlobalUploadButton.jsx — map-level upload control

affects: [03-02-pins-clustering, 04-cities-edit-polish]

# Tech tracking
tech-stack:
  added:
    - exifr 7.1.3 (server) — GPS EXIF extraction from raw buffer
    - "@turf/boolean-point-in-polygon 7.3.5" (server) — point-in-polygon country lookup
  patterns:
    - GPS read from rawBuffer pre-ingest (D-01 ordering: multer → magic-byte → extractGps → ingestPhoto)
    - SU_A3-chain country keying (server isoCode.js mirrors client)
    - Lazy singleton GeoJSON cache in countryLookup.js (module-level _features)
    - Dual upload path (global = GPS auto-assign; per-country = manual wins, D-02)
    - Enriched POST response shape: { uploaded, placed[], noGps, results }
    - React Query per-country invalidation in useUploadGlobal (iterate placed[])

key-files:
  created:
    - server/src/services/gps.js
    - server/src/services/countryLookup.js
    - server/src/data/countries.geojson
    - server/test/geo.test.js
    - client/src/components/GpsResultSummary.jsx
    - client/src/components/GlobalUploadButton.jsx
  modified:
    - server/src/utils/isoCode.js (full replacement: ISO_A2 → SU_A3 chain)
    - server/src/routes/photos.js (GPS integration + enriched response)
    - server/test/ingest.test.js (rewrite extractIso tests for SU_A3)
    - server/package.json (add exifr, @turf/boolean-point-in-polygon; fix test glob)
    - client/src/api/photos.js (add useUploadGlobal)
    - client/src/App.jsx (mount GlobalUploadButton)

key-decisions:
  - "Server isoCode.js replaced with SU_A3 chain (mirrors client) — ISO_A2 produced wrong keys for all 301 GeoJSON features (Pitfall 1 fix)"
  - "countries.geojson copied to server/src/data/ — avoids cross-package path coupling (Assumption A2 resolved)"
  - "GPS read from rawBuffer BEFORE ingestPhoto() — sharp strips EXIF at ingest; HEIC GPS only in original container (D-01)"
  - "Per-country upload: GPS stored only when resolves to same country; otherwise location stays null (Pitfall 10, Option B)"
  - "noGps files skipped + reported, not placed — D-03/D-04 no-snapping requirement satisfied"
  - "npm test script fixed from 'test/' directory form to 'test/*.test.js' glob for Windows compatibility"

patterns-established:
  - "GPS-pre-ingest ordering: extractGps(rawBuffer) must run between validateMagicBytes and ingestPhoto"
  - "Dual upload path: normalizedCode===null → global/GPS path; normalizedCode set → manual path"
  - "GeoJSON point uses [lng, lat] order at every boundary (turf, MongoDB, Leaflet uses [lat, lng])"

requirements-completed: [GEO-01, GEO-02, GEO-05]

# Metrics
duration: 7min
completed: 2026-06-22
---

# Phase 03 Plan 01: GPS Auto-Placement Upload Slice Summary

**Server GPS extraction with exifr + turf point-in-polygon auto-assigns country on global upload; GpsResultSummary shows placed/no-GPS counts; SU_A3 keying fixed across server**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-06-22T08:08:43Z
- **Completed:** 2026-06-22T08:17:06Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Replaced server ISO_A2-based isoCode.js with SU_A3-chain version (mirrors client) — all 301 GeoJSON features now match
- Created GPS extraction service (exifr) + country lookup service (turf pip) with server-local GeoJSON copy
- Wired GPS pipeline into upload route: global uploads auto-assign country; no-GPS files gracefully reported
- Added useUploadGlobal mutation + GpsResultSummary component + GlobalUploadButton at map level
- Full server test suite: 31/31 pass; client Vite build: clean

## Task Commits

1. **Task 1: Fix server keying (SU_A3) + add services** - `4f1832b` (feat)
2. **Task 2: Wire GPS into upload route + enrich response** - `6337792` (feat)
3. **Task 3: useUploadGlobal + GpsResultSummary + GlobalUploadButton** - `86b2f0b` (feat)

## Files Created/Modified

- `server/src/utils/isoCode.js` — replaced: SU_A3-chain (was ISO_A2-chain)
- `server/src/services/gps.js` — new: extractGps(buffer) + isValidGps(lat, lng)
- `server/src/services/countryLookup.js` — new: resolveCountry(lat, lng) via turf pip, lazy GeoJSON cache
- `server/src/data/countries.geojson` — new: server-local copy (2 MB, 301 features)
- `server/src/routes/photos.js` — modified: GPS integration, dual upload path, enriched response, location in GET select
- `server/test/ingest.test.js` — modified: rewrite 5 extractIso tests for SU_A3 chain
- `server/test/geo.test.js` — new: resolveCountry + isValidGps + extractGps tests (27 total; all pass)
- `server/package.json` — modified: add exifr, @turf/boolean-point-in-polygon; fix test script glob
- `client/src/api/photos.js` — modified: add useUploadGlobal mutation
- `client/src/components/GpsResultSummary.jsx` — new: accent/muted dot rows per UI-SPEC §5
- `client/src/components/GlobalUploadButton.jsx` — new: fixed top-right z-[500] upload control
- `client/src/App.jsx` — modified: mount GlobalUploadButton alongside AccountStrip

## Decisions Made

- Fixed npm test script from `test/` (fails on Windows) to `test/*.test.js` glob — [Rule 1 - Bug] auto-fix since it was discovered blocking test verification.
- Used server-local copy of countries.geojson rather than cross-package path — resolves Assumption A2 (deployment fragility).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] npm test script used directory form incompatible with Windows Node.js**
- **Found during:** Task 1 verification
- **Issue:** `node --test test/` on Windows tries to load `test/` as a module, not a directory of test files
- **Fix:** Changed test script to `node --test test/*.test.js` (glob form works on Windows)
- **Files modified:** server/package.json
- **Verification:** npm test runs all 31 tests with 0 failures
- **Committed in:** `4f1832b` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Necessary Windows compatibility fix. No scope creep.

## Issues Encountered

None beyond the npm test script fix above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- GPS + country-lookup pipeline complete; `Photo.location` now populated for geotagged uploads
- `location` field included in GET /api/photos response — ready for Plan 02 (CountryPinMap)
- SU_A3 keying unified across client and server — pin country codes will match map features
- Blocker: Plan 02 needs `use-supercluster` + `supercluster` client packages (not in scope of this plan)

## Threat Surface Scan

All threats addressed per plan's `<threat_model>`:
- T-03-GPS-INJ: isValidGps() gates every coord before resolveCountry/storage
- T-03-EXIF-LEAK: GPS read pre-ingest; served files remain EXIF-stripped (ingest unchanged)
- T-03-IDOR-UPLOAD: Photo.create keeps `userId: req.userId` — global uploads scoped to uploader
- T-03-NOCC-BYPASS: graceful skip into noGps list (accepted)
- T-03-XSS-FILENAME: filenames rendered via React in GpsResultSummary (auto-escaped)
- T-03-DOS: existing multer limits unchanged (accepted)
- T-03-SC: both packages approved in RESEARCH audit (no new surfaces)

No new threat surfaces introduced beyond the plan's threat model.

---
*Phase: 03-exif-auto-placement-pins*
*Completed: 2026-06-22*
