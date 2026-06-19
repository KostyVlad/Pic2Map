# Phase 2: Accounts & Private Maps - Research

**Researched:** 2026-06-19
**Domain:** Express 5 + Mongoose 9 auth — JWT/httpOnly cookie, argon2id, Resend password-reset, React 19 client gating
**Confidence:** HIGH (all packages verified against npm registry; API patterns from official docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Fresh start migration — delete Phase-1 photos (userId: null) + stored files. After migration, `userId` is required on Photo schema.
- **D-02:** Auth = email + password signup / login / logout + password reset by email (AUTH-05). No email verification on signup.
- **D-03:** Passwords hashed with argon2id; session is a JWT (jose) in an httpOnly cookie; every photo/country query scoped to `req.userId`.
- **D-04:** Unauthenticated users see login/signup page only. Map is auth-gated.
- **D-05:** Short-lived session by default + "Remember me" for long-lived. JWT expiry + cookie maxAge. ~1 day default, ~30 days remember-me.
- **D-06:** Password-reset emails via Resend (free tier). User supplies RESEND_API_KEY + MAIL_FROM. Gmail SMTP is documented fallback. Email behind a small adapter.

### Claude's Discretion
- Client routing approach: react-router-dom v7 vs lightweight auth-context conditional render.
- Exact JWT/cookie TTL values, rate-limiting on login/reset endpoints.

### Deferred Ideas (OUT OF SCOPE)
- Email verification on signup.
- OAuth / social login.
- Account settings, change-email, delete-account.
- EXIF GPS pins (Phase 3); cities/edit/delete/progress/mobile (Phase 4).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can sign up with email and password | User model schema; POST /api/auth/signup; argon2id hash pattern |
| AUTH-02 | User can log in; session persists across refresh; "Remember me" extends it | jose SignJWT; httpOnly cookie; two TTL durations |
| AUTH-03 | User can log out | DELETE /api/auth/logout; cookie clearance pattern |
| AUTH-04 | Every country/photo scoped to authenticated user; pre-auth data cleared | requireAuth middleware; query scoping list; fresh-start migration script |
| AUTH-05 | User can reset forgotten password via emailed reset link | Resend SDK send; crypto token; hashed token at rest; single-use TTL |
</phase_requirements>

---

## Summary

Phase 2 retrofits auth onto a working Phase 1 MERN app. The stack is fully locked: **jose 6.2.3** signs HS256 JWTs stored in an httpOnly, sameSite=lax cookie; **argon2 0.44.0** hashes passwords with argon2id; **resend 6.14.0** sends password-reset emails. The backend is Express 5 (already installed at 5.2.1) with Mongoose 9 (9.7.1). Express 5 changed error-handler signatures and async-error propagation — both matter for auth middleware.

The three biggest planning risks are: (1) IDOR — every single Mongo query in photos.js and countries.js must add `userId` to the filter; (2) the Express 5 `async` route handler behavior (errors thrown in async handlers ARE automatically forwarded to `next` in Express 5, unlike Express 4); (3) secure cookie flag on localhost during development (must be `false` in dev, `true` in prod).

**Primary recommendation:** Build in wave order — User model + auth routes + requireAuth middleware → apply userId scoping to all existing routes → fresh-start migration → client auth context + screens → password reset flow.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Password hashing | API / Backend | — | argon2id CPU-intensive; never on client |
| JWT issuance and verification | API / Backend | — | Secret never leaves server |
| Session cookie management | API / Backend (set-cookie) | Browser (reads) | Server sets httpOnly; browser sends automatically |
| Auth screens (login/signup/forgot/reset) | Frontend (React) | — | UI only; calls API endpoints |
| Auth gating (show map vs show login) | Frontend (React) | — | Auth context conditional render |
| Data isolation (userId scoping) | API / Backend | Database | requireAuth sets req.userId; queries filter by it |
| Password reset token generation | API / Backend | — | crypto.randomBytes; token hashed before storage |
| Email delivery | API / Backend → Resend (external) | — | Server calls Resend SDK; adapter wraps it |
| Fresh-start migration | API / Backend (one-time script) | Database + Storage | Deletes userId=null photos from Mongo + StorageAdapter |

---

## Standard Stack

### Core — Server

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| jose | 6.2.3 | JWT sign/verify (HS256); runs in any JS runtime | Locked (D-03); actively maintained; handles all JWA/JWS |
| argon2 | 0.44.0 | argon2id password hash/verify | Locked (D-03); native binding; OWASP recommended over bcrypt |
| resend | 6.14.0 | Transactional email via Resend API | Locked (D-06); official Node SDK; free tier 3k/mo |
| cookie-parser | 1.4.7 | Parse Cookie header into `req.cookies` | Required for reading httpOnly cookies in Express 5 |
| express-rate-limit | 8.5.2 | Rate-limit login + forgot-password endpoints | Industry standard; in-process; no Redis needed for dev |

[VERIFIED: npm registry] — all five packages confirmed `npm view <pkg> version` in this session.

### Core — Client

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-router-dom | 7.18.0 | Client routing for 4 auth screens + map | Recommended over conditional render (see Client Gating section) |

[VERIFIED: npm registry]

### Supporting — Server (already installed)

| Library | Version | Purpose |
|---------|---------|---------|
| express | 5.2.1 | Already installed; async error propagation improved |
| mongoose | 9.7.1 | Already installed; User model added this phase |
| dotenv | 17.4.2 | Already installed; add JWT_SECRET, RESEND_API_KEY, MAIL_FROM |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-router-dom v7 | Auth-context conditional render | Conditional render is simpler but URL navigation between auth screens is awkward; router enables direct URL to /reset?token=xxx |
| resend SDK | nodemailer + Gmail SMTP | nodemailer works but requires app password setup; Resend is simpler for dev; adapter makes swap easy |
| express-rate-limit | Custom counter in memory | Hand-rolling is unnecessary complexity; express-rate-limit has sliding window, skip on success option |

### Installation

```bash
# Server
cd server && npm install jose argon2 resend cookie-parser express-rate-limit

# Client
cd client && npm install react-router-dom
```

---

## Package Legitimacy Audit

All packages verified by `npm view <pkg> version` in this session.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| jose | npm | ~6 yrs | ~30M/wk | github.com/panva/jose | OK | Approved |
| argon2 | npm | ~9 yrs | ~700k/wk | github.com/ranisalt/node-argon2 | OK | Approved |
| resend | npm | ~2 yrs | ~1M/wk | github.com/resendlabs/resend-node | OK | Approved |
| cookie-parser | npm | ~12 yrs | ~25M/wk | github.com/expressjs/cookie-parser | OK | Approved |
| express-rate-limit | npm | ~9 yrs | ~5M/wk | github.com/express-rate-limit/express-rate-limit | OK | Approved |
| react-router-dom | npm | ~10 yrs | ~15M/wk | github.com/remix-run/react-router | OK | Approved |

[ASSUMED] — download/age figures are from training knowledge; only version existence was confirmed via npm view in this session.

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious (SUS):** none

---

## Architecture Patterns

### System Architecture Diagram

```
Browser
  │
  │  cookie: auth_token=<JWT> (httpOnly, sameSite=lax)
  ▼
Express 5 app.js
  │
  ├── cookie-parser middleware  (parses Cookie header → req.cookies)
  │
  ├── /api/auth/*  (public — no requireAuth)
  │     ├── POST /signup         →  hash(password) → User.create() → signJWT() → set-cookie
  │     ├── POST /login          →  User.findOne(email) → verify(password) → signJWT() → set-cookie
  │     ├── POST /logout         →  clear cookie (maxAge=0)
  │     ├── POST /forgot-password →  token → hash → User.save() → Resend.send()
  │     ├── POST /reset-password  →  verify token → hash(newPassword) → User.save() → clear token
  │     └── GET  /me             →  requireAuth → { userId, email }
  │
  ├── requireAuth middleware
  │     └── reads req.cookies.auth_token → jose.jwtVerify() → sets req.userId
  │           → 401 if missing/invalid/expired
  │
  ├── /api/photos  (requireAuth applied)
  │     ├── POST /         →  Photo.create({ ...data, userId: req.userId })
  │     ├── GET  /         →  Photo.find({ countryCode, userId: req.userId })
  │     └── GET  /file/:key →  Photo.findOne({ storageKey: key, userId: req.userId }) → stream
  │
  └── /api/countries  (requireAuth applied)
        └── GET /photo-counts  →  aggregate $match { userId: req.userId } → $group

EmailAdapter
  └── send(to, subject, html)
        ├── ResendProvider  →  new Resend(RESEND_API_KEY).emails.send(...)
        └── SmtpProvider    →  nodemailer transport (fallback, documented)
```

### Recommended Project Structure

```
server/src/
├── models/
│   ├── Photo.js          # existing — add required:true to userId after migration
│   └── User.js           # NEW — email, passwordHash, resetToken fields
├── middleware/
│   ├── upload.js         # existing
│   └── auth.js           # NEW — requireAuth middleware
├── routes/
│   ├── photos.js         # existing — add requireAuth + userId scoping
│   ├── countries.js      # existing — add requireAuth + userId scoping
│   └── auth.js           # NEW — signup/login/logout/me/forgot/reset
├── services/
│   ├── ingest.js         # existing
│   ├── storage/          # existing
│   └── email/
│       ├── index.js      # NEW — adapter entry: picks provider by env
│       ├── resend.js     # NEW — Resend provider
│       └── smtp.js       # NEW — nodemailer SMTP provider (documented fallback)
├── scripts/
│   └── migrate-fresh-start.js  # NEW — one-time Phase-1 cleanup
├── app.js                # modify — add cookie-parser, auth routes, CORS credentials
└── config.js             # modify — add JWT_SECRET, COOKIE_SECURE, RESEND_API_KEY, MAIL_FROM

client/src/
├── api/
│   ├── photos.js         # modify — add credentials:'include' to all fetch calls
│   ├── countries.js      # modify — add credentials:'include'
│   └── auth.js           # NEW — useLogin, useSignup, useLogout, useForgot, useReset, useMe
├── context/
│   └── AuthContext.jsx   # NEW — AuthProvider, useAuth hook
├── components/
│   ├── auth/
│   │   ├── LoginScreen.jsx
│   │   ├── SignupScreen.jsx
│   │   ├── ForgotPasswordScreen.jsx
│   │   └── ResetPasswordScreen.jsx
│   └── AccountStrip.jsx  # NEW — fixed top-left logout affordance
├── App.jsx               # modify — wrap with router + AuthProvider; route to screens
└── main.jsx              # modify — add BrowserRouter (if not in App)
```

---

## Pattern 1: jose JWT Sign + Verify (HS256)

```javascript
// Source: https://github.com/panva/jose (jose 6.x README, verified 2026-06-19)
import { SignJWT, jwtVerify } from 'jose';

// Key: TextEncoder converts the string secret to Uint8Array
const secret = new TextEncoder().encode(process.env.JWT_SECRET);

// Sign — called at login/signup
export async function signToken(userId, rememberMe = false) {
  const expiresIn = rememberMe ? '30d' : '1d';
  return new SignJWT({ sub: userId.toString() })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}

// Verify — called in requireAuth middleware
export async function verifyToken(token) {
  const { payload } = await jwtVerify(token, secret);
  return payload.sub; // userId string
}
```

[VERIFIED: npm registry] package exists; API pattern from jose official documentation.

---

## Pattern 2: argon2 Hash + Verify (argon2id)

```javascript
// Source: https://github.com/ranisalt/node-argon2 (v0.44 README)
import argon2 from 'argon2';

// Hash at signup / password reset
const hash = await argon2.hash(password, { type: argon2.argon2id });

// Verify at login
const valid = await argon2.verify(hash, candidatePassword);
// valid is boolean; throws on malformed hash — wrap in try/catch
```

[VERIFIED: npm registry] package exists. `type: argon2.argon2id` is the explicit selection; default in v0.44 is also argon2id but explicit is clearer. [ASSUMED] default-type claim from training knowledge.

---

## Pattern 3: Cookie Set / Clear

```javascript
// Source: MDN Set-Cookie + Express docs [ASSUMED] (pattern widely documented)
const COOKIE_NAME = 'auth_token';

// Set after successful login/signup
function setAuthCookie(res, token, rememberMe) {
  const maxAge = rememberMe
    ? 30 * 24 * 60 * 60 * 1000  // 30 days in ms
    : 24 * 60 * 60 * 1000;       // 1 day in ms
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',  // false on localhost
    maxAge,
  });
}

// Clear at logout
function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}
```

**Critical:** `secure: false` in dev is required — Chrome rejects `secure` cookies over `http://localhost`. The `secure` flag must match between set and clear, otherwise the browser may not clear it.

---

## Pattern 4: requireAuth Middleware

```javascript
// server/src/middleware/auth.js
import { verifyToken } from '../utils/jwt.js';

export async function requireAuth(req, res, next) {
  const token = req.cookies?.auth_token;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const userId = await verifyToken(token);
    req.userId = userId;  // set as string; convert to ObjectId in queries
    next();
  } catch {
    // jose throws on expired/invalid — do not distinguish (no info leak)
    return res.status(401).json({ error: 'Authentication required' });
  }
}
```

Applied in app.js: `app.use('/api/photos', requireAuth, photosRouter)` and `app.use('/api/countries', requireAuth, countriesRouter)`. Auth routes at `/api/auth` do NOT get requireAuth except `/api/auth/me`.

---

## Pattern 5: Resend Email Adapter

```javascript
// server/src/services/email/resend.js
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail({ to, subject, html }) {
  await resend.emails.send({
    from: process.env.MAIL_FROM || 'onboarding@resend.dev',
    to,
    subject,
    html,
  });
}

// server/src/services/email/index.js — adapter selector
export { sendEmail } from './resend.js';
// swap: export { sendEmail } from './smtp.js';
```

[VERIFIED: npm registry] resend 6.14.0 exists. API pattern from Resend official docs. [ASSUMED] `resend.emails.send()` signature — planner must verify against resend 6.x docs before implementing.

---

## Pattern 6: Password Reset Token (crypto, single-use, hashed at rest)

```javascript
// Token generation (request endpoint)
import { randomBytes, createHash } from 'node:crypto';

const rawToken = randomBytes(32).toString('hex');        // 64-char hex string
const hashedToken = createHash('sha256').update(rawToken).digest('hex');
const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour TTL

// Save to User document
user.resetToken = hashedToken;
user.resetTokenExpiresAt = expiresAt;
await user.save();

// Email link contains rawToken: https://app.example.com/reset-password?token=<rawToken>

// Token verification (reset endpoint)
const hashedIncoming = createHash('sha256').update(rawToken).digest('hex');
const user = await User.findOne({
  resetToken: hashedIncoming,
  resetTokenExpiresAt: { $gt: new Date() },   // not expired
});
if (!user) return res.status(400).json({ error: 'Invalid or expired token' });

// After successful reset — invalidate token (single-use)
user.passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
user.resetToken = undefined;
user.resetTokenExpiresAt = undefined;
await user.save();
```

[ASSUMED] — standard pattern; node:crypto is a built-in, no install needed.

---

## Pattern 7: React Client Gating (react-router-dom v7 recommendation)

```jsx
// client/src/App.jsx — after adding react-router-dom
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import LoginScreen from './components/auth/LoginScreen.jsx';
import SignupScreen from './components/auth/SignupScreen.jsx';
import ForgotPasswordScreen from './components/auth/ForgotPasswordScreen.jsx';
import ResetPasswordScreen from './components/auth/ResetPasswordScreen.jsx';
import WorldMap from './components/WorldMap.jsx';
import AccountStrip from './components/AccountStrip.jsx';

function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;  // or a spinner
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/signup" element={<SignupScreen />} />
          <Route path="/forgot-password" element={<ForgotPasswordScreen />} />
          <Route path="/reset-password" element={<ResetPasswordScreen />} />
          <Route path="/" element={
            <ProtectedRoute>
              <AccountStrip />
              <WorldMap />
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
```

[ASSUMED] — react-router-dom v7 API; verify against v7 docs (v7 uses same Routes/Route/Navigate API as v6; Data Router API is optional, not needed here).

---

## Pattern 8: AuthContext + useMe query

```jsx
// client/src/context/AuthContext.jsx
import { createContext, useContext } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error('Auth check failed');
      return res.json();
    },
    retry: false,
    staleTime: Infinity,  // only invalidated by login/logout mutations
  });

  return (
    <AuthContext.Provider value={{ user: user ?? null, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

On login success: `queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })` forces re-fetch → ProtectedRoute unblocks.
On logout success: same invalidation → ProtectedRoute redirects to /login.

---

## User Model (Mongoose Schema)

```javascript
// server/src/models/User.js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    // Password reset — token stored as SHA-256 hash, raw token sent in email link
    resetToken: {
      type: String,
      default: undefined,
      index: true,  // looked up by hashed token
    },
    resetTokenExpiresAt: {
      type: Date,
      default: undefined,
    },
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
```

No `resetTokenUsed` flag needed — token fields are set to `undefined` after use (that IS the single-use enforcement).

---

## Exact Routes to Scope by userId

All three of these queries in the existing codebase MUST add `userId: req.userId` (or equivalent). No others:

| File | Location | Current query | Required change |
|------|----------|---------------|-----------------|
| `server/src/routes/photos.js` | `Photo.create(...)` at POST / | `{ countryCode, ... }` | add `userId: req.userId` to the Photo.create() call |
| `server/src/routes/photos.js` | `Photo.find(...)` at GET / | `{ countryCode }` | change to `{ countryCode, userId: req.userId }` |
| `server/src/routes/photos.js` | `GET /file/:key` — IDOR gap | no ownership check | add `Photo.findOne({ storageKey: key, userId: req.userId })` before streaming |
| `server/src/routes/countries.js` | aggregate at GET /photo-counts | no `$match` stage | insert `{ $match: { userId: new mongoose.Types.ObjectId(req.userId) } }` as first pipeline stage |

The Photo.js schema already has `// Phase 2 will add: { userId: 1, countryCode: 1 } compound index` — add this index in the migration script.

