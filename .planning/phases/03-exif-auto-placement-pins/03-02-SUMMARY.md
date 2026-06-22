---
phase: 03-exif-auto-placement-pins
plan: 02
subsystem: ui
tags: [react-leaflet, supercluster, use-supercluster, leaflet-divicon, clustering, pins, lightbox]

# Dependency graph
requires:
  - phase: 03-exif-auto-placement-pins plan 01
    provides: Photo.location GeoJSON Point populated on upload; GET /api/photos returns location field; useUploadGlobal mutation

provides:
  - client/src/components/CountryPinMap.jsx — self-contained clustered MapContainer (useSupercluster + useMapEvents v5)
  - client/src/components/PhotoPinMarker.jsx — 16px circle DivIcon pin, 44px touch target, center-anchored
  - client/src/components/ClusterMarker.jsx — tiered 32/40/48px bubble + getClusterExpansionZoom flyTo click
  - client/src/components/PinPopup.jsx — 180px popup with thumbnail + 24-char filename, onThumbnailClick prop
  - CountrySidebar now renders CountryPinMap above gallery + YARL lightbox wired from pin popups
  - WorldMap now derives [[south,west],[north,east]] bbox from GeoJSON feature polygon rings and threads to CountrySidebar

affects: [04-cities-edit-polish]

# Tech tracking
tech-stack:
  added:
    - supercluster 8.0.1 (client) — Mapbox clustering algorithm (peer dep of use-supercluster)
    - use-supercluster 1.2.0 (client) — React hook for supercluster; integrates with react-leaflet 5 via useMapEvents
  patterns:
    - PinLayer inner component pattern (useMapEvents inside MapContainer child — react-leaflet v5 requirement)
    - Bounds-on-mount via useEffect calling map.getBounds() immediately (Pitfall 5 fix)
    - key={photos.length} on PinLayer to remount only when photo list changes (Pitfall 7)
    - [lng,lat] geometry coordinates with [lat,lng] Marker position (Pitfall 4 enforced at every boundary)
    - Dual YARL lightbox strategy: PhotoGallery owns gallery lightbox; CountrySidebar owns pin-popup lightbox
    - deriveFeatureBbox() walks polygon rings to produce Leaflet LatLngBounds from GeoJSON feature

key-files:
  created:
    - client/src/components/CountryPinMap.jsx
    - client/src/components/PhotoPinMarker.jsx
    - client/src/components/ClusterMarker.jsx
    - client/src/components/PinPopup.jsx
  modified:
    - client/src/components/CountrySidebar.jsx (CountryPinMap + pin lightbox)
    - client/src/components/WorldMap.jsx (bbox derivation + countryBbox prop threading)
    - client/package.json (add supercluster, use-supercluster)

key-decisions:
  - "Dual YARL lightbox: PhotoGallery keeps its own lightbox (with delete toolbar); CountrySidebar adds a view-only lightbox for pin popup clicks — avoids PhotoGallery surgery and keeps concerns separated"
  - "Bounds initialized via useEffect on mount (map.getBounds() after MapContainer mounts) — simpler and more reliable than MapBootstrap component pattern (RESEARCH Pattern 8 Option B)"
  - "deriveFeatureBbox walks GeoJSON polygon rings inline in WorldMap rather than as a separate utility — matches countryCentroid.js ring-walking approach, scope limited to WorldMap"

patterns-established:
  - "useSupercluster must be called inside a MapContainer child component (react-leaflet context scope)"
  - "DivIcon className:'' always empty to suppress Leaflet default white square (mirrors PhotoCountBadge)"
  - "Pin lightbox (pin popup path) is separate from gallery lightbox (gallery thumb path) — same slides, different instances"

requirements-completed: [GEO-03, GEO-04, GEO-05]

# Metrics
duration: 5min
completed: 2026-06-22
---

# Phase 03 Plan 02: Clustered Pin Map + Drill-Down Lightbox Summary

**Clustered Leaflet pin map in country sidebar using use-supercluster + react-leaflet v5; clicking a pin opens a thumbnail popup that launches the existing lightbox at the correct photo index**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-22T08:22:37Z
- **Completed:** 2026-06-22T08:27:21Z
- **Tasks:** 2 complete (Task 3 is human-verify checkpoint — awaiting user)
- **Files modified:** 6

