# Plan 01-02 Summary — Refinement + Map Fixes

**Phase:** 1 — Country Map & Per-Country Photos
**Plan:** 02 (Refinement)
**Status:** Implemented — awaiting user visual sign-off (Plan 02 checkpoint)

## What was built

Refined the Walking Skeleton's map and upload to their full UI-SPEC behavior, and resolved
three issues the user found while testing Plan 01:

### Checkpoint fixes (from user browser testing)
- **Fix 1 — stale hover highlight:** `CountryLayer.jsx` now resets a polygon to its computed
  base style on `mouseout` (default / has-photos), while the selected country keeps its
  selected style. No more countries staying highlighted while panning.
- **Fix 2 — small islands not selectable:** replaced the 110m GeoJSON with **Natural Earth
  10m map_subunits** (`client/public/countries.geojson`, ~2.2 MB). Small nations (e.g.
  Dominica) now render and are clickable.
- **Fix 3 — overseas territories merged with parent:** keying changed from `ISO_A2` to the
  **subunit code** (`SU_A3` → `GU_A3` → `ADM0_A3` → name-slug) via `extractIso()`. French
  Guiana is now a separate, separately-selectable place from metropolitan France. The key
  flows end-to-end: client click → SU_A3 → upload `countryCode` → server stores it →
  photo-count aggregation + photo list group/filter by it. (Server `extractIso` is unused on
  the write path in Phase 1; it becomes relevant for Phase 3 point-in-polygon.)

### Plan 02 original scope
- **Has-photos marking + count badges:** `PhotoCountBadge.jsx` + `countryCentroid.js` render
  a pill count badge at each country's centroid; countries with photos use the has-photos
  fill style.
- **Bulk upload:** `<input multiple>` + server `upload.array('photos')` accept many files at once.
- **Drag-and-drop:** dropzone with drag-active highlight (`border-accent` + `bg-accent-subtle`)
  and "Drop to Add" label; drops route through the same upload path.
- **Error/success UX:** success toast `"{N} photo(s) added to {Country}"` (auto-clears 4 s),
  per-file error reporting, and full validation error copy (not-accepted / >25 MB / server failure).

## Verification
- `client` builds clean (`vite build`, 125 modules, ~128 KB gzip JS).
- Functional re-test of the 3 fixes is the user's browser sign-off (pending).

## Key files
- client/src/components/CountryLayer.jsx (hover reset, subunit keying, 5-state styles)
- client/src/components/PhotoUploadForm.jsx (bulk + drag-drop + error/success UX)
- client/src/components/PhotoCountBadge.jsx, client/src/utils/countryCentroid.js (count badges)
- client/src/utils/isoCode.js (SU_A3 subunit key)
- client/public/countries.geojson (Natural Earth 10m map_subunits)
- server/src/routes/countries.js, server/src/routes/photos.js (counts/list by stored key)

## Notes / follow-ups
- Server `server/src/utils/isoCode.js` doc/comment still says ISO_A2 (dead code in Phase 1);
  update to subunit key when Phase 3 point-in-polygon lands.
- 10m GeoJSON is ~2.2 MB; acceptable for v1, could be simplified further later if needed.
