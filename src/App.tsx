/**
 * ============================================================================
 * BEATSTREAM - Root Application Component
 * ============================================================================
 * File: App.tsx
 *
 * ARCHITECTURE OVERVIEW:
 * - Root component that sets up the provider tree for the entire application
 * - Implements the "AppContent" pattern to separate provider setup from content logic
 * - Manages initial app state checks: authentication, suspension status, and user bans
 *
 * PROVIDER HIERARCHY:
 * App (root)
 *   ├─ AuthProvider (auth state, login/logout)
 *   ├─ PlayerProvider (music player state, playback)
 *   ├─ SuspensionProvider (user suspension state)
 *   └─ AppContent (conditional rendering based on auth/suspension state)
 *
 * AUTHENTICATION FLOW:
 * 1. AuthProvider initializes Firebase auth and loads user session
 * 2. AppContent component waits for auth.loading to be false
 * 3. User status is checked: banned → BlockedUserScreen
 * 4. Suspension status is checked: suspended/not-acknowledged → SuspendedScreen
 * 5. If loading: show AnimatedSpinner (BeatStream branding)
 * 6. If all checks pass: render RouterProvider with app routes
 *
 * COMPONENT RESPONSIBILITIES:
 * - App: Provide global state context to entire application
 * - AppContent: Handle conditional rendering based on app state
 * - useAuth hook: Access authentication state (user, loading)
 * - useSuspension hook: Access suspension state (isSuspended, hasAcknowledged)
 *
 * DATA FLOW:
 * 1. App mounts → AuthProvider initializes Firebase auth
 * 2. Firebase auth state listener triggers user session load
 * 3. useAuth hook returns updated (user, loading) state
 * 4. AppContent re-renders with new state
 * 5. Conditional logic determines which screen to render
 * 6. User navigates through RouterProvider (when auth is complete)
 *
 * STATE MANAGEMENT:
 * - Authentication state: Provided by AuthContext (Firebase-backed)
 * - Suspension state: Provided by SuspensionContext
 * - Player state: Provided by PlayerProvider (independent of auth)
 * - Routing state: Provided by React Router (URL-based)
 *
 * ERROR HANDLING:
 * - Banned users are immediately blocked from the app
 * - Suspended users must acknowledge the suspension before using the app
 * - Loading state provides user feedback during auth initialization
 * - Firebase auth errors should be handled in AuthContext (not here)
 *
 * PERFORMANCE NOTES:
 * - AppContent is memoized implicitly (no unnecessary re-renders)
 * - Provider tree is initialized once at app startup
 * - Loading state prevents flash of unstyled content (FOUC)
 * - Conditional rendering avoids mounting unnecessary components
 *
 * FUTURE SCALABILITY:
 * - Consider adding error boundary wrapper for better error handling
 * - Could add theme provider if dark/light mode switching is needed
 * - May need to add toast/notification provider as app grows
 * - Consider analytics provider for tracking user behavior
 *
 * ============================================================================
 */

import { RouterProvider } from "react-router-dom";
import router from "@/app/router";
import { AuthProvider } from "@/features/auth/context/AuthContext";
import { PlayerProvider } from "./features/player/context/PlayerContext";
import { SuspensionProvider } from "@/context/SuspensionContext";
import { useSuspension } from "@/context/useSuspension";
import AnimatedSpinner from "./components/ui/LoadingSpinner/AnimatedSpinner";
import BlockedUserScreen from "./components/common/BlockedUserScreen";
import SuspendedScreen from "./components/common/SuspendedScreen";
import SuspensionBanner from "./components/common/SuspensionBanner";

import { useAuth } from "@/features/auth/hooks/useAuth";

/**
 * AppContent Component
 *
 * RESPONSIBILITY:
 * - Conditional rendering based on authentication, suspension, and loading states
 * - Acts as the main content dispatcher for the application
 * - Enforces access control before rendering the router
 *
 * STATE LOGIC:
 * 1. Banned users: Show BlockedUserScreen (highest priority)
 * 2. Suspended (not acknowledged): Show SuspendedScreen (must accept first)
 * 3. Loading: Show AnimatedSpinner (auth state not ready)
 * 4. Normal state:
 *    - If suspended but acknowledged: Show SuspensionBanner above router
 *    - Render RouterProvider with all app routes
 *
 * AUTHENTICATION INTEGRATION:
 * - useAuth: Gets user object and loading state from AuthContext
 * - useSuspension: Gets suspension status and acknowledgment state
 * - Validates user.status === "banned" to determine if user is blocked
 *
 * ERROR HANDLING:
 * - Banned users cannot access any part of the app
 * - Suspended users can access the app but see a warning banner
 * - If loading takes too long, user sees spinner indefinitely
 *   (Consider adding a timeout in AuthContext for failed auth scenarios)
 *
 * PERFORMANCE NOTES:
 * - Component re-renders only when auth/suspension state changes
 * - Conditional rendering prevents mounting of unnecessary components
 * - Loading spinner animation is lightweight (CSS/SVG)
 *
 * @returns JSX element based on app state
 */
const AppContent = () => {
  // Retrieve authentication state from AuthContext
  const { user, loading } = useAuth();

  // Retrieve suspension state from SuspensionContext
  const { isSuspended, hasAcknowledged } = useSuspension();

  // Priority 1: Check if user is banned
  if (user?.status === "banned") {
    return <BlockedUserScreen />;
  }

  // Priority 2: Check if user is suspended and hasn't acknowledged
  if (isSuspended && !hasAcknowledged) {
    return <SuspendedScreen />;
  }

  // Priority 3: Show loading state while authentication is in progress
  if (loading) {
    return (
      <div className="h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          {/* Animated spinner with BeatStream brand color (red #fa243c) */}
          <AnimatedSpinner size={28} color="#fa243c" />
          <p className="text-sm text-gray-400 font-medium">BeatStream Beta</p>
        </div>
      </div>
    );
  }

  // Priority 4: Render main app with router
  return (
    <>
      {/* Show suspension banner if user is suspended but acknowledged */}
      {isSuspended && hasAcknowledged && (
        <>
          <SuspensionBanner />
        </>
      )}
      {/* Main router that handles navigation between all app pages */}
      <RouterProvider router={router} />
    </>
  );
};

/**
 * App Root Component
 *
 * RESPONSIBILITY:
 * - Provide global context providers to the entire application
 * - Set up the provider hierarchy in the correct order
 * - Integrate AppContent as the main content component
 *
 * PROVIDER ARCHITECTURE:
 * - AuthProvider (outermost): Manages Firebase authentication
 * - PlayerProvider: Manages music player state
 * - SuspensionProvider: Manages user suspension state
 * - AppContent: Uses all three contexts to determine what to render
 *
 * ORDER MATTERS:
 * - AuthProvider must be outermost (all other providers depend on knowing user)
 * - PlayerProvider and SuspensionProvider are independent
 * - AppContent consumes all contexts
 *
 * FIREBASE INTERACTION:
 * - AuthProvider initializes Firebase auth on mount
 * - Sets up real-time listener for auth state changes
 * - Loads user profile data from Firestore
 * - AuthContext provides hooks for login/logout/sign-up
 *
 * @returns JSX element with full provider tree
 */
function App() {
  return (
    <AuthProvider>
      <PlayerProvider>
        <SuspensionProvider>
          <AppContent />
        </SuspensionProvider>
      </PlayerProvider>
    </AuthProvider>
  );
}

export default App;
