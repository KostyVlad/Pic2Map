---
phase: 01-country-map-photos
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - server/package.json
  - server/.env.example
  - server/src/config.js
  - server/src/db.js
  - server/src/app.js
  - server/src/server.js
  - server/src/models/Photo.js
  - server/src/utils/isoCode.js
  - server/src/services/storage/StorageAdapter.js
  - server/src/services/storage/LocalDiskStorage.js
  - server/src/services/storage/index.js
  - server/src/services/ingest.js
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
  - .gitignore
autonomous: false
requirements:
  - CMAP-01
  - CMAP-03
  - CMAP-05
  - PHOTO-01
  - PHOTO-02
  - PHOTO-03
  - PHOTO-04
  - PHOTO-05
  - PHOTO-06

user_setup:
  - service: mongodb
    why: "Photo metadata persistence; MongoDB is not installed locally on this machine"
    env_vars:
      - name: MONGODB_URI
        source: "MongoDB Atlas free tier (M0) connection string, or a local mongod instance"
    dashboard_config:
      - task: "Create a free M0 cluster and a database user, then copy the connection string"
        location: "MongoDB Atlas -> Database -> Connect -> Drivers"
  - service: stadia-maps
    why: "Base map raster tiles (CMAP-05). Stadia works without an API key on localhost; a key is only needed for non-localhost origins."
    env_vars:
      - name: VITE_TILE_URL
        source: "Default Stadia alidade_smooth URL works on localhost with no key; override only if using MapTiler or a keyed Stadia domain"

must_haves:
  truths:
    - "Opening the app renders all ~177 country boundaries on a tiled world map"
    - "Clicking a country selects it and opens a side panel for that country"
    - "Uploading a photo to a selected country stores it on disk and inserts metadata in MongoDB"
    - "An uploaded HEIC photo is converted to JPEG; served files have EXIF/GPS stripped"
    - "The selected country's gallery shows the uploaded photo's thumbnail, openable in a lightbox"
    - "Photo binaries are never stored in MongoDB — only storage keys and metadata"
  artifacts:
    - path: "client/src/components/WorldMap.jsx"
      provides: "react-leaflet MapContainer + TileLayer + country GeoJSON layer"
      contains: "MapContainer"
    - path: "client/src/components/CountryLayer.jsx"
      provides: "GeoJSON polygons with click-to-select + onEachFeature handlers"
      contains: "onEachFeature"
    - path: "client/public/countries.geojson"
      provides: "Natural Earth 110m country boundary polygons as a static asset"
    - path: "server/src/services/ingest.js"
      provides: "heic-convert + sharp pipeline producing EXIF-stripped thumb + display buffers"
      exports: ["ingestPhoto"]
    - path: "server/src/services/storage/LocalDiskStorage.js"
      provides: "StorageAdapter local disk implementation"
      contains: "class LocalDiskStorage"
    - path: "server/src/models/Photo.js"
      provides: "Mongoose Photo schema keyed by countryCode, with reserved userId/location fields"
      contains: "countryCode"
    - path: "server/src/routes/photos.js"
      provides: "POST /api/photos upload route + GET /api/photos + GET /api/photos/file/:key"
      contains: "upload.array"
    - path: "server/src/middleware/upload.js"
      provides: "multer config (25MB/file, 50 files) + magic-byte validator"
      contains: "validateMagicBytes"
  key_links:
    - from: "client/src/components/PhotoUploadForm.jsx"
      to: "POST /api/photos"
      via: "TanStack Query useMutation (multipart/form-data)"
      pattern: "api/photos"
    - from: "server/src/routes/photos.js"
      to: "server/src/services/ingest.js"
      via: "ingestPhoto() call in the upload handler"
      pattern: "ingestPhoto"
    - from: "server/src/routes/photos.js"
      to: "Photo model"
      via: "Photo.create() after storage write"
      pattern: "Photo\\.create"
    - from: "server/src/components/PhotoGallery.jsx"
      to: "GET /api/photos/file/:key"
      via: "thumbnail img src + lightbox slides"
      pattern: "api/photos/file"
