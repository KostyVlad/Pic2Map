# Stack Research

**Domain:** Personal photo travel-map web application (MERN)
**Researched:** 2026-06-17
**Confidence:** HIGH (core stack), MEDIUM (tile provider strategy, reverse geocoding caching)

---

## Recommended Stack

### Core Technologies (Fixed — MERN)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| MongoDB | 8.x (Atlas or local) | Document store for users, photos, pin locations | Flexible schema fits mixed GPS/manual photo records; geospatial indexing (`2dsphere`) is first-class |
| Mongoose | ^9.7 | ODM for MongoDB | Latest major (Nov 2025 release); v9 aligns with MongoDB 8; handles schema validation, geospatial queries |
| Express | ^5.x | HTTP API server | Stable, minimal, well-understood; pairs naturally with Mongoose middleware |
| Node.js | >=20.3.0 LTS | Runtime | Required minimum by `sharp` ^0.34; Node 20 is LTS through 2026 |
| React | ^19.x | Frontend UI | react-leaflet v5 requires React 19 as a peer dependency; React 19 is stable (multiple patch releases) |
| Vite | ^8.x | Frontend build tooling | Current stable is 8.0.x (June 2026); fastest dev server, native ESM; replaces CRA entirely |

---

### EXIF / GPS Metadata Extraction

**Recommendation: `exifr` v7.1.3**

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| exifr | ^7.1.3 | Server-side GPS coordinate extraction from uploaded photos | HIGH |

**Rationale:** `exifr` is the de facto standard for JS/Node EXIF reading. It provides a dedicated `exifr.gps(file)` method that parses only the GPS SubIFD block — extracting just latitude/longitude in one call without reading the full EXIF tree. It converts DMS (degrees/minutes/seconds) to decimal degrees automatically. Accepts `Buffer` directly, so it integrates cleanly after `multer` reads the upload into memory or disk. Version 7.1.3 (August 2021) is stable and unchanged since; the library is mature, not abandoned.

**Why not `exif-parser`:** Older, lower-level, requires more manual coordinate conversion. `exifr` is strictly superior for this use case.

**Why not `sharp` for EXIF:** `sharp`'s `.metadata()` does expose GPS data, but it is less reliable across camera manufacturers; `exifr` was purpose-built for EXIF and handles edge cases (malformed GPS blocks, different byte orders) better. Use `sharp` only for resizing/thumbnails, not EXIF extraction.

---

### Interactive Map

**Recommendation: `leaflet` + `react-leaflet` v5 + `react-leaflet-cluster`**

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| leaflet | ^1.9.x | Core map engine | HIGH |
| react-leaflet | ^5.0.0 | React bindings for Leaflet | HIGH |
| react-leaflet-cluster | latest (React 19 / RL5 branch) | Marker clustering | MEDIUM |

**Rationale:** react-leaflet v5 (December 2024) requires React 19 as a peer dependency — this matches the recommended React version. Leaflet itself is the most battle-tested open-source map library; no API key required, no per-tile cost for standard use, and it has the deepest React integration story.

**MapLibre GL / Mapbox GL JS:** MapLibre is the correct alternative when vector tiles and GPU-accelerated rendering matter (3D buildings, smooth rotation). For a photo-pin map with clustering it is overkill, adds bundle weight (~2MB vs ~150KB for Leaflet), and MapLibre's React bindings (`react-map-gl`) are more complex to set up.

**Tile Provider — OpenStreetMap default tiles:**
- URL pattern: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`
- OSM usage policy: max 1 request per second per application, normal interactive human use only, attribution required. Suitable for a personal app with low concurrent users.
- For production with many users: switch to **Stadia Maps** (free tier: 200K tile requests/month) or **Maptiler** (free tier: 100K requests/month). Both support Leaflet out of the box.
- Do NOT use Mapbox tiles on Leaflet for free — Mapbox requires its own SDK (Mapbox GL JS) and paid API key above minimal thresholds.

**Clustering — `react-leaflet-cluster`:**
- Wraps `Leaflet.markercluster`; the repo (akursat/react-leaflet-cluster) has been updated with React 19 and react-leaflet 5 peer dependencies.
- CSS must be imported manually (the package no longer auto-imports to avoid Next.js build conflicts).
- Alternative: `use-supercluster` hook + manual rendering — more control, but significantly more boilerplate. Use only if you need custom cluster shapes beyond what `react-leaflet-cluster` provides.

---

### Reverse Geocoding (coordinates → place name)

**Recommendation: Nominatim public API with server-side caching**

| Service | Cost | Rate Limit | Confidence |
|---------|------|------------|------------|
| nominatim.openstreetmap.org | Free | 1 req/sec max, per application | HIGH |

**Rationale:** Nominatim is the OSM-backed geocoding engine — no API key, no billing, attribution required. The 1-req/sec limit is NOT per user but per application total. For a personal app this is fine IF reverse geocoding is done on upload (server-side, once per photo) and the result is persisted in MongoDB on the Photo document. Never call Nominatim on every map load or on every page render.

**Implementation pattern:**
1. After upload + EXIF GPS extraction, make one Nominatim call: `https://nominatim.openstreetmap.org/reverse?lat=...&lon=...&format=json`
2. Persist `city`, `country`, `display_name` fields on the Photo document.
3. All subsequent reads use the stored place name — Nominatim is never called again for that photo.

