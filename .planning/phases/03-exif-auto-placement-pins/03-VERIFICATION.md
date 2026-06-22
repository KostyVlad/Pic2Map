---
phase: 03-exif-auto-placement-pins
verified: 2026-06-22T00:00:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Run server + client, click Upload Photos, select a known-geotagged JPEG/HEIC batch. Confirm result shows 'N photo(s) auto-placed in [Country]' and the correct country appears on the map (badge updates)."
    expected: "GpsResultSummary shows at least one accent-dot row per placed country; no manual country pick was required."
    why_human: "GPS auto-assignment result depends on real EXIF in real files; cannot be verified with static code inspection."
  - test: "Include at least one GPS-less file in the same batch. Confirm an inline country picker appears (not a toast-and-gone message); select a country and click Add; confirm the photo is added to that country."
    expected: "No file is silently dropped. The pending-files UI shows the no-GPS count, allows country selection, and uploads them successfully (D-03 revised)."
    why_human: "Requires real file selection interaction; the inline-picker flow (D-03 revised) is client-state-driven and cannot be proven by grep."
  - test: "Click a country that has geotagged photos. Confirm the 240px pin map renders with at least one blue circle pin at the correct location inside the country boundaries."
    expected: "GEO-03: pins visible at exact GPS coordinates, not offset or missing."
    why_human: "Coordinate correctness (no lat/lng transposition on a real image) and visual pin placement require browser confirmation."
  - test: "Upload multiple geotagged photos taken close together. Zoom the pin map out until they cluster. Confirm a numbered bubble appears, then click it (or zoom in) and confirm individual pins expand."
    expected: "GEO-04: cluster bubble shows correct count; expansion zoom or click splits it into individual pins."
    why_human: "Clustering behavior depends on actual coordinate proximity and map zoom; cannot be verified statically."
  - test: "Click a country that has ONLY GPS-less photos (uploaded via the per-country form). Confirm the pin map renders empty (no pins) while the gallery below still lists those photos."
    expected: "GEO-05 manual-fallback: empty pin map renders without crash; photos still visible in gallery."
    why_human: "Requires a country with only no-GPS photos; empty-points path must be confirmed not to crash."
  - test: "Open a displayed photo file directly in the browser (right-click the display image, open in new tab). Inspect EXIF via an online EXIF tool or browser devtools — GPS tags should be absent."
    expected: "Served image files have no embedded GPS (PHOTO-02 / D-01 ordering unchanged)."
    why_human: "EXIF stripping of served files requires inspecting actual file bytes, not code."
---

# Phase 3: EXIF Auto-Placement & Pins Verification Report

**Phase Goal:** When a user uploads a photo with GPS in EXIF, the app reads the coordinates, auto-assigns the photo to its country, and shows it as a pin at the exact location when the user drills into that country — with clustering and a manual fallback for GPS-less photos.
**Verified:** 2026-06-22
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

