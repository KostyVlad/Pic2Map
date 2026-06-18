# Phase 1: Country Map & Per-Country Photos - Research

**Researched:** 2026-06-18
**Domain:** Interactive country-polygon map + per-country photo upload/gallery (MERN, no auth)
**Confidence:** HIGH (core stack, map rendering, upload pipeline), MEDIUM (HEIC conversion strategy, GeoJSON ISO code handling)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Country-first, manual association. The user explicitly clicks/selects a country and uploads photos to it. There is NO EXIF/GPS auto-placement in this phase — that is Phase 3.
- **D-02:** Country highlighting is **on hover / when selected** — all country borders are drawn; the country under the cursor or currently selected is highlighted.
- **D-03:** Countries that contain photos are **visually marked** (filled color and/or a small photo-count badge).
- **D-04:** No authentication in this phase. The app runs as a single implicit/local user. Accounts added in Phase 2 via migration.
- **D-05:** Upload accepts JPEG / PNG / WebP / HEIC; HEIC/HEIF converted to JPEG server-side. Validate by magic bytes; ~25 MB/file limit, ~50 files/batch (configurable). Per-file progress UI deferred to Phase 4.
- **D-06:** Generate thumbnail per photo; **strip EXIF (incl. GPS) from served image files** even though GPS isn't read yet. Store binaries via `StorageAdapter` (local disk v1, env-swappable to S3/R2). Never store binaries in MongoDB.
- **D-07:** Each photo records which country it belongs to via stable ISO 3166-1 code (not display name).
- **D-08:** Opening a country shows its photos as a **thumbnail-grid gallery** with a lightbox for full-size viewing.

### Claude's Discretion

- Exact country-boundary data source and rendering approach (e.g. Natural Earth GeoJSON via a Leaflet GeoJSON layer)
- Exact free-tier tile provider for the base map (Stadia/MapTiler) — env-configurable
- Precise file-size / batch limits and thumbnail dimensions

### Deferred Ideas (OUT OF SCOPE)

- Accounts / login / private per-user maps — Phase 2
- Reading EXIF GPS, auto-assigning country, exact-location pins + clustering — Phase 3
- Reverse-geocoded cities, group-by-place, move/edit, delete, upload-progress, mobile polish — Phase 4
- S3/R2 object storage — v2; StorageAdapter built now for easy swap
- Photo-count heatmap coloring of countries; client-side EXIF preview — later
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CMAP-01 | Interactive world map renders all country boundaries | Natural Earth 110m GeoJSON + react-leaflet GeoJSON layer |
| CMAP-02 | A country highlights on hover / when selected | Leaflet onEachFeature + layer.setStyle() pattern; useRef for stable handler refs |
| CMAP-03 | User can click a country to select/open it | Leaflet click handler on GeoJSON feature; React state for selectedCountry |
| CMAP-04 | Countries that contain photos are visually marked | MongoDB $group aggregation for photo counts per countryCode; GeoJSON style function reads count map |
| CMAP-05 | Base map tiles served from a configured free-tier provider (env-configurable) | Stadia Maps raster tiles, API key in env var, TileLayer url from env |
| PHOTO-01 | User can upload photo files (single and bulk) to a selected country | multer v2.2.0 diskStorage, multi-file input, countryCode from request body |
| PHOTO-02 | Service generates a thumbnail for each photo and strips EXIF from served files | sharp autoOrient() + resize + .withMetadata(false) for both thumbnail and display copy |
| PHOTO-03 | HEIC/HEIF uploads are converted server-side to JPEG | heic-convert package pre-processes buffer before handing to sharp |
| PHOTO-04 | Uploads are validated (file type by magic bytes, size limit) and rejected with clear message | file-type v22 via dynamic import(); multer limits.fileSize |
| PHOTO-05 | Photo files stored via storage abstraction, never inline in MongoDB | StorageAdapter interface with LocalDiskStorage implementation |
| PHOTO-06 | User can open a country and view its photos in a gallery/lightbox | yet-another-react-lightbox v3 + thumbnail grid |
</phase_requirements>

---

## Summary

This phase is a greenfield Walking Skeleton: it establishes the entire end-to-end data path for the core user journey — world map renders country boundaries → user clicks a country → uploads photos to it → views them in a gallery → countries with photos are visually marked. Nothing from the original research (which assumed a pin-by-EXIF model) covers country-boundary rendering, and the data model must be designed from scratch for the country-keyed approach.

The critical new research areas are: (1) GeoJSON country boundary data — Natural Earth 110m is the standard, ~820 KB raw, ~45 KB gzipped, suitable for bundling as a static asset in the frontend; (2) rendering and interacting with country polygons in react-leaflet v5, where hover/highlight uses Leaflet's imperative `layer.setStyle()` inside `onEachFeature` callbacks, with a `useRef` pattern to prevent stale-closure bugs; (3) ISO code handling — Natural Earth has a known "-99" sentinel value for ISO_A2 on countries like France and Norway, requiring a fallback chain to `ISO_A2_EH`; (4) HEIC conversion — sharp's prebuilt binaries do NOT include HEIC support due to patent licensing, so `heic-convert` (pure JS, no native deps) is needed as a pre-processing step before sharp.

