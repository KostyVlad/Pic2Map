---
phase: 02-accounts-private-maps
verified: 2026-06-21T00:00:00Z
status: human_needed
score: 5/5 success criteria verified (with 2 warnings on criterion 5)
overrides_applied: 0
human_verification:
  - test: "Start the server with RESEND_API_KEY UNSET (or empty) in server/.env, e.g. `cd server && JWT_SECRET=x MONGODB_URI=<uri> npm start` with no RESEND_API_KEY."
    expected: "Decide intended behavior. CURRENT behavior: the server crashes at startup ('Missing API key. Pass it to the constructor new Resend(\"re_123\")') because server/src/services/email/resend.js:20 constructs `new Resend(config.RESEND_API_KEY)` eagerly at module load and the resend SDK v6 throws on an empty key. config.js:40 defaults RESEND_API_KEY to '' and resend.js:29 has a runtime guard for the empty case — both imply the app was MEANT to boot without a key, but it cannot."
    why_human: "Requires a product decision: is a Resend key now a hard startup requirement (then document it + remove the dead-code guard + the SMTP 'fallback' claim), or should the resend client be constructed lazily so the app boots and the SMTP fallback is actually selectable? Cannot be resolved by code inspection alone."
  - test: "Run the reset-flow integration test with a live DB: `cd server && JWT_SECRET=x MONGODB_URI=<throwaway-uri> node --test test/reset.test.js`."
    expected: "It should pass. CURRENTLY it FAILS to even start: reset.test.js:50 sets `process.env.RESEND_API_KEY = ''` then imports app.js at line 55, which transitively constructs `new Resend('')` and throws before any test runs. The suite has only ever self-skipped (no MONGODB_URI in CI), so this regression was never caught. The reset LOGIC itself is correct (independently verified, 6/6 behavioral checks pass)."
    why_human: "Confirm the fix approach for the test harness (inject a fake sendEmail, or set a dummy `re_...`-shaped key instead of '') once the boot decision above is made."
---

# Phase 2: Accounts & Private Maps — Verification Report

**Phase Goal:** Users can sign up, log in, log out, and reset a forgotten password by email; every country and photo is scoped to its owner so each user has a private map. Unauthenticated visitors see only a login/signup screen; pre-auth test data is cleared and `userId` becomes required.
**Verified:** 2026-06-21
**Status:** human_needed (all 5 criteria functionally met; 2 warnings on criterion 5 need a human decision)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (the 5 Success Criteria)

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Signup/login/refresh-persistence (remember-me longer)/logout via httpOnly JWT cookie | ✓ VERIFIED | auth.test.js 10/10 pass (run against throwaway DB): 201+Set-Cookie on signup, 200+Set-Cookie on login, rememberMe Max-Age longer, logout clears cookie, /me round-trips. Cookie httpOnly+sameSite=lax+secure-in-prod: routes/auth.js:40-59. JWT TTL 1d/30d: utils/jwt.js:23-30. Refresh persistence: AuthContext.jsx re-runs /me on mount (staleTime:Infinity); App.jsx:17-22 ProtectedRoute gates on it. |
| 2 | Passwords stored hashed (argon2id), never plaintext | ✓ VERIFIED | routes/auth.js:109 `argon2.hash(password,{type:argon2.argon2id})` (signup), :288 (reset). auth.test.js:336-347 asserts stored doc has `passwordHash` starting `$argon2`, and NO `password` field. User.js stores only `passwordHash`. |
| 3 | Every country/photo query incl. file serving scoped to authenticated user (no IDOR) | ✓ VERIFIED | isolation.test.js 7/7 pass: 401 without cookie on all data routes; User B cannot see/count User A's photos; GET /file/:key with non-owner cookie → 404 (not 403/200). app.js:25-26 mounts requireAuth on /api/photos + /api/countries. photos.js:135 (find scoped), :110 (create stamps userId), :166-172 (ownership check before stream). countries.js:24 aggregate `$match userId` cast to ObjectId. |
| 4 | Unauthenticated see only login/signup; pre-auth (userId=null) data cleared; new accounts start empty | ✓ VERIFIED | App.jsx:17-22 ProtectedRoute redirects to /login when user null; map only under "/" route. Photo.js:26-31 userId `required:true` (no `default:null`). migrate-fresh-start.js deletes userId:null photos+files, idempotent (re-run finds 0). npm script `migrate:fresh-start` present (package.json:11). Client builds clean (vite build, 131 modules). New account empty map confirmed by isolation test (fresh user sees []). |
| 5 | Forgotten-password reset via emailed link sets a new password | ✓ VERIFIED (logic) / ⚠️ 2 warnings | Reset LOGIC verified independently (6/6 behavioral checks: valid-token→200, single-use→400 reuse, expired→400, sha256-hashed-at-rest, no-enumeration identical 200, mail-failure caught keeping 200). routes/auth.js:201-301. Live email walkthrough human-approved 2026-06-21 (Resend sandbox). WARNINGS: (a) reset.test.js cannot run — crashes on import under resend SDK v6; (b) app cannot boot without RESEND_API_KEY. See Anti-Patterns + Human Verification. |

