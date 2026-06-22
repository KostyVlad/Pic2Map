/**
 * GPS extraction from raw image buffers.
 *
 * Uses exifr to read GPS coordinates from the raw upload buffer BEFORE
 * the ingest pipeline strips EXIF. Works with JPEG, PNG, WebP, and HEIC
 * natively — no pre-conversion needed (D-01).
 *
 * Mirrors the never-throws service convention from ingest.js.
 */

import exifr from 'exifr';

/**
 * Extract GPS coordinates from a raw image buffer.
 *
 * exifr.gps() returns { latitude, longitude } in decimal degrees with
 * N/S and E/W sign applied automatically — no manual hemisphere math needed.
 * Returns undefined when GPS tags are absent or EXIF is malformed.
 *
 * HEIC: exifr reads HEIC natively. Call extractGps() on the ORIGINAL buffer
 * BEFORE heic-convert runs in ingestPhoto(). GPS lives in the HEIC container's
 * EXIF block; it is NOT present in the JPEG that heic-convert produces.
 *
 * @param {Buffer} buffer - Raw upload buffer (before ingest)
 * @returns {Promise<{lat: number, lng: number} | null>}
 */
export async function extractGps(buffer) {
  try {
    const result = await exifr.gps(buffer);
    if (!result || result.latitude == null || result.longitude == null) {
      return null;
    }
    // exifr returns { latitude, longitude } — rename to lat/lng for clarity
    return { lat: result.latitude, lng: result.longitude };
  } catch {
    // Malformed EXIF, truncated buffer, or unsupported format — treat as no GPS
    return null;
  }
}

/**
 * Validate GPS coordinates are within physically valid ranges.
 *
 * Guards against attacker-injected out-of-range values in EXIF (T-03-GPS-INJ).
 * exifr returns numbers, not strings, but explicit range checks are still required.
 *
 * @param {number} lat - Latitude in decimal degrees
 * @param {number} lng - Longitude in decimal degrees
 * @returns {boolean}
 */
export function isValidGps(lat, lng) {
  return (
    typeof lat === 'number' && isFinite(lat) && lat >= -90 && lat <= 90 &&
    typeof lng === 'number' && isFinite(lng) && lng >= -180 && lng <= 180
  );
}
