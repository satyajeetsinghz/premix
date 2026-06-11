/**
 * ============================================================================
 * Premix - Protected Admin Route Component
 * ============================================================================
 * File: features/admin/components/ProtectedAdminRoute.tsx
 *
 * ARCHITECTURE OVERVIEW:
 * - Route guard component that enforces admin authentication
 * - Requires both authentication AND admin role
 * - Used to wrap admin routes in the router (/admin path)
 * - More strict than ProtectedRoute (checks both auth and role)
 *
 * ACCESS CONTROL LOGIC:
 * 1. Check if auth state is loading (show spinner)
 * 2. Check if user exists (auth check)
 * 3. Check if user.role === "admin" (role check)
 * 4. All checks pass: render admin content
 *
 * USAGE PATTERN:
 * Located in app/router.tsx:
 * {
 *   path: "/admin",
 *   element: (
 *     <ProtectedAdminRoute>
 *       <AdminPage />
 *     </ProtectedAdminRoute>
 *   ),
 * }
 *
 * DEPENDENCY:
 * - Must be used within AuthProvider's component tree
 * - Calls useAuth which throws if AuthProvider not found
 *
 * ERROR HANDLING:
 * - Loading state: Shows spinner (better UX than blank page)
 * - Not authenticated: Redirects to home /
 * - Non-admin user: Redirects to home /
 * - useAuth throws descriptive error if called outside AuthProvider
 *
 * NAVIGATION STATE:
 * - Passes state to Navigate for debugging/alerts if needed
 * - state.from: Indicates request came from admin-route
 * - state.message: Contains access denied message
 *
 * ============================================================================
 */

import { useAuth } from "@/features/auth/hooks/useAuth";
import { Navigate } from "react-router-dom";
import CircularProgress from "@mui/material/CircularProgress";

interface ProtectedAdminRouteProps {
  children: React.ReactNode;
}

// Access denied message shown when non-admin tries to access admin features
const ADMIN_ACCESS_MESSAGE = "You need admin privileges to access this page";

/**
 * ProtectedAdminRoute Component
 *
 * RESPONSIBILITY:
 * - Enforce both authentication AND admin role requirement
 * - Show loading spinner during auth resolution
 * - Redirect unauthorized users to home page
 * - Protect admin-only routes from regular users
 *
 * ACCESS CONTROL FLOW:
 * 1. Check if auth state is still loading
 *    → Show spinner (auth not resolved yet)
 * 2. Check if user exists
 *    → Redirect to / if no user (not authenticated)
 * 3. Check if user.role === "admin"
 *    → Redirect to / if not admin (insufficient permissions)
 * 4. All checks pass
 *    → Render admin content (children)
 *
 * ROLE-BASED ACCESS CONTROL:
 * - Only "admin" role has access
 * - "user" and "moderator" roles are denied
 * - Role determined by user.role from Firestore
 * - Set by admin during user creation
 *
 * ACCESSIBILITY:
 * - Loading spinner: role="status" + aria-label
 * - Spinner div: aria-live="polite" for screen readers
 * - Conveys loading state to assistive technologies
 *
 * @param children - React components to render if admin authenticated
 * @returns Spinner (loading), Navigate component (redirect), or children
 */
const ProtectedAdminRoute = ({ children }: ProtectedAdminRouteProps) => {
  // Get user and loading state from auth context
  const { user, loading } = useAuth();

  /**
   * renderLoadingState - Display loading spinner during auth resolution
   *
   * ACCESSIBILITY:
   * - Semantic role="status" for screen readers
   * - aria-live="polite" announces changes
   * - aria-label describes what's loading
   * - aria-hidden on spinner icon (decorative)
   */
  const renderLoadingState = () => (
    <div
      className="min-h-screen bg-white flex flex-col items-center justify-center"
      role="status"
      aria-live="polite"
      aria-label="Loading admin access verification"
    >
      <div className="flex flex-col items-center gap-4">
        <CircularProgress
          size={40}
          className="text-gray-400"
          aria-hidden="true"
        />
        <p className="text-sm text-gray-500 font-medium">Loading...</p>
      </div>
    </div>
  );

  /**
   * renderUnauthorizedRedirect - Redirect users without admin access
   *
   * NAVIGATION STATE:
   * - Passes metadata for potential toast/alert notifications
   * - Can be accessed via useLocation() in home page if needed
   * - Helps with debugging unauthorized access attempts
   */
  const renderUnauthorizedRedirect = () => (
    <Navigate
      to="/"
      replace
      state={{
        from: "admin-route",
        message: ADMIN_ACCESS_MESSAGE,
      }}
    />
  );

  // Priority 1: Check if auth state is still resolving
  if (loading) {
    return renderLoadingState();
  }

  // Priority 2: Check if user is authenticated and has admin role
  if (!user || user.role !== "admin") {
    return renderUnauthorizedRedirect();
  }

  // All checks passed: render admin content
  return <>{children}</>;
};

export default ProtectedAdminRoute;