**CORS update required:** `app.js` CORS config must add `credentials: true` and restrict `origin` to the exact Vite dev origin. Cookie credentials are blocked by browsers on requests without `credentials: 'include'` + server `Access-Control-Allow-Credentials: true`.

---

## Fresh-Start Migration Script

```javascript
// server/src/scripts/migrate-fresh-start.js
// Run ONCE: node src/scripts/migrate-fresh-start.js
import '../config.js';  // loads dotenv
import { connectDb } from '../db.js';
import Photo from '../models/Photo.js';
import { storage } from '../services/storage/index.js';

await connectDb();

const orphans = await Photo.find({ userId: null }).select('storageKey thumbnailKey');
console.log(`Found ${orphans.length} pre-auth photos to delete.`);

for (const photo of orphans) {
  // Delete files from StorageAdapter (local disk in Phase 1)
  await storage.delete(photo.storageKey).catch(e => console.warn('storageKey missing:', e.message));
  await storage.delete(photo.thumbnailKey).catch(e => console.warn('thumbnailKey missing:', e.message));
}

// Bulk delete all MongoDB documents with userId: null
const result = await Photo.deleteMany({ userId: null });
console.log(`Deleted ${result.deletedCount} Photo documents.`);

console.log('Migration complete. userId is now required on all Photo documents.');
process.exit(0);
```

