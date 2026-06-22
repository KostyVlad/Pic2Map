# Phase 3: EXIF Auto-Placement & Pins — Pattern Map

**Mapped:** 2026-06-22
**Files analyzed:** 12 new/modified files
**Analogs found:** 12 / 12

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `server/src/services/gps.js` | service | transform | `server/src/services/ingest.js` | role-match |
| `server/src/services/countryLookup.js` | service | transform | `server/src/services/ingest.js` | role-match |
| `server/src/utils/isoCode.js` | utility | transform | `client/src/utils/isoCode.js` | exact (replace) |
| `server/src/routes/photos.js` | route | request-response | `server/src/routes/photos.js` | exact (modify) |
| `server/src/models/Photo.js` | model | CRUD | `server/src/models/Photo.js` | exact (modify) |
| `client/src/api/photos.js` | hook | request-response | `client/src/api/photos.js` | exact (extend) |
| `client/src/components/CountryPinMap.jsx` | component | event-driven | `client/src/components/CountryLayer.jsx` | role-match |
| `client/src/components/PhotoPinMarker.jsx` | component | request-response | `client/src/components/PhotoCountBadge.jsx` | exact |
| `client/src/components/ClusterMarker.jsx` | component | request-response | `client/src/components/PhotoCountBadge.jsx` | exact |
| `client/src/components/PinPopup.jsx` | component | request-response | `client/src/components/CountrySidebar.jsx` | partial |
| `client/src/components/GlobalUploadButton.jsx` | component | request-response | `client/src/components/AccountStrip.jsx` | role-match |
| `client/src/components/GpsResultSummary.jsx` | component | request-response | `client/src/components/PhotoUploadForm.jsx` | exact (extract) |

---

## Pattern Assignments

### `server/src/services/gps.js` (service, transform)

**Analog:** `server/src/services/ingest.js`

**Imports pattern** (`ingest.js` lines 22-26):
```javascript
import heicConvert from 'heic-convert';
import { promisify } from 'node:util';
import sharp from 'sharp';
```
Mirror this ESM named-export, single-responsibility service pattern:
```javascript
// server/src/services/gps.js
import exifr from 'exifr';
```

**Core pattern** — buffer-in, result-out, never throws (mirrors ingest.js error convention):
```javascript
// ingest.js lines 28-63: pure async function, Buffer in, result object out
export async function ingestPhoto(inputBuffer, mimeType, countryCode) { ... }

// New service follows the same shape:
export async function extractGps(buffer) {
  try {
    const result = await exifr.gps(buffer);
    if (!result || result.latitude == null || result.longitude == null) return null;
    return { lat: result.latitude, lng: result.longitude };
  } catch {
    return null;  // malformed EXIF — same silent-failure pattern as ingest catch blocks
  }
}
```

**GPS validation guard** (RESEARCH security pattern — apply after extractGps returns):
```javascript
function isValidGps(lat, lng) {
  return (
    typeof lat === 'number' && isFinite(lat) && lat >= -90 && lat <= 90 &&
    typeof lng === 'number' && isFinite(lng) && lng >= -180 && lng <= 180
  );
}
```

**Critical ordering:** Call `extractGps(rawBuffer)` AFTER `validateMagicBytes(rawBuffer)` and BEFORE `ingestPhoto(rawBuffer, ...)` — see route integration section. `ingest.js` line 35 (heic-convert) strips GPS from the working buffer.

---

### `server/src/services/countryLookup.js` (service, transform)

**Analog:** `server/src/services/ingest.js`

**Imports pattern** (new file, no existing analog — use node:fs + turf):
```javascript
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { extractIso } from '../utils/isoCode.js';  // MUST be SU_A3 version after replacement
```

**Core pattern** — module-level cache (lazy singleton), pure function:
```javascript
const __dirname = dirname(fileURLToPath(import.meta.url));
const GEOJSON_PATH = resolve(__dirname, '../../../../client/public/countries.geojson');

let _features = null;
function getFeatures() {
  if (!_features) {
    _features = JSON.parse(readFileSync(GEOJSON_PATH, 'utf8')).features;
  }
  return _features;
}

export function resolveCountry(lat, lng) {
  // turf GeoJSON point uses [lng, lat] — NOT [lat, lng] (GeoJSON spec)
  const pt = { type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] } };
  for (const feature of getFeatures()) {
    if (booleanPointInPolygon(pt, feature)) {
      return { code: extractIso(feature), name: feature.properties.NAME || '' };
    }
  }
  return null;
}
```