---

## Phase Goal

**As a** single local user, **I want to** open a world map, click a country, upload a photo to it, and see that photo in the country's gallery, **so that** I can start building a country-organized travel map without needing an account.

## Acceptance Criteria

- [ ] `npm run dev` in both `server/` and `client/` starts the full stack; the client proxies `/api` to the server.
- [ ] The map renders all Natural Earth 110m country polygons over Stadia tiles; France and Norway are clickable (ISO `-99` handled).
- [ ] Clicking a country opens a side panel showing that country's name and an upload zone.
- [ ] Uploading a JPEG/PNG/WebP/HEIC photo returns 201 and the thumbnail appears in the gallery without a page refresh.
- [ ] A served photo file contains no EXIF/GPS metadata; a HEIC upload is served as JPEG.
- [ ] An upload whose bytes are not a real image (magic-byte mismatch) is rejected; oversized (>25 MB) files are rejected by multer.
- [ ] MongoDB `photos` documents contain `countryCode`, `storageKey`, `thumbnailKey` — and no binary image data.

<objective>
Stand up the PhotoMap Walking Skeleton: the thinnest full-stack vertical slice that proves the entire core data path works end to end — country map renders → click a country → upload a photo through the real ingest pipeline → it persists in Mongo + on disk → it shows in that country's gallery/lightbox. This plan scaffolds `client/` and `server/` cleanly (no root Vite scaffold), establishes the StorageAdapter, the country-keyed Photo schema, EXIF stripping, HEIC conversion, and magic-byte validation — all the non-retrofittable foundations later phases build on.