**Primary recommendation:** Bundle `ne_110m_admin_0_countries.geojson` (Natural Earth, public domain) as a static Vite asset in the frontend. Use react-leaflet v5 `<GeoJSON>` with `onEachFeature` for hover/click. Use `heic-convert` + `sharp` for the ingest pipeline. Design the Photo schema with `countryCode` + `userId` (null in Phase 1) + space for GeoJSON `location` in Phase 3.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Country boundary rendering | Browser (React SPA) | — | GeoJSON polygon layer lives in the Leaflet map on the client |
| Country hover/click interaction | Browser (React SPA) | — | Leaflet event handlers are client-side DOM events |
| Countries with photos — visual marking | Browser (React SPA) | API / Backend | Client styles polygons; backend provides photo-count-per-country data |
| Photo upload + ingest | API / Backend | Database / Storage | multer receives file; sharp processes; StorageAdapter writes; MongoDB stores metadata |
| EXIF stripping | API / Backend | — | Sharp runs server-side after multer; client never sees raw EXIF |
| HEIC conversion | API / Backend | — | heic-convert runs in Node.js before sharp; iPhones send HEIC |
| Magic-byte file validation | API / Backend | — | file-type reads first 4100 bytes of buffer server-side |
| Thumbnail generation | API / Backend | Database / Storage | Sharp generates thumbnail; stored via StorageAdapter with separate key |
| Photo storage (binaries) | Database / Storage | — | LocalDiskStorage in v1; StorageAdapter makes it swappable |
| Photo metadata | Database / Storage | — | MongoDB `photos` collection; never binary data |
| Per-country photo count query | API / Backend | Database / Storage | MongoDB $group aggregation; result feeds CMAP-04 styling |
| Gallery / lightbox display | Browser (React SPA) | API / Backend | yet-another-react-lightbox on client; API serves thumbnail URLs |
| Tile serving | CDN / Static | — | Stadia Maps raster tiles; URL env-configurable |

---

## Standard Stack

### Core (fixed by CLAUDE.md)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | v24.10.0 (available) | Runtime | Available on this machine; >=20.3.0 required by sharp |
| Express | ^5.2.1 | HTTP API server | Fixed MERN stack |
| MongoDB | 8.x | Document store | Fixed MERN stack |
| Mongoose | ^9.7.1 | ODM | Latest major, MongoDB 8 aligned |
| React | ^19.2.7 | Frontend UI | react-leaflet v5 requires React 19 |
| Vite | ^8.0.16 | Build tool | Current stable June 2026 |

### NEW — Phase 1 Specific

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| leaflet | ^1.9.4 | Core map engine | HIGH [VERIFIED: npm registry] |
| react-leaflet | ^5.0.0 | React bindings for Leaflet | HIGH [VERIFIED: npm registry] |
| ne_110m_admin_0_countries.geojson | static asset (Natural Earth v5.1.2) | Country boundary polygons | HIGH [CITED: naturalearthdata.com] |
| heic-convert | ^2.1.0 | HEIC/HEIF → JPEG/PNG (pure JS, no native deps) | HIGH [VERIFIED: npm registry] |
| file-type | ^22.0.1 | Magic-byte file validation (ESM-only — see note) | HIGH [VERIFIED: npm registry] |
| yet-another-react-lightbox | ^3.32.0 | Thumbnail-grid gallery + lightbox | HIGH [VERIFIED: npm registry] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| multer | ^2.2.0 | Multipart file upload middleware | Every photo upload route |
| sharp | ^0.35.1 | Thumbnail generation, image resize, EXIF strip | Image processing pipeline (after heic-convert if HEIC) |
| @tanstack/react-query | ^5.101.0 | Server state, data fetching | All API calls in frontend |
| cors | ^2.8.6 | Express CORS middleware | Dev: frontend on :5173, API on :3001 |
| dotenv | ^17.4.2 | Environment variable loading | Tile URL, storage path, port |
| react-photo-album | ^3.6.0 | Photo grid layout (thumbnail grid) | Gallery view inside country panel |

> **Note on sharp version:** npm registry shows 0.35.1 (current stable). CLAUDE.md references 0.34.5 from prior research. Pin to `^0.34.x` per CLAUDE.md for now; 0.35.x RC status should be re-verified at install time. [ASSUMED: RC vs stable status in June 2026 may have changed]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ne_110m_admin_0_countries.geojson (110m) | 50m or 10m Natural Earth | 10m is ~4.5 MB raw — too large for SPA bundle; 110m (~820 KB, ~45 KB gzip) is correct for a world map |
| heic-convert (pure JS) | sharp with custom libvips build | Custom libvips requires Docker/Dockerfile with HEIF deps and platform-specific native build — heic-convert avoids all that |
| file-type (ESM) | magic-bytes.js (CJS-compatible) | magic-bytes.js v1.12.1 supports CJS require; file-type v22 is ESM-only and requires dynamic import() in a CJS Express app; either works |
| yet-another-react-lightbox | react-image-lightbox | react-image-lightbox is unmaintained (archived); yet-another-react-lightbox supports React 19 and is actively maintained |
| Stadia Maps tiles | MapTiler tiles | Both have free tiers; Stadia works with no API key on localhost; env-switch |

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| leaflet | npm | ~12 yrs | 5M+/wk | github.com/Leaflet/Leaflet | OK | Approved |
| react-leaflet | npm | ~9 yrs | 1M+/wk | github.com/PaulLeCam/react-leaflet | OK | Approved |
| heic-convert | npm | ~6 yrs | 200K+/wk | github.com/catdad-experiments/heic-convert | OK | Approved |
| file-type | npm | ~10 yrs | 60M+/wk | github.com/sindresorhus/file-type | OK | Approved |
| yet-another-react-lightbox | npm | ~3 yrs | 500K+/wk | github.com/igordanchenko/yet-another-react-lightbox | OK | Approved |
| react-photo-album | npm | ~3 yrs | 200K+/wk | github.com/igordanchenko/react-photo-album | OK | Approved |
| multer | npm | ~10 yrs | 8M+/wk | github.com/expressjs/multer | OK | Approved |
| sharp | npm | ~10 yrs | 8M+/wk | github.com/lovell/sharp | OK | Approved |

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious (SUS):** none

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (React SPA — Vite 8 + React 19)
  │
  ├── <MapContainer>                       (react-leaflet v5)
  │     ├── <TileLayer url={VITE_TILE_URL}>   (Stadia Maps / OSM — env-configurable)
  │     └── <GeoJSON data={countriesGeoJSON}  (Natural Earth 110m bundled as static asset)
  │             onEachFeature={attachHandlers}   → hover highlight, click → select country
  │             style={styleByCountryCode}>      → marks countries with photos
  │
  ├── <CountrySidebar countryCode={selected}>
  │     ├── <PhotoUploadForm>              → POST /api/photos  (multipart/form-data)
  │     └── <PhotoGallery>                → GET  /api/photos?countryCode=XX
  │           └── <Lightbox>              (yet-another-react-lightbox)
  │
  └── TanStack Query                       → manages all API state + caching
        ├── useQuery(['photo-counts'])     → GET /api/countries/photo-counts
        ├── useQuery(['photos', cc])       → GET /api/photos?countryCode=XX
        └── useMutation(uploadPhotos)      → POST /api/photos

         REST / multipart HTTP (proxied via Vite dev server → :3001)
                          │
