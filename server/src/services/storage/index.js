import config from '../../config.js';
import { LocalDiskStorage } from './LocalDiskStorage.js';
import { CloudinaryStorage } from './CloudinaryStorage.js';

/**
 * Singleton storage adapter for the application.
 * Selected by STORAGE_BACKEND (env): 'local' (disk, default) or 'cloudinary'.
 * Route code is unchanged across backends — all adapters share the StorageAdapter interface.
 *
 * @type {import('./StorageAdapter.js').StorageAdapter}
 */
export const storage = config.STORAGE_BACKEND === 'cloudinary'
  ? new CloudinaryStorage()
  : new LocalDiskStorage(config.STORAGE_PATH);