**This means the 1-req/sec limit is a non-issue for typical personal use** (uploads happen sequentially, not in parallel bursts). Add a 1-second delay between uploads if batch-uploading multiple photos.

**Self-hosted Nominatim:** Requires a full OSM planet import (~800 GB disk, ~64 GB RAM for fast queries). Completely out of scope for a personal project.

**Google Maps Geocoding API / HERE / Mapbox:** All paid beyond minimal free tiers and require API keys. Unnecessary given the usage pattern above.

---

### Photo Storage and Serving

**Recommendation: Local disk storage (development and small personal deployments) with `sharp` for thumbnails**

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| multer | ^2.2.0 | Multipart file upload middleware | HIGH |
| sharp | ^0.34.5 | Thumbnail generation, image resizing | HIGH |

**Storage strategy:**
- Store uploaded files on disk under a structured path (e.g., `uploads/<userId>/<photoId>.<ext>`).
- On upload, generate two derivatives with `sharp`: a thumbnail (~300px wide) and a display size (~1200px wide).
- Serve via Express `express.static` or a dedicated `/api/photos/:id/thumb` route that streams from disk.
- Store only the file paths in MongoDB, never the binary data.

**Why NOT GridFS / MongoDB binary storage:**
MongoDB has a 16 MB document limit, and GridFS (chunked binary storage in MongoDB) adds complexity and query overhead without any benefit over filesystem storage. Reading images back from GridFS is slower than `fs.createReadStream`. Keeping binaries on disk keeps MongoDB lean and photo serving fast.

**Cloudinary (managed object storage):**
- Free tier: 25 GB storage + 25 GB bandwidth/month (June 2026 pricing).
- Pros: built-in CDN, automatic transformations, no server disk needed.
- Cons: vendor lock-in, network round-trip on upload, free tier is consumed quickly with raw photos (JPEG from modern phones = 4–8 MB each, ~3,000–6,000 photos until free tier is exhausted).
- **Recommendation:** Start with local disk. Add Cloudinary/S3 in a later milestone when the app is deployed and storage pressure is real. The `multer` disk storage API makes migration straightforward — swap the storage engine, keep the rest of the route unchanged.

**sharp v0.34.5** is the current stable (November 2025). Requires Node >=18.17.0 or >=20.3.0. v0.35.x is in RC as of June 2026 — pin to `^0.34.5` for stability.

---

### Authentication

**Recommendation: `jose` (JWT) + `argon2` (password hashing)**

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| jose | ^6.x | JWT creation, signing, verification | HIGH |
| argon2 | ^0.31+ | Password hashing (argon2id) | HIGH |

**JWT approach (stateless):**
- Issue a signed JWT on login; client stores it in an `httpOnly` cookie (not `localStorage`).
- Verify JWT on each protected API request via Express middleware.
- Stateless = no session store required; fits a simple MERN backend well.

**Why `jose` over `jsonwebtoken`:**
`jsonwebtoken` v9.0.3 (Dec 2025) is Node.js-only, synchronous for many operations, and has lower weekly downloads (42M) than `jose` (76M, June 2026). `jose` uses the Web Crypto API, is runtime-agnostic (works on edge, Deno, Bun if ever needed), and is the modern standard. For RS256 or ES256 keys it is strictly better. For this app's scope HS256 (shared secret) works fine, and `jose` handles it cleanly.

