# Project Research Summary

**Project:** PhotoMap
**Domain:** Personal photo travel-map web application (MERN)
**Researched:** 2026-06-17
**Confidence:** HIGH

## Executive Summary

PhotoMap is a personal travel-map web application where uploaded photos self-place on a
world map via EXIF GPS extraction. The MERN stack is fixed by the workspace and is
well-suited: MongoDB's native `2dsphere` geospatial indexing handles coordinate queries,
React 19 + react-leaflet v5 (a hard version pairing) provides the richest open-source map
experience, and the full recommended stack (Node 20 LTS, Express 5, Mongoose 9, Vite 8,
TanStack Query v5) is internally consistent and current as of mid-2026.

The core technical pattern is a sequential synchronous ingest pipeline (multer → exifr GPS
→ sharp thumbnail → file storage write → MongoDB insert → 201 response) with reverse
geocoding deliberately decoupled into a background async worker to avoid Nominatim
rate-limit exposure and upload latency. Client-side clustering via `use-supercluster`
covers map rendering performance for v1 scale without server-side aggregation complexity.
Authentication is stateless JWT stored in `httpOnly` cookies with per-query `userId`
scoping as the primary security control.

The highest-risk failure modes — all of which must be addressed in Phase 1 and cannot be
retrofitted — are: (1) IDOR on photo endpoints if `userId` filtering is omitted, (2)
Nominatim IP ban if geocoding is not decoupled into an async queue from the start, (3)
storing photo binaries in MongoDB (hits the 16 MB document limit), and (4) silently
dropping photos without GPS (breaks the manual-placement fallback, a core product
requirement).

## Key Findings

### Recommended Stack

The stack is fixed to MERN; research focused on the supporting libraries within it. The
recommendations are internally consistent and current as of mid-2026. See
[STACK.md](STACK.md) for full versions and rationale.

**Core technologies:**
- **exifr v7+**: EXIF/GPS extraction — `exifr.gps()` returns decimal coords with automatic DMS/hemisphere handling and HEIC support; more reliable than sharp metadata for GPS
- **react-leaflet v5 + React 19**: interactive map — hard version pairing (v5 requires React 19 peer dep); richest open-source map UX
- **use-supercluster**: client-side marker clustering — handles v1 scale in-browser, avoids server-side aggregation complexity
- **multer v2.2.0+**: file upload — v1 has active DoS CVEs (CVE-2025-47944, CVE-2025-7338); must pin v2
- **sharp**: thumbnail generation + EXIF stripping + orientation correction
- **jose + argon2id**: auth — `jose` is the modern JWT standard; argon2id is the OWASP password-hashing recommendation; JWT in `httpOnly` cookie, never localStorage
- **TanStack Query v5**: all server state — no Redux/Zustand needed
- **Nominatim (OSM)**: reverse geocoding — free, but strict 1 req/s app-wide limit; call once per photo at ingest and persist result
- **StorageAdapter abstraction** (local disk dev → S3/R2 prod): photo files live in object/file storage, never in MongoDB

### Expected Features

See [FEATURES.md](FEATURES.md) for the full landscape.

**Must have (table stakes):**
- User auth + strict per-account data isolation
- Bulk photo upload with per-file progress feedback
- EXIF GPS auto-placement on map
- Manual pin placement for GPS-less photos (never reject GPS-less uploads)
- World map with marker clustering
- Click pin → lightbox gallery of photos for that place
- Place/city grouping via reverse geocoding
- Delete photo + edit/move pin location
- Responsive mobile-browser UI

**Should have (competitive / post-MVP):**
- Client-side EXIF preview before upload
- Place sidebar list, timeline view
- Search/filter, duplicate detection

