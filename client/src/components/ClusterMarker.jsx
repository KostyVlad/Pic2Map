/**
 * ClusterMarker — a numbered cluster bubble DivIcon rendered by use-supercluster.
 *
 * UI-SPEC §3 size tiers:
 *  - 2–9 photos:  32px diameter
 *  - 10–99 photos: 40px diameter
 *  - 100+ photos:  48px diameter
 *
 * Fill: rgba(59,130,246,0.15) (accent-subtle)
 * Border: 2px solid #3b82f6 (accent)
 * Label: centered count, text-label 14px 600-weight, color #3b82f6
 *
 * Click: flyTo cluster expansion zoom via supercluster.getClusterExpansionZoom.
 * No popup on cluster click (UI-SPEC interaction).
 *
 * Security (T-03-XSS-POPUP): count is a number — no user-supplied HTML interpolated.
 *
 * Pattern: same L.divIcon({ className: '' }) factory as PhotoCountBadge.
 */

import { Marker } from 'react-leaflet';
import L from 'leaflet';

/**
 * Build a DivIcon for a cluster bubble at a given size tier.
 * className: '' suppresses Leaflet's default white square (PhotoCountBadge pattern).
 *
 * @param {number} count - number of photos in the cluster
 * @returns {L.DivIcon}
 */
function makeClusterIcon(count) {
  // UI-SPEC size tiers
  const size = count < 10 ? 32 : count < 100 ? 40 : 48;
  return L.divIcon({
    className: '', // suppress Leaflet default white square
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      background: rgba(59,130,246,0.15);
      border: 2px solid #3b82f6;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 600;
      color: #3b82f6;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      cursor: pointer;
    ">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2], // center-anchor
  });
}

/**
 * @param {object} props
 * @param {object}   props.cluster      - supercluster cluster feature
 * @param {object}   props.supercluster - supercluster instance for getClusterExpansionZoom
 * @param {object}   props.map          - Leaflet map instance (from useMapEvents)
 */
export default function ClusterMarker({ cluster, supercluster, map }) {
  const [lng, lat] = cluster.geometry.coordinates;
  const { point_count: count } = cluster.properties;

  return (
    <Marker
      position={[lat, lng]}
      icon={makeClusterIcon(count)}
      eventHandlers={{
        click: () => {
          const expansionZoom = Math.min(
            supercluster.getClusterExpansionZoom(cluster.id),
            17
          );
          map.flyTo([lat, lng], expansionZoom, { animate: true });
        },
      }}
    />
  );
}