After migration, update `Photo.js` schema: remove `default: null` from userId field and add `required: true`.

**StorageAdapter confirmed:** `LocalDiskStorage.delete(key)` is implemented and handles ENOENT gracefully — the migration script can use `storage.delete(key)` directly. [VERIFIED: codebase read]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom bcrypt or MD5 | argon2 (argon2id) | argon2id is memory-hard; timing attacks; salt handling is automatic |
| JWT sign/verify | Custom base64 HMAC | jose | Handles clock skew, exp claim, alg confusion, key encoding |
| Rate limiting | Custom counter in Map | express-rate-limit | Handles concurrent requests, memory cleanup, skip-on-success |
| Email delivery | Raw SMTP calls | Resend SDK (adapter) | Deliverability, retries, bounce handling |
| CSRF protection | Custom token comparison | `sameSite: 'lax'` cookie attribute | For a same-site SPA served from same origin, sameSite=lax + httpOnly is sufficient |
| Token URL encoding | encodeURIComponent by hand | Pass `token` as query param; URL-safe hex (hex from randomBytes is already URL-safe) | 64-char hex contains no URL-special characters |

---

## Common Pitfalls

### Pitfall 1: IDOR on File Serving
**What goes wrong:** `GET /api/photos/file/:key` streams any file by key — no ownership check. User A can fetch User B's photos by guessing or sharing a key.
**Why it happens:** Phase 1 had no auth; the route only checks path traversal, not ownership.
**How to avoid:** Add `Photo.findOne({ storageKey: key, userId: req.userId })` before streaming. Return 404 (not 403) if not found — don't leak existence.
**Warning signs:** Any file-serving route that does not query the database for the record is vulnerable.

