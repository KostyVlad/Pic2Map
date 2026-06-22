/**
 * extractIso — resolve the subunit-level key for a Natural Earth GeoJSON feature.
 *
 * With the 10m map_subunits dataset, we use SU_A3 as the primary key
 * so that overseas territories are distinct from their parent country:
 *   - France metropolitan → "FXX"
 *   - French Guiana → "GUF"
 *   - Martinique → "MTQ"
 *   - Dominica → "DMA"
 *
 * Fallback chain: SU_A3 → GU_A3 → ADM0_A3 → NAME slug
 * Treat '-99' / empty as absent at every level.
 *
 * This function mirrors client/src/utils/isoCode.js — keep in sync.
 *
 * @param {object} feature - A GeoJSON feature from ne_10m_admin_0_map_subunits.geojson
 * @returns {string} Uppercase subunit code (e.g. "FXX", "GUF", "DMA")
 */
export function extractIso(feature) {
  const p = feature.properties;

  // Primary: SU_A3 (subunit-level code — distinguishes territories from metropole)
  if (p.SU_A3 && p.SU_A3 !== '-99') return p.SU_A3.toUpperCase();

  // Fallback 1: GU_A3 (geounit code)
  if (p.GU_A3 && p.GU_A3 !== '-99') return p.GU_A3.toUpperCase();

  // Fallback 2: ADM0_A3 (admin-0 code)
  if (p.ADM0_A3 && p.ADM0_A3 !== '-99') return p.ADM0_A3.toUpperCase();

  // Last resort: NAME as an underscore slug
  return (p.NAME || 'XX').replace(/\s+/g, '_').toUpperCase();
}
