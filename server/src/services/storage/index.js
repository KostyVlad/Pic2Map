import config from '../../config.js';
import { LocalDiskStorage } from './LocalDiskStorage.js';

/**
 * Singleton storage adapter for the application.
 * Phase 1: LocalDiskStorage (files on disk under STORAGE_PATH).
 * Phase 2+: Swap to S3Storage / R2Storage without changing route code (SCALE-01).
 *
 * @type {import('./StorageAdapter.js').StorageAdapter}
 */
export const storage = new LocalDiskStorage(config.STORAGE_PATH);
