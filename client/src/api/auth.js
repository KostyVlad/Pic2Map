import { useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * useLogin — POST /api/auth/login
 *
 * On success: invalidates ['auth','me'] so ProtectedRoute re-evaluates.
 * Surfaces server error message (401 "Incorrect email or password") to the caller.
 */
export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ email, password, rememberMe = false }) => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, rememberMe }),
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Login failed');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

/**
 * useSignup — POST /api/auth/signup
 *
 * On success: the server logs the user in immediately (D-02), sets the cookie,
 * and invalidates ['auth','me'] so the gate flips to logged-in state.
 * Surfaces 400 "Email already registered" to the caller for the duplicate-email error.
 */
export function useSignup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ email, password }) => {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Signup failed');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

/**
 * useLogout — POST /api/auth/logout
 *
 * On success: invalidates ['auth','me'] so ProtectedRoute redirects to login.
 */
export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Logout failed');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}
