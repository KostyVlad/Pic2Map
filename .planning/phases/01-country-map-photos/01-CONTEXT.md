# Phase 1: Country Map & Per-Country Photos - Context

**Gathered:** 2026-06-17
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the visible core of PhotoMap as a single local user, with NO accounts:
an interactive world map that renders country boundaries, highlights a country on
hover/selection, and lets the user click a country to upload photos to it and view that
country's photos in a gallery/lightbox. Photos are processed (thumbnail, HEIC→JPEG, EXIF
stripped from served files, magic-byte validation) and stored via a swappable storage
abstraction (local disk in v1), never inline in MongoDB. Countries that contain photos are
visually marked on the map.

Covers requirements CMAP-01–05 and PHOTO-01–06.

**Not in this phase:** accounts / login / per-user isolation (Phase 2); reading EXIF GPS,
auto-assigning country from coordinates, and pins inside a country (Phase 3); reverse
geocoding to cities, edit/move, delete, upload-progress UI, mobile polish (Phase 4).
</domain>

<decisions>
## Implementation Decisions

### Interaction model
- **D-01:** Country-first, manual association. The user explicitly clicks/selects a country
  and uploads photos to it. There is NO EXIF/GPS auto-placement in this phase — that is
  Phase 3. (Long-term, GPS will auto-assign the country; the manual flow stays as fallback.)
- **D-02:** Country highlighting is **on hover / when selected** — all country borders are
  drawn; the country under the cursor or currently selected is highlighted. NOT a heatmap
  and NOT "only countries with photos are clickable." (Photo-count coloring may come later.)
- **D-03:** Countries that contain photos are **visually marked** (e.g. filled color and/or
  a small photo-count badge) so the user can see where they have photos at a glance. Exact
  visual styling is open to the planner/UI phase.

### Accounts
- **D-04:** No authentication in this phase. The app runs as a single implicit/local user.
  Accounts and per-user isolation are added in Phase 2, which will migrate this phase's data
  to per-user ownership. Build the data model so adding a `userId` later is straightforward
  (a migration is expected and accepted).

### Upload & storage (per-country)
- **D-05:** Upload accepts JPEG / PNG / WebP / HEIC; HEIC/HEIF is converted to JPEG
  server-side (sharp). Validate by magic bytes; suggested limits ~25 MB/file and ~50 files
  per batch (configurable; planner may tune). Per-file progress UI is deferred to Phase 4 —
  basic upload + overall success/failure is enough here.
- **D-06:** Generate a thumbnail per photo and **strip EXIF (incl. GPS) from served image
  files** even though GPS isn't read yet — privacy from day one. Store photo binaries via a
  `StorageAdapter` (local disk in v1, env-swappable to S3/R2 later); never store binaries in
  MongoDB.
- **D-07:** Each photo records which country it belongs to (store a stable country
  identifier — ISO 3166-1 code — not just a display name) so Phase 3's point-in-polygon
  auto-assignment and Phase 4 grouping line up with the same country keys.

### Viewing
- **D-08:** Opening a country shows its photos as a **thumbnail-grid gallery** with a
  lightbox for full-size viewing.

### Styling
- **D-09:** Frontend styling uses **Tailwind CSS** (user decision), configured via the
  official Vite plugin. PhotoMap design tokens (colors, type scale) live in the Tailwind
  theme; components use utility classes. NOT plain CSS / CSS Modules / a component library.
  Full token + component contract is in `01-UI-SPEC.md`. Note: Leaflet polygon styles are
  set in JS (Tailwind does not apply to Leaflet's SVG), reusing the same palette values.

### Claude's Discretion
- Exact country-boundary data source and rendering approach (e.g. Natural Earth GeoJSON via
  a Leaflet GeoJSON layer) — see Canonical References / research flag below.
- Exact free-tier tile provider for the base map (Stadia/MapTiler) — env-configurable.
- Precise file-size / batch limits and thumbnail dimensions.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Scope
- `.planning/PROJECT.md` — product definition, country-first build order, key decisions
- `.planning/REQUIREMENTS.md` — v1 requirements; this phase = CMAP-01–05, PHOTO-01–06
- `.planning/ROADMAP.md` — Phase 1 goal, mode (mvp), success criteria

### Research (still-relevant technical direction)
- `.planning/research/STACK.md` — multer v2.2+, sharp (thumbnails/HEIC/EXIF strip),
  Mongoose, Vite 8 + React 19, react-leaflet v5 (note the React 19 peer-dep pairing),
  TanStack Query v5
- `.planning/research/ARCHITECTURE.md` — StorageAdapter abstraction, sync ingest
  (multer → sharp thumbnail/convert → storage write → Mongo insert), photo schema patterns
- `.planning/research/PITFALLS.md` — non-retrofittable Phase-1 concerns: no binaries in
  MongoDB, EXIF stripping on served files (`sharp().withMetadata(false)`), orientation
  (`sharp().rotate()` before resize), HEIC support, magic-byte upload validation
- `.planning/research/SUMMARY.md` — overall synthesis

> **Research note / flag:** The existing research was written for the pin-by-EXIF model.
> Country-boundary rendering (e.g. Natural Earth country GeoJSON, a Leaflet GeoJSON layer
> with hover/click handlers) and the country↔photo data model are NEW for this phase and
> were NOT covered by the original research. The phase researcher should investigate:
> country-boundary GeoJSON sources & sizes, rendering/highlight performance, and how to key
> photos to countries (ISO codes) so Phase 3 point-in-polygon assignment aligns.

</canonical_refs>

<code_context>
## Existing Code Insights

Greenfield project — no existing code, no codebase maps. This phase establishes the
foundational structure (Express API, Mongoose models, StorageAdapter, upload/ingest, React
map + per-country upload/gallery). Conventions set here are reused by all later phases.

### Patterns to establish (will constrain later phases)
- **StorageAdapter:** local-disk implementation, env-swappable to S3/R2 (SCALE-01).
- **Photo schema:** country key (ISO code) now; add `userId` (Phase 2) and GPS/`location`
  GeoJSON + `geocodeStatus` (Phase 3) without rework — design fields to extend cleanly.
- **EXIF stripping on serve:** privacy pattern in place before GPS is ever read.
</code_context>

<specifics>
## Specific Ideas

- The starting experience is literally: open the site → world map with country borders →
  hover a country (it highlights) → click it → upload photos → see them in that country's
  gallery. Countries with photos stand out on the map.
</specifics>

<deferred>
## Deferred Ideas

- Accounts / login / private per-user maps — Phase 2 (AUTH-01–04); data migrated then.
- Reading EXIF GPS, auto-assigning country, exact-location pins + clustering — Phase 3 (GEO-01–05).
- Reverse-geocoded cities, group-by-place, move/edit, delete, upload-progress, mobile polish — Phase 4 (POL-01–06).
- S3/R2 object storage — v2 (SCALE-01); StorageAdapter built now for easy swap.
- Photo-count heatmap coloring of countries; client-side EXIF preview — later.

None of the above expanded Phase 1 scope — discussion stayed within the phase.
</deferred>

---

*Phase: 1-country-map-photos*
*Context gathered: 2026-06-17*
