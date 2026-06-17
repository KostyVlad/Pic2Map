# PhotoMap

## What This Is

PhotoMap is a web service for personal travel maps. A user signs up, uploads their
photos, and the service reads GPS coordinates from each photo's EXIF metadata to
automatically drop pins on a world map. Photos without geodata can be placed manually
by clicking the map. Clicking a pin reveals all photos taken in that place. Each user
sees only their own private map.

## Core Value

Upload a photo → it lands on the world map by itself, in the right place — and the map
of pins with per-place photo viewing feels good to browse. Both the EXIF auto-placement
"magic" and the map/viewing experience are equally essential.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. -->

- [ ] User can sign up and log in; each account's photos and map are isolated (private)
- [ ] User can upload photo files from their device
- [ ] Service reads GPS coordinates from photo EXIF and auto-places a pin on the map
- [ ] Photos without GPS data can be placed manually by clicking a location on the map
- [ ] World map shows pins; nearby photos cluster into one marker and expand on zoom-in
- [ ] Photos are also grouped by place/city name via reverse geocoding
- [ ] Clicking a pin/place shows all photos the user took there
- [ ] Responsive web UI that works in mobile browsers

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Cloud photo import (Google Photos, iCloud, etc.) — significant scope (OAuth, 3rd-party
  APIs, rate limits); deferred to v2
- Social features (viewing others' maps, profiles, follows, feed, sharing links) — each
  user sees only their own map in v1; deferred to a later milestone
- Native mobile app (React Native, etc.) — web-first; mobile is a separate later phase

## Context

- **Stack ecosystem:** MERN (MongoDB, Express, React, Node) — the project lives in a MERN
  workspace, so this is the intended stack.
- **Photo source pattern:** Users have photos scattered in their gallery that already carry
  EXIF GPS tags. The whole point is to surface those geotags on a map without manual work.
- **Mixed data quality:** Some photos have GPS in EXIF, some don't — the app must handle
  both (auto-place when present, manual-place when absent).
- **Privacy posture:** Public sign-up but strictly private per-user data — auth and data
  isolation matter from day one even though there are no social features.

## Constraints

- **Tech stack**: MERN (MongoDB, Express, React, Node) — workspace is set up for MERN.
- **Platform**: Web first (responsive) — mobile app deferred, so no native-only assumptions.
- **Security**: Multi-user with strict data isolation — every photo/map query must be
  scoped to the authenticated user; uploaded files must not leak across accounts.
- **Data**: Photos can be large and numerous — storage and serving strategy must scale
  beyond storing raw binaries inline in documents.

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Public service with private per-user maps | Anyone can sign up, but no social layer in v1 — keeps scope focused while supporting multiple users | — Pending |
| File upload only in v1; cloud import → v2 | Cloud integration (OAuth, external APIs, limits) is large; ship a working product faster | — Pending |
| Auto-place from EXIF + manual fallback | Photos have mixed GPS availability; both paths are needed for the map to be complete | — Pending |
| Map clustering + city-level grouping | "All photos in Rome" implies both spatial clustering on the map and place/city grouping via reverse geocoding | — Pending |
| Web-first (responsive), mobile later | MERN workspace, fastest path to a usable product; mobile is its own future phase | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-17 after initialization*
