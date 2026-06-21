---
phase: 02-accounts-private-maps
plan: 03
subsystem: auth-password-reset
tags: [password-reset, resend, email-adapter, argon2id, sha256, rate-limit, react-router]

# Dependency graph
requires:
  - phase: 02-accounts-private-maps
    plan: 01
    provides: User model (resetToken/resetTokenExpiresAt fields), argon2id, auth routes, config (RESEND_API_KEY/MAIL_FROM/APP_URL)
  - phase: 02-accounts-private-maps
    plan: 02
    provides: react-router-dom, AuthContext, App.jsx BrowserRouter + placeholder routes for /forgot-password and /reset-password
provides:
  - "Email adapter (Resend default, SMTP-swappable) in server/src/services/email/"
  - "POST /api/auth/forgot-password — rate-limited, no-enumeration, sha256 hashed token, 1h TTL"
  - "POST /api/auth/reset-password — sha256 verify + TTL check, argon2id new hash, single-use clear"
  - "ForgotPasswordScreen — UI-SPEC Screen 3 (request + success state, back-to-login link)"
  - "ResetPasswordScreen — UI-SPEC Screen 4 (normal / success / expired-token states, ?token= query param)"
  - "useForgotPassword + useResetPassword hooks in client/src/api/auth.js"
  - "Real routes replacing ComingSoon placeholders in App.jsx"
  - "Integration test suite (reset.test.js) — self-skips without MONGODB_URI"
affects:
  - 02-04-data-isolation (unaffected — requireAuth already applied to data routes)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "sha256(rawToken) stored at rest; raw token only in the emailed link (T-02-RST-HARVEST)"
    - "forgot-password always returns 200 regardless of match — no enumeration (T-02-RST-ENUM, Pitfall 5)"
    - "token in query param not path — reduces Referer leakage (T-02-RST-LEAK, Pitfall 7)"
    - "sendEmail wrapped in try/catch in route — mail failure does NOT change 200 response (T-02-RST-MAIL)"
    - "rate limiter on /forgot-password: 5 req/15min (stricter than login) (T-02-RST-BRUTE)"
    - "single-use: resetToken + resetTokenExpiresAt set to undefined after use"
    - "useSearchParams reads ?token= from URL — no path-segment token (Pitfall 7)"
    - "ResetPasswordScreen expired state shown when token absent in URL OR server returns 400"

key-files:
  created:
    - server/src/services/email/index.js
    - server/src/services/email/resend.js
    - server/src/services/email/smtp.js
    - server/test/reset.test.js
    - client/src/components/auth/ForgotPasswordScreen.jsx
    - client/src/components/auth/ResetPasswordScreen.jsx
  modified:
    - server/src/routes/auth.js
    - client/src/api/auth.js
    - client/src/App.jsx

key-decisions:
  - "Email adapter uses resend default; smtp.js is a documented stub with clear activation instructions — no nodemailer install this phase"
  - "resend.emails.send() returns {data,error} — adapter checks error field and throws; does NOT rely on SDK to throw (verified against v6 behavior note)"
  - "forgotPasswordLimiter: 5 req/15min (stricter than login 10/15min) — reset emails are expensive and targeted abuse is higher risk"
  - "ResetPasswordScreen shows expired state both on missing URL token AND on server 400 — unified UX for both invalid-token cases"
  - "Do NOT auto-login after reset — UI-SPEC Screen 4 success copy + 'Go to sign in' link is the correct pattern"
  - "RESEND_API_KEY empty: adapter throws 'email not configured'; route-level try/catch catches it, still returns 200 (T-02-RST-MAIL accept)"

requirements-completed: [AUTH-05]

# Metrics
duration: ~7min
completed: 2026-06-21
---

# Phase 2 Plan 03: Password Reset Flow Summary

**Resend email adapter behind a swappable interface, hashed single-use short-TTL reset tokens via sha256, ForgotPasswordScreen + ResetPasswordScreen per UI-SPEC — paused at human-check (live email walkthrough)**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-06-21T00:00:00Z
- **Completed:** 2026-06-21 (paused at Task 2 human-check)
- **Tasks:** 2/2 implemented (Task 2 automated build passes; human-check awaiting RESEND_API_KEY + live browser walkthrough)
- **Files created/modified:** 9

## Accomplishments

### Task 1 (TDD): Email adapter + forgot-password + reset-password endpoints

**RED (test commit b46a16a):**
- `server/test/reset.test.js` — 6 behavior groups, 7 tests, self-skips without MONGODB_URI (matches auth.test.js / isolation.test.js convention)
- Tests cover: no-enumeration 200 (known + unknown email, identical bodies), sha256 hash at rest (not raw token), valid token resets password + login works, single-use (reused token returns 400), expired TTL returns 400, short password returns 400

**GREEN (feat commit 5fcbc4f):**
- `server/src/services/email/resend.js`: Resend SDK v6 provider; constructs `new Resend(RESEND_API_KEY)`; calls `resendClient.emails.send()`; checks `{ data, error }` return — throws if `error` is truthy; throws "email not configured" if RESEND_API_KEY is empty
- `server/src/services/email/smtp.js`: documented stub with nodemailer activation instructions; throws "SMTP provider not configured" until wired up — preserves the adapter interface for future swap
- `server/src/services/email/index.js`: one-line swap point — `export { sendEmail } from './resend.js'`
- `server/src/routes/auth.js` additions:
  - `forgotPasswordLimiter`: 5 req/15min (stricter than login)
  - `POST /forgot-password`: validates email, looks up user, generates `randomBytes(32).toString('hex')` raw token, stores `sha256(raw)` hash with 1h TTL, sends email with link `${APP_URL}/reset-password?token=<raw>`, wraps sendEmail in try/catch so mail failure does NOT change 200 response, ALWAYS returns `{ message: "If that address has an account, we've sent a reset link." }`
  - `POST /reset-password`: validates token + password ≥ 8, computes `sha256(incoming)`, finds user with matching hash AND `resetTokenExpiresAt > now`, sets new argon2id hash, clears reset fields (single-use), returns `{ ok: true }`

