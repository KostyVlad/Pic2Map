import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForgotPassword } from '../../api/auth.js';

/**
 * ForgotPasswordScreen — UI-SPEC Screen 3
 *
 * Centered card; email input; "Send reset link" button; "Back to sign in" link.
 *
 * On submit success: form is REPLACED with a success message (no enumeration —
 * same success copy regardless of whether the email matched). The server always
 * returns 200 so this is guaranteed.
 *
 * On rate-limit or unexpected server error: show a card-level error.
 */
export default function ForgotPasswordScreen() {
  const { mutate: forgotPassword, isPending } = useForgotPassword();

  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);   // first submit attempt
  const [success, setSuccess] = useState(false);        // server returned 200
  const [serverError, setServerError] = useState('');

  // Field validation (shown only after first submit attempt)
  const emailError = submitted && !email ? 'Email is required.'
    : submitted && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Enter a valid email address.'
    : '';

  function handleSubmit(e) {
    e.preventDefault();
    setSubmitted(true);
    setServerError('');

    const hasEmailErr = !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (hasEmailErr) return;

    forgotPassword(
      { email },
      {
        onSuccess: () => {
          // Always show success regardless of whether the email matched (no enumeration)
          setSuccess(true);
        },
        onError: (err) => {
          const msg = err.message || '';
          if (msg.toLowerCase().includes('too many') || msg.toLowerCase().includes('rate')) {
            setServerError('Too many attempts. Wait a moment before trying again.');
          } else {
            setServerError(msg || 'Something went wrong. Please try again.');
          }
        },
      }
    );
  }

  return (
    <div className="flex items-center justify-center min-h-dvh bg-bg">
      <div className="w-full max-w-sm bg-surface border border-border rounded-lg shadow-sm p-6 mx-4">
        <h1 className="text-heading font-semibold text-text mb-6">Reset password</h1>

        {success ? (
          /* ----------------------------------------------------------------
             Success state — replace the form entirely (same card, same title)
             No field or button; keep the "Back to sign in" link.
             Copy per UI-SPEC Copywriting "Password Reset Flow".
          ---------------------------------------------------------------- */
          <div className="space-y-4">
            <p className="text-body text-text">
              Check your email. If that address has an account, we&apos;ve sent a reset link.
            </p>
            <p className="text-center">
              <Link
                to="/login"
                className="text-label text-text-muted hover:text-text underline-offset-2 hover:underline focus:ring-2 focus:ring-accent focus:ring-offset-1"
              >
                Back to sign in
              </Link>
            </p>
          </div>
        ) : (
          /* ----------------------------------------------------------------
             Normal state — instruction copy + email field + button
          ---------------------------------------------------------------- */
          <form onSubmit={handleSubmit} noValidate>
            <div className="space-y-4">
              {/* Card-level server error (rate limit, unexpected failure) */}
              {serverError && (
                <div
                  role="alert"
                  className="rounded-md bg-red-50 border border-destructive px-4 py-3 text-body text-destructive"
                >
                  {serverError}
                </div>
              )}

              {/* Instructional copy (UI-SPEC Instructional Copy table) */}
              <p className="text-body text-text-muted mb-4">
                Enter your email and we&apos;ll send you a link to reset your password.
              </p>

              {/* Email field */}
              <div>
                <label htmlFor="forgot-email" className="block text-label font-semibold text-text mb-1">
                  Email
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (serverError) setServerError(''); }}
                  disabled={isPending}
                  aria-describedby={emailError ? 'forgot-email-error' : undefined}
                  className={[
                    'w-full min-h-11 px-3 py-2 bg-surface text-body text-text',
                    'border rounded-md placeholder:text-text-muted',
                    'outline-none focus:ring-2',
                    emailError ? 'border-destructive focus:ring-destructive' : 'border-border focus:ring-accent',
                    isPending ? 'opacity-50 cursor-not-allowed' : '',
                  ].join(' ')}
                />
                {emailError && (
                  <p id="forgot-email-error" className="text-label text-destructive mt-1">
                    {emailError}
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
                {isPending ? 'Sending...' : 'Send reset link'}
              </button>

              {/* Back to sign in link */}
              <p className="text-center">
                <Link
                  to="/login"
                  className="text-label text-text-muted hover:text-text underline-offset-2 hover:underline focus:ring-2 focus:ring-accent focus:ring-offset-1"
                >
                  Back to sign in
                </Link>
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