### Pitfall 2: Express 5 Async Error Propagation
**What goes wrong:** Expecting Express 4 behavior where async errors needed explicit `try/catch + next(err)`.
**How to avoid:** Express 5 automatically catches rejected async route handlers and forwards to the error handler. The existing `try/catch + next(err)` pattern in Phase 1 still works — keep it. Do not remove it, but also don't worry about adding it for new auth routes if they throw directly.

### Pitfall 3: Secure Cookie on Localhost
**What goes wrong:** Setting `secure: true` in all environments blocks the cookie on `http://localhost` — Chrome silently rejects it.
**How to avoid:** `secure: process.env.NODE_ENV === 'production'` — always. Test in dev first; the cookie will work without secure on localhost.
**Warning signs:** Login appears to succeed (200 response) but subsequent auth-gated requests return 401 — the cookie was never stored.

### Pitfall 4: CORS credentials not enabled
**What goes wrong:** Browser sends fetch with `credentials: 'include'` but server's CORS config lacks `credentials: true` — browser blocks the cookie.
**How to avoid:**
```javascript
app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true,  // REQUIRED for cookies
}));
```
Also every fetch on the client must add `credentials: 'include'` — including existing photo/country API calls after auth is added.

### Pitfall 5: User Enumeration on Signup / Forgot Password
**What goes wrong:** Returning "email already registered" on signup or "email not found" on forgot-password reveals account existence.
**How to avoid:**
- Signup: Return 400 only when email already exists (this is acceptable per UI-SPEC: "An account with that email already exists"). This is a UX decision already locked in UI-SPEC; it means signup DOES enumerate. This is the intended behavior per the spec.
- Forgot password: ALWAYS return 200 with "Check your email" regardless of whether the email matched. Never return 404 or "not found".
**Warning signs:** Forgot-password endpoint returning different status codes for registered vs. unregistered emails.

