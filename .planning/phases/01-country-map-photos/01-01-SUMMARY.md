---
phase: 01-country-map-photos
plan: 01
subsystem: walking-skeleton
tags: [scaffold, mern, leaflet, sharp, multer, tailwind, tdd]
dependency_graph:
  requires: []
  provides:
    - server/src/config.js
    - server/src/db.js
    - server/src/app.js
    - server/src/server.js
    - server/src/models/Photo.js
    - server/src/utils/isoCode.js
    - server/src/services/ingest.js
    - server/src/services/storage/LocalDiskStorage.js
    - server/src/services/storage/index.js
    - server/src/middleware/upload.js
    - server/src/routes/photos.js
    - server/src/routes/countries.js
    - client/src/main.jsx
    - client/src/App.jsx
    - client/src/index.css
    - client/src/api/photos.js
    - client/src/api/countries.js
    - client/src/components/WorldMap.jsx
    - client/src/components/CountryLayer.jsx
    - client/src/components/CountrySidebar.jsx
    - client/src/components/PhotoUploadForm.jsx
    - client/src/components/PhotoGallery.jsx
    - client/public/countries.geojson
  affects: []
tech_stack:
  added:
    - Express 5.2.1 (ESM, "type":"module")
    - Mongoose 9.7.1
    - multer 2.2.0
    - sharp 0.34.5
    - heic-convert 2.1.0
    - file-type 22.0.1
    - cors 2.8.6
    - dotenv 17.4.2
    - Vite 8.0.16
    - React 19.2.7
    - react-leaflet 5.0.0
    - leaflet 1.9.4
    - "@tanstack/react-query 5.101.0"
    - yet-another-react-lightbox 3.32.0
    - react-photo-album 3.6.0
    - tailwindcss 4.3.1
    - "@tailwindcss/vite 4.3.1"
  patterns:
    - ESM monorepo (server/ + client/ packages, no root Vite scaffold)
    - Tailwind v4 @theme tokens in index.css
    - StorageAdapter interface + LocalDiskStorage singleton
    - TanStack Query mutation invalidates ['photos', cc] + ['photo-counts'] on success
    - CountryLayer re-mounted via key prop when photoCounts changes (Pitfall 3 fix)
key_files:
  created:
    - server/package.json
    - server/.env.example
    - server/src/config.js
    - server/src/db.js
    - server/src/app.js
    - server/src/server.js
    - server/src/models/Photo.js
    - server/src/utils/isoCode.js
    - server/src/services/ingest.js
    - server/src/services/storage/StorageAdapter.js
    - server/src/services/storage/LocalDiskStorage.js
    - server/src/services/storage/index.js
    - server/src/middleware/upload.js
    - server/src/routes/photos.js
    - server/src/routes/countries.js
    - server/test/ingest.test.js
    - server/test/skeleton.e2e.test.js
    - client/package.json
    - client/vite.config.js
    - client/index.html
    - client/src/main.jsx
    - client/src/App.jsx
    - client/src/index.css
    - client/public/countries.geojson
    - client/src/api/photos.js
    - client/src/api/countries.js
    - client/src/components/WorldMap.jsx
    - client/src/components/CountryLayer.jsx
    - client/src/components/CountrySidebar.jsx
    - client/src/components/PhotoUploadForm.jsx
    - client/src/components/PhotoGallery.jsx
  modified:
    - .gitignore
decisions:
  - "Backend ESM (type: module) — file-type v22 is ESM-only; cleaner than dynamic import workaround"
  - "sharp 0.34.5 pinned per CLAUDE.md — 0.35.x RC status not re-verified"
  - "withMetadata() omitted entirely in ingest.js — in sharp 0.34.5 calling withMetadata(false) paradoxically RETAINS EXIF; omitting the call strips all metadata by default"
  - "Natural Earth 110m GeoJSON bundled in client/public/ — 820KB raw, ~45KB gzip, fetched once on mount (Pitfall 7 avoided)"
  - "CountryLayer key derived from sorted photoCounts keys — forces re-mount when counts change (Pitfall 3 fix)"
  - "Stadia Maps alidade_smooth tiles on localhost require no API key"
metrics:
  duration_minutes: 22
  completed_date: "2026-06-18"
  tasks_completed: 5
  tasks_total: 6
  files_created: 31
  tests_passing: 16
---

# Phase 01 Plan 01: Walking Skeleton Summary

**One-liner:** ESM MERN monorepo with Leaflet country-polygon map, multer+sharp+heic-convert ingest pipeline, and StorageAdapter disk storage — all routes wired end-to-end, 16 unit tests passing.

## What Was Built

The full Walking Skeleton for PhotoMap: a greenfield two-package monorepo (`server/` + `client/`) that proves the entire core data path end-to-end as a single local user.

### Server (`server/`)
- **Express 5 ESM API** with config validation (throws on missing MONGODB_URI), Mongoose 9 connection, and proper 404/error middleware
- **Photo ingest pipeline** (`ingest.js`): heic-convert → sharp autoOrient+resize (300px/1200px) with EXIF stripped. Works for JPEG, PNG, WebP, and HEIC uploads.
- **StorageAdapter** interface + `LocalDiskStorage` singleton: UUID-keyed files under `./uploads/`, path-traversal protected, env-swappable to S3/R2 in Phase 2
- **Photo Mongoose schema**: `countryCode` (indexed) + reserved nullable `userId` (Phase 2) + reserved `location`/`geocodeStatus` (Phase 3). Never stores binaries.
- **`POST /api/photos`**: multer v2 (25MB/50-file limits), magic-byte validation via file-type v22, per-file ingest, per-file error in results (whole batch not killed by one bad file)
- **`GET /api/photos?countryCode=`**: sorted by createdAt desc
- **`GET /api/photos/file/:key`**: STORAGE_PATH boundary guard + cache-control immutable
- **`GET /api/countries/photo-counts`**: `$group` aggregation returning `{ US: 12, ... }` map

