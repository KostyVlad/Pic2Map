/**
 * upload.js — multer v2 configuration and magic-byte validation.
 *
 * Security mitigations:
 *  T-01-DOS: multer limits.fileSize + limits.files (config-driven)
 *  T-01-PT:  UUID filename (never original name); user-supplied names cannot escape STORAGE_PATH
 *  T-01-MAL: validateMagicBytes() allowlist — only real image mime types pass
 */

import multer from 'multer';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import config from '../config.js';

// ---------------------------------------------------------------------------
// Multer disk storage — writes to tmp/ under STORAGE_PATH
// UUID filenames prevent path traversal from original names (T-01-PT)
// ---------------------------------------------------------------------------
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, path.join(config.STORAGE_PATH, 'tmp'));
  },
  filename(req, file, cb) {
    // Always use a UUID — never trust the original filename
    const id = randomUUID();
    const ext = path.extname(file.originalname).toLowerCase() || '.bin';
    cb(null, `${id}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: {
    fileSize: config.MAX_FILE_BYTES,          // 25 MB per file (T-01-DOS)
    files: config.MAX_FILES_PER_BATCH,         // 50 files per batch (T-01-DOS)
  },
});

// ---------------------------------------------------------------------------
// Magic-byte validation (T-01-MAL)
// file-type v22 is ESM-only — use dynamic import() (server is ESM so this works directly)
// Allowlist: real image formats only; SVG/executables are excluded
// ---------------------------------------------------------------------------
const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

/**
 * Validate that `buffer` starts with the magic bytes of an allowed image format.
 *
 * @param {Buffer} buffer - First bytes of the uploaded file (or full buffer)
 * @returns {Promise<string>} The detected MIME type if valid
 * @throws {Error} If type is unrecognised or not in the allowlist
 */
export async function validateMagicBytes(buffer) {
  const { fileTypeFromBuffer } = await import('file-type');
  const result = await fileTypeFromBuffer(buffer);

  if (!result || !ALLOWED_MIMES.has(result.mime)) {
    const detected = result?.mime ?? 'unknown';
    throw new Error(
      `File not accepted. Use JPEG, PNG, WebP, or HEIC. (detected: ${detected})`
    );
  }

  return result.mime;
}
