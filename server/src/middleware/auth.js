/**
 * auth.js — requireAuth middleware (D-03)
 *
 * Reads the httpOnly auth_token cookie, verifies the JWT, and sets req.userId.
 * Returns a generic 401 on missing or invalid token — no info leak (T-02-ENUM).
 *
 * req.userId is kept as a string (ObjectId.toString()); aggregate pipelines must
 * cast explicitly: new mongoose.Types.ObjectId(req.userId) (Pitfall 6).
 */

import { verifyToken } from '../utils/jwt.js';

export async function requireAuth(req, res, next) {
  const token = req.cookies?.auth_token;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const userId = await verifyToken(token);
    req.userId = userId; // string; convert to ObjectId in aggregate queries
    next();
  } catch {
    // jose throws on expired/invalid/tampered — do not distinguish (no info leak)
    return res.status(401).json({ error: 'Authentication required' });
  }
}
