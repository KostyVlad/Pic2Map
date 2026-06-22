/**
 * WorldMap — the full-bleed Leaflet map with country polygons, count badges, and the sidebar.
 *
 * RESEARCH Pattern 1: CountryLayer is re-mounted (key prop) when photoCounts changes
 * so the GeoJSON style function gets fresh data (Pitfall 3 — style is not reactive).
 *
 * Plan 02 / CMAP-04: render a PhotoCountBadge at each country centroid when count >= 1.
 * Badges are also re-keyed on photoCounts change so counts update without page refresh.
 *
 * Phase 3 (03-02): when a country is selected, derive its [[south,west],[north,east]]
 * bounding box from the GeoJSON feature's polygon rings and pass it to CountrySidebar
 * as countryBbox so CountryPinMap can fitBounds on mount.
 *
 * Tile provider: VITE_TILE_URL env var (default Stadia alidade_smooth).
 * API key: not required for localhost with Stadia. Override env for production.
 */

import { useState, useEffect } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { usePhotoCounts } from '../api/countries.js';
import CountryLayer from './CountryLayer.jsx';
import CountrySidebar from './CountrySidebar.jsx';
import PhotoCountBadge from './PhotoCountBadge.jsx';
import { extractIso } from '../utils/isoCode.js';
import { computeCentroid } from '../utils/countryCentroid.js';

// Tile provider URL — Stadia alidade_smooth (works on localhost without an API key)
// Override VITE_TILE_URL in client/.env for production / alternate providers
const TILE_URL =
  import.meta.env.VITE_TILE_URL ||
  'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png';

const TILE_ATTRIBUTION =
  '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; ' +
  '<a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; ' +
  '<a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/**
 * Derive a Leaflet-format [[south, west], [north, east]] bounding box
 * from a GeoJSON feature's polygon rings (mirrors countryCentroid.js ring-walking).
 *
 * Returns [[minLat, minLng], [maxLat, maxLng]] — Leaflet LatLngBounds format.
 * Falls back to a world bbox if geometry is absent or empty.
 *
 * @param {object} feature - GeoJSON feature
 * @returns {[[number, number], [number, number]]}
 */
function deriveFeatureBbox(feature) {
  const geom = feature?.geometry;
  if (!geom) return [[-60, -180], [85, 180]];

  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;

  // Collect all outer rings (index 0 of each polygon)
  let rings = [];
  if (geom.type === 'Polygon') {
    rings = [geom.coordinates[0]];
  } else if (geom.type === 'MultiPolygon') {
    rings = geom.coordinates.map(poly => poly[0]);
  }

  for (const ring of rings) {
    if (!ring) continue;
    for (const [lng, lat] of ring) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }
  }

  if (!isFinite(minLat)) return [[-60, -180], [85, 180]];

  return [[minLat, minLng], [maxLat, maxLng]];
}

export default function WorldMap() {
  // GeoJSON loaded once on mount — static asset, no re-fetch needed (Pitfall 7)
  const [countriesGeoJSON, setCountriesGeoJSON] = useState(null);

  // Per-country photo counts — drives polygon color and badge rendering
  const { data: photoCounts = new Map() } = usePhotoCounts();

  // Selected country state — extended with countryBbox for CountryPinMap (03-02)
  const [selectedCountry, setSelectedCountry] = useState(null); // { code, name, bbox }

  useEffect(() => {
    fetch('/countries.geojson')
      .then(r => r.json())
      .then(setCountriesGeoJSON)
      .catch(err => console.error('Failed to load countries GeoJSON:', err));
  }, []);

  function handleCountryClick(code, name) {
    if (!countriesGeoJSON) {
      setSelectedCountry(prev => prev?.code === code ? null : { code, name, bbox: null });
      return;
    }

    // Deselect if same country clicked again
    if (selectedCountry?.code === code) {
      setSelectedCountry(null);
      return;
    }

    // Find the feature for this country code and derive its bbox
    const feature = countriesGeoJSON.features.find(f => extractIso(f) === code);
    const bbox = feature ? deriveFeatureBbox(feature) : null;
    setSelectedCountry({ code, name, bbox });
  }

  function handleSidebarClose() {
    setSelectedCountry(null);
  }

  // Key for CountryLayer — forces re-mount when photoCounts change so styles refresh (Pitfall 3)
  const countsKey = [...photoCounts.keys()].sort().join(',') || 'empty';

  // Build badge list from features with count >= 1
  const badgeEntries = countriesGeoJSON
    ? countriesGeoJSON.features
        .map(feature => {
          const code = extractIso(feature);
          const count = photoCounts.get(code) ?? 0;
          if (count < 1) return null;
          const position = computeCentroid(feature);
          return { code, count, position };
        })
        .filter(Boolean)
    : [];

  return (
    <div className="relative h-dvh w-full">
      <MapContainer
        center={[20, 0]}
        zoom={2}
        minZoom={2}
        maxZoom={10}
        worldCopyJump
        className="h-dvh w-full"
        style={{ position: 'absolute', inset: 0 }}
      >
        <TileLayer
          url={TILE_URL}
          attribution={TILE_ATTRIBUTION}
          maxZoom={18}
        />

        {countriesGeoJSON && (
          <CountryLayer
            key={countsKey}
            countriesGeoJSON={countriesGeoJSON}
            photoCounts={photoCounts}
            selectedCode={selectedCountry?.code ?? null}
            onCountryClick={handleCountryClick}
          />
        )}

        {/* Photo count badges — rendered for each country with >= 1 photo (CMAP-04) */}
        {badgeEntries.map(({ code, count, position }) => (
          <PhotoCountBadge
            key={`badge-${code}-${countsKey}`}
            position={position}
            count={count}
          />
        ))}
      </MapContainer>

      {/* Country panel — rendered only when a country is selected (UI-SPEC: panel absent otherwise).
          countryBbox derived from GeoJSON polygon rings for CountryPinMap fitBounds (03-02). */}
      {selectedCountry && (
        <CountrySidebar
          countryCode={selectedCountry.code}
          countryName={selectedCountry.name}
          countryBbox={selectedCountry.bbox}
          onClose={handleSidebarClose}
        />
      )}
    </div>
  );
}
