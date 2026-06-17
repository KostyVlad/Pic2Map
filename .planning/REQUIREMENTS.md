# Requirements: PhotoMap

**Defined:** 2026-06-17
**Core Value:** Browse your travels on a world map organized by the countries you've visited — click a country to add and view its photos — with photos auto-placing by GPS over time.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Country Map (CMAP)

- [ ] **CMAP-01**: Interactive world map renders all country boundaries
- [ ] **CMAP-02**: A country highlights on hover / when selected
- [ ] **CMAP-03**: User can click a country to select/open it
- [ ] **CMAP-04**: Countries that contain photos are visually marked on the map
- [ ] **CMAP-05**: Base map tiles served from a configured free-tier provider (env-configurable)

### Photos by Country (PHOTO)

- [ ] **PHOTO-01**: User can upload photo files (single and bulk) to a selected country
- [ ] **PHOTO-02**: Service generates a thumbnail for each photo and strips EXIF (incl. GPS) from served image files
- [ ] **PHOTO-03**: HEIC/HEIF uploads are converted server-side to JPEG
- [ ] **PHOTO-04**: Uploads are validated (file type by magic bytes, size limit) and rejected with a clear message if invalid
- [ ] **PHOTO-05**: Photo files are stored via a storage abstraction (local disk in v1, swappable later), never inline in MongoDB
- [ ] **PHOTO-06**: User can open a country and view its photos in a gallery/lightbox

### Accounts & Isolation (AUTH)

- [ ] **AUTH-01**: User can sign up with email and password
- [ ] **AUTH-02**: User can log in and the session persists across browser refresh
- [ ] **AUTH-03**: User can log out
- [ ] **AUTH-04**: Every country and photo is scoped to the authenticated user (private maps); the pre-auth data model is migrated to per-user ownership

### EXIF Auto-Placement & Pins (GEO)

- [ ] **GEO-01**: On upload, service reads GPS coordinates from photo EXIF
- [ ] **GEO-02**: Service auto-assigns the country from coordinates (point-in-polygon) — no manual country pick needed when GPS is present
- [ ] **GEO-03**: Drilling into a country shows photo pins at their exact coordinates
- [ ] **GEO-04**: Nearby pins cluster into a single marker and expand on zoom
- [ ] **GEO-05**: Photos without GPS fall back to manual country assignment (the Phase 1 flow)

### Places, Editing & Polish (POL)

- [ ] **POL-01**: Service reverse-geocodes coordinates to a place/city name (async, rate-limited, cached)
- [ ] **POL-02**: Photos can be grouped/listed by place/city within a country
- [ ] **POL-03**: User can move a photo to a different country / reposition its pin
- [ ] **POL-04**: User can delete a photo (it disappears from the map and galleries)
- [ ] **POL-05**: User sees per-file upload progress and success/failure status
- [ ] **POL-06**: The UI is responsive and usable in a mobile browser

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
| CMAP-01 | Phase 1 | Pending |
| CMAP-02 | Phase 1 | Pending |
| CMAP-03 | Phase 1 | Pending |
| CMAP-04 | Phase 1 | Pending |
| CMAP-05 | Phase 1 | Pending |
| PHOTO-01 | Phase 1 | Pending |
| PHOTO-02 | Phase 1 | Pending |
| PHOTO-03 | Phase 1 | Pending |
| PHOTO-04 | Phase 1 | Pending |
| PHOTO-05 | Phase 1 | Pending |
| PHOTO-06 | Phase 1 | Pending |
| AUTH-01 | Phase 2 | Pending |
| AUTH-02 | Phase 2 | Pending |
| AUTH-03 | Phase 2 | Pending |
| AUTH-04 | Phase 2 | Pending |
| GEO-01 | Phase 3 | Pending |
| GEO-02 | Phase 3 | Pending |
| GEO-03 | Phase 3 | Pending |
| GEO-04 | Phase 3 | Pending |
| GEO-05 | Phase 3 | Pending |
| POL-01 | Phase 4 | Pending |
| POL-02 | Phase 4 | Pending |
| POL-03 | Phase 4 | Pending |
| POL-04 | Phase 4 | Pending |
| POL-05 | Phase 4 | Pending |
| POL-06 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0

---
*Requirements defined: 2026-06-17*
*Last updated: 2026-06-17 after roadmap restructure (country-first model)*