Express API Server (Node.js :3001)
  ├── POST /api/photos                     multer → heic-convert (if HEIC) → magic bytes check
  │     → sharp autoOrient + resize        → StorageAdapter.put(key, buf)
  │     → MongoDB insert Photo doc
  │
  ├── GET  /api/photos?countryCode=XX      → MongoDB find({ countryCode })
  │
  ├── GET  /api/countries/photo-counts     → MongoDB $group aggregation → { countryCode, count }[]
  │
  ├── GET  /api/photos/:id/thumb           → StorageAdapter.getStream(thumbnailKey) → res.pipe
  └── GET  /api/photos/:id/file            → StorageAdapter.getStream(storageKey)   → res.pipe

         │                                          │
    MongoDB                                  LocalDiskStorage
  photos collection                         uploads/{photoId}-orig.jpg
  (metadata + countryCode)                  uploads/{photoId}-thumb.jpg
```

### Recommended Project Structure

```
photo_map/
├── server/
│   ├── src/
│   │   ├── app.js                  # Express app factory (no listen)
│   │   ├── server.js               # Entry point (app.listen)
│   │   ├── config.js               # dotenv + validated env vars
│   │   ├── models/
│   │   │   └── Photo.js            # Mongoose schema (see data model below)
│   │   ├── routes/
│   │   │   ├── photos.js           # POST /api/photos, GET /api/photos
│   │   │   └── countries.js        # GET /api/countries/photo-counts
│   │   ├── middleware/
│   │   │   └── upload.js           # multer config + magic-byte validator
│   │   ├── services/
│   │   │   ├── ingest.js           # heic-convert + sharp pipeline (pure fn, testable)
│   │   │   └── storage/
│   │   │       ├── StorageAdapter.js        # interface (JSDoc typedef)
│   │   │       └── LocalDiskStorage.js      # local implementation
│   │   └── utils/
│   │       └── isoCode.js          # extractIso(feature) — handles "-99" fallback
│   ├── uploads/                    # gitignored; runtime photo storage
│   └── package.json
│
├── client/
│   ├── public/
│   │   └── countries.geojson       # Natural Earth 110m (bundled static asset ~820 KB)
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── api/
│   │   │   ├── photos.js           # TanStack Query hooks for photos
│   │   │   └── countries.js        # useQuery for photo-counts
│   │   ├── components/
│   │   │   ├── WorldMap.jsx        # MapContainer + GeoJSON layer
│   │   │   ├── CountrySidebar.jsx  # upload form + gallery
│   │   │   ├── PhotoUploadForm.jsx
│   │   │   └── PhotoGallery.jsx    # yet-another-react-lightbox
│   │   └── hooks/
│   │       └── useCountryPhotoCounts.js
│   ├── vite.config.js              # proxy /api → :3001
│   └── package.json
│
└── .env                            # VITE_TILE_URL, TILE_API_KEY, MONGODB_URI, STORAGE_PATH
```

---

### Pattern 1: GeoJSON Country Layer with Hover Highlight

**What:** Render all ~177 country polygons and handle hover highlight + click selection imperatively via Leaflet's `layer.setStyle()`.

**When to use:** Any react-leaflet GeoJSON interaction. The key insight: `style` prop on `<GeoJSON>` is NOT dynamically re-evaluated on state changes — style updates MUST go through `layer.setStyle()` imperatively. Use a `useRef` to hold a stable reference to the currently hovered/selected layer so event handlers don't capture stale closures.

```jsx
// Source: Leaflet choropleth tutorial + react-leaflet v5 API docs
import { GeoJSON } from 'react-leaflet';
import { useRef } from 'react';

