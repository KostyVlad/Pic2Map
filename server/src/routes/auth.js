/**
 * /api/auth router (D-02, D-03, D-05, D-06)
 *
 * POST /signup           — create account + log in immediately (no email verification)
 * POST /login            — authenticate with email + password + optional rememberMe
 * POST /logout           — clear the session cookie
 * GET  /me               — return authenticated user info (requireAuth protected)
 * POST /forgot-password  — send a hashed, single-use, short-TTL reset link (AUTH-05, D-06)
 * POST /reset-password   — validate token, set new argon2id password, clear token (AUTH-05)
 *
 * Security notes:
 * - Passwords hashed with argon2id (D-03, T-02-PW)
 * - JWT in httpOnly sameSite=lax cookie; secure only in production (D-03, Pitfall 3)
 * - Login returns identical 401 for unknown email AND wrong password (T-02-ENUM, Pitfall 5)
 * - Rate limiting on /signup, /login, and /forgot-password (T-02-CS, T-02-RST-BRUTE)
 * - /login uses skipSuccessfulRequests so only failed attempts consume the quota
 * - Reset token: sha256(rawToken) stored at rest; raw token only in the emailed link (T-02-RST-HARVEST)
 * - forgot-password always returns 200 regardless of whether the email matched (T-02-RST-ENUM)
 * - reset token is single-use (cleared after use) and has a 1h TTL (T-02-RST-HARVEST)
 */

import { Router } from 'express';
import argon2 from 'argon2';
import { randomBytes, createHash } from 'node:crypto';
import rateLimit from 'express-rate-limit';
import User from '../models/User.js';
import { signToken } from '../utils/jwt.js';
import { requireAuth } from '../middleware/auth.js';
import { sendEmail } from '../services/email/index.js';
import config from '../config.js';

const router = Router();

// ---------------------------------------------------------------------------
// Cookie helpers (Pattern 3)
// ---------------------------------------------------------------------------

const COOKIE_NAME = 'auth_token';

function setAuthCookie(res, token, rememberMe) {
  const maxAge = rememberMe
    ? 30 * 24 * 60 * 60 * 1000  // 30 days in ms
    : 24 * 60 * 60 * 1000;       // 1 day in ms
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.COOKIE_SECURE,  // false in dev, true in prod (Pitfall 3)
    maxAge,
  });
}

function clearAuthCookie(res) {
  // Options MUST match the set options or the browser won't clear the cookie
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.COOKIE_SECURE,
  });
}

// ---------------------------------------------------------------------------
// Rate limiters (T-02-CS)
// ---------------------------------------------------------------------------

const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Wait a moment before trying again.' },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // only failed logins count toward the limit
  message: { error: 'Too many attempts. Wait a moment before trying again.' },
});

// Rate limiter for forgot-password (T-02-RST-BRUTE)
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,                    // stricter than login — reset emails are expensive
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Wait a moment before trying again.' },
});

// ---------------------------------------------------------------------------
// POST /signup
// ---------------------------------------------------------------------------
router.post('/signup', signupLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate inputs
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Hash password with argon2id (D-03, T-02-PW — never store plaintext)
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

    let user;
    try {
      user = await User.create({ email: normalizedEmail, passwordHash });
    } catch (err) {
      // E11000 = duplicate key — email already registered
      if (err.code === 11000) {
        return res.status(400).json({ error: 'Email already registered' });
      }
      throw err;
    }

    // Log in immediately (D-02 — no email verification)
    const token = await signToken(user._id, false);
    setAuthCookie(res, token, false);

    return res.status(201).json({ user: { id: user._id, email: user.email } });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /login
// ---------------------------------------------------------------------------
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password, rememberMe } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Password is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Look up user — identical response for not-found and wrong-password (T-02-ENUM, Pitfall 5)
    const user = await User.findOne({ email: normalizedEmail });

    let passwordValid = false;
    if (user) {
      try {
        passwordValid = await argon2.verify(user.passwordHash, password);
      } catch {
        // argon2.verify throws on malformed hash — treat as invalid
        passwordValid = false;
      }
    }

    if (!user || !passwordValid) {
      return res.status(401).json({ error: 'Incorrect email or password' });
    }

    const isRememberMe = Boolean(rememberMe);
    const token = await signToken(user._id, isRememberMe);
    setAuthCookie(res, token, isRememberMe);

    return res.status(200).json({ user: { id: user._id, email: user.email } });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /logout
