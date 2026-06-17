# Architecture Patterns

**Domain:** Personal photo travel-map web application (MERN)
**Researched:** 2026-06-17

---

## Recommended Architecture

The system decomposes into five runtime concerns separated by clear boundaries:

```
Browser (React SPA)
  └─ Map UI + Upload UI
        │  REST / multipart HTTP
        ▼
Express API Server (Node.js)
  ├─ Auth routes   (/api/auth/*)
  ├─ Photo routes  (/api/photos/*)
  └─ Map routes    (/api/map/*)
        │                         │
        ▼                         ▼
   MongoDB                  File Storage
  (metadata,               (photo binaries,
   GeoJSON,                 thumbnails)
   indexes)                 [local disk / MinIO / S3]
        │
        ▼
  Reverse-Geocode Cache
  (in-memory or MongoDB
   "places" collection)
```

All routes except `POST /api/auth/register` and `POST /api/auth/login` pass through a JWT verify middleware that attaches `req.userId`. Every MongoDB query and every file-ownership check uses that `userId` — no query touches another user's data.

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Auth Service** (Express routes + Mongoose) | Register/login, issue/verify JWT, store hashed passwords | MongoDB `users` collection; JWT library |
| **Upload & Ingest Pipeline** (Multer + exifr + Sharp) | Receive multipart upload, extract EXIF GPS, generate thumbnail, persist binary to file storage, write Photo document to MongoDB | File Storage, MongoDB `photos`, Geocode Service |
| **Geocode Service** (thin wrapper around Nominatim) | Convert (lat, lng) → place name; cache results | Nominatim API (outbound HTTP); MongoDB `places` or in-memory LRU |
| **Photo API** (Express routes) | CRUD for photo documents scoped to `req.userId`; serve signed/direct URLs for binaries | MongoDB `photos`, File Storage |
| **Map API** (Express routes) | Return clustered or viewport-filtered photo points for a given bbox + zoom; support `$near` proximity lookups | MongoDB `photos` (geospatial queries) |
| **File Storage Adapter** (abstraction layer) | Write/read/delete photo binaries and thumbnails; generate access URLs | Local disk (dev) → MinIO or S3-compatible bucket (prod) |
| **React Map UI** | Render Leaflet map, cluster markers client-side with useSupercluster, fetch data on viewport change | Map API, Photo API |
| **React Upload UI** | File picker + progress, send multipart form, display result on map | Upload & Ingest Pipeline endpoint |

---

## Data Model (MongoDB)

### Collection: `users`

```js
{
  _id: ObjectId,
  email: String,          // unique index
  passwordHash: String,   // bcrypt
  createdAt: Date
}
```

Index: `{ email: 1 }` unique.

---

### Collection: `photos`

```js
{
  _id: ObjectId,
  userId: ObjectId,       // ref users — ALWAYS in every query filter
  storageKey: String,     // path/key in file storage (original)
  thumbnailKey: String,   // path/key for thumbnail
  mimeType: String,
  originalFilename: String,
  fileSize: Number,
  location: {             // GeoJSON Point — null when no GPS and not yet manually placed
    type: "Point",
    coordinates: [lng, lat]   // GeoJSON: longitude FIRST
  },
  placeName: String,      // result of reverse geocode, e.g. "Rome, Italy"
  placeId: ObjectId,      // ref places (optional, populated after geocoding)
  exif: {
    dateTaken: Date,
    cameraMake: String,
    cameraModel: String
  },
  placedManually: Boolean,   // true = user clicked map instead of GPS auto-place
  geocodeStatus: String,     // "pending" | "done" | "failed" | "skipped"
  createdAt: Date,
  updatedAt: Date
}
```

Indexes:
- `{ userId: 1, createdAt: -1 }` — list photos for a user
- `{ userId: 1, location: "2dsphere" }` — geospatial queries scoped to user (compound 2dsphere index is valid)
- `{ userId: 1, placeName: 1 }` — group-by-place queries
- `{ userId: 1, geocodeStatus: 1 }` — background worker finding pending jobs

The `location` field MUST be a GeoJSON `Point` object (or `null`/absent) for the 2dsphere index to work. Do NOT store raw `[lat, lng]` pairs — MongoDB expects `[lng, lat]` order in GeoJSON.

---

### Collection: `places` (optional cache)

```js
{
  _id: ObjectId,
  location: { type: "Point", coordinates: [lng, lat] },
  // snapped to grid cell (e.g. 4 decimal places) to maximise cache hits
  placeName: String,       // "Rome, Italy"
  countryCode: String,
  fetchedAt: Date          // TTL index on this field
}
```

Index: `{ location: "2dsphere" }` + TTL index on `fetchedAt` (90-day expiry). Lookup: find nearest cached place within 200 m; if none, call Nominatim and insert.