Purpose: Establish the architectural backbone recorded in SKELETON.md and deliver the visible core of PhotoMap as a single local user.
Output: Working `client/` + `server/` apps, the full upload→view path, and the schema/storage/security patterns reused by Phases 2-4.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/01-country-map-photos/SKELETON.md
@.planning/phases/01-country-map-photos/01-CONTEXT.md
@.planning/phases/01-country-map-photos/01-RESEARCH.md
@.planning/phases/01-country-map-photos/01-UI-SPEC.md
@CLAUDE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Scaffold client + server, Mongo connection, Tailwind, dev proxy</name>
  <files>server/package.json, server/.env.example, server/src/config.js, server/src/db.js, server/src/app.js, server/src/server.js, client/package.json, client/vite.config.js, client/index.html, client/src/main.jsx, client/src/App.jsx, client/src/index.css, .gitignore</files>
  <read_first>
    - .planning/phases/01-country-map-photos/01-RESEARCH.md — "Recommended Project Structure", Pattern 8 (Vite proxy), Open Question 3 (ESM backend), Environment Availability (MONGODB_URI)
    - .planning/phases/01-country-map-photos/01-UI-SPEC.md — "Tailwind Configuration" (v4 @theme tokens in index.css), font stack
    - CLAUDE.md — fixed stack versions and the "What NOT to Use" table
  </read_first>
  <action>
    Create two npm packages: `server/` and `client/`. Do NOT run `npm create vite` in the repo root — scaffold only into `client/`. A previous root scaffold caused problems; keep the root free of `package.json`, `node_modules`, `vite.config.js`, and `src/`.

    Server (`server/package.json`): set `"type": "module"` (ESM, per RESEARCH Open Question 3 — needed for file-type v22). Dependencies: express ^5.2.1, mongoose ^9.7.1, multer ^2.2.0, sharp ^0.34.5 (pin per CLAUDE.md), heic-convert ^2.1.0, file-type ^22.0.1, cors ^2.8.6, dotenv ^17.4.2. Dev: nodemon. Scripts: `dev` (nodemon src/server.js), `start` (node src/server.js), `test` (node --test test/). Use Node's built-in `node --test` runner — do not add a third-party test framework.

    `server/src/config.js`: load dotenv, read and validate `MONGODB_URI` (throw a clear startup error if missing), `PORT` (default 3001), `STORAGE_PATH` (default `./uploads`), `MAX_FILE_BYTES` (default 26214400 = 25 MB), `MAX_FILES_PER_BATCH` (default 50). Export a frozen config object.
    `server/src/db.js`: export `connectDb()` that calls `mongoose.connect(config.MONGODB_URI)` and logs success/failure.
    `server/src/app.js`: Express app factory (no listen). Enable `cors()` for the dev origin, `express.json()`. Mount routers from Task 4/5 under `/api/photos` and `/api/countries` (import them; they are created in later tasks — leave the imports + `app.use` lines so wiring exists). Add a 404 + error-handling middleware that returns JSON `{ error }`.
    `server/src/server.js`: import app + connectDb + config; `await connectDb()` then `app.listen(config.PORT)`.
    `server/.env.example`: document `MONGODB_URI=`, `PORT=3001`, `STORAGE_PATH=./uploads`, `MAX_FILE_BYTES=26214400`, `MAX_FILES_PER_BATCH=50`.

    Client: scaffold Vite 8 React 19 app into `client/`. Dependencies: react ^19.2.7, react-dom ^19.2.7, leaflet ^1.9.4, react-leaflet ^5.0.0, @tanstack/react-query ^5.101.0, @tanstack/react-query-devtools ^5.x, yet-another-react-lightbox ^3.32.0, react-photo-album ^3.6.0. Dev: vite ^8.0.16, @vitejs/plugin-react ^6.x, tailwindcss ^4.x, @tailwindcss/vite ^4.x. Register `@tailwindcss/vite` and `@vitejs/plugin-react` in `client/vite.config.js`, and add the `server.proxy` block routing `/api` → `http://localhost:3001` (RESEARCH Pattern 8).
    `client/src/index.css`: `@import "tailwindcss";` plus the exact `@theme` block from UI-SPEC "Tailwind Configuration" (v4) — colors (bg, surface, accent, accent-dark, accent-subtle, border, text, text-muted, destructive, overlay), the four `--text-*` type tokens with line-heights, and the `--font-sans` stack. Import `leaflet/dist/leaflet.css` and `yet-another-react-lightbox/styles.css`, and add the `.yarl__backdrop { background: rgba(0,0,0,0.4); }` override from UI-SPEC.
    `client/src/main.jsx`: wrap `<App/>` in a TanStack `QueryClientProvider`; import `./index.css`.
    `client/src/App.jsx`: minimal placeholder rendering `<WorldMap/>` (component created in Task 6) — leave the import so wiring exists.
    Append `node_modules/`, `server/uploads/`, and `dist/` to the root `.gitignore` (keep existing `.env`, `.claude`, `.planning`, `CLAUDE.md` entries).
  </action>
  <verify>
    <automated>cd server && npm install && node -e "import('./src/config.js').catch(e=>{if(/MONGODB_URI/.test(e.message)){console.log('config-validates');process.exit(0)}process.exit(1)})"</automated>
    <automated>cd client && npm install && npx vite build</automated>
  </verify>
  <done>`server` and `client` packages install; server config throws a clear error when MONGODB_URI is absent; `vite build` succeeds; root has no Vite scaffold; Tailwind theme tokens compile.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: StorageAdapter, Photo model, isoCode util, and the ingest pipeline</name>
  <files>server/src/utils/isoCode.js, server/src/services/storage/StorageAdapter.js, server/src/services/storage/LocalDiskStorage.js, server/src/services/storage/index.js, server/src/models/Photo.js, server/src/services/ingest.js, server/test/ingest.test.js</files>
  <read_first>
    - .planning/phases/01-country-map-photos/01-RESEARCH.md — Pattern 2 (ingest), Pattern 3 (extractIso), Pattern 5 (StorageAdapter), Pattern 6 (Photo schema), Anti-Patterns list
    - .planning/phases/01-country-map-photos/01-CONTEXT.md — D-06 (StorageAdapter, EXIF strip), D-07 (ISO country key)
  </read_first>
  <behavior>
    - ingestPhoto(jpegBuffer, 'image/jpeg', 'US') returns { thumbBuffer, displayBuffer }, both valid JPEGs.
    - The returned thumbBuffer width is <= 300px; displayBuffer width is <= 1200px.
    - sharp metadata on the returned buffers contains NO `exif` and NO GPS block (EXIF stripped per D-06).
    - extractIso returns 'FR' for a feature whose properties have ISO_A2 '-99' but ISO_A2_EH 'FR' (Pitfall 1).
    - extractIso returns 'US' for a normal feature with ISO_A2 'US'.
    - LocalDiskStorage.put(key, buf) writes the file under basePath; getLocalPath(key) returns the joined path; getUrl(key) returns `/api/photos/file/<encoded key>`.
  </behavior>
  <action>
    `utils/isoCode.js`: implement `extractIso(feature)` with the ISO_A2 → ISO_A2_EH → ISO_A3(slice 0,2) → NAME-slug fallback chain (RESEARCH Pattern 3), uppercasing results and treating `'-99'` as absent (per D-07; fixes France/Norway, Pitfall 1).
    `services/storage/StorageAdapter.js`: JSDoc typedef describing the adapter interface (`put`, `getLocalPath`, `getUrl`, `delete`) so Phase-2/v2 implementations match (per D-06; PHOTO-05).
    `services/storage/LocalDiskStorage.js`: `class LocalDiskStorage` with constructor(basePath); `put` creates parent dirs and writes the buffer; `getLocalPath`; async `getUrl` returning the `/api/photos/file/` URL; async `delete`. Keys are UUID-derived only — never user-controlled paths (threat T-01-PT).
    `services/storage/index.js`: instantiate and export a singleton `storage = new LocalDiskStorage(config.STORAGE_PATH)`.
    `models/Photo.js`: Mongoose schema exactly per RESEARCH Pattern 6 — `countryCode` (required, uppercase, trim, indexed), reserved nullable `userId` (Phase 2), reserved `location` GeoJSON Point + `geocodeStatus` (Phase 3, no `2dsphere` index yet), `storageKey`, `thumbnailKey`, `mimeType`, `originalFilename`, `fileSize`, `countryName`, `timestamps`. Add the `{ countryCode: 1, createdAt: -1 }` compound index. Never store binary data (PHOTO-05).
    `services/ingest.js`: `export async function ingestPhoto(inputBuffer, mimeType, countryCode)` per RESEARCH Pattern 2 — if mime is heic/heif, run `heic-convert` to JPEG first (D-05, PHOTO-03; sharp prebuilt has no HEIC, Pitfall 2); then produce thumbBuffer (`sharp().autoOrient().resize(300,null,{withoutEnlargement:true}).jpeg({quality:80}).withMetadata(false)`) and displayBuffer (1200px, quality 88, `withMetadata(false)`). `autoOrient()` must run before resize; `withMetadata(false)` is mandatory on both — it is the EXIF/GPS strip required by D-06 / PHOTO-02 (never `withMetadata(true)`).
    Write `test/ingest.test.js` using `node --test`: generate a small in-memory test JPEG with sharp (e.g. a solid-color image with `.withExif()` to embed fake EXIF), run ingestPhoto, and assert the behavior cases above (dimensions, no EXIF in output, JPEG format). Add extractIso cases for the `-99`/`FR` and normal `US` features, and a LocalDiskStorage put/getUrl round-trip against a temp dir.
  </action>
  <verify>
    <automated>cd server && node --test test/ingest.test.js</automated>
  </verify>
  <done>All ingest/isoCode/storage tests pass; output buffers carry no EXIF; extractIso resolves France via ISO_A2_EH; LocalDiskStorage round-trips to a temp dir.</done>
