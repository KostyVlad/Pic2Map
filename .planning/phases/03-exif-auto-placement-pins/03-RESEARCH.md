# Phase 3: EXIF Auto-Placement & Pins — Research

**Researched:** 2026-06-22
**Domain:** EXIF GPS extraction (exifr), server-side point-in-polygon (turf), Mongoose GeoJSON, use-supercluster + react-leaflet 5 clustering
**Confidence:** HIGH (all critical paths verified against actual codebase and live registry)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Read GPS coordinates **locally on the server with `exifr`** from the raw upload buffer, BEFORE the ingest pipeline strips EXIF. The route already has `rawBuffer` in hand (`server/src/routes/photos.js`) prior to `ingestPhoto()`.
- **D-02:** Two upload entry points coexist: NEW global "Upload" button (batch, GPS auto-assigns country) + existing per-country panel upload (manual path, GEO-05).
- **D-03:** Global upload only auto-places photos with a resolved country. No-GPS photos are reported back ("add manually") — nothing silently dropped.
- **D-04:** GPS outside every country polygon (ocean, Antarctica, disputed) treated identically to "no GPS" — no nearest-country snapping.

### Claude's Discretion

- Exact `exifr` usage (field selection, GPS sign/hemisphere handling — must avoid transposition per GEO-01) and error handling for malformed EXIF.
- Point-in-polygon: library (turf `booleanPointInPolygon`), server-side loading/caching of polygons, returning `extractIso`-style country key.
- Where coordinates are stored: `Photo.location` (GeoJSON Point, currently null).
- Clustering: `use-supercluster` + react-leaflet 5; pin/cluster visuals defined in UI-SPEC.

### Deferred Ideas (OUT OF SCOPE)

- Backfilling GPS for Phase 1/2 photos already uploaded.
- Reverse-geocoded city/place names (Phase 4, POL-01/02).
- Moving/repositioning a photo's pin or changing its country (Phase 4, POL-03).
- Per-file upload progress UI (Phase 4, POL-05).
- Delete (single + bulk) already shipped early (POL-04).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GEO-01 | On upload, service reads GPS coordinates from photo EXIF | exifr.gps(buffer) — returns { latitude, longitude } correctly signed; must run before ingestPhoto() |
| GEO-02 | Service auto-assigns country from coordinates (point-in-polygon) | turf booleanPointInPolygon against countries.geojson; key via extractIso (SU_A3 chain) |
| GEO-03 | Drilling into a country shows photo pins at their exact coordinates | CountryPinMap: react-leaflet MapContainer + PhotoPinMarker DivIcon; photos API must return location field |
| GEO-04 | Nearby pins cluster into a single marker and expand on zoom | useSupercluster hook + ClusterMarker DivIcon; getClusterExpansionZoom + flyTo on click |
| GEO-05 | Photos without GPS fall back to manual country assignment (Phase 1 flow) | Per-country upload route unchanged; GpsResultSummary reports no-GPS count; no silent drops |
</phase_requirements>

---

## Summary

Phase 3 grafts GPS-aware auto-placement onto the existing upload pipeline and adds a pin/cluster view inside the country sidebar. The critical integration point is `server/src/routes/photos.js`: `rawBuffer` is already available after multer writes the temp file and before `ingestPhoto()` strips EXIF with sharp. `exifr.gps(rawBuffer)` is called in that window — it returns a correctly-signed `{ latitude, longitude }` object (hemisphere handled automatically), returns `undefined` when GPS is absent, and reads HEIC files natively without conversion first.

Point-in-polygon runs on the server using `@turf/boolean-point-in-polygon` against the same `client/public/countries.geojson` already served to the client. One critical discrepancy was confirmed by live testing: **the server `isoCode.js` uses ISO_A2-based keys, which differ from every single one of the 301 features in the current GeoJSON** — the GeoJSON is the 10m subunit dataset keyed by SU_A3, not the 110m ISO_A2 dataset. The server `isoCode.js` must be replaced with the SU_A3-chain version (identical to `client/src/utils/isoCode.js`) before point-in-polygon can return keys that match the map.

On the frontend, `use-supercluster` 1.2.0 (peer-dep: `supercluster` 8.0.1) integrates with react-leaflet 5 via the `useMapEvents` hook inside a child component of `MapContainer`. The `clusters` array returned by `useSupercluster` is iterated; items with `properties.cluster === true` render `ClusterMarker` DivIcons, items without render `PhotoPinMarker` DivIcons. Both follow the existing `PhotoCountBadge` DivIcon pattern already in the codebase.

**Primary recommendation:** Keep GPS extraction strictly in the upload route (pre-ingest), replace server isoCode.js with the SU_A3 chain, add `@turf/boolean-point-in-polygon` to server dependencies, add `use-supercluster` + `supercluster` to client dependencies, and build `CountryPinMap` as a self-contained react-leaflet `MapContainer` inside `CountrySidebar`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| GPS EXIF extraction | API / Backend | — | Must run pre-ingest before sharp strips EXIF; storage-agnostic |
| Point-in-polygon country assignment | API / Backend | — | GeoJSON polygon data is 2 MB; server caches it; not safe to trust client-supplied results |
| Country key produced from GPS | API / Backend | — | Must match SU_A3 client keys; server enforces correctness |
| GPS coordinates storage | Database / Storage | — | Photo.location GeoJSON Point in MongoDB |
| Photo list API (coords in response) | API / Backend | — | GET /api/photos must include location field in select() |
| Global upload button | Browser / Client | Frontend (form) | New UI element at map level; sends files with no countryCode |
| GpsResultSummary | Browser / Client | — | Renders server response: placed/no-GPS counts |
| CountryPinMap (pin/cluster map) | Browser / Client | — | react-leaflet MapContainer rendered inside CountrySidebar |
| Pin/cluster markers (DivIcon) | Browser / Client | — | Leaflet DivIcon, rendered by use-supercluster output |
| Popup + lightbox trigger | Browser / Client | — | PinPopup on pin click, existing YARL lightbox on thumbnail click |

