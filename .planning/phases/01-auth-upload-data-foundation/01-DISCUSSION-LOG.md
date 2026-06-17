# Phase 1: Auth, Upload & Data Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-17
**Phase:** 1-auth-upload-data-foundation
**Areas discussed:** What user sees in Phase 1, GPS-less photos in Phase 1

---

## Gray Areas Offered

| Area | Selected for discussion |
|------|-------------------------|
| Auth depth (email verification / password reset) | |
| Upload constraints (formats, size, batch) | |
| GPS-less photos in Phase 1 | ✓ |
| What user sees in Phase 1 | ✓ |

---

## What user sees in Phase 1

| Option | Description | Selected |
|--------|-------------|----------|
| Thumbnail grid | Gallery of uploaded photos as thumbnails | ✓ |
| Simple list | File list with name + status, no images | |
| Confirmation only | Only success status; gallery waits for Phase 2 map | |

**User's choice:** Thumbnail grid gallery
**Notes:** Makes Phase 1 a useful vertical slice before the Phase 2 map exists.

### Per-photo metadata in gallery

| Option | Description | Selected |
|--------|-------------|----------|
| Thumbnail + GPS status | Thumbnail + has/no-coordinates badge | ✓ |
| + date and coordinates | Also EXIF capture date and numeric coords | |
| Thumbnail only | Images with no metadata | |

**User's choice:** Thumbnail + GPS status badge
**Notes:** No city/place names — reverse geocoding is Phase 3.

---

## GPS-less photos in Phase 1

| Option | Description | Selected |
|--------|-------------|----------|
| In main gallery with badge | All photos together; GPS-less get a "no location" badge | |
| Separate section + filter | Gallery + a "needs placement" filter/tab | ✓ |
| Don't show yet | Store silently, surface only in Phase 4 | |

**User's choice:** Separate section / filter ("needs placement")
**Notes:** Surfacing/filter only in Phase 1; actual click-to-place interaction is Phase 4.

---

## Claude's Discretion

- **Auth depth:** v1 = simple email + password, login/logout only. No email verification,
  no password reset in v1 (matches REQUIREMENTS.md AUTH-01–04). Deferred.
- **Upload constraints:** Accept JPEG/PNG/WebP/HEIC (HEIC→JPEG server-side); ~25 MB/file,
  ~50 files/batch; magic-byte validation. Numbers configurable; planner may tune.

## Deferred Ideas

- Email verification & password reset — later auth-hardening phase/milestone
- Manual click-to-place interaction — Phase 4 (EDIT-01)
- City/place names on tiles — Phase 3 (geocoding)
- S3/R2 object storage — v2 (SCALE-01); StorageAdapter built now for easy swap
- Client-side EXIF preview — v2 (ENH-01)
