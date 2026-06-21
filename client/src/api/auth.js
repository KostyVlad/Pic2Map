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
    onSuccess: (data) => {
      // Drop the previous account's data so nothing bleeds into this session.
      queryClient.removeQueries({ queryKey: ['photos'] });
      queryClient.removeQueries({ queryKey: ['photo-counts'] });
      // Seed auth SYNCHRONOUSLY from the login response ({ user: {id,email} } →
      // /me shape {id,email}). This makes `user` available before the screen's
      // navigate('/') runs, so ProtectedRoute doesn't bounce back to /login while
      // an async /me refetch is still in flight.
      queryClient.setQueryData(['auth', 'me'], data?.user ?? null);
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
    onSuccess: (data) => {
      // Fresh account — drop any prior session's data, then seed auth from the
      // signup response so navigate('/') lands on an authenticated map (no race).
      queryClient.removeQueries({ queryKey: ['photos'] });
      queryClient.removeQueries({ queryKey: ['photo-counts'] });
      queryClient.setQueryData(['auth', 'me'], data?.user ?? null);
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
      // Remove this account's data so the next account on this browser can't see
      // it, and set auth to null synchronously so ProtectedRoute redirects to login.
      queryClient.removeQueries({ queryKey: ['photos'] });
      queryClient.removeQueries({ queryKey: ['photo-counts'] });
      queryClient.setQueryData(['auth', 'me'], null);
    },
  });
}

/**
 * useForgotPassword — POST /api/auth/forgot-password
 *
 * The server ALWAYS returns 200 regardless of whether the email exists (no enumeration).
 * The caller always shows the same success message after submission.
 * Surface server error messages for unexpected failures (e.g. rate limit).
 */
export function useForgotPassword() {
  return useMutation({
    mutationFn: async ({ email }) => {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Request failed');
      }
      return res.json();
    },
  });
}

/**
 * useResetPassword — POST /api/auth/reset-password
 *
 * Accepts { token, password }. On 400 the server returns "Invalid or expired token"
 * or a password validation error — surface these to the caller.
 */
export function useResetPassword() {
  return useMutation({
    mutationFn: async ({ token, password }) => {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Reset failed');
      }
      return res.json();
    },
  });
}
