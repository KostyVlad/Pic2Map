/**
 * ingestPhoto — the core image processing pipeline.
 *
 * Pipeline:
 *  1. If HEIC/HEIF: pre-process with heic-convert (sharp prebuilt has no HEIC — Pitfall 2)
 *  2. Generate thumbnail (300px wide, JPEG, EXIF stripped)
 *  3. Generate display copy (1200px wide, JPEG, EXIF stripped)
 *
 * Critical: `withMetadata(false)` on BOTH outputs is mandatory — it strips all EXIF
 * including GPS from served files (D-06 / PHOTO-02 / T-01-EXIF).
 * NEVER call `.withMetadata(true)` here — GPS would survive into served files.
 *
 * `autoOrient()` MUST run before resize so rotated phone photos are correctly oriented
 * before dimensions are computed.
 *
 * @param {Buffer} inputBuffer - Raw file bytes from multer
 * @param {string} mimeType    - Detected MIME type (from magic-byte check)
 * @param {string} countryCode - Destination country ISO code (not used in processing; reserved)
 * @returns {Promise<{ thumbBuffer: Buffer, displayBuffer: Buffer }>}
 */

import heicConvert from 'heic-convert';
import { promisify } from 'node:util';
import sharp from 'sharp';

const heicConvertAsync = promisify(heicConvert);

export async function ingestPhoto(inputBuffer, mimeType, countryCode) {
  let workingBuffer = inputBuffer;

  // Step 1: Convert HEIC/HEIF to JPEG if needed
  // sharp prebuilt binaries have no HEIC support (patent licensing — Pitfall 2)
  if (mimeType === 'image/heic' || mimeType === 'image/heif') {
    workingBuffer = Buffer.from(
      await heicConvertAsync({
        buffer: workingBuffer,
        format: 'JPEG',
        quality: 0.92,
      })
    );
  }

  // Step 2: Generate thumbnail
  // - autoOrient() reads EXIF Orientation tag and applies physical rotation BEFORE resize
  // - withoutEnlargement: true prevents upscaling images smaller than 300px
  // - NO .withMetadata() call = sharp's default behavior strips all EXIF including GPS
  //   (D-06 / PHOTO-02 / T-01-EXIF). In sharp 0.34.x, calling .withMetadata(false)
  //   paradoxically RETAINS metadata — the correct strip is to omit the call entirely.
  //   NEVER add .withMetadata() or .withMetadata(true) here — GPS would survive.
  const thumbBuffer = await sharp(workingBuffer)
    .autoOrient()
    .resize(300, null, { withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();

  // Step 3: Generate display copy (1200px wide, higher quality)
  const displayBuffer = await sharp(workingBuffer)
    .autoOrient()
    .resize(1200, null, { withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer();

  return { thumbBuffer, displayBuffer };
}
