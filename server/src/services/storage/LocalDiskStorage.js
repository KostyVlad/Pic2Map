/**
 * LocalDiskStorage — StorageAdapter implementation that writes to the local filesystem.
 *
 * Keys MUST be server-generated UUID-derived names (e.g. `<uuid>-display.jpg`).
 * User-supplied file names are never used as keys (T-01-PT path-traversal mitigation).
 */

import fs from 'node:fs/promises';
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