All four success criteria are substantively implemented and wired. The phase goal is achieved at the code level. Six items need live browser confirmation (coordinate correctness on real images, visual pin placement, clustering expansion, no-GPS inline picker, empty-country empty-map, EXIF stripping of served files).

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | On upload, photos with EXIF GPS have coordinates read and stored (correct hemisphere signs, no transposition) | VERIFIED | `server/src/services/gps.js:29` — `exifr.gps(buffer)` returns correctly-signed decimal degrees natively (no manual hemisphere math); `isValidGps` guards range; stored as `[lng, lat]` at `photos.js:142` |
| 2 | A geolocated photo is auto-assigned to the correct country by point-in-polygon — no manual pick when GPS present | VERIFIED | `countryLookup.js:46-58` — `resolveCountry(lat,lng)` does turf `booleanPointInPolygon` against server-local `countries.geojson` (SU_A3 keys); `photos.js:77-88` uses it for global upload path with no countryCode required |
| 3 | Drilling into a country shows pins at exact coordinates; nearby pins cluster and expand on zoom | VERIFIED | `CountryPinMap.jsx` — full `MapContainer` + `PinLayer` with `useSupercluster({radius:60,maxZoom:17})`; `ClusterMarker.jsx:72-75` — `getClusterExpansionZoom` + `flyTo`; `useMapEvents` v5 pattern; bounds-on-mount fix (Pitfall 5 useEffect) |
| 4 | Photos without GPS are accepted and fall back to manual country assignment — nothing silently dropped | VERIFIED | Server: `photos.js:83-87` — no-GPS files are reported via `noGps:true` in results, tmp file unlinked, NOT discarded silently. Client: `GlobalUploadButton.jsx:60-68` — matches no-GPS filenames back to in-browser `File` objects, shows inline country picker (`pending` state); `handlePlacePending` uploads them via `useUploadPhotos` to chosen country |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/src/utils/isoCode.js` | SU_A3-chain extractIso | VERIFIED | `isoCode.js:23` — `p.SU_A3` primary; GU_A3 → ADM0_A3 → NAME slug fallbacks; mirrors `client/src/utils/isoCode.js` exactly |
| `server/src/services/gps.js` | `extractGps(buffer)` + `isValidGps(lat,lng)` | VERIFIED | Both exports present; `extractGps` uses `exifr.gps(buffer)`, never-throws pattern (catch returns null); `isValidGps` guards number/finite/range |
| `server/src/services/countryLookup.js` | `resolveCountry(lat,lng)` via turf pip | VERIFIED | Lazy singleton `_features` cache; `[lng,lat]` GeoJSON point order; returns null for ocean/Antarctica (no snapping) |
| `server/src/data/countries.geojson` | Server-local polygon dataset | VERIFIED | File exists (338 SU_A3 occurrences matching client copy); loaded via `import.meta.url`-relative path |
| `client/public/countries.geojson` | Client polygon asset | VERIFIED | File exists (338 SU_A3 occurrences); served as static asset; used by `GlobalUploadButton.jsx` for inline picker country list |
| `client/src/components/GlobalUploadButton.jsx` | Map-level upload control + inline no-GPS picker | VERIFIED | 181 lines; fixed top-right `z-[500]`; `useUploadGlobal` + `useUploadPhotos`; inline `pending` country-picker for no-GPS files (D-03 revised) |
| `client/src/components/GpsResultSummary.jsx` | Auto-placed / no-GPS result rows | VERIFIED | 43 lines; accent-dot rows per placed country; no-GPS row not shown here (handled by GlobalUploadButton inline picker per D-03 revision); error state with `role="alert"` |
| `client/src/components/CountryPinMap.jsx` | Clustered MapContainer for drill-down | VERIFIED | 177 lines; self-contained MapContainer; `PinLayer` inner component; `useSupercluster`; `useMapEvents` v5; bounds-on-mount `useEffect`; keyed on `photos.length` |
| `client/src/components/PhotoPinMarker.jsx` | Single-photo DivIcon pin | VERIFIED | 73 lines; 16px circle / 44px touch target; `className:''` DivIcon; center-anchored; wraps `<Popup><PinPopup>` |
| `client/src/components/ClusterMarker.jsx` | Cluster bubble DivIcon + expansion zoom | VERIFIED | 81 lines; tiered 32/40/48px; `getClusterExpansionZoom`; `flyTo`; `className:''` DivIcon |
| `client/src/components/PinPopup.jsx` | Thumbnail + filename popup → lightbox | VERIFIED | 46 lines; 180px wide; 180x120 thumbnail; 24-char truncation; `onThumbnailClick` prop |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `server/src/routes/photos.js` | `server/src/services/gps.js` | `extractGps(rawBuffer)` before ingestPhoto | VERIFIED | `photos.js:69` — `extractGps(rawBuffer)`; `ingestPhoto` is at line 102 — ordering confirmed |
| `server/src/routes/photos.js` | `server/src/services/countryLookup.js` | `resolveCountry(lat, lng)` for GPS country assignment | VERIFIED | `photos.js:72` — `resolveCountry(validGps.lat, validGps.lng)` |
| `client/src/components/GlobalUploadButton.jsx` | `client/src/api/photos.js` | `useUploadGlobal` mutation (no countryCode) | VERIFIED | `GlobalUploadButton.jsx:17,42` — imports and calls `useUploadGlobal`; FormData has no `countryCode` append |
| `client/src/components/CountryPinMap.jsx` | `use-supercluster` | `useSupercluster({ points, bounds, zoom })` inside MapContainer child | VERIFIED | `CountryPinMap.jsx:37,104` — import + call inside `PinLayer` |
| `client/src/components/CountryPinMap.jsx` | `react-leaflet` | `useMapEvents` (v5 — no leafletElement) | VERIFIED | `CountryPinMap.jsx:36,75` — `useMapEvents({moveend, zoomend})` returns map instance |
| `client/src/components/CountrySidebar.jsx` | `client/src/components/CountryPinMap.jsx` | Renders CountryPinMap with photos + bbox | VERIFIED | `CountrySidebar.jsx:31,92-98` — import + render above gallery; `countryBbox` prop conditional on truthy |
| `client/src/api/photos.js` | `GET /api/photos` | `usePhotos` select includes `location` field | VERIFIED | Server `photos.js:193` — `.select('...location')`; client `api/photos.js:13` — raw server response returned, no field stripping |
| `WorldMap.jsx` | `CountrySidebar` | `countryBbox` derived from GeoJSON polygon rings | VERIFIED | `WorldMap.jsx:48-76` — `deriveFeatureBbox(feature)` walks polygon rings; `WorldMap.jsx:109,176` — computed and passed as `selectedCountry.bbox` |
| `CountrySidebar` | YARL lightbox (pin path) | `pinLightboxIndex` + `handleOpenLightboxByPhotoId` | VERIFIED | `CountrySidebar.jsx:38-43,112-118` — separate lightbox instance for pin popups; index lookup by `photoId` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `CountryPinMap.jsx` | `photos` prop | `usePhotos(countryCode)` → `GET /api/photos?countryCode=XX` → MongoDB `Photo.find` with `location` in select | Yes — live DB query scoped by `userId`; `location.coordinates` populated at upload time | FLOWING |
| `GpsResultSummary.jsx` | `result.placed` | `useUploadGlobal` → `POST /api/photos` → `placed` array in enriched response | Yes — computed from actual per-file GPS resolution results | FLOWING |
| `GlobalUploadButton.jsx` | `pending.files` | In-browser `File` objects matched by filename from `data.results[].noGps` | Yes — real no-GPS file references kept in memory; not a static empty array | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Server test suite | `cd server && npm test` | 31 pass, 0 fail | PASS |
| Client build | `cd client && npm run build` | Clean build, 504 KB JS | PASS |
| `extractGps` returns null for non-image buffer | `geo.test.js:76-80` (in test suite above) | Covered by passing tests | PASS |
| `resolveCountry(48.86, 2.35)` returns truthy | `geo.test.js:23-28` (in test suite above) | Covered by passing tests | PASS |
| `resolveCountry(0, -30)` returns null | `geo.test.js:30-33` (in test suite above) | Covered by passing tests | PASS |
| `isValidGps(999, 0)` returns false | `geo.test.js:40-42` (in test suite above) | Covered by passing tests | PASS |
| SU_A3 chain correct (5 cases) | `ingest.test.js:52-115` (in test suite above) | Covered by passing tests | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| GEO-01 | 03-01 | On upload, service reads GPS coordinates from photo EXIF | SATISFIED | `gps.js:27-38` — `extractGps` via `exifr.gps(buffer)`; called pre-ingest at `photos.js:69` |
| GEO-02 | 03-01 | Service auto-assigns country from coordinates (point-in-polygon) — no manual pick when GPS present | SATISFIED | `countryLookup.js:46-58`; `photos.js:77-88` global upload path |
| GEO-03 | 03-02 | Drilling into a country shows photo pins at exact coordinates | SATISFIED (pending human visual confirm) | `CountryPinMap.jsx` + `PhotoPinMarker.jsx`; coordinate chain `[lng,lat]→[lat,lng]` enforced |
| GEO-04 | 03-02 | Nearby pins cluster and expand on zoom | SATISFIED (pending human visual confirm) | `ClusterMarker.jsx` + `useSupercluster` with `radius:60`; `getClusterExpansionZoom` + `flyTo` |
| GEO-05 | 03-01, 03-02 | Photos without GPS fall back to manual assignment — nothing silently dropped | SATISFIED (pending human flow confirm) | Server: `noGps:true` result, not dropped; Client: inline picker in `GlobalUploadButton.jsx:60-94` |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `client/src/components/CountrySidebar.jsx` | 90 | `{countryBbox && (<CountryPinMap ...>)}` | Info | CountryPinMap is NOT rendered when `countryBbox` is null. `WorldMap.jsx:109` sets `bbox = null` when the GeoJSON feature is not found for a code. This means a country without a matching GeoJSON feature will show no pin map. In practice this only affects `handleCountryClick` when `countriesGeoJSON` is still loading (line 97 fallback sets `bbox: null`), which is a loading-state edge case. Not a defect. |

No TBD/FIXME/XXX/unreferenced debt markers found in any Phase 3 modified files.

### Human Verification Required

#### 1. GPS Auto-Placement End-to-End (GEO-01 + GEO-02)

**Test:** Start server + client, log in, click "Upload Photos" (top-right), select several known-geotagged JPEGs or HEICs taken in the same country.
**Expected:** GpsResultSummary shows "N photo(s) auto-placed in [Country]" with a blue accent dot; no manual country picker appears; the country's badge count updates on the map.
**Why human:** GPS coordinate presence in real EXIF files cannot be verified statically. Confirms GEO-01 (coords read) and GEO-02 (auto-assigned) on real data.

#### 2. No-GPS Inline Picker (GEO-05 / D-03 Revised)

**Test:** Include at least one GPS-less file in a global upload batch. Confirm an inline country picker appears (not just a dismissible toast). Select a country and click "Add N". Confirm those photos appear in that country's gallery.
**Expected:** No file is lost. The picker closes after submit; a confirmation message appears briefly; the selected country's gallery now contains the no-GPS photos.
**Why human:** The inline-picker flow is client React state-driven (`pending` state in `GlobalUploadButton`). Requires real file selection to trigger the `noGps` result path.

#### 3. Pin Placement at Correct Coordinates (GEO-03)

**Test:** Open a country that has geotagged photos. Confirm the 240px pin map renders with blue circle pins inside the country's borders, positioned at the actual photo locations.
**Expected:** Pins appear at the correct GPS locations with no lat/lng transposition. The map fits to the country's bounds on open.
**Why human:** Coordinate correctness (no transposition on real images) and visual placement accuracy require browser confirmation. Code inspection confirms `[lng,lat]→[lat,lng]` ordering at every boundary but cannot prove correctness on real EXIF.

#### 4. Clustering and Expansion (GEO-04)

**Test:** Upload several geotagged photos taken within a few kilometers of each other. Open that country. Zoom the pin map out until a numbered bubble appears. Click the bubble (or zoom in) and confirm it splits into individual pins.
**Expected:** Cluster shows the correct photo count; clicking flies to expansion zoom and individual pins become visible.
**Why human:** Requires actual close-proximity GPS data; supercluster behavior (radius: 60px) is zoom-dependent.

#### 5. Empty Pin Map for No-GPS Country (GEO-05 Manual-Fallback)

**Test:** Open a country whose photos were ALL uploaded via the per-country panel (no GPS). Confirm the pin map renders but is empty (no pins), and the gallery below still lists all photos.
**Expected:** No crash, no missing gallery, just an empty map tile.
**Why human:** Requires a real data state where `photos.filter(p => p.location?.coordinates?.length === 2)` returns empty; the empty `useSupercluster` path must not throw.

#### 6. Served Images Are EXIF-Stripped (PHOTO-02 / D-01)

**Test:** Upload a geotagged photo. Open its display URL (`/api/photos/file/<key>`) directly. Check EXIF with an online tool (e.g. exif.tools) or `exiftool` — GPS tags must be absent.
**Expected:** No GPSLatitude, GPSLongitude, or any EXIF block in the served file.
**Why human:** Requires inspecting actual served bytes; code confirms `ingestPhoto` omits `.withMetadata()` (sharp strips EXIF by default) but the actual file bytes must be checked.

### Gaps Summary

No gaps blocking goal achievement. All four success criteria are implemented and wired in the codebase. The six human-verification items are behavioral confirmations on real data, not code defects.

**Key implementation quality notes:**
- Coordinate order is correctly handled at every boundary: `exifr` → `{lat,lng}` → stored as `[lng,lat]` GeoJSON → returned to client as `[lng,lat]` → `Marker position={[lat,lng]}` (swapped at render). No transposition bug found.
- The SU_A3 key chain is identical between `server/src/utils/isoCode.js` and `client/src/utils/isoCode.js` (both have 4 levels: SU_A3 → GU_A3 → ADM0_A3 → NAME slug), ensuring GPS-resolved country codes match map polygon keys.
- The D-03 revised no-GPS flow (inline picker instead of silent drop / re-upload requirement) is fully implemented in `GlobalUploadButton.jsx`.
- The bounds-on-mount problem (Pitfall 5) is correctly solved: `useEffect(() => updateBoundsZoom(map), [])` runs immediately after `MapContainer` mounts so clusters appear before any user interaction.
- Server test suite: 31/31 pass (geo.test.js + ingest.test.js SU_A3 + auth + storage tests). Client build: clean.

---

_Verified: 2026-06-22_
_Verifier: Claude (gsd-verifier)_
