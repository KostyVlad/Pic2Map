/**
 * /api/auth router (D-02, D-03, D-05)
 *
 * POST /signup    — create account + log in immediately (no email verification)
 * POST /login     — authenticate with email + password + optional rememberMe
 * POST /logout    — clear the session cookie
 * GET  /me        — return authenticated user info (requireAuth protected)
 *
 * Security notes:
 * - Passwords hashed with argon2id (D-03, T-02-PW)
 * - JWT in httpOnly sameSite=lax cookie; secure only in production (D-03, Pitfall 3)
 * - Login returns identical 401 for unknown email AND wrong password (T-02-ENUM, Pitfall 5)
 * - Rate limiting on /signup and /login (T-02-CS)
 * - /login uses skipSuccessfulRequests so only failed attempts consume the quota
 */

import { Router } from 'express';
import argon2 from 'argon2';
import rateLimit from 'express-rate-limit';
import User from '../models/User.js';
import { signToken } from '../utils/jwt.js';
import { requireAuth } from '../middleware/auth.js';
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

export default router;
