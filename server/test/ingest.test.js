/**
 * Ingest pipeline tests — node --test
 *
 * Covers:
 *  - extractIso: ISO_A2 '-99' fallback to ISO_A2_EH (France/Norway fix)
 *  - extractIso: normal ISO_A2 pass-through
 *  - ingestPhoto: returns { thumbBuffer, displayBuffer } both valid JPEGs
 *  - ingestPhoto: thumbBuffer width <= 300px; displayBuffer width <= 1200px
 *  - ingestPhoto: NO exif block on returned buffers (EXIF stripped)
 *  - LocalDiskStorage: put + getLocalPath + getUrl round-trip against a temp dir
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import sharp from 'sharp';

// Modules under test
import { extractIso } from '../src/utils/isoCode.js';
import { ingestPhoto } from '../src/services/ingest.js';
import { LocalDiskStorage } from '../src/services/storage/LocalDiskStorage.js';

// ---------------------------------------------------------------------------
// Helper: generate a minimal JPEG buffer with fake EXIF using sharp
// ---------------------------------------------------------------------------
async function makeTestJpeg(width = 400, height = 300) {
  // Create a solid-color image and embed minimal EXIF metadata
  const buffer = await sharp({
    create: { width, height, channels: 3, background: { r: 100, g: 150, b: 200 } },
  })
    .withExif({
      IFD0: {
        Make: 'TestCamera',
        Model: 'TestModel',
      },
    })
    .jpeg({ quality: 85 })
    .toBuffer();
  return buffer;
}

// ---------------------------------------------------------------------------
// extractIso tests
// ---------------------------------------------------------------------------
describe('extractIso', () => {
  test('returns ISO_A2_EH for feature with ISO_A2 = "-99" (France fix)', () => {
    const feature = {
      properties: {
        ISO_A2: '-99',
        ISO_A2_EH: 'FR',
        ISO_A3: 'FRA',
        NAME: 'France',
      },
    };
    const code = extractIso(feature);
    assert.equal(code, 'FR');
  });

  test('returns ISO_A2 for a normal feature (US)', () => {
    const feature = {
      properties: {
        ISO_A2: 'US',
        ISO_A2_EH: 'US',
        ISO_A3: 'USA',
        NAME: 'United States of America',
      },
    };
    const code = extractIso(feature);
    assert.equal(code, 'US');
  });

  test('returns ISO_A2 uppercased', () => {
    const feature = {
      properties: {
        ISO_A2: 'gb',
        ISO_A2_EH: 'gb',
        ISO_A3: 'GBR',
        NAME: 'United Kingdom',
      },
    };
    const code = extractIso(feature);
    assert.equal(code, 'GB');
  });

  test('falls back to ISO_A3 slice when ISO_A2 and ISO_A2_EH are both "-99"', () => {
    const feature = {
      properties: {
        ISO_A2: '-99',
        ISO_A2_EH: '-99',
        ISO_A3: 'NOR',
        NAME: 'Norway',
      },
    };
    const code = extractIso(feature);
    assert.equal(code, 'NO');
  });

  test('falls back to NAME slug when all ISO fields are absent', () => {
    const feature = {
      properties: {
        ISO_A2: '-99',
        ISO_A2_EH: '-99',
        ISO_A3: '-99',
        NAME: 'Test Land',
      },
    };
    const code = extractIso(feature);
    assert.equal(code, 'TEST_LAND');
  });
});

// ---------------------------------------------------------------------------
// ingestPhoto tests
// ---------------------------------------------------------------------------
describe('ingestPhoto', () => {
  test('returns thumbBuffer and displayBuffer as Buffers', async () => {
    const input = await makeTestJpeg(400, 300);
    const result = await ingestPhoto(input, 'image/jpeg', 'US');
    assert.ok(result.thumbBuffer instanceof Buffer, 'thumbBuffer should be a Buffer');
    assert.ok(result.displayBuffer instanceof Buffer, 'displayBuffer should be a Buffer');
  });

  test('thumbBuffer is a valid JPEG', async () => {
    const input = await makeTestJpeg(400, 300);
    const { thumbBuffer } = await ingestPhoto(input, 'image/jpeg', 'US');
    const meta = await sharp(thumbBuffer).metadata();
    assert.equal(meta.format, 'jpeg', 'thumbBuffer should be JPEG format');
  });

  test('displayBuffer is a valid JPEG', async () => {
    const input = await makeTestJpeg(400, 300);
    const { displayBuffer } = await ingestPhoto(input, 'image/jpeg', 'US');
    const meta = await sharp(displayBuffer).metadata();
    assert.equal(meta.format, 'jpeg', 'displayBuffer should be JPEG format');
  });

  test('thumbBuffer width is <= 300px', async () => {
    const input = await makeTestJpeg(600, 400);
    const { thumbBuffer } = await ingestPhoto(input, 'image/jpeg', 'US');
    const meta = await sharp(thumbBuffer).metadata();
    assert.ok(meta.width <= 300, `thumbBuffer width (${meta.width}) should be <= 300`);
  });

  test('displayBuffer width is <= 1200px', async () => {
    const input = await makeTestJpeg(2000, 1500);
    const { displayBuffer } = await ingestPhoto(input, 'image/jpeg', 'US');
    const meta = await sharp(displayBuffer).metadata();
    assert.ok(meta.width <= 1200, `displayBuffer width (${meta.width}) should be <= 1200`);
  });

  test('small image is not enlarged beyond original size (thumbBuffer)', async () => {
    const input = await makeTestJpeg(100, 80);
    const { thumbBuffer } = await ingestPhoto(input, 'image/jpeg', 'US');
    const meta = await sharp(thumbBuffer).metadata();
    assert.ok(meta.width <= 100, `thumbBuffer width (${meta.width}) should not exceed original 100`);
  });

  test('thumbBuffer has NO exif metadata (EXIF stripped)', async () => {
    const input = await makeTestJpeg(400, 300);
    const { thumbBuffer } = await ingestPhoto(input, 'image/jpeg', 'US');
    const meta = await sharp(thumbBuffer).metadata();
    assert.equal(meta.exif, undefined, 'thumbBuffer should have no EXIF block');
  });

  test('displayBuffer has NO exif metadata (EXIF stripped)', async () => {
    const input = await makeTestJpeg(400, 300);
    const { displayBuffer } = await ingestPhoto(input, 'image/jpeg', 'US');
    const meta = await sharp(displayBuffer).metadata();
    assert.equal(meta.exif, undefined, 'displayBuffer should have no EXIF block');
  });
});

// ---------------------------------------------------------------------------
// LocalDiskStorage tests
// ---------------------------------------------------------------------------
describe('LocalDiskStorage', () => {
  let tmpBase;

  test('put writes file and getLocalPath returns correct path', async () => {
    tmpBase = join(tmpdir(), `photomap-test-${randomUUID()}`);
    const storage = new LocalDiskStorage(tmpBase);
    const key = 'test-photo.jpg';
    const buf = Buffer.from('fake-jpeg-bytes');

    await storage.put(key, buf);

    const localPath = storage.getLocalPath(key);
    assert.ok(localPath.endsWith(key), 'getLocalPath should end with the key');

    // Verify file exists and content matches
    const { readFile } = await import('node:fs/promises');
    const written = await readFile(localPath);
    assert.deepEqual(written, buf, 'Written file content should match original buffer');
  });

  test('getUrl returns the /api/photos/file/<encoded-key> URL', async () => {
    tmpBase = join(tmpdir(), `photomap-test-${randomUUID()}`);
    const storage = new LocalDiskStorage(tmpBase);
    const key = 'abc123-display.jpg';
    const url = await storage.getUrl(key);
    assert.equal(url, `/api/photos/file/${encodeURIComponent(key)}`);
  });

  test('delete removes the file', async () => {
    tmpBase = join(tmpdir(), `photomap-test-${randomUUID()}`);
    const storage = new LocalDiskStorage(tmpBase);
    const key = 'to-delete.jpg';
    const buf = Buffer.from('data');

    await storage.put(key, buf);
    await storage.delete(key);

    const { access } = await import('node:fs/promises');
    await assert.rejects(
      () => access(storage.getLocalPath(key)),
      'File should not exist after delete'
    );

    // Cleanup
    await rm(tmpBase, { recursive: true, force: true });
  });
});