**Why `argon2` over `bcrypt`/`bcryptjs`:**
- Argon2 won the Password Hashing Competition; argon2id (the hybrid variant) is the OWASP recommendation as of 2025.
- `@node-rs/argon2` is the fastest Node.js binding (Rust-backed, no `node-gyp`, Apple M1 native). Use this variant if build simplicity matters; the plain `argon2` package requires native compilation.
- `bcrypt` has 3.6x more weekly downloads — it is not wrong to use bcrypt, but for a new project argon2id is the better choice.
- Never use `bcryptjs` (pure-JS bcrypt) — it is significantly slower than the native `bcrypt` or any argon2 binding.

**Data isolation:** Every MongoDB query for photos, pins, or map data must include a `userId` filter scoped to `req.user.id` extracted from the verified JWT. This is the primary security control for per-user isolation.

**Passport.js:** Unnecessary for this scope. Passport adds abstraction and configuration overhead that is only worthwhile when supporting multiple OAuth strategies. A single custom JWT middleware (50 lines) is clearer and easier to audit.

---

### File Upload Handling

**Recommendation: `multer` v2.2.0 with `diskStorage`**

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| multer | ^2.2.0 | Multipart/form-data upload middleware | HIGH |

**Why v2.x is required:** multer <2.0.0 has two active DoS CVEs (CVE-2025-47944, CVE-2025-7338) related to unclosed streams and memory leaks. Version 2.2.0 (June 2026, last published 2 days before research date) patches all known vulnerabilities. Always use `^2.2.0` or later.

**Storage configuration:** Use `diskStorage` with a destination that includes the `userId` from the JWT:

```javascript
// Example pattern — destination scoped to user
destination: (req, file, cb) => {
  const dir = path.join('uploads', req.user.id);
  fs.mkdirSync(dir, { recursive: true });
  cb(null, dir);
}
```

**File type validation:** Always validate MIME type (`image/jpeg`, `image/png`, `image/heic`, `image/heif`) AND extension in the `fileFilter` callback. Reject everything else.

**Memory storage:** Do NOT use `memoryStorage` for photo uploads. A single 8 MB RAW phone photo held in RAM for each concurrent upload will exhaust Node heap quickly. Always write to disk first, then pipe to `sharp` for thumbnail generation.

---

### Frontend Build and Data Fetching

**Recommendation: Vite ^8.x + React ^19 + TanStack Query v5**

| Tool | Version | Purpose | Confidence |
|------|---------|---------|------------|
| Vite | ^8.0 | Build tool, dev server | HIGH |
| React | ^19.x | UI framework | HIGH |
| @tanstack/react-query | ^5.101 | Server state, data fetching, caching | HIGH |
| @tanstack/react-query-devtools | ^5.x | Dev-time query inspection | HIGH |

**Vite 8:** Current stable (June 2026). Replaces Create React App completely; faster HMR, native ESM, smaller prod bundles. Use `npm create vite@latest` to scaffold.

**TanStack Query v5:** Latest is 5.101.0 (June 2026). Handles all async server-state concerns — loading states, error states, background refetch, optimistic updates for photo upload. The `useMutation` hook is the right tool for upload flows. Avoids prop-drilling and manual `useEffect` data-fetching anti-patterns.

**State management beyond TanStack Query:** No Redux, no Zustand needed for v1. Map UI state (selected pin, zoom level) lives in `useState`/`useReducer` within the map component. TanStack Query handles all server-origin state.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| EXIF extraction | exifr | sharp metadata | sharp.metadata() GPS support is inconsistent across camera vendors; exifr is purpose-built |
| EXIF extraction | exifr | exif-parser | More manual coordinate math; less actively maintained |
| Map library | react-leaflet 5 | react-map-gl + MapLibre | Vector tile rendering is overkill; larger bundle; more complex setup |
| Map clustering | react-leaflet-cluster | use-supercluster | More boilerplate for same result in standard use |
| JWT library | jose | jsonwebtoken | jsonwebtoken is Node-only, lower modern adoption, no Web Crypto |
| Password hashing | argon2 | bcrypt | argon2id is OWASP-recommended for new projects |
| Password hashing | argon2 | bcryptjs | Pure-JS, significantly slower |
| File upload | multer 2.x | busboy directly | Multer wraps busboy with a cleaner API; no reason to use busboy raw |
| Photo storage | Local disk + sharp | Cloudinary | Free tier exhausted by raw photos; vendor lock-in; premature optimization |
| Photo storage | Local disk + sharp | GridFS (MongoDB) | Slower than filesystem, adds query complexity, hits 16 MB doc limit |
| Auth | Custom JWT middleware | Passport.js | Passport adds config overhead only worthwhile for multi-strategy OAuth |
| Reverse geocoding | Nominatim (cached) | Google Maps Geocoding | Requires paid API key beyond minimal free tier |
| Frontend state | TanStack Query | Redux/Zustand | Overkill for v1; TanStack Query handles all server state needs |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| multer <2.0.0 | Active DoS CVEs (CVE-2025-47944, CVE-2025-7338) — memory leaks, unclosed streams | multer ^2.2.0 |
| bcryptjs | Pure-JS implementation — 5–10x slower than native bcrypt; slower still vs argon2 | argon2 or native bcrypt |
| Storing images in MongoDB documents | 16 MB BSON limit; GridFS adds overhead; slower read than filesystem | Disk storage with path ref in DB |
| Calling Nominatim on every map load | Violates OSM usage policy (1 req/sec/app); creates latency | Call once at upload, persist result |
| Mapbox GL JS tiles on Leaflet | Mapbox tiles require Mapbox SDK + paid key at production volumes | OSM tiles or Stadia/Maptiler free tier |
| localStorage for JWT | XSS-accessible; httpOnly cookies are safer | httpOnly cookie |
| exifr in the browser | GPS extraction should be server-side to control file access and keep processing off client | Run exifr in Node.js after multer receives upload |
| Passport.js | Adds boilerplate for scenarios (OAuth, multiple strategies) not needed in v1 | Custom Express JWT middleware |
| Create React App | Deprecated; extremely slow build tooling | Vite ^8.x |

