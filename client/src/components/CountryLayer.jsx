/**
 * CountryLayer — renders Natural Earth country/subunit polygons as a Leaflet GeoJSON layer.
 *
 * Interaction contract (UI-SPEC Map Interaction Contract):
 *  - Default no-photos: fillColor #e5e7eb, fillOpacity 0.2, border #9ca3af weight 1
 *  - Default has-photos: fillColor #3b82f6, fillOpacity 0.45, border #9ca3af weight 1
 *  - Hover (any): increase fillOpacity to 0.65, border #374151 weight 2
 *    Fix 1: mouseout MUST reset to the correct base style (not a hardcoded default).
 *    The selected country keeps its selected style on mouseout — only non-selected revert.
 *  - Selected: fillColor #3b82f6, fillOpacity 0.75, border #1d4ed8 weight 3
 *  - Selected no-photos: fillColor #6366f1, fillOpacity 0.6, border #1d4ed8 weight 3
 *
 * Key architectural pattern (Pitfall 3):
 *  react-leaflet <GeoJSON> style prop is NOT reactive. Re-mount via key when photoCounts
 *  changes (see WorldMap.jsx).
 *
 * Stale-closure fix (Pitfall 5 / RESEARCH Pattern 1):
 *  Leaflet event handlers run outside React. selectedLayerRef / hoveredLayerRef are
 *  useRef values so handlers always see current state without stale closures.
 *
 * Fix 2/3: uses the 10m map_subunits GeoJSON + SU_A3 subunit key via extractIso()
 *  so small islands (Dominica) are clickable and overseas territories (French Guiana)
 *  are distinct from their parent country (France).
 */

import { GeoJSON } from 'react-leaflet';
import { useRef } from 'react';
import { extractIso } from '../utils/isoCode.js';

// Map layer color table — from UI-SPEC "Map layer colors (Leaflet polygon styles)"
const STYLE = {
  DEFAULT_NO_PHOTOS:  { color: '#9ca3af', weight: 1, fillColor: '#e5e7eb', fillOpacity: 0.2 },
  DEFAULT_HAS_PHOTOS: { color: '#9ca3af', weight: 1, fillColor: '#3b82f6', fillOpacity: 0.45 },
  HOVER:              { color: '#374151', weight: 2, fillOpacity: 0.65 },
  SELECTED:           { color: '#1d4ed8', weight: 3, fillColor: '#3b82f6', fillOpacity: 0.75 },
  SELECTED_NO_PHOTOS: { color: '#1d4ed8', weight: 3, fillColor: '#6366f1', fillOpacity: 0.6 },
};

/**
 * @param {object} props
 * @param {object} props.countriesGeoJSON - The full GeoJSON FeatureCollection
 * @param {Map<string, number>} props.photoCounts - Map<subunitCode, count>
 * @param {string|null} props.selectedCode - Currently selected subunit code
 * @param {function(string, string): void} props.onCountryClick - (subunitCode, name) => void
 */
export default function CountryLayer({ countriesGeoJSON, photoCounts, selectedCode, onCountryClick }) {
  const hoveredLayerRef = useRef(null);
  const selectedLayerRef = useRef(null);
  const selectedCodeRef = useRef(selectedCode);
  selectedCodeRef.current = selectedCode;

  // Returns the base (non-hover, non-selected) style for a feature
  function getBaseStyle(feature) {
    const code = extractIso(feature);
    const hasPhotos = photoCounts.has(code) && photoCounts.get(code) > 0;
    return hasPhotos ? { ...STYLE.DEFAULT_HAS_PHOTOS } : { ...STYLE.DEFAULT_NO_PHOTOS };
  }

  // Returns the selected style for a feature
  function getSelectedStyle(feature) {
    const code = extractIso(feature);
    const hasPhotos = photoCounts.has(code) && photoCounts.get(code) > 0;
    return hasPhotos ? { ...STYLE.SELECTED } : { ...STYLE.SELECTED_NO_PHOTOS };
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
      // After a photoCounts-driven re-mount the layer objects are fresh. Re-bind the
      // selected layer to the new object and re-apply its selected style so selection
      // (and correct hover/reset behavior) survives the re-mount.
      if (code === selectedCodeRef.current) {
        selectedLayerRef.current = layer;
        layer.setStyle(getSelectedStyle(feature));
      }
    });

    layer.on({
      mouseover(e) {
        const l = e.target;
        // Fix 1 (sticking): Leaflet drops mouseout when the cursor moves fast between
        // adjacent polygons, leaving the prior layer stuck in HOVER. Reset the previously
        // hovered layer here before highlighting the new one.
        const prev = hoveredLayerRef.current;
        if (prev && prev !== l && prev !== selectedLayerRef.current) {
          prev.setStyle(getBaseStyle(prev.feature));
        }
        // Don't override selected style — only non-selected countries get hover effect
        if (l !== selectedLayerRef.current) {
          // Apply hover overlay on top of the current base style
          const base = getBaseStyle(feature);
          l.setStyle({ ...base, ...STYLE.HOVER });
        }
        l.bringToFront();
        hoveredLayerRef.current = l;
      },

      mouseout(e) {
        // Fix 1: reset to the CORRECT base style (default/has-photos) — not a hardcoded fallback.
        // The selected country keeps its selected style on mouseout.
        const l = e.target;
        if (l !== selectedLayerRef.current) {
          // Restore exact base style: has-photos blue or no-photos grey
          l.setStyle(getBaseStyle(feature));
        }
        // If this IS the selected layer, leave its selected style untouched
        hoveredLayerRef.current = null;
      },

      click(e) {
        // Deselect previous selection — restore its base style
        if (selectedLayerRef.current && selectedLayerRef.current !== e.target) {
          const prevFeature = selectedLayerRef.current.feature;
          selectedLayerRef.current.setStyle(getBaseStyle(prevFeature));
        }
        const l = e.target;
        l.setStyle(getSelectedStyle(feature));
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
