/**
 * ============================================================================
 * Premix - Application Router Configuration
 * ============================================================================
 * File: app/router.tsx
 *
 * ARCHITECTURE OVERVIEW:
 * - Centralized route configuration using React Router v6 Browser Router
 * - Defines public, protected, and admin routes with proper access control
 * - Implements route hierarchy with MainLayout as the primary layout container
 *
 * ROUTE STRUCTURE:
 * - "/" (protected) - MainLayout (main app container)
 *   - "/" (index) - HomePage
 *   - "/search" - Search Page (placeholder)
 *   - "/library" - LibraryPage (user's library)
 *   - "/liked" - LikedSongs (user's liked tracks)
 *   - "/profile" - ProfilePage (user profile)
 *   - "/playlist/:id" - PlaylistPage (individual playlist)
 * - "/login" (public) - LoginPage
 * - "/admin" (admin-protected) - AdminPage
 *
 * AUTHENTICATION INTEGRATION:
 * - PublicRoute: Redirects authenticated users away from login
 * - ProtectedRoute: Guards private routes, requires valid user session
 * - ProtectedAdminRoute: Guards admin routes, requires admin privileges
 * - Uses useAuth hook for user state validation
 *
 * DATA FLOW:
 * 1. Router receives request
 * 2. Route guards check user authentication/authorization status
 * 3. Appropriate component/layout renders
 * 4. User interaction triggers navigation via useNavigate()
 *
 * STATE MANAGEMENT:
 * - Authentication state managed by AuthContext
 * - Route state managed by React Router (URL, history)
 * - Guard components access auth state via useAuth hook
 *
 * ERROR HANDLING:
 * - Unauthorized access attempts redirect to login or reject navigation
 * - Search route is currently stubbed (empty string element)
 * - Param validation: :id in playlist route validated by PlaylistPage
 *
 * PERFORMANCE NOTES:
 * - Route definitions are static and evaluated at app startup
 * - Browser Router uses client-side routing (no server requests for navigation)
 * - Lazy loading can be added later with React.lazy() if route tree grows
 *
 * FUTURE SCALABILITY:
 * - Consider lazy loading route components: React.lazy(() => import(...))
 * - Consider route prefetching for frequently visited pages
 * - Add route-level code splitting for bundle size optimization
 * - Monitor route transitions for performance bottlenecks (especially /playlist/:id)
 *
 * ============================================================================
 */

import { createBrowserRouter, Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth/hooks/useAuth";
import ProtectedRoute from "@/features/auth/components/ProtectedRoute";
import ProtectedAdminRoute from "@/features/admin/components/ProtectedAdminRoute";
import MainLayout from "@/components/layout/MainLayout";
import LoginPage from "@/features/auth/pages/LoginPage";
import HomePage from "@/features/home/pages/HomePage";
import ProfilePage from "@/features/profile/ProfilePage";
import LibraryPage from "@/components/LibraryPage";
import LikedSongs from "@/features/likes/pages/LikedSongs";
import PlaylistPage from "@/features/playlists/pages/PlaylistPage";

import AdminPage from "@/features/admin/pages/AdminPage";
import RouteErrorBoundary from "@/components/shared/RouterErrorBoundary";
// import TestingPage from "@/components/shared/TestingPage";

/**
 * PublicRoute Component
 *
 * RESPONSIBILITY:
 * - Guard for public routes (currently just login)
 * - Prevents authenticated users from accessing login page
 * - Redirects to home if user is already logged in
 *
 * AUTHENTICATION INTEGRATION:
 * - Accesses user state via useAuth hook
 * - Uses Navigate component to redirect authenticated users
 *
 * DATA FLOW:
 * 1. Component mounts
 * 2. Check if user exists in auth state
 * 3. If authenticated: redirect to "/" (home)
 * 4. If not authenticated: render children (login page)
 *
 * @param children - React component to render if user is not authenticated
 * @returns Navigate component (redirect) or children element
 */
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();

  // Redirect authenticated users away from public routes
  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

/**
 * Router Configuration
 *
 * Defines all application routes with proper access control guards.
 * Implements nested routing structure where MainLayout is the root layout
 * for all protected routes.
 *
 * ROUTE HIERARCHY:
 * - Root ("/") is protected and uses MainLayout
 * - All app features (home, library, playlists) are children of MainLayout
 * - Admin routes are completely separated at root level
 * - Login is public and unguarded
 */
const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    // Nested routes render within MainLayout's <Outlet />
    children: [
      {
        index: true,
        element: <HomePage />,
      },

      {
        path: "search",
        // TODO: Implement global search functionality
        element: "",
      },

      {
        path: "library",
        element: <LibraryPage />,
      },

      {
        path: "liked",
        element: <LikedSongs />,
      },

      {
        path: "profile",
        element: <ProfilePage />,
      },

      {
        path: "playlist/:id",
        element: <PlaylistPage />,
      },
    ],
  },

  {
    path: "/login",
    element: (
      <PublicRoute>
        <LoginPage />
      </PublicRoute>
    ),
  },

  {
    path: "/admin",
    element: (
      <ProtectedAdminRoute>
        <AdminPage />
      </ProtectedAdminRoute>
    ),
  },
  {
    path: "*", element: <RouteErrorBoundary />, // explicit 404 catch-all
  }
]);

export default router;
