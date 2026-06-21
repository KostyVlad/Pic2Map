import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import LoginScreen from './components/auth/LoginScreen.jsx';
import SignupScreen from './components/auth/SignupScreen.jsx';
import ForgotPasswordScreen from './components/auth/ForgotPasswordScreen.jsx';
import ResetPasswordScreen from './components/auth/ResetPasswordScreen.jsx';
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
 * App — root component.
 *
 * Wraps everything with BrowserRouter + AuthProvider (AuthProvider must be inside
 * BrowserRouter so auth screens can use react-router-dom Link/Navigate).
 *
 * Routes:
 *   /login            → LoginScreen (public)
 *   /signup           → SignupScreen (public)
 *   /forgot-password  → ForgotPasswordScreen (public, plan 02-03)
 *   /reset-password   → ResetPasswordScreen (public, reads ?token= query param, plan 02-03)
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
          <Route path="/forgot-password" element={<ForgotPasswordScreen />} />
          <Route path="/reset-password" element={<ResetPasswordScreen />} />
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
