/**
 * LocalDiskStorage — StorageAdapter implementation that writes to the local filesystem.
 *
 * Keys MUST be server-generated UUID-derived names (e.g. `<uuid>-display.jpg`).
 * User-supplied file names are never used as keys (T-01-PT path-traversal mitigation).
 */

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';

export class LocalDiskStorage {
  /**
   * @param {string} basePath - Root directory for stored files (e.g. './uploads')
   */
  constructor(basePath) {
    this.basePath = basePath;
  }

  /**
   * Write `buffer` under `key` beneath basePath, creating parent dirs as needed.
   * @param {string} key
   * @param {Buffer} buffer
   * @param {string} [mime] - optional MIME type (ignored for disk; reserved for cloud adapters)
   */
  async put(key, buffer, mime) {
    const fullPath = path.join(this.basePath, key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);
  }

  /**
   * Return the absolute local filesystem path for `key`.
   * @param {string} key
   * @returns {string}
   */
  getLocalPath(key) {
    return path.join(this.basePath, key);
  }

  /**
   * Open a readable stream for `key`, enforcing the path-traversal guard (T-01-PT).
   * Returns null if the key escapes basePath or the file does not exist.
   * The route remains storage-agnostic by delegating serving to this method.
   * @param {string} key
   * @returns {Promise<{ stream: import('node:stream').Readable, contentType: string } | null>}
   */
  async getReadable(key) {
    const resolvedPath = path.resolve(this.getLocalPath(key));
    const resolvedBase = path.resolve(this.basePath);

    // Resolved path MUST stay inside basePath (T-01-PT)
    if (!resolvedPath.startsWith(resolvedBase + path.sep) && resolvedPath !== resolvedBase) {
      return null;
    }

    try {
      await fs.access(resolvedPath);
    } catch {
      return null;
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    const contentType = ext === '.png' ? 'image/png'
      : ext === '.webp' ? 'image/webp'
      : 'image/jpeg'; // default for .jpg and converted HEIC

    return { stream: fsSync.createReadStream(resolvedPath), contentType };
  }

  /**
   * Return the URL at which this key can be fetched by the browser.
   * @param {string} key
   * @returns {Promise<string>}
   */
  async getUrl(key) {
    return `/api/photos/file/${encodeURIComponent(key)}`;
  }

  /**
   * Remove the stored file for `key`. No-op if not found.
   * @param {string} key
   */
  async delete(key) {
    try {
      await fs.unlink(path.join(this.basePath, key));
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      // File already gone — acceptable
    }
  }
}
