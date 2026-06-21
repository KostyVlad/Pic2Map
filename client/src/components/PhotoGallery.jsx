/**
 * PhotoGallery — 3-column thumbnail grid with lightbox + multi-select delete.
 *
 * UI-SPEC: grid-cols-3, gap-1, 1:1 aspect-ratio thumbnails with 4px radius.
 * Default: clicking a thumbnail opens the lightbox; the lightbox toolbar has a
 * single-photo Delete (POL-04).
 * Select mode: a "Select" toggle turns clicks into selection; a bar shows
 * "N selected" with Delete / Cancel and removes them in one request.
 * Empty state: "No photos yet" heading (UI-SPEC Copywriting).
 */

import { useState } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import { useDeletePhoto, useDeletePhotos } from '../api/photos.js';
import ConfirmDialog from './ConfirmDialog.jsx';

export default function PhotoGallery({ photos = [], countryCode }) {
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  // { message, confirmLabel, onConfirm } | null
  const [confirm, setConfirm] = useState(null);

  const { mutate: deletePhoto, isPending: isDeletingOne } = useDeletePhoto();
  const { mutate: deletePhotos, isPending: isDeletingMany } = useDeletePhotos();

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

  function exitSelectMode() {
    setSelectMode(false);
    setSelected(new Set());
  }

  function toggleSelected(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleThumbClick(photo, index) {
    if (selectMode) {
      toggleSelected(photo._id);
    } else {
      setLightboxIndex(index);
    }
  }

  function handleDeleteOne() {
    const photo = photos[lightboxIndex];
    if (!photo || isDeletingOne) return;
    setConfirm({
      message: 'Delete this photo? This cannot be undone.',
      confirmLabel: 'Delete',
      onConfirm: () =>
        deletePhoto(
          { id: photo._id, countryCode: countryCode || photo.countryCode },
          {
            onSuccess: () => {
              setConfirm(null);
              setLightboxIndex(-1);
            },
          }
        ),
    });
  }

  function handleDeleteSelected() {
    if (selected.size === 0 || isDeletingMany) return;
    const count = selected.size;
    setConfirm({
      message: `Delete ${count} photo${count > 1 ? 's' : ''}? This cannot be undone.`,
      confirmLabel: `Delete ${count}`,
      onConfirm: () =>
        deletePhotos(
          { ids: [...selected], countryCode },
          {
            onSuccess: () => {
              setConfirm(null);
              exitSelectMode();
            },
          }
        ),
    });
  }

  return (
    <>
      {/* Selection toolbar */}
      <div className="flex items-center justify-between gap-2 px-2 pt-2">
        {selectMode ? (
          <>
            <span className="text-label text-text-muted">{selected.size} selected</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDeleteSelected}
                disabled={selected.size === 0 || isDeletingMany}
                className={[
                  'min-h-11 px-3 rounded-md text-label font-semibold',
                  'border border-destructive text-destructive',
                  'transition-colors focus:outline-none focus:ring-2 focus:ring-destructive',
                  (selected.size === 0 || isDeletingMany) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-50',
                ].join(' ')}
              >
                {isDeletingMany ? 'Deleting…' : 'Delete'}
              </button>
              <button
                type="button"
                onClick={exitSelectMode}
                disabled={isDeletingMany}
                className="min-h-11 px-3 rounded-md text-label font-semibold text-text-muted hover:text-text transition-colors focus:outline-none focus:ring-2 focus:ring-accent"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setSelectMode(true)}
            className="ml-auto min-h-11 px-3 rounded-md text-label font-semibold text-accent hover:bg-accent-subtle transition-colors focus:outline-none focus:ring-2 focus:ring-accent"
          >
            Select
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1 p-2">
        {photos.map((photo, i) => {
          const isSelected = selected.has(photo._id);
          return (
            <button
              key={photo._id}
              type="button"
              className={[
                'relative aspect-square overflow-hidden rounded cursor-pointer',
                'focus:outline-none focus:ring-2 focus:ring-accent',
                isSelected ? 'ring-2 ring-accent' : '',
              ].join(' ')}
              onClick={() => handleThumbClick(photo, i)}
              aria-label={photo.originalFilename || `Photo ${i + 1}`}
              aria-pressed={selectMode ? isSelected : undefined}
            >
              <img
                src={`/api/photos/file/${encodeURIComponent(photo.thumbnailKey)}`}
                alt={photo.originalFilename || `Photo ${i + 1}`}
                className={[
                  'w-full h-full object-cover rounded transition-opacity',
                  selectMode && !isSelected ? 'opacity-70' : 'hover:opacity-85',
                ].join(' ')}
                loading="lazy"
              />
              {selectMode && (
                <span
                  className={[
                    'absolute top-1 left-1 w-5 h-5 rounded-full border flex items-center justify-center text-[11px] font-bold',
                    isSelected ? 'bg-accent text-surface border-accent' : 'bg-overlay text-surface border-surface',
                  ].join(' ')}
                  aria-hidden="true"
                >
                  {isSelected ? '✓' : ''}
                </span>
              )}
            </button>
          );
        })}
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
              onClick={handleDeleteOne}
              disabled={isDeletingOne}
              aria-label="Delete photo"
            >
              {isDeletingOne ? 'Deleting…' : 'Delete'}
            </button>,
            'close',
          ],
        }}
      />

      <ConfirmDialog
        open={!!confirm}
        title="Delete photo"
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        busy={isDeletingOne || isDeletingMany}
        onConfirm={() => confirm?.onConfirm?.()}
        onCancel={() => {
          if (!(isDeletingOne || isDeletingMany)) setConfirm(null);
        }}
      />
    </>
  );
}
