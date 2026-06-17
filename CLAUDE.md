<!-- GSD:project-start source:PROJECT.md -->

## Project

**PhotoMap**

PhotoMap is a web service for personal travel maps. A user signs up, uploads their
photos, and the service reads GPS coordinates from each photo's EXIF metadata to
automatically drop pins on a world map. Photos without geodata can be placed manually
by clicking the map. Clicking a pin reveals all photos taken in that place. Each user
sees only their own private map.

**Core Value:** Upload a photo → it lands on the world map by itself, in the right place — and the map
of pins with per-place photo viewing feels good to browse. Both the EXIF auto-placement
"magic" and the map/viewing experience are equally essential.

### Constraints

- **Tech stack**: MERN (MongoDB, Express, React, Node) — workspace is set up for MERN.
- **Platform**: Web first (responsive) — mobile app deferred, so no native-only assumptions.
- **Security**: Multi-user with strict data isolation — every photo/map query must be
  scoped to the authenticated user; uploaded files must not leak across accounts.

- **Data**: Photos can be large and numerous — storage and serving strategy must scale
  beyond storing raw binaries inline in documents.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

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

### EXIF / GPS Metadata Extraction

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| exifr | ^7.1.3 | Server-side GPS coordinate extraction from uploaded photos | HIGH |

### Interactive Map

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| leaflet | ^1.9.x | Core map engine | HIGH |
| react-leaflet | ^5.0.0 | React bindings for Leaflet | HIGH |
| react-leaflet-cluster | latest (React 19 / RL5 branch) | Marker clustering | MEDIUM |

- URL pattern: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`
- OSM usage policy: max 1 request per second per application, normal interactive human use only, attribution required. Suitable for a personal app with low concurrent users.
- For production with many users: switch to **Stadia Maps** (free tier: 200K tile requests/month) or **Maptiler** (free tier: 100K requests/month). Both support Leaflet out of the box.
- Do NOT use Mapbox tiles on Leaflet for free — Mapbox requires its own SDK (Mapbox GL JS) and paid API key above minimal thresholds.
- Wraps `Leaflet.markercluster`; the repo (akursat/react-leaflet-cluster) has been updated with React 19 and react-leaflet 5 peer dependencies.
- CSS must be imported manually (the package no longer auto-imports to avoid Next.js build conflicts).
- Alternative: `use-supercluster` hook + manual rendering — more control, but significantly more boilerplate. Use only if you need custom cluster shapes beyond what `react-leaflet-cluster` provides.

### Reverse Geocoding (coordinates → place name)

| Service | Cost | Rate Limit | Confidence |
|---------|------|------------|------------|
| nominatim.openstreetmap.org | Free | 1 req/sec max, per application | HIGH |

### Photo Storage and Serving

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| multer | ^2.2.0 | Multipart file upload middleware | HIGH |
| sharp | ^0.34.5 | Thumbnail generation, image resizing | HIGH |

- Store uploaded files on disk under a structured path (e.g., `uploads/<userId>/<photoId>.<ext>`).
- On upload, generate two derivatives with `sharp`: a thumbnail (~300px wide) and a display size (~1200px wide).
- Serve via Express `express.static` or a dedicated `/api/photos/:id/thumb` route that streams from disk.
- Store only the file paths in MongoDB, never the binary data.
- Free tier: 25 GB storage + 25 GB bandwidth/month (June 2026 pricing).
- Pros: built-in CDN, automatic transformations, no server disk needed.
- Cons: vendor lock-in, network round-trip on upload, free tier is consumed quickly with raw photos (JPEG from modern phones = 4–8 MB each, ~3,000–6,000 photos until free tier is exhausted).
- **Recommendation:** Start with local disk. Add Cloudinary/S3 in a later milestone when the app is deployed and storage pressure is real. The `multer` disk storage API makes migration straightforward — swap the storage engine, keep the rest of the route unchanged.

### Authentication

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| jose | ^6.x | JWT creation, signing, verification | HIGH |
| argon2 | ^0.31+ | Password hashing (argon2id) | HIGH |

- Issue a signed JWT on login; client stores it in an `httpOnly` cookie (not `localStorage`).
- Verify JWT on each protected API request via Express middleware.
- Stateless = no session store required; fits a simple MERN backend well.
- Argon2 won the Password Hashing Competition; argon2id (the hybrid variant) is the OWASP recommendation as of 2025.
- `@node-rs/argon2` is the fastest Node.js binding (Rust-backed, no `node-gyp`, Apple M1 native). Use this variant if build simplicity matters; the plain `argon2` package requires native compilation.
- `bcrypt` has 3.6x more weekly downloads — it is not wrong to use bcrypt, but for a new project argon2id is the better choice.
- Never use `bcryptjs` (pure-JS bcrypt) — it is significantly slower than the native `bcrypt` or any argon2 binding.

### File Upload Handling

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| multer | ^2.2.0 | Multipart/form-data upload middleware | HIGH |

### Frontend Build and Data Fetching

| Tool | Version | Purpose | Confidence |
|------|---------|---------|------------|
| Vite | ^8.0 | Build tool, dev server | HIGH |
| React | ^19.x | UI framework | HIGH |
| @tanstack/react-query | ^5.101 | Server state, data fetching, caching | HIGH |
| @tanstack/react-query-devtools | ^5.x | Dev-time query inspection | HIGH |

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

## Installation

# Backend (Express/Node)

# Dev dependencies (backend)

# Frontend (Vite + React)

# Map

# Data fetching

# Leaflet types (if using TypeScript)

## Version Compatibility Notes

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| react-leaflet ^5.0 | react ^19.x | react-leaflet v5 requires React 19 as peer dep — use together |
| react-leaflet-cluster (latest) | react-leaflet ^5.0, @react-leaflet/core >=3.0 | Must import CSS manually |
| sharp ^0.34.5 | Node >=18.17.0 or >=20.3.0 | v0.35.x is RC — pin to 0.34.x |
| multer ^2.2.0 | express ^5.x | v2.x breaks API compatibility with v1 diskStorage configs — review multer v2 migration guide |
| mongoose ^9.7 | MongoDB 8.x | Mongoose 9 is the latest major (Nov 2025 release) |

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

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
