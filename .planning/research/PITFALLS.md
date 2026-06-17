# Domain Pitfalls

**Domain:** Personal photo travel-map web application (MERN)
**Researched:** 2026-06-17

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, bans, or security incidents.

---

### Pitfall 1: GPS Coordinate Sign Errors from DMS + Hemisphere Refs

**What goes wrong:** EXIF GPS is stored as three rational numbers (degrees, minutes, seconds) plus a hemisphere reference tag (GPSLatitudeRef = "N"/"S", GPSLongitudeRef = "E"/"W"). Many EXIF parsers return the raw DMS as a positive number regardless of hemisphere. If you forget to negate latitude for "S" or longitude for "W", photos taken in South America, Australia, southern Africa, or the western hemisphere (half the globe) get pinned on the wrong continent — mirrored across an axis.

**Why it happens:** Libraries like `exifr` return a correctly signed decimal by default, but raw EXIF libraries (like `exif-js` or manual picoexif reads) return unsigned DMS. Developers test only with their own northern/eastern photos and never notice.

**Consequences:** Silent wrong placement. Users in affected regions see their photos pinned on the wrong continent with no error. Only discovered when a real user reports it.

**Prevention:**
- Use `exifr` (npm) which handles DMS-to-decimal conversion including hemisphere sign automatically.
- Write unit tests with fixture photos from: Australia (S, E), Brazil (S, W), USA West Coast (N, W), Japan (N, E). Cover all four quadrants.
- Validate: latitude must be in [-90, 90], longitude in [-180, 180]. Reject or flag out-of-range values.

**Detection:** In testing, upload a photo taken in Sydney or Buenos Aires and assert the pin latitude is negative.

**Phase:** EXIF parsing phase (Phase 1 / core upload).

---

### Pitfall 2: HEIC/HEIF Files from iPhones Silently Failing EXIF Extraction

**What goes wrong:** iOS 11+ saves photos in HEIC format by default. The EXIF GPS data is present and valid in HEIC files, but most Node.js EXIF libraries (including early versions of `exifr`) either throw an error or return null for HEIC, silently treating every iPhone photo as GPS-less. The file also cannot be displayed in most browsers (no native HEIC decoding in Chrome/Firefox/Edge).

**Why it happens:** HEIC uses the ISO Base Media File Format container (ISOBMFF) rather than JPEG's JFIF/EXIF segment structure. Parsers that only scan for JPEG APP1 markers miss it entirely.

**Consequences:** iPhone users (a large share of the target audience) get zero auto-placement, defeating the product's core value proposition.

**Prevention:**
- Use `exifr` v7+ which explicitly supports HEIC/HEIF parsing.
- Convert HEIC to JPEG on the server before storage and display, using `sharp` (which supports HEIC input via libvips with the optional `@img/sharp-libvips-*` native bindings). Confirm the sharp build includes HEIC support — it is not always included in prebuilt binaries.
- Alternatively use `heic-convert` (npm) as a pre-processing step before passing to sharp.
- Test with a real iPhone HEIC file with GPS; do not rely only on JPEG fixtures.

**Detection:** Check `Content-Type` on upload. If `image/heic` or `image/heif`, assert GPS extraction returns a valid coordinate.

**Phase:** Phase 1 / core upload pipeline.

---

### Pitfall 3: Storing Photo Binaries in MongoDB Documents

**What goes wrong:** Storing raw image bytes directly in a MongoDB document field (as `Buffer` or `Binary`) hits MongoDB's 16 MB per-document hard limit. Even for photos under 16 MB, this bloats the working set, fills RAM with binary blobs instead of index data, and makes every metadata query carry the overhead of scanning or loading giant documents.

**Why it happens:** It is the path of least resistance in a MERN tutorial: save everything to MongoDB. GridFS is the "proper" MongoDB binary solution but adds its own complexity and still keeps binaries in MongoDB's storage engine.

