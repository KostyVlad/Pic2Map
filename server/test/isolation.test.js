/**
 * isolation.test.js — Cross-user data isolation + IDOR tests
 *
 * Verifies that:
 *  1. Data routes return 401 without a cookie
 *  2. User A's photos do not appear in User B's list
 *  3. Photo counts for User B exclude User A's country
 *  4. GET /api/photos/file/:key with User B's cookie returns 404 for User A's key
 *
 * Self-skips if MONGODB_URI is not set (same pattern as auth.test.js).
 *
 * Run: node --test test/isolation.test.js
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';

// ------------------------------------------------------------------
// Self-skip guard
// ------------------------------------------------------------------
if (!process.env.MONGODB_URI) {
  console.log('SKIP: isolation.test.js — MONGODB_URI not set; skipping integration tests.');
  process.exit(0);
}

// ------------------------------------------------------------------
// Lazy imports (only after skip guard passes)
// ------------------------------------------------------------------
const { default: app } = await import('../src/app.js');
const { default: Photo } = await import('../src/models/Photo.js');
const { default: User } = await import('../src/models/User.js');
const { connectDb } = await import('../src/db.js');

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

/** Make a simple HTTP request against the test server. Returns { status, headers, body }. */
function request(server, method, path, { headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const options = {
      hostname: '127.0.0.1',
      port: addr.port,
      path,
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
    };
    const req = http.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(raw); } catch { parsed = raw; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    if (body !== null) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

/** Sign up a test user and return the Set-Cookie header value (auth_token cookie string). */
async function signup(server, email, password = 'testPass123') {
  const res = await request(server, 'POST', '/api/auth/signup', {
    body: { email, password },
  });
  assert.equal(res.status, 201, `Signup failed for ${email}: ${JSON.stringify(res.body)}`);
  const setCookie = res.headers['set-cookie'];
  assert.ok(setCookie, 'Expected set-cookie header after signup');
  // Return just the first Set-Cookie entry (auth_token=...; ...)
  return Array.isArray(setCookie) ? setCookie[0] : setCookie;
}

/** Extract just the cookie value part (e.g. "auth_token=abc; Path=/; ...") → suitable for Cookie header. */
function cookieHeader(setCookieValue) {
  return setCookieValue.split(';')[0]; // "auth_token=<token>"
}

// ------------------------------------------------------------------
// Test Suite
// ------------------------------------------------------------------
describe('cross-user isolation (IDOR + AUTH-04)', async () => {
  let server;
  const DB_NAME = `photo_map_isolation_test_${randomUUID().slice(0, 8)}`;

  before(async () => {
    // Connect to a dedicated test database
    const baseUri = process.env.MONGODB_URI.replace(/\/[^/?]+(\?|$)/, `/${DB_NAME}$1`);
    await connectDb();
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  });

  after(async () => {
    // Clean up test data and disconnect
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    await new Promise((resolve) => server.close(resolve));
  });

  // ----------------------------------------------------------------
  // Group 1: Unauthenticated access returns 401
  // ----------------------------------------------------------------
  describe('unauthenticated access → 401', () => {
    test('GET /api/photos without cookie returns 401', async () => {
      const res = await request(server, 'GET', '/api/photos?countryCode=US');
      assert.equal(res.status, 401);
    });

    test('GET /api/countries/photo-counts without cookie returns 401', async () => {
      const res = await request(server, 'GET', '/api/countries/photo-counts');
      assert.equal(res.status, 401);
    });

    test('POST /api/photos without cookie returns 401', async () => {
      const res = await request(server, 'POST', '/api/photos', {
        body: { countryCode: 'US' },
      });
      assert.equal(res.status, 401);
    });
  });

  // ----------------------------------------------------------------
  // Group 2: Cross-user photo list isolation
  // ----------------------------------------------------------------
  describe('photo list isolation — User B cannot see User A\'s photos', () => {
    let cookieA, cookieB;
    let photoAId;

    before(async () => {
      const emailA = `user-a-${randomUUID().slice(0, 6)}@test.invalid`;
      const emailB = `user-b-${randomUUID().slice(0, 6)}@test.invalid`;
      const rawCookieA = await signup(server, emailA);
      const rawCookieB = await signup(server, emailB);
      cookieA = cookieHeader(rawCookieA);
      cookieB = cookieHeader(rawCookieB);

      // Insert a photo directly for User A (faster than multipart upload in tests)
      const userA = await User.findOne({ email: emailA });
      assert.ok(userA, 'User A not found');
      const photo = await Photo.create({
        countryCode: 'DE',
        countryName: 'Germany',
        storageKey: `${randomUUID()}-display.jpg`,
        thumbnailKey: `${randomUUID()}-thumb.jpg`,
        mimeType: 'image/jpeg',
        originalFilename: 'test.jpg',
        fileSize: 1024,
        userId: userA._id,
      });
      photoAId = photo._id.toString();
    });

    test('User A can see their own photo in DE', async () => {
      const res = await request(server, 'GET', '/api/photos?countryCode=DE', {
        headers: { Cookie: cookieA },
      });
      assert.equal(res.status, 200);
      const ids = res.body.map(p => p._id.toString());
      assert.ok(ids.includes(photoAId), 'User A should see their own photo');
    });

    test('User B sees an empty list for DE (User A\'s photo not visible)', async () => {
      const res = await request(server, 'GET', '/api/photos?countryCode=DE', {
        headers: { Cookie: cookieB },
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.length, 0, 'User B must not see User A\'s photos');
    });

    test('User B\'s photo-counts do not include User A\'s DE entry', async () => {
      const res = await request(server, 'GET', '/api/countries/photo-counts', {
        headers: { Cookie: cookieB },
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.DE, undefined, 'User B\'s photo-counts must not include DE');
    });
  });

  // ----------------------------------------------------------------
  // Group 3: File-serving IDOR closed
  // ----------------------------------------------------------------
  describe('file-serving IDOR — GET /file/:key with non-owner returns 404', () => {
    let cookieA, cookieB, storageKeyA;

    before(async () => {
      const emailA = `idor-a-${randomUUID().slice(0, 6)}@test.invalid`;
      const emailB = `idor-b-${randomUUID().slice(0, 6)}@test.invalid`;
      const rawCookieA = await signup(server, emailA);
      const rawCookieB = await signup(server, emailB);
      cookieA = cookieHeader(rawCookieA);
      cookieB = cookieHeader(rawCookieB);

      // Insert a photo for User A with a well-known storage key
      const userA = await User.findOne({ email: emailA });
      storageKeyA = `${randomUUID()}-display.jpg`;
      await Photo.create({
        countryCode: 'FR',
        countryName: 'France',
        storageKey: storageKeyA,
        thumbnailKey: `${randomUUID()}-thumb.jpg`,
        mimeType: 'image/jpeg',
        originalFilename: 'idor-test.jpg',
        fileSize: 512,
        userId: userA._id,
      });
    });

    test('GET /api/photos/file/:key with User B\'s cookie returns 404 (IDOR closed)', async () => {
      const res = await request(server, 'GET', `/api/photos/file/${encodeURIComponent(storageKeyA)}`, {
        headers: { Cookie: cookieB },
      });
      // Must be 404 — must NOT be 403 or 200 (Pitfall 1: no existence leak)
      assert.equal(res.status, 404, 'Non-owner must receive 404, not 403 or 200');
    });
  });
});
