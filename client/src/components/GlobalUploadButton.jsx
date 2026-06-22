/**
 * GlobalUploadButton — fixed top-right map-level upload control (D-02).
 *
 * Positioned above Leaflet tiles at z-[500] (same layer as AccountStrip).
 * Accepts a batch of files, calls useUploadGlobal (no countryCode — server
 * assigns country from GPS), shows GpsResultSummary, auto-clears after 4s.
 *
 * Security: filenames rendered via React (auto-escaped — T-03-XSS-FILENAME).
 * Existing multer limits (25 MB/file, 50/batch) + magic-byte validation apply
 * to the same route (T-03-DOS).
 */

import { useRef, useState } from 'react';
import { useUploadGlobal } from '../api/photos.js';
import GpsResultSummary from './GpsResultSummary.jsx';

export default function GlobalUploadButton() {
  const inputRef = useRef(null);
  const uploadMutation = useUploadGlobal();
  const [result, setResult] = useState(null);

  async function handleFiles(files) {
    if (!files?.length) return;
    setResult(null);
    try {
      const data = await uploadMutation.mutateAsync({ files });
      setResult(data);
      // Auto-clear success rows after 4 seconds (mirrors PhotoUploadForm.jsx line 67)
      setTimeout(() => setResult(null), 4000);
    } catch (err) {
      setResult({ error: err.message });
    }
    // Reset so the same file can be re-selected after an error
    if (inputRef.current) inputRef.current.value = '';
  }

  const isPending = uploadMutation.isPending;

  return (
    <div className="fixed top-2 right-2 z-[500]">
      {/* Hidden file input — accept same formats as per-country form */}
      <input
        ref={inputRef}
        id="global-upload-input"
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,.heic,.heif"
        className="sr-only"
        onChange={e => handleFiles(Array.from(e.target.files || []))}
        disabled={isPending}
        aria-label="Upload photos (global)"
      />

      {/* Accent label button — same token set as PhotoUploadForm CTA */}
      <label
        htmlFor="global-upload-input"
        className={[
          'flex items-center justify-center px-4 rounded-md shadow-sm',
          'min-h-11 text-label font-semibold text-white cursor-pointer',
          'transition-colors',
          isPending
            ? 'bg-accent opacity-60 cursor-not-allowed'
            : 'bg-accent hover:bg-accent-dark',
        ].join(' ')}
        aria-disabled={isPending}
      >
        {isPending ? 'Uploading...' : 'Upload Photos'}
      </label>

      {/* GPS placement result rows — auto-clears on success after 4s */}
      {result && <GpsResultSummary result={result} />}
    </div>
  );
}
