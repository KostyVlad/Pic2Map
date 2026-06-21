# Phase 3: EXIF Auto-Placement & Pins - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-21
**Phase:** 03-exif-auto-placement-pins
**Areas discussed:** GPS source, Upload flow, GPS outside any country

---

## GPS source

| Option | Description | Selected |
|--------|-------------|----------|
| Local (exifr) | exifr reads EXIF from the raw buffer server-side before ingest; storage-agnostic | ✓ |
| Cloudinary image_metadata | Cloudinary returns EXIF/GPS in the upload response; less code but couples to Cloudinary | |

**User's choice:** Local (exifr)
**Notes:** Keeps GPS extraction independent of the storage backend (works with both local disk and Cloudinary); raw buffer is already available in the upload route before EXIF is stripped.

---

## Upload flow

| Option | Description | Selected |
|--------|-------------|----------|
| From country panel, GPS self-distributes | Keep current click-country→upload; GPS photos route to their real country, no-GPS go to the open country | |
| Global upload button | Separate "Upload" outside the country panel; each photo distributed by GPS | ✓ |

**User's choice:** Global upload button

**Follow-up — no-GPS photos in the global upload:**

| Option | Description | Selected |
|--------|-------------|----------|
| Ask country immediately | Inline country picker for no-GPS photos after upload | |
| "Awaiting placement" bucket | No-GPS photos go to a separate unplaced list, assigned later | |
| Via country panel | Global upload is GPS-only; no-GPS photos added through the (retained) country panel | ✓ |

**User's choice:** Via country panel
**Notes:** Two entry points — global Upload for GPS photos; per-country panel upload remains the manual path (GEO-05). Global upload reports the no-location remainder.

---

## GPS outside any country

| Option | Description | Selected |
|--------|-------------|----------|
| Same as no GPS | Coordinates matching no country → not auto-placed, included in the "add manually" report | ✓ |
| Nearest country | Snap to the closest country by distance | |

**User's choice:** Same as no GPS
**Notes:** Avoids mid-ocean → random-country errors; single predictable fallback path.

---

## Claude's Discretion

- exifr field/sign handling (avoid lat/long transposition), malformed-EXIF error handling
- Point-in-polygon library + how the server loads/caches `countries.geojson`
- Storing coordinates in the existing `Photo.location` field
- Clustering via `use-supercluster`; pin/cluster visuals per UI-SPEC

## Deferred Ideas

- Backfilling GPS for already-uploaded Phase 1/2 photos (user skipped this area)
- Reverse-geocoded city names — Phase 4 (POL-01/02)
- Moving/repositioning pins, changing a photo's country — Phase 4 (POL-03)
- Per-file upload progress — Phase 4 (POL-05)