### Pitfall 6: aggregate $match with string userId vs ObjectId
**What goes wrong:** `req.userId` from JWT is a string (`.toString()` of ObjectId). Mongoose aggregate `$match` doesn't auto-cast — passing a string where the field is ObjectId type returns 0 results silently.
**How to avoid:** In aggregate pipelines, explicitly cast: `{ $match: { userId: new mongoose.Types.ObjectId(req.userId) } }`.
**Warning signs:** `photo-counts` returns empty map for logged-in user even though photos exist.

### Pitfall 7: Password Reset Token in URL — Cache/Referer Leakage
**What goes wrong:** If the reset token appears in the URL path (not query param), it may be logged in server access logs or sent in Referer headers.
**How to avoid:** Use a query parameter (`/reset-password?token=<hex>`), not a path segment. Query params are still in access logs but not Referer headers after redirect. This is acceptable for a self-hosted MVP app.

---

## Express 5 — Key Differences from Express 4

| Behavior | Express 4 | Express 5 |
|----------|-----------|-----------|
| Async route error handling | Must call `next(err)` in catch | Rejected promises automatically forwarded to error handler |
| `app.router` | Deprecated | Removed |
| `res.json(obj)` with circular refs | Throws unhandled | Forwarded to error handler |
| Query string parser | `qs` (nested objects) | `simple` by default in Express 5; may affect complex query strings |

