/**
 * CloudinaryStorage — StorageAdapter implementation backed by Cloudinary.
 *
 * Why proxy instead of public CDN URLs:
 *   Phase 2 made every photo private (per-user IDOR protection). To preserve that,
 *   we upload with `type: 'authenticated'` so the asset is NOT publicly reachable,
 *   and we keep serving through `/api/photos/file/:key` (the route's ownership check
 *   still gates access). getReadable() fetches the asset from Cloudinary using a
 *   server-signed authenticated URL and streams the bytes back.
 *
 * Keys are the Cloudinary public_id (server-generated UUID — never user input, T-01-PT).
 * Credentials come from config (env only) — never hardcoded (this repo is public).
 *
 * Future optimization (not now): swap the proxy for a signed redirect so the CDN
 * serves bytes directly and the server only signs — one-line change in the route.
 */

import { Readable } from 'node:stream';
import { v2 as cloudinary } from 'cloudinary';
import config from '../../config.js';

export class CloudinaryStorage {
  constructor() {
    cloudinary.config({
      cloud_name: config.CLOUDINARY_CLOUD_NAME,
      api_key: config.CLOUDINARY_API_KEY,
      api_secret: config.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }

  /**
   * Cloudinary treats a dot in public_id literally AND still appends the format,
   * producing a `…-display.jpg.jpg` asset that our delivery URL can't match.
   * So we strip the extension for the public_id and carry the format separately.
   * @param {string} key  e.g. "<uuid>-display.jpg"
   * @returns {{ publicId: string, format: string }}
   */
  #parseKey(key) {
    const m = key.match(/\.(jpe?g|png|webp)$/i);
    const format = m ? m[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg';
    const publicId = m ? key.slice(0, -m[0].length) : key;
    return { publicId, format };
  }

  /**
   * Upload `buffer` under `key` (used as the Cloudinary public_id).
   * Stored as `type: authenticated` so the asset is not publicly reachable.
   * @param {string} key
   * @param {Buffer} buffer
   * @param {string} [mime]
   */
  async put(key, buffer, mime) {
    const { publicId } = this.#parseKey(key);
    await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,       // extension stripped — Cloudinary appends format itself
          type: 'authenticated',     // not publicly accessible — requires a signed URL
          resource_type: 'image',
          overwrite: false,
          unique_filename: false,
          use_filename: false,
        },
        (error, result) => (error ? reject(error) : resolve(result))
      );
      Readable.from(buffer).pipe(stream);
    });
  }

  /**
   * Cloudinary has no local filesystem path. Kept for interface symmetry.
   * @returns {string}
   */
  getLocalPath() {
    return '';
  }

  /**
   * Browser-facing URL. We keep proxying through our own route so the Phase 2
   * ownership check still gates access — identical to LocalDiskStorage.
   * @param {string} key
   * @returns {Promise<string>}
   */
  async getUrl(key) {
    return `/api/photos/file/${encodeURIComponent(key)}`;
  }

  /**
   * Fetch the asset from Cloudinary via a server-signed authenticated URL and
   * return a Node Readable. Returns null if the asset is missing.
   * @param {string} key
   * @returns {Promise<{ stream: import('node:stream').Readable, contentType: string } | null>}
   */
  async getReadable(key) {
    const { publicId, format } = this.#parseKey(key);
    // sign_url + type:authenticated yields a signed delivery URL that cannot be guessed.
    // format must be passed explicitly since the public_id has no extension.
    const signedUrl = cloudinary.url(publicId, {
      type: 'authenticated',
      resource_type: 'image',
      format,
      sign_url: true,
      secure: true,
    });

    const res = await fetch(signedUrl);
    if (!res.ok || !res.body) {
      return null;
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    return { stream: Readable.fromWeb(res.body), contentType };
  }

  /**
   * Delete the asset. Best-effort — no throw if already gone.
   * @param {string} key
   */
  async delete(key) {
    try {
      const { publicId } = this.#parseKey(key);
      await cloudinary.uploader.destroy(publicId, { type: 'authenticated', resource_type: 'image' });
    } catch {
      // Best-effort cleanup — ignore failures
    }
  }
}
