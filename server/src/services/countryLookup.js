/**
 * Country lookup via point-in-polygon against the server-local countries.geojson.
 *
 * Uses @turf/boolean-point-in-polygon (NOT the full @turf/turf bundle — ~15KB vs 400KB).
 * GeoJSON is loaded once at module load time and cached (2 MB, ~301 features).
 *
 * The GeoJSON is the 10m map_subunits dataset keyed by SU_A3. extractIso() MUST
 * be the SU_A3-chain version (server/src/utils/isoCode.js) so returned country codes
 * match the client-side map keys (Pitfall 1 fix).
 *
 * Point-in-polygon uses [lng, lat] coordinate order per the GeoJSON spec (Pitfall 4).
 * Returns null for ocean, Antarctica, and disputed/unmatched territories (D-04 — no
 * nearest-country snapping).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { extractIso } from '../utils/isoCode.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Server-local copy — avoids cross-package path coupling (Assumption A2 resolved)
const GEOJSON_PATH = resolve(__dirname, '../data/countries.geojson');

let _features = null;

function getFeatures() {
  if (!_features) {
    const raw = readFileSync(GEOJSON_PATH, 'utf8');
    _features = JSON.parse(raw).features;
  }
  return _features;
}

/**
 * Resolve GPS coordinates to a country code and display name.
 *
 * Returns null if the point falls outside all polygons (ocean, disputed territory,
 * Antarctica). No nearest-country snapping per D-04.
 *
 * @param {number} lat - Decimal degrees latitude (positive = N, negative = S)
 * @param {number} lng - Decimal degrees longitude (positive = E, negative = W)
 * @returns {{ code: string, name: string } | null}
 */
export function resolveCountry(lat, lng) {
  // turf uses [lng, lat] order (GeoJSON spec: x=longitude, y=latitude)
  const pt = { type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] } };
  const features = getFeatures();
  for (const feature of features) {
    if (booleanPointInPolygon(pt, feature)) {
      return {
        code: extractIso(feature),         // SU_A3 key — matches client map
        name: feature.properties.NAME || '',
      };
    }
  }
  return null; // Ocean / Antarctica / unmatched disputed territory
}
