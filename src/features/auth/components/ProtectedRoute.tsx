/**
 * ============================================================================
 * BEATSTREAM - Protected Route Component
 * ============================================================================
 * File: features/auth/components/ProtectedRoute.tsx
 *
 * ARCHITECTURE OVERVIEW:
 * - Route guard component that enforces authentication
 * - Redirects unauthenticated users to login page
 * - Used to wrap all protected routes in the router
 *
 * AUTHENTICATION FLOW:
 * 1. Route attempts to render ProtectedRoute
 * 2. ProtectedRoute calls useAuth hook
 * 3. If user exists: render children (allow access)
 * 4. If user is null: redirect to /login (deny access)
 *
 * USAGE PATTERN:
 * Located in app/router.tsx:
 * {
 *   path: "/",
 *   element: (
 *     <ProtectedRoute>
 *       <MainLayout />
 *     </ProtectedRoute>
 *   ),
 *   children: [...]
 * }
 *
 * DEPENDENCY:
 * - Must be used within AuthProvider's component tree
 * - Calls useAuth which throws if AuthProvider not found
 *
 * ERROR HANDLING:
 * - useAuth throws descriptive error if called outside AuthProvider
 * - Prevents route access before auth is loaded (use loading state)
 * - Navigation to /login uses replace: true (prevents back button issues)
 *
 * ============================================================================
 */

import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * ProtectedRoute Component
 *
 * RESPONSIBILITY:
 * - Enforce authentication requirement for wrapped routes
 * - Redirect unauthorized users to login
 * - Allow authenticated users through to protected content
 *
 * ACCESS CONTROL LOGIC:
 * - Check user state from AuthContext
 * - No user → Redirect to /login
 * - User exists → Render children
 *
 * NOTE:
 * - Does NOT check loading state (see App.tsx for loading handling)
 * - App.tsx shows spinner while loading is true
 * - By the time loading becomes false, ProtectedRoute can safely check user
 *
 * @param children - React components to render if authenticated
 * @returns Navigate component (redirect) or children
 */
const ProtectedRoute = ({
  children,
}: ProtectedRouteProps): React.ReactElement => {
  // Get current user from auth context
  const { user } = useAuth();

  // Redirect unauthenticated users to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Render protected content for authenticated users
  return <>{children}</>;
};

export default ProtectedRoute;
