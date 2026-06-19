---
phase: 02-accounts-private-maps
plan: 01
subsystem: auth
tags: [jwt, argon2, jose, cookie, express-rate-limit, resend, mongoose]

# Dependency graph
requires:
  - phase: 01-country-map-photos
    provides: Express app.js, config.js, Mongoose setup, Photo model with nullable userId
provides:
  - "User Mongoose model with unique email, passwordHash, resetToken fields"
  - "jose HS256 JWT signToken/verifyToken utils (D-03)"
  - "requireAuth middleware setting req.userId from httpOnly auth_token cookie"
  - "POST /api/auth/signup — argon2id hash, immediate login (AUTH-01)"
  - "POST /api/auth/login — no-enumeration 401, remember-me TTL (AUTH-02)"
  - "POST /api/auth/logout — cookie clear (AUTH-03)"
  - "GET /api/auth/me — returns authenticated user info"
  - "Rate limiting on /signup and /login (T-02-CS)"
  - "server/.env.example with Phase 2 auth variables documented"
affects:
  - 02-02-client-auth
  - 02-03-password-reset
  - 02-04-data-isolation

# Tech tracking
tech-stack:
  added:
    - jose@6.2.3 (JWT HS256 sign/verify)
    - argon2@0.44.0 (argon2id password hashing)
    - resend@6.14.0 (email — used in plan 02-03)
    - cookie-parser@1.4.7 (req.cookies parsing)
    - express-rate-limit@8.5.2 (login/signup rate limiting)
  patterns:
    - "httpOnly sameSite=lax cookie for session (D-03, never localStorage)"
    - "COOKIE_SECURE=false in dev, true in prod (Pitfall 3 avoidance)"
    - "Generic 401 message for all auth failures (T-02-ENUM, no enumeration)"
    - "argon2id hash at rest; plaintext never stored/logged (T-02-PW)"
    - "skipSuccessfulRequests on login limiter (only failed attempts count)"
    - "Cookie options must match between set and clear (clearCookie Pitfall)"

key-files:
  created:
    - server/src/models/User.js
    - server/src/utils/jwt.js
    - server/src/middleware/auth.js
    - server/src/routes/auth.js
    - server/test/auth.test.js
    - server/.env.example
  modified:
    - server/src/config.js
    - server/src/app.js
    - server/package.json

key-decisions:
  - "argon2id for password hashing (D-03 locked) — never bcrypt or MD5"
  - "jose HS256 JWT in httpOnly cookie — never localStorage (D-03 locked)"
  - "COOKIE_SECURE derived from NODE_ENV==='production' only (Pitfall 3)"
  - "Signup DOES reveal email-already-registered (intentional per UI-SPEC)"
  - "Login returns identical 401 + message for unknown email AND wrong password (T-02-ENUM)"
  - "rememberMe:true sets 30d cookie; default 1d (D-05)"
  - "JWT_SECRET guard in config.js throws startup error if unset"

patterns-established:
  - "Pattern: setAuthCookie/clearAuthCookie helpers — options must match or browser won't clear"
  - "Pattern: requireAuth reads req.cookies.auth_token, sets req.userId as string"
  - "Pattern: Integration tests self-skip when MONGODB_URI is absent (matches e2e test convention)"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03]

# Metrics
duration: 23min
completed: 2026-06-19
---

# Phase 2 Plan 01: Backend Auth Foundation Summary

**argon2id signup/login/logout/me over httpOnly JWT cookie (jose HS256), with rate limiting and remember-me TTL — paused at supply-chain checkpoint (Task 4)**

## Performance

- **Duration:** ~23 min
- **Started:** 2026-06-19T20:22:00Z
- **Completed:** 2026-06-19T20:45:44Z (paused at checkpoint)
- **Tasks:** 3/4 completed (Task 4 is a blocking human checkpoint — not executed)
- **Files created/modified:** 9

## Accomplishments

