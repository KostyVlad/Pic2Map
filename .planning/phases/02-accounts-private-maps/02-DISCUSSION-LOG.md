# Phase 2: Accounts & Private Maps - Discussion Log

> **Audit trail only.** Decisions are captured in CONTEXT.md.

**Date:** 2026-06-19
**Phase:** 2-accounts-private-maps
**Areas discussed:** Phase 1 photo migration, auth depth, logged-out experience, session length

---

## Phase 1 photo migration

| Option | Selected |
|--------|----------|
| Assign to first account | |
| Start fresh (delete) | ✓ |

**Choice:** Fresh start — delete pre-auth (userId=null) test photos + files; new accounts start empty.
**Note:** Adjusts AUTH-04 (no real data to migrate; test data); isolation still enforced, `userId` becomes required.

## Auth depth

| Option | Selected |
|--------|----------|
| Email+password only | |
| + password reset | ✓ |

**Choice:** email+password signup/login/logout PLUS password reset by email (new AUTH-05). Email verification still excluded.
**Note:** Password reset adds an email-sending requirement (provider + credentials).

## Logged-out experience

| Option | Selected |
|--------|----------|
| Login/signup page (map gated) | ✓ |
| Public map preview | |

**Choice:** Unauthenticated users see only login/signup; map gated behind auth.

## Session length

| Option | Selected |
|--------|----------|
| Long (~30 days) | |
| Short (~1 day) | |
| "Remember me" | ✓ |

**Choice:** Short default + "Remember me" checkbox for a long-lived session.

## Claude's Discretion / research flags
- Email provider for password reset (SMTP vs Resend/SendGrid) — research to recommend; needs user-supplied credential in server/.env.
- Client routing approach (react-router vs auth-context conditional render).
- JWT/cookie TTLs, rate limiting on login/reset.

## Carried forward (locked, not re-asked)
- argon2id passwords; jose JWT in httpOnly cookie; every query scoped to userId; open public registration.
