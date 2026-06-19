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
 * Phase 2: drag-active zone highlight, multi-error reporting, full error copy.
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
  const [isDragging, setIsDragging] = useState(false);
  const uploadMutation = useUploadPhotos();

  // Shared upload path for both the file picker and drag-and-drop.
  async function uploadFiles(files) {
    if (!files || files.length === 0) return;

    setStatusMessage(null);

    let succeeded = true;
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
        succeeded = false;
        setStatusMessage({
          type: 'error',
          text: errors.map(e => `${e.file}: ${e.error}`).join('; '),
        });
      }
    } catch (err) {
      succeeded = false;
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

    // Auto-clear success message after 4 seconds (keep errors visible)
    if (succeeded) {
      setTimeout(() => setStatusMessage(null), 4000);
    }
  }

  function handleFileChange(e) {
    uploadFiles(Array.from(e.target.files || []));
  }

  // Drag-and-drop (UI-SPEC drag-active state)
  function handleDragOver(e) {
    e.preventDefault();
    if (!isUploading) setIsDragging(true);
  }
  function handleDragLeave(e) {
    e.preventDefault();
    setIsDragging(false);
  }
  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    if (isUploading) return;
    const files = Array.from(e.dataTransfer?.files || []).filter(f => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
    uploadFiles(files);
  }

  const isUploading = uploadMutation.isPending;

  return (
    <div className="p-4 border-b border-border">
      <div
        className={[
          'border-2 border-dashed rounded p-6 transition-colors',
          isDragging ? 'border-accent bg-accent-subtle' : 'border-border bg-surface',
        ].join(' ')}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
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
          {isUploading ? 'Uploading...' : isDragging ? 'Drop to Add' : 'Add Photos'}
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