---

## Upload & Ingest Data Flow

```
Client                    Express API               File Storage      MongoDB
  │                           │                          │               │
  │── POST /api/photos ──────►│                          │               │
  │   (multipart/form-data)   │                          │               │
  │                           │ Multer buffers file      │               │
  │                           │ to memory (<10 MB) or    │               │
  │                           │ temp disk                │               │
  │                           │                          │               │
  │                           │── exifr.gps(buffer) ──► (in-process)    │
  │                           │   returns {lat,lng}      │               │
  │                           │   or null                │               │
  │                           │                          │               │
  │                           │── sharp(buffer)          │               │
  │                           │   .resize(800,600)       │               │
  │                           │   .jpeg({q:80})          │               │
  │                           │   → thumbBuffer          │               │
  │                           │                          │               │
  │                           │── write original ───────►│               │
  │                           │── write thumbnail ──────►│               │
  │                           │                          │               │
  │                           │── insert Photo doc ─────────────────────►│
  │                           │   (geocodeStatus:"pending"               │
  │                           │    if GPS present)       │               │
  │                           │                          │               │
  │◄── 201 { photoId, … } ───│                          │               │
  │                           │                          │               │
  │                    [async — background]              │               │
  │                           │                          │               │
  │                           │── geocode worker ──────────────────────►│
  │                           │   reads photos where                     │
  │                           │   geocodeStatus:"pending"                │
  │                           │── call Nominatim                         │
  │                           │── update placeName,                      │
  │                           │   geocodeStatus:"done"  │               │
```

**Sync vs async split:**

- **Synchronous (in the request):** file receipt, EXIF GPS extraction, thumbnail generation, file storage write, MongoDB insert. This is fast enough (<500 ms for most photos) and lets the client get a `201` with a `photoId` and preliminary map coordinates immediately.
- **Asynchronous (background):** reverse geocoding. Nominatim's public endpoint enforces a 1 req/s rate limit; sending it in-band would make the upload feel slow and risk timeouts. A lightweight polling worker (simple `setInterval` in the Node process for v1; upgrade to BullMQ + Redis for higher volume) picks up `geocodeStatus: "pending"` documents and fills in `placeName`. The client can poll or the UI can show "Locating place…" until the name resolves.

For v1, BullMQ + Redis is not required. A `setInterval` loop querying MongoDB for pending docs every 5 s is sufficient and keeps the dependency footprint small.

---

## File Storage: Binaries vs Metadata

| Concern | Where |
|---------|-------|
| Photo JPEG/PNG/HEIC original | File storage (disk or object storage) — stored by UUID key, never by original filename |
| Thumbnail (JPEG, 800×600 max) | File storage, separate key prefix `thumbs/` |
| All metadata (coords, place, user, dates) | MongoDB `photos` collection |
| Access URL generation | Express route `GET /api/photos/:id/file` checks `userId` ownership, then streams from storage OR redirects to a pre-signed URL |

**Never expose the raw storage path/key to the client.** Always proxy through an Express route that verifies ownership before serving. In v1 with local disk, this means `res.sendFile()`. For MinIO/S3 in production, generate a short-lived pre-signed URL and redirect. This enforces per-user isolation at the HTTP layer — a user who guesses another user's `storageKey` gets a 403, not the file.

**Local dev → production migration path:** wrap all storage operations behind a `StorageAdapter` interface with two implementations: `LocalDiskStorage` (dev) and `S3Storage` (prod). Swap via `STORAGE_DRIVER=local|s3` env var. This is a one-file concern and avoids rewriting routes later.

---

## Where Clustering Happens

**Recommendation: client-side clustering with `use-supercluster` for v1.**

Rationale:
- A personal photo map is unlikely to reach 100 k+ points per user in v1. Supercluster handles 100 k markers in 1–2 s and reclusterrs on zoom changes in milliseconds.
- Server-side clustering via MongoDB `$geoNear` / `$bucket` aggregation is powerful but adds API complexity (the server must accept bbox + zoom and return pre-aggregated cluster centroids). This complexity is warranted only when a single user's dataset exceeds ~50 k points, which is not a v1 concern.
- `useSupercluster` (the `use-supercluster` React hook) integrates cleanly with `react-leaflet`. On viewport change or zoom, the hook recalculates clusters from the full in-memory point array. The Map API returns all of the user's photo points (just `{_id, location, thumbnailKey}`) in one request on initial load; the client holds the array and clusters locally.

**Map API endpoint for v1:**
```
GET /api/map/points
Response: [ { id, lng, lat, thumbnailUrl } ]  // all points for req.userId
```

