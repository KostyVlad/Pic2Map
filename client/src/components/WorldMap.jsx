/**
 * WorldMap — the full-bleed Leaflet map with country polygons and the sidebar.
 *
 * RESEARCH Pattern 1: CountryLayer is re-mounted (key prop) when photoCounts changes
 * so the GeoJSON style function gets fresh data (Pitfall 3 — style is not reactive).
 *
 * Tile provider: VITE_TILE_URL env var (default Stadia alidade_smooth).
 * API key: not required for localhost with Stadia. Override env for production.
 */

import { useState, useEffect } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { usePhotoCounts } from '../api/countries.js';
import CountryLayer from './CountryLayer.jsx';
import CountrySidebar from './CountrySidebar.jsx';

// Tile provider URL — Stadia alidade_smooth (works on localhost without an API key)
// Override VITE_TILE_URL in client/.env for production / alternate providers
const TILE_URL =
  import.meta.env.VITE_TILE_URL ||
  'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png';

const TILE_ATTRIBUTION =
  '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; ' +
  '<a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; ' +
  '<a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export default function WorldMap() {
  // GeoJSON loaded once on mount — static asset, no re-fetch needed (Pitfall 7)
  const [countriesGeoJSON, setCountriesGeoJSON] = useState(null);

  // Per-country photo counts — drives polygon color and re-mount of CountryLayer
  const { data: photoCounts = new Map() } = usePhotoCounts();

  // Selected country state
  const [selectedCountry, setSelectedCountry] = useState(null); // { code, name }

  useEffect(() => {
    fetch('/countries.geojson')
      .then(r => r.json())
      .then(setCountriesGeoJSON)
      .catch(err => console.error('Failed to load countries GeoJSON:', err));
  }, []);

  function handleCountryClick(code, name) {
    setSelectedCountry(prev =>
      prev?.code === code ? null : { code, name }
    );
  }

  function handleSidebarClose() {
    setSelectedCountry(null);
  }

  // Key for CountryLayer — forces re-mount when photoCounts change so styles refresh (Pitfall 3)
  const countsKey = [...photoCounts.keys()].sort().join(',') || 'empty';

  return (
    <div className="relative h-dvh w-full">
      <MapContainer
        center={[20, 0]}
        zoom={2}
        minZoom={2}
        maxZoom={6}
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
      </MapContainer>

      {/* Country panel — rendered only when a country is selected (UI-SPEC: panel absent otherwise) */}
      {selectedCountry && (
        <CountrySidebar
          countryCode={selectedCountry.code}
          countryName={selectedCountry.name}
          onClose={handleSidebarClose}
        />
      )}
    </div>
  );
}
