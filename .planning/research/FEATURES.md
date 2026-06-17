# Feature Landscape

**Domain:** Personal photo travel-map web application
**Researched:** 2026-06-17

---

## Table Stakes

Features users expect from any photo-map product. Missing = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Drag-and-drop + click-to-browse file upload | Every modern file uploader has this; absence feels 2010 | Low | Accept JPEG/HEIC/PNG; show per-file status |
| Bulk upload (multiple files at once) | Users have dozens to hundreds of trip photos; one-at-a-time is unusable | Med | Queue management, per-file progress, partial failure handling |
| Upload progress feedback | Without it users think the app is broken and retry, causing duplicates | Low | Per-file progress bar or spinner + success/error state per photo |
| EXIF GPS auto-placement | The core "magic" of the product — reads lat/lon from EXIF and pins the photo without user action | Med | Use `exifr` or `piexifjs` client-side pre-parse or server-side with `sharp`/`exif-reader`; must handle absence gracefully |
| Manual pin placement for photos without GPS | A significant fraction of photos (screenshots, scanned prints, cloud saves) have no EXIF GPS; users need a path to place them | Med | Click-on-map flow or search-by-place-name; must not block upload |
| World map view with pins | The primary UI surface; the whole product is "see your photos on a map" | Med | Leaflet.js + OpenStreetMap tiles is free and sufficient for v1 |
| Marker clustering (zoom-based) | With 200+ photos a city will have overlapping pins making the map unusable | Med | `Leaflet.markercluster` or `supercluster`; cluster expands on zoom-in |
| Click pin to see all photos at that location | Core interaction: the map is the index, the photos are the content | Med | Opens a gallery/lightbox panel showing all photos at that cluster/place |
| Photo lightbox / gallery viewer per location | Users expect to see photos full-size, navigate prev/next; a thumbnail grid alone is not enough | Med | Swipeable lightbox with keyboard nav; `yet-another-react-lightbox` is a solid React choice |
| Place/city grouping via reverse geocoding | Users think in place names ("all my Rome photos"); pure coordinate clusters do not satisfy this | Med | Call Nominatim `/reverse` at upload time; store resolved city+country; rate-limit at 1 req/s |
| Private per-user map | Users will not trust the app if their private travel history might be visible to others | Med | Auth + every DB query scoped to `userId`; JWT/session auth; no cross-user data leakage |
| User sign-up and login | Required for isolation; also enables return visits | Low–Med | Email + password with bcrypt; JWT or session; standard pattern |
| Delete a photo | Users make mistakes, upload wrong files, or want to prune; inability to delete feels like a trap | Low | Soft or hard delete; also removes the pin if that was the only photo at a location |
| Edit/move a pin location | EXIF coordinates are sometimes wrong (wrong timezone offset stored as GPS, indoor photos off by city blocks); users need to correct | Med | Drag-pin-on-map interaction or search-by-place; updates stored coordinates |
| Responsive web UI (works on mobile browser) | The product spec says "responsive web UI that works in mobile browsers"; many users will visit on phone | Med | Leaflet works fine on mobile touch; gallery must be touch-swipeable |

---

## Differentiators

Features that set this product apart from a bare-bones EXIF viewer. Not expected, but add meaningful value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| "No GPS" workflow with inline manual placement | Most tools either ignore photos without GPS or silently skip them. Surfacing these and letting the user place them during or after upload closes the gap | Med | Show a "needs location" queue; clicking opens the map for pin-drop |
| Client-side EXIF preview before upload | Show the user which photos have GPS before committing the upload; they can abort or annotate missing ones | Med | Parse EXIF in the browser with `exifr`; show a pre-flight list with GPS yes/no |
| Place name as browseable grouping | "All photos in Kyoto" as a named group, not just a zoom-in cluster. Presents travel as a list of places visited | Med | Reverse geocode at ingest; store city + country; expose place-list sidebar |
| Timeline view (photos sorted by date) | Chronological browse complements the map; users relive trips in order | Med | Use `DateTimeOriginal` from EXIF; fallback to file mtime |
| Photo count badge on cluster and place | Immediately communicates "there are 47 photos in Tokyo" without clicking | Low | Rendered on marker or in place list |
| Thumbnail grid preview on map hover/popup | Quick peek without opening full lightbox reduces navigation friction | Low | Small preview of first 3–4 photos on cluster hover |
| Graceful handling of duplicate uploads | Re-uploading the same file should not create a double pin | Med | Hash-based dedup (SHA-256 of file content) at ingest |
| Search/filter by place name or date range | Users with many trips want to jump to "Italy 2023" without scrolling the whole map | Med | Text search against stored city names; date-range filter using `DateTimeOriginal` |

---

## Anti-Features

