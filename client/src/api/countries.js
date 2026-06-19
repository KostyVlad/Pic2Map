import { useQuery } from '@tanstack/react-query';

/**
 * Fetch per-country photo counts from the API.
 * Returns a Map<isoCode, count> for O(1) lookup in CountryLayer.
 *
 * Used to:
 *  1. Style countries with photos differently on the map (CMAP-04)
 *  2. Feed photo-count badges (Phase 2 enhancement)
 *
 * @returns {import('@tanstack/react-query').UseQueryResult<Map<string, number>>}
 */
export function usePhotoCounts() {
  return useQuery({
    queryKey: ['photo-counts'],
    queryFn: async () => {
      const res = await fetch('/api/countries/photo-counts', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch photo counts');
      const data = await res.json();
      // Convert { US: 12, FR: 8 } object to Map<string, number>
      return new Map(Object.entries(data));
    },
    staleTime: 1000 * 30, // 30s — invalidated on upload mutation
  });
}
