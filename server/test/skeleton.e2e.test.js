/**
 * skeleton.e2e.test.js — Walking Skeleton end-to-end test
 *
 * Tests the complete upload→list→serve→count path against a REAL Express app
 * and a REAL MongoDB database (from MONGODB_URI env var).
 *
 * If MONGODB_URI is not set, the test self-skips with a clear diagnostic message.
 * This prevents CI failures on machines without a MongoDB connection.
 *
 * Proven by this test:
 *  - POST /api/photos with a real JPEG buffer → 201 + photoId + thumbnailUrl (PHOTO-01)
 *  - GET  /api/photos?countryCode=US → uploaded photo appears (PHOTO-06)
 *  - GET  /api/photos/file/<key>     → 200 with image content-type (PHOTO-02)
 *  - GET  /api/countries/photo-counts → { US: >=1 } (CMAP-04)
 *  - Mongo document has NO binary field — only storageKey/thumbnailKey (PHOTO-05 / T-01-BIN)
 *  - Non-image buffer → rejected in results with an error (PHOTO-04 / T-01-MAL)
 *
 * Run: node --test test/skeleton.e2e.test.js
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import sharp from 'sharp';
import mongoose from 'mongoose';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';

// ---------------------------------------------------------------------------
// Skip if MONGODB_URI is not set
// ---------------------------------------------------------------------------
const MONGODB_URI = process.env.MONGODB_URI;
const SKIP = !MONGODB_URI;

if (SKIP) {
  console.log(
    '\n[skeleton.e2e.test.js] SKIPPED: MONGODB_URI environment variable is not set.\n' +
    'To run this test:\n' +
    '  1. Create a free MongoDB Atlas M0 cluster: https://www.mongodb.com/atlas\n' +
    '  2. Set MONGODB_URI in server/.env\n' +
    '  3. Re-run: node --test test/skeleton.e2e.test.js\n'
  );
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a minimal JPEG buffer with sharp */
async function makeJpeg(width = 200, height = 150) {
  return sharp({
    create: { width, height, channels: 3, background: { r: 100, g: 150, b: 200 } },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
}

/** Minimal multipart/form-data builder (no external deps) */
function buildFormData(boundary, fields, files) {
  const parts = [];

  for (const [name, value] of Object.entries(fields)) {
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${name}"\r\n\r\n` +
      `${value}\r\n`
    );
  }

  for (const { name, filename, buffer, mimeType } of files) {
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${name}"; filename="${filename}"\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`
    );
    parts.push(buffer);
    parts.push('\r\n');
  }

  parts.push(`--${boundary}--\r\n`);

  return Buffer.concat(
    parts.map(p => (typeof p === 'string' ? Buffer.from(p, 'utf8') : p))
  );
}