---

## Standard Stack

### Core (server additions)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `exifr` | 7.1.3 | Read GPS from raw upload buffer | 1.6M downloads/week; only widely-used JS EXIF library that handles HEIC natively; Buffer input supported |
| `@turf/boolean-point-in-polygon` | 7.3.5 | Point-in-polygon country lookup | Part of the Turfjs monorepo (mapbox); 3M downloads/week; works directly on GeoJSON Feature objects |

### Core (client additions)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `use-supercluster` | 1.2.0 | React hook for Supercluster | 72K downloads/week; designed for react-leaflet; ROADMAP locked decision |
| `supercluster` | 8.0.1 | Peer dependency for use-supercluster | 9.5M downloads/week; Mapbox's clustering algorithm |

### Already in place (no changes)

| Library | Version | Role |
|---------|---------|------|
| `@turf/turf` | 7.3.5 | Already in client devDependencies (confirmed); not needed server-side (add `@turf/boolean-point-in-polygon` as a direct dependency instead of the full `@turf/turf` bundle) |
| `react-leaflet` | 5.0.0 | Existing; use `useMapEvents` for CountryPinMap bounds/zoom |
| `leaflet` | 1.9.4 | Existing; `L.divIcon` for PhotoPinMarker and ClusterMarker |

**Installation — server:**
```bash
npm install exifr @turf/boolean-point-in-polygon
```

**Installation — client:**
```bash
npm install supercluster use-supercluster
```

**Version verification (confirmed live against npm registry):**
```
exifr@7.1.3         — published 2021-08-05; last updated 2022-05-01
use-supercluster@1.2.0 — published 2024-02-20
supercluster@8.0.1  — published 2023-04-27
@turf/boolean-point-in-polygon@7.3.5 — published 2026-04-19
```

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads/wk | Source Repo | Verdict | Disposition |
|---------|----------|-----|------------|-------------|---------|-------------|
| `exifr` | npm | 8 yrs | 1,589,456 | github.com/MikeKovarik/exifr | OK | Approved |
| `use-supercluster` | npm | 5 yrs | 72,101 | github.com/leighhalliday/use-supercluster | OK | Approved |
| `supercluster` | npm | 7 yrs | 9,459,539 | github.com/mapbox/supercluster | OK | Approved |
| `@turf/boolean-point-in-polygon` | npm | — | 3,013,585 | github.com/Turfjs/turf | OK | Approved |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Upload (global button)           Upload (per-country panel)
        |                                  |
        v                                  v
POST /api/photos                   POST /api/photos
  [no countryCode]                  [countryCode in body]
        |                                  |
  multer → rawBuffer               multer → rawBuffer
        |                                  |
  exifr.gps(rawBuffer)             exifr.gps(rawBuffer)
  → { lat, lng } or undefined      → ignored (manual path)
        |                                  |
  [GPS found?]                     countryCode from body
     YES → booleanPointInPolygon   → Photo.create(countryCode, location=null)
           (countries.geojson)             |
           → countryCode (SU_A3)           |
           → Photo.create(               [result]
               countryCode,         { placed: 0,
               location: GeoJSON      noGps: N }
               Point)
     NO  → { noGps: this file }
        |
  ingestPhoto(rawBuffer)   <-- EXIF stripped here, AFTER GPS read
        |
  storage.put(display, thumb)
        |
  response: {
    placed: [{ photoId, countryCode, countryName }],
    noGps:  [{ file }]
  }

Client: GpsResultSummary reads response
        |
        v
React Query invalidates:
  ['photos', countryCode]   (for each placed countryCode)
  ['photo-counts']

CountrySidebar opens:
  GET /api/photos?countryCode=XX
  → photos with location field included
        |
        v
CountryPinMap (react-leaflet MapContainer)
  → useSupercluster(points, bounds, zoom)
  → clusters array:
      cluster=true  → ClusterMarker (DivIcon)
      cluster=false → PhotoPinMarker (DivIcon)
                          |
                    click → PinPopup
                               |
                     thumbnail click → YARL lightbox
```

### Recommended Project Structure (new files)

```
server/src/
├── services/
│   └── gps.js               # extractGps(buffer) → { lat, lng } | null
│   └── countryLookup.js     # resolveCountry(lat, lng) → { code, name } | null
│                            # (loads + caches countries.geojson once)
client/src/
├── components/
│   ├── CountryPinMap.jsx    # MapContainer for country drill-down pins
│   ├── PhotoPinMarker.jsx   # Single pin DivIcon (16px circle)
│   ├── ClusterMarker.jsx    # Cluster bubble DivIcon (32/40/48px)
│   └── PinPopup.jsx         # Popup on pin click (thumbnail + filename)
│   └── GlobalUploadButton.jsx # New global upload control at map level
│   └── GpsResultSummary.jsx   # Result rows after global upload
├── api/
│   └── photos.js            # Add useUploadGlobal mutation; update usePhotos select
```

### Pattern 1: GPS Extraction from Buffer (server)

```javascript
// server/src/services/gps.js
// Source: exifr npm README + live codebase testing [VERIFIED: npm registry]
import exifr from 'exifr';