export function CountryLayer({ countriesGeoJSON, photoCounts, onCountryClick }) {
  const hoveredLayerRef = useRef(null);
  const selectedLayerRef = useRef(null);
  const selectedCodeRef = useRef(null);

  // photoCounts: Map<isoCode, number> — from TanStack Query
  // isoCode extraction must handle Natural Earth's "-99" sentinel (see Pattern 3)

  function styleCountry(feature) {
    const code = extractIso(feature);
    const hasPhotos = photoCounts.has(code) && photoCounts.get(code) > 0;
    return {
      color: '#555',
      weight: 1,
      fillColor: hasPhotos ? '#3b82f6' : '#e5e7eb',
      fillOpacity: hasPhotos ? 0.5 : 0.2,
    };
  }

  function onEachFeature(feature, layer) {
    layer.on({
      mouseover(e) {
        const l = e.target;
        l.setStyle({ weight: 2, color: '#222', fillOpacity: 0.7 });
        l.bringToFront();
        hoveredLayerRef.current = l;
      },
      mouseout(e) {
        const l = e.target;
        // Don't reset if this is the selected country
        if (l !== selectedLayerRef.current) {
          l.setStyle(styleCountry(feature));
        }
        hoveredLayerRef.current = null;
      },
      click(e) {
        // Reset previous selection
        if (selectedLayerRef.current && selectedLayerRef.current !== e.target) {
          selectedLayerRef.current.setStyle(styleCountry(
            selectedLayerRef.current.feature
          ));
        }
        const l = e.target;
        const code = extractIso(feature);
        l.setStyle({ weight: 3, color: '#1d4ed8', fillOpacity: 0.8 });
        l.bringToFront();
        selectedLayerRef.current = l;
        selectedCodeRef.current = code;
        onCountryClick(code, feature.properties.NAME);
      },
    });
  }

  return (
    <GeoJSON
      data={countriesGeoJSON}
      style={styleCountry}
      onEachFeature={onEachFeature}
    />
  );
}
```

**Critical note:** The `style` prop function is called only at initial render and when the `data` prop changes. To update styling reactively when `photoCounts` changes, pass a new `key` prop to `<GeoJSON>` based on a hash of the photoCounts, which forces a full re-mount with fresh styles. This is the correct react-leaflet pattern — do NOT rely on React re-renders to update Leaflet layer styles.

```jsx
// Force GeoJSON re-mount when photo counts change
const countsKey = [...photoCounts.keys()].sort().join(',');
<GeoJSON key={countsKey} data={geoJSON} style={styleCountry} onEachFeature={onEachFeature} />
```

---

### Pattern 2: Photo Ingest Pipeline

**What:** Synchronous pipeline: multer disk write → heic-convert if HEIC → magic-byte check → sharp autoOrient + thumbnail + EXIF strip → StorageAdapter write → MongoDB insert.

**Why synchronous:** Upload responds with `201 + photoId` in <2 s for a single file. No GPS extraction in Phase 1 (Phase 3), so no async geocoding needed here.

```js
// Source: sharp docs (api-operation) + heic-convert npm
// services/ingest.js — testable pure function, no HTTP machinery

import heicConvert from 'heic-convert';
import sharp from 'sharp';
import { promisify } from 'util';

const heicConvertAsync = promisify(heicConvert);

