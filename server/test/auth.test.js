/**
 * auth.test.js — Integration tests for the /api/auth routes
 *
 * Tests the complete signup → login → logout → me path against a REAL Express app
 * and a REAL MongoDB database (from MONGODB_URI env var).
 *
 * If MONGODB_URI is not set, the test self-skips with a clear diagnostic message.
 * This prevents CI failures on machines without a MongoDB connection.
 *
 * Covers:
 *  - POST /api/auth/signup: 201 + Set-Cookie on success
 *  - POST /api/auth/signup: 400 on duplicate email
 *  - POST /api/auth/login: 200 + Set-Cookie with correct credentials
 *  - POST /api/auth/login: 401 with wrong password (generic message)
 *  - POST /api/auth/login: 401 with unknown email (same generic message — no enumeration)
 *  - POST /api/auth/login (rememberMe:true): longer Max-Age than default
 *  - POST /api/auth/logout: clears auth_token cookie (Set-Cookie with Max-Age=0/past Expires)
 *  - GET  /api/auth/me with auth cookie: returns {id, email}
 *  - GET  /api/auth/me without cookie: 401
 *  - Stored User document has passwordHash, not plaintext password (T-02-PW)
 *
 * Run: node --test test/auth.test.js
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// Skip if MONGODB_URI is not set
// ---------------------------------------------------------------------------
const MONGODB_URI = process.env.MONGODB_URI;
const SKIP = !MONGODB_URI;

if (SKIP) {
  console.log(
    '\n[auth.test.js] SKIPPED: MONGODB_URI environment variable is not set.\n' +
    'To run this test:\n' +
    '  1. Ensure MONGODB_URI is set in server/.env\n' +
    '  2. Re-run: node --test test/auth.test.js\n'
  );
  process.exit(0);
}

// ---------------------------------------------------------------------------
// HTTP helper — makes a request to the test server
// ---------------------------------------------------------------------------
function request(server, { method, path: reqPath, headers, body, cookies }) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const allHeaders = { ...headers };

    if (body) {
      const bodyStr = JSON.stringify(body);
      allHeaders['Content-Type'] = 'application/json';
      allHeaders['Content-Length'] = Buffer.byteLength(bodyStr);
    }
    if (cookies) {
      allHeaders['Cookie'] = cookies;
    }

    const options = {
      hostname: '127.0.0.1',
      port: addr.port,
      path: reqPath,
      method,
      headers: allHeaders,
    };

    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const rawBody = Buffer.concat(chunks);
        let parsedBody;
        const ct = res.headers['content-type'] || '';
        if (ct.includes('application/json')) {
          try { parsedBody = JSON.parse(rawBody.toString()); } catch { parsedBody = rawBody; }
        } else {
          parsedBody = rawBody;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: parsedBody });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/** Extract auth_token cookie value from Set-Cookie header */
function extractCookie(headers) {
  const setCookie = headers['set-cookie'];
  if (!setCookie) return null;
  const header = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  const match = header.match(/auth_token=([^;]+)/);
  return match ? `auth_token=${match[1]}` : null;
}

