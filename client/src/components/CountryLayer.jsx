/**
 * CountryLayer — renders all Natural Earth country polygons as a Leaflet GeoJSON layer.
 *
 * Interaction contract (UI-SPEC Map Interaction Contract):
 *  - Default no-photos: fillColor #e5e7eb, fillOpacity 0.2, border #9ca3af weight 1
 *  - Default has-photos: fillColor #3b82f6, fillOpacity 0.45, border #9ca3af weight 1
 *  - Hover (any): increase fillOpacity to 0.65, border #374151 weight 2
 *  - Selected: fillColor #3b82f6, fillOpacity 0.75, border #1d4ed8 weight 3
 *  - Selected no-photos: fillColor #6366f1, fillOpacity 0.6, border #1d4ed8 weight 3
 *
 * Key architectural pattern (Pitfall 3):
 *  The react-leaflet <GeoJSON> style prop is NOT reactive to state changes.
 *  Styling must go through layer.setStyle() imperatively (onEachFeature handlers)
 *  or via full re-mount (key prop change when photoCounts changes — see WorldMap.jsx).
 *
 * Stale-closure fix (Pitfall 5 / RESEARCH Pattern 1):
 *  Leaflet event handlers run outside React's render cycle — they capture state at
 *  mount time. selectedLayerRef / hoveredLayerRef track the mutable layer references
 *  so click/mouseout can always find the correct layer without stale closures.
 */

import { GeoJSON } from 'react-leaflet';
import { useRef } from 'react';

// Client-side ISO extraction (mirrors server utils/isoCode.js — kept in sync manually)
function extractIso(feature) {
  const p = feature.properties;
  if (p.ISO_A2 && p.ISO_A2 !== '-99') return p.ISO_A2.toUpperCase();
  if (p.ISO_A2_EH && p.ISO_A2_EH !== '-99') return p.ISO_A2_EH.toUpperCase();
  if (p.ISO_A3 && p.ISO_A3 !== '-99') return p.ISO_A3.slice(0, 2).toUpperCase();
  return (p.NAME || 'XX').replace(/\s+/g, '_').toUpperCase();
}

// Map layer color table — from UI-SPEC "Map layer colors (Leaflet polygon styles)"
const STYLE = {
  DEFAULT_NO_PHOTOS: { color: '#9ca3af', weight: 1, fillColor: '#e5e7eb', fillOpacity: 0.2 },
  DEFAULT_HAS_PHOTOS: { color: '#9ca3af', weight: 1, fillColor: '#3b82f6', fillOpacity: 0.45 },
  HOVER:    { color: '#374151', weight: 2, fillOpacity: 0.65 },
  SELECTED: { color: '#1d4ed8', weight: 3, fillColor: '#3b82f6', fillOpacity: 0.75 },
  SELECTED_NO_PHOTOS: { color: '#1d4ed8', weight: 3, fillColor: '#6366f1', fillOpacity: 0.6 },
};

/**
 * @param {object} props
 * @param {object} props.countriesGeoJSON - The full GeoJSON FeatureCollection
 * @param {Map<string, number>} props.photoCounts - Map<isoCode, count>
 * @param {string|null} props.selectedCode - Currently selected ISO code
 * @param {function(string, string): void} props.onCountryClick - (isoCode, name) => void
 */
export default function CountryLayer({ countriesGeoJSON, photoCounts, selectedCode, onCountryClick }) {
  const hoveredLayerRef = useRef(null);
  const selectedLayerRef = useRef(null);
  const selectedCodeRef = useRef(selectedCode);
  selectedCodeRef.current = selectedCode;

  function getBaseStyle(feature) {
    const code = extractIso(feature);
    const hasPhotos = photoCounts.has(code) && photoCounts.get(code) > 0;
    return hasPhotos ? { ...STYLE.DEFAULT_HAS_PHOTOS } : { ...STYLE.DEFAULT_NO_PHOTOS };
  }

  function onEachFeature(feature, layer) {
    const code = extractIso(feature);
    const name = feature.properties.NAME || code;

    // Keyboard accessibility — Tab to country, Enter/Space to select (UI-SPEC Accessibility)
    layer.on('add', () => {
      if (layer._path) {
        layer._path.setAttribute('tabindex', '0');
        layer._path.setAttribute('role', 'button');
        layer._path.setAttribute('aria-label', name);
      }
    });

    layer.on({
      mouseover(e) {
        const l = e.target;
        // Don't override selected style
        if (l !== selectedLayerRef.current) {
          const base = getBaseStyle(feature);
          l.setStyle({ ...base, ...STYLE.HOVER });
        }
        l.bringToFront();
        hoveredLayerRef.current = l;
      },
      mouseout(e) {
        const l = e.target;
        if (l !== selectedLayerRef.current) {
          l.setStyle(getBaseStyle(feature));
        }
        hoveredLayerRef.current = null;
      },
      click(e) {
        // Deselect previous selection
        if (selectedLayerRef.current && selectedLayerRef.current !== e.target) {
          const prevFeature = selectedLayerRef.current.feature;
          selectedLayerRef.current.setStyle(getBaseStyle(prevFeature));
        }
        const l = e.target;
        const hasPhotos = photoCounts.has(code) && photoCounts.get(code) > 0;
        l.setStyle(hasPhotos ? { ...STYLE.SELECTED } : { ...STYLE.SELECTED_NO_PHOTOS });
        l.bringToFront();
        selectedLayerRef.current = l;
        onCountryClick(code, name);
      },
      keydown(e) {
        if (e.originalEvent.key === 'Enter' || e.originalEvent.key === ' ') {
          layer.fire('click', e);
        }
      },
    });
  }

  return (
    <GeoJSON
      data={countriesGeoJSON}
      style={getBaseStyle}
      onEachFeature={onEachFeature}
    />
  );
}