/** Make an HTTP request to the test server, returns { status, headers, body } */
function request(server, { method, path: reqPath, headers, body }) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const options = {
      hostname: '127.0.0.1',
      port: addr.port,
      path: reqPath,
      method,
      headers: headers || {},
    };
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const rawBody = Buffer.concat(chunks);
        let body;
        const ct = res.headers['content-type'] || '';
        if (ct.includes('application/json')) {
          try { body = JSON.parse(rawBody.toString()); } catch { body = rawBody; }
        } else {
          body = rawBody;
        }
        resolve({ status: res.statusCode, headers: res.headers, body });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Walking Skeleton — end-to-end', () => {
  let server;
  let tmpStoragePath;
  let uploadedPhotoId;
  let uploadedStorageKey;
  let uploadedThumbnailKey;

  // Use a test-specific DB and storage path to avoid polluting production data
  const TEST_DB = `photomap_e2e_${randomUUID().slice(0, 8)}`;
  const TEST_MONGO_URI = MONGODB_URI.replace(/\/[^/?]+(\?|$)/, `/${TEST_DB}$1`);

  before(async () => {
    // Unique tmp storage path for this test run
    tmpStoragePath = path.join(tmpdir(), `photomap-e2e-${randomUUID()}`);

    // Patch env for config
    process.env.MONGODB_URI = TEST_MONGO_URI;
    process.env.STORAGE_PATH = tmpStoragePath;
    process.env.PORT = '0'; // random port

    // Dynamically import config (uses process.env set above)
    // We need to use a fresh config import — reload modules to pick up test env
    const { default: config } = await import('../src/config.js');
    const { connectDb } = await import('../src/db.js');
    const { default: app } = await import('../src/app.js');

    await connectDb();

    // Wrap Express in http.Server on a random port
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  });

  after(async () => {
    // Clean up Mongo test database
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.db.dropDatabase();
      await mongoose.connection.close();
    }
    // Clean up tmp storage
    await rm(tmpStoragePath, { recursive: true, force: true });
    // Close server
    if (server) await new Promise(resolve => server.close(resolve));
  });

  // -------------------------------------------------------------------------
  // Test 1: POST /api/photos → 201 + photoId + thumbnailUrl
  // -------------------------------------------------------------------------
  test('POST /api/photos with a JPEG returns 201 + photoId + thumbnailUrl', async () => {
    const jpegBuf = await makeJpeg();
    const boundary = `boundary-${randomUUID()}`;
    const body = buildFormData(boundary, { countryCode: 'US', countryName: 'United States' }, [
      { name: 'photos', filename: 'test.jpg', buffer: jpegBuf, mimeType: 'image/jpeg' },
    ]);

    const res = await request(server, {
      method: 'POST',
      path: '/api/photos',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
      body,
    });

    assert.equal(res.status, 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.uploaded, 1, 'Should report 1 uploaded file');
    assert.ok(res.body.results[0].photoId, 'Result should include photoId');
    assert.ok(res.body.results[0].thumbnailUrl, 'Result should include thumbnailUrl');

    // Store for subsequent tests
    uploadedPhotoId = res.body.results[0].photoId;
    uploadedThumbnailKey = res.body.results[0].thumbnailUrl.split('/').pop();
  });

  // -------------------------------------------------------------------------
  // Test 2: GET /api/photos?countryCode=US → uploaded photo appears
  // -------------------------------------------------------------------------
  test('GET /api/photos?countryCode=US lists the uploaded photo', async () => {
    const res = await request(server, {
      method: 'GET',
      path: '/api/photos?countryCode=US',
      headers: {},
    });

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body), 'Should return an array');
    assert.ok(res.body.length >= 1, 'Should have at least one photo');

    const photo = res.body.find(p => String(p._id) === String(uploadedPhotoId));
    assert.ok(photo, 'Uploaded photo should appear in the list');
    assert.equal(photo.countryCode, 'US');
    assert.ok(photo.storageKey, 'Photo should have storageKey');
    assert.ok(photo.thumbnailKey, 'Photo should have thumbnailKey');

    // Save keys for file-serve test
    uploadedStorageKey = photo.storageKey;
  });

  // -------------------------------------------------------------------------
  // Test 3: GET /api/photos/file/:key → 200 with image content-type
  // -------------------------------------------------------------------------
  test('GET /api/photos/file/<storageKey> returns 200 with image content-type', async () => {
    assert.ok(uploadedStorageKey, 'storageKey must be set from prior test');

    const res = await request(server, {
      method: 'GET',
      path: `/api/photos/file/${encodeURIComponent(uploadedStorageKey)}`,
      headers: {},
    });

    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
    assert.ok(
      res.headers['content-type']?.includes('image/'),
      `Expected image content-type, got: ${res.headers['content-type']}`
    );
    assert.ok(res.body.length > 0, 'Response body should be non-empty');
  });

  // -------------------------------------------------------------------------
  // Test 4: GET /api/countries/photo-counts → { US: >= 1 }
  // -------------------------------------------------------------------------
  test('GET /api/countries/photo-counts includes US with count >= 1', async () => {
    const res = await request(server, {
      method: 'GET',
      path: '/api/countries/photo-counts',
      headers: {},
    });

    assert.equal(res.status, 200);
    assert.ok(typeof res.body === 'object' && !Array.isArray(res.body), 'Should return an object map');
    assert.ok(res.body.US >= 1, `Expected US count >= 1, got: ${res.body.US}`);
  });

  // -------------------------------------------------------------------------
  // Test 5: MongoDB document has NO binary field (PHOTO-05 / T-01-BIN)
  // -------------------------------------------------------------------------
  test('Stored MongoDB document has no binary image data — only storageKey/thumbnailKey', async () => {
    const { default: Photo } = await import('../src/models/Photo.js');
    const doc = await Photo.findById(uploadedPhotoId).lean();

    assert.ok(doc, 'Document should exist in MongoDB');
    assert.ok(doc.storageKey, 'Document should have storageKey');
    assert.ok(doc.thumbnailKey, 'Document should have thumbnailKey');

    // Assert no binary fields exist
    const binaryFields = Object.entries(doc).filter(([key, val]) => {
      return Buffer.isBuffer(val) || (val && typeof val === 'object' && val._bsontype === 'Binary');
    });
    assert.equal(
      binaryFields.length,
      0,
      `Document should have no binary fields, found: ${binaryFields.map(([k]) => k).join(', ')}`
    );

    // Sanity: no fields named 'data', 'image', 'buffer', 'raw', 'bytes'
    const suspiciousKeys = ['data', 'image', 'buffer', 'raw', 'bytes', 'content'];
    for (const key of suspiciousKeys) {
      assert.equal(doc[key], undefined, `Document should not have a '${key}' field`);
    }
  });

  // -------------------------------------------------------------------------
  // Test 6: Non-image buffer → rejected with error (PHOTO-04 / T-01-MAL)
  // -------------------------------------------------------------------------
  test('POST /api/photos with a text buffer is rejected (magic-byte check)', async () => {
    const fakeImageBuffer = Buffer.from('This is not an image file. It is plain text content.');
    const boundary = `boundary-${randomUUID()}`;
    const body = buildFormData(boundary, { countryCode: 'US', countryName: 'United States' }, [
      { name: 'photos', filename: 'fake.jpg', buffer: fakeImageBuffer, mimeType: 'image/jpeg' },
    ]);

    const res = await request(server, {
      method: 'POST',
      path: '/api/photos',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
      body,
    });

    // The upload endpoint accepts the batch but marks the invalid file with an error
    assert.equal(res.status, 201, 'Response should still be 201 (batch accepted)');
    assert.equal(res.body.uploaded, 0, 'No files should be recorded as successfully uploaded');

    const result = res.body.results[0];
    assert.ok(result.error, 'Invalid file should have an error in results');
    assert.ok(
      result.error.includes('not accepted') || result.error.includes('File'),
      `Error message should indicate file type issue: "${result.error}"`
    );
  });
});