/** Extract Max-Age from Set-Cookie header */
function extractMaxAge(headers) {
  const setCookie = headers['set-cookie'];
  if (!setCookie) return null;
  const header = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  const match = header.match(/Max-Age=(\d+)/i);
  return match ? Number(match[1]) : null;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Auth API — integration', () => {
  let server;
  const TEST_DB = `photomap_auth_${randomUUID().slice(0, 8)}`;
  const TEST_MONGO_URI = MONGODB_URI.replace(/\/[^/?]+(\?|$)/, `/${TEST_DB}$1`);

  // Shared state across tests (sequential)
  const testEmail = `test_${randomUUID().slice(0, 8)}@example.com`;
  const testPassword = 'password1234';
  let signupCookie = null;

  before(async () => {
    process.env.MONGODB_URI = TEST_MONGO_URI;
    process.env.PORT = '0';
    // JWT_SECRET must be set — test relies on the real config which reads from .env
    // If JWT_SECRET is not set the import will throw and the test will fail with a clear message.

    const { connectDb } = await import('../src/db.js');
    const { default: app } = await import('../src/app.js');

    await connectDb();

    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.db.dropDatabase();
      await mongoose.connection.close();
    }
    if (server) await new Promise(resolve => server.close(resolve));
  });

  // -------------------------------------------------------------------------
  // Test 1: Signup → 201 + Set-Cookie
  // -------------------------------------------------------------------------
  test('POST /api/auth/signup with valid data returns 201 + Set-Cookie', async () => {
    const res = await request(server, {
      method: 'POST',
      path: '/api/auth/signup',
      body: { email: testEmail, password: testPassword },
    });

    assert.equal(res.status, 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.ok(res.body.user, 'Response should have user');
    assert.equal(res.body.user.email, testEmail, 'Returned email should match');
    assert.ok(res.body.user.id, 'Response should have user.id');

    const cookie = extractCookie(res.headers);
    assert.ok(cookie, 'Should have Set-Cookie with auth_token');

    signupCookie = cookie; // save for /me test
  });

  // -------------------------------------------------------------------------
  // Test 2: Duplicate email → 400
  // -------------------------------------------------------------------------
  test('POST /api/auth/signup with duplicate email returns 400', async () => {
    const res = await request(server, {
      method: 'POST',
      path: '/api/auth/signup',
      body: { email: testEmail, password: 'differentpass123' },
    });

    assert.equal(res.status, 400, `Expected 400, got ${res.status}`);
    assert.ok(
      res.body.error && res.body.error.includes('already registered'),
      `Expected "already registered" error, got: ${res.body.error}`
    );
  });

  // -------------------------------------------------------------------------
  // Test 3: Login correct credentials → 200 + Set-Cookie
  // -------------------------------------------------------------------------
  test('POST /api/auth/login with correct credentials returns 200 + Set-Cookie', async () => {
    const res = await request(server, {
      method: 'POST',
      path: '/api/auth/login',
      body: { email: testEmail, password: testPassword },
    });

    assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.ok(res.body.user, 'Response should have user');
    assert.equal(res.body.user.email, testEmail);

    const cookie = extractCookie(res.headers);
    assert.ok(cookie, 'Should have Set-Cookie with auth_token');
  });

  // -------------------------------------------------------------------------
  // Test 4: Login wrong password → 401 with generic message
  // -------------------------------------------------------------------------
  test('POST /api/auth/login with wrong password returns 401 generic message', async () => {
    const res = await request(server, {
      method: 'POST',
      path: '/api/auth/login',
      body: { email: testEmail, password: 'wrongpassword' },
    });

    assert.equal(res.status, 401, `Expected 401, got ${res.status}`);
    assert.equal(
      res.body.error,
      'Incorrect email or password',
      `Generic message expected, got: ${res.body.error}`
    );
  });

  // -------------------------------------------------------------------------
  // Test 5: Login unknown email → same 401 generic message (no enumeration)
  // -------------------------------------------------------------------------
  test('POST /api/auth/login with unknown email returns 401 same generic message', async () => {
    const res = await request(server, {
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'nobody@nowhere.example.com', password: 'anypassword123' },
    });

    assert.equal(res.status, 401, `Expected 401, got ${res.status}`);
    assert.equal(
      res.body.error,
      'Incorrect email or password',
      `Same generic message expected, got: ${res.body.error}`
    );
  });

  // -------------------------------------------------------------------------
  // Test 6: Remember-me sets a longer Max-Age (30d > 1d)
  // -------------------------------------------------------------------------
  test('POST /api/auth/login with rememberMe:true sets a longer Max-Age', async () => {
    const shortRes = await request(server, {
      method: 'POST',
      path: '/api/auth/login',
      body: { email: testEmail, password: testPassword, rememberMe: false },
    });
    const longRes = await request(server, {
      method: 'POST',
      path: '/api/auth/login',
      body: { email: testEmail, password: testPassword, rememberMe: true },
    });

    const shortMaxAge = extractMaxAge(shortRes.headers);
    const longMaxAge = extractMaxAge(longRes.headers);

    assert.ok(shortMaxAge !== null, 'Short login should have Max-Age');
    assert.ok(longMaxAge !== null, 'Remember-me login should have Max-Age');
    assert.ok(
      longMaxAge > shortMaxAge,
      `Remember-me Max-Age (${longMaxAge}) should be longer than default (${shortMaxAge})`
    );
    // 30d in seconds = 2592000; 1d in seconds = 86400
    assert.ok(longMaxAge >= 2590000, `Remember-me Max-Age should be ~30d, got: ${longMaxAge}`);
    assert.ok(shortMaxAge <= 90000, `Default Max-Age should be ~1d, got: ${shortMaxAge}`);
  });

  // -------------------------------------------------------------------------
  // Test 7: Logout clears auth_token cookie
  // -------------------------------------------------------------------------
  test('POST /api/auth/logout returns 200 and clears auth_token cookie', async () => {
    const res = await request(server, {
      method: 'POST',
      path: '/api/auth/logout',
    });

    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
    assert.deepEqual(res.body, { ok: true });

    const setCookie = res.headers['set-cookie'];
    assert.ok(setCookie, 'Should have Set-Cookie header on logout');
    const header = Array.isArray(setCookie) ? setCookie[0] : setCookie;

    // Cookie should be cleared: Max-Age=0 OR expires in the past
    const isCleared = header.includes('Max-Age=0') ||
                      header.includes('auth_token=;') ||
                      header.includes('auth_token= ;') ||
                      header.match(/auth_token=[^;]*;[^;]*Expires=[^;]*1970/i);
    assert.ok(isCleared, `Cookie should be cleared, got: ${header}`);
  });

  // -------------------------------------------------------------------------
  // Test 8: GET /me with cookie → {id, email}
  // -------------------------------------------------------------------------
  test('GET /api/auth/me with auth cookie returns user info', async () => {
    // Get a fresh login cookie
    const loginRes = await request(server, {
      method: 'POST',
      path: '/api/auth/login',
      body: { email: testEmail, password: testPassword },
    });
    const cookie = extractCookie(loginRes.headers);
    assert.ok(cookie, 'Need a login cookie for /me test');

    const res = await request(server, {
      method: 'GET',
      path: '/api/auth/me',
      cookies: cookie,
    });

    assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.email, testEmail);
    assert.ok(res.body.id, 'Response should have id');
  });

  // -------------------------------------------------------------------------
  // Test 9: GET /me without cookie → 401
  // -------------------------------------------------------------------------
  test('GET /api/auth/me without cookie returns 401', async () => {
    const res = await request(server, {
      method: 'GET',
      path: '/api/auth/me',
    });

    assert.equal(res.status, 401, `Expected 401, got ${res.status}`);
    assert.ok(
      res.body.error && res.body.error.includes('Authentication required'),
      `Expected auth error, got: ${res.body.error}`
    );
  });

  // -------------------------------------------------------------------------
  // Test 10: Stored User has passwordHash, NOT plaintext password (T-02-PW)
  // -------------------------------------------------------------------------
  test('Stored User document has passwordHash, no plaintext password field', async () => {
    const { default: User } = await import('../src/models/User.js');
    const user = await User.findOne({ email: testEmail }).lean();

    assert.ok(user, 'User should exist in MongoDB');
    assert.ok(user.passwordHash, 'User should have passwordHash');
    assert.equal(user.password, undefined, 'User should NOT have a plaintext password field');

    // passwordHash should be an argon2 hash (starts with $argon2)
    assert.ok(
      user.passwordHash.startsWith('$argon2'),
      `passwordHash should be an argon2 hash, got: ${user.passwordHash.substring(0, 20)}...`
    );
  });
});