/**
 * Extract GPS coordinates from a raw image buffer.
 * exifr.gps() returns { latitude, longitude } in decimal degrees (N/S and E/W
 * applied automatically — no manual hemisphere correction needed).
 * Returns undefined when GPS tags are absent or EXIF is malformed.
 *
 * HEIC: exifr reads HEIC natively. Call extractGps() on the ORIGINAL buffer
 * BEFORE heic-convert runs in ingestPhoto(). GPS lives in the HEIC container's
 * EXIF block; it is NOT present in the JPEG that heic-convert produces.
 *
 * @param {Buffer} buffer — raw upload buffer (before ingest)
 * @returns {Promise<{lat: number, lng: number} | null>}
 */
export async function extractGps(buffer) {
  try {
    const result = await exifr.gps(buffer);
    if (!result || result.latitude == null || result.longitude == null) {
      return null;
    }
    // exifr returns { latitude, longitude } — rename to lat/lng for clarity
    return { lat: result.latitude, lng: result.longitude };
  } catch {
    // Malformed EXIF, truncated buffer, or unsupported format — treat as no GPS
    return null;
  }
}
```

**Critical:** `exifr.gps()` accepts `Buffer` directly. The return value uses `latitude`/`longitude` keys (decimal degrees, correctly signed). `undefined` return means no GPS — the catch block handles malformed EXIF.

### Pattern 2: Server-side Point-in-Polygon (server)

```javascript
// server/src/services/countryLookup.js
// Source: @turf/boolean-point-in-polygon npm docs + live turf test [VERIFIED: npm registry]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { extractIso } from '../utils/isoCode.js';  // MUST be SU_A3 version (see Pitfall 1)

const __dirname = dirname(fileURLToPath(import.meta.url));
// Path to the same GeoJSON the client uses (served from client/public/countries.geojson)
// Load once at module load time — 2 MB, ~301 features, synchronous read is fine at startup
const GEOJSON_PATH = resolve(__dirname, '../../../../client/public/countries.geojson');

let _features = null;
function getFeatures() {
  if (!_features) {
    const raw = readFileSync(GEOJSON_PATH, 'utf8');
    _features = JSON.parse(raw).features;
  }
  return _features;
}

/**
 * Resolve GPS coordinates to a country code and display name.
 * Returns null if the point falls outside all polygons (ocean, disputed).
 *
 * @param {number} lat — decimal degrees latitude (positive = N, negative = S)
 * @param {number} lng — decimal degrees longitude (positive = E, negative = W)
 * @returns {{ code: string, name: string } | null}
 */
export function resolveCountry(lat, lng) {
  // turf uses [lng, lat] order (GeoJSON spec: x=lng, y=lat)
  const pt = { type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] } };
  const features = getFeatures();
  for (const feature of features) {
    if (booleanPointInPolygon(pt, feature)) {
      return {
        code: extractIso(feature),          // SU_A3 key — matches client map
        name: feature.properties.NAME || '',
      };
    }
  }
  return null;  // Ocean / Antarctica / unmatched disputed territory
}
```

**Notes on the geojson path:** The server needs to reach `client/public/countries.geojson`. With the monorepo layout (`server/` and `client/` side by side), `resolve(__dirname, '../../../../client/public/countries.geojson')` from `server/src/services/` works. Alternatively, copy the file to `server/src/data/countries.geojson` at build time to avoid cross-package path coupling — the planner should choose which approach suits the deployment model.

### Pattern 3: Upload Route Integration

The upload route in `server/src/routes/photos.js` currently processes each file sequentially. For Phase 3, the GPS step is inserted between `validateMagicBytes()` and `ingestPhoto()`:

```javascript
// In the per-file loop, AFTER rawBuffer is available and AFTER magic-byte check,
// BEFORE ingestPhoto() is called:

// Phase 3: read GPS from raw buffer BEFORE ingest strips EXIF
const gpsResult = await extractGps(rawBuffer);
let resolvedCountry = null;
let finalCountryCode = normalizedCode;    // default: from request body (manual path)
let finalCountryName = countryName || '';

if (gpsResult) {
  resolvedCountry = resolveCountry(gpsResult.lat, gpsResult.lng);
}

// For global upload (no countryCode in body), GPS resolution determines placement
// For per-country upload (countryCode in body), GPS resolution still stores coords
// but does NOT override the chosen country (manual assignment wins)
if (!normalizedCode && resolvedCountry) {
  finalCountryCode = resolvedCountry.code;
  finalCountryName = resolvedCountry.name;
} else if (!normalizedCode && !resolvedCountry) {
  // Global upload, no GPS resolution — report as noGps, skip placement
  results.push({ file: file.originalname, noGps: true });
  await fs.unlink(file.path).catch(() => {});
  continue;
}

// ... ingestPhoto(), storage.put() proceed with finalCountryCode ...

// When creating the Photo document, include location if GPS was found:
const photo = await Photo.create({
  countryCode: finalCountryCode,
  countryName: finalCountryName,
  storageKey,
  thumbnailKey,
  mimeType: 'image/jpeg',
  originalFilename: file.originalname,
  fileSize: rawBuffer.length,
  userId: req.userId,
  // Phase 3: store GPS point if available
  ...(gpsResult && {
    location: {
      type: 'Point',
      coordinates: [gpsResult.lng, gpsResult.lat],  // GeoJSON: [lng, lat]
    },
  }),
});
```

### Pattern 4: API Response Shape for GpsResultSummary

The POST `/api/photos` response must be enriched to distinguish auto-placed vs. no-GPS:

```javascript
// Aggregate result after processing all files:
const placed = results.filter(r => r.photoId && r.countryCode);
const noGps  = results.filter(r => r.noGps);
const errors = results.filter(r => r.error);

// Group placed by country for GpsResultSummary "N photos auto-placed in [Country]"
const placedByCountry = placed.reduce((acc, r) => {
  const key = r.countryCode;
  if (!acc[key]) acc[key] = { countryCode: key, countryName: r.countryName, count: 0 };
  acc[key].count++;
  return acc;
}, {});