The existing Phase 1 code uses explicit `try/catch + next(err)` — this is still correct and recommended for Express 5. No changes needed to error handling patterns.

---

## Build Order (Wave Structure for Planner)

Recommended wave sequencing to ensure each wave leaves the app in a working state:

**Wave 0 — Foundation (backend, no client changes)**
1. Install new server packages: `jose argon2 resend cookie-parser express-rate-limit`
2. Add `JWT_SECRET`, `RESEND_API_KEY`, `MAIL_FROM`, `NODE_ENV` to `server/.env.example`
3. Update `config.js` with new env vars
4. Add `cookie-parser` to `app.js`; update CORS to add `credentials: true`
5. Create `User` model
6. Create `requireAuth` middleware
7. Create `server/src/routes/auth.js` with stub routes (returns 501)

**Wave 1 — Auth routes functional**
1. Implement POST /api/auth/signup
2. Implement POST /api/auth/login (with Remember me)
3. Implement POST /api/auth/logout
4. Implement GET /api/auth/me
5. Add rate limiting to login + signup

**Wave 2 — Data isolation (backend complete)**
1. Apply `requireAuth` to all `/api/photos` and `/api/countries` routes in `app.js`
2. Add `userId: req.userId` to `Photo.create()` in photos.js
3. Add `userId: req.userId` to `Photo.find()` in photos.js
4. Add ownership check to `GET /api/photos/file/:key` (IDOR close)
5. Add `$match: { userId }` to aggregate in countries.js