**Consequences:** Document size errors for large photos (common on modern smartphones: 8–25 MB RAW or high-res JPEG). Severe performance degradation as collection size grows. Backup and restore become slow and large.

**Prevention:**
- Use object storage for all image binaries: AWS S3, Cloudflare R2 (S3-compatible, generous free tier), Backblaze B2, or MinIO (self-hosted).
- Store only the object storage key (a string like `users/{userId}/photos/{photoId}/original.jpg`) in MongoDB, not the binary.
- MongoDB documents hold only metadata: userId, coordinates, place name, upload date, thumbnail key, original key, EXIF fields.
- For local development use MinIO (Docker image) as an S3-compatible local store.

**Detection:** Check document size with `Object.binarySize(doc)` in early development. Any document approaching 1 MB is a warning sign.

**Phase:** Phase 1 / upload pipeline (must be correct from the start; retrofitting storage is a rewrite).

---

### Pitfall 4: Nominatim Reverse Geocoding ToS Violations Leading to IP Ban

**What goes wrong:** The OSM Nominatim public API (`nominatim.openstreetmap.org`) has a strict usage policy: maximum 1 request per second, must include a valid `User-Agent` or `Referer` header identifying your application, no bulk geocoding, no caching bypass. Projects that call Nominatim once per uploaded photo with no rate limiting or caching quickly exceed 1 req/s during a batch upload, get HTTP 429 or silent blacklisting, and all reverse geocoding silently returns empty.

**Why it happens:** "Free and open" reads as "unlimited" to developers who don't read the ToS. Bulk uploads (a user uploading 500 vacation photos at once) easily send hundreds of reverse-geocode requests in seconds.

**Consequences:** IP ban from Nominatim. All reverse geocoding fails permanently until a manual unban request. Even before a full ban, rate limiting causes silent empty results stored as the canonical place name, corrupting the grouping data permanently for those photos.

**Prevention:**
- Cache every reverse-geocode result at the city/place level in MongoDB. Before calling Nominatim, check if a cached result exists for a rounded coordinate (e.g., 2 decimal places = ~1 km precision). Most photos from the same trip will hit the cache.
- Enforce a queue/rate limiter: process reverse geocoding jobs asynchronously (bull/bullmq queue) at maximum 1 request/second.
- Set a proper `User-Agent` header: `PhotoMap/1.0 (contact: your@email.com)`.
- For production scale, self-host Nominatim (Docker) or switch to a commercial provider (Mapbox Geocoding API, Google Maps Geocoding API, Pelias) that has explicit rate limits you can pay for.
- Design the system so place names are filled in asynchronously — upload succeeds immediately, place name resolves in the background. Never block the upload on geocoding.

**Detection:** Log every outbound Nominatim request. Alert if rate exceeds 0.5 req/s sustained.

**Phase:** Phase 2 / reverse geocoding + grouping. The queue infrastructure must be in place before launching geocoding.

---

### Pitfall 5: No Marker Clustering — Thousands of Raw Markers Freezing the Browser

