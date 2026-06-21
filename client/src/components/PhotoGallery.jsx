/**
 * PhotoGallery — 3-column thumbnail grid with lightbox.
 *
 * UI-SPEC: grid-cols-3, gap-1, 1:1 aspect-ratio thumbnails with 4px radius.
 * Clicking a thumbnail opens yet-another-react-lightbox with the display-size image.
 * Empty state: "No photos yet" heading (UI-SPEC Copywriting).
 * A Delete button in the lightbox toolbar removes the currently viewed photo
 * (POL-04) after a confirmation, then closes the lightbox.
 */

import { useState } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import { useDeletePhoto } from '../api/photos.js';

export default function PhotoGallery({ photos = [], countryCode }) {
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const { mutate: deletePhoto, isPending: isDeleting } = useDeletePhoto();

  if (photos.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-heading font-semibold text-text">No photos yet</p>
      </div>
    );
  }

  const slides = photos.map(p => ({
    src: `/api/photos/file/${encodeURIComponent(p.storageKey)}`,
    alt: p.originalFilename || 'Photo',
  }));

  function handleDelete() {
    const photo = photos[lightboxIndex];
    if (!photo || isDeleting) return;
    if (!window.confirm('Delete this photo? This cannot be undone.')) return;
    deletePhoto(
      { id: photo._id, countryCode: countryCode || photo.countryCode },
      { onSuccess: () => setLightboxIndex(-1) }
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-1 p-2">
        {photos.map((photo, i) => (
          <button
            key={photo._id}
            type="button"
            className="aspect-square overflow-hidden rounded cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent"
            onClick={() => setLightboxIndex(i)}
            aria-label={photo.originalFilename || `Photo ${i + 1}`}
          >
            <img
              src={`/api/photos/file/${encodeURIComponent(photo.thumbnailKey)}`}
              alt={photo.originalFilename || `Photo ${i + 1}`}
              className="w-full h-full object-cover hover:opacity-85 transition-opacity rounded"
              loading="lazy"
            />
          </button>
        ))}
      </div>

      <Lightbox
        open={lightboxIndex >= 0}
        index={lightboxIndex}
        close={() => setLightboxIndex(-1)}
        slides={slides}
        on={{ view: ({ index }) => setLightboxIndex(index) }}
        toolbar={{
          buttons: [
            <button
              key="delete"
              type="button"
              className="yarl__button"
              onClick={handleDelete}
              disabled={isDeleting}
              aria-label="Delete photo"
            >
              {isDeleting ? 'Deleting…' : 'Delete'}
            </button>,
            'close',
          ],
        }}
      />
    </>
  );
}
