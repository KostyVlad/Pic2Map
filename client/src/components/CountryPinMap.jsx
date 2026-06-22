/**
 * CountryPinMap — a self-contained Leaflet MapContainer showing photo pins + clusters
 * for a single country, rendered inside CountrySidebar when the user drills in.
 *
 * Architecture (RESEARCH Pitfall 6): Independent MapContainer — never shares a ref
 * or event handlers with WorldMap. react-leaflet context is scoped per MapContainer.
 *
 * Bounds on mount (RESEARCH Pitfall 5): PinLayer initializes `bounds` state
 * synchronously from map.getBounds() on the first render so useSupercluster returns
 * clusters before the user moves the map.
 *
 * Coordinate order (RESEARCH Pitfall 4): photos.location.coordinates are already
 * [lng, lat] (GeoJSON order). Leaflet Markers receive [lat, lng]. useSupercluster
 * points geometry uses [lng, lat].
 *
 * Keying (RESEARCH Pitfall 7): PinLayer is keyed on photos.length so it only
 * remounts when the photo list changes, not on every render.
 *
 * react-leaflet v5 (RESEARCH anti-patterns): useMapEvents MUST be called inside a
 * component that is a child of MapContainer. No leafletElement.
 *
 * UI-SPEC §4:
 *  - Height: 240px (desktop md+), 180px mobile
 *  - Same TILE_URL as WorldMap (Stadia alidade_smooth / VITE_TILE_URL)
 *  - bounds fit to countryBbox with 20px padding; minZoom 3, maxZoom 18
 *  - Zoom control shown
 *
 * @param {object} props
 * @param {Array}  props.photos         - array of photo objects from usePhotos
 * @param {Array}  props.countryBbox    - [[south, west], [north, east]] Leaflet bounds
 * @param {string} props.countryName    - country display name for aria-label
 * @param {function(string): void} props.onOpenLightbox - opens lightbox at photo index by photoId
 */

import { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, useMapEvents } from 'react-leaflet';
import useSupercluster from 'use-supercluster';
import PhotoPinMarker from './PhotoPinMarker.jsx';
import ClusterMarker from './ClusterMarker.jsx';

// Same tile provider as WorldMap — no separate config needed
const TILE_URL =
  import.meta.env.VITE_TILE_URL ||
  'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png';

// ---------------------------------------------------------------------------
// Inner component — MUST be a MapContainer child to use react-leaflet hooks
// ---------------------------------------------------------------------------

/**
 * PinLayer — renders clustered pins using useSupercluster.
 * Must live inside MapContainer so useMapEvents has access to the map context.
 */
function PinLayer({ photos, onOpenLightbox }) {
  // Pitfall 5: initialize bounds non-null so clusters appear before first interaction.
  // We use null initially and capture them in a useEffect that fires once the map is ready.
  const [bounds, setBounds] = useState(null);
  const [zoom, setZoom] = useState(5);

  // updateBoundsZoom reads current map state and pushes it into React state
  // Defined with useCallback so it can be shared between useMapEvents and useEffect
  const updateBoundsZoom = useCallback((map) => {
    const b = map.getBounds();
    setBounds([
      b.getSouthWest().lng,
      b.getSouthWest().lat,
      b.getNorthEast().lng,
      b.getNorthEast().lat,
    ]);
    setZoom(map.getZoom());
  }, []);

  // react-leaflet v5: useMapEvents returns the map instance.
  // Fires on move/zoom and also captures initial bounds on mount.
  const map = useMapEvents({
    moveend: () => updateBoundsZoom(map),
    zoomend: () => updateBoundsZoom(map),
  });

  // Pitfall 5 fix: capture initial bounds synchronously on first render.
  // map.getBounds() is valid immediately after MapContainer mounts (bounds prop
  // was already applied by Leaflet before React renders the children).
  useEffect(() => {
    updateBoundsZoom(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build GeoJSON-Feature points from photos that have GPS coordinates.
  // Coordinates are already [lng, lat] from the server (GeoJSON spec).
  const points = photos
    .filter(p => p.location?.coordinates?.length === 2)
    .map(p => ({
      type: 'Feature',
      properties: {
        cluster: false,
        photoId: p._id,
        filename: p.originalFilename,
        thumbnailKey: p.thumbnailKey,
      },
      // Pitfall 4: coordinates are [lng, lat] — no transposition needed
      geometry: { type: 'Point', coordinates: p.location.coordinates },
    }));

  const { clusters, supercluster } = useSupercluster({
    points,
    bounds,   // [swLng, swLat, neLng, neLat] — null until map is ready (useSupercluster tolerates null)
    zoom,
    options: { radius: 60, maxZoom: 17 },
  });

  return clusters.map(cluster => {
    // Pitfall 4: cluster geometry coordinates are [lng, lat]; Leaflet wants [lat, lng]
    const [lng, lat] = cluster.geometry.coordinates;
    const { cluster: isCluster } = cluster.properties;

    if (isCluster) {
      return (
        <ClusterMarker
          key={`cluster-${cluster.id}`}
          cluster={cluster}
          supercluster={supercluster}
          map={map}
        />
      );
    }

    // Individual pin
    const { photoId, thumbnailKey, filename } = cluster.properties;
    const photo = { _id: photoId, thumbnailKey, originalFilename: filename };

    return (
      <PhotoPinMarker
        key={`pin-${photoId}`}
        photo={photo}
        position={[lat, lng]}
        onThumbnailClick={onOpenLightbox}
      />
    );
  });
}

// ---------------------------------------------------------------------------
// Outer component — provides the MapContainer
// ---------------------------------------------------------------------------

export default function CountryPinMap({ photos, countryBbox, countryName, onOpenLightbox }) {
  // countryBbox is [[south, west], [north, east]] — Leaflet LatLngBounds format
  // If somehow not provided (shouldn't happen) fall back to a world view
  const safeBbox = countryBbox ?? [[-60, -180], [85, 180]];

  return (
    <div
      role="region"
      aria-label={`${countryName || 'Country'} photo map`}
      className="relative w-full h-[180px] md:h-[240px]"
      style={{ position: 'relative' }}
    >
      <MapContainer
        bounds={safeBbox}
        boundsOptions={{ padding: [20, 20] }}
        minZoom={3}
        maxZoom={18}
        zoomControl
        className="h-full w-full"
        style={{ position: 'absolute', inset: 0 }}
      >
        <TileLayer url={TILE_URL} />
        {/* Pitfall 7: key on photos.length so PinLayer remounts only when the list changes */}
        <PinLayer
          key={photos.length}
          photos={photos}
          onOpenLightbox={onOpenLightbox}
        />
      </MapContainer>
    </div>
  );
}
