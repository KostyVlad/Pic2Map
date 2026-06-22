/**
 * Geo services tests — node --test
 *
 * Covers:
 *  - resolveCountry: returns a country for a known on-land coordinate (Paris)
 *  - resolveCountry: returns null for a mid-ocean coordinate
 *  - isValidGps: rejects lat 999 (out of range)
 *  - isValidGps: rejects non-number input
 *  - isValidGps: accepts a valid GPS pair
 *  - extractGps: returns null for a buffer with no EXIF
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { resolveCountry } from '../src/services/countryLookup.js';
import { extractGps, isValidGps } from '../src/services/gps.js';

// ---------------------------------------------------------------------------
// resolveCountry tests
// ---------------------------------------------------------------------------
describe('resolveCountry', () => {
  test('returns a country for Paris coordinates (lat 48.86, lng 2.35)', () => {
    const result = resolveCountry(48.86, 2.35);
    assert.ok(result !== null, 'should return a result for Paris');
    assert.ok(typeof result.code === 'string' && result.code.length > 0, 'code should be a non-empty string');
    assert.ok(typeof result.name === 'string', 'name should be a string');
  });

  test('returns null for a mid-ocean coordinate (lat 0, lng -30)', () => {
    const result = resolveCountry(0, -30);
    assert.equal(result, null, 'mid-ocean should return null');
  });
});

// ---------------------------------------------------------------------------
// isValidGps tests
// ---------------------------------------------------------------------------
describe('isValidGps', () => {
  test('rejects lat 999 (out of valid range)', () => {
    assert.equal(isValidGps(999, 0), false);
  });

  test('rejects non-number latitude', () => {
    assert.equal(isValidGps('48.86', 2.35), false);
  });

  test('rejects non-number longitude', () => {
    assert.equal(isValidGps(48.86, '2.35'), false);
  });

  test('rejects NaN', () => {
    assert.equal(isValidGps(NaN, 0), false);
    assert.equal(isValidGps(0, NaN), false);
  });

  test('rejects Infinity', () => {
    assert.equal(isValidGps(Infinity, 0), false);
    assert.equal(isValidGps(0, Infinity), false);
  });

  test('accepts a valid GPS pair (Paris)', () => {
    assert.equal(isValidGps(48.86, 2.35), true);
  });

  test('accepts boundary values (-90, -180) and (90, 180)', () => {
    assert.equal(isValidGps(-90, -180), true);
    assert.equal(isValidGps(90, 180), true);
  });
});

// ---------------------------------------------------------------------------
// extractGps tests
// ---------------------------------------------------------------------------
describe('extractGps', () => {
  test('returns null for a buffer with no EXIF (random bytes)', async () => {
    const buf = Buffer.from('not an image');
    const result = await extractGps(buf);
    assert.equal(result, null, 'non-image buffer should return null');
  });

  test('returns null for an empty buffer', async () => {
    const result = await extractGps(Buffer.alloc(0));
    assert.equal(result, null, 'empty buffer should return null');
  });
});
