# Roadmap: PhotoMap

## Overview

PhotoMap ships in four vertical slices, country-first. Phase 1 delivers the visible core:
an interactive world map of country boundaries where you click a country and upload/view
its photos — no accounts yet, single local user. Phase 2 adds accounts and private per-user
maps, migrating the data model to per-user ownership. Phase 3 layers in the EXIF "magic":
photos with GPS auto-assign to their country and drop pins at exact coordinates inside the
country (with clustering). Phase 4 closes the loop with reverse-geocoded cities, editing,
deletion, upload progress, and mobile polish.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Country Map & Per-Country Photos** - Interactive country-boundary map; click a country to upload and view its photos (no accounts) (completed 2026-06-19)
- [ ] **Phase 2: Accounts & Private Maps** - Sign up/login/logout, per-user data isolation, migrate to private maps
- [ ] **Phase 3: EXIF Auto-Placement & Pins** - Read GPS on upload, auto-assign country, pins inside countries with clustering
- [ ] **Phase 4: Places, Editing & Polish** - Reverse-geocoded cities, edit/move, delete, upload progress, mobile polish

## Phase Details

### Phase 1: Country Map & Per-Country Photos

**Goal**: A user can open an interactive world map where countries highlight on hover, click a country, upload photos to that country, and view that country's photos in a gallery — running as a single local user with no login.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: CMAP-01, CMAP-02, CMAP-03, CMAP-04, CMAP-05, PHOTO-01, PHOTO-02, PHOTO-03, PHOTO-04, PHOTO-05, PHOTO-06
**Success Criteria** (what must be TRUE):

  1. The world map renders all country boundaries and a country visibly highlights when hovered or selected.
  2. Clicking a country opens it, and the user can upload one or more photos that are stored and associated with that country.
  3. Uploaded photos get a thumbnail; HEIC/HEIF is converted to JPEG; served files have EXIF (incl. GPS) stripped; raw binaries are never stored in MongoDB.
  4. Opening a country shows its photos in a gallery/lightbox the user can browse.
  5. Countries that contain photos are visually marked on the map, and map tiles come from a configured free-tier provider.

**Plans**: 2 plansPlans:

- [x] 01-01-PLAN.md — Walking Skeleton: scaffold client/server, Mongo-backed upload→view path, country map click-to-select, ingest pipeline (HEIC/EXIF/magic-byte), gallery + lightbox
- [x] 01-02-PLAN.md — Refinement: country hover highlight, has-photos marking + count badges, bulk upload + drag-active + full validation-error/success UX

**UI hint**: yes

### Phase 2: Accounts & Private Maps

**Goal**: Users can sign up, log in, log out, and reset a forgotten password by email; every country and photo is scoped to its owner so each user has a private map. Unauthenticated visitors see only a login/signup screen; pre-auth test data is cleared (fresh start) and `userId` becomes required.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05
**Success Criteria** (what must be TRUE):

  1. User can sign up with email/password, log in, stay logged in across a browser refresh (longer with "Remember me"), and log out — session via httpOnly JWT cookie.
  2. Passwords are stored hashed (argon2id); credentials are never stored in plaintext.
  3. Every country/photo query (incl. file serving) is scoped to the authenticated user — one user cannot view or modify another user's photos.
  4. Unauthenticated visitors see only the login/signup page; pre-auth (userId=null) test data is cleared and new accounts start with an empty map.
  5. A user who forgets their password can request a reset link by email and set a new password.

**Plans**: 3 plans
Plans:
**Wave 1**

- [ ] 02-01-PLAN.md — Backend auth foundation: User model, jose JWT + argon2id, requireAuth, signup/login/logout/me + rate limiting (AUTH-01/02/03)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 02-02-PLAN.md — Private maps: userId scoping + IDOR fix on all data routes, fresh-start migration, client login/signup gating + AccountStrip (AUTH-04)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 02-03-PLAN.md — Password reset: email adapter (Resend), forgot/reset endpoints (hashed single-use token), forgot/reset screens (AUTH-05)

**UI hint**: yes

### Phase 3: EXIF Auto-Placement & Pins

**Goal**: When a user uploads a photo with GPS in EXIF, the app reads the coordinates, auto-assigns the photo to its country, and shows it as a pin at the exact location when the user drills into that country — with clustering and a manual fallback for GPS-less photos.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: GEO-01, GEO-02, GEO-03, GEO-04, GEO-05
**Success Criteria** (what must be TRUE):

  1. On upload, photos with EXIF GPS have their coordinates read and stored (correct hemisphere signs, no transposition).
  2. A geolocated photo is automatically assigned to the correct country by point-in-polygon — the user does not pick the country manually.
  3. Drilling into a country shows photo pins at their exact coordinates; nearby pins cluster and expand on zoom.
  4. Photos without GPS are accepted and fall back to the manual per-country assignment from Phase 1 — nothing is silently dropped.

**Plans**: TBD

### Phase 4: Places, Editing & Polish

**Goal**: Photos are enriched with city/place names via an async worker, and users can group by place, move/reposition photos, delete photos, see upload progress, and use the app comfortably on mobile.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: POL-01, POL-02, POL-03, POL-04, POL-05, POL-06
**Success Criteria** (what must be TRUE):

  1. Each geolocated photo is eventually assigned a place/city name asynchronously, respecting Nominatim's 1 req/s limit without slowing uploads.
  2. Within a country, photos can be grouped/listed by place/city.
  3. User can move a photo to a different country or reposition its pin, and the change persists after reload.
  4. User can delete a photo and it immediately disappears from the map and galleries.
  5. User sees per-file upload progress/status, and the full experience is usable on a mobile browser.

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Country Map & Per-Country Photos | 2/2 | Complete   | 2026-06-19 |
| 2. Accounts & Private Maps | 0/3 | Executing (02-01 at checkpoint) | - |
| 3. EXIF Auto-Placement & Pins | 0/TBD | Not started | - |
| 4. Places, Editing & Polish | 0/TBD | Not started | - |
