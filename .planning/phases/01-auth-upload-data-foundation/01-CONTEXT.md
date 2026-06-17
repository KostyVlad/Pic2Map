# Phase 1: Auth, Upload & Data Foundation - Context

**Gathered:** 2026-06-17
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers secure multi-user authentication plus the photo ingest pipeline:
a user can sign up, log in (session persists), log out, and upload photo files (single
and bulk) which are processed (EXIF GPS read, thumbnail generated, EXIF stripped from
served files, HEIC converted) and stored via a swappable storage abstraction, with every
photo/query strictly scoped to the owning user. The phase also delivers a **thumbnail-grid
gallery** of the user's uploaded photos so the work is user-visible before the map exists
(map arrives in Phase 2).

Covers requirements AUTH-01–04 and UPLD-01–08.

**Not in this phase:** the world map and pin rendering (Phase 2), reverse geocoding /
city names (Phase 3), manual pin placement and pin editing/deletion UX (Phase 4).
</domain>

<decisions>
## Implementation Decisions

### Phase 1 User-Visible Surface
- **D-01:** After upload, the user sees a **thumbnail-grid gallery** of their uploaded
  photos (not just a success toast, not a plain filename list). This is what makes Phase 1
  a useful vertical slice before the Phase 2 map exists.
- **D-02:** Each gallery tile shows the **thumbnail + a GPS status indicator** (has
  coordinates vs. no coordinates). Do NOT show city/place names — reverse geocoding is
  Phase 3. Numeric coordinates and capture date are optional/not required for v1 Phase 1.

### GPS-less Photo Handling (Phase 1 scope)
- **D-03:** Photos without EXIF GPS are accepted and stored (never dropped — per UPLD-04),
  flagged with a placement status (e.g. `pending_manual`).
- **D-04:** The gallery provides a **separate section / filter** (e.g. a "needs placement"
  tab or filter) so GPS-less photos are easy to find. This is the Phase 1 groundwork that
  Phase 4 (manual placement) will build on. Phase 1 does NOT implement the actual
  click-to-place interaction — only the surfacing/filter.

### Claude's Discretion
The user did not want to discuss these; sensible defaults apply and downstream agents may
refine:
- **Auth depth:** v1 = simple email + password with login/logout only. **No email
  verification and no password reset in v1** (matches REQUIREMENTS.md — only AUTH-01–04).
  These are deferred, not in scope. Auth mechanics (jose JWT in httpOnly cookie, argon2id)
  are already locked by research — see Canonical References.
- **Upload constraints:** Accept JPEG / PNG / WebP / HEIC (HEIC converted to JPEG
  server-side). Suggested limits: ~25 MB per file, up to ~50 files per batch. Validate by
  magic bytes (per UPLD-07). Planner/researcher may tune exact numbers; the research
  SUMMARY suggested 50 MB as an upper bound — keep configurable.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Scope
- `.planning/PROJECT.md` — product definition, core value, constraints, key decisions
- `.planning/REQUIREMENTS.md` — v1 requirements; this phase covers AUTH-01–04, UPLD-01–08
- `.planning/ROADMAP.md` — Phase 1 goal, mode (mvp), and success criteria

### Research (locked technical direction for this phase)
- `.planning/research/SUMMARY.md` — executive synthesis; phase build-order rationale
- `.planning/research/STACK.md` — library choices & versions: exifr v7+, multer v2.2+,
  sharp, jose, argon2id, Mongoose; what NOT to use
- `.planning/research/ARCHITECTURE.md` — MongoDB photo data model (GeoJSON `Point`,
  compound `{ userId: 1, location: "2dsphere" }` index), `toGeoPoint(lat,lng)` `[lng,lat]`
  ordering, StorageAdapter abstraction, sync-ingest / async-geocode split,
  `geocodeStatus` and placement-status fields
- `.planning/research/PITFALLS.md` — Phase-1-critical, non-retrofittable concerns: IDOR
  (`findOne({_id, userId})`), no binaries in MongoDB, GPS sign/hemisphere via exifr, EXIF
  stripping on served files (`sharp().withMetadata(false)`), orientation (`sharp().rotate()`),
  HEIC support, magic-byte upload validation, httpOnly JWT + argon2id

</canonical_refs>

<code_context>
## Existing Code Insights

Greenfield project — no existing code, no codebase maps. This phase establishes the
foundational structure (auth module, upload/ingest pipeline, StorageAdapter, Mongoose
models, Photo CRUD API, React gallery). Conventions set here are reused by all later phases.

### Patterns to establish (will constrain later phases)
- **userId scoping:** every photo query uses `findOne/find({ ..., userId: req.userId })` — Phase 2/3/4 all depend on this isolation pattern.
- **StorageAdapter:** local-disk implementation in v1, env-swappable to S3/R2 later (SCALE-01).
- **Photo schema:** GeoJSON location + placement/geocode status fields seeded now so Phases 2–4 don't require migrations.
</code_context>

<specifics>
## Specific Ideas

- The Phase 1 gallery should make the "magic" verifiable without the map: upload a photo
  with GPS → it shows in the gallery as "located"; upload one without → it shows under
  "needs placement". This is the user's acceptance feel for Phase 1.
</specifics>

<deferred>
## Deferred Ideas

- Email verification and password reset — deferred (not in AUTH-01–04); revisit in a later
  auth-hardening phase or milestone.
- Actual manual click-to-place interaction for GPS-less photos — Phase 4 (EDIT-01).
- City/place names on gallery tiles — Phase 3 (reverse geocoding).
- S3/R2 object storage — v2 (SCALE-01); StorageAdapter is built now to make the swap easy.
- Client-side EXIF preview before upload — v2 (ENH-01).

None of the above expanded Phase 1 scope — discussion stayed within the phase.
</deferred>

---

*Phase: 1-auth-upload-data-foundation*
*Context gathered: 2026-06-17*