</task>

<task type="auto">
  <name>Task 3: Upload middleware + API routes (photos upload/list/serve, country counts)</name>
  <files>server/src/middleware/upload.js, server/src/routes/photos.js, server/src/routes/countries.js</files>
  <read_first>
    - .planning/phases/01-country-map-photos/01-RESEARCH.md — "multer Upload Route" example, Pattern 4 (file-type ESM dynamic import), Pattern 7 (photo-counts aggregation), Security Domain table
    - .planning/phases/01-country-map-photos/01-UI-SPEC.md — Copywriting Contract (upload error messages), Tile/serve URL shape
  </read_first>
  <action>
    `middleware/upload.js`: configure multer v2 `diskStorage` writing to `config.STORAGE_PATH + '/tmp'` with UUID filenames (never the original name — path-traversal mitigation, T-01-PT); `limits.fileSize = config.MAX_FILE_BYTES` (25 MB) and `limits.files = config.MAX_FILES_PER_BATCH` (50) — DoS mitigation, T-01-DOS. Export `validateMagicBytes(buffer)` using `const { fileTypeFromBuffer } = await import('file-type')` (ESM-only, Pattern 4); allow only image/jpeg, image/png, image/webp, image/heic, image/heif; throw a clear error otherwise (T-01-MAL). Reject SVG/executables implicitly (not in allowlist).
    `routes/photos.js`: Express router.
      - `POST /api/photos` with `upload.array('photos', config.MAX_FILES_PER_BATCH)`: require `countryCode` in body (400 if absent); for each file read its bytes, run `validateMagicBytes` (on failure unlink the tmp file and record a per-file error — never throw the whole batch), call `ingestPhoto`, write display+thumb buffers via `storage.put` under UUID keys (`<id>-display.jpg`, `<id>-thumb.jpg`), unlink the tmp file, `Photo.create({...})` with uppercased countryCode + countryName from body. Respond 201 with `{ uploaded, results }` where results carry photoId/thumbnailUrl or per-file error. (PHOTO-01, PHOTO-04)
      - `GET /api/photos?countryCode=XX`: `Photo.find({ countryCode })` sorted by createdAt desc; return id, storageKey, thumbnailKey, originalFilename. (PHOTO-06)
      - `GET /api/photos/file/:key`: resolve via `storage.getLocalPath`, guard that the resolved path stays within STORAGE_PATH (path-traversal block, T-01-PT), stream the file with the correct content-type. Served files are already EXIF-stripped by ingest. (PHOTO-02 serve)
    `routes/countries.js`: `GET /api/countries/photo-counts` — `Photo.aggregate([{ $group: { _id: '$countryCode', count: { $sum: 1 } } }, { $project: { _id:0, countryCode:'$_id', count:1 } }])`, return as an object map `{ "US": 12, ... }` (RESEARCH Pattern 7; feeds CMAP-04 in Plan 02). Leave a code comment that Phase 2 adds `{ $match: { userId } }` here.
    Confirm `app.js` (Task 1) mounts both routers.
  </action>
  <verify>
    <automated>cd server && node --check src/routes/photos.js && node --check src/routes/countries.js && node --check src/middleware/upload.js</automated>
    <human-check>With MONGODB_URI set and `npm run dev` running: `curl -F countryCode=US -F photos=@&lt;a-test.jpg&gt; http://localhost:3001/api/photos` returns 201; `curl 'http://localhost:3001/api/photos?countryCode=US'` lists it; opening the returned file URL shows the image with no EXIF (verify with `exiftool` or an online EXIF viewer).</human-check>
  </verify>
  <done>Routes parse and mount; a real upload round-trips (201 → list → file serve); invalid-magic-byte and oversized files are rejected; served files carry no EXIF.</done>
