import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import LoginScreen from './components/auth/LoginScreen.jsx';
import SignupScreen from './components/auth/SignupScreen.jsx';
import AccountStrip from './components/AccountStrip.jsx';
import WorldMap from './components/WorldMap.jsx';

/**
 * ProtectedRoute — gates children behind authentication (D-04, Pattern 7).
 *
 * - While /api/auth/me is loading: render null (no flash of map or login)
 * - user is null (not authenticated / session expired): redirect to /login
 * - user is set: render children
 */
function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

/**
 * Minimal placeholder for routes that plan 02-03 will replace.
 * Prevents /forgot-password and /reset-password from 404-ing when LoginScreen links to them.
 */
function ComingSoon({ title }) {
  return (
    <div className="flex items-center justify-center min-h-dvh bg-bg">
      <div className="w-full max-w-sm bg-surface border border-border rounded-lg shadow-sm p-6 mx-4 text-center">
        <h1 className="text-heading font-semibold text-text mb-4">{title}</h1>
        <p className="text-body text-text-muted">Coming soon — password reset launches in the next update.</p>
      </div>
    </div>
  );
}

/**
 * App — root component.
 *
 * Wraps everything with BrowserRouter + AuthProvider (AuthProvider must be inside
 * BrowserRouter so auth screens can use react-router-dom Link/Navigate).
 *
 * Routes:
 *   /login            → LoginScreen (public)
 *   /signup           → SignupScreen (public)
 *   /forgot-password  → placeholder (plan 02-03)
 *   /reset-password   → placeholder (plan 02-03)
 *   /                 → ProtectedRoute → AccountStrip + WorldMap
 *   *                 → Navigate to /
 */
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/signup" element={<SignupScreen />} />
          <Route path="/forgot-password" element={<ComingSoon title="Reset password" />} />
          <Route path="/reset-password" element={<ComingSoon title="Choose a new password" />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AccountStrip />
                <WorldMap />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
