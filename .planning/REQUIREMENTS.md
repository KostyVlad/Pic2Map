# Requirements: PhotoMap

**Defined:** 2026-06-17
**Core Value:** Upload a photo → it lands on the world map by itself in the right place, and the map of pins with per-place photo viewing feels good to browse.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication & Isolation

- [ ] **AUTH-01**: User can sign up with email and password
- [ ] **AUTH-02**: User can log in and the session persists across browser refresh
- [ ] **AUTH-03**: User can log out
- [ ] **AUTH-04**: Every photo and map query is scoped to the authenticated user — no user can access another user's photos or pins

### Upload & Ingest

- [ ] **UPLD-01**: User can upload photo files from their device (single and multiple/bulk)
- [ ] **UPLD-02**: User sees per-file upload progress and success/failure status
- [ ] **UPLD-03**: Service reads GPS coordinates from photo EXIF and stores them with the photo
- [ ] **UPLD-04**: Photos without GPS in EXIF are still accepted and marked as needing manual placement (never silently dropped)
- [ ] **UPLD-05**: Service generates a thumbnail for each photo and strips EXIF (incl. GPS) from served image files
- [ ] **UPLD-06**: HEIC/HEIF uploads are converted server-side to a browser-displayable format (JPEG)
- [ ] **UPLD-07**: Uploads are validated (file type by magic bytes, size limit) and rejected with a clear message if invalid
- [ ] **UPLD-08**: Photo files are stored via a storage abstraction (local disk in v1, swappable later), never inline in MongoDB

### Map & Viewing

- [ ] **MAP-01**: User sees a world map with a pin for each geolocated photo
- [ ] **MAP-02**: Nearby photos cluster into a single marker that expands as the user zooms in
- [ ] **MAP-03**: Clicking a pin/cluster shows all the user's photos taken in that place
- [ ] **MAP-04**: User can view a photo full-size in a lightbox/gallery
- [ ] **MAP-05**: Map tiles are served from a configured free-tier tile provider (env-configurable)
- [ ] **MAP-06**: The UI is responsive and usable in a mobile browser

### Places & Geocoding

- [ ] **PLAC-01**: Service reverse-geocodes photo coordinates to a place/city name (async, rate-limited, cached)
- [ ] **PLAC-02**: Photos are grouped by place/city; user can see a list of places they have photos in
- [ ] **PLAC-03**: User can filter/select a place to see only that place's photos

### Manual Placement & Editing

- [ ] **EDIT-01**: User can place a GPS-less photo by clicking a location on the map
- [ ] **EDIT-02**: User can move/edit the location of an existing pin
- [ ] **EDIT-03**: User can delete a photo (and it disappears from the map)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Cloud Import

- **CLOUD-01**: User can import photos from Google Photos
- **CLOUD-02**: User can import photos from iCloud / other cloud providers

### Storage & Scale

- **SCALE-01**: Photo files served from S3-compatible object storage (S3/R2) in production
- **SCALE-02**: Server-side geospatial clustering for very large libraries (50k+ photos)

### Enhancements

- **ENH-01**: Client-side EXIF preview before upload
- **ENH-02**: Timeline view of photos
- **ENH-03**: Duplicate photo detection
- **ENH-04**: Search/filter photos

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Social features (others' maps, profiles, follows, feed) | Each user sees only their own map in v1; large scope, deferred |
| Public/shareable map links | No sharing layer in v1; private maps only |
| Native mobile app (React Native, etc.) | Web-first; mobile is a separate later milestone |
| In-app photo editing (filters, crop) | Not core to the map value |
| Video support | Storage/bandwidth cost; photos only |
| AI/ML auto-labeling | Not core; significant complexity |
| Offline/PWA mode | Web-online v1 |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |
| UPLD-01 | Phase 1 | Pending |
| UPLD-02 | Phase 1 | Pending |
| UPLD-03 | Phase 1 | Pending |
| UPLD-04 | Phase 1 | Pending |
| UPLD-05 | Phase 1 | Pending |
| UPLD-06 | Phase 1 | Pending |
| UPLD-07 | Phase 1 | Pending |
| UPLD-08 | Phase 1 | Pending |
| MAP-01 | Phase 2 | Pending |
| MAP-02 | Phase 2 | Pending |
| MAP-03 | Phase 2 | Pending |
| MAP-04 | Phase 2 | Pending |
| MAP-05 | Phase 2 | Pending |
| MAP-06 | Phase 2 | Pending |
| PLAC-01 | Phase 3 | Pending |
| PLAC-02 | Phase 3 | Pending |
| PLAC-03 | Phase 3 | Pending |
| EDIT-01 | Phase 4 | Pending |
| EDIT-02 | Phase 4 | Pending |
| EDIT-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0

---
*Requirements defined: 2026-06-17*
*Last updated: 2026-06-17 after roadmap creation*