### Task 2: ForgotPassword + ResetPassword screens and real routes (feat commit cba40b1)

- `client/src/api/auth.js` additions:
  - `useForgotPassword`: POST /api/auth/forgot-password with `{ email }`; credentials:'include'; surfaces errors (rate-limit, unexpected failures)
  - `useResetPassword`: POST /api/auth/reset-password with `{ token, password }`; surfaces 400 errors to caller
- `client/src/components/auth/ForgotPasswordScreen.jsx`:
  - UI-SPEC Screen 3 — centered card, title "Reset password", instructional copy (`text-body text-text-muted`), email field, "Send reset link"/"Sending..." button, "Back to sign in" link
  - On submit success: form replaced with "Check your email. If that address has an account, we've sent a reset link." + "Back to sign in" link (no enumeration)
  - On rate-limit error: card-level error block with `role="alert"`
- `client/src/components/auth/ResetPasswordScreen.jsx`:
  - UI-SPEC Screen 4 — reads `?token=` via `useSearchParams`
  - No token → expired state immediately
  - Normal state: "New password" + "Confirm new password" fields, "Set new password"/"Saving..." button
  - Success state: "Your password has been updated. You can now sign in." + "Go to sign in" → /login
  - Expired state (no token or server 400): "This reset link has expired or is invalid." + "Request a new reset link" → /forgot-password
- `client/src/App.jsx`: replaced ComingSoon placeholders with ForgotPasswordScreen and ResetPasswordScreen; removed ComingSoon component entirely
- `vite build`: 131 modules, 0 errors

## Task Commits

| Task | Phase | Commit | Description |
|------|-------|--------|-------------|
| Task 1 | RED | `b46a16a` | test(02-03): add failing tests for password-reset flow |
| Task 1 | GREEN | `5fcbc4f` | feat(02-03): email adapter + forgot-password + reset-password endpoints |
| Task 2 | — | `cba40b1` | feat(02-03): ForgotPassword + ResetPassword screens and real routes |

## Files Created/Modified

**Created:**
- `server/src/services/email/index.js` — adapter entry point (resend default, swap point)
- `server/src/services/email/resend.js` — Resend v6 provider with {data,error} check
- `server/src/services/email/smtp.js` — documented nodemailer stub
- `server/test/reset.test.js` — 7-test integration suite; self-skips without MONGODB_URI
- `client/src/components/auth/ForgotPasswordScreen.jsx` — UI-SPEC Screen 3
- `client/src/components/auth/ResetPasswordScreen.jsx` — UI-SPEC Screen 4

**Modified:**
- `server/src/routes/auth.js` — added forgotPasswordLimiter, POST /forgot-password, POST /reset-password
- `client/src/api/auth.js` — added useForgotPassword + useResetPassword hooks
- `client/src/App.jsx` — replaced ComingSoon with real screens; removed ComingSoon

## Decisions Made

- Email adapter defaults to Resend; smtp.js exists as a documented stub for future activation (no nodemailer install this phase — would require another supply-chain checkpoint per D-06)
- Rate limiter on /forgot-password is stricter than /login (5 vs 10 per 15min) because reset emails are expensive and enumeration is higher-risk here
- `sendEmail` in route is wrapped in try/catch so mail failures are logged but do NOT affect the 200 response shape (T-02-RST-MAIL accept disposition)
- ResetPasswordScreen uses `useSearchParams` (not `useParams`) to read `?token=` — query param per Pitfall 7, not path segment
- ResetPasswordScreen treats both missing-token-in-URL and server-400 as the same "expired" state — cleaner UX than separate error messages

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all screens show live server-driven data. The SMTP adapter is an intentional documented stub; it does not affect the plan's goal (Resend is the active provider).

## Checkpoint Reached — Task 2: Live Email Walkthrough (human-check)

All automated verifications passed:
- `node --test test/reset.test.js` — self-skips cleanly (no MONGODB_URI in test runner environment)
- `cd client && npx vite build` — 131 modules, 0 errors

Human browser walkthrough is required to confirm the live reset-email flow with RESEND_API_KEY set.

**See the CHECKPOINT REACHED section in the execution return message for exact steps.**

## Threat Flags

None — all surfaces introduced in this plan were already modeled in the plan's threat register:
- T-02-RST-HARVEST → mitigated (sha256 at rest, 1h TTL, single-use clear)
- T-02-RST-ENUM → mitigated (always 200, identical body)
- T-02-RST-LEAK → mitigated (query param not path; short TTL)
- T-02-RST-BRUTE → mitigated (rate limiter 5/15min; 256-bit token space)
- T-02-RST-MAIL → accepted (try/catch keeps 200; logged server-side)
- T-02-SC-RESEND → mitigated (covered by 02-01 supply-chain checkpoint)

## Self-Check: PASSED

- server/src/services/email/index.js: FOUND
- server/src/services/email/resend.js: FOUND
- server/src/services/email/smtp.js: FOUND
- server/test/reset.test.js: FOUND
- client/src/components/auth/ForgotPasswordScreen.jsx: FOUND
- client/src/components/auth/ResetPasswordScreen.jsx: FOUND
- Commit b46a16a: FOUND
- Commit 5fcbc4f: FOUND
- Commit cba40b1: FOUND

---
*Phase: 02-accounts-private-maps*
*Completed: 2026-06-21*