**Key constraint:** `extractIso` import must come from the replaced `server/src/utils/isoCode.js` (SU_A3 chain). The old version (ISO_A2) produces keys that will never match any of the 301 GeoJSON features.

---

### `server/src/utils/isoCode.js` (utility, transform) — REPLACE ENTIRELY

**Analog:** `client/src/utils/isoCode.js` (exact copy target)

**Current wrong version** (`server/src/utils/isoCode.js` lines 12-26) — ISO_A2 chain, produces keys like `"FR"`:
```javascript
export function extractIso(feature) {
  const p = feature.properties;
  if (p.ISO_A2 && p.ISO_A2 !== '-99') return p.ISO_A2.toUpperCase();
  if (p.ISO_A2_EH && p.ISO_A2_EH !== '-99') return p.ISO_A2_EH.toUpperCase();
  if (p.ISO_A3 && p.ISO_A3 !== '-99') return p.ISO_A3.slice(0, 2).toUpperCase();
  return (p.NAME || 'XX').replace(/\s+/g, '_').toUpperCase();
}
```

**Correct replacement** (`client/src/utils/isoCode.js` lines 19-33) — SU_A3 chain, produces keys like `"FXX"`:
```javascript
export function extractIso(feature) {
  const p = feature.properties;
  if (p.SU_A3 && p.SU_A3 !== '-99') return p.SU_A3.toUpperCase();
  if (p.GU_A3 && p.GU_A3 !== '-99') return p.GU_A3.toUpperCase();
  if (p.ADM0_A3 && p.ADM0_A3 !== '-99') return p.ADM0_A3.toUpperCase();
  return (p.NAME || 'XX').replace(/\s+/g, '_').toUpperCase();
}
```

**Copy exactly.** The client JSDoc comment says "This function is mirrored in server/src/utils/isoCode.js — keep in sync." The entire file is a drop-in replacement — no other exports exist.

---

### `server/src/routes/photos.js` (route, request-response) — MODIFY

**Analog:** `server/src/routes/photos.js` (same file, extend existing POST handler)

**Current POST handler structure** (lines 24-111) — copy this shell, modify internals:
```javascript
router.post('/', upload.array('photos', config.MAX_FILES_PER_BATCH), async (req, res, next) => {
  try {
    const { countryCode, countryName } = req.body;
    // Phase 3: relax — countryCode is no longer always required (global upload has none)
    // OLD: if (!countryCode) { return res.status(400).json({ error: 'countryCode required' }); }

    const results = [];
    const normalizedCode = countryCode?.toUpperCase().trim() || null;  // null for global upload

    for (const file of req.files) {
      let rawBuffer;
      try { rawBuffer = await fs.readFile(file.path); }
      catch (readErr) { results.push({ file: file.originalname, error: 'Failed to read uploaded file' }); continue; }

      // 1. Magic-byte check (existing — keep)
      let detectedMime;
      try { detectedMime = await validateMagicBytes(rawBuffer); }
      catch (magicErr) { await fs.unlink(file.path).catch(() => {}); results.push({ file: file.originalname, error: magicErr.message }); continue; }

      // 2. *** PHASE 3: GPS extraction BEFORE ingest ***
      // extractGps + resolveCountry inserted here (see GPS Integration pattern below)

      // 3. Ingest (existing — keep)
      let thumbBuffer, displayBuffer;
      try { ({ thumbBuffer, displayBuffer } = await ingestPhoto(rawBuffer, detectedMime, finalCountryCode)); }
      catch (ingestErr) { ... }

      // 4. Storage + Photo.create (existing — extend with location field)
    }

    // Phase 3: enriched response shape
    res.status(201).json({ uploaded, placed, noGps, results });
  } catch (err) { next(err); }
});
```

