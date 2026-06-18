# Walking Skeleton — PhotoMap

**Phase:** 1
**Generated:** 2026-06-18

## Capability Proven End-to-End

A single local user opens the app, sees an interactive world map of country boundaries, clicks a country, uploads one photo to it through the full ingest pipeline (magic-byte validation → HEIC→JPEG if needed → sharp thumbnail + EXIF strip → StorageAdapter disk write → Mongo metadata insert), and immediately sees that photo's thumbnail in the country's gallery — served from disk with EXIF/GPS stripped, never stored as a binary in MongoDB.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Repo layout | Two-package monorepo: `client/` (Vite 8 + React 19) and `server/` (Express 5 + Mongoose 9). NO Vite scaffold in repo root. | CLAUDE.md MERN constraint; a prior `npm create vite` in the repo root caused problems — scaffold cleanly into `client/` only. |
| Frontend | Vite 8 + React 19 + react-leaflet v5 + Tailwind CSS v4 via `@tailwindcss/vite` | react-leaflet v5 requires React 19 (hard peer pairing); Tailwind locked by CONTEXT D-09 + UI-SPEC. |
| Backend module format | ESM (`"type": "module"` in `server/package.json`) | `file-type` v22 is ESM-only; Express 5 + Mongoose 9 fully support ESM; avoids dynamic-import workaround (RESEARCH Open Question 3). |
| Data layer | MongoDB 8 (Atlas M0 or local) via Mongoose 9; `MONGODB_URI` from env | MongoDB not installed locally (RESEARCH Environment Availability) — developer supplies a connection string before Wave 1 backend runs. |
| Photo storage | `StorageAdapter` interface + `LocalDiskStorage` impl; binaries on disk under `server/uploads/`, never in Mongo | CONTEXT D-06; PHOTO-05; swappable to S3/R2 in v2 (SCALE-01) without route changes. |
| Country data | Natural Earth 110m `ne_110m_admin_0_countries.geojson` bundled as a static asset in `client/public/`, fetched once at app init | RESEARCH Pattern + Pitfall 7; ~820 KB raw / ~45 KB gzip, public domain, no API/rate limit. |
| Country key | ISO 3166-1 alpha-2 via `extractIso()` fallback chain (ISO_A2 → ISO_A2_EH → ISO_A3 → NAME slug) | CONTEXT D-07; Natural Earth `-99` sentinel bug for France/Norway/etc (RESEARCH Pitfall 1); aligns Phase 3 point-in-polygon. |
| Auth | NONE in Phase 1 (single local user). Photo schema reserves a nullable `userId` field for a clean Phase 2 migration. | CONTEXT D-04; ROADMAP Phase 2 boundary. |
| Tiles | Stadia Maps `alidade_smooth` raster, URL from `VITE_TILE_URL` env var | CMAP-05; UI-SPEC Tile Provider; env-swappable to MapTiler. |
| Dev run | `client` on :5173 (Vite), `server` on :3001 (Express); Vite dev-server proxies `/api` → :3001 | RESEARCH Pattern 8; documented full-stack local-run command (no cloud deploy in Phase 1). |

## Stack Touched in Phase 1

- [x] Project scaffold (Vite 8 + React 19 client, Express 5 + Mongoose 9 ESM server, Tailwind v4, lint/test runner)
- [x] Routing — real API routes: `POST /api/photos`, `GET /api/photos`, `GET /api/photos/file/:key`, `GET /api/countries/photo-counts`
- [x] Database — real write (Photo metadata insert on upload) AND real read (per-country photo list + photo-count aggregation)
- [x] UI — interactive country polygons (click → select) + upload form wired to the API + gallery rendering API data
- [x] Deployment — documented local full-stack run: `npm run dev` in `server/` and `client/` (proxy wires them); no cloud deploy this phase

## Out of Scope (Deferred to Later Slices)

- Accounts / login / logout / per-user data isolation — Phase 2 (AUTH-01..04); `userId` migration happens then.
- Reading EXIF GPS, auto-assigning country by point-in-polygon, exact-location pins, clustering — Phase 3 (GEO-01..05). EXIF is *stripped* now but never *read*.
- Reverse-geocoded cities, group-by-place, move/reposition, delete, per-file upload progress UI, deep mobile polish — Phase 4 (POL-01..06).
- S3/R2 object storage — v2 (SCALE-01); `StorageAdapter` built now for the swap.
- Photo-count heatmap coloring; client-side EXIF preview — later.

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- Phase 2: Accounts & private maps — add `User` model + argon2id + jose httpOnly-cookie auth; add `userId` to every photo query and migrate existing Phase 1 photos under an account.
- Phase 3: EXIF auto-placement & pins — read GPS with exifr on upload, set the reserved `location` GeoJSON + `2dsphere` index, auto-assign country by point-in-polygon, render clustered pins inside a country.
- Phase 4: Places, editing & polish — async Nominatim reverse-geocoding worker, group-by-place, move/reposition, delete, per-file upload progress, mobile polish.
