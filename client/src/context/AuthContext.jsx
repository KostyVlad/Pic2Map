import { createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';

/**
 * AuthContext — provides { user, isLoading } throughout the app.
 *
 * user = null  → not authenticated (or session expired / absent)
 * user = { id, email } → authenticated
 *
 * Pattern 8 from RESEARCH.md: useQuery keyed ['auth','me'] fetches /api/auth/me.
 * - 401 resolves to null (not an error) — expired/absent session = logged out state
 * - Other errors propagate
 * - retry:false prevents re-fetching on 401 (avoids 3 spurious 401s on mount)
 * - staleTime:Infinity — only revalidated on explicit invalidateQueries from login/logout
 *
 * Login/signup/logout mutations in api/auth.js all invalidate ['auth','me'] on success,
 * triggering a re-fetch and re-evaluation of ProtectedRoute (D-05 session-on-refresh).
 */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { data: user, isLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.status === 401) return null; // not authenticated — not an error
      if (!res.ok) throw new Error('Auth check failed');
      return res.json();
    },
    retry: false,
    staleTime: Infinity,
  });

  return (
    <AuthContext.Provider value={{ user: user ?? null, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * useAuth — consume auth context.
 * @returns {{ user: {id: string, email: string} | null, isLoading: boolean }}
 */
export function useAuth() {
  return useContext(AuthContext);
}