- Installed all five auth packages: jose, argon2, resend, cookie-parser, express-rate-limit (argon2 native build succeeded)
- Built User Mongoose model, jose JWT utils (signToken/verifyToken with 1d/30d TTL), requireAuth middleware
- Implemented all four auth endpoints (signup/login/logout/me) with argon2id hashing, httpOnly cookies, rate limiting, no-enumeration login
- 10 integration tests in auth.test.js that self-skip cleanly without MONGODB_URI

## Task Commits

1. **Task 1: Install auth packages, config, cookie-parser, CORS** - `6d06a0e` (feat)
2. **Task 2: User model, JWT utils, requireAuth middleware** - `6e12516` (feat)
3. **Task 3: Auth routes + rate limiting + integration tests** - `abcc9d1` (feat)
4. **Task 4: checkpoint:human-verify** — BLOCKED (awaiting human approval)

## Files Created/Modified

- `server/src/models/User.js` — User schema: email (unique/lowercase/indexed), passwordHash, resetToken/resetTokenExpiresAt for Phase 02-03
- `server/src/utils/jwt.js` — signToken(userId, rememberMe) / verifyToken(token) using jose HS256
- `server/src/middleware/auth.js` — requireAuth: reads auth_token cookie, sets req.userId, generic 401
- `server/src/routes/auth.js` — POST /signup, POST /login, POST /logout, GET /me; rate limiters on signup+login
- `server/test/auth.test.js` — 10 integration tests; self-skips without MONGODB_URI
- `server/src/config.js` — Added JWT_SECRET guard, NODE_ENV, COOKIE_SECURE, RESEND_API_KEY, MAIL_FROM, APP_URL
- `server/src/app.js` — Added cookie-parser, credentials:true to CORS, mounted authRouter at /api/auth
- `server/package.json` — Five new dependencies
- `server/.env.example` — Documented all Phase 2 env vars (JWT_SECRET, NODE_ENV, RESEND_API_KEY, MAIL_FROM, APP_URL)

## Decisions Made

- Signup returns 400 "Email already registered" on duplicate email (intentional per UI-SPEC — signup enumeration is acceptable UX)
- Login returns identical 401 "Incorrect email or password" for unknown email AND wrong password (T-02-ENUM)
- COOKIE_SECURE = NODE_ENV === 'production' (false on localhost — Pitfall 3 avoidance)
- clearCookie uses the same httpOnly/sameSite/secure options as set (must match or browser won't clear)
- Rate limiter uses skipSuccessfulRequests:true on /login (only failed attempts count toward quota)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. argon2 native binding installed cleanly (prebuilt binary for Windows x64). All verifications passed.

## User Setup Required

**JWT_SECRET must be added to server/.env before the server will start.**

1. Generate a secret: `openssl rand -hex 32` (or any 32+ random character string)
2. Add to `server/.env`: `JWT_SECRET=<your-secret>`
3. Verify: `node --test test/auth.test.js` (with MONGODB_URI set, or skip check)

See `server/.env.example` for all Phase 2 environment variables.

## Checkpoint Reached — Task 4: Supply-Chain + JWT_SECRET Verification

This plan is paused at a blocking human checkpoint (T-02-SC). Continue by approving in the checkpoint message.

## Threat Flags

None — all surfaces introduced in this plan were already modeled in the plan's threat register (T-02-CS, T-02-PW, T-02-JWT, T-02-XSS, T-02-ENUM, T-02-SC). No new unmodeled surface was introduced.

## Next Phase Readiness

After Task 4 checkpoint approval:
- Plan 02-02 (client auth UI) can proceed — auth backend is complete
- Plan 02-03 (password reset) can proceed — User model already has resetToken fields, resend is installed
- Plan 02-04 (data isolation) depends on requireAuth being available — it is

## Self-Check: PASSED

- server/src/models/User.js: FOUND
- server/src/utils/jwt.js: FOUND
- server/src/middleware/auth.js: FOUND
- server/src/routes/auth.js: FOUND
- server/test/auth.test.js: FOUND
- server/src/config.js: FOUND (modified)
- server/src/app.js: FOUND (modified)
- Commit 6d06a0e: FOUND
- Commit 6e12516: FOUND
- Commit abcc9d1: FOUND

---
*Phase: 02-accounts-private-maps*
*Completed: 2026-06-19*