---

## Installation

```bash
# Backend (Express/Node)
npm install express mongoose multer sharp exifr jose argon2 cors dotenv

# Dev dependencies (backend)
npm install -D nodemon

# Frontend (Vite + React)
npm create vite@latest client -- --template react
cd client

# Map
npm install leaflet react-leaflet react-leaflet-cluster

# Data fetching
npm install @tanstack/react-query @tanstack/react-query-devtools

# Leaflet types (if using TypeScript)
npm install -D @types/leaflet
```

---

## Version Compatibility Notes

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| react-leaflet ^5.0 | react ^19.x | react-leaflet v5 requires React 19 as peer dep — use together |
| react-leaflet-cluster (latest) | react-leaflet ^5.0, @react-leaflet/core >=3.0 | Must import CSS manually |
| sharp ^0.34.5 | Node >=18.17.0 or >=20.3.0 | v0.35.x is RC — pin to 0.34.x |
| multer ^2.2.0 | express ^5.x | v2.x breaks API compatibility with v1 diskStorage configs — review multer v2 migration guide |
| mongoose ^9.7 | MongoDB 8.x | Mongoose 9 is the latest major (Nov 2025 release) |

---

## Sources

- [exifr GitHub — MikeKovarik/exifr](https://github.com/MikeKovarik/exifr) — version, GPS features confirmed
- [react-leaflet GitHub Releases](https://github.com/PaulLeCam/react-leaflet/releases) — v5.0.0 React 19 requirement confirmed
- [react-leaflet-cluster GitHub — akursat/react-leaflet-cluster](https://github.com/akursat/react-leaflet-cluster) — React 19 / RL5 peer deps confirmed
- [Nominatim Usage Policy — OSM Foundation](https://operations.osmfoundation.org/policies/nominatim/) — 1 req/sec rate limit confirmed
- [OSM Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) — acceptable personal use confirmed
- [multer CVE-2025-47944, CVE-2025-7338](https://github.com/expressjs/multer/security/advisories/GHSA-44fp-w29j-9vj5) — DoS vulnerabilities in <2.0.0 confirmed
- [jose vs jsonwebtoken 2026 — PkgPulse](https://www.pkgpulse.com/compare/jose-vs-jsonwebtoken) — download stats, feature comparison
- [sharp npm](https://www.npmjs.com/package/sharp) — v0.34.5 stable, v0.35.0-rc.6 pre-release (June 2026)
- [TanStack Query Releases](https://github.com/tanstack/query/releases) — v5.101.0 current (June 2026)
- [Vite 8.0 announcement](https://vite.dev/blog/announcing-vite8) — Vite 8 current stable confirmed
- [Mongoose compatibility docs](https://mongoosejs.com/docs/compatibility.html) — v9.7 current, MongoDB 8 supported
- [Cloudinary Free Plan limits](https://www.oreateai.com/blog/cloudinarys-free-plan-what-you-get-and-where-the-limits-lie/) — 25 GB storage/bandwidth on free tier

---
*Stack research for: PhotoMap (MERN photo travel-map)*
*Researched: 2026-06-17*
