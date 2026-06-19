/**
 * migrate-fresh-start.js — One-time idempotent deletion of pre-auth (userId=null) photos.
 *
 * Purpose (D-01): Phase 1 photos have no userId (they were created before auth existed).
 *   This script deletes them from MongoDB and removes their stored files from disk.
 *   After running, userId is required on all new Photo documents.
 *
 * Idempotency: a second run finds 0 orphaned photos and exits cleanly — safe to re-run.
 *
 * Usage: node src/scripts/migrate-fresh-start.js
 *        (run from the server/ directory, or via npm run migrate:fresh-start)
 *
 * Requires: MONGODB_URI and JWT_SECRET in server/.env (loaded by config.js)
 */

import '../config.js'; // loads dotenv (MUST come first)
import { connectDb } from '../db.js';
import Photo from '../models/Photo.js';
import { storage } from '../services/storage/index.js';
import mongoose from 'mongoose';

console.log('=== migrate-fresh-start: Phase-1 cleanup ===');

await connectDb();

// Find all photos that were created before auth (userId is null or missing)
const orphans = await Photo.find({ userId: null }).select('storageKey thumbnailKey');
console.log(`Found ${orphans.length} pre-auth photo(s) to delete.`);

if (orphans.length === 0) {
  console.log('Nothing to do — migration is already complete (idempotent).');
  await mongoose.disconnect();
  process.exit(0);
}

// Delete each stored file — LocalDiskStorage.delete() swallows ENOENT (already safe)
let filesDeleted = 0;
for (const photo of orphans) {
  try {
    await storage.delete(photo.storageKey);
    filesDeleted++;
  } catch (e) {
    console.warn(`  WARN: could not delete storageKey ${photo.storageKey}: ${e.message}`);
  }
  try {
    await storage.delete(photo.thumbnailKey);
    filesDeleted++;
  } catch (e) {
    console.warn(`  WARN: could not delete thumbnailKey ${photo.thumbnailKey}: ${e.message}`);
  }
}
console.log(`Deleted ${filesDeleted} stored file(s).`);

// Bulk-delete all Photo documents with userId: null
const result = await Photo.deleteMany({ userId: null });
console.log(`Deleted ${result.deletedCount} Photo document(s) from MongoDB.`);

console.log('Migration complete. userId is now required on all Photo documents.');
await mongoose.disconnect();
process.exit(0);
