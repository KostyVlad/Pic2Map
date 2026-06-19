import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLogin } from '../../api/auth.js';

/**
 * LoginScreen — UI-SPEC Screen 1
 *
 * Centered card; email + password + remember-me checkbox; sign-in button;
 * navigation links to signup and forgot-password.
 */
export default function LoginScreen() {
  const navigate = useNavigate();
  const { mutate: login, isPending } = useLogin();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // Field-level validation errors (shown after first submit)
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState('');

  // Field validation
  const emailError = submitted && !email ? 'Email is required.'
    : submitted && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Enter a valid email address.'
    : '';
  const passwordError = submitted && !password ? 'Password is required.'
    : submitted && password.length < 8 ? 'Password must be at least 8 characters.'
    : '';

  function handleSubmit(e) {
    e.preventDefault();
    setSubmitted(true);
    setServerError('');

    if (emailError || passwordError || !email || !password || password.length < 8) return;
    // Re-evaluate after setting submitted
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;

    login(
      { email, password, rememberMe },
      {
        onSuccess: () => navigate('/'),
        onError: (err) => {
          const msg = err.message || '';
          if (msg.toLowerCase().includes('too many') || msg.toLowerCase().includes('rate')) {
            setServerError('Too many attempts. Wait a moment before trying again.');
          } else {
            setServerError('Incorrect email or password. Check your details and try again.');
          }
        },
      }
    );
  }

  return (
    <div className="flex items-center justify-center min-h-dvh bg-bg">
      <div className="w-full max-w-sm bg-surface border border-border rounded-lg shadow-sm p-6 mx-4">
        <h1 className="text-heading font-semibold text-text mb-6">Sign in</h1>

        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-4">
            {/* Card-level server error */}
            {serverError && (
              <div
                role="alert"
                className="rounded-md bg-red-50 border border-destructive px-4 py-3 text-body text-destructive"
              >
                {serverError}
              </div>
            )}

            {/* Email field */}
            <div>
              <label htmlFor="login-email" className="block text-label font-semibold text-text mb-1">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (serverError) setServerError(''); }}
                disabled={isPending}
                aria-describedby={emailError ? 'login-email-error' : undefined}
                className={[
                  'w-full min-h-11 px-3 py-2 bg-surface text-body text-text',
                  'border rounded-md placeholder:text-text-muted',
                  'outline-none focus:ring-2',
                  emailError ? 'border-destructive focus:ring-destructive' : 'border-border focus:ring-accent',
                  isPending ? 'opacity-50 cursor-not-allowed' : '',
                ].join(' ')}
              />
              {emailError && (
                <p id="login-email-error" className="text-label text-destructive mt-1">
                  {emailError}
                </p>
              )}
            </div>

            {/* Password field */}
            <div>
              <label htmlFor="login-password" className="block text-label font-semibold text-text mb-1">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (serverError) setServerError(''); }}
                disabled={isPending}
                aria-describedby={passwordError ? 'login-password-error' : undefined}
                className={[
                  'w-full min-h-11 px-3 py-2 bg-surface text-body text-text',
                  'border rounded-md placeholder:text-text-muted',
                  'outline-none focus:ring-2',
                  passwordError ? 'border-destructive focus:ring-destructive' : 'border-border focus:ring-accent',
                  isPending ? 'opacity-50 cursor-not-allowed' : '',
                ].join(' ')}
              />
              {passwordError && (
                <p id="login-password-error" className="text-label text-destructive mt-1">
                  {passwordError}
                </p>
              )}
            </div>

            {/* Remember me checkbox (D-05) */}
            <label className="flex items-center gap-2 cursor-pointer min-h-11">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={isPending}
                className="cursor-pointer"
              />
              <span className="text-label font-semibold text-text">Remember me</span>
            </label>

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
              {isPending ? 'Signing in...' : 'Sign in'}
            </button>

            {/* Navigation links */}
            <p className="text-center text-body text-text">
              Don&apos;t have an account?{' '}
              <Link
                to="/signup"
                className="text-accent underline-offset-2 hover:underline focus:ring-2 focus:ring-accent focus:ring-offset-1"
              >
                Create one
              </Link>
            </p>
            <p className="text-center">
              <Link
                to="/forgot-password"
                className="text-label text-text-muted hover:text-text underline-offset-2 hover:underline focus:ring-2 focus:ring-accent focus:ring-offset-1"
              >
                Forgot your password?
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