</task>

<task type="auto">
  <name>Task 4: Frontend slice — map renders countries, click selects, upload + gallery wired to API</name>
  <files>client/public/countries.geojson, client/src/api/photos.js, client/src/api/countries.js, client/src/components/WorldMap.jsx, client/src/components/CountryLayer.jsx, client/src/components/CountrySidebar.jsx, client/src/components/PhotoUploadForm.jsx, client/src/components/PhotoGallery.jsx, client/src/App.jsx</files>
  <read_first>
    - .planning/phases/01-country-map-photos/01-RESEARCH.md — Pattern 1 (CountryLayer hover/click + useRef), "MapContainer Setup with GeoJSON and Stadia Tiles", "Yet Another React Lightbox Gallery", Pitfalls 3/5/7
    - .planning/phases/01-country-map-photos/01-UI-SPEC.md — Layout (panel 360px desktop / 55dvh mobile), Country Panel, Upload Zone, Photo Gallery Grid, Lightbox, Map Interaction Contract, Copywriting Contract, Map layer color table
  </read_first>
  <action>
    Add `client/public/countries.geojson`: download Natural Earth 110m `ne_110m_admin_0_countries.geojson` (public domain, ~820 KB) into `client/public/` as a static asset — do NOT import it as a JS module (Pitfall 7). If network fetch during execution is unavailable, fetch from the nvkelso/natural-earth-vector raw GitHub URL in RESEARCH "GeoJSON Data Source Details".
    `api/countries.js`: TanStack `useQuery(['photo-counts'])` → `GET /api/countries/photo-counts`, returning a `Map<isoCode, count>` (used heavily in Plan 02; wire it now).
    `api/photos.js`: `useQuery(['photos', countryCode])` → `GET /api/photos?countryCode=`; `useMutation` that POSTs multipart FormData (field `photos[]` + countryCode + countryName) to `/api/photos` and invalidates `['photos', cc]` and `['photo-counts']` on success.
    `components/WorldMap.jsx`: `MapContainer` center `[20,0]`, zoom 2, minZoom 2, maxZoom 6, `worldCopyJump`, `h-dvh w-full`; `TileLayer` url from `import.meta.env.VITE_TILE_URL` (default Stadia alidade_smooth) + the exact attribution string from UI-SPEC (CMAP-05). Fetch `/countries.geojson` once on mount into state. Render `<CountryLayer>` with a `key` derived from the photoCounts map (forces re-mount when counts change — Pitfall 3). Hold `selectedCountry` state; render `<CountrySidebar>` only when a country is selected (panel absent otherwise, per UI-SPEC).
    `components/CountryLayer.jsx`: `<GeoJSON>` per RESEARCH Pattern 1 — `styleCountry(feature)` using `extractIso`-equivalent client logic (replicate the same ISO fallback inline or as a small client util) and the exact Map-layer color table from UI-SPEC (default no-photos vs has-photos fills/opacities). `onEachFeature` attaches imperative `mouseover`/`mouseout`/`click` handlers via `layer.setStyle()` and `useRef` for hovered/selected layers (Pitfall 5 stale-closure fix); click calls `onCountryClick(code, NAME)`. Add `tabIndex` + Enter/Space handling for keyboard reachability (UI-SPEC Accessibility). NOTE: hover-highlight visual polish + has-photos marking is finalized in Plan 02; this task wires click→select and the base style function.
    `components/CountrySidebar.jsx`: fixed right panel 360px desktop / bottom 55dvh mobile (Tailwind `md:` breakpoint), `bg-surface`, border, shadow, z-index 500 per UI-SPEC. Header shows country name (`text-heading`, truncate) + a "Close" button (44px touch target) that deselects. Renders `<PhotoUploadForm>` then `<PhotoGallery>`.
    `components/PhotoUploadForm.jsx`: hidden `<input type="file" multiple accept="image/jpeg,image/png,image/webp,.heic,.heif">` wrapped in a `<label aria-label="Upload photos for {country}">`; "Add Photos" CTA button (accent bg, accent-dark hover, 44px min height) per UI-SPEC Upload button spec + Copywriting ("Add Photos" / "Uploading..."). On select, call the upload mutation. NOTE: drag-active state, multi-error toasts, and full error copy land in Plan 02 — here the happy-path single/basic upload must work.
    `components/PhotoGallery.jsx`: 3-col grid (`grid-cols-3 gap-1`), 1:1 thumbnails (`aspect-square object-cover`, 4px radius) sourced from `/api/photos/file/<thumbnailKey>`; clicking opens `yet-another-react-lightbox` with display-size slides (`/api/photos/file/<storageKey>`), zoom + thumbnails strip disabled per UI-SPEC. Empty state "No photos yet" when zero (PHOTO-06).
    `App.jsx`: render `<WorldMap/>` full-bleed.
  </action>
  <verify>
    <automated>cd client && npx vite build</automated>
    <human-check>`npm run dev` in client + server (MONGODB_URI set): map shows country borders over tiles; clicking France/Norway opens the panel (ISO -99 handled); "Add Photos" uploads a JPEG and its thumbnail appears in the gallery without refresh; clicking a thumbnail opens the lightbox.</human-check>
  </verify>
  <done>Client builds; the full skeleton path works in the browser — map → click country → upload → thumbnail in gallery → lightbox — with no page refresh; France/Norway are selectable.</done>