If the dataset grows large later, switch to viewport queries:
```
GET /api/map/points?swLng&swLat&neLng&neLat&zoom
```
and move clustering server-side with `$geoWithin $box` + `$bucket` or a precomputed cluster collection. Flag this as a Phase N upgrade.

---

## Reverse Geocoding: Placement in Flow

**Decision: at ingest time (async), cached in MongoDB `places` collection.**

Do not call Nominatim on-demand per-request — that would impose a 1 req/s delay on every map load and hit rate-limit errors under concurrent use.

Do not call it synchronously in the upload request — it adds 1–3 s latency and can fail, blocking the upload response.

**Correct placement:**
1. Upload handler sets `geocodeStatus: "pending"` and returns `201` immediately.
2. Background worker queries `{ geocodeStatus: "pending" }`, groups by nearby location (snap to 4 dp grid), checks `places` cache, calls Nominatim for misses (respecting 1 req/s), updates photo documents with `placeName` and `geocodeStatus: "done"`.
3. Frontend shows "place resolving…" for the brief window before the background job runs. A simple polling call to `GET /api/photos/:id` every 3 s is sufficient for v1.

**Cache strategy:** snap coordinates to 4 decimal places (~11 m precision) before cache lookup. Photos taken in the same city block will share a cache entry. Store cached results in the `places` MongoDB collection with a TTL index (`fetchedAt`, 90-day expiry) so stale place names are eventually refreshed without manual intervention.

---

## Patterns to Follow

### Pattern 1: userId Guard Middleware

Apply `requireAuth` middleware to all `/api/photos/*` and `/api/map/*` routes. Inside every route handler and Mongoose query, always include `{ userId: req.userId }` in the filter — never rely on a route parameter alone.

```typescript
// Correct — ownership enforced in query
const photo = await Photo.findOne({ _id: req.params.id, userId: req.userId });
if (!photo) return res.status(404).json({ error: "Not found" });

// Wrong — leaks data across users
const photo = await Photo.findById(req.params.id);
```

### Pattern 2: Storage Adapter Abstraction

```typescript
interface StorageAdapter {
  put(key: string, buffer: Buffer, mimeType: string): Promise<void>;
  getUrl(key: string): Promise<string>;   // signed URL or local proxy URL
  delete(key: string): Promise<void>;
}
```

Inject via dependency injection or a module-level singleton. Route handlers never import `fs` or `aws-sdk` directly.

### Pattern 3: GeoJSON Coordinate Discipline

Enforce throughout the codebase: coordinates are always stored and transmitted as `[longitude, latitude]` (GeoJSON order). Add a Mongoose validator or a utility function `toGeoPoint(lat, lng)` that deliberately takes `lat` first (matching mental model) and emits `[lng, lat]` (GeoJSON order). This prevents the silent bug where lat/lng are transposed.

```typescript
const toGeoPoint = (lat: number, lng: number) => ({
  type: "Point" as const,
  coordinates: [lng, lat],   // GeoJSON: longitude first
});
```

### Pattern 4: Ingest Pipeline as a Pure Function

Keep the ingest steps (EXIF extraction → thumbnail → storage write → DB insert) as a testable pipeline function, not inline route logic. This makes it easy to unit-test each step without HTTP machinery.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing Photo Binaries in MongoDB

**What:** Using `Buffer` or `BinData` GridFS for photo storage inside MongoDB documents.
**Why bad:** Documents grow to megabytes, memory pressure on the MongoDB process, slow queries on other fields, no CDN path. GridFS works but adds complexity not needed when a simple file storage adapter suffices.
**Instead:** Store binaries on disk or object storage; store only the `storageKey` string in MongoDB.

### Anti-Pattern 2: Using `req.params.id` Without `userId` Filter

**What:** `Photo.findById(req.params.id)` without checking ownership.
**Why bad:** Any authenticated user can read any other user's photo by guessing an ObjectId.
**Instead:** Always `findOne({ _id, userId: req.userId })`.

### Anti-Pattern 3: Synchronous Reverse Geocoding in Upload Request

**What:** Calling Nominatim inline, awaited before responding to the client.
**Why bad:** 1–3 s added to upload latency, Nominatim rate-limit (1 req/s) causes queuing, a network failure fails the whole upload.
**Instead:** Set `geocodeStatus: "pending"`, respond immediately, resolve async.

### Anti-Pattern 4: Loading All Photo Binaries for Thumbnail on Map

**What:** Serving original high-res images as map pin previews.
**Why bad:** Each pin preview downloads a 5–10 MB original; map becomes unusable on mobile.
**Instead:** Always generate and store a thumbnail at ingest time; serve thumbnail URL for map pins and photo list views; serve original only for full-screen photo view.

### Anti-Pattern 5: Lat/Lng Coordinate Confusion

