/**
 * GlobalUploadButton — fixed top-right map-level upload control (D-02).
 *
 * Accepts a batch of files, calls useUploadGlobal (no countryCode — server
 * assigns country from GPS), shows GpsResultSummary for the auto-placed photos.
 *
 * Photos WITHOUT usable GPS are NOT auto-placed by the server. Instead of losing
 * them, we keep the in-browser File objects and prompt the user to pick a country;
 * on confirm we upload exactly those files to the chosen country via the existing
 * per-country endpoint (no re-selecting from disk). Nothing is dropped.
 *
 * Security: filenames rendered via React (auto-escaped — T-03-XSS-FILENAME).
 * Existing multer limits (25 MB/file, 50/batch) + magic-byte validation apply.
 */

import { useRef, useState } from 'react';
import { useUploadGlobal, useUploadPhotos } from '../api/photos.js';
import { extractIso } from '../utils/isoCode.js';
import GpsResultSummary from './GpsResultSummary.jsx';

// Module-level cache so we fetch + parse the 2 MB GeoJSON country list only once.
let _countryOptionsCache = null;
async function loadCountryOptions() {
  if (_countryOptionsCache) return _countryOptionsCache;
  const res = await fetch('/countries.geojson');
  const gj = await res.json();
  const seen = new Set();
  const opts = [];
  for (const f of gj.features) {
    const code = extractIso(f);
    if (seen.has(code)) continue;
    seen.add(code);
    opts.push({ code, name: f.properties.NAME || code });
  }
  opts.sort((a, b) => a.name.localeCompare(b.name));
  _countryOptionsCache = opts;
  return opts;
}

export default function GlobalUploadButton() {
  const inputRef = useRef(null);
  const uploadGlobal = useUploadGlobal();
  const placeManual = useUploadPhotos();

  const [result, setResult] = useState(null);   // auto-placed summary (or error)
  const [pending, setPending] = useState(null);  // { files: File[], options: [{code,name}] }
  const [selectedCode, setSelectedCode] = useState('');
  const [placedMsg, setPlacedMsg] = useState('');

  async function handleFiles(files) {
    if (!files?.length) return;
    setResult(null);
    setPending(null);
    setPlacedMsg('');
    try {
      const data = await uploadGlobal.mutateAsync({ files });
      setResult(data);

      // Photos the server couldn't place by GPS — match back to the in-browser Files.
      const noGpsNames = (data.results ?? []).filter(r => r.noGps).map(r => r.file);
      const noGpsFiles = noGpsNames.length
        ? files.filter(f => noGpsNames.includes(f.name))
        : [];

      if (noGpsFiles.length) {
        const options = await loadCountryOptions();
        setPending({ files: noGpsFiles, options }); // keep visible until user acts
      } else {
        setTimeout(() => setResult(null), 4000);
      }
    } catch (err) {
      setResult({ error: err.message });
    }
    if (inputRef.current) inputRef.current.value = '';
  }

  async function handlePlacePending() {
    if (!pending || !selectedCode || placeManual.isPending) return;
    const opt = pending.options.find(o => o.code === selectedCode);
    try {
      await placeManual.mutateAsync({
        files: pending.files,
        countryCode: selectedCode,
        countryName: opt?.name || '',
      });
      const n = pending.files.length;
      setPlacedMsg(`${n} photo${n !== 1 ? 's' : ''} added to ${opt?.name || selectedCode}`);
      setPending(null);
      setSelectedCode('');
      setTimeout(() => { setResult(null); setPlacedMsg(''); }, 4000);
    } catch (err) {
      setResult({ error: err.message });
    }
  }

  const isPending = uploadGlobal.isPending;

  return (
    <div className="fixed top-2 right-2 z-[500] w-72 flex flex-col items-end">
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

      <label
        htmlFor="global-upload-input"
        className={[
          'flex items-center justify-center px-4 rounded-md shadow-sm',
          'min-h-11 text-label font-semibold text-white cursor-pointer',
          'transition-colors',
          isPending ? 'bg-accent opacity-60 cursor-not-allowed' : 'bg-accent hover:bg-accent-dark',
        ].join(' ')}
        aria-disabled={isPending}
      >
        {isPending ? 'Uploading...' : 'Upload Photos'}
      </label>

      {/* Auto-placed (GPS) result rows — only when there's something to show */}
      {result && (result.error || (result.placed?.length > 0)) && (
        <div className="mt-2 w-full bg-surface border border-border rounded-md shadow-sm p-3">
          <GpsResultSummary result={result} />
        </div>
      )}

      {/* No-GPS photos — pick a country and add them (files already in browser) */}
      {pending && (
        <div className="mt-2 w-full bg-surface border border-border rounded-md shadow-sm p-3">
          <p className="text-label text-text mb-2">
            {pending.files.length} photo{pending.files.length !== 1 ? 's' : ''} have no location — choose a country:
          </p>
          <select
            value={selectedCode}
            onChange={e => setSelectedCode(e.target.value)}
            disabled={placeManual.isPending}
            className="w-full min-h-11 px-2 mb-2 bg-surface text-body text-text border border-border rounded-md outline-none focus:ring-2 focus:ring-accent"
            aria-label="Country for photos without GPS"
          >
            <option value="">Select a country…</option>
            {pending.options.map(o => (
              <option key={o.code} value={o.code}>{o.name}</option>
            ))}
          </select>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => { setPending(null); setSelectedCode(''); }}
              disabled={placeManual.isPending}
              className="min-h-11 px-3 rounded-md text-label font-semibold text-text-muted hover:text-text transition-colors focus:outline-none focus:ring-2 focus:ring-accent"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePlacePending}
              disabled={!selectedCode || placeManual.isPending}
              className={[
                'min-h-11 px-3 rounded-md text-label font-semibold text-white transition-colors',
                (!selectedCode || placeManual.isPending) ? 'bg-accent opacity-50 cursor-not-allowed' : 'bg-accent hover:bg-accent-dark',
              ].join(' ')}
            >
              {placeManual.isPending ? 'Adding…' : `Add ${pending.files.length}`}
            </button>
          </div>
        </div>
      )}

      {placedMsg && (
        <div className="mt-2 w-full bg-surface border border-border rounded-md shadow-sm p-3">
          <p className="text-label text-text" role="status">{placedMsg}</p>
        </div>
      )}
    </div>
  );
}
