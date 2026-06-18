import mongoose from 'mongoose';

/**
 * Photo — Mongoose schema for a single uploaded photo.
 *
 * Design: forward-compatible for Phases 2 and 3.
 * - countryCode (Phase 1): stable ISO 3166-1 alpha-2 key, keyed by extractIso()
 * - userId (Phase 2): nullable ObjectId reference — Phase 1 leaves null; Phase 2 migration sets it
 * - location / geocodeStatus (Phase 3): GPS point + status — reserved null until EXIF auto-placement
 *
 * Storage rule: binaries NEVER in this document. Only storageKey and thumbnailKey paths.
 * Enforced by ingest pipeline and asserted by e2e test (PHOTO-05 / T-01-BIN).
 */
const photoSchema = new mongoose.Schema(
  {
    // Phase 1 — country key (stable ISO identifier, not the display name)
    countryCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true, // fast per-country photo queries
    },

    // Phase 2 — added via migration when auth is built; null in Phase 1
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },

    // Phase 3 — GPS location; null until EXIF auto-placement; no 2dsphere index yet
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: undefined }, // [lng, lat] per GeoJSON spec
    },
    geocodeStatus: {
      type: String,
      enum: ['none', 'pending', 'done', 'failed'],
      default: 'none',
    },

    // Storage keys — binaries live on disk, never in MongoDB (PHOTO-05 / T-01-BIN)
    storageKey: { type: String, required: true },   // EXIF-stripped display copy
    thumbnailKey: { type: String, required: true }, // 300px thumbnail

    mimeType: { type: String, required: true },
    originalFilename: { type: String, default: '' },
    fileSize: { type: Number, required: true },
    countryName: { type: String, default: '' }, // display name from GeoJSON properties.NAME
  },
  { timestamps: true }
);

// Phase 1 compound index: per-country photo list sorted by most-recent
photoSchema.index({ countryCode: 1, createdAt: -1 });

// Phase 2 will add: { userId: 1, countryCode: 1 } compound index via migration
// Phase 3 will add: { location: '2dsphere' } index via migration

export default mongoose.model('Photo', photoSchema);