Features to explicitly NOT build in v1. Listed here to prevent scope creep.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Cloud photo import (Google Photos, iCloud, Dropbox) | OAuth integration, third-party API rate limits, token refresh, scope negotiation — this is a project of its own. Explicitly out of v1 scope per PROJECT.md | Accept file uploads only; note cloud import as a future milestone |
| Social features (public profiles, sharing links, feed, follows) | Per PROJECT.md, each user sees only their own map in v1; social adds auth complexity, moderation risk, and a different product surface | Keep all data private; share links and public profiles are a later milestone |
| Native mobile app (iOS / Android) | Web-first; a native app is a separate phase. Building it in v1 splits focus | Ensure the web UI is touch-responsive; mobile app is a v2 decision |
| In-app photo editing (crop, filters, color) | Not a photo editor; a map indexer. Adding editing expands scope dramatically with no core-value gain | Let users edit photos in their own tools before uploading |
| Video support | EXIF-GPS parsing works differently for video; storage costs jump; codec transcoding is a separate system | Photo (JPEG/HEIC/PNG) only for v1; video is a separate consideration |
| AI/ML auto-labeling (face recognition, scene detection) | Significant ML infra, privacy concerns, latency; no stated need in v1 | Reverse geocoding for place names is the only automated label needed |
| Export to KML/GPX/PDF | Low initial demand; adds file-generation complexity | Can be added later as a power-user feature |
| Trip/album manual organization | Automatic grouping by place + date covers the v1 value; manual album curation adds UI and data-model complexity | Let place groups serve as the implicit album; manual albums are a future feature |
| Real-time collaborative maps | Multi-user editing adds websocket infra and conflict resolution; no stated need | Single-user private map only |
| Offline / PWA mode | Service worker caching for map tiles and photos adds significant complexity; web-first is enough | Standard web app; no offline requirement in v1 |

---

## Feature Dependencies

```
User auth (sign-up / login)
  → Per-user data isolation
      → Photo upload
          → EXIF GPS parse
              → Auto-pin on map
          → Manual pin placement (if no GPS or GPS wrong)
          → Reverse geocoding
              → Place/city grouping
                  → Place list / sidebar view
      → Delete photo (requires auth ownership check)
      → Edit pin location (requires auth ownership check)

World map view
  → Marker clustering (performance with many pins)
      → Click cluster/pin → gallery lightbox
          → Photo lightbox / prev-next navigation
          → Timeline view (sorted by date per place)

Bulk upload
  → Upload progress feedback (UX)
  → Duplicate detection (data quality)
  → Client-side EXIF preview (optional but high value)

Search / filter by place or date
  → Requires stored city name (from reverse geocoding)
  → Requires stored DateTimeOriginal (from EXIF or fallback)
```

---

## MVP Recommendation

Prioritize in this order:

1. **User auth + per-user isolation** — foundation for everything; must be correct from day one
2. **File upload (single + bulk, drag-drop) + progress feedback** — primary input path
3. **EXIF GPS parse + auto-pin on map** — the core value proposition; this is the "magic"
4. **World map with Leaflet + clustering** — the primary UI; needed to see the value
5. **Click cluster/pin → lightbox gallery** — closes the core loop (upload → see on map → browse)
6. **Manual pin placement for no-GPS photos** — large fraction of real-world photos need this
7. **Reverse geocoding + place grouping** — second core value ("all my Rome photos"); can be async after upload
8. **Delete photo + edit pin location** — necessary for a trustworthy product; users will need these fast
9. **Responsive mobile UI** — required by spec; Leaflet works on touch natively

Defer to post-MVP:
- **Search / filter**: Useful but not required for the first working product; add once place grouping is solid
- **Timeline view**: Nice supplement to map; add after place grouping works
- **Client-side EXIF preview pre-upload**: High polish, medium effort; ship after core loop is stable
- **Duplicate detection**: Important for data quality; can be a follow-up fix once uploads work

---

## Sources

- Polarsteps feature description: [mattsnextsteps.com](https://mattsnextsteps.com/how-to-use-polarsteps-ultimate-polarsteps-tutorial/) / [polarsteps.com](https://www.polarsteps.com/)
- Google Photos map view: [makeuseof.com](https://www.makeuseof.com/map-view-google-photos-see-images-on-map/) / [Google Photos Help](https://support.google.com/photos/answer/6153599)
- Journi place-grouping: [journiapp.com](https://www.journiapp.com/e/htotp/) / [tripmemo.app comparison](https://tripmemo.app/best-travel-journal-apps)
- Immich map features: [deepwiki.com/immich-app](https://deepwiki.com/immich-app/immich/4.6-map-and-location-features) / [pixelunion.eu](https://pixelunion.eu/blog/2026/05/immich-map-view/)
- GeoPhoto manual geotagging UX: [geophoto.app](https://geophoto.app/en) / [timopartl.com FAQ](https://timopartl.com/faq?app=GeoPhoto)
- Map clustering UX pattern: [mapuipatterns.com](https://mapuipatterns.com/cluster-marker/) / [medium.com pins vs clusters](https://medium.com/@letstalkproduct/the-map-search-experience-pins-vs-clusters-b3d18d8159c5)
- Leaflet.markercluster / supercluster performance: [medium.com Leaflet optimization](https://medium.com/@silvajohnny777/optimizing-leaflet-performance-with-a-large-number-of-markers-0dea18c2ec99) / [Mapbox supercluster blog](https://blog.mapbox.com/clustering-millions-of-points-on-a-map-with-supercluster-272046ec5c97)
- Nominatim reverse geocoding limits: [nominatim.org](https://nominatim.org/) / [OSM Wiki](https://wiki.openstreetmap.org/wiki/Nominatim)
- Upload progress UX: [uploadcare.com best practices](https://uploadcare.com/blog/file-uploader-ux-best-practices/) / [filestack drag-drop 2025](https://blog.filestack.com/building-modern-drag-and-drop-upload-ui/)
- Filter / search UX: [Google Photos API filters](https://developers.google.com/photos/library/guides/apply-filters) / [uxpin.com filter UI](https://www.uxpin.com/studio/blog/filter-ui-and-ux/)
