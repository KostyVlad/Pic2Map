/**
 * PhotoUploadForm — hidden file input wrapped in a styled label/button.
 *
 * UI-SPEC Upload Zone:
 *  - Hidden <input type="file" multiple accept="..."> wrapped in a <label>
 *  - "Add Photos" CTA button (accent bg, accent-dark hover, 44px min height)
 *  - Accepted format hint below button
 *  - Uploading state: button disabled + "Uploading..." text
 *
 * Phase 1 scope: happy-path single/basic upload must work.
 * Phase 2 deferred: drag-active zone highlight, multi-error toasts, full error copy.
 *
 * @param {object} props
 * @param {string} props.countryCode - ISO code of selected country
 * @param {string} props.countryName - Display name of selected country
 */

import { useRef, useState } from 'react';
import { useUploadPhotos } from '../api/photos.js';

export default function PhotoUploadForm({ countryCode, countryName }) {
  const inputRef = useRef(null);
  const [statusMessage, setStatusMessage] = useState(null);
  const uploadMutation = useUploadPhotos();

  async function handleFileChange(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setStatusMessage(null);

    try {
      const result = await uploadMutation.mutateAsync({ files, countryCode, countryName });
      const n = result.uploaded;
      setStatusMessage({
        type: 'success',
        text: `${n} photo${n !== 1 ? 's' : ''} added to ${countryName}`,
      });

      // Check for per-file errors in results
      const errors = result.results.filter(r => r.error);
      if (errors.length > 0) {
        setStatusMessage({
          type: 'error',
          text: errors.map(e => `${e.file}: ${e.error}`).join('; '),
        });
      }
    } catch (err) {
      let message = 'Upload failed. Check your connection and try again.';
      if (err.message?.includes('not accepted') || err.message?.includes('JPEG')) {
        message = 'File not accepted. Use JPEG, PNG, WebP, or HEIC.';
      } else if (err.message?.includes('25 MB')) {
        message = 'File exceeds 25 MB limit. Please reduce the file size.';
      }
      setStatusMessage({ type: 'error', text: message });
    }

    // Reset input so the same file can be re-selected after an error
    if (inputRef.current) inputRef.current.value = '';

    // Auto-clear success message after 4 seconds
    if (statusMessage?.type !== 'error') {
      setTimeout(() => setStatusMessage(null), 4000);
    }
  }

  const isUploading = uploadMutation.isPending;

  return (
    <div className="p-4 border-b border-border">
      <div className="border-2 border-dashed border-border rounded p-6 bg-surface">
        {/* Hidden file input */}
        <input
          ref={inputRef}
          id={`upload-${countryCode}`}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,.heic,.heif"
          className="sr-only"
          onChange={handleFileChange}
          disabled={isUploading}
          aria-label={`Upload photos for ${countryName}`}
        />

        {/* Upload CTA button */}
        <label
          htmlFor={`upload-${countryCode}`}
          className={[
            'flex items-center justify-center w-full',
            'min-h-11 px-4 rounded',
            'text-label font-semibold text-white cursor-pointer',
            'transition-colors',
            isUploading
              ? 'bg-accent opacity-60 cursor-not-allowed'
              : 'bg-accent hover:bg-accent-dark',
          ].join(' ')}
          aria-disabled={isUploading}
        >
          {isUploading ? 'Uploading...' : 'Add Photos'}
        </label>

        {/* Accepted format hint */}
        <p className="mt-2 text-center text-label text-text-muted">
          JPEG, PNG, WebP, HEIC — up to 25 MB each
        </p>
      </div>

      {/* Status message */}
      {statusMessage && (
        <p
          className={[
            'mt-2 text-label',
            statusMessage.type === 'error' ? 'text-destructive' : 'text-text-muted',
          ].join(' ')}
          role={statusMessage.type === 'error' ? 'alert' : 'status'}
        >
          {statusMessage.text}
        </p>
      )}
    </div>
  );
}