**Score:** 5/5 criteria functionally achieved. Criterion 5 carries 2 warnings requiring a human decision (status: human_needed).

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| server/src/models/User.js | ✓ VERIFIED | email unique/lowercase/index, passwordHash, resetToken (indexed), resetTokenExpiresAt |
| server/src/utils/jwt.js | ✓ VERIFIED | jose HS256 signToken/verifyToken, 1d/30d TTL |
| server/src/middleware/auth.js | ✓ VERIFIED | requireAuth reads auth_token cookie, sets req.userId, generic 401 |
| server/src/routes/auth.js | ✓ VERIFIED | signup/login/logout/me/forgot/reset, rate limiting, no enumeration |
| server/src/routes/photos.js | ✓ VERIFIED | userId scoping on create/find + file IDOR 404 |
| server/src/routes/countries.js | ✓ VERIFIED | aggregate $match userId (ObjectId cast) |
| server/src/scripts/migrate-fresh-start.js | ✓ VERIFIED | idempotent deleteMany(userId:null) + file delete; npm script wired |
| server/src/services/email/{index,resend,smtp}.js | ⚠️ FUNCTIONS-BUT-FRAGILE | index re-exports resend; resend checks {data,error}; BUT eager `new Resend('')` breaks boot without a key; smtp "fallback" is a throwing stub and not actually selectable without also setting a Resend key |
| server/test/auth.test.js | ✓ VERIFIED | 10/10 pass |
| server/test/isolation.test.js | ✓ VERIFIED | 7/7 pass; safely redirects to throwaway DB |
| server/test/reset.test.js | ⚠️ BROKEN | Cannot execute with MONGODB_URI set — crashes at import (forces RESEND_API_KEY=''); has only ever self-skipped |
| client/src/context/AuthContext.jsx, api/auth.js, components/auth/*, AccountStrip.jsx, App.jsx | ✓ VERIFIED | All substantive + wired; client builds clean |

### Key Link Verification

| From | To | Status | Details |
|------|----|--------|---------|
| routes/auth.js | utils/jwt.js | ✓ WIRED | signToken on signup:123 + login:166 |
| middleware/auth.js | utils/jwt.js | ✓ WIRED | verifyToken on each protected request:21 |
| app.js | routes/auth.js (public) + requireAuth on data routers | ✓ WIRED | app.js:24-26 |
| photos.js / countries.js | req.userId | ✓ WIRED | scoping confirmed by isolation tests |
| client App.jsx | AuthContext | ✓ WIRED | ProtectedRoute uses useAuth (App.jsx:18) |
| client api fetches | credentials:'include' | ✓ WIRED | 3 in photos.js/countries.js, all auth hooks |
| routes/auth.js | services/email/index.js | ⚠️ WIRED-BUT-FRAGILE | sendEmail called (auth.js:234); chain crashes at import when key empty |
| ResetPasswordScreen | /api/auth/reset-password | ✓ WIRED | useResetPassword posts {token,password}; reads ?token= via useSearchParams |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Auth flow (criteria 1,2) | `node --test test/auth.test.js` (throwaway DB) | 10 pass / 0 fail | ✓ PASS |
| Isolation + IDOR (criterion 3) | `node --test test/isolation.test.js` (throwaway DB) | 7 pass / 0 fail | ✓ PASS |
| Reset suite (criterion 5) | `node --test test/reset.test.js` (throwaway DB) | 0 pass / 1 fail — crashes at import (`new Resend('')` throws) | ✗ FAIL (harness) |
| Reset LOGIC (criterion 5, isolated) | ad-hoc HTTP test with dummy Resend key | 6 pass / 0 fail | ✓ PASS |
| App boot without RESEND_API_KEY | `import('./src/app.js')` with RESEND_API_KEY='' | "Missing API key" thrown | ✗ FAIL |
| App boot with a key | `import('./src/app.js')` with dummy key | APP LOADED OK | ✓ PASS |
| Client build (criterion 4) | `npx vite build` | 131 modules, built clean | ✓ PASS |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| server/src/services/email/resend.js | 20 | Eager `new Resend(config.RESEND_API_KEY)` at module load; resend SDK v6 throws on empty key | ⚠️ Warning | App cannot start without RESEND_API_KEY; makes the SMTP "fallback" unreachable and the resend.js:29 empty-key guard dead code |
| server/test/reset.test.js | 50,55 | Sets `RESEND_API_KEY=''` then imports app.js → import crashes | ⚠️ Warning | The only automated coverage for AUTH-05 never actually runs; the SDK-v6 boot regression went undetected |
| 02-03-SUMMARY.md | 59,89,157 | Claims empty-key path is handled by a runtime guard and that reset.test.js "self-skips cleanly" | ℹ️ Info | SUMMARY narrative contradicts actual behavior — the guard is dead code; the test was never executed with a DB |

No TODO/FIXME/XXX/TBD/HACK/PLACEHOLDER debt markers found in server/src.

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
|-------------|------------|--------|----------|
| AUTH-01 (signup) | 02-01/02 | ✓ SATISFIED | auth.test.js signup; immediate login |
| AUTH-02 (login + session) | 02-01/02 | ✓ SATISFIED | auth.test.js login/me/remember-me |
| AUTH-03 (logout) | 02-01/02 | ✓ SATISFIED | auth.test.js logout clears cookie |
| AUTH-04 (private maps + isolation + fresh start) | 02-02 | ✓ SATISFIED | isolation.test.js 7/7; migration script; userId required |
| AUTH-05 (password reset) | 02-03 | ✓ SATISFIED (logic) / ⚠️ test+boot warnings | reset logic verified; live walkthrough approved; see warnings |

### Human Verification Required

See the two `human_verification` items in the frontmatter. Both concern criterion 5 robustness, not the user-facing reset behavior (which works in the user's keyed environment and was approved live on 2026-06-21):

1. **App boot without RESEND_API_KEY** — currently crashes at startup. Decide: hard requirement (document + remove dead guards/fallback claim) vs. lazy client construction so the app boots and SMTP fallback is real.
2. **reset.test.js is broken** — forces `RESEND_API_KEY=''`, crashing app import under resend SDK v6, so the suite has only ever self-skipped. Fix the harness (inject a fake sendEmail or use a dummy `re_`-shaped key) so AUTH-05 actually gets automated coverage.

### Gaps Summary

There are **no blockers**: all 5 success criteria are functionally achieved in the running application. Criteria 1–4 are verified by passing test suites (auth 10/10, isolation 7/7), a clean client build, and direct code inspection of the scoping/gating/migration wiring. Criterion 5's reset flow is logically correct (independently verified 6/6) and its live email path was human-approved.

The two warnings on criterion 5 are real but non-blocking quality/robustness defects, both rooted in the same cause: **resend SDK v6 throws when constructed with an empty API key, and `resend.js` constructs the client eagerly at module load.** This (a) prevents the server from booting without `RESEND_API_KEY` despite config/code that implies an empty key is tolerated, and (b) makes `reset.test.js` crash on import — so AUTH-05 has zero working automated coverage even though the logic is sound. The 02-03 SUMMARY's claims that the empty-key case is gracefully handled and that the test "self-skips cleanly" are contradicted by actual execution. These warrant a human decision before the phase is considered fully closed.

---

_Verified: 2026-06-21_
_Verifier: Claude (gsd-verifier)_