**Defer (v2+ / out of scope):**
- Cloud photo import (Google Photos/iCloud)
- Social features (others' maps, sharing, feed)
- Native mobile app, in-app editing, video, AI labeling, export, PWA/offline

### Architecture Approach

A five-component MERN system with a sequential build order rooted in auth/isolation. See
[ARCHITECTURE.md](ARCHITECTURE.md).

**Major components:**
1. **React SPA** — map UI, upload, lightbox (TanStack Query for server state)
2. **Express API** — auth, upload/ingest, photo CRUD, map/place data; every query scoped to `userId`
3. **MongoDB** — users; photos as GeoJSON `Point` with compound `{ userId: 1, location: "2dsphere" }` index; `places` cache with TTL
4. **File Storage** — `StorageAdapter` (local disk dev, S3/R2 prod); ownership-checked serving
5. **Geocode worker** — async background job consuming `geocodeStatus: pending` photos at ≤1 req/s

### Critical Pitfalls

Top items from [PITFALLS.md](PITFALLS.md) (18 documented):

1. **IDOR across users** — always `findOne({ _id, userId: req.userId })`; cross-user integration tests before deploy (Phase 1)
2. **Photo binaries in MongoDB** — hits 16 MB doc limit; use StorageAdapter from day one, not retrofittable (Phase 1)
3. **GPS-less photos silently dropped** — accept all uploads; set `placementStatus: pending_manual` (Phase 1)
4. **EXIF GPS sign / hemisphere errors** — DMS N/S/E/W must negate coords; exifr handles automatically, raw parsers don't (Phase 1)
5. **EXIF leaked in served files** — `sharp().withMetadata(false)` strips GPS from served images; GPS lives only in DB (Phase 1)
6. **Nominatim rate-limit / IP ban** — async queue, ≤1 req/s, coordinate-level cache before first call (Phase 3)
7. **No clustering = browser freeze at 500+ markers** — clustering in from first map implementation (Phase 2)
8. **JWT in localStorage / weak hashing** — `httpOnly` cookie + argon2id (Phase 1)
9. **HEIC/orientation handling** — confirm exifr v7+ and sharp HEIC build; `sharp().rotate()` before resize (Phase 1)
10. **OSM tile ToS violation in prod** — use Stadia/Maptiler/Mapbox tiles via env var, not raw OSM tiles (Phase 2)

## Implications for Roadmap

Based on research, suggested phase structure (granularity = coarse, 4 phases). The build
order is a strict dependency chain rooted in auth/isolation.

### Phase 1: Foundation — Auth, Upload Pipeline, Data Model
**Rationale:** Nothing can be written safely before `userId` isolation exists; storage
adapter, 2dsphere schema, and all Phase-1 security pitfalls are not retrofittable.
**Delivers:** Registration/login (argon2 + httpOnly JWT), file upload (multer v2), EXIF
GPS ingest (exifr), thumbnail generation + EXIF stripping (sharp), StorageAdapter, Photo
CRUD API scoped to userId.
**Addresses:** auth + isolation, file upload, EXIF auto-placement, accept GPS-less uploads.
**Avoids:** IDOR, MongoDB binary storage, GPS sign errors, EXIF leakage, weak auth.

### Phase 2: Map UI — Rendering, Clustering, Lightbox
**Rationale:** Requires the stable Photo schema/API from Phase 1; tile provider and
clustering approach must be chosen before map implementation begins.
**Delivers:** react-leaflet map, use-supercluster clustering, production tile provider,
click-pin lightbox gallery, bulk upload with progress UI.
**Uses:** react-leaflet v5/React 19, use-supercluster, TanStack Query.
**Implements:** React SPA + map data API component.

### Phase 3: Reverse Geocoding & Place Grouping
**Rationale:** Requires `geocodeStatus` field and locked Photo schema (Phase 1); async
worker pattern must precede the first Nominatim call.
**Delivers:** Background geocoding worker (≤1 req/s), `places` cache collection,
place-list sidebar, place-filtered photo queries.
**Avoids:** Nominatim rate-limit ban.

### Phase 4: Manual Placement, Edit & Polish
**Rationale:** Requires map UI (Phase 2) and photo update routes (Phase 1); closes
remaining core requirements.
**Delivers:** GPS-less photo placement queue, click-map-to-place, drag-to-move pin, edit
location, duplicate detection, client-side EXIF preview, responsive polish.

### Phase Ordering Rationale

- Auth is a hard dependency of every subsequent component (`req.userId` isolation).
- The ingest pipeline (the product's core "magic") depends only on auth + storage.
- Map UI depends on a stable Photo schema/API from Phase 1.
- Geocoding and manual placement are finishing concerns layered on the map.
- Pitfall-dense, non-retrofittable concerns are front-loaded into Phase 1.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** react-leaflet-cluster CSS import behavior + tile-provider free-tier
  selection (Stadia vs Maptiler vs Mapbox) — worth a targeted spike before implementation.

Phases with standard patterns (skip research-phase):
- **Phase 1, 3, 4:** well-documented, established patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions verified against release notes/official docs; one MEDIUM area (tile provider scale thresholds) |
| Features | HIGH | Validated across Polarsteps, Google Photos, Journi, Immich, GeoPhoto |
| Architecture | HIGH | MongoDB/Mongoose geospatial + storage isolation patterns from official docs |
| Pitfalls | HIGH | EXIF spec behavior, OSM published policies, OWASP patterns |

**Overall confidence:** HIGH

### Gaps to Address

- **sharp HEIC support in deploy env**: verify prebuilt binary includes libvips/HEIC on
  target PaaS (Render/Railway) — may need Docker or `heic-convert` fallback (Phase 1).
- **Tile provider choice**: confirm Stadia vs Maptiler before Phase 2 — free-tier limits differ.
- **Geocoding worker mechanism**: `setInterval` worker (v1) vs BullMQ + Redis — decide by
  expected upload volume (Phase 3 scope).
- **Max upload file size**: define a limit (50 MB suggested) before the upload phase.

## Sources

### Primary (HIGH confidence)
- exifr, multer, sharp, react-leaflet, jose, argon2 — official docs / GitHub release notes
- MongoDB + Mongoose geospatial (`2dsphere`, GeoJSON) — official docs
- OWASP password storage cheat sheet; OSM/Nominatim usage policy

### Secondary (MEDIUM confidence)
- use-supercluster performance characteristics — community benchmarks
- Tile provider free-tier thresholds — vendor docs (limits vary)

---
*Research completed: 2026-06-17*
*Ready for roadmap: yes*
