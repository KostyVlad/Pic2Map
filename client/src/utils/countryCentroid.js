/**
 * computeCentroid — return a [lat, lng] centroid for a GeoJSON feature.
 *
 * Strategy: prefer LABEL_X/LABEL_Y from Natural Earth properties (curated centroid
 * positions that avoid ocean placement for oddly-shaped countries). Fall back to the
 * average of the first ring of the largest polygon in the feature.
 *
 * Returns Leaflet [lat, lng] order.
 *
 * @param {object} feature - GeoJSON feature from ne_10m_admin_0_map_subunits.geojson
 * @returns {[number, number]} [lat, lng] for badge placement
 */
export function computeCentroid(feature) {
  const p = feature.properties;

  // Use Natural Earth's curated label coordinates when available
  if (typeof p.LABEL_X === 'number' && typeof p.LABEL_Y === 'number') {
    return [p.LABEL_Y, p.LABEL_X]; // [lat, lng]
  }

  const geom = feature.geometry;
  if (!geom) return [0, 0];

  // Find the largest polygon ring to use as the centroid source
  let rings = [];
  if (geom.type === 'Polygon') {
    rings = [geom.coordinates[0]]; // outer ring only
  } else if (geom.type === 'MultiPolygon') {
    // Pick the ring with the most coordinates (largest polygon approximation)
    rings = geom.coordinates.map(poly => poly[0]);
    rings.sort((a, b) => b.length - a.length);
  }

  if (rings.length === 0 || !rings[0] || rings[0].length === 0) return [0, 0];

  const ring = rings[0];
  let sumLng = 0, sumLat = 0;
  for (const [lng, lat] of ring) {
    sumLng += lng;
    sumLat += lat;
  }

  return [sumLat / ring.length, sumLng / ring.length]; // [lat, lng]
}