export async function ingestPhoto(inputBuffer, mimeType, countryCode) {
  let workingBuffer = inputBuffer;

  // Step 1: Convert HEIC to JPEG if needed
  if (mimeType === 'image/heic' || mimeType === 'image/heif') {
    workingBuffer = await heicConvertAsync({
      buffer: workingBuffer,
      format: 'JPEG',
      quality: 0.92,
    });
  }

  // Step 2: Generate thumbnail — auto-orient, strip EXIF, resize to 300px wide
  const thumbBuffer = await sharp(workingBuffer)
    .autoOrient()           // reads EXIF orientation tag, applies rotation
    .resize(300, null, { withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .withMetadata(false)    // strip ALL EXIF including GPS
    .toBuffer();

  // Step 3: Generate display copy — auto-orient, strip EXIF, resize to 1200px wide
  const displayBuffer = await sharp(workingBuffer)
    .autoOrient()
    .resize(1200, null, { withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .withMetadata(false)    // strip ALL EXIF
    .toBuffer();

  return { thumbBuffer, displayBuffer };
}
```

---

### Pattern 3: Natural Earth ISO Code Extraction (handles "-99" sentinel)

**What:** Natural Earth data has a known bug where `ISO_A2` is set to `"-99"` for several real countries (France = "FR", Norway = "NO"). Use a fallback chain.

```js
// Source: natural-earth-vector GitHub issues #695, #947, #284
// utils/isoCode.js

export function extractIso(feature) {
  const p = feature.properties;
  // Primary: ISO_A2 (the standard field)
  if (p.ISO_A2 && p.ISO_A2 !== '-99') return p.ISO_A2.toUpperCase();
  // Fallback: ISO_A2_EH (extended homeland — covers France, Norway, etc.)
  if (p.ISO_A2_EH && p.ISO_A2_EH !== '-99') return p.ISO_A2_EH.toUpperCase();
  // Last resort: ISO_A3 truncated (imperfect but better than "-99")
  if (p.ISO_A3 && p.ISO_A3 !== '-99') return p.ISO_A3.slice(0, 2).toUpperCase();
  // Territories / disputed: use NAME as slug
  return (p.NAME || 'XX').replace(/\s+/g, '_').toUpperCase();
}
```

---

### Pattern 4: file-type in a CJS Express app (ESM-only package)

`file-type` v22 is ESM-only. In a CommonJS Express backend, use dynamic `import()`:

```js
// Source: file-type GitHub README + Node.js ESM/CJS interop
// middleware/upload.js

export async function validateMagicBytes(buffer) {
  // Dynamic import works in CJS modules
  const { fileTypeFromBuffer } = await import('file-type');
  const result = await fileTypeFromBuffer(buffer);
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
  if (!result || !allowed.includes(result.mime)) {
    throw new Error(`Invalid file type: ${result?.mime ?? 'unknown'}`);
  }
  return result.mime; // return detected mime for downstream use
}
```

**Alternative:** Use `magic-bytes.js` (CJS-compatible, `require('magic-bytes.js')`) to avoid the ESM interop entirely if the backend stays CommonJS.

---

### Pattern 5: StorageAdapter Interface

```js
// Source: ARCHITECTURE.md StorageAdapter pattern (project convention)
// services/storage/StorageAdapter.js (JSDoc typedef)

/**
 * @typedef {Object} StorageAdapter
 * @property {(key: string, buffer: Buffer, mime: string) => Promise<void>} put
 * @property {(key: string) => string} getLocalPath  — local disk only
 * @property {(key: string) => Promise<string>} getUrl — returns serving URL
 * @property {(key: string) => Promise<void>} delete
 */

// LocalDiskStorage implementation
// services/storage/LocalDiskStorage.js
import fs from 'fs/promises';
import path from 'path';

export class LocalDiskStorage {
  constructor(basePath) {
    this.basePath = basePath; // e.g. process.env.STORAGE_PATH || './uploads'
  }
  async put(key, buffer) {
    const fullPath = path.join(this.basePath, key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);
  }
  getLocalPath(key) {
    return path.join(this.basePath, key);
  }
  async getUrl(key) {
    return `/api/photos/file/${encodeURIComponent(key)}`;
  }
  async delete(key) {
    await fs.unlink(path.join(this.basePath, key));
  }
}
```

---

### Pattern 6: MongoDB Photo Schema (Phase 1 → Phase 3 compatible)

```js
// Source: ARCHITECTURE.md data model + phase context decisions D-04, D-07
// models/Photo.js

import mongoose from 'mongoose';

const photoSchema = new mongoose.Schema({
  // Phase 1 — country key (stable identifier, not display name)
  countryCode: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    index: true,              // fast per-country photo queries
  },

  // Phase 2 — will be added via migration (null until auth is built)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },

  // Phase 3 — GPS location (null until EXIF auto-placement)
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: undefined }, // [lng, lat]
  },
  geocodeStatus: {
    type: String,
    enum: ['none', 'pending', 'done', 'failed'],
    default: 'none',
  },

  // Storage keys (never store binaries)
  storageKey:   { type: String, required: true },    // original (EXIF-stripped display copy)
  thumbnailKey: { type: String, required: true },    // 300px thumb

  mimeType:         { type: String, required: true },
  originalFilename: { type: String, default: '' },
  fileSize:         { type: Number, required: true },
  countryName:      { type: String, default: '' },  // display name from GeoJSON properties.NAME

}, { timestamps: true });

// Phase 1 index: per-country photo list
photoSchema.index({ countryCode: 1, createdAt: -1 });

// Phase 2 will add: { userId: 1, countryCode: 1 } compound index via migration
// Phase 3 will add: { location: '2dsphere' } index via migration

export default mongoose.model('Photo', photoSchema);
```

---

### Pattern 7: Per-Country Photo Counts (MongoDB aggregation)

```js
// Source: MongoDB docs — $group aggregation
// routes/countries.js

router.get('/photo-counts', async (req, res) => {
  const counts = await Photo.aggregate([
    // Phase 2: add { $match: { userId: req.userId } } here
    { $group: { _id: '$countryCode', count: { $sum: 1 } } },
    { $project: { _id: 0, countryCode: '$_id', count: 1 } },
  ]);
  // Return as object map for O(1) lookup in frontend style function
  const map = Object.fromEntries(counts.map(r => [r.countryCode, r.count]));
  res.json(map);  // { "US": 12, "FR": 8, ... }
});
```

---

### Pattern 8: Vite Dev Server Proxy

```js
// Source: Vite 8 docs — server.proxy
// client/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
```

---

### Anti-Patterns to Avoid

- **Never call `setStyle()` inside a React render path** — Leaflet layer style must be set imperatively in event handlers or via full re-mount (key prop change). Calling it in a `useEffect` during render causes flicker and race conditions.
- **Never use `ISO_A2` alone** — Natural Earth has known "-99" values for France, Norway, and other countries. Always use the `extractIso()` fallback chain.
- **Never store photo binaries in MongoDB** — 16 MB BSON limit; use StorageAdapter.
- **Never call `sharp()` directly on a HEIC buffer without heic-convert first** — sharp's prebuilt binaries have no HEIC support (patent licensing). The pipeline must run `heic-convert` first.
- **Never use `withMetadata(true)` on thumbnails** — EXIF GPS would survive in served files. Always `withMetadata(false)`.
- **Never lazy-load the countriesGeoJSON at request time** — Bundle it as a static asset in Vite's `public/` directory. ~820 KB raw, ~45 KB gzip. Leaflet renders it once on mount; no re-fetch needed.
- **Never generate GeoJSON style in a React `useState` handler** — style function must be a stable reference or recreated only when `photoCounts` data changes (via key prop re-mount).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Country boundary polygons | Your own GeoJSON | Natural Earth 110m (public domain) | 177 countries, correct ISO codes, public domain, maintained |
| HEIC → JPEG conversion | Custom libheif bindings | `heic-convert` | Pure JS, no native deps, works in all Node environments without Docker |
| Magic-byte file validation | Manual buffer slicing | `file-type` or `magic-bytes.js` | Handles edge cases, supports HEIC/HEIF/WEBP magic bytes |
| Image orientation correction | EXIF Orientation tag lookup table | `sharp.autoOrient()` | Handles all 8 EXIF orientation values correctly; `.rotate()` without args also works |
| Photo gallery + lightbox | Custom modal + swipe | `yet-another-react-lightbox` | Keyboard nav, touch swipe, zoom, React 19 compat, accessible |
| Server state management | `useEffect + useState` data fetching | `@tanstack/react-query` | Loading/error states, background refetch, cache invalidation on upload |
| ISO code normalization | Custom lookup table | `extractIso()` utility using GeoJSON properties | Three-field fallback chain handles all Natural Earth data edge cases |

**Key insight:** The country-polygon + photo-association problem has well-established open-source building blocks. The entire GeoJSON rendering + ISO code extraction layer is solved by Natural Earth data + Leaflet's built-in GeoJSON layer + one small utility function. Hand-rolling any of these adds complexity with no benefit.

---

## Common Pitfalls

### Pitfall 1: Natural Earth ISO_A2 Returns "-99" for Major Countries

**What goes wrong:** France (ISO_A2 = "-99"), Norway (ISO_A2 = "-99"), and ~15 other territories have `-99` as their ISO_A2 value in Natural Earth GeoJSON despite having valid ISO codes. If you use `feature.properties.ISO_A2` directly as the country key, these countries will never match photos stored under "FR" or "NO".

**Root cause:** Natural Earth distinguishes "metropolitan France" from overseas territories — the homeland polygon uses a different encoding. Open GitHub issues #695, #947, #284 in nvkelso/natural-earth-vector confirm this is a persistent known bug.

**Fix:** Always use `extractIso()` (Pattern 3) which falls back to `ISO_A2_EH`.

**Warning signs:** France, Norway, Kosovo, or other countries appear un-clickable or never show photos despite uploads.

---

### Pitfall 2: sharp Cannot Process HEIC Without Custom libvips

**What goes wrong:** `sharp(heicBuffer).jpeg().toBuffer()` throws a format error or produces corrupted output when using the standard npm prebuilt binaries. iPhone photos (the most common user upload source) are HEIC by default.

**Root cause:** HEIC support requires libheif/libde265/x265 which are excluded from sharp's prebuilt binaries due to patent licensing concerns. The prebuilt binaries on npm explicitly do NOT include HEIC decoding.

**Fix:** Pre-process HEIC with `heic-convert` before passing to sharp. This is pure JS, has no native deps, and works in any environment.

**Warning signs:** Users report iPhone photo uploads failing or producing blank images.

---

### Pitfall 3: react-leaflet GeoJSON Style Is Not Reactive

**What goes wrong:** You update React state (e.g., `photoCounts` changes after an upload), but the GeoJSON country polygons don't update their fill colors. The `style` prop function on `<GeoJSON>` is called only at initial render and when `data` changes — it is NOT reactive to other prop changes.

**Root cause:** react-leaflet's `<GeoJSON>` component creates a Leaflet GeoJSON layer imperatively on mount. Subsequent React re-renders do not re-call the style function on existing layers.

**Fix:** When the data that drives styling changes (photo counts), use a `key` prop derived from that data to force a full re-mount of `<GeoJSON>`. This is the documented react-leaflet pattern.

**Warning signs:** Country fill colors don't update after photos are uploaded; requires page refresh to see marking.

---

### Pitfall 4: file-type Is ESM-Only in a CJS Express Backend

**What goes wrong:** `const { fileTypeFromBuffer } = require('file-type')` throws `ERR_REQUIRE_ESM`. file-type v16+ dropped CJS support.

**Root cause:** The package switched to ESM-only distribution to support top-level await.

**Fix option A:** Use `await import('file-type')` (dynamic import — works in CJS). [VERIFIED: Node.js ESM/CJS interop docs]
**Fix option B:** Use `magic-bytes.js` (CJS-compatible alternative) — same magic-byte approach, simpler for a CJS project.
**Fix option C:** Convert the backend to ESM (`"type": "module"` in package.json) — cleaner long-term.

---

### Pitfall 5: GeoJSON Layer Stale Closure in Event Handlers

**What goes wrong:** `onEachFeature` runs once per feature when the GeoJSON layer is mounted. Event handlers created at that time close over the React state at mount time. If you reference `photoCounts` or `selectedCountry` state directly inside these handlers, they always see the initial values.

**Root cause:** Leaflet event handlers are attached imperatively once; they don't participate in React's render cycle.

**Fix:** Store mutable state in `useRef` values. Update the ref whenever the state changes. Read `ref.current` inside event handlers.

---

### Pitfall 6: GeoJSON [lng, lat] Order vs. Map Expectations

**What goes wrong:** Leaflet expects GeoJSON in the standard `[longitude, latitude]` order. Natural Earth provides correct GeoJSON. However, if you transform coordinates or build custom Point objects and accidentally swap lat/lng, countries appear in the wrong location.

**Note:** This is only a concern if custom coordinate transformations are added later (Phase 3 GPS). For Phase 1, Natural Earth GeoJSON coordinates are correct out of the box — this pitfall is a reminder for Phase 3 consistency.

---

### Pitfall 7: GeoJSON File Served From Wrong Origin

**What goes wrong:** Placing `countries.geojson` in `server/` and serving it via Express means the frontend fetches it over HTTP on every load. The file is ~820 KB and doesn't change.

**Fix:** Place it in `client/public/countries.geojson`. Vite serves it as a static asset with correct cache headers. The frontend fetches it once, Vite gzips it to ~45 KB, and the browser caches it.

---

## Code Examples

### MapContainer Setup with GeoJSON and Stadia Tiles

```jsx
// Source: react-leaflet v5 docs + Stadia Maps Leaflet tutorial
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const TILE_URL = import.meta.env.VITE_TILE_URL ||
  'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; ' +
  '<a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; ' +
  '<a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

function WorldMap({ countriesGeoJSON, photoCounts, onCountryClick }) {
  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      style={{ height: '100vh', width: '100%' }}
      worldCopyJump
    >
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={18} />
      {countriesGeoJSON && (
        <CountryLayer
          key={[...photoCounts.keys()].sort().join(',')}
          countriesGeoJSON={countriesGeoJSON}
          photoCounts={photoCounts}
          onCountryClick={onCountryClick}
        />
      )}
    </MapContainer>
  );
}
```

### multer Upload Route

```js
// Source: multer v2 docs + project conventions
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { validateMagicBytes } from '../middleware/upload.js';
import { ingestPhoto } from '../services/ingest.js';
import { storage } from '../services/storage/index.js';
import Photo from '../models/Photo.js';

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, process.env.STORAGE_PATH || './uploads/tmp');
    },
    filename: (req, file, cb) => {
      const id = crypto.randomUUID();
      cb(null, id + path.extname(file.originalname).toLowerCase());
    },
  }),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB
    files: 50,
  },
  // Note: fileFilter runs before magic-byte check (can only check declared mime here)
});

