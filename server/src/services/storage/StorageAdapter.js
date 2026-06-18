/**
 * StorageAdapter — interface definition for photo binary storage.
 *
 * Phase 1 implementation: LocalDiskStorage
 * Phase 2+ implementation: S3Storage / R2Storage (SCALE-01)
 *
 * All implementations MUST satisfy this interface so route code is unchanged
 * when the storage backend is swapped.
 *
 * @typedef {Object} StorageAdapter
 *
 * @property {(key: string, buffer: Buffer, mime?: string) => Promise<void>} put
 *   Write `buffer` under `key`. Creates parent directories as needed.
 *   Key MUST be a server-generated UUID-derived name — never user-controlled input.
 *
 * @property {(key: string) => string} getLocalPath
 *   Return the absolute local filesystem path for `key`.
 *   Only meaningful for LocalDiskStorage; cloud adapters may throw or return ''.
 *
 * @property {(key: string) => Promise<string>} getUrl
 *   Return the URL at which this key can be fetched by the browser.
 *   LocalDiskStorage: `/api/photos/file/<encoded key>`
 *   Cloud adapters: CDN or presigned URL.
 *
 * @property {(key: string) => Promise<void>} delete
 *   Remove the stored object for `key`. No-op if not found (best-effort).
 */

// This file is intentionally kept as JSDoc only.
// Import LocalDiskStorage from './LocalDiskStorage.js' for the concrete implementation.
