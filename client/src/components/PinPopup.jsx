/**
 * PinPopup — thumbnail + filename popup rendered inside a react-leaflet <Popup>.
 *
 * UI-SPEC §2:
 *  - Width: 180px fixed
 *  - Thumbnail: 180×120px, object-fit: cover
 *  - Caption: filename truncated at 24 chars with "…", text-label (14px)
 *  - Click thumbnail → opens existing YARL lightbox at the photo's index (via onThumbnailClick)
 *
 * Security (T-03-XSS-POPUP): filename rendered via React (auto-escaped — no XSS).
 * DivIcon html contains no user-supplied content.
 *
 * @param {object} props
 * @param {object}   props.photo            - photo with thumbnailKey, originalFilename
 * @param {function(): void} props.onThumbnailClick - called when thumbnail is clicked
 */
export default function PinPopup({ photo, onThumbnailClick }) {
  const name = photo.originalFilename || '';
  const truncated = name.length > 24 ? name.slice(0, 24) + '…' : name;

  return (
    <div style={{ width: 180 }}>
      <button
        type="button"
        onClick={onThumbnailClick}
        aria-label={`Open ${name} in lightbox`}
        className="block w-full cursor-pointer"
        style={{ padding: 0, border: 'none', background: 'none' }}
      >
        <img
          src={`/api/photos/file/${encodeURIComponent(photo.thumbnailKey)}`}
          alt={name}
          style={{
            width: 180,
            height: 120,
            objectFit: 'cover',
            display: 'block',
          }}
        />
      </button>
      <div className="px-2 py-2">
        <p className="text-label text-text" style={{ margin: 0 }}>{truncated}</p>
      </div>
    </div>
  );
}