**GPS integration block** — insert between step 1 and step 3 above:
```javascript
// Phase 3: read GPS from raw buffer BEFORE ingest strips EXIF
const gpsResult = await extractGps(rawBuffer);
const validGps = gpsResult && isValidGps(gpsResult.lat, gpsResult.lng) ? gpsResult : null;
let resolvedCountry = validGps ? resolveCountry(validGps.lat, validGps.lng) : null;

let finalCountryCode = normalizedCode;
let finalCountryName = countryName || '';

if (!normalizedCode) {
  // Global upload path — GPS must resolve to a country
  if (resolvedCountry) {
    finalCountryCode = resolvedCountry.code;
    finalCountryName = resolvedCountry.name;
  } else {
    // No GPS or no polygon match — report as noGps, skip
    await fs.unlink(file.path).catch(() => {});
    results.push({ file: file.originalname, noGps: true });
    continue;
  }
} else {
  // Per-country (manual) upload — country from body wins
  // Store GPS only if it resolves to the SAME country (Pitfall 10 / Option B)
  if (resolvedCountry && resolvedCountry.code !== normalizedCode) {
    resolvedCountry = null;  // GPS disagrees with manual choice — don't store coords
  }
}
```

**Photo.create extension** (lines 91-100 — add location spread):
```javascript
// Existing Photo.create (lines 91-100):
const photo = await Photo.create({
  countryCode: normalizedCode,    // → finalCountryCode
  countryName: countryName || '', // → finalCountryName
  storageKey,
  thumbnailKey,
  mimeType: 'image/jpeg',
  originalFilename: file.originalname,
  fileSize: rawBuffer.length,
  userId: req.userId,
  // Phase 3 addition:
  ...(resolvedCountry && validGps && {
    location: { type: 'Point', coordinates: [validGps.lng, validGps.lat] },
  }),
});
```

**Response enrichment** (line 107 — replace `res.status(201).json({ uploaded, results })`):
```javascript
const placed = results.filter(r => r.photoId && r.countryCode);
const noGpsCount = results.filter(r => r.noGps).length;
const placedByCountry = placed.reduce((acc, r) => {
  if (!acc[r.countryCode]) acc[r.countryCode] = { countryCode: r.countryCode, countryName: r.countryName, count: 0 };
  acc[r.countryCode].count++;
  return acc;
}, {});
res.status(201).json({
  uploaded: placed.length,
  placed: Object.values(placedByCountry),  // [{ countryCode, countryName, count }]
  noGps: noGpsCount,
  results,
});
```

**GET handler select extension** (line 126 — add `location` to select):
```javascript
// Existing (line 124-126):
const photos = await Photo.find({ countryCode: countryCode.toUpperCase(), userId: req.userId })
  .sort({ createdAt: -1 })
  .select('_id storageKey thumbnailKey originalFilename countryCode countryName createdAt');
// Phase 3 — append 'location':
  .select('_id storageKey thumbnailKey originalFilename countryCode countryName createdAt location');
```

---

### `server/src/models/Photo.js` (model, CRUD) — NO CHANGE

The `location` field is already modelled correctly (lines 35-38):
```javascript
location: {
  type: { type: String, enum: ['Point'], default: 'Point' },
  coordinates: { type: [Number], default: undefined }, // [lng, lat] per GeoJSON spec
},
```
The comment on line 62 says "Phase 3 will add: `{ location: '2dsphere' }` index via migration" — per RESEARCH anti-patterns, do NOT add this index in Phase 3 (no `$geoNear` queries yet). No model changes needed.

---

### `client/src/api/photos.js` (hook, request-response) — EXTEND

**Analog:** `client/src/api/photos.js` (same file, add one new mutation)

**Existing mutation pattern** (lines 31-61) — copy this exact shape for `useUploadGlobal`:
```javascript
export function useUploadPhotos() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ files, countryCode, countryName }) => {
      const formData = new FormData();
      formData.append('countryCode', countryCode);
      formData.append('countryName', countryName || '');
      for (const file of files) { formData.append('photos', file); }

      const res = await fetch('/api/photos', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Upload failed. Check your connection and try again.');
      }
      return res.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['photos', variables.countryCode] });
      queryClient.invalidateQueries({ queryKey: ['photo-counts'] });
    },
  });
}
```

**New `useUploadGlobal` mutation** — same shape, different invalidation (must invalidate ALL placed countries):
```javascript
export function useUploadGlobal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ files }) => {
      const formData = new FormData();
      // No countryCode — global upload; server resolves from GPS
      for (const file of files) { formData.append('photos', file); }

      const res = await fetch('/api/photos', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Upload failed. Check your connection and try again.');
      }
      return res.json();
    },
    onSuccess: (data) => {
      // Invalidate each country that received photos
      for (const { countryCode } of data.placed ?? []) {
        queryClient.invalidateQueries({ queryKey: ['photos', countryCode] });
      }
      queryClient.invalidateQueries({ queryKey: ['photo-counts'] });
    },
  });
}
```

