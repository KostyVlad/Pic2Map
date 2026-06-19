# Phase 2: Accounts & Private Maps - Context

**Gathered:** 2026-06-19
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase adds authentication and per-user data isolation to the Phase 1 app: users can
sign up, log in, log out, and reset a forgotten password by email; every country and photo
is scoped to the authenticated user so each account has a private map. Unauthenticated
visitors see only a login/signup screen — the map and all photo features are gated behind
auth. Existing pre-auth (userId=null) test photos are cleared (fresh start), and from this
phase onward every photo carries a `userId` and is enforced as required.

Covers requirements AUTH-01, AUTH-02, AUTH-03, AUTH-04, and new AUTH-05 (password reset).

**Not in this phase:** EXIF GPS auto-placement & pins (Phase 3); reverse geocoding/cities,
edit/move, delete, upload progress, mobile polish (Phase 4); email *verification* on signup
(explicitly excluded); social features / shared maps (out of scope, v2+).
</domain>

<decisions>
## Implementation Decisions

### Pre-auth data (migration)
- **D-01:** **Fresh start** — a one-time migration deletes existing Phase-1 photos
  (`userId: null`) and their stored files from the StorageAdapter. New accounts begin with
  an empty map. (This satisfies AUTH-04 by enforcing isolation; there is no real data to
  migrate — the Phase-1 uploads were test data, so "migrate rather than lose" is replaced
  by an explicit clean slate per the user's choice.) After this, `userId` is **required** on
  the Photo schema.

### Auth scope
- **D-02:** Auth = email + password **signup / login / logout**, PLUS **password reset by
  email** (AUTH-05). Email *verification* on signup is NOT included. Password reset implies
  sending emails (reset link/token) — an email-sending capability + provider is required
  (see research flag).
- **D-03 (locked from research, not re-discussed):** Passwords hashed with **argon2id**;
  session is a **JWT (jose) in an httpOnly cookie**; **every** photo/country query is scoped
  to `req.userId` (IDOR is the top risk). Registration is open/public.

### Logged-out experience
- **D-04:** Unauthenticated users see a **login/signup page only**. The map and all photo
  features render only after login (auth-gated). Add the minimal client routing/gating needed
  (e.g. an auth context + conditional render, or a small router) to switch between the
  auth screens and the authenticated map app.

### Session length
- **D-05:** **Short-lived session by default + a "Remember me" checkbox** that issues a
  long-lived session. Implement via JWT expiry + httpOnly cookie `maxAge` (suggested:
  ~1 day default, ~30 days with remember-me; planner may tune). On expiry, the user is
  returned to the login page.

### Email provider (decided)
- **D-06:** Password-reset emails use **Resend (free tier)** — ~3000 emails/month, no credit
  card required (more than enough for password resets). The user supplies `RESEND_API_KEY`
  (and a `MAIL_FROM`, default `onboarding@resend.dev` for dev) in `server/.env` — like
  `MONGODB_URI`. **Gmail SMTP** (app password, also free) is the documented fallback if the
  user prefers not to create a Resend account. Research/plan should target Resend's Node SDK
  but keep the email-sending behind a small adapter so SMTP can swap in. Reset-token TTL and
  single-use enforcement are research/plan details.

### Claude's Discretion / research flags
- **Client routing approach:** add `react-router` vs a lightweight auth-context conditional
  render — planner/UI decide. (No router exists yet; App.jsx is a single map view.)
- Exact JWT/cookie TTL values, rate-limiting on login/reset endpoints.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Scope
- `.planning/PROJECT.md` — product definition, privacy posture (public sign-up, private maps)
- `.planning/REQUIREMENTS.md` — AUTH-01..05 (AUTH-05 = password reset, added this phase)
- `.planning/ROADMAP.md` — Phase 2 goal, mode (mvp), success criteria

### Research (locked technical direction)
- `.planning/research/STACK.md` — auth libs: **jose** (JWT), **argon2** (argon2id); cookie handling
- `.planning/research/PITFALLS.md` — IDOR (`findOne({_id, userId})`), JWT in httpOnly cookie
  (never localStorage), upload/auth security
- `.planning/research/SUMMARY.md` — overall synthesis

### Phase 1 (what exists — build on it)
- `.planning/phases/01-country-map-photos/01-01-SUMMARY.md`,
  `.planning/phases/01-country-map-photos/01-02-SUMMARY.md` — what was built
- `.planning/phases/01-country-map-photos/01-CONTEXT.md` — Phase 1 decisions (D-04 reserved userId)
- `server/src/models/Photo.js` — Photo schema with nullable `userId` (ObjectId, indexed) ready to enforce
- `server/src/routes/photos.js`, `server/src/routes/countries.js` — routes to scope by `req.userId`
- `server/src/app.js`, `server/src/config.js`, `server/src/db.js` — server wiring (add auth routes/middleware, config for JWT secret + email provider)
- `client/src/App.jsx`, `client/src/api/*` — single-view client + TanStack Query data layer to gate behind auth

</canonical_refs>

<code_context>
## Existing Code Insights

Phase 1 codebase exists (MERN, no auth yet). This phase retrofits auth and isolation.

### Reusable assets
- **Photo model** already has a nullable, indexed `userId` field reserved for this phase — make it required after the fresh-start cleanup.
- **TanStack Query** data layer (`client/src/api/`) — wrap mutations/queries to send credentials (cookie) and handle 401 → redirect to login.
- Server config/db/app wiring is in place — add a `User` model, auth routes, and a `requireAuth` middleware.

### Integration points / patterns to establish
- `requireAuth` middleware sets `req.userId`; apply to all `/api/photos` and `/api/countries` routes.
- Every Mongo query gains `userId: req.userId` (photo list, photo-count aggregation, file serving ownership check).
- Client: an auth context/provider gates the app — login/signup screens vs the map; 401 handling.
- New env: JWT secret, cookie settings, email provider credentials.

### Cautions
- Do NOT read/print `.env`; the email + JWT secrets go in `server/.env` (user supplies, like MONGODB_URI).
- File-serving route must verify photo ownership (`userId`) before streaming — close IDOR on `/api/photos/file/:key`.
</code_context>

<specifics>
## Specific Ideas

- Clean break: after Phase 2, opening the site = login screen; after login = your own empty
  (then populated) country map. Test data from Phase 1 is wiped.
- "Remember me" on the login form drives session length.
</specifics>

<deferred>
## Deferred Ideas

- Email verification on signup — explicitly excluded (only reset, not verify).
- OAuth / social login — not in scope (email+password only).
- Account settings, change-email, delete-account — later/polish.
- EXIF GPS pins (Phase 3); cities/edit/delete/progress/mobile (Phase 4).

None expanded the phase beyond auth + isolation (+ the user-requested password reset).
</deferred>

---

*Phase: 2-accounts-private-maps*
*Context gathered: 2026-06-19*