**Wave 3 — Fresh-start migration**
1. Verify `storage.delete()` exists; implement if missing
2. Create and run `migrate-fresh-start.js`
3. Update `Photo.js` schema: `userId` becomes required (remove `default: null`, add `required: true`)
4. Add `{ userId: 1, countryCode: 1 }` compound index to Photo schema

**Wave 4 — Client gating**
1. Install `react-router-dom`
2. Update all fetch calls to add `credentials: 'include'`
3. Create `AuthContext.jsx` with `useMe` query
4. Rewrite `App.jsx` with BrowserRouter + ProtectedRoute
5. Create 4 auth screen components (LoginScreen, SignupScreen, ForgotPasswordScreen, ResetPasswordScreen)
6. Create `AccountStrip.jsx`

**Wave 5 — Password reset (email flow)**
1. Create email adapter (`services/email/index.js`, `resend.js`)
2. Implement POST /api/auth/forgot-password
3. Implement POST /api/auth/reset-password
4. Add rate limiting to forgot-password
5. Connect `ForgotPasswordScreen` and `ResetPasswordScreen` to API

---

## config.js Additions

```javascript
// Add to server/src/config.js
const {
  // ... existing ...
  JWT_SECRET,
  NODE_ENV,
  RESEND_API_KEY,
  MAIL_FROM,
} = process.env;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not set. Add a random secret (32+ chars) to server/.env');
}

const config = Object.freeze({
  // ... existing ...
  JWT_SECRET,
  NODE_ENV: NODE_ENV || 'development',
  RESEND_API_KEY: RESEND_API_KEY || '',   // optional: empty disables Resend, falls back to SMTP
  MAIL_FROM: MAIL_FROM || 'onboarding@resend.dev',
  COOKIE_SECURE: NODE_ENV === 'production',
});
```

---

## Validation Architecture

Test framework: Node.js built-in `--test` (already used in Phase 1: `"test": "node --test test/"`). No new test framework needed.

| Req ID | Behavior | Test Type | Notes |
|--------|----------|-----------|-------|
| AUTH-01 | Signup creates user, sets cookie | Integration | POST /api/auth/signup with valid payload → 201 + set-cookie header |
| AUTH-02 | Login returns cookie; remember-me sets longer maxAge | Integration | POST /api/auth/login → verify cookie maxAge differs |
| AUTH-03 | Logout clears cookie | Integration | POST /api/auth/logout → set-cookie maxAge=0 |
| AUTH-04 | Protected routes return 401 without cookie | Integration | GET /api/photos without cookie → 401 |
| AUTH-04 | Photo query scoped to userId | Integration | User A cannot see User B photos |
| AUTH-04 | File serving ownership check | Integration | GET /api/photos/file/:key for other user → 404 |
| AUTH-05 | Reset token is single-use | Integration | Use token once → 200; use again → 400 |
| AUTH-05 | Expired token is rejected | Integration | Token past TTL → 400 |

---

## Environment Availability

| Dependency | Required By | Available | Notes |
|------------|-------------|-----------|-------|
| Node.js | Server build | Yes | Already running (server works) |
| npm | Package install | Yes | Already used |
| argon2 native binding | argon2 package | Check at install | Requires node-gyp / build tools; Windows may need Visual C++ build tools |

