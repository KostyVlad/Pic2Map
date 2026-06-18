/**
 * extractIso — resolve the ISO 3166-1 alpha-2 code for a Natural Earth GeoJSON feature.
 *
 * Natural Earth has a known bug where ISO_A2 is set to "-99" for several countries
 * (France, Norway, Kosovo, ~15 others). We fall back through ISO_A2_EH → ISO_A3 → NAME.
 *
 * Sources: github.com/nvkelso/natural-earth-vector issues #695, #947, #284
 *
 * @param {object} feature - A GeoJSON feature from ne_110m_admin_0_countries.geojson
 * @returns {string} Uppercase ISO code (or NAME slug as last resort)
 */
export function extractIso(feature) {
  const p = feature.properties;

  // Primary: ISO_A2 (the standard field)
  if (p.ISO_A2 && p.ISO_A2 !== '-99') return p.ISO_A2.toUpperCase();

  // Fallback 1: ISO_A2_EH (extended homeland — covers France, Norway, etc.)
  if (p.ISO_A2_EH && p.ISO_A2_EH !== '-99') return p.ISO_A2_EH.toUpperCase();

  // Fallback 2: ISO_A3 truncated to 2 chars (imperfect but better than "-99")
  if (p.ISO_A3 && p.ISO_A3 !== '-99') return p.ISO_A3.slice(0, 2).toUpperCase();

  // Last resort: NAME as an underscore slug
  return (p.NAME || 'XX').replace(/\s+/g, '_').toUpperCase();
}
