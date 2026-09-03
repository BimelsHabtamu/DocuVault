import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AccessDeniedPage from '../pages/AccessDeniedPage';

/**
 * ProtectedRoute — used in two ways:
 *
 * 1. Auth gate (no allowedRoles):
 *    Just ensures the user is logged in. Used on the single unified shell.
 *    Unauthenticated → /login.
 *
 * 2. Role gate (allowedRoles provided, showDenied=true):
 *    Used on individual pages inside the shell to restrict by role.
 *    Wrong role → renders <AccessDeniedPage> inline.
 */
export default function ProtectedRoute({ children, allowedRoles, showDenied = false }) {
  const { isAuthenticated, user, authLoading } = useAuth();

  // While validating the stored token, show a spinner so the page
  // does not flash to /login on a hard refresh.
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
        <div className="flex flex-col items-center gap-3">
          <svg
            className="animate-spin w-8 h-8 text-[#3b5bdb]"
            fill="none"
            viewBox="0 0 24 24"
            aria-label="Loading"
          >
            <circle
              className="opacity-25"
              cx="12" cy="12" r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <p className="text-sm text-[var(--color-text-secondary)] font-medium">Loading…</p>
        </div>
      </div>
    );
  }

  // Not logged in → send to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Role check — only when allowedRoles is specified
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    // showDenied=true: render the 403 page in place (used for individual pages)
    if (showDenied) {
      return <AccessDeniedPage />;
    }
    // Should not normally be reached with the unified shell approach,
    // but fall back to the access-denied route just in case.
    return <Navigate to="/access-denied" replace />;
  }

  return children;
}
