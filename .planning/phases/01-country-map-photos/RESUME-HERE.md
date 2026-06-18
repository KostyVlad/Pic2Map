# Phase 1 — Resume Here

**Paused:** 2026-06-18
**Status:** Plan 01 (Walking Skeleton) built; awaiting human sign-off at checkpoint. Plan 02 not started.

## What's done
- Plan 01 (Walking Skeleton): 5/6 tasks committed (through `cf22ff6`). Git tree clean.
  - `client/` (Vite 8 + React 19 + Tailwind 4 + react-leaflet 5 + TanStack Query) and
    `server/` (Express 5 + Mongoose 9 + multer 2.2 + sharp 0.34.5 + heic-convert + file-type 22) scaffolded.
  - End-to-end path wired: country map (Natural Earth 110m GeoJSON) → click country → upload photo
    (StorageAdapter local disk, EXIF stripped, HEIC→JPEG, magic-byte validation) → Mongo → gallery + lightbox.
  - SUMMARY at `01-01-SUMMARY.md`.
- Stopped at Plan 01 **Task 6** = blocking human checkpoint (package legitimacy ✓ verified + skeleton browser sign-off pending).

## To resume
1. Ensure **`MONGODB_URI` is in `server/.env`** (server loads .env from its own dir; NOT root .env).
2. Run: `cd server && npm run dev` (:3001) and `cd client && npm run dev` (:5173); open http://localhost:5173.
3. Smoke test: countries render, click France/Norway works, upload JPEG → thumbnail in gallery → lightbox.
4. On approval → spawn gsd-executor CONTINUATION agent to finish Plan 01 Task 6, then execute **Plan 02**
   (hover highlight, has-photos marking + count badges, bulk upload, full error/success UX), then phase verification.

## Gotchas
- sharp 0.34.5: omit `.withMetadata(false)` (it RETAINS EXIF); default strips it.
- Natural Earth ISO "-99" → `extractIso()` fallback ISO_A2 → ISO_A2_EH → ISO_A3.
- Never run `npm create vite` in repo root.
- Resume command: `/gsd-execute-phase 1` (it will detect Plan 01 SUMMARY exists and continue with Plan 02), or finish Plan 01 Task 6 first if the checkpoint is still open.
