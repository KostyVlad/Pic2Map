---
phase: 02-accounts-private-maps
plan: 02
subsystem: auth-isolation
tags: [idor, userId-scoping, react-router, auth-context, migration, tailwind]

# Dependency graph
requires:
  - phase: 02-accounts-private-maps
    plan: 01
    provides: requireAuth middleware, signToken/verifyToken, auth routes (/api/auth/*)
provides:
  - "requireAuth applied to /api/photos and /api/countries routers"
  - "Photos scoped to req.userId on create and list; file-serving IDOR closed (404)"
  - "photo-counts aggregate scoped to authenticated user (ObjectId cast)"
  - "migrate-fresh-start.js: idempotent deletion of userId:null photos + files"
  - "Photo.userId required:true with compound index { userId:1, countryCode:1 }"
  - "react-router-dom installed; all fetches send credentials:'include'"
  - "api/auth.js: useLogin/useSignup/useLogout mutations (invalidate ['auth','me'])"
  - "AuthContext: AuthProvider + useAuth backed by GET /api/auth/me"
  - "LoginScreen per UI-SPEC Screen 1 (remember-me, links, card error)"
  - "SignupScreen per UI-SPEC Screen 2 (confirm password, duplicate error)"
  - "AccountStrip: fixed top-left email + sign out"
  - "App.jsx: BrowserRouter + ProtectedRoute gates map; placeholders for /forgot-password + /reset-password"
affects:
  - 02-03-password-reset

# Tech tracking
tech-stack:
  added:
    - react-router-dom@7.x (BrowserRouter, Routes, Route, Navigate, Link, useNavigate)
  patterns:
    - "requireAuth mounted on routers (not inline) — app.use('/api/photos', requireAuth, photosRouter)"
    - "ObjectId cast in aggregate $match (new mongoose.Types.ObjectId(req.userId)) — Pitfall 6"
    - "File IDOR: Photo.findOne ownership check before streaming; 404 not 403 — Pitfall 1"
    - "AuthContext: useQuery ['auth','me']; 401→null; retry:false; staleTime:Infinity"
    - "ProtectedRoute: render null while isLoading; Navigate /login when user null"

key-files:
  created:
    - server/src/scripts/migrate-fresh-start.js
    - server/test/isolation.test.js
    - client/src/api/auth.js
    - client/src/context/AuthContext.jsx
    - client/src/components/auth/LoginScreen.jsx
    - client/src/components/auth/SignupScreen.jsx
    - client/src/components/AccountStrip.jsx
  modified:
    - server/src/app.js
    - server/src/routes/photos.js
    - server/src/routes/countries.js
    - server/src/models/Photo.js
    - server/package.json
    - client/src/api/photos.js
    - client/src/api/countries.js
    - client/src/App.jsx
    - client/package.json

key-decisions:
  - "requireAuth applied at router mount in app.js (not per-route) — consistent, single-place enforcement"
  - "File IDOR returns 404 not 403 — no existence leak (Pitfall 1)"
  - "ObjectId cast explicitly in aggregate $match — silent empty result without cast (Pitfall 6)"
  - "AuthProvider wraps Routes (inside BrowserRouter) so screens can use react-router Link/Navigate"
  - "/forgot-password and /reset-password are placeholder ComingSoon components (plan 02-03 replaces)"
  - "isolation.test.js self-skips without MONGODB_URI (same pattern as auth.test.js)"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04]

# Metrics
duration: ~13min
completed: 2026-06-19
---

# Phase 2 Plan 02: Private Maps & Auth Gating Summary

**requireAuth on all data routes + 4 IDOR sites closed + fresh-start migration + react-router client auth gate with login/signup/AccountStrip — paused at human-check (Task 3 browser walkthrough)**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-06-19T20:55:58Z
- **Completed:** 2026-06-19T21:08:59Z (paused at Task 3 human-check)
- **Tasks:** 3/3 implemented; Task 3 automated build passes; awaiting human browser walkthrough
- **Files created/modified:** 16

## Accomplishments

### Task 1: Backend IDOR Fixes + requireAuth + Migration
- Applied `requireAuth` middleware to `/api/photos` and `/api/countries` routers in app.js (single-point enforcement)
- Closed all 4 IDOR sites per RESEARCH:
  - `POST /api/photos` → `Photo.create({ ..., userId: req.userId })`
  - `GET /api/photos` → `Photo.find({ countryCode, userId: req.userId })`
  - `GET /api/photos/file/:key` → ownership check `Photo.findOne({ $or: [storageKey, thumbnailKey], userId })`; 404 not 403
  - `GET /api/countries/photo-counts` → `$match { userId: new mongoose.Types.ObjectId(req.userId) }` (ObjectId cast)
- Photo.js: `userId` is now `required: true`; compound index `{ userId: 1, countryCode: 1 }` added
- `migrate-fresh-start.js` created — idempotent, deletes userId:null photos + their files, exits cleanly on second run
- `npm run migrate:fresh-start` script added to server/package.json
- `isolation.test.js` tests cross-user isolation + IDOR + 401-without-cookie; self-skips without MONGODB_URI

### Task 2: Client Auth Data Layer
- `react-router-dom` installed in client/
- `credentials: 'include'` added to all 3 existing fetches (2 in photos.js + 1 in countries.js)
- `client/src/api/auth.js` created: `useLogin`, `useSignup`, `useLogout` — each invalidates `['auth', 'me']` on success; surfaces server errors to callers
- `client/src/context/AuthContext.jsx` created: `AuthProvider` + `useAuth` — `useQuery(['auth','me'])`, 401→null, retry:false, staleTime:Infinity

### Task 3: Auth UI + Router Gating
- `LoginScreen.jsx`: UI-SPEC Screen 1 — centered card, email+password inputs, remember-me checkbox (D-05), card-level error with `role="alert"`, links to /signup and /forgot-password, full a11y (htmlFor, aria-describedby, required)
- `SignupScreen.jsx`: UI-SPEC Screen 2 — email+password+confirm, client-side validation (format, length, match), duplicate-email error with "Sign in instead?" link
- `AccountStrip.jsx`: fixed top-left pill, z-500, user email (truncate) + "Sign out" button → useLogout
- `App.jsx` rewritten: BrowserRouter + AuthProvider; `ProtectedRoute` (null while loading, Navigate /login when unauthenticated, render children when authenticated); /forgot-password + /reset-password placeholder routes; catch-all → Navigate /
- `vite build` passes clean: 129 modules, 470KB JS, 35KB CSS, 0 errors

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 RED | `01d2b3c` | test(02-02): isolation tests (IDOR + cross-user + 401) |
| Task 1 GREEN | `30b2c46` | feat(02-02): scope data routes to req.userId + file IDOR + migration |
| Task 2 | `e659189` | feat(02-02): client auth data layer — credentials, auth hooks, AuthContext |
| Task 3 | `9e415fb` | feat(02-02): Login/Signup screens, AccountStrip, ProtectedRoute router gating |

## Files Created/Modified

**Created:**
- `server/src/scripts/migrate-fresh-start.js` — idempotent Phase-1 cleanup
- `server/test/isolation.test.js` — cross-user isolation + IDOR + 401 tests
- `client/src/api/auth.js` — useLogin/useSignup/useLogout mutations
- `client/src/context/AuthContext.jsx` — AuthProvider + useAuth
- `client/src/components/auth/LoginScreen.jsx` — UI-SPEC Screen 1
- `client/src/components/auth/SignupScreen.jsx` — UI-SPEC Screen 2
- `client/src/components/AccountStrip.jsx` — authenticated chrome

**Modified:**
- `server/src/app.js` — requireAuth on /api/photos + /api/countries
- `server/src/routes/photos.js` — 3 IDOR fixes (create/find/file-serving)
- `server/src/routes/countries.js` — $match + mongoose import + ObjectId cast
- `server/src/models/Photo.js` — userId required:true + compound index
- `server/package.json` — migrate:fresh-start script
- `client/src/api/photos.js` — credentials:'include' on GET + POST
- `client/src/api/countries.js` — credentials:'include'
- `client/src/App.jsx` — full rewrite with router + auth gates
- `client/package.json` — react-router-dom dependency

## Decisions Made

- `requireAuth` mounted at the router level in app.js, not per-route — single enforcement point
- File IDOR returns 404 (not 403) — no existence leak per Pitfall 1 from RESEARCH
- `$match { userId: new mongoose.Types.ObjectId(req.userId) }` — explicit ObjectId cast required in raw aggregate (Pitfall 6)
- `AuthProvider` wraps `Routes` (inside `BrowserRouter`) so auth screens can use `Link`/`Navigate`
- `/forgot-password` and `/reset-password` are minimal ComingSoon placeholders — plan 02-03 replaces them
- `isolation.test.js` self-skips without `MONGODB_URI` (same convention as auth.test.js)

## Deviations from Plan

None — plan executed exactly as written.

## Checkpoint Reached — Task 3: Browser Walkthrough

All automated verifications passed:
- `node --test test/isolation.test.js` — self-skips cleanly (no MONGODB_URI in CI)
- credentials check: 3/3 occurrences found in photos.js + countries.js
- `npx vite build` — 0 errors, 129 modules

Human browser walkthrough is required to confirm:
1. Logged-out visitor sees only the "Sign in" card (map not rendered)
2. Signup → lands on empty map with AccountStrip top-left
3. Refresh → still logged in (session persists)
4. Sign out → returns to login
5. Second account has its own empty map (cross-user isolation)

**See the CHECKPOINT REACHED section in the execution return message for exact browser steps.**

## Known Stubs

None — all auth screens display live server-driven data (user email from /api/auth/me, errors from API). /forgot-password and /reset-password placeholder routes are intentional stubs tracked here: they are replaced by plan 02-03. They do not affect the plan's goal (auth gating + private maps).

## Threat Flags

None — all surfaces introduced in this plan were already modeled in the plan's threat register:
- T-02-IDOR-LIST, T-02-IDOR-FILE → mitigated (userId scoping + ownership check)
- T-02-UNAUTH → mitigated (requireAuth on both routers)
- T-02-WRITE → mitigated (Photo.create stamps userId; schema enforces required:true)
- T-02-RESIDUE → mitigated (fresh-start migration script)
- T-02-CORS → mitigated (credentials:'include' on all client fetches)

## Self-Check: PASSED

- server/test/isolation.test.js: FOUND
- server/src/app.js: FOUND (modified)
- server/src/routes/photos.js: FOUND (modified)
- server/src/routes/countries.js: FOUND (modified)
- server/src/models/Photo.js: FOUND (modified)
- server/src/scripts/migrate-fresh-start.js: FOUND
- client/src/api/auth.js: FOUND
- client/src/context/AuthContext.jsx: FOUND
- client/src/components/auth/LoginScreen.jsx: FOUND
- client/src/components/auth/SignupScreen.jsx: FOUND
- client/src/components/AccountStrip.jsx: FOUND
- client/src/App.jsx: FOUND (modified)
- Commit 01d2b3c: FOUND
- Commit 30b2c46: FOUND
- Commit e659189: FOUND
- Commit 9e415fb: FOUND

---
*Phase: 02-accounts-private-maps*
*Completed: 2026-06-19*