### Client (`client/`)
- **Vite 8 + React 19** scaffold with `@tailwindcss/vite` plugin; Tailwind v4 `@theme` tokens (10 colors, 4 type sizes, font-sans) in `index.css`
- **Leaflet `MapContainer`** center [20,0] zoom 2-6, Stadia alidade_smooth tiles (env-configurable), `worldCopyJump`
- **`CountryLayer`**: all 177 Natural Earth country polygons with `onEachFeature` hover/click handlers (useRef stale-closure fix); click-to-select; full UI-SPEC color table (default/hover/selected/selected-no-photos); ISO extraction client-side with `-99` fallback chain (France/Norway fix); keyboard `tabIndex`+Enter/Space
- **`CountrySidebar`**: fixed right panel 360px desktop / 55dvh mobile; z-500; instant open/close; internal header + upload zone + scrollable gallery
- **`PhotoUploadForm`**: hidden file input; "Add Photos" / "Uploading..." button; format hint; per-upload status message
- **`PhotoGallery`**: 3-col thumbnail grid + yet-another-react-lightbox (zoom/thumbnails disabled per UI-SPEC); "No photos yet" empty state
- **TanStack Query** wiring: `usePhotos`, `usePhotoCounts`, `useUploadPhotos` (invalidates both queries on success)
- **`countries.geojson`**: Natural Earth 110m (177 features, 820KB) bundled in `client/public/`

### Tests
- 16 unit tests passing: `extractIso` (5), `ingestPhoto` (8), `LocalDiskStorage` (3)
- E2e test (`skeleton.e2e.test.js`) self-skips with clear instructions when `MONGODB_URI` absent; proves the full upload→list→serve→count path and no-binary-in-Mongo assertion when MongoDB is available

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] sharp 0.34.5 `withMetadata(false)` retains EXIF instead of stripping it**

- **Found during:** Task 2 TDD GREEN phase (2 test failures: "thumbBuffer has NO exif metadata", "displayBuffer has NO exif metadata")
- **Issue:** In sharp 0.34.5, calling `.withMetadata(false)` paradoxically causes EXIF to be included in output. The behavior is the inverse of the documented API. Calling `.withMetadata()` (no args) also retains EXIF. The default behavior — omitting any `.withMetadata()` call — correctly strips all EXIF/GPS from output.
- **Fix:** Removed all `.withMetadata(false)` calls from `ingest.js`. The sharp default (no call) strips EXIF. Added a comment explaining this behavior and the mandate to never add `.withMetadata()` here.
- **Files modified:** `server/src/services/ingest.js`
- **Commit:** 548bc14
- **Security impact:** This is a critical privacy fix — with the wrong call, GPS coordinates would have survived in served files (T-01-EXIF). The fix brings behavior into compliance with D-06 / PHOTO-02.

## Authentication Gates

None. Phase 1 is single local user, no authentication required.

## Known Stubs

None. All data paths are wired to real API endpoints:
- Photo gallery reads from `GET /api/photos?countryCode=`
- Upload posts to `POST /api/photos`
- Photo counts read from `GET /api/countries/photo-counts`
- File serving reads from `GET /api/photos/file/:key`
- GeoJSON fetched from `/countries.geojson` static asset

The panel shows "No photos yet" when a country has zero photos — this is correct empty-state behavior, not a stub.

## Threat Surface Scan

All surfaces were explicitly covered in the plan's threat model:
- `POST /api/photos` (T-01-MAL, T-01-DOS, T-01-PT, T-01-BIN) — all mitigated
- `GET /api/photos/file/:key` (T-01-PT, T-01-EXIF) — both mitigated
- `countryCode` input (T-01-INJ) — Mongoose uppercase+trim+required validation
- npm packages (T-01-SC) — all in RESEARCH legitimacy audit; blocking human checkpoint (Task 6) for final confirmation

No new threat surfaces introduced beyond those in the plan's threat register.

## Blocking Checkpoint (Task 6)

The plan stops here. Tasks 1–5 are committed. Task 6 is a `checkpoint:human-verify` requiring:
1. Package legitimacy spot-check
2. Human to provide `MONGODB_URI` in `server/.env`
3. Manual smoke test of the running app

See checkpoint details below.

## Self-Check: PASSED

Files verified:
- server/src/config.js — EXISTS
- server/src/routes/photos.js — EXISTS
- server/src/models/Photo.js — EXISTS
- server/src/services/ingest.js — EXISTS
- server/src/services/storage/LocalDiskStorage.js — EXISTS
- client/src/components/WorldMap.jsx — EXISTS
- client/src/components/CountryLayer.jsx — EXISTS
- client/public/countries.geojson — EXISTS (820KB, 177 features)
- server/test/ingest.test.js — EXISTS (16 tests, all pass)
- server/test/skeleton.e2e.test.js — EXISTS (self-skips without MONGODB_URI)

Commits verified:
- 0180995 feat(01-01): scaffold client + server packages
- 53a0363 test(01-01): add failing tests (RED)
- 548bc14 feat(01-01): implement StorageAdapter, Photo model, isoCode, ingest (GREEN)
- 62f5d8d feat(01-01): implement upload middleware and API routes
- 6354be0 feat(01-01): frontend slice
- 7a564f1 feat(01-01): end-to-end skeleton test