---

### `client/src/components/CountryPinMap.jsx` (component, event-driven)

**Analog:** `client/src/components/CountryLayer.jsx` (react-leaflet child-of-MapContainer pattern) + `client/src/components/WorldMap.jsx` (MapContainer setup)

**MapContainer setup** (mirrors `WorldMap.jsx` lines 79-90 — TILE_URL constant, same provider):
```javascript
// From WorldMap.jsx lines 25-32:
const TILE_URL =
  import.meta.env.VITE_TILE_URL ||
  'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png';

// CountryPinMap uses the same TILE_URL, no separate config needed
```

**useRef pattern for stable event callbacks** (mirrors `CountryLayer.jsx` lines 47-50):
```javascript
// CountryLayer.jsx lines 47-50:
const hoveredLayerRef = useRef(null);
const selectedLayerRef = useRef(null);
const selectedCodeRef = useRef(selectedCode);
selectedCodeRef.current = selectedCode;  // keep ref in sync with prop each render
```

**Component structure** — two-component pattern (outer MapContainer + inner child for hooks):
```jsx
// CountryLayer is a direct GeoJSON layer; CountryPinMap wraps MapContainer
// Must follow react-leaflet v5: useMapEvents ONLY works inside MapContainer children

export default function CountryPinMap({ photos, countryBbox }) {
  return (
    <div
      className="relative w-full h-[240px] md:h-[240px]"  // 240px desktop, 180px mobile (UI-SPEC)
      role="region"
      aria-label="photo map"
    >
      <MapContainer
        bounds={countryBbox}
        boundsOptions={{ padding: [20, 20] }}
        minZoom={3}
        maxZoom={18}
        zoomControl
        className="h-full w-full"
        style={{ position: 'absolute', inset: 0 }}
      >
        <TileLayer url={TILE_URL} />
        <PinLayer photos={photos} />
      </MapContainer>
    </div>
  );
}
```

**PinLayer inner component** — `useMapEvents` must be inside MapContainer (mirrors react-leaflet v5 pattern from RESEARCH Pattern 6):
```javascript
function PinLayer({ photos }) {
  const [bounds, setBounds] = useState(null);
  const [zoom, setZoom] = useState(5);

  const map = useMapEvents({
    moveend: updateBoundsZoom,
    zoomend: updateBoundsZoom,
  });

  function updateBoundsZoom() {
    const b = map.getBounds();
    setBounds([b.getSouthWest().lng, b.getSouthWest().lat, b.getNorthEast().lng, b.getNorthEast().lat]);
    setZoom(map.getZoom());
  }

  // ... useSupercluster + cluster rendering
}
```

**Key on photo count** (mirrors `WorldMap.jsx` line 62 `countsKey` pattern):
```javascript
// WorldMap.jsx line 62:
const countsKey = [...photoCounts.keys()].sort().join(',') || 'empty';
// CountryPinMap: key PinLayer on photos.length so it only remounts when list changes
// <PinLayer key={photos.length} photos={photos} />  — avoids per-render flicker
```

---

### `client/src/components/PhotoPinMarker.jsx` (component, request-response)

**Analog:** `client/src/components/PhotoCountBadge.jsx` (exact DivIcon pattern)

**DivIcon factory** (mirrors `PhotoCountBadge.jsx` lines 28-49 exactly):
```javascript
// PhotoCountBadge.jsx lines 28-49 — L.divIcon with className: '' pattern:
function makeBadgeIcon(count) {
  const label = count > 99 ? '99+' : String(count);
  return L.divIcon({
    className: '',  // suppress Leaflet's default white square CSS
    html: `<span style="
      display: inline-block;
      background: rgba(59,130,246,0.15);
      border: 1px solid #3b82f6;
      color: #3b82f6;
      font-size: 14px;
      font-weight: 600;
      ...
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    ">${label}</span>`,
    iconAnchor: [0, 0],
    iconSize: null,
  });
}
```

**PhotoPinMarker DivIcon** (follows same pattern, center-anchored circle — UI-SPEC §1):
```javascript
// client/src/components/PhotoPinMarker.jsx
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