router.post('/', upload.array('photos', 50), async (req, res) => {
  const { countryCode, countryName } = req.body;
  if (!countryCode) return res.status(400).json({ error: 'countryCode required' });

  const results = [];
  for (const file of req.files) {
    const rawBuffer = await fs.readFile(file.path);

    // Magic-byte validation (actual content check — not spoofable)
    let detectedMime;
    try {
      detectedMime = await validateMagicBytes(rawBuffer);
    } catch (err) {
      await fs.unlink(file.path);
      results.push({ file: file.originalname, error: err.message });
      continue;
    }

    const photoId = crypto.randomUUID();
    const { thumbBuffer, displayBuffer } = await ingestPhoto(rawBuffer, detectedMime, countryCode);

    const storageKey   = `${photoId}-display.jpg`;
    const thumbnailKey = `${photoId}-thumb.jpg`;

    await storage.put(storageKey, displayBuffer, 'image/jpeg');
    await storage.put(thumbnailKey, thumbBuffer, 'image/jpeg');
    await fs.unlink(file.path); // clean up tmp

    const photo = await Photo.create({
      countryCode: countryCode.toUpperCase(),
      countryName,
      storageKey,
      thumbnailKey,
      mimeType: 'image/jpeg', // always JPEG after pipeline
      originalFilename: file.originalname,
      fileSize: rawBuffer.length,
    });

    results.push({ photoId: photo._id, thumbnailUrl: await storage.getUrl(thumbnailKey) });
  }

  res.status(201).json({ uploaded: results.length, results });
});
```

### Yet Another React Lightbox Gallery

```jsx
// Source: yet-another-react-lightbox docs
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';
import { useState } from 'react';