</task>

<task type="auto">
  <name>Task 5: End-to-end skeleton test + local-run documentation</name>
  <files>server/test/skeleton.e2e.test.js</files>
  <read_first>
    - .planning/phases/01-country-map-photos/SKELETON.md — "Capability Proven End-to-End", "Stack Touched in Phase 1"
    - .planning/phases/01-country-map-photos/01-RESEARCH.md — Environment Availability (MongoDB), Pattern 7
  </read_first>
  <action>
    Write `server/test/skeleton.e2e.test.js` using `node --test` + the app factory: spin up the Express app against a test database (use `MONGODB_URI` from env; skip the test with a clear message if unset rather than failing CI). Exercise the real path with supertest-style requests via `app`:
      1. POST `/api/photos` with a generated in-memory JPEG buffer (built with sharp) and `countryCode=US` → expect 201 and a returned photoId + thumbnailUrl.
      2. GET `/api/photos?countryCode=US` → the uploaded photo appears.
      3. GET the returned file URL → 200 with an image content-type.
      4. GET `/api/countries/photo-counts` → `{ US: >=1 }`.
      5. Assert the persisted Mongo document has NO binary image field (only storageKey/thumbnailKey) — proves PHOTO-05.
      6. Negative: POST a non-image buffer (e.g. a text buffer) → that file is rejected in `results` with an error (proves PHOTO-04 magic-byte check).
    Clean up created photos + files after the run. Add a short "Local run" section to `server/.env.example` header comment OR a `README` note describing: set MONGODB_URI, `cd server && npm run dev`, `cd client && npm run dev`, open http://localhost:5173.
  </action>
  <verify>
    <automated>cd server && node --test test/skeleton.e2e.test.js</automated>
  </verify>
  <done>The e2e test passes (or self-skips with a clear message when MONGODB_URI is unset); it proves upload→list→serve→count and that no binary is stored in Mongo, plus the magic-byte rejection path.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking-human">
  <name>Task 6: Package legitimacy + skeleton sign-off</name>
  <what-built>
    The full Walking Skeleton: client + server scaffold, Mongo-backed upload→view path, StorageAdapter, EXIF-stripping HEIC-capable ingest, magic-byte validation, country map with click-to-select, gallery + lightbox.
  </what-built>
  <how-to-verify>
    1. Package legitimacy (RESEARCH "Package Legitimacy Audit" lists all as OK/Approved — confirm no SLOP/SUS was substituted during install). Spot-check that installed versions match: `react-leaflet@5`, `multer@^2.2`, `sharp@^0.34`, `heic-convert`, `file-type@^22`, `yet-another-react-lightbox`. Confirm none were swapped for typosquats (verify on npmjs.com if any version looks unexpected).
    2. With `MONGODB_URI` set, run `cd server && npm run dev` and `cd client && npm run dev`. Open http://localhost:5173.
    3. Confirm: country borders render over tiles; hovering/clicking a country (try France and Norway) opens the panel; uploading a JPEG and a HEIC (if available) both succeed; thumbnails appear; the lightbox opens; the served file has no EXIF (check with an EXIF viewer).
    4. Confirm a `.txt` renamed to `.jpg` is rejected.
  </how-to-verify>
  <resume-signal>Type "approved" to finalize the skeleton, or describe issues to fix.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → Express API | Untrusted multipart file uploads and query params cross here |