// ---------------------------------------------------------------------------
router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  return res.status(200).json({ ok: true });
});

// ---------------------------------------------------------------------------
// GET /me (requireAuth protected)
// ---------------------------------------------------------------------------
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select('_id email');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.status(200).json({ id: user._id, email: user.email });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /forgot-password (AUTH-05, Pattern 6, T-02-RST-ENUM, T-02-RST-HARVEST)
// ---------------------------------------------------------------------------
router.post('/forgot-password', forgotPasswordLimiter, async (req, res, next) => {
  try {
    const { email } = req.body;

    // Basic email validation (fail fast before DB lookup)
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      // Still return the same 200 shape — we don't reveal validation specifics to prevent enumeration.
      // An invalid email will simply not match any user in the DB, so we fall through to the same response.
      return res.status(200).json({ message: "If that address has an account, we've sent a reset link." });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Look up user — existence is NOT revealed in the response (T-02-RST-ENUM, Pitfall 5)
    const user = await User.findOne({ email: normalizedEmail });

    if (user) {
      // Generate a 256-bit cryptographically random raw token (Pattern 6)
      const rawToken = randomBytes(32).toString('hex'); // 64-char hex string

      // Store ONLY the sha256 hash at rest — raw token never touches the DB (T-02-RST-HARVEST)
      const hashedToken = createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour TTL

      user.resetToken = hashedToken;
      user.resetTokenExpiresAt = expiresAt;
      await user.save();

      // Token goes in the query param (not path) to reduce Referer leakage (Pitfall 7)
      const resetUrl = `${config.APP_URL}/reset-password?token=${rawToken}`;

      // Try to send — failure is caught and logged; response shape does NOT change (T-02-RST-MAIL)
      try {
        await sendEmail({
          to: normalizedEmail,
          subject: 'Reset your password',
          html: `
            <p>You requested a password reset for your PhotoMap account.</p>
            <p>
              <a href="${resetUrl}">Click here to reset your password</a>
            </p>
            <p>This link expires in 1 hour and can only be used once.</p>
            <p>If you did not request a password reset, you can safely ignore this email.</p>
          `,
        });
      } catch (emailErr) {
        // Log server-side but do NOT propagate — the 200 contract must hold (T-02-RST-MAIL)
        console.error('[forgot-password] Failed to send reset email:', emailErr.message);
      }
    }

    // ALWAYS return 200 with the same body regardless of whether the email matched (T-02-RST-ENUM)
    return res.status(200).json({ message: "If that address has an account, we've sent a reset link." });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /reset-password (AUTH-05, Pattern 6, T-02-RST-HARVEST)
// ---------------------------------------------------------------------------
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = req.body;

    // Validate inputs
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Hash the incoming raw token to look up against the stored hash (Pattern 6)
    const hashedIncoming = createHash('sha256').update(token.trim()).digest('hex');

    // Find user with matching hashed token AND non-expired TTL (single query — atomic check)
    const user = await User.findOne({
      resetToken: hashedIncoming,
      resetTokenExpiresAt: { $gt: new Date() }, // not expired
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    // Set the new argon2id password hash (D-03, T-02-PW)
    user.passwordHash = await argon2.hash(password, { type: argon2.argon2id });

    // Clear token fields — this IS the single-use enforcement (Pattern 6)
    user.resetToken = undefined;
    user.resetTokenExpiresAt = undefined;

    await user.save();

    // Do NOT auto-login — UI-SPEC Screen 4 success state sends user to /login
    return res.status(200).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
