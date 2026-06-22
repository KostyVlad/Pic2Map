/**
 * CountrySidebar — fixed right panel showing country name, upload zone,
 * a clustered pin map, and the photo gallery.
 *
 * UI-SPEC Layout:
 *  - Desktop: position fixed; top 0; right 0; height 100dvh; width 360px; z-index 500
 *  - Mobile: bottom panel; height 55dvh; overflow-y: auto
 *  - Panel absent (not rendered) when no country is selected
 *
 * Phase 3 additions (GEO-03, GEO-04, GEO-05):
 *  - CountryPinMap rendered above the gallery scroll region
 *  - pinLightboxIndex wires pin popup → a YARL lightbox (separate from the gallery lightbox)
 *  - countryBbox prop is [[south, west], [north, east]] derived by WorldMap
 *
 * Lightbox strategy: PhotoGallery owns its own lightbox (gallery thumb clicks + delete).
 * CountrySidebar owns a second YARL lightbox for pin popup clicks (view-only, no delete).
 * Both use the same slides array derived from photos.
 *
 * @param {object} props
 * @param {string} props.countryCode - ISO code of selected country
 * @param {string} props.countryName - Display name from GeoJSON
 * @param {function(): void} props.onClose - Deselect the country
 * @param {Array} [props.countryBbox] - [[south, west], [north, east]] for CountryPinMap fitBounds
 */

import { useState } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import { usePhotos } from '../api/photos.js';
import PhotoUploadForm from './PhotoUploadForm.jsx';
import PhotoGallery from './PhotoGallery.jsx';
import CountryPinMap from './CountryPinMap.jsx';

export default function CountrySidebar({ countryCode, countryName, onClose, countryBbox }) {
  const { data: photos = [], isLoading } = usePhotos(countryCode);

  // Pin-popup lightbox state — separate from PhotoGallery's own lightbox state so we
  // don't need to change PhotoGallery. This lightbox is view-only (no delete toolbar).
  const [pinLightboxIndex, setPinLightboxIndex] = useState(-1);

  // Called by PinPopup when the thumbnail is clicked — find photo index by id
  function handleOpenLightboxByPhotoId(photoId) {
    const idx = photos.findIndex(p => p._id === photoId);
    if (idx !== -1) setPinLightboxIndex(idx);
  }

  // Slides for the pin-popup lightbox (same source as PhotoGallery slides)
  const slides = photos.map(p => ({
    src: `/api/photos/file/${encodeURIComponent(p.storageKey)}`,
    alt: p.originalFilename || 'Photo',
  }));

  return (
    /*
     * Desktop: fixed right panel 360px wide, full-height, z-500
     * Mobile (< md = 768px): bottom half of screen, 55dvh
     */
    <div
      className={[
        // Shared
        'bg-surface border-border shadow-[0_0_24px_rgba(0,0,0,0.12)]',
        'flex flex-col overflow-hidden',
        'z-[500]',
        // Desktop (md+): right panel
        'md:fixed md:top-0 md:right-0 md:h-dvh md:w-[360px] md:border-l',
        // Mobile: bottom panel
        'fixed bottom-0 left-0 right-0 h-[55dvh] border-t md:h-auto md:left-auto md:bottom-auto',
      ].join(' ')}
      role="complementary"
      aria-label={`${countryName} photos`}
    >
      {/* Panel header */}
      <div className="flex items-center justify-between p-6 border-b border-border flex-shrink-0">
        <h2 className="text-heading font-semibold text-text truncate mr-4">
          {countryName}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="flex-shrink-0 min-w-11 min-h-11 flex items-center justify-center text-label text-text-muted hover:text-text transition-colors focus:outline-none focus:ring-2 focus:ring-accent rounded"
          aria-label="Close country panel"
        >
          Close
        </button>
      </div>

      {/* Upload zone */}
      <PhotoUploadForm countryCode={countryCode} countryName={countryName} />

      {/* Pin map — rendered above gallery; empty map (no pins) when no GPS photos (GEO-05) */}
      {countryBbox && (
        <div className="flex-shrink-0">
          <CountryPinMap
            photos={photos}
            countryBbox={countryBbox}
            countryName={countryName}
            onOpenLightbox={handleOpenLightboxByPhotoId}
          />
        </div>
      )}

      {/* Gallery scroll region — PhotoGallery owns its own lightbox for thumb clicks */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <p className="p-4 text-label text-text-muted text-center">Loading photos…</p>
        ) : (
          <PhotoGallery photos={photos} countryCode={countryCode} />
        )}
      </div>

      {/* Pin-popup lightbox — opens when user clicks a thumbnail inside PinPopup.
          View-only (no delete toolbar) — separate from PhotoGallery's lightbox. */}
      <Lightbox
        open={pinLightboxIndex >= 0}
        index={pinLightboxIndex}
        close={() => setPinLightboxIndex(-1)}
        slides={slides}
        on={{ view: ({ index }) => setPinLightboxIndex(index) }}
      />
    </div>
  );
}
