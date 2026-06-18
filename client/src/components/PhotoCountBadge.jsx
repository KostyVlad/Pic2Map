/**
 * PhotoCountBadge — a Leaflet DivIcon-based marker showing a country's photo count.
 *
 * UI-SPEC Photo count badge:
 *  - Background: accent-subtle (rgba(59,130,246,0.15))
 *  - Border: 1px solid accent (#3b82f6)
 *  - Text: accent (#3b82f6), text-label (14px) semibold
 *  - Shape: pill — border-radius 12px; padding 2px 8px
 *  - Show only when count >= 1
 *  - Cap at "99+" for counts > 99
 *
 * Security (T-02-XSS): badge content is numeric-only; country code from curated GeoJSON,
 * never user-supplied input. DivIcon HTML uses fixed markup.
 *
 * @param {object} props
 * @param {[number, number]} props.position - [lat, lng] from computeCentroid()
 * @param {number} props.count - photo count (>= 1)
 */

import { Marker } from 'react-leaflet';
import L from 'leaflet';

/**
 * Build a Leaflet DivIcon for the count pill.
 * @param {number} count
 * @returns {L.DivIcon}
 */
function makeBadgeIcon(count) {
  const label = count > 99 ? '99+' : String(count);
  return L.divIcon({
    className: '', // suppress Leaflet's default white square CSS
    html: `<span style="
      display: inline-block;
      background: rgba(59,130,246,0.15);
      border: 1px solid #3b82f6;
      color: #3b82f6;
      font-size: 14px;
      font-weight: 600;
      line-height: 1.4;
      border-radius: 12px;
      padding: 2px 8px;
      white-space: nowrap;
      pointer-events: none;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    ">${label}</span>`,
    iconAnchor: [0, 0], // will be centered via CSS transform below
    iconSize: null,     // auto-sized by content
  });
}

export default function PhotoCountBadge({ position, count }) {
  if (!count || count < 1) return null;

  const icon = makeBadgeIcon(count);

  return (
    <Marker
      position={position}
      icon={icon}
      interactive={false}  // badges don't capture clicks — let map clicks through
      keyboard={false}
    />
  );
}
