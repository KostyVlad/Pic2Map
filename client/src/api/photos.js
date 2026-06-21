import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Fetch photos for a given country.
 *
 * @param {string|null} countryCode - ISO code to filter by; null skips the query
 * @returns {import('@tanstack/react-query').UseQueryResult}
 */
export function usePhotos(countryCode) {
  return useQuery({
    queryKey: ['photos', countryCode],
    queryFn: async () => {
      const res = await fetch(`/api/photos?countryCode=${encodeURIComponent(countryCode)}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch photos');
      return res.json();
    },
    enabled: !!countryCode,
    staleTime: 1000 * 30,
  });
}

/**
 * Upload photos to the selected country.
 * On success: invalidates ['photos', countryCode] and ['photo-counts'] so the
 * gallery and map both refresh without a page reload.
 *
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export function useUploadPhotos() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ files, countryCode, countryName }) => {
      const formData = new FormData();
      formData.append('countryCode', countryCode);
      formData.append('countryName', countryName || '');
      for (const file of files) {
        formData.append('photos', file);
      }

      const res = await fetch('/api/photos', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Upload failed. Check your connection and try again.');
      }
      return res.json();
    },
    onSuccess: (data, variables) => {
      // Invalidate the country's photo list and global counts
      queryClient.invalidateQueries({ queryKey: ['photos', variables.countryCode] });
      queryClient.invalidateQueries({ queryKey: ['photo-counts'] });
    },
  });
}

/**
 * Delete several photos at once.
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export function useDeletePhotos() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ids }) => {
      const res = await fetch('/api/photos/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete photos.');
      }
      return res.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['photos', variables.countryCode] });
      queryClient.invalidateQueries({ queryKey: ['photo-counts'] });
    },
  });
}

/**
 * Delete a single photo by id.
 * On success: refreshes the country's gallery and the map count badges.
 *
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export function useDeletePhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }) => {
      const res = await fetch(`/api/photos/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete photo.');
      }
      return res.json().catch(() => ({}));
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['photos', variables.countryCode] });
      queryClient.invalidateQueries({ queryKey: ['photo-counts'] });
    },
  });
}
