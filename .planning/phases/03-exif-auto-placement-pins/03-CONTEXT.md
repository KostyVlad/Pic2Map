# Phase 3: EXIF Auto-Placement & Pins - Context

**Gathered:** 2026-06-21
**Status:** Ready for planning

<domain>
## Phase Boundary

On upload, read GPS coordinates from a photo's EXIF, auto-assign the photo to its
country by point-in-polygon, and render it as a pin at its exact coordinates when the
user drills into that country — with clustering for nearby pins. Photos without GPS (or
whose GPS resolves to no country) fall back to manual per-country assignment (Phase 1
flow). Covers GEO-01 … GEO-05. Reverse-geocoded city names, moving/repositioning pins,
and upload progress are OUT of scope (Phase 4 / POL).

</domain>

<decisions>
## Implementation Decisions

### GPS source (GEO-01)
- **D-01:** Read GPS coordinates **locally on the server with the `exifr` library** from
  the raw upload buffer, BEFORE the ingest pipeline strips EXIF. The route already has
  `rawBuffer` in hand (`server/src/routes/photos.js`) prior to `ingestPhoto()`. This is
  storage-agnostic (works with both the local-disk and Cloudinary backends) and does not
  couple GPS extraction to Cloudinary's `image_metadata`. Served files stay EXIF-stripped
  (privacy unchanged).

### Upload flow (GEO-02, GEO-05)
- **D-02:** Two upload entry points coexist:
  - **NEW global "Upload" button** (outside the country panel): accepts a batch; each
    photo's GPS is read and the photo is auto-assigned to its country via point-in-polygon,
    with exact coordinates stored for its pin. No manual country pick for GPS photos.
  - **Existing per-country panel upload stays** as the manual path (GEO-05) for photos
    without GPS — opening a country IS the manual country assignment.
- **D-03:** In the global upload, only photos with a resolved country are auto-placed.
  Photos without usable GPS are NOT placed automatically; the result summary reports them
  (e.g. "N photos have no location — open a country and add them there") so nothing is
  silently dropped (GEO-05). The existing `GpsResultSummary` area in the upload UI
  (UI-SPEC) surfaces this.

### GPS that resolves to no country (GEO-02 edge case)
- **D-04:** Coordinates that fall outside every country polygon (ocean, Antarctica,
  disputed/unmatched) are treated **identically to "no GPS"**: not auto-placed, included in
  the same "add manually via a country" report. **No nearest-country snapping** (avoids
  mid-ocean → random-country mistakes). Predictable, single fallback path.

### Claude's Discretion
- Exact `exifr` usage (field selection, GPS sign/hemisphere handling — must avoid
  transposition per GEO-01) and error handling for malformed EXIF.
- Point-in-polygon implementation: runs **server-side** against the same country polygon
  set used by the client (`client/public/countries.geojson`, already merged so Russia is
  one feature and Crimea is part of Ukraine). Library choice (e.g. turf
  `booleanPointInPolygon`) and how the server loads/caches the polygons is Claude's call.
  Country key must match the app's `extractIso` (SU_A3 / merged ADM0) keying so pins land
  in the same country unit shown on the map.
- Where coordinates are stored: `Photo.location` already exists in the model (GeoJSON
  Point, currently null) — use it.
- Clustering: `use-supercluster` (ROADMAP decision) + react-leaflet 5; pin/cluster visuals
  and thresholds are defined in the UI-SPEC.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` — Phase 3 goal + 4 success criteria
- `.planning/REQUIREMENTS.md` — GEO-01 … GEO-05 (the IDs this phase must satisfy)

### UI / interaction contract
- `.planning/phases/03-exif-auto-placement-pins/03-UI-SPEC.md` — pin marker, cluster
  bubble tiers, GPS-result summary copy, upload result states, popup→lightbox flow
  (approved 6/6 dimensions)

### Country geometry & keying (point-in-polygon)
- `client/public/countries.geojson` — merged country polygons (one feature per country;
  Crimea ∈ Ukraine, Russia unified) used for point-in-polygon country assignment
- `client/src/utils/isoCode.js` and `server/src/utils/isoCode.js` — `extractIso` keying
  (SU_A3 → GU_A3 → ADM0_A3 → name-slug); pin country must use the same key

### Pipeline integration
- `server/src/routes/photos.js` — upload route; `rawBuffer` available pre-ingest (read GPS here)
- `server/src/services/ingest.js` — strips EXIF; GPS MUST be read before this runs
- `server/src/models/Photo.js` — `location` (GeoJSON Point, currently null) + `countryCode`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Photo.location` field already modelled (GPS Point) — Phase 3 finally populates it.
- `PhotoCountBadge.jsx` uses a Leaflet `DivIcon` pattern — the UI-SPEC reuses it for pins
  and cluster bubbles.
- The upload route already reads the raw file buffer before ingest — the natural hook for
  `exifr` GPS extraction.
- `PhotoUploadForm` / `GpsResultSummary` (UI-SPEC) — extend its status area for the
  GPS/no-GPS result counts; no new container needed there.

### Established Patterns
- StorageAdapter (local disk / Cloudinary) — pins/GPS logic must stay backend-agnostic
  (D-01 honors this).
- Per-user isolation (Phase 2): all new photo/pin queries scoped by `userId`, file serving
  via the ownership-checked route. Pins inherit this.
- CountryLayer re-mounts via `key` on `photoCounts` change (Pitfall 3) — pin/cluster layers
  must tolerate the same re-mount.

### Integration Points
- New global Upload control mounts at the map level (alongside `AccountStrip`/`WorldMap`).
- Pins render when drilling into a country (inside `CountrySidebar` per UI-SPEC, a
  `CountryPinMap`) — sourced from each photo's stored coordinates.

</code_context>

<specifics>
## Specific Ideas

- Result messaging must make GPS auto-placement legible ("N photos auto-placed in
  [Country]") and clearly flag the no-location remainder — the user cares that nothing is
  silently dropped.
- Country units for placement must match the corrected map (merged Russia, Crimea ∈
  Ukraine) so a pin never lands in a country unit the map doesn't show.

</specifics>

<deferred>
## Deferred Ideas

- **Backfilling GPS for Phase 1/2 photos** (re-extracting coordinates for already-uploaded
  photos): not in scope. Existing photos without coordinates stay at country level with no
  pin. (User skipped this gray area.)
- **Reverse-geocoded city/place names** — Phase 4 (POL-01/02).
- **Moving/repositioning a photo's pin or changing its country** — Phase 4 (POL-03).
- **Per-file upload progress UI** — Phase 4 (POL-05).
- Delete (single + bulk) already shipped early (POL-04).

</deferred>

---

*Phase: 03-exif-auto-placement-pins*
*Context gathered: 2026-06-21*