**What:** Storing `{ coordinates: [lat, lng] }` in MongoDB GeoJSON fields.
**Why bad:** MongoDB expects `[longitude, latitude]` in GeoJSON. Queries will silently return wrong results — points appear in the ocean or wrong hemisphere.
**Instead:** Use `toGeoPoint(lat, lng)` helper everywhere; document the convention in code comments.

---

## Scalability Considerations

| Concern | At 1 K photos/user | At 50 K photos/user | At 500 K photos/user |
|---------|-------------------|---------------------|----------------------|
| Map point load | Return all points (~50 KB JSON), cluster client-side | Return all points (~2.5 MB), still feasible | Switch to viewport/zoom API, server-side clustering |
| Geocoding backlog | `setInterval` worker is fine | Still fine; add concurrency to 3 req/s | Upgrade to BullMQ + Redis queue |
| File storage | Local disk sufficient | Disk fills; migrate to MinIO or S3 | S3 + CloudFront CDN |
| MongoDB query perf | Compound `{userId, location: 2dsphere}` index handles it | Same; monitor with `explain()` | Add read replica |
| Thumbnail serving | Serve via Express proxy | Add nginx or S3 direct URL | CDN for thumbnails |

---

## Suggested Build Order (Phase Dependencies)

1. **Auth foundation** — users collection, JWT middleware, register/login routes. Nothing else can be built safely without per-user isolation in place.

2. **File storage adapter + upload skeleton** — Multer integration, `StorageAdapter` interface with `LocalDiskStorage` implementation, health-check route to verify writes. This is the I/O backbone everything else attaches to.

3. **EXIF extraction + Photo document** — `exifr` GPS extraction, `toGeoPoint` helper, `sharp` thumbnail generation, `photos` collection schema + 2dsphere index, full ingest pipeline as a tested function.

4. **Photo API (CRUD + file serve)** — `GET /api/photos`, `GET /api/photos/:id/file`, `DELETE /api/photos/:id`, all ownership-guarded. Lets the frontend display uploaded photos before the map UI exists.

5. **Map API + React map UI** — `GET /api/map/points`, `react-leaflet` map component, `useSupercluster` clustering, click-to-expand pin. This phase can only start after the Photo document schema (step 3) is stable.

6. **Reverse geocoding + place grouping** — `places` cache collection, Nominatim wrapper, background worker, `GET /api/photos?place=Rome` endpoint. Depends on steps 3 and 4; can be built in parallel with step 5.

7. **Manual pin placement** — frontend map-click handler, `PUT /api/photos/:id/location` endpoint to update coordinates and set `placedManually: true`. Depends on step 5 (map UI exists) and step 4 (photo update route pattern).

**Critical dependency chain:**
```
Auth → Storage Adapter → EXIF/Ingest → Photo API → Map API → Geocoding
                                                            → Manual Placement
```

Steps 6 and 7 can be parallelised after step 5 is done. Step 2 (storage adapter) can be scaffolded as a stub during step 1 if working in a team.

---

## Sources

- [MongoDB 2dsphere Indexes — official docs](https://www.mongodb.com/docs/manual/core/indexes/index-types/geospatial/2dsphere/)
- [MongoDB GeoJSON Objects — official docs](https://www.mongodb.com/docs/manual/reference/geojson/)
- [MongoDB $geoNear aggregation stage — official docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/geonear/)
- [Mongoose GeoJSON guide](https://mongoosejs.com/docs/geojson.html)
- [exifr — fastest JS EXIF library (GitHub)](https://github.com/MikeKovarik/exifr)
- [use-supercluster React hook (GitHub)](https://github.com/leighhalliday/use-supercluster)
- [Dynamic server-side geo clustering — Geovation Tech Blog](https://geovation.github.io/dynamic-server-side-geo-clustering)
- [Handle millions of points with Leaflet (Medium)](https://alfiankan.medium.com/handle-millions-of-location-points-with-leaflet-without-breaking-the-browser-f69709a50861)
- [BullMQ image processing pipeline guide](https://medium.com/@sanipatel0401/building-scalable-job-queues-with-bullmq-a-complete-guide-with-image-processing-example-88c58b550cb8)
- [Stop using uploads/ — why MinIO is better (Medium)](https://medium.com/@sudoroot523/stop-using-uploads-for-everything-why-minio-is-a-better-storage-option-for-modern-applications-2960dcf7bc2f)
- [nominatim-geocoder npm package with LRU caching](https://github.com/thomasnordquist/nominatim-geocoder)
- [Image upload and resizing with Multer and Sharp (Medium)](https://medium.com/@louistrinh/image-upload-and-resizing-with-multer-and-sharp-in-node-js-bacd745785f3)