export function PhotoGallery({ photos }) {
  const [index, setIndex] = useState(-1);

  const slides = photos.map(p => ({
    src: `/api/photos/file/${p.storageKey}`,
    thumbnail: `/api/photos/file/${p.thumbnailKey}`,
    alt: p.originalFilename,
  }));

  return (
    <>
      <div className="photo-grid">
        {photos.map((p, i) => (
          <img
            key={p._id}
            src={`/api/photos/file/${p.thumbnailKey}`}
            onClick={() => setIndex(i)}
            alt={p.originalFilename}
          />
        ))}
      </div>
      <Lightbox
        open={index >= 0}
        index={index}
        close={() => setIndex(-1)}
        slides={slides}
        on={{ view: ({ index: i }) => setIndex(i) }}
      />
    </>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| create-react-app | Vite 8 + @vitejs/plugin-react v6 (Oxc transform) | Vite 8, June 2026 | Faster HMR, no Babel dependency in default setup |
| react-leaflet v4 (React 18) | react-leaflet v5 (React 19 required) | Dec 2024 | Must use React 19; v4 does not work with React 19 |
| `sharp().rotate()` no-arg | `sharp().autoOrient()` (explicit API) | sharp 0.33+ | autoOrient() is clearer than implicit no-arg rotate; both work |
| multer 1.x | multer 2.2.0+ | June 2026 (CVE patches) | v1 has active DoS CVEs — must use v2 |
| jsonwebtoken | jose | Ongoing trend | Phase 2 concern; jose uses Web Crypto API |

**Deprecated/outdated:**
- `react-image-lightbox`: archived/unmaintained — use `yet-another-react-lightbox`
- `exif-js` (browser EXIF): abandoned — irrelevant for server-side pipeline
- `multer <2.0.0`: active security CVEs (CVE-2025-47944, CVE-2025-7338)

---

## GeoJSON Data Source Details

**Natural Earth 1:110m Admin-0 Countries**
- URL: `https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson`
- License: Public Domain (no attribution required, but credit Natural Earth)
- File size: ~820 KB raw, ~45 KB gzip [CITED: blog.mastermaps.com analysis]
- Country count: ~177 features
- Key properties: `NAME` (display name), `ISO_A2`, `ISO_A2_EH`, `ISO_A3`, `ISO_A3_EH`
- Known issue: `ISO_A2 = "-99"` for France, Norway, Kosovo, and ~15 others — use `ISO_A2_EH` fallback [CITED: github.com/nvkelso/natural-earth-vector issues #695, #947, #284]
- Rendering performance at 110m resolution: 177 polygons render smoothly in Leaflet even on mobile; no performance concern at this resolution [ASSUMED: based on Leaflet's known capabilities with <1000 features]

**Bundling strategy:** Place in `client/public/countries.geojson`. Fetch on app init:
```js
const res = await fetch('/countries.geojson');
const geoJSON = await res.json();
```
Vite serves `public/` as static assets with proper cache headers. Browser caches the file after first load. Do NOT import it as a JS module (`import geoJSON from './countries.geojson'`) — JSON bundled into the JS bundle increases parse time; serving as a separate file allows browser caching and parallel loading.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Natural Earth 110m renders ~177 polygons smoothly without clustering | GeoJSON Data Source Details | If performance is poor, must switch to canvas renderer: `<GeoJSON renderer={L.canvas()}>`; low risk |
| A2 | sharp 0.35.1 (current) is stable, not RC | Standard Stack | If 0.35.x is still RC, pin to 0.34.x per CLAUDE.md — CLAUDE.md says pin to 0.34.x, use that |
| A3 | `heic-convert` pure-JS covers all iPhone HEIC variants | Pattern 2 (ingest) | Some HEIF profiles (e.g. HEIF with AVC) might fail; fallback: reject with "HEIC conversion failed, please convert to JPEG first" |
| A4 | yet-another-react-lightbox 3.32.0 fully supports React 19 | Standard Stack | If peer-dep warnings appear, use `--legacy-peer-deps` flag; library confirmed React 19 support in search results |
| A5 | MongoDB not installed locally — project uses Atlas | Environment Availability | Developer must configure MONGODB_URI in .env pointing to Atlas or install MongoDB locally |

**If this table is empty:** Not empty — A2 and A5 are the highest-risk assumptions requiring confirmation before starting implementation.

---

## Open Questions

1. **sharp 0.35.x stability**
   - What we know: npm registry shows 0.35.1 as current; CLAUDE.md says pin to 0.34.x (written when 0.35 was RC)
   - What's unclear: whether 0.35.x is now stable or still RC as of June 2026
   - Recommendation: Use `^0.34.5` per CLAUDE.md during Phase 1; re-evaluate in Phase 3 when HEIC support matters more

2. **MongoDB local vs. Atlas**
   - What we know: MongoDB is not installed locally on this machine (`mongod --version` returns nothing)
   - What's unclear: whether the developer has a MongoDB Atlas cluster configured
   - Recommendation: Plan Wave 0 to include a `.env.example` with `MONGODB_URI` placeholder and instructions for Atlas free tier setup

3. **Backend ESM vs. CJS module format**
   - What we know: `file-type` v22 is ESM-only; Mongoose 9, Express 5 both support ESM
   - What's unclear: whether the backend will use `"type": "module"` (ESM) or stay CJS
   - Recommendation: Start backend as ESM (`"type": "module"` in server/package.json) — cleaner, avoids `file-type` dynamic import workaround; all MERN stack packages support ESM

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Yes | v24.10.0 | — |
| npm | Package management | Yes | 11.6.1 | — |
| MongoDB | Data persistence | No (not local) | — | MongoDB Atlas free tier (M0) |
| Git | Version control | Yes | (git repo exists) | — |

**Missing dependencies with no fallback:**
- MongoDB local install — developer must configure `MONGODB_URI` pointing to Atlas or install MongoDB locally before Wave 1 backend tasks run

**Missing dependencies with fallback:**
- None beyond MongoDB

---

## Validation Architecture

> `workflow.nyquist_validation` is `false` in config.json — this section is skipped per config.

---

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1` in config.json.

### Applicable ASVS Categories (Phase 1 — no auth, but these still apply)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (Phase 1 has no auth) | Phase 2 |
| V3 Session Management | No (Phase 1 has no session) | Phase 2 |
| V4 Access Control | Partial | No per-user isolation in Phase 1; design model for Phase 2 migration |
| V5 Input Validation | Yes | file-type magic bytes; multer file size limits; countryCode sanitization (uppercase, trim, length check) |
| V6 Cryptography | No (no passwords/tokens in Phase 1) | Phase 2 argon2id + jose |

### Known Threat Patterns (Phase 1 stack)

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious file upload (polyglot, SVG+script) | Tampering | magic-byte check (file-type); sharp re-encode destroys embedded payloads |
| EXIF GPS in served files (privacy leak) | Information Disclosure | `sharp().autoOrient().withMetadata(false)` strips all EXIF from served files |
| DoS via oversized upload | Denial of Service | `multer limits.fileSize = 25 MB`; `limits.files = 50` |
| Path traversal in file serving | Tampering | StorageAdapter uses UUID keys, never user-controlled paths; `express.static` with bounded root |
| BSON injection / NoSQL injection | Tampering | Mongoose schema validation + `uppercase: true` on countryCode prevents injection |

**Phase 1 security posture note:** Because there is no auth in Phase 1, any user of the running app can see and upload photos. This is intentional (single local user, MVP mode). The StorageAdapter, EXIF stripping, and magic-byte validation are put in place NOW so they don't need to be retrofitted when Phase 2 adds multi-user isolation.

---

## Sources

### Primary (HIGH confidence)

- [Leaflet Choropleth Tutorial](https://leafletjs.com/examples/choropleth/) — onEachFeature, setStyle, resetStyle pattern
- [react-leaflet v5 API Docs](https://react-leaflet.js.org/docs/api-components/) — GeoJSON component props, v5 release
- [Stadia Maps Leaflet Tutorial](https://docs.stadiamaps.com/tutorials/raster-maps-with-leaflet/) — tile URL, attribution, API key pattern
- [sharp API — Operations](https://sharp.pixelplumbing.com/api-operation/) — autoOrient(), rotate(), withMetadata(false)
- [Natural Earth — 110m Countries](https://www.naturalearthdata.com/downloads/110m-cultural-vectors/110m-admin-0-countries/) — public domain GeoJSON source
- `npm view` registry — all package versions verified via live npm registry calls

### Secondary (MEDIUM confidence)

- [Natural Earth ISO_A2 -99 bug — Issue #695](https://github.com/nvkelso/natural-earth-vector/issues/695) — France, ISO_A2_EH fallback pattern confirmed
- [Natural Earth ISO_A2 -99 bug — Issue #947](https://github.com/nvkelso/natural-earth-vector/issues/947) — Norway confirmed
- [react-leaflet GeoJSON stale state issue #697](https://github.com/PaulLeCam/react-leaflet/issues/697) — stale closure in onEachFeature; useRef fix pattern
- [heic-convert npm](https://www.npmjs.com/package/heic-convert) — pure JS HEIC conversion
- [sharp HEIC prebuilt limitation (DEV article)](https://dev.to/up9t/converting-heic-image-extension-in-nodejs-with-the-sharp-library-39mg) — confirms no HEIC in prebuilt binaries

### Tertiary (LOW confidence / ASSUMED)

- GeoJSON file size estimates (~820 KB raw, ~45 KB gzip) from blog analysis — treat as approximate
- Natural Earth polygon count of ~177 — may vary slightly by version

---

## Metadata

**Confidence breakdown:**
- Standard stack (versions): HIGH — all versions verified via `npm view` live registry calls
- Country-boundary rendering pattern: HIGH — sourced from official Leaflet + react-leaflet docs
- HEIC conversion approach (heic-convert): HIGH — confirmed prebuilt limitation from multiple sources; pure-JS alternative confirmed
- ISO code "-99" fallback: HIGH — confirmed via Natural Earth GitHub issue tracker
- react-leaflet GeoJSON style reactivity limitations: MEDIUM — documented in GitHub issues, recommended workaround (key prop) is well-known but not in official docs
- File-type ESM compatibility: HIGH — package README and Node.js ESM/CJS interop docs confirmed

**Research date:** 2026-06-18
**Valid until:** 2026-09-18 (90 days — stable ecosystem; re-verify sharp 0.35.x status)
