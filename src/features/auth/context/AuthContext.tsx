/**
 * ============================================================================
 * BEATSTREAM - Authentication Provider
 * ============================================================================
 * File: features/auth/context/AuthContext.tsx
 *
 * ARCHITECTURE OVERVIEW:
 * - React Context Provider for authentication state management
 * - Integrates Firebase Authentication for user login/logout
 * - Manages user session persistence and profile hydration
 * - Implements last login timestamp tracking for user analytics
 *
 * AUTHENTICATION FLOW:
 * 1. Provider mounts → onAuthStateChanged listener is registered
 * 2. Firebase Auth service returns current user (or null)
 * 3. If user exists: createUserIfNotExists creates/retrieves user record from Firestore
 * 4. Update lastLoginAt timestamp in Firestore for analytics
 * 5. Set loading=false and expose user state to children
 * 6. On logout: setUser(null) and loading=false
 *
 * FIREBASE INTEGRATION:
 * - auth: Firebase Auth instance (handles login/logout/session)
 * - db: Firestore database instance (stores user profiles)
 * - onAuthStateChanged: Real-time listener for auth state changes
 * - updateDoc: Updates lastLoginAt timestamp in users collection
 * - serverTimestamp: Ensures timestamp consistency across servers
 *
 * STATE MANAGEMENT:
 * - user: IUser | null - Current authenticated user from Firestore
 * - loading: boolean - Indicates auth state is being resolved
 *
 * DATA FLOW:
 * 1. App mounts → AuthProvider initialization
 * 2. Firebase auth state listener triggered
 * 3. Firebase user → IUser conversion via createUserIfNotExists
 * 4. User state available to entire app via AuthContext
 * 5. All pages/components access user via useAuth hook
 *
 * ERROR HANDLING:
 * - Auth state errors logged but don't crash the app
 * - Failed lastLoginAt updates are logged as debug (non-blocking)
 * - Errors during createUserIfNotExists are caught, user set to null
 * - useAuth consumers should handle null user gracefully
 *
 * PERFORMANCE NOTES:
 * - onAuthStateChanged is fired once per auth state change (efficient)
 * - Listener is unsubscribed on component unmount (prevents memory leaks)
 * - lastLoginAt update is non-blocking (doesn't delay app load)
 * - User data is fetched once during auth resolution
 *
 * FUTURE SCALABILITY:
 * - Consider caching user profile to reduce Firestore reads
 * - Could add profile refresh mechanism if data becomes stale
 * - May need to add error boundary for auth failures
 * - Consider adding auth state persistence strategies
 *
 * ============================================================================
 */

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth } from "@/services/firebase/config";
import { db } from "@/services/firebase/config";
import { createUserIfNotExists } from "../services/user.service";
import { IUser } from "../types";
import { AuthContext } from "./AuthContextCore";

interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * Helper function to update the lastLoginAt timestamp
 * Used for tracking user login frequency and engagement
 *
 * FIREBASE OPERATION:
 * - Updates users/{uid} document with serverTimestamp
 * - Uses serverTimestamp to ensure accurate server-side timestamp
 * - Non-blocking: errors are logged as debug, not critical
 *
 * @param uid - Firebase user ID
 * @returns Promise that resolves when update is complete
 */
const updateLastLoginTimestamp = async (uid: string): Promise<void> => {
  try {
    await updateDoc(doc(db, "users", uid), {
      lastLoginAt: serverTimestamp(),
    });
  } catch (error) {
    // Non-critical error: timestamp tracking failure doesn't prevent app usage
    console.debug("Failed to update lastLoginAt timestamp", error);
  }
};

/**
 * AuthProvider Component
 *
 * RESPONSIBILITY:
 * - Initialize Firebase auth listener on mount
 * - Manage auth state (user, loading)
 * - Convert Firebase user to IUser application model
 * - Provide auth state to entire app via Context
 * - Track user logins for analytics
 *
 * STATE:
 * - user: IUser | null - Authenticated user object or null
 * - loading: boolean - True while auth state is being resolved
 *
 * LIFECYCLE:
 * 1. Component mounts
 * 2. useEffect registers onAuthStateChanged listener
 * 3. Firebase returns current auth state
 * 4. If user: fetch full profile from Firestore and update login time
 * 5. Set loading=false to indicate ready
 * 6. Listener cleanup on unmount
 *
 * @param children - React components to provide auth context to
 * @returns Provider component that wraps children with auth state
 */
export const AuthProvider = ({
  children,
}: AuthProviderProps): React.ReactElement => {
  // State for authenticated user from Firestore
  const [user, setUser] = useState<IUser | null>(null);

  // State for auth resolution loading indicator
  const [loading, setLoading] = useState(true);

  /**
   * Authentication State Listener
   *
   * Sets up Firebase auth listener that fires on:
   * - Initial provider mount (checks for existing session)
   * - User login (Firebase auth succeeds)
   * - User logout (Firebase auth clears)
   * - Session expiration
   *
   * Process:
   * 1. Listen for Firebase auth changes
   * 2. If user logged in:
   *    a. Create/retrieve user profile from Firestore
   *    b. Update lastLoginAt timestamp for analytics
   *    c. Set user state and loading=false
   * 3. If user logged out:
   *    a. Set user=null and loading=false
   * 4. On error: log and set user=null (fail gracefully)
   * 5. Cleanup: unsubscribe listener on unmount
   */
  useEffect(() => {
    // Register real-time listener for Firebase auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // User is authenticated: fetch or create Firestore profile
          const appUser = await createUserIfNotExists(firebaseUser);

          // Update user's last login timestamp for engagement tracking
          await updateLastLoginTimestamp(firebaseUser.uid);

          // Update app state with user data
          setUser(appUser);
        } else {
          // User is not authenticated
          setUser(null);
        }
      } catch (error) {
        // Handle auth state resolution errors gracefully
        console.error("Error resolving auth state:", error);
        setUser(null);
      } finally {
        // Mark auth resolution as complete
        setLoading(false);
      }
    });

    // Cleanup listener on unmount to prevent memory leaks
    return () => unsubscribe();
  }, []);

  // Provide auth state to all child components
  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