## Accomplishments

- Created CountryPinMap: self-contained MapContainer with PinLayer inner component using `useMapEvents` (react-leaflet v5), non-null bounds on mount (Pitfall 5 fix), keyed on `photos.length` (Pitfall 7), correct [lng,lat] GeoJSON points
- Created PhotoPinMarker (16px circle, 44px touch target, center-anchored), ClusterMarker (tiered 32/40/48px bubble + flyTo expansion zoom), PinPopup (180×120 thumbnail + 24-char filename) — all following PhotoCountBadge DivIcon `className:''` pattern
- Wired CountryPinMap into CountrySidebar above the gallery; pin popup → YARL lightbox via photoId index lookup
- WorldMap derives `[[south,west],[north,east]]` bbox from GeoJSON polygon rings and passes as `countryBbox` to CountrySidebar
- Empty (no-GPS) countries render an empty pin map without crash (GEO-05)
- Client build: clean (502 KB JS)

## Task Commits

1. **Task 1: Install deps + PhotoPinMarker, ClusterMarker, PinPopup** - `8e54a9e` (feat)
2. **Task 2: CountryPinMap + CountrySidebar + WorldMap wiring** - `c70d892` (feat)
3. **Task 3: Human verify checkpoint** - awaiting user

## Files Created/Modified

- `client/src/components/CountryPinMap.jsx` — new: self-contained clustered MapContainer for drill-down view
- `client/src/components/PhotoPinMarker.jsx` — new: 16px circle DivIcon pin, 44px touch target, Popup → PinPopup
- `client/src/components/ClusterMarker.jsx` — new: tiered bubble DivIcon + expansion-zoom flyTo click handler
- `client/src/components/PinPopup.jsx` — new: 180px popup, thumbnail button, 24-char truncated filename
- `client/src/components/CountrySidebar.jsx` — modified: adds CountryPinMap above gallery, pin lightbox by photoId
- `client/src/components/WorldMap.jsx` — modified: deriveFeatureBbox + selectedCountry carries bbox + countryBbox prop
- `client/package.json` + `client/package-lock.json` — modified: supercluster + use-supercluster added

## Decisions Made

- **Dual YARL lightbox strategy:** PhotoGallery keeps its own lightbox (gallery thumb clicks + delete toolbar). CountrySidebar owns a second view-only lightbox for pin popup clicks. Same slides, no PhotoGallery surgery needed.
- **Bounds initialization via useEffect:** `useEffect(() => updateBoundsZoom(map), [])` runs immediately after mount and captures `map.getBounds()` — simpler than the MapBootstrap component approach from RESEARCH Pattern 8.
- **deriveFeatureBbox inline in WorldMap:** mirrors the ring-walking from `countryCentroid.js`, scoped to WorldMap so no new utility file needed.

## Deviations from Plan

None - plan executed exactly as specified. All pitfalls from RESEARCH were addressed (Pitfalls 4, 5, 6, 7). All three DivIcon components mirror the PhotoCountBadge `className:''` pattern exactly.

## Known Stubs

None — pin data flows live from `usePhotos` → `CountryPinMap` → `PinLayer`; bbox derived from real GeoJSON features; lightbox uses real photo storageKey/thumbnailKey. No hardcoded empty values in the rendering path.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- CountryPinMap is ready; pins will appear for any country whose photos have `location.coordinates`
- Pin popup → lightbox path is wired and functional
- Phase 4 (cities/edit/polish) can extend CountryPinMap: add city pins, drag-to-reposition, etc.
- Human verification (Task 3) still pending — user must confirm live browser behavior

## Threat Surface Scan

No new threat surfaces beyond the plan's `<threat_model>`:
- T-03-IDOR-PIN: mitigated by server-side `userId` scoping on GET /api/photos (Wave 1)
- T-03-XSS-POPUP: mitigated — filenames rendered via React (auto-escaped); DivIcon HTML has no user-supplied strings
- T-03-COORD-LEAK-IMG: served images remain EXIF-stripped (unchanged ingest pipeline)

---
*Phase: 03-exif-auto-placement-pins*
*Completed: 2026-06-22 (awaiting human checkpoint)*