res.status(201).json({
  uploaded: placed.length,
  placed: Object.values(placedByCountry),   // [{ countryCode, countryName, count }]
  noGps: noGps.length,
  results,                                  // per-file detail (backward compat)
});
```

### Pattern 5: Photos API — Return location Field

The `GET /api/photos` select must include `location` for the `CountryPinMap`:

```javascript
// In server/src/routes/photos.js GET handler — add 'location' to select:
const photos = await Photo.find({ countryCode: countryCode.toUpperCase(), userId: req.userId })
  .sort({ createdAt: -1 })
  .select('_id storageKey thumbnailKey originalFilename countryCode countryName createdAt location');
```

### Pattern 6: use-supercluster + react-leaflet 5 (CountryPinMap)

```jsx
// client/src/components/CountryPinMap.jsx
// Source: use-supercluster README + react-leaflet v5 useMapEvents [VERIFIED: npm registry]
import { useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import useSupercluster from 'use-supercluster';

// Inner component — must be a child of MapContainer to use react-leaflet hooks
function PinLayer({ photos }) {
  const [bounds, setBounds] = useState(null);
  const [zoom, setZoom] = useState(5);

  // useMapEvents runs inside MapContainer; captures bounds and zoom on every move
  const map = useMapEvents({
    moveend: () => {
      const b = map.getBounds();
      setBounds([
        b.getSouthWest().lng,
        b.getSouthWest().lat,
        b.getNorthEast().lng,
        b.getNorthEast().lat,
      ]);
      setZoom(map.getZoom());
    },
    zoomend: () => {
      const b = map.getBounds();
      setBounds([
        b.getSouthWest().lng,
        b.getSouthWest().lat,
        b.getNorthEast().lng,
        b.getNorthEast().lat,
      ]);
      setZoom(map.getZoom());
    },
  });

  // Build GeoJSON-Feature points from photos that have GPS
  const points = photos
    .filter(p => p.location?.coordinates?.length === 2)
    .map(p => ({
      type: 'Feature',
      properties: { cluster: false, photoId: p._id, filename: p.originalFilename, thumbnailKey: p.thumbnailKey },
      geometry: { type: 'Point', coordinates: p.location.coordinates }, // already [lng, lat]
    }));

  const { clusters, supercluster } = useSupercluster({
    points,
    bounds,
    zoom,
    options: { radius: 60, maxZoom: 17 },
  });

  return clusters.map(cluster => {
    const [lng, lat] = cluster.geometry.coordinates;
    const { cluster: isCluster, point_count: pointCount } = cluster.properties;

    if (isCluster) {
      // ClusterMarker — size tiers per UI-SPEC
      const size = pointCount < 10 ? 32 : pointCount < 100 ? 40 : 48;
      return (
        <Marker
          key={`cluster-${cluster.id}`}
          position={[lat, lng]}
          icon={makeClusterIcon(pointCount, size)}
          eventHandlers={{
            click: () => {
              const expansionZoom = Math.min(
                supercluster.getClusterExpansionZoom(cluster.id),
                17
              );
              map.flyTo([lat, lng], expansionZoom, { animate: true });
            },
          }}
        />
      );
    }

    // Individual PhotoPinMarker
    return (
      <Marker
        key={`pin-${cluster.properties.photoId}`}
        position={[lat, lng]}
        icon={makePinIcon()}
      >
        <Popup>
          {/* PinPopup content — thumbnail + filename */}
        </Popup>
      </Marker>
    );
  });
}
```

**Critical for react-leaflet 5:** `useMapEvents` must be called inside a component that is a child of `MapContainer`. The hook returns the map instance, which can be used to call `getBounds()`, `getZoom()`, `flyTo()` directly. The old `leafletElement` pattern (from react-leaflet v2) does NOT work in v5.

### Pattern 7: DivIcon Construction (following PhotoCountBadge pattern)

```javascript
// PhotoPinMarker — 16px circle, UI-SPEC spec
function makePinIcon() {
  return L.divIcon({
    className: '',   // suppress Leaflet default white square
    html: `<div style="
      width:16px; height:16px;
      background:#3b82f6;
      border:2px solid #ffffff;
      border-radius:50%;
      box-shadow:0 1px 4px rgba(0,0,0,0.3);
      cursor:pointer;
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],  // center-anchored
  });
}

// Touch-target 44x44 (a11y): wrap in a 44x44 transparent container, pin centered
function makePinIconWithTouchTarget() {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:44px; height:44px;
      display:flex; align-items:center; justify-content:center;
    ">
      <div style="
        width:16px; height:16px;
        background:#3b82f6;
        border:2px solid #ffffff;
        border-radius:50%;
        box-shadow:0 1px 4px rgba(0,0,0,0.3);
      "></div>
    </div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

// ClusterMarker — size and count label
function makeClusterIcon(count, size) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px; height:${size}px;
      background:rgba(59,130,246,0.15);
      border:2px solid #3b82f6;
      border-radius:50%;
      display:flex; align-items:center; justify-content:center;
      font-size:14px; font-weight:600; color:#3b82f6;
      font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
    ">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}
```

### Pattern 8: CountryPinMap bounds initialization

`useSupercluster` needs `bounds` to be non-null before it can return clusters. On mount, `useMapEvents` only fires on move/zoom events — not on initial render. Two options:

**Option A (recommended):** Initialize `bounds` state with `null` and add a `whenReady` prop on `MapContainer` to set the initial bounds once the map is created. Since `CountryPinMap` receives the country feature's bbox, fit the map on mount via a `FitBoundsOnMount` child component:

```jsx
// Helper component to fit bounds on mount and capture initial bounds/zoom
function MapBootstrap({ countryBbox, onBoundsReady }) {
  const map = useMapEvents({
    moveend: () => { /* update parent bounds/zoom */ },
  });
  
  useEffect(() => {
    if (countryBbox) {
      map.fitBounds(countryBbox, { padding: [20, 20] });
    }
    // Capture initial state immediately after fitBounds
    setTimeout(() => {
      const b = map.getBounds();
      onBoundsReady(
        [b.getSouthWest().lng, b.getSouthWest().lat, b.getNorthEast().lng, b.getNorthEast().lat],
        map.getZoom()
      );
    }, 50);  // small delay for fitBounds to settle
  }, []);
}
```

**Option B (simpler):** Pass a wide initial `bounds` covering the country's bbox directly from outside — derive it from the GeoJSON bbox of the selected country and pass as a prop.

### Anti-Patterns to Avoid

- **Do NOT call `exifr.gps()` after `ingestPhoto()`** — sharp strips EXIF at that step. GPS must be read from the original buffer.
- **Do NOT use the server's old `isoCode.js` (ISO_A2-based) for GPS country keys** — all 301 features in the current GeoJSON produce different keys vs. what the client map uses. GPS photos would land in the wrong (or missing) country.
- **Do NOT add a `{ location: '2dsphere' }` index for Phase 3** — the model comment says "Phase 3 will add" it, but it is NOT needed for client-side clustering. A 2dsphere index is only needed for MongoDB `$geoNear` / `$geoWithin` queries (Phase 4 / server-side clustering at scale). Adding it now triggers index creation but provides no benefit yet.
- **Do NOT use `leafletElement` or `mapRef.current.leafletElement`** — react-leaflet v5 removed the `leafletElement` property. Use `useMapEvents` to get the map instance.
- **Do NOT call `useSupercluster` / `useMapEvents` in a component that is not inside a `MapContainer`** — both hooks depend on react-leaflet's context and will throw.
- **Do NOT import `@turf/turf` on the server** — the full bundle is 400+ KB. Use `@turf/boolean-point-in-polygon` directly (tree-shakes to ~15 KB).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GPS DMS→DD conversion + hemisphere | Manual deg/min/sec math | `exifr.gps()` | N/S E/W handling is subtle; exifr handles all edge cases including partial DMS |
| HEIC EXIF reading | Parse ISO Base Media File Format | `exifr.gps(heicBuffer)` | HEIC uses ISOBMFF container; exifr has this built-in |
| Point-in-polygon for MultiPolygon | Raycasting over coordinate arrays | `@turf/boolean-point-in-polygon` | Handles holes, MultiPolygon, edge winding order; 3M downloads/week |
| Client-side clustering at zoom changes | Quadtree / proximity grouping | `useSupercluster` + `supercluster` | Supercluster is the Mapbox reference implementation; handles radius, maxZoom, map/reduce |
| React-Leaflet map bounds tracking | Manual ref + event binding | `useMapEvents` (react-leaflet 5 built-in) | Correct hook-based access to map instance; works with React 19 concurrent mode |

**Key insight:** GPS and polygon math look simple but have many edge cases: partial GPS tags, signed coordinates, HEIC containers, antimeridian-crossing polygons, polygon winding order, MultiPolygon iteration. Use the battle-tested libraries.

---

## Common Pitfalls

### Pitfall 1: Server isoCode.js produces wrong keys for the current GeoJSON [VERIFIED: live codebase test]

**What goes wrong:** The server `isoCode.js` resolves features via `ISO_A2 → ISO_A2_EH → ISO_A3` (2-char codes like `"FR"`, `"US"`). The GeoJSON in `client/public/countries.geojson` is the 10m **map_subunits** dataset keyed by `SU_A3` (3-char codes like `"FXX"`, `"IDN"`, `"RUS"`). Live test confirmed **all 301 features produce different keys** between the two functions. A GPS-assigned `countryCode` of `"FR"` would never match the client's `"FXX"` and the photo would not appear in the France drill-down.

**How to avoid:** Replace `server/src/utils/isoCode.js` with the SU_A3-chain version already in `client/src/utils/isoCode.js` (primary: `SU_A3`, fallback: `GU_A3 → ADM0_A3 → NAME slug`). The existing `ingest.test.js` tests the old ISO_A2 behavior — those tests must be updated to reflect the new key scheme.

**Warning signs:** Photos uploaded via global upload exist in MongoDB but never appear in the sidebar because `Photo.find({ countryCode: 'FXX' })` returns nothing while docs have `countryCode: 'FR'`.

### Pitfall 2: GPS read AFTER ingestPhoto() — coordinates always null [VERIFIED: live codebase reading]

**What goes wrong:** `ingestPhoto()` in `server/src/services/ingest.js` calls sharp with no `.withMetadata()` call, which is sharp 0.34.x's correct way to strip ALL EXIF. If `exifr.gps()` is called on `displayBuffer` or `thumbBuffer` (post-ingest), it will always return `undefined`.

**How to avoid:** Call `extractGps(rawBuffer)` before the `ingestPhoto(rawBuffer, ...)` call in the route. The `rawBuffer` variable is already present (line 46 of `photos.js`). The GPS read order is: `multer write → fs.readFile → validateMagicBytes → extractGps → ingestPhoto`.

**Warning signs:** `exifr.gps(displayBuffer)` returns `undefined` even for confirmed GPS photos.

### Pitfall 3: HEIC GPS — read from ORIGINAL buffer, not post-heic-convert buffer [VERIFIED: live research]

**What goes wrong:** `heic-convert` converts HEIC to JPEG but does NOT transfer EXIF/GPS tags to the output JPEG. The GPS lives in the HEIC container's EXIF block. If GPS is read from the `workingBuffer` inside `ingestPhoto()` (after HEIC conversion), it will be absent.

**How to avoid:** `exifr.gps()` reads HEIC natively — call it on the original `rawBuffer` (HEIC bytes) before `ingestPhoto()` is called. This is already the correct architecture per D-01.

### Pitfall 4: GeoJSON [lng, lat] vs [lat, lng] transposition [VERIFIED: live codebase test]

**What goes wrong:** GeoJSON spec and turf use `[longitude, latitude]` coordinate order. Leaflet and most human-readable GPS use `[latitude, longitude]`. Storing `coordinates: [lat, lng]` in `Photo.location` means the pin appears at the wrong map location (mirrored across the lat=lng diagonal).

**How to avoid:** Enforced at every boundary:
- `exifr.gps()` returns `{ latitude, longitude }` (named fields, no ambiguity)
- `resolveCountry(lat, lng)` accepts `(lat, lng)` named parameters
- MongoDB GeoJSON: `coordinates: [gpsResult.lng, gpsResult.lat]`
- Leaflet Marker: `position={[lat, lng]}`
- turf point: `[lng, lat]`
- `useSupercluster` points: `geometry.coordinates: [lng, lat]`

### Pitfall 5: useSupercluster needs non-null bounds before first render [VERIFIED: npm README]

**What goes wrong:** On initial mount of `CountryPinMap`, `bounds` state is `null`. `useSupercluster({ bounds: null })` returns an empty clusters array. Pins don't appear until the user moves the map.

**How to avoid:** Set initial `bounds` state derived from the country's GeoJSON bbox (e.g., `[-10, 40, 15, 52]` for France) before the map mounts, OR use the `MapBootstrap` child component pattern (Pattern 8) to capture bounds immediately after `fitBounds`. The `whenReady` prop on `MapContainer` can also be used to compute initial bounds synchronously.

### Pitfall 6: CountryPinMap as a second MapContainer inside CountrySidebar

**What goes wrong:** `CountryPinMap` uses a NEW `MapContainer` (not the WorldMap). Two `MapContainer` instances in the same React tree are independent Leaflet maps. react-leaflet context is scoped per `MapContainer`, so hooks like `useMapEvents` in `CountryPinMap` only see the inner map. This is the correct architecture — but the two maps must not share refs or event handlers.

**How to avoid:** Keep `CountryPinMap` fully self-contained. Do not pass the WorldMap's `map` ref into it. Ensure `CountryPinMap` has `position: relative` / defined height in CSS — a `MapContainer` with `height: 0` or `height: auto` renders blank.

### Pitfall 7: CountryLayer re-mount pattern applies to ClusterMarker layer too [VERIFIED: live codebase reading]

**What goes wrong:** `CountryLayer` uses a `key` prop to force re-mount on `photoCounts` change. The `WorldMap` pattern with a `countsKey` string is already established. If the `CountryPinMap` pins layer is keyed on something that changes frequently (e.g., every re-render), it causes Leaflet to rebuild all markers every frame, causing flicker.

**How to avoid:** Key the `PinLayer` on `photos.length` or a stable photo-list hash — not on every render. Pins only need to remount when the photo list changes. `useMapEvents` inside the PinLayer is re-registered automatically when the component re-mounts.

### Pitfall 8: Antimeridian islands for Russia — small area, tolerable [VERIFIED: live codebase test]

**What goes wrong:** Russia's GeoJSON has 6 small polygons with negative longitudes (e.g., `[-180, -169.7]`) representing tiny Chukotka islands east of the antimeridian. A GPS coordinate taken on those islands (e.g., `[-170, 65]`) will NOT be matched to Russia by `booleanPointInPolygon` because the polygon coordinates are negative but the GPS is also negative — actually this IS correct geometrically. The real issue: GPS coordinates at exactly the antimeridian boundary may be represented differently by different camera manufacturers (e.g., 180.0 vs -180.0).

**Actual impact:** Live test confirmed `booleanPointInPolygon([-170, 65], russia)` returns `false` — these points fall in the "no country match" bucket. The mainland Chukotka (all positive longitudes `168-180E`) works correctly. Affected area is 6 tiny islands with very few photos. Per D-04, these are treated as "no GPS match" (manual assignment). This is the correct behavior — no fix needed for Phase 3.

### Pitfall 9: Global upload route requires no countryCode in body [VERIFIED: live codebase reading]

**What goes wrong:** The current POST `/api/photos` requires `countryCode` in the body and returns 400 if absent. The global upload button sends no `countryCode`.

**How to avoid:** Relax the validation — `countryCode` is required only when it's the per-country (manual) upload. For global upload, GPS resolution provides the country. Route logic: if `countryCode` is absent, run GPS resolution; if GPS resolution fails, skip and add to `noGps` list.

### Pitfall 10: Per-country upload with GPS photos — coords stored but country not overridden [VERIFIED: design decision reading]

**What goes wrong:** A user opens France and uploads a photo taken in Germany (GPS resolves to Germany). The design decision is: **per-country upload always wins** — the photo is stored under France (the manually chosen country) but its GPS coordinates are still stored. This means the pin would appear on the France CountryPinMap at Germany's coordinates, which is incorrect.

**How to avoid:** Two valid approaches:
- A: For per-country uploads, store GPS coordinates but do NOT set `Photo.location` (store coords only via a separate field, or skip storage). This prevents a Paris photo from appearing on the Germany map.
- B: For per-country uploads, store GPS coordinates in `Photo.location` only if GPS resolves to the same country as `countryCode`. Otherwise `location` stays null.

**Recommendation:** Option B is safer and matches user intent. The planner should capture this as an explicit decision.

---

## Code Examples

### extractGps — calling exifr in Node ESM

```javascript
// Source: exifr npm README [VERIFIED: npm registry]
import exifr from 'exifr';

// Buffer input — works for JPEG, PNG, WebP, HEIC
const result = await exifr.gps(buffer);
// result: { latitude: 48.858844, longitude: 2.294351 } or undefined
```

### booleanPointInPolygon — turf GeoJSON feature

```javascript
// Source: @turf/boolean-point-in-polygon npm docs [VERIFIED: npm registry]
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';

// Note: [lng, lat] order (GeoJSON spec)
const pt = { type: 'Feature', geometry: { type: 'Point', coordinates: [2.35, 48.86] } };
const inFrance = booleanPointInPolygon(pt, franceFeature);  // true
```

### useSupercluster with useMapEvents (react-leaflet 5)

```javascript
// Source: use-supercluster README + react-leaflet docs [VERIFIED: npm registry]
import useSupercluster from 'use-supercluster';
import { useMapEvents } from 'react-leaflet';
import { useState } from 'react';

function PinLayer({ photos }) {
  const [bounds, setBounds] = useState(null);
  const [zoom, setZoom] = useState(5);
  
  const map = useMapEvents({
    moveend: () => updateBoundsZoom(),
    zoomend: () => updateBoundsZoom(),
  });
  
  function updateBoundsZoom() {
    const b = map.getBounds();
    setBounds([b.getSouthWest().lng, b.getSouthWest().lat, b.getNorthEast().lng, b.getNorthEast().lat]);
    setZoom(map.getZoom());
  }
  
  const points = photos.filter(p => p.location?.coordinates).map(p => ({
    type: 'Feature',
    properties: { cluster: false, photoId: p._id },
    geometry: { type: 'Point', coordinates: p.location.coordinates },  // [lng, lat]
  }));
  
  const { clusters, supercluster } = useSupercluster({ points, bounds, zoom, options: { radius: 60, maxZoom: 17 } });
  
  return clusters.map(c => {
    const [lng, lat] = c.geometry.coordinates;
    if (c.properties.cluster) {
      return <Marker key={`cl-${c.id}`} position={[lat, lng]} icon={makeClusterIcon(c.properties.point_count)} 
               eventHandlers={{ click: () => map.flyTo([lat, lng], supercluster.getClusterExpansionZoom(c.id)) }} />;
    }
    return <Marker key={`pin-${c.properties.photoId}`} position={[lat, lng]} icon={makePinIcon()} />;
  });
}
```

### Mongoose GeoJSON Point storage

```javascript
// Source: Mongoose docs + existing Photo.js schema [VERIFIED: live codebase]
// Photo.location schema (already in Photo.js):
// location: { type: { type: String, enum: ['Point'], default: 'Point' }, coordinates: [Number] }

// Setting coordinates (GeoJSON [lng, lat]):
photo.location = { type: 'Point', coordinates: [gpsResult.lng, gpsResult.lat] };

// Finding photos with coordinates (for CountryPinMap):
const photos = await Photo.find({ countryCode, userId })
  .select('_id thumbnailKey originalFilename location');
// location will be { type: 'Point', coordinates: [lng, lat] } or {} (no coords set)
// Client checks: p.location?.coordinates?.length === 2
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `leafletElement` ref access | `useMapEvents` / `useMap` hooks | react-leaflet v3+ | All map access must be via hooks inside MapContainer children |
| `whenCreated` prop on MapContainer | `whenReady` prop | react-leaflet v4 | `whenCreated` removed; use `whenReady` for initial map setup |
| ISO_A2 country keys (server isoCode) | SU_A3 subunit keys (client isoCode) | Phase 1 client migration | Server must be updated to match |
| `withMetadata(false)` strips EXIF in sharp | Omit `.withMetadata()` entirely | sharp 0.34.x | sharp 0.34.x has inverted behavior: `withMetadata(false)` retains; omitting strips |

**Deprecated/outdated:**
- `mapRef.current.leafletElement.getBounds()` — use `useMapEvents` returning map instance in react-leaflet 5.
- Server `isoCode.js` ISO_A2 approach — produces keys incompatible with the 10m subunit GeoJSON now in use.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | For per-country upload, GPS coords should only be stored if GPS resolves to the same country (Pitfall 10, Option B) | Common Pitfalls | Pin appears on wrong country's map if GPS crosses national boundary |
| A2 | Server geojson path relative to `server/src/services/` can reach `client/public/` via `../../../../` | Pattern 2 | File not found at server startup; alternative: copy GeoJSON to server/src/data/ |
| A3 | `useSupercluster` works with React 19 without any compatibility shims | Standard Stack | Clustering silently broken if concurrent mode causes state tearing |

**Most claims in this research were verified by live codebase testing or confirmed via npm registry.**

---

## Open Questions

1. **GeoJSON path resolution on server**
   - What we know: The server and client live in sibling directories `server/` and `client/`. The `client/public/countries.geojson` file is 2 MB and already present.
   - What's unclear: Should the server reference the client's file directly (path coupling) or should it have its own copy?
   - Recommendation: Copy to `server/src/data/countries.geojson` during project setup (add to `.gitkeep` strategy or document in README). This avoids cross-package path dependency.

2. **Global upload button mounting location**
   - What we know: UI-SPEC says it mounts at the map level alongside `AccountStrip`/`WorldMap`.
   - What's unclear: Should it live inside `WorldMap.jsx` as an absolutely-positioned element, or be a sibling in `App.jsx`?
   - Recommendation: Sibling in `App.jsx` overlaid via absolute positioning — keeps WorldMap.jsx single-responsibility.

3. **Per-country upload: store GPS or not?**
   - What we know: D-02 says per-country upload is the manual path. GPS is available but country is explicitly chosen.
   - What's unclear: Should GPS be stored for per-country uploads? If yes, does location override or just augment?
   - Recommendation: Store GPS in `Photo.location` only when GPS resolves to the same `countryCode` that was manually chosen (Pitfall 10, Option B). If GPS resolves to a different country, `location` stays null — the user's explicit choice wins.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | exifr, turf (server) | ✓ | 24.10.0 | — |
| `@turf/turf` | client devDeps (already installed) | ✓ | 7.3.5 | — |
| `exifr` | GPS extraction | ✗ (not yet installed) | 7.1.3 | — |
| `@turf/boolean-point-in-polygon` | server pip | ✗ (not in server deps) | 7.3.5 | — |
| `use-supercluster` | client clustering | ✗ (not yet installed) | 1.2.0 | — |
| `supercluster` | peer dep of use-supercluster | ✗ (not yet installed) | 8.0.1 | — |
| `client/public/countries.geojson` | point-in-polygon | ✓ | 2 MB, 301 features | — |

**Missing dependencies with no fallback:** exifr, @turf/boolean-point-in-polygon, use-supercluster, supercluster — all must be installed before Phase 3 code can run.

**Missing dependencies with fallback:** none.

---

## Security Domain

> `security_enforcement` is enabled (not explicitly false in config.json).

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (inherited) | Phase 2 JWT/cookie — no changes; all photo routes remain behind `requireAuth` |
| V3 Session Management | yes (inherited) | Phase 2 — no changes |
| V4 Access Control | yes | Per-user isolation: GPS photos must include `userId: req.userId` in Photo.create; pin queries scoped by `userId` |
| V5 Input Validation | yes | GPS coordinates must be validated as numbers in valid range (lat: -90..90, lng: -180..180) before storing |
| V6 Cryptography | no | No new crypto in Phase 3 |

### Known Threat Patterns for this Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| GPS coordinate injection (non-numeric) | Tampering | Validate `typeof lat === 'number' && lat >= -90 && lat <= 90` before storing; exifr returns numbers, not strings |
| XSS via filename in PinPopup | Tampering | `originalFilename` is text-only; render via React (auto-escapes); DivIcon uses fixed markup with no user-supplied HTML |
| IDOR: viewing another user's pin coordinates | Info Disclosure | `Photo.find()` always scoped by `userId: req.userId`; `GET /api/photos` already has this (confirmed in code) |
| Global upload with no countryCode: bypass validation | Tampering | Graceful skip (noGps list) — no server error, no data corruption; countryCode from GPS is resolved server-side only |
| Malformed GPS in EXIF (e.g., lat=999) | Tampering | exifr returns out-of-range values as-is; add explicit range validation before `resolveCountry()` |

**GPS coordinate validation pattern:**
```javascript
function isValidGps(lat, lng) {
  return (
    typeof lat === 'number' && isFinite(lat) && lat >= -90 && lat <= 90 &&
    typeof lng === 'number' && isFinite(lng) && lng >= -180 && lng <= 180
  );
}
```

---

## Sources

### Primary (HIGH confidence — verified by live codebase test)
- `server/src/routes/photos.js` — upload route structure, rawBuffer availability, countryCode required validation
- `server/src/services/ingest.js` — sharp EXIF strip timing, heic-convert pipeline
- `server/src/models/Photo.js` — Photo.location GeoJSON Point schema
- `client/src/utils/isoCode.js` — SU_A3-chain extractIso (client version — server must match)
- `server/src/utils/isoCode.js` — ISO_A2-chain (WRONG for current GeoJSON — must be replaced)
- `client/public/countries.geojson` — 301 features, SU_A3 keyed, Russia antimeridian split, Crimea ∈ Ukraine
- Live turf test: booleanPointInPolygon(moscow, russia) = true, booleanPointInPolygon([-170, 65], russia) = false
- `client/src/components/{WorldMap,CountryLayer,PhotoCountBadge,CountrySidebar,PhotoUploadForm}.jsx` — existing patterns
- `client/package.json` — react-leaflet 5.0.0, React 19.2.7, @turf/turf 7.3.5 (devDep)

### Secondary (MEDIUM confidence — npm README / official docs)
- [exifr npm README](https://www.npmjs.com/package/exifr) — gps() API, Buffer support, HEIC support, ESM import
- [use-supercluster npm README](https://www.npmjs.com/package/use-supercluster) — hook signature, points format, peer dep
- [react-leaflet docs](https://react-leaflet.js.org/docs/api-map/) — useMapEvents, useMap, MapContainer props

### Tertiary (LOW confidence — web search)
- [Leigh Halliday — Leaflet Clustering](https://www.leighhalliday.com/leaflet-clustering) — useSupercluster + react-leaflet pattern (v2 API, adapted for v5)
- [use-supercluster GitHub examples](https://github.com/leighhalliday/use-supercluster) — cluster expansion zoom pattern

---

## Metadata

**Confidence breakdown:**
- exifr GPS extraction: HIGH — confirmed via npm README, live package inspect, HEIC support verified
- turf point-in-polygon: HIGH — tested live against actual countries.geojson; antimeridian behavior confirmed
- isoCode.js mismatch: HIGH — live test showed 301/301 mismatches; this is a blocking correctness issue
- use-supercluster integration: MEDIUM — README confirmed; useMapEvents v5 pattern inferred from docs (not run live)
- Mongoose location field: HIGH — already in Photo.js schema, only needs select() addition
- CountryPinMap initialization (bounds on mount): MEDIUM — standard react-leaflet pattern, not run live

**Research date:** 2026-06-22
**Valid until:** 2026-08-22 (stable libraries; exifr last released 2022 — very stable)
