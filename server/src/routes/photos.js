/**
 * /api/photos router
 *
 * POST /api/photos       — upload one or more photos to a country
 * GET  /api/photos       — list photos for a country (?countryCode=XX)
 * GET  /api/photos/file/:key — stream a stored file (display or thumbnail)
 */

import { Router } from 'express';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { upload, validateMagicBytes } from '../middleware/upload.js';
import { ingestPhoto } from '../services/ingest.js';
import { storage } from '../services/storage/index.js';
import Photo from '../models/Photo.js';
import config from '../config.js';

const router = Router();

// ---------------------------------------------------------------------------
// POST /api/photos
// ---------------------------------------------------------------------------
router.post('/', upload.array('photos', config.MAX_FILES_PER_BATCH), async (req, res, next) => {
  try {
    const { countryCode, countryName } = req.body;
    if (!countryCode) {
      // Clean up any files that landed before the error
      if (req.files) {
        await Promise.all(req.files.map(f => fs.unlink(f.path).catch(() => {})));
      }
      return res.status(400).json({ error: 'countryCode required' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'At least one file is required' });
    }

    const results = [];
    const normalizedCode = countryCode.toUpperCase().trim();

    for (const file of req.files) {
      let rawBuffer;
      try {
        rawBuffer = await fs.readFile(file.path);
      } catch (readErr) {
        results.push({ file: file.originalname, error: 'Failed to read uploaded file' });
        continue;
      }

      // Magic-byte validation (T-01-MAL) — check AFTER multer writes, per-file
      let detectedMime;
      try {
        detectedMime = await validateMagicBytes(rawBuffer);
      } catch (magicErr) {
        // Unlink the tmp file — don't leave invalid files around
        await fs.unlink(file.path).catch(() => {});
        results.push({ file: file.originalname, error: magicErr.message });
        continue;
      }

      // Run the ingest pipeline (HEIC conversion + resize + EXIF strip)
      let thumbBuffer, displayBuffer;
      try {
        ({ thumbBuffer, displayBuffer } = await ingestPhoto(rawBuffer, detectedMime, normalizedCode));
      } catch (ingestErr) {
        await fs.unlink(file.path).catch(() => {});
        results.push({ file: file.originalname, error: `Image processing failed: ${ingestErr.message}` });
        continue;
      }

      // Write processed files to storage (UUID keys — T-01-PT)
      const photoId = randomUUID();
      const storageKey = `${photoId}-display.jpg`;
      const thumbnailKey = `${photoId}-thumb.jpg`;

      try {
        await storage.put(storageKey, displayBuffer, 'image/jpeg');
        await storage.put(thumbnailKey, thumbBuffer, 'image/jpeg');
      } catch (storageErr) {
        await fs.unlink(file.path).catch(() => {});
        results.push({ file: file.originalname, error: 'Storage write failed' });
        continue;
      }

      // Clean up tmp file
      await fs.unlink(file.path).catch(() => {});

      // Persist metadata in MongoDB — never binary data (PHOTO-05 / T-01-BIN)
      // userId from requireAuth middleware scopes the photo to the authenticated user (D-03)
      const photo = await Photo.create({
        countryCode: normalizedCode,
        countryName: countryName || '',
        storageKey,
        thumbnailKey,
        mimeType: 'image/jpeg',      // always JPEG after ingest pipeline
        originalFilename: file.originalname,
        fileSize: rawBuffer.length,
        userId: req.userId,
      });

      const thumbnailUrl = await storage.getUrl(thumbnailKey);
      results.push({ photoId: photo._id, thumbnailUrl });
    }

    const uploaded = results.filter(r => !r.error).length;
    res.status(201).json({ uploaded, results });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/photos?countryCode=XX
// ---------------------------------------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    const { countryCode } = req.query;
    if (!countryCode) {
      return res.status(400).json({ error: 'countryCode query parameter required' });
    }

    // Scope to authenticated user (AUTH-04 / D-03) — only the owner's photos are returned
    const photos = await Photo.find({ countryCode: countryCode.toUpperCase(), userId: req.userId })
      .sort({ createdAt: -1 })
      .select('_id storageKey thumbnailKey originalFilename countryCode countryName createdAt');

    res.json(photos);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/photos/file/:key
// Stream a stored file (display copy or thumbnail) — storage-backend agnostic.
// The adapter (local disk or Cloudinary) provides the stream via getReadable();
// the path-traversal guard lives inside LocalDiskStorage (T-01-PT).
// ---------------------------------------------------------------------------
router.get('/file/:key', async (req, res, next) => {
  try {
    const key = decodeURIComponent(req.params.key);

    // Ownership check (IDOR close — T-02-IDOR-FILE, Pitfall 1)
    // Match either display or thumbnail key; return 404 not 403 — no existence leak
    const owned = await Photo.findOne({
      $or: [{ storageKey: key }, { thumbnailKey: key }],
      userId: req.userId,
    });
    if (!owned) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Delegate to the active storage adapter. Returns null for missing/invalid keys.
    const opened = await storage.getReadable(key);
    if (!opened) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.setHeader('Content-Type', opened.contentType);
    // PRIVATE: per-user, auth-gated content. Must never be cached by shared/proxy
    // caches and served to another account. Keys are unique per photo, so a given
    // browser only ever requests its own owner's keys.
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable'); // 1 year — content-addressed keys

    // Stream the file — served files are already EXIF-stripped by ingest (PHOTO-02 / T-01-EXIF)
    opened.stream.on('error', () => {
      if (!res.headersSent) {
        res.status(500).json({ error: 'File read error' });
      }
    });
    opened.stream.pipe(res);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/photos/bulk-delete  { ids: string[] }
// Delete multiple owned photos in one request. Each id is scoped by userId, so
// non-owned / unknown / malformed ids are simply skipped (no existence leak).
// Returns { deleted: <count actually removed> }.
// ---------------------------------------------------------------------------
router.post('/bulk-delete', async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids must be a non-empty array' });
    }

    // Drop malformed ObjectIds up front so the query can't throw a CastError
    const validIds = ids.filter((id) => mongoose.isValidObjectId(id));

    // Only the caller's own photos — IDOR-safe
    const photos = await Photo.find({ _id: { $in: validIds }, userId: req.userId });

    // Best-effort storage cleanup for every owned photo (display + thumbnail)
    await Promise.all(
      photos.flatMap((p) => [storage.delete(p.storageKey), storage.delete(p.thumbnailKey)])
    );

    await Photo.deleteMany({ _id: { $in: photos.map((p) => p._id) }, userId: req.userId });

    return res.status(200).json({ deleted: photos.length });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/photos/:id
// Delete a photo the caller owns: remove both stored files + the metadata doc.
// Ownership-scoped by userId; non-owner / unknown id → 404 (no existence leak).
// ---------------------------------------------------------------------------
router.delete('/:id', async (req, res, next) => {
  try {
    // Scope by userId so one user can never delete another's photo (IDOR)
    const photo = await Photo.findOne({ _id: req.params.id, userId: req.userId });
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    // Best-effort storage cleanup (display + thumbnail). Adapter.delete is a no-op
    // if the object is already gone, so a missing file won't block the DB delete.
    await storage.delete(photo.storageKey);
    await storage.delete(photo.thumbnailKey);

    await photo.deleteOne();

    return res.status(200).json({ ok: true });
  } catch (err) {
    // Malformed ObjectId → CastError; treat as not-found (no existence leak)
    if (err.name === 'CastError') {
      return res.status(404).json({ error: 'Photo not found' });
    }
    next(err);
  }
});

export default router;