function makePinIcon() {
  return L.divIcon({
    className: '',  // same: suppress Leaflet default white square
    html: `<div style="
      width: 44px; height: 44px;
      display: flex; align-items: center; justify-content: center;
    ">
      <div style="
        width: 16px; height: 16px;
        background: #3b82f6;
        border: 2px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        cursor: pointer;
      "></div>
    </div>`,
    iconSize: [44, 44],   // 44px touch target (UI-SPEC accessibility)
    iconAnchor: [22, 22], // center-anchor (pin is a dot, not teardrop)
  });
}

export default function PhotoPinMarker({ photo, position }) {
  return (
    <Marker
      position={position}
      icon={makePinIcon()}
      // interactive: true (default) — pins capture clicks for popup
    >
      <Popup>
        {/* PinPopup content rendered here or as separate component */}
      </Popup>
    </Marker>
  );
}
```

---

### `client/src/components/ClusterMarker.jsx` (component, request-response)

**Analog:** `client/src/components/PhotoCountBadge.jsx` (same DivIcon factory pattern)

**Cluster DivIcon** (same `className: ''` convention, size tiers per UI-SPEC §3):
```javascript
// client/src/components/ClusterMarker.jsx
import { Marker } from 'react-leaflet';
import L from 'leaflet';

function makeClusterIcon(count) {
  // UI-SPEC size tiers: 2-9 → 32px, 10-99 → 40px, 100+ → 48px
  const size = count < 10 ? 32 : count < 100 ? 40 : 48;
  return L.divIcon({
    className: '',  // same pattern as PhotoCountBadge line 33
    html: `<div style="
      width: ${size}px; height: ${size}px;
      background: rgba(59,130,246,0.15);
      border: 2px solid #3b82f6;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: 600; color: #3b82f6;
      font-family: system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
    ">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export default function ClusterMarker({ cluster, supercluster, map }) {
  const [lng, lat] = cluster.geometry.coordinates;
  const { point_count: count } = cluster.properties;
  return (
    <Marker
      position={[lat, lng]}
      icon={makeClusterIcon(count)}
      eventHandlers={{
        click: () => {
          const zoom = Math.min(supercluster.getClusterExpansionZoom(cluster.id), 17);
          map.flyTo([lat, lng], zoom, { animate: true });
        },
      }}
    />
  );
}
```

---

### `client/src/components/PinPopup.jsx` (component, request-response)

**Analog:** `client/src/components/CountrySidebar.jsx` (panel/popup structural pattern — Tailwind layout tokens)

**Tailwind token usage** (mirrors CountrySidebar.jsx lines 28-40 — same token set):
```javascript
// CountrySidebar.jsx uses:
'bg-surface border-border shadow-[0_0_24px_rgba(0,0,0,0.12)]'
'text-heading font-semibold text-text'
'text-label text-text-muted'
'focus:ring-2 focus:ring-accent'
```

**PinPopup structure** (UI-SPEC §2 — 180px wide, thumbnail top, caption bottom):
```jsx
// client/src/components/PinPopup.jsx
export default function PinPopup({ photo, onThumbnailClick }) {
  const truncated = photo.originalFilename.length > 24
    ? photo.originalFilename.slice(0, 24) + '…'
    : photo.originalFilename;

  return (
    // Leaflet injects popup into its own container — use inline styles for popup internals
    // to avoid Leaflet CSS conflicts; Tailwind classes are safe for the inner content div
    <div style={{ width: 180 }}>
      <button
        type="button"
        onClick={onThumbnailClick}
        aria-label={`Open ${photo.originalFilename} in lightbox`}
        className="block w-full cursor-pointer"
      >
        <img
          src={`/api/photos/file/${encodeURIComponent(photo.thumbnailKey)}`}
          alt={photo.originalFilename}
          style={{ width: 180, height: 120, objectFit: 'cover', display: 'block' }}
        />
      </button>
      <div className="px-2 py-2">
        <p className="text-label text-text truncate">{truncated}</p>
      </div>
    </div>
  );
}
```

---

### `client/src/components/GlobalUploadButton.jsx` (component, request-response)

**Analog:** `client/src/components/AccountStrip.jsx` (fixed overlay at map level, same z-index, same Tailwind tokens)

**Overlay positioning** (AccountStrip.jsx lines 20-22 — `fixed top-2 left-2 z-[500]`):
```javascript
// AccountStrip.jsx line 21:
className="fixed top-2 left-2 z-[500] max-w-[220px] bg-surface border border-border rounded-md shadow-sm px-3 py-2 flex items-center gap-2"
```

**GlobalUploadButton** — positioned top-right, same z-[500] convention, same Tailwind token set:
```jsx
// client/src/components/GlobalUploadButton.jsx
import { useRef, useState } from 'react';
import { useUploadGlobal } from '../api/photos.js';

export default function GlobalUploadButton() {
  const inputRef = useRef(null);
  const uploadMutation = useUploadGlobal();
  const [result, setResult] = useState(null);

  async function handleFiles(files) {
    if (!files?.length) return;
    setResult(null);
    try {
      const data = await uploadMutation.mutateAsync({ files });
      setResult(data);
      setTimeout(() => setResult(null), 4000);  // mirrors PhotoUploadForm.jsx line 66
    } catch (err) {
      setResult({ error: err.message });
    }
    if (inputRef.current) inputRef.current.value = '';
  }

  // Positioned as sibling of WorldMap in App.jsx (alongside AccountStrip)
  // fixed, z-[500] — above Leaflet (z-400), same layer as AccountStrip
  return (
    <div className="fixed top-2 right-2 z-[500]">
      <input ref={inputRef} type="file" multiple
        accept="image/jpeg,image/png,image/webp,.heic,.heif"
        className="sr-only"
        onChange={e => handleFiles(Array.from(e.target.files || []))}
        disabled={uploadMutation.isPending}
      />
      <label
        htmlFor="global-upload-input"
        className={[
          'flex items-center justify-center px-4 rounded-md shadow-sm',
          'min-h-11 text-label font-semibold text-white cursor-pointer',
          'transition-colors',
          uploadMutation.isPending ? 'bg-accent opacity-60 cursor-not-allowed' : 'bg-accent hover:bg-accent-dark',
        ].join(' ')}
        aria-disabled={uploadMutation.isPending}
      >
        {uploadMutation.isPending ? 'Uploading...' : 'Upload Photos'}
      </label>
      {result && <GpsResultSummary result={result} />}
    </div>
  );
}
```

**Mounting in App.jsx** (alongside AccountStrip — lines 51-55 of App.jsx):
```jsx
// App.jsx current (lines 51-55):
<ProtectedRoute>
  <AccountStrip />
  <WorldMap />
</ProtectedRoute>

// Phase 3 — add GlobalUploadButton as another sibling:
<ProtectedRoute>
  <AccountStrip />
  <GlobalUploadButton />
  <WorldMap />
</ProtectedRoute>
```

---

### `client/src/components/GpsResultSummary.jsx` (component, request-response)

**Analog:** `client/src/components/PhotoUploadForm.jsx` (status message pattern — lines 143-153)

**Existing status message** (PhotoUploadForm.jsx lines 143-153 — `role="alert"/"status"`, `text-destructive`/`text-text-muted`):
```jsx
// PhotoUploadForm.jsx lines 143-153:
{statusMessage && (
  <p
    className={[
      'mt-2 text-label',
      statusMessage.type === 'error' ? 'text-destructive' : 'text-text-muted',
    ].join(' ')}
    role={statusMessage.type === 'error' ? 'alert' : 'status'}
  >
    {statusMessage.text}
  </p>
)}
```

**GpsResultSummary** — extends the pattern from a single `<p>` to rows per country (UI-SPEC §5):
```jsx
// client/src/components/GpsResultSummary.jsx
export default function GpsResultSummary({ result }) {
  if (!result) return null;

  if (result.error) {
    return (
      <p className="mt-2 text-label text-destructive" role="alert">
        {result.error}
      </p>
    );
  }

  return (
    <div role="status" className="mt-2 flex flex-col gap-1">
      {(result.placed ?? []).map(({ countryCode, countryName, count }) => (
        <div key={countryCode} className="flex items-center gap-2 text-label text-text">
          {/* accent dot (UI-SPEC: 8px circle, fill accent) */}
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }} />
          {count} photo{count !== 1 ? 's' : ''} auto-placed in {countryName}
        </div>
      ))}
      {result.noGps > 0 && (
        <div className="flex items-center gap-2 text-label text-text-muted">
          {/* muted dot (UI-SPEC: 8px circle, fill text-muted) */}
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6b7280', flexShrink: 0 }} />
          {result.noGps} photo{result.noGps !== 1 ? 's' : ''} have no location — open a country to add them there
        </div>
      )}
    </div>
  );
}
```

**Auto-clear pattern** (copy from PhotoUploadForm.jsx line 66):
```javascript
// PhotoUploadForm.jsx line 66:
if (succeeded) { setTimeout(() => setStatusMessage(null), 4000); }
// Apply same 4-second auto-clear to GPS result rows in the parent (GlobalUploadButton)
```

---

## Shared Patterns

### Authentication
**Source:** `server/src/routes/photos.js` — all routes already behind `requireAuth` middleware (applied at router registration level, not per-route). No changes needed; new GPS routes inherit it.
```javascript
// requireAuth applied upstream — every req in photos.js has req.userId populated
// Photo.create always passes userId: req.userId  (line 99)
// Photo.find always scopes by userId: req.userId  (line 124)
```

### Error Handling — Route Level
**Source:** `server/src/routes/photos.js` lines 44-69 — try/catch per file, push to results, continue:
```javascript
try { rawBuffer = await fs.readFile(file.path); }
catch (readErr) {
  results.push({ file: file.originalname, error: 'Failed to read uploaded file' });
  continue;
}
// Always unlink tmp file on per-file error:
await fs.unlink(file.path).catch(() => {});
// Route-level catch:
} catch (err) { next(err); }
```
Apply same pattern in GPS/ingest error blocks.

### Error Handling — Client Mutation
**Source:** `client/src/api/photos.js` lines 48-53:
```javascript
if (!res.ok) {
  const err = await res.json().catch(() => ({}));
  throw new Error(err.error || 'Upload failed. Check your connection and try again.');
}
```
Copy verbatim into `useUploadGlobal` mutationFn.

### Tailwind Token Set
**Source:** `client/src/components/CountrySidebar.jsx`, `PhotoUploadForm.jsx`, `AccountStrip.jsx`
Tokens in use across all Phase 3 components:
- `bg-surface`, `border-border`, `text-text`, `text-text-muted`, `text-label`, `text-heading`
- `text-accent`, `bg-accent`, `hover:bg-accent-dark`, `focus:ring-2 focus:ring-accent`
- `text-destructive` for errors
- `min-h-11` for 44px touch targets (a11y)
- `z-[500]` for overlay elements (above Leaflet z-400)

### React Query Invalidation
**Source:** `client/src/api/photos.js` lines 55-58:
```javascript
onSuccess: (data, variables) => {
  queryClient.invalidateQueries({ queryKey: ['photos', variables.countryCode] });
  queryClient.invalidateQueries({ queryKey: ['photo-counts'] });
},
```
`useUploadGlobal` must invalidate `['photos', countryCode]` for each placed country (not a single countryCode variable — iterate `data.placed`).

### Leaflet DivIcon Construction
**Source:** `client/src/components/PhotoCountBadge.jsx` lines 28-49
```javascript
L.divIcon({
  className: '',   // always '' — suppresses Leaflet default white box
  html: `...`,     // all styling inline — Leaflet injects into its own DOM
  iconSize: [...],
  iconAnchor: [...],
})
```
PhotoPinMarker and ClusterMarker copy this exact factory function shape.

### react-leaflet v5 Map Instance Access
**Source:** `CountryLayer.jsx` uses `useRef` for stable access; no `leafletElement`.
For CountryPinMap's PinLayer inner component — get map instance via `useMapEvents` return value:
```javascript
// react-leaflet v5 (RESEARCH anti-patterns):
// WRONG: mapRef.current.leafletElement.getBounds()  — removed in v5
// RIGHT:
const map = useMapEvents({ moveend: ..., zoomend: ... });
map.getBounds();  // direct — map IS the Leaflet map instance
```

---

## No Analog Found

All files have a close analog. No files require pure-from-scratch patterns outside the codebase.

---

## Metadata

**Analog search scope:** `server/src/routes/`, `server/src/services/`, `server/src/models/`, `server/src/utils/`, `client/src/api/`, `client/src/components/`, `client/src/App.jsx`
**Files read:** 13 source files
**Pattern extraction date:** 2026-06-22
