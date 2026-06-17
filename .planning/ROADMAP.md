# Roadmap: PhotoMap

## Overview

PhotoMap ships in four vertical slices. Phase 1 lays the only foundation that cannot be
retrofitted: user isolation, the ingest pipeline (the product's core "magic"), and the
storage abstraction. Phase 2 delivers the interactive world map and viewing experience that
makes the product feel complete. Phase 3 adds reverse geocoding and place grouping. Phase 4
closes the loop with manual pin placement, pin editing, and photo deletion.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Auth, Upload & Data Foundation** - Secure accounts, EXIF ingest pipeline, StorageAdapter, scoped Photo API
- [ ] **Phase 2: Map UI & Core Viewing** - Interactive world map, clustering, lightbox gallery, responsive UI
- [ ] **Phase 3: Reverse Geocoding & Places** - Async geocode worker, place/city grouping, place-filter sidebar
- [ ] **Phase 4: Manual Placement & Editing** - GPS-less photo placement, pin move/edit, photo deletion

## Phase Details

### Phase 1: Auth, Upload & Data Foundation
**Goal**: Users can securely sign up, log in, and upload photos that are auto-placed on the map using EXIF GPS — with all non-retrofittable security and storage decisions locked in from the start.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, UPLD-01, UPLD-02, UPLD-03, UPLD-04, UPLD-05, UPLD-06, UPLD-07, UPLD-08
**Success Criteria** (what must be TRUE):
  1. User can sign up with email/password, log in, stay logged in across a browser refresh, and log out — session via httpOnly JWT cookie.
  2. User can upload one or more photos and see per-file progress and success/failure status for each.
  3. Uploaded photos with GPS in EXIF are stored with their coordinates; photos without GPS are accepted and marked as needing manual placement — no upload is silently dropped.
  4. Served image files have EXIF (including GPS) stripped, HEIC/HEIF converted to JPEG, and thumbnails generated — raw binaries are never stored in MongoDB.
  5. A different user's authenticated session cannot retrieve, view, or modify any photo belonging to another account.
**Plans**: TBD

### Phase 2: Map UI & Core Viewing
**Goal**: Users can see all their geolocated photos as pins on a world map, cluster/zoom naturally, click a pin to view photos in a lightbox, and use the app comfortably on mobile.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: MAP-01, MAP-02, MAP-03, MAP-04, MAP-05, MAP-06
**Success Criteria** (what must be TRUE):
  1. World map loads showing a pin for every geolocated photo the user has uploaded.
  2. When many pins are close together they cluster into a single marker; zooming in expands the cluster to individual pins.
  3. Clicking a pin or cluster shows all photos taken at that location in a lightbox/gallery the user can navigate.
  4. Map tiles load from a configured free-tier provider (env-variable selectable); raw OSM tiles are not used in production.
  5. The full map and lightbox experience is usable on a mobile browser without horizontal scrolling or broken layouts.
**Plans**: TBD
**UI hint**: yes

### Phase 3: Reverse Geocoding & Places
**Goal**: Photos are enriched with place/city names via an async background worker, and users can browse and filter their map by place.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: PLAC-01, PLAC-02, PLAC-03
**Success Criteria** (what must be TRUE):
  1. After upload, each geolocated photo is eventually assigned a place/city name without the upload request being slowed down — the geocoding runs asynchronously at a rate that respects Nominatim's 1 req/s limit.
  2. User can see a list of all distinct places/cities they have photos in.
  3. User can select a place from the list and see only photos taken in that place.
**Plans**: TBD

### Phase 4: Manual Placement & Editing
**Goal**: Users can place GPS-less photos on the map by clicking a location, reposition any existing pin, and delete photos — completing full map control.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: EDIT-01, EDIT-02, EDIT-03
**Success Criteria** (what must be TRUE):
  1. User can select a GPS-less photo from a "needs placement" queue and click a spot on the map to place it — after which it appears as a normal pin.
  2. User can drag or otherwise reposition an existing pin and the new location persists after page reload.
  3. User can delete a photo and it immediately disappears from the map and photo list.
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Auth, Upload & Data Foundation | 0/TBD | Not started | - |
| 2. Map UI & Core Viewing | 0/TBD | Not started | - |
| 3. Reverse Geocoding & Places | 0/TBD | Not started | - |
| 4. Manual Placement & Editing | 0/TBD | Not started | - |
