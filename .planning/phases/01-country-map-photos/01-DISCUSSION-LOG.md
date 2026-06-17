# Phase 1: Country Map & Per-Country Photos - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-17
**Phase:** 1-country-map-photos
**Areas discussed:** Concept/build-order pivot, accounts timing, country highlighting

---

> **Note:** This phase replaced an earlier "Auth, Upload & Data Foundation" Phase 1 after
> the user redirected the product to a country-first model. The roadmap was restructured
> (PROJECT.md, REQUIREMENTS.md, ROADMAP.md updated) before this context was captured.

## Concept / build order

| Option | Description | Selected |
|--------|-------------|----------|
| EXIF auto-pins later | Countries manually now; EXIF auto-placement + pins added later | |
| Switch to countries | Country-organized model replaces pins entirely | |
| Both | Countries now; later, EXIF pins inside a country where GPS exists | ✓ |

**User's choice:** Both — country-first now, EXIF pins inside countries later.
**Notes:** Long-term EXIF "magic" preserved; manual country flow is the start and stays as fallback.

## Accounts timing

| Option | Description | Selected |
|--------|-------------|----------|
| Map first, no login | Country map + upload with no accounts; auth retrofitted later | ✓ |
| Map + accounts together | Auth from the start | |

**User's choice:** Start with just the map (no accounts).
**Notes:** Auth + per-user isolation become Phase 2; Phase 1 data migrated then.

## Country highlighting

| Option | Description | Selected |
|--------|-------------|----------|
| Filled if has photos | All clickable; countries with photos filled with color | |
| Highlight on hover | All borders drawn; country highlights on hover/selection | ✓ |
| Heatmap | Color intensity by photo count | |

**User's choice:** Highlight on hover/selection.
**Notes:** Countries with photos still get a visual marker (D-03), but base interaction is hover highlight; heatmap deferred.

## Claude's Discretion

- Country-boundary data source & rendering (e.g. Natural Earth GeoJSON + Leaflet GeoJSON layer) — flagged for phase research.
- Free-tier tile provider (Stadia/MapTiler), env-configurable.
- Upload formats JPEG/PNG/WebP/HEIC (HEIC→JPEG), ~25 MB/file, ~50/batch; magic-byte validation; thumbnail sizes.

## Deferred Ideas

- Accounts/login → Phase 2 · EXIF GPS + pins + clustering → Phase 3 · cities/edit/delete/progress/mobile → Phase 4
- S3/R2 → v2 · heatmap coloring, client-side EXIF preview → later
