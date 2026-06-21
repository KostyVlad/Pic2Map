/**
 * CountrySidebar — fixed right panel showing country name, upload zone, and photo gallery.
 *
 * UI-SPEC Layout:
 *  - Desktop: position fixed; top 0; right 0; height 100dvh; width 360px; z-index 500
 *  - Mobile: bottom panel; height 55dvh; overflow-y: auto
 *  - Panel absent (not rendered) when no country is selected
 *
 * @param {object} props
 * @param {string} props.countryCode - ISO code of selected country
 * @param {string} props.countryName - Display name from GeoJSON
 * @param {function(): void} props.onClose - Deselect the country
 */

import { usePhotos } from '../api/photos.js';
import PhotoUploadForm from './PhotoUploadForm.jsx';
import PhotoGallery from './PhotoGallery.jsx';

export default function CountrySidebar({ countryCode, countryName, onClose }) {
  const { data: photos = [], isLoading } = usePhotos(countryCode);

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

      {/* Gallery scroll region */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <p className="p-4 text-label text-text-muted text-center">Loading photos…</p>
        ) : (
          <PhotoGallery photos={photos} countryCode={countryCode} />
        )}
      </div>
    </div>
  );
}
