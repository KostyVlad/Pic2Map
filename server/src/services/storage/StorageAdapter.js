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
 *   Only meaningful for LocalDiskStorage; cloud adapters return ''.
 *
 * @property {(key: string) => Promise<string>} getUrl
 *   Return the URL at which this key can be fetched by the browser.
 *   Both LocalDiskStorage and CloudinaryStorage proxy through `/api/photos/file/<encoded key>`
 *   so the per-user ownership check (AUTH-04) gates every access.
 *
 * @property {(key: string) => Promise<{ stream: import('node:stream').Readable, contentType: string } | null>} getReadable
 *   Open a readable stream for `key` for the file-serving route, or null if missing/invalid.
 *   LocalDiskStorage enforces the path-traversal guard; CloudinaryStorage fetches via a
 *   server-signed authenticated URL. The route stays storage-agnostic by delegating here.
 *
 * @property {(key: string) => Promise<void>} delete
 *   Remove the stored object for `key`. No-op if not found (best-effort).
 */

// This file is intentionally kept as JSDoc only.
// Import LocalDiskStorage from './LocalDiskStorage.js' for the concrete implementation.
