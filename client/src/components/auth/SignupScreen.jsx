import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSignup } from '../../api/auth.js';

/**
 * SignupScreen — UI-SPEC Screen 2
 *
 * Centered card; email + password + confirm-password; create-account button;
 * client-side validation; navigation link back to login.
 */
export default function SignupScreen() {
  const navigate = useNavigate();
  const { mutate: signup, isPending } = useSignup();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState('');

  // Field validation (after first submit)
  const emailError = submitted && !email ? 'Email is required.'
    : submitted && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Enter a valid email address.'
    : '';
  const passwordError = submitted && !password ? 'Password is required.'
    : submitted && password.length < 8 ? 'Password must be at least 8 characters.'
    : '';
  const confirmError = submitted && !confirmPassword ? 'Password is required.'
    : submitted && password !== confirmPassword ? 'Passwords do not match.'
    : '';

  function handleSubmit(e) {
    e.preventDefault();
    setSubmitted(true);
    setServerError('');

    // Check all validations synchronously
    const hasEmailErr = !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const hasPassErr = !password || password.length < 8;
    const hasConfirmErr = !confirmPassword || password !== confirmPassword;
    if (hasEmailErr || hasPassErr || hasConfirmErr) return;

    signup(
      { email, password },
      {
        onSuccess: () => navigate('/'),
        onError: (err) => {
          const msg = err.message || '';
          if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered') || msg.toLowerCase().includes('duplicate')) {
            setServerError('An account with that email already exists.');
          } else {
            setServerError(msg || 'Signup failed. Please try again.');
          }
        },
      }
    );
  }

  return (
    <div className="flex items-center justify-center min-h-dvh bg-bg">
      <div className="w-full max-w-sm bg-surface border border-border rounded-lg shadow-sm p-6 mx-4">
        <h1 className="text-heading font-semibold text-text mb-6">Create account</h1>

        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-4">
            {/* Card-level server error */}
            {serverError && (
              <div
                role="alert"
                className="rounded-md bg-red-50 border border-destructive px-4 py-3 text-body text-destructive"
              >
                {serverError}{' '}
                {(serverError.toLowerCase().includes('already') || serverError.toLowerCase().includes('exists')) && (
                  <Link
                    to="/login"
                    className="text-accent underline-offset-2 hover:underline focus:ring-2 focus:ring-accent focus:ring-offset-1"
                  >
                    Sign in instead?
                  </Link>
                )}
              </div>
            )}

            {/* Email field */}
            <div>
              <label htmlFor="signup-email" className="block text-label font-semibold text-text mb-1">
                Email
              </label>
              <input
                id="signup-email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (serverError) setServerError(''); }}
                disabled={isPending}
                aria-describedby={emailError ? 'signup-email-error' : undefined}
                className={[
                  'w-full min-h-11 px-3 py-2 bg-surface text-body text-text',
                  'border rounded-md placeholder:text-text-muted',
                  'outline-none focus:ring-2',
                  emailError ? 'border-destructive focus:ring-destructive' : 'border-border focus:ring-accent',
                  isPending ? 'opacity-50 cursor-not-allowed' : '',
                ].join(' ')}
              />
              {emailError && (
                <p id="signup-email-error" className="text-label text-destructive mt-1">
                  {emailError}
                </p>
              )}
            </div>

            {/* Password field */}
            <div>
              <label htmlFor="signup-password" className="block text-label font-semibold text-text mb-1">
                Password
              </label>
              <input
                id="signup-password"
                type="password"
                autoComplete="new-password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isPending}
                aria-describedby={passwordError ? 'signup-password-error' : undefined}
                className={[
                  'w-full min-h-11 px-3 py-2 bg-surface text-body text-text',
                  'border rounded-md placeholder:text-text-muted',
                  'outline-none focus:ring-2',
                  passwordError ? 'border-destructive focus:ring-destructive' : 'border-border focus:ring-accent',
                  isPending ? 'opacity-50 cursor-not-allowed' : '',
                ].join(' ')}
              />
              {passwordError && (
                <p id="signup-password-error" className="text-label text-destructive mt-1">
                  {passwordError}
                </p>
              )}
            </div>

            {/* Confirm password field */}
            <div>
              <label htmlFor="signup-confirm-password" className="block text-label font-semibold text-text mb-1">
                Confirm password
              </label>
              <input
                id="signup-confirm-password"
                type="password"
                autoComplete="new-password"
                required
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isPending}
                aria-describedby={confirmError ? 'signup-confirm-error' : undefined}
                className={[
                  'w-full min-h-11 px-3 py-2 bg-surface text-body text-text',
                  'border rounded-md placeholder:text-text-muted',
                  'outline-none focus:ring-2',
                  confirmError ? 'border-destructive focus:ring-destructive' : 'border-border focus:ring-accent',
                  isPending ? 'opacity-50 cursor-not-allowed' : '',
                ].join(' ')}
              />
              {confirmError && (
                <p id="signup-confirm-error" className="text-label text-destructive mt-1">
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
              {isPending ? 'Creating account...' : 'Create account'}
            </button>

            {/* Navigation link */}
            <p className="text-center text-body text-text">
              Already have an account?{' '}
              <Link
                to="/login"
                className="text-accent underline-offset-2 hover:underline focus:ring-2 focus:ring-accent focus:ring-offset-1"
              >
                Sign in
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