**What goes wrong:** Rendering 500+ individual map markers in Leaflet or Mapbox GL JS without clustering causes the browser to freeze. Each marker is a DOM element (in Leaflet's default renderer) or a WebGL vertex. At 1,000+ markers, pan/zoom becomes unusable on mobile, and on low-end devices the tab can crash entirely.

**Why it happens:** A developer tests with their own 20 photos, everything is fast, and clustering is deferred. The first real user with 800 vacation photos discovers the problem.

**Consequences:** Core UX is broken for any power user. Not fixable by optimization tweaks — requires a clustering solution, which changes the map architecture.

**Prevention:**
- Integrate `react-leaflet-cluster` (wrapper around Leaflet.markercluster) or `supercluster` from day one of the map implementation.
- For Mapbox GL JS, use `mapbox-gl-js` built-in cluster layers (GeoJSON source with `cluster: true`), which offloads clustering to a Web Worker and WebGL — far better performance than DOM markers.
- Never test map performance with fewer than 500 mock markers before shipping.

**Detection:** Generate 1,000 random marker coordinates and render them; measure FPS. Should stay above 30 FPS on a mid-range mobile.

**Phase:** Phase 2 / map rendering. Must be designed in from the start, not retrofitted.

---

### Pitfall 6: OSM Tile Server Direct Usage Violating Policy

**What goes wrong:** Using `https://tile.openstreetmap.org/{z}/{x}/{y}.png` directly as the tile URL in a production application violates the OSM Tile Usage Policy. OSM's tile servers are funded by donations and intended for development/testing only. Heavy traffic from a production app gets blocked or rate-limited.

**Why it happens:** Every Leaflet tutorial shows the OSM tile URL. Developers copy it and never read the policy.

**Consequences:** Tiles stop loading in production. Map shows grey squares. User experience breaks completely.

**Prevention:**
- Use a tile CDN provider with a free tier that explicitly allows production use: Stadia Maps (free tier for open-source/non-commercial), Carto (free tier), Maptiler (free tier), or Mapbox (free tier with API key).
- For a self-hosted option: use `@maptiler/sdk` or run your own tile server with `openmaptiles`.
- Set the tile URL and API key via environment variables so it is easy to swap providers.
- Always include the required attribution string per each provider's terms.

**Detection:** Read the attribution requirement of whatever tile URL you use. If the docs say "for development only," swap before shipping.

**Phase:** Phase 2 / map rendering setup.

---

### Pitfall 7: EXIF Orientation Ignored — Rotated Photos Displayed Sideways

**What goes wrong:** JPEG stores rotation metadata in EXIF `Orientation` tag (values 1–8). Browsers historically ignored this tag and showed the raw pixel data, meaning a portrait photo taken with the phone held vertically appears rotated 90 degrees. Modern Chrome/Safari now respect EXIF orientation in `<img>` tags, but canvas operations, sharp transforms, and older rendering paths do not auto-rotate, causing inconsistent rotation across thumbnails vs. full-size images.

**Why it happens:** Developers test on modern desktop Chrome which respects orientation, then thumbnails generated by sharp show rotated images because sharp ignores orientation by default.

**Consequences:** Thumbnails and previews are rotated 90 or 180 degrees relative to the original, looking broken.

**Prevention:**
- When generating thumbnails with sharp, always call `.rotate()` with no arguments before `.resize()`. Sharp's `.rotate()` without parameters reads the EXIF Orientation tag and applies the correct rotation, then strips the tag so downstream renderers don't double-rotate.
- Pattern: `sharp(buffer).rotate().resize(400).jpeg().toBuffer()`.
- Test with portrait photos taken in all four phone orientations.

**Detection:** Upload a portrait photo taken in landscape orientation (rotated 90 degrees raw). Assert the thumbnail displays upright.

**Phase:** Phase 1 / image processing pipeline.

---

### Pitfall 8: Insecure Direct Object Reference (IDOR) — Accessing Another User's Photos

**What goes wrong:** An API endpoint like `GET /api/photos/:photoId` or `GET /api/files/:filename` that fetches a photo by ID or filename without checking `photo.userId === req.user.id` allows any authenticated user to access any other user's photos by guessing or iterating IDs.

**Why it happens:** The developer adds authentication middleware (JWT check) and considers the route "secured." The per-resource ownership check is forgotten or added inconsistently. MongoDB ObjectIds are not secret — they encode a timestamp and are sequential enough to enumerate.

**Consequences:** Full private photo collection exposure. Privacy breach. If photos contain GPS home location metadata (see Pitfall 10), this is a serious safety issue.

**Prevention:**
- Every query for a single photo must include `{ _id: photoId, userId: req.user.id }` — never just `{ _id: photoId }`.
- Every query for a list of photos must include `{ userId: req.user.id }`.
- For files served from object storage: generate short-lived signed URLs (S3 presigned URLs, R2 signed URLs) scoped to the requesting user. Never expose a public permanent URL to photo objects.
- Write integration tests that: (1) create user A's photo, (2) authenticate as user B, (3) attempt to fetch user A's photo — assert 404 or 403.
- Add a middleware or service layer that always injects `userId` into every DB query rather than relying on each route handler to remember.

**Detection:** IDOR is often found only in security audits. Add automated tests for cross-user access on every photo endpoint before shipping.

**Phase:** Phase 1 / auth + upload (must be correct from the start). Test in every subsequent phase when new endpoints are added.

---

### Pitfall 9: Accepting Any File as "Image" — Malicious Upload Attacks

**What goes wrong:** Validating only the file extension or MIME type from the HTTP Content-Type header allows attackers to upload PHP/JS/HTML files renamed as `.jpg`, polyglot files (valid JPEG that is also valid JavaScript), or SVG files containing `<script>` tags. If the server stores and re-serves these files, stored XSS or server-side execution becomes possible.

**Why it happens:** `multer` by default does not validate file contents, only what the client claims. Developers add `fileFilter` that checks `mimetype === 'image/jpeg'` but `mimetype` comes from the HTTP request, which the attacker controls.

**Consequences:** Stored XSS (SVG with script served from same origin). In extreme cases (if files are executed), remote code execution. User account takeover.

**Prevention:**
- Use `file-type` npm package to read the first bytes of the file buffer and verify the magic bytes match a real image format (JPEG, PNG, HEIC, WEBP). This is not spoofable from the client.
- Only allow JPEG, PNG, HEIC, WEBP — reject everything else including SVG and GIF (GIF is not needed; animated GIFs are an attack vector).
- Set a maximum file size (e.g., 50 MB) in multer config to prevent DoS via large upload.
- Never serve uploaded files from the same origin as the web application. Serve from object storage (separate domain/subdomain) or use `Content-Disposition: attachment` to prevent execution. Signed URLs from R2/S3 are on a different domain by default.
- Strip or re-encode: after validation, run the image through `sharp` to re-encode it as JPEG/PNG. This destroys any embedded payloads while also normalizing the file.

**Detection:** Attempt to upload a `.php` file renamed `.jpg`. Assert it is rejected. Attempt to upload a valid SVG with a script tag. Assert it is rejected.

**Phase:** Phase 1 / upload pipeline.

---

### Pitfall 10: Leaking Precise Home Location via EXIF in Served Photos

**What goes wrong:** The application's purpose is to read GPS from photos — but if the original photo files (with all EXIF intact) are served to users or, worse, publicly accessible, the precise GPS coordinates are embedded in every download. Home address, workplace, children's school — all deducible from a pattern of photos.

**Why it happens:** Object storage buckets are sometimes set to public read by default. Developers focus on the upload/display flow and don't think about what happens when a user downloads the served file.

**Consequences:** If an attacker gains access to photo URLs (IDOR, or a misconfigured public bucket), they get GPS coordinates for every location the user has ever been, far more precise than the map display (which may be clustered/blurred).

**Prevention:**
- Strip all EXIF from served photos. When processing the image through sharp, use `.withMetadata(false)` (or do not call `.withMetadata()`) to discard all metadata in the output. The GPS coordinates are already stored in MongoDB; they do not need to survive in the file.
- Serve only re-encoded thumbnails and display versions (EXIF-stripped), never the original raw upload, as the "view" URL.
- Provide a separate "download original" action only the owner can trigger, with a clear disclosure that it contains GPS data.
- Never make the object storage bucket public. Use signed URLs with short expiry (15 minutes).

**Detection:** Download a served photo file. Run `exiftool` on it. Assert GPS tags are absent.

**Phase:** Phase 1 / image processing. Add EXIF stripping to the processing pipeline before storage of the display version.

---

## Moderate Pitfalls

---

### Pitfall 11: Reverse Geocoding Results Not Cached — Duplicate API Calls

**What goes wrong:** Every photo upload triggers a Nominatim call even when 50 photos from the same Paris trip all round to the same coordinates. Without a cache, this wastes quota, increases latency, and violates Nominatim's policy.

**Prevention:**
- Round coordinates to 2 decimal places (~1 km grid) before cache lookup.
- Store geocoding results in a MongoDB collection `geocache` with `{ gridKey: "48.85_2.35", placeName: "Paris", country: "France", cached_at: Date }`.
- TTL index on `cached_at` to expire entries after 90 days (place names rarely change).
- Check cache first; call Nominatim only on cache miss.

**Phase:** Phase 2 / reverse geocoding.

---

### Pitfall 12: No Thumbnail Generation — Serving Multi-Megabyte Originals to the Map

**What goes wrong:** The map shows a pin grid or a photo strip. If each photo tile loads the original 8 MB JPEG, the map view downloads hundreds of megabytes on first load.

**Prevention:**
- On upload, generate at least two derivatives with sharp: a thumbnail (e.g., 400px wide JPEG, ~50 KB) for map pins/grid views, and a display version (e.g., 1600px wide, ~300 KB) for the lightbox view.
- Store the thumbnail key separately from the original key in the photo document.
- Never use the original for display purposes.

**Phase:** Phase 1 / upload pipeline.

---

### Pitfall 13: Photos Without GPS Silently Dropped Instead of Queued for Manual Placement

**What goes wrong:** EXIF parsing returns null GPS. The developer adds an early return: `if (!gps) return error`. The photo is rejected. The user has no idea why their photo didn't appear on the map.

**Prevention:**
- Accept all valid image uploads regardless of GPS presence.
- Set `coordinates: null` and `placementStatus: 'pending_manual'` for GPS-less photos.
- Show a "photos awaiting placement" queue in the UI so the user can click the map to place them.
- This is a core requirement per PROJECT.md — never silently drop.

**Phase:** Phase 1 / upload + Phase 2 / manual placement UI.

---

### Pitfall 14: Messenger-Stripped EXIF — Photos Shared via WhatsApp/Telegram Have No GPS

**What goes wrong:** WhatsApp, Telegram, Instagram, iMessage, and most messenger apps strip all EXIF metadata (including GPS) when photos are downloaded from chats, to protect sender privacy. Users who try to upload photos saved from a chat will get no auto-placement, which feels like a bug.

**Why it happens:** This is by design in the messengers, but users don't know it.

**Prevention:**
- This cannot be fixed technically — the data is gone. The design response is: handle it gracefully (see Pitfall 13 — queue for manual placement).
- Add a user-facing hint: "No location found. Photos shared via messaging apps often have location removed. Click the map to place this photo manually."
- Never surface a technical error message for GPS-less photos.

**Phase:** Phase 2 / UX for manual placement.

---

### Pitfall 15: JWT Stored in localStorage — XSS Token Theft

**What goes wrong:** Storing the auth JWT in `localStorage` makes it accessible to any JavaScript running on the page. An XSS vulnerability anywhere in the app (even in a dependency) allows the attacker to read the token and impersonate the user.

**Prevention:**
- Store the JWT in an `httpOnly`, `SameSite=Strict` (or `Lax`) cookie. The browser sends it automatically and JavaScript cannot read it.
- The trade-off: CSRF protection is needed; SameSite=Strict handles this for most cases.
- If `localStorage` is used during development for convenience, explicitly migrate to httpOnly cookies before any multi-user deployment.

**Phase:** Phase 1 / auth.

---

## Minor Pitfalls

---

### Pitfall 16: GPS Altitude Stored but Elevation Display Misleads

**What goes wrong:** EXIF also contains `GPSAltitude` and `GPSAltitudeRef`. Some developers display elevation on the pin popup. GPS elevation from phones is notoriously inaccurate (±50 m). Displaying it as fact misleads users.

**Prevention:** Do not display GPS altitude. Store it if desired for future use, but omit from any UI.

**Phase:** Phase 1 / EXIF model.

---

### Pitfall 17: No Index on `userId` in Photos Collection — Slow Queries at Scale

**What goes wrong:** Every photo query filters by `userId`. Without an index, MongoDB does a full collection scan as the photo count grows.

**Prevention:**
- Add `{ userId: 1 }` index on the photos collection in the Mongoose schema or migration.
- Add a compound index `{ userId: 1, coordinates: "2dsphere" }` for geospatial queries.
- Add this from day one; retrofitting indexes on a populated collection requires a background build.

**Phase:** Phase 1 / data model.

---

### Pitfall 18: Uploading the Same Photo Twice Creates Duplicate Pins

**What goes wrong:** Users accidentally re-upload photos from a trip. Two pins appear at the same location. No deduplication logic exists.

**Prevention:**
- Hash the image file (SHA-256 of the original buffer) on upload. Store the hash in the photo document.
- On upload, check `{ userId: req.user.id, fileHash: hash }` — if exists, return the existing photo instead of creating a duplicate.
- The hash check must be per-user (two users can have the same photo; that is not a duplicate).

**Phase:** Phase 1 / upload.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| EXIF parsing | DMS hemisphere sign errors (Pitfall 1) | Use exifr; test all 4 coordinate quadrants |
| EXIF parsing | HEIC files returning null GPS (Pitfall 2) | Confirm exifr v7+ + sharp HEIC support in build |
| Image processing pipeline | EXIF orientation ignored in thumbnails (Pitfall 7) | Always call sharp().rotate() before resize |
| Image processing pipeline | Serving original with GPS EXIF (Pitfall 10) | Strip metadata in sharp output; never serve originals as display |
| Upload validation | Malicious file type accepted (Pitfall 9) | file-type magic byte check + sharp re-encode |
| Upload storage | Binaries in MongoDB (Pitfall 3) | Object storage from day one — not retrofittable |
| Auth + ownership | IDOR on photo endpoints (Pitfall 8) | Always scope queries to req.user.id; write cross-user tests |
| Auth | JWT in localStorage (Pitfall 15) | httpOnly cookie from day one |
| Map rendering | Raw markers at scale (Pitfall 5) | Integrate clustering from first map implementation |
| Map rendering | OSM tile ToS violation (Pitfall 6) | Use Stadia/Maptiler/Mapbox with API key |
| Reverse geocoding | Nominatim rate limit ban (Pitfall 4) | Queue + 1 req/s limiter + coordinate cache before first geocode call |
| Reverse geocoding | No cache, duplicate calls (Pitfall 11) | gridKey cache in MongoDB |
| Data model | Missing userId index (Pitfall 17) | Add index in schema definition, not as an afterthought |
| UX | GPS-less photos silently dropped (Pitfall 13) | Accept all uploads; queue for manual placement |
| UX | Messenger-stripped EXIF confuses users (Pitfall 14) | Explain in UI; route to manual placement |

---

## Sources

- OSM Nominatim Usage Policy: https://operations.osmfoundation.org/policies/nominatim/
- OSM Tile Usage Policy: https://operations.osmfoundation.org/policies/tiles/
- exifr npm package documentation (HEIC support, DMS conversion): https://github.com/MikeKovarik/exifr
- sharp documentation (rotate, withMetadata, HEIC input): https://sharp.pixelplumbing.com/
- file-type npm package (magic byte validation): https://github.com/sindresorhus/file-type
- Leaflet.markercluster: https://github.com/Leaflet/Leaflet.markercluster
- supercluster (Mapbox clustering): https://github.com/mapbox/supercluster
- EXIF specification (GPS IFD, Orientation tag): https://exiv2.org/tags.html
- MongoDB 16 MB document limit: https://www.mongodb.com/docs/manual/reference/limits/
- OWASP IDOR guidance: https://owasp.org/www-project-web-security-testing-guide/
