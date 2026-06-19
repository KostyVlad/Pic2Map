import { useAuth } from '../context/AuthContext.jsx';
import { useLogout } from '../api/auth.js';

/**
 * AccountStrip — authenticated chrome (UI-SPEC Account Strip)
 *
 * Fixed top-left pill overlaid on the map: shows the user's email + a "Sign out" button.
 * z-index 500 — above Leaflet tiles (400) and controls.
 *
 * Clicking "Sign out" calls logout → clears httpOnly cookie → ['auth','me'] invalidated →
 * ProtectedRoute redirects to /login. No confirmation dialog (UI-SPEC).
 */
export default function AccountStrip() {
  const { user } = useAuth();
  const { mutate: logout } = useLogout();

  if (!user) return null;

  return (
    <div
      className="fixed top-2 left-2 z-[500] max-w-[220px] bg-surface border border-border rounded-md shadow-sm px-3 py-2 flex items-center gap-2"
    >
      <span className="text-label font-semibold text-text truncate min-w-0">
        {user.email}
      </span>
      <span className="text-text-muted flex-shrink-0" aria-hidden="true">·</span>
      <button
        type="button"
        onClick={() => logout()}
        className="text-label text-text-muted hover:text-text cursor-pointer flex-shrink-0 outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
      >
        Sign out
      </button>
    </div>
  );
}