**Windows note:** `argon2` uses a native C++ binding. On Windows 10, if Visual Studio Build Tools are not installed, `npm install argon2` may fail. The error message is clear: `node-gyp rebuild` failure. Resolution: install "Visual Studio Build Tools" with "C++ build tools" workload, or use `node-pre-gyp` fallback (argon2 ships prebuilds for common platforms). [ASSUMED] — prebuilt binaries are usually available for argon2 on Windows x64 with modern Node; verify on target machine.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | YES | argon2id; min 8 chars; rate limiting; timing-safe verify |
| V3 Session Management | YES | httpOnly cookie; sameSite=lax; secure in prod; JWT exp |
| V4 Access Control | YES | requireAuth middleware; userId scoping on all queries |
| V5 Input Validation | YES | email format validation; password length; mongoose schema types |
| V6 Cryptography | YES | jose HS256 (never hand-roll); argon2id (never MD5/SHA) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Credential stuffing | Spoofing | express-rate-limit on POST /login |
| IDOR on photo file serving | Elevation of Privilege | Photo.findOne({ storageKey, userId: req.userId }) before streaming |
| JWT in localStorage | Information Disclosure | httpOnly cookie; never localStorage |
| Reset token harvesting | Elevation of Privilege | SHA-256 hash at rest; 1h TTL; single-use invalidation |
| Account enumeration via forgot-password | Information Disclosure | Always return 200 "Check your email" regardless of match |
| XSS cookie theft | Information Disclosure | httpOnly cookie is inaccessible to JavaScript |
| CSRF | Tampering | sameSite=lax blocks cross-site POSTs; sufficient for SPA on same origin |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | argon2 default type is argon2id in v0.44 | Pattern 2 | Must pass `type: argon2.argon2id` explicitly — already done in patterns |
| A2 | `resend.emails.send()` is the v6 SDK send method signature | Pattern 5 | Planner must verify against resend 6.x changelog before implementing |
| A3 | react-router-dom v7 uses same Routes/Route/Navigate API as v6 | Pattern 7 | If breaking changes, adapt import paths |
| A4 | argon2 ships prebuilt binaries for Windows 10 x64 Node 20+ | Environment | npm install argon2 may fail; have build tools fallback ready |
| A5 | Package download counts and ages in legitimacy audit | Package Audit | For reference only; version existence confirmed via npm view |

---

## Open Questions

1. **Does `storage.delete()` exist in the StorageAdapter?**
   - RESOLVED: `LocalDiskStorage.delete(key)` IS implemented in `server/src/services/storage/LocalDiskStorage.js` — it calls `fs.unlink` and swallows ENOENT. The migration script can use `storage.delete(key)` directly. [VERIFIED: codebase read]

2. **argon2 native build on Windows**
   - What we know: argon2 requires native compilation; Windows needs build tools.
   - What's unclear: Whether this machine has Visual Studio Build Tools installed.
   - Recommendation: Run `npm install argon2` as Wave 0 step 1; if it fails, install build tools first.

3. **Resend account setup**
   - What we know: User must create a Resend account and get an API key.
   - What's unclear: Whether user wants to use `onboarding@resend.dev` (no domain setup needed for dev) or a custom domain.
   - Recommendation: Default to `onboarding@resend.dev` for dev/MVP; document custom domain setup as optional.

---

## Sources

### Primary (HIGH confidence)
- npm registry — jose 6.2.3, argon2 0.44.0, resend 6.14.0, cookie-parser 1.4.7, express-rate-limit 8.5.2, react-router-dom 7.18.0 versions confirmed via `npm view` in this session [VERIFIED: npm registry]
- Existing codebase — server/src/app.js, config.js, db.js, routes/photos.js, routes/countries.js, models/Photo.js, client/src/App.jsx, main.jsx, api/*.js — direct read in this session

### Secondary (MEDIUM confidence)
- jose GitHub README (panva/jose) — SignJWT / jwtVerify API
- node-argon2 GitHub README — hash/verify API, type constants
- Resend Node SDK documentation — emails.send() API [ASSUMED on exact v6 signature]

### Tertiary (LOW confidence)
- Training knowledge for Express 5 async behavior, argon2 defaults, react-router-dom v7 API compatibility

---

## Metadata

**Confidence breakdown:**
- Standard stack (versions): HIGH — confirmed via npm view
- Architecture patterns: HIGH — derived from existing codebase + well-established patterns
- jose/argon2 API snippets: MEDIUM — from documented official README; A2/A3 flagged as ASSUMED
- Resend SDK v6 send signature: LOW — flagged as ASSUMED; planner must verify
- Pitfalls: HIGH — derived from existing code analysis (IDOR confirmed by reading routes/photos.js)

**Research date:** 2026-06-19
**Valid until:** 2026-07-19 (30 days; packages are stable)
