/**
 * jwt.js — jose HS256 JWT sign + verify helpers (D-03, D-05)
 *
 * - signToken(userId, rememberMe): signs a JWT with sub=userId
 *   expiry: 1d default, 30d with rememberMe (D-05)
 * - verifyToken(token): verifies + returns the userId string (payload.sub)
 *
 * Import config from ../config.js — never read process.env directly here.
 */

import { SignJWT, jwtVerify } from 'jose';
import config from '../config.js';

// Build the HS256 signing key from the secret string
const secret = new TextEncoder().encode(config.JWT_SECRET);

/**
 * Sign a JWT for a given userId.
 * @param {string|object} userId - MongoDB ObjectId or string
 * @param {boolean} rememberMe - true for 30d TTL, false for 1d TTL
 * @returns {Promise<string>} Signed JWT string
 */
export async function signToken(userId, rememberMe = false) {
  const expiresIn = rememberMe ? '30d' : '1d';
  return new SignJWT({ sub: userId.toString() })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}

/**
 * Verify a JWT and return the userId (payload.sub).
 * Throws if the token is expired, invalid, or tampered.
 * @param {string} token
 * @returns {Promise<string>} userId string
 */
export async function verifyToken(token) {
  const { payload } = await jwtVerify(token, secret);
  return payload.sub; // userId string
}