| Express API → Disk (StorageAdapter) | File writes/reads keyed by server-generated UUIDs |
| Express API → MongoDB | Metadata writes; binary data must never cross |
| Served image files → Browser | Files must be EXIF/GPS-free before they reach any client |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-MAL | Tampering | POST /api/photos upload | mitigate | Magic-byte validation via file-type allowlist (jpeg/png/webp/heic/heif); sharp re-encode destroys embedded payloads; SVG/executables not in allowlist (Task 3) |
| T-01-EXIF | Information Disclosure | ingest.js served files | mitigate | `sharp().autoOrient().withMetadata(false)` strips all EXIF incl. GPS on both thumb and display copies (Task 2); enforced before any serve |
| T-01-DOS | Denial of Service | multer upload limits | mitigate | `limits.fileSize=25MB`, `limits.files=50` (Task 3, config-driven) |
| T-01-PT | Tampering | file serving + storage keys | mitigate | UUID-only storage keys (never original/user paths); `GET /file/:key` resolves and asserts the path stays within STORAGE_PATH (Task 3) |
| T-01-INJ | Tampering | countryCode input | mitigate | Mongoose schema `uppercase:true`+`trim` + required validation; aggregation uses `$group` not string-built queries (Task 2/3) |
| T-01-BIN | Information Disclosure / scale | MongoDB photos collection | mitigate | StorageAdapter stores binaries on disk; schema holds only keys/metadata; e2e test asserts no binary field (Task 2/5) |
| T-01-SC | Tampering | npm installs | mitigate | RESEARCH Package Legitimacy Audit (all OK/Approved); blocking human checkpoint (Task 6) confirms no typosquat substitution |
</threat_model>

<verification>
- `cd server && node --test` passes all unit + e2e tests (ingest EXIF strip, isoCode, storage round-trip, upload→list→serve→count, magic-byte rejection, no-binary-in-Mongo).
- `cd client && npx vite build` succeeds.
- Manual: full map → click → upload → gallery → lightbox path works; France/Norway selectable; served files EXIF-free; non-image rejected.
- Root directory contains no Vite scaffold (only `client/` and `server/` packages).
</verification>

<success_criteria>
- The Walking Skeleton capability in SKELETON.md is demonstrable end-to-end as a single local user.
- CMAP-01 (boundaries render), CMAP-03 (click to select), CMAP-05 (env tile provider), PHOTO-01 (upload), PHOTO-02 (thumbnail + EXIF strip), PHOTO-03 (HEIC→JPEG), PHOTO-04 (magic-byte + size validation), PHOTO-05 (StorageAdapter, no Mongo binaries), PHOTO-06 (gallery/lightbox) are all satisfied.
- Schema reserves userId (Phase 2) and location/geocodeStatus (Phase 3) without rework.
</success_criteria>

<output>
Create `.planning/phases/01-country-map-photos/01-01-SUMMARY.md` when done.
</output>
