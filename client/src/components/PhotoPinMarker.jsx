/**
 * PhotoPinMarker — a single-photo Leaflet DivIcon pin.
 *
 * UI-SPEC §1:
 *  - 16px circle, fill #3b82f6 (accent), 2px #ffffff border, border-radius 50%
 *  - 44×44px transparent touch target (accessibility)
 *  - Center-anchored (pin is a dot, not a teardrop)
 *  - Wraps a react-leaflet <Popup> containing <PinPopup>
 *
 * Security (T-03-XSS-POPUP): DivIcon html uses fixed markup — no user-supplied
 * strings interpolated. Photo content rendered via React inside <Popup>.
 *
 * Pattern: mirrors PhotoCountBadge L.divIcon({ className: '', html, iconSize, iconAnchor })
 */

import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import PinPopup from './PinPopup.jsx';

/**
 * Build a center-anchored DivIcon for a single-photo pin.
 * className: '' suppresses Leaflet's default white square.
 * @returns {L.DivIcon}
 */
function makePinIcon() {
  return L.divIcon({
    className: '', // suppress Leaflet default white square (PhotoCountBadge pattern)
    html: `<div style="
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    ">
      <div style="
        width: 16px;
        height: 16px;
        background: #3b82f6;
        border: 2px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 1px 4px rgba(0,0,0,0.3);
      "></div>
    </div>`,
    iconSize: [44, 44],   // 44px touch target (a11y)
    iconAnchor: [22, 22], // center-anchor — dot, not teardrop
  });
}

// Singleton icon to avoid creating a new object on every render
const PIN_ICON = makePinIcon();

/**
 * @param {object} props
 * @param {object}   props.photo         - photo object with _id, thumbnailKey, originalFilename
 * @param {[number, number]} props.position  - [lat, lng] Leaflet order
 * @param {function(string): void} props.onThumbnailClick - called with photoId to open lightbox
 */
export default function PhotoPinMarker({ photo, position, onThumbnailClick }) {
  return (
    <Marker
      position={position}
      icon={PIN_ICON}
    >
      <Popup>
        <PinPopup
          photo={photo}
          onThumbnailClick={() => onThumbnailClick(photo._id)}
        />
      </Popup>
    </Marker>
  );
}
