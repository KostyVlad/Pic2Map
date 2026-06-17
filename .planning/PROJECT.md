# PhotoMap

## What This Is

PhotoMap is a web service for personal travel maps, organized by country. The first
experience is an interactive world map where countries highlight on hover — you click a
country and upload/view the photos you took there. Over time the app layers in the EXIF
"magic": photos with GPS auto-assign to their country and drop pins at the exact location
inside it. Eventually each user has their own private, account-scoped map.

**Build order:** country map + per-country photos first (no accounts), then accounts &
private maps, then EXIF auto-placement & pins inside countries, then cities/editing/polish.

## Core Value

Browse your travels on a world map organized by the countries you've visited — click a
country to add and view its photos — with photos auto-placing by GPS over time. The
country-organized map and per-country photo viewing is the heart; EXIF auto-placement is
the "magic" layered on top.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. See REQUIREMENTS.md for the full list. -->

- [ ] Interactive world map of country boundaries; a country highlights on hover/selection
- [ ] User clicks a country to upload photos to it and view that country's photos
- [ ] Countries that contain photos are visually marked on the map
- [ ] Accounts (sign up/login/logout) with private, per-user maps (added after the map)
- [ ] Photos with EXIF GPS auto-assign to their country and show as pins inside it (clustered)
- [ ] Photos without GPS fall back to manual per-country assignment
- [ ] Reverse-geocoded city/place grouping, edit/move, delete, upload progress
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
| Country-first model: map of countries, click to add/view photos | Fastest visible, intuitive starting point; organizing by country precedes coordinate-level pins | — Pending |
| Start without accounts (single local user); add auth in Phase 2 | Get the map visible fastest; per-user isolation retrofitted next (migration accepted) | — Pending |
| Country highlight on hover/selection (not heatmap) | Simple, clear interaction for v1; photo-count coloring can come later | — Pending |
| EXIF auto-placement layered on later (Phase 3), inside countries | Keep the long-term "magic" but after the manual country flow exists; GPS auto-assigns country + exact pin | — Pending |
| Public service with private per-user maps | Anyone can sign up, no social layer in v1 — focused scope, multi-user | — Pending |
| File upload only in v1; cloud import → v2 | Cloud integration (OAuth, external APIs, limits) is large; ship faster | — Pending |
| Local disk + StorageAdapter (S3/R2 later) | Photo binaries never in MongoDB; swappable storage for production later | — Pending |
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
*Last updated: 2026-06-17 after roadmap restructure (country-first model)*
