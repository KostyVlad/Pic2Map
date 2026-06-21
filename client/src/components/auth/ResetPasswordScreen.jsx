import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useResetPassword } from '../../api/auth.js';

/**
 * ResetPasswordScreen — UI-SPEC Screen 4
 *
 * Reads ?token= from the URL via useSearchParams (react-router-dom).
 *
 * States:
 *  1. No token in URL → expired/invalid state immediately (no form rendered)
 *  2. Normal state: new-password + confirm-new-password; "Set new password" button
 *  3. Success state (after submit): confirmation message + "Go to sign in" link
 *  4. Server 400 (invalid/expired token): transitions to expired state
 *
 * Security: token is passed straight to the server — no client-side validation of
 * the token itself. The server verifies sha256(token) against the stored hash and TTL.
 */
export default function ResetPasswordScreen() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const { mutate: resetPassword, isPending } = useResetPassword();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [success, setSuccess] = useState(false);
  const [tokenInvalid, setTokenInvalid] = useState(!token); // no token → expired state immediately

  // Field-level validation errors (shown after first submit attempt)
  const passwordError = submitted && !password ? 'Password is required.'
    : submitted && password.length < 8 ? 'Password must be at least 8 characters.'
    : '';
  const confirmError = submitted && !confirmPassword ? 'Password is required.'
    : submitted && password !== confirmPassword ? 'Passwords do not match.'
    : '';

  function handleSubmit(e) {
    e.preventDefault();
    setSubmitted(true);

    const hasPassErr = !password || password.length < 8;
    const hasConfirmErr = !confirmPassword || password !== confirmPassword;
    if (hasPassErr || hasConfirmErr) return;

    resetPassword(
      { token, password },
      {
        onSuccess: () => {
          setSuccess(true);
        },
        onError: (err) => {
          const msg = err.message || '';
          // Server returns 400 "Invalid or expired token" when token is bad/expired
          if (
            msg.toLowerCase().includes('invalid or expired') ||
            msg.toLowerCase().includes('invalid') ||
            msg.toLowerCase().includes('expired')
          ) {
            setTokenInvalid(true);
          }
          // Other errors (e.g. password too short) are shown via field validation
          // The server validates password length so this won't surface otherwise
        },
      }
    );
  }

  // -----------------------------------------------------------------------
  // Expired / invalid token state
  // -----------------------------------------------------------------------
  if (tokenInvalid) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-bg">
        <div className="w-full max-w-sm bg-surface border border-border rounded-lg shadow-sm p-6 mx-4">
          <h1 className="text-heading font-semibold text-text mb-6">Choose a new password</h1>
          <div className="space-y-4">
            <p className="text-body text-text">
              This reset link has expired or is invalid. Request a new one.
            </p>
            <p className="text-center">
              <Link
                to="/forgot-password"
                className="text-accent underline-offset-2 hover:underline focus:ring-2 focus:ring-accent focus:ring-offset-1"
              >
                Request a new reset link
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Success state (replace form after successful reset)
  // -----------------------------------------------------------------------
  if (success) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-bg">
        <div className="w-full max-w-sm bg-surface border border-border rounded-lg shadow-sm p-6 mx-4">
          <h1 className="text-heading font-semibold text-text mb-6">Choose a new password</h1>
          <div className="space-y-4">
            <p className="text-body text-text">
              Your password has been updated. You can now sign in.
            </p>
            <p className="text-center">
              <Link
                to="/login"
                className="text-accent underline-offset-2 hover:underline focus:ring-2 focus:ring-accent focus:ring-offset-1"
              >
                Go to sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Normal state — new password form
  // -----------------------------------------------------------------------
  return (
    <div className="flex items-center justify-center min-h-dvh bg-bg">
      <div className="w-full max-w-sm bg-surface border border-border rounded-lg shadow-sm p-6 mx-4">
        <h1 className="text-heading font-semibold text-text mb-6">Choose a new password</h1>

        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-4">
            {/* New password field */}
            <div>
              <label htmlFor="reset-password" className="block text-label font-semibold text-text mb-1">
                New password
              </label>
              <input
                id="reset-password"
                type="password"
                autoComplete="new-password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isPending}
                aria-describedby={passwordError ? 'reset-password-error' : undefined}
                className={[
                  'w-full min-h-11 px-3 py-2 bg-surface text-body text-text',
                  'border rounded-md placeholder:text-text-muted',
                  'outline-none focus:ring-2',
                  passwordError ? 'border-destructive focus:ring-destructive' : 'border-border focus:ring-accent',
                  isPending ? 'opacity-50 cursor-not-allowed' : '',
                ].join(' ')}
              />
              {passwordError && (
                <p id="reset-password-error" className="text-label text-destructive mt-1">
                  {passwordError}
                </p>
              )}
            </div>

            {/* Confirm new password field */}
            <div>
              <label htmlFor="reset-confirm-password" className="block text-label font-semibold text-text mb-1">
                Confirm new password
              </label>
              <input
                id="reset-confirm-password"
                type="password"
                autoComplete="new-password"
                required
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isPending}
                aria-describedby={confirmError ? 'reset-confirm-error' : undefined}
                className={[
                  'w-full min-h-11 px-3 py-2 bg-surface text-body text-text',
                  'border rounded-md placeholder:text-text-muted',
                  'outline-none focus:ring-2',
                  confirmError ? 'border-destructive focus:ring-destructive' : 'border-border focus:ring-accent',
                  isPending ? 'opacity-50 cursor-not-allowed' : '',
                ].join(' ')}
              />
              {confirmError && (
                <p id="reset-confirm-error" className="text-label text-destructive mt-1">
                  {confirmError}
                </p>
              )}
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={isPending}
              className={[
                'w-full min-h-11 px-4 py-2 rounded-md',
                'bg-accent hover:bg-accent-dark text-surface text-label font-semibold',
                'transition-colors duration-150',
                'outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2',
                isPending ? 'opacity-60 cursor-not-allowed' : '',
              ].join(' ')}
            >
              {isPending ? 'Saving...' : 'Set new password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
