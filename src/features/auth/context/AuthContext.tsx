/**
 * @fileoverview Authentication provider that syncs Firebase Auth with Firestore user data.
 *
 * Responsibilities:
 * - Listen to Firebase Auth state changes (login/logout)
 * - Ensure Firestore user document exists via createUserIfNotExists
 * - Subscribe to real-time Firestore user document updates
 * - Enforce access control: sign out banned users immediately
 * - Provide user state and loading status to child components
 *
 * Related modules:
 * - user.service.ts - Creates Firestore user document on first sign-in
 * - useAuth.ts (src/features/auth/hooks/useAuth.ts) - Consumer hook for auth state
 * - SuspensionContext - Consumes user.status to show suspension UI
 *
 * Architectural role:
 * - **Root authentication provider** - wraps entire app in App.tsx
 * - Single source of truth for authentication state
 * - Real-time sync between Firebase Auth and Firestore user data
 *
 * Security enforcement (from HANDOFF_CORE.md):
 * - Banned users: Immediately signed out via signOut(auth)
 * - Suspended users: Remain authenticated but UI shows read-only mode
 * - Active users: Full access
 *
 * Real-time behavior:
 * - onAuthStateChanged: Handles login/logout events
 * - onSnapshot: Subscribes to /users/{uid} for real-time updates
 * - Role/status changes from admin panel reflect instantly
 *
 * Auth flow:
 * 1. Firebase Auth state changes (user logs in/out)
 * 2. If logged in: create Firestore user document if missing
 * 3. Update lastLoginAt timestamp
 * 4. Subscribe to real-time user document updates
 * 5. Enforce status: banned → immediate sign out
 * 6. Provide user data to AuthContext consumers
 *
 * Error handling:
 * - Console.error for critical failures
 * - Console.debug for non-critical (lastLoginAt update)
 * - Graceful fallback: set user to null on errors
 *
 * @module features/auth/context
 */

import { useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

import {
  doc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";

import { auth, db } from "@/services/firebase/config";

import { createUserIfNotExists } from "../services/user.service";
import { IUser } from "../types";
import { AuthContext } from "./AuthContextCore";

/**
 * Props for the AuthProvider component.
 *
 * @property children - React child components to be wrapped by the provider
 */
interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * Updates the user's last login timestamp in Firestore.
 *
 * Called after successful authentication to track user activity.
 * Used in admin User Management page (lastLoginAt column).
 *
 * Why console.debug instead of console.error?
 * - This update is non-critical for authentication flow
 * - Failure should not prevent user from accessing the app
 * - Debugs help with troubleshooting without spamming production logs
 *
 * @param uid - User ID (Firebase Auth UID)
 * @returns Promise that resolves when update completes (silent failure on error)
 */
const updateLastLoginTimestamp = async (
  uid: string,
): Promise<void> => {
  try {
    await updateDoc(doc(db, "users", uid), {
      lastLoginAt: serverTimestamp(),
    });
  } catch (error) {
    console.debug(
      "[AuthContext] Failed to update lastLoginAt",
      error,
    );
  }
};

/**
 * AuthProvider - Root authentication provider for BeatStream.
 *
 * Provider hierarchy placement (from App.tsx):
 * ```
 * App
 * └── AuthProvider
 *     └── PlayerProvider
 *         └── SuspensionProvider
 *             └── AppContent
 * ```
 *
 * AuthProvider must be outermost because other providers depend on user data.
 *
 * State management:
 * - user: Current authenticated user's Firestore data (IUser | null)
 * - loading: True while auth state is being determined (initial load)
 *
 * Real-time subscriptions:
 * 1. onAuthStateChanged - Firebase Auth state (login/logout)
 * 2. onSnapshot - Firestore user document (role/status changes)
 *
 * Cleanup:
 * - Unsubscribes from both listeners on unmount
 * - Prevents memory leaks and stale subscriptions
 *
 * @param props - AuthProviderProps
 * @returns AuthContext provider with user and loading state
 */
export const AuthProvider = ({
  children,
}: AuthProviderProps): React.ReactElement => {
  /**
   * Current authenticated user's Firestore data.
   * Null when user is not authenticated or banned.
   */
  const [user, setUser] = useState<IUser | null>(null);

  /**
   * Loading state - true during initial auth resolution.
   * AppContent shows AnimatedSpinner while loading = true.
   */
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    /**
     * Reference to Firestore user document snapshot unsubscribe function.
     * Stored in variable to properly clean up when auth state changes.
     */
    let unsubscribeUserSnapshot:
      | (() => void)
      | undefined;

    /**
     * Firebase Auth state listener.
     * Fires on:
     * - App initial load (checks existing session)
     * - User signs in
     * - User signs out
     */
    const unsubscribeAuth = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        try {
          /**
           * Scenario 1: User is logged out
           */
          if (!firebaseUser) {
            // Clean up existing Firestore listener if any
            if (unsubscribeUserSnapshot) {
              unsubscribeUserSnapshot();
              unsubscribeUserSnapshot = undefined;
            }

            setUser(null);
            setLoading(false);
            return;
          }

          /**
           * Scenario 2: User is logged in
           *
           * Steps:
           * 1. Create Firestore user document if it doesn't exist
           * 2. Update lastLoginAt timestamp (non-critical)
           * 3. Subscribe to real-time user document updates
           */

          // Step 1: Ensure Firestore user document exists
          await createUserIfNotExists(
            firebaseUser,
          );

          // Step 2: Update login analytics (non-critical, silent failure)
          await updateLastLoginTimestamp(
            firebaseUser.uid,
          );

          const userRef = doc(
            db,
            "users",
            firebaseUser.uid,
          );

          /**
           * Step 3: Real-time Firestore listener
           *
           * This subscription ensures:
           * - Role changes (user ↔ admin) reflect instantly
           * - Status changes (suspended) reflect instantly
           * - Profile updates (name/photo) reflect instantly
           * - No page refresh needed for admin actions
           *
           * Security enforcement:
           * - Banned users are immediately signed out
           * - Suspended users remain authenticated but UI shows limited mode
           */
          unsubscribeUserSnapshot =
            onSnapshot(
              userRef,
              async (snapshot) => {
                try {
                  // Document missing (should not happen for authenticated user)
                  if (!snapshot.exists()) {
                    console.warn(
                      "[AuthContext] User document missing",
                    );

                    setUser(null);
                    return;
                  }

                  const latestUser =
                    snapshot.data() as IUser;

                  /**
                   * Banned user enforcement.
                   *
                   * When admin sets status = "banned":
                   * 1. This listener detects the change
                   * 2. Immediately signs out the user
                   * 3. Clears user state
                   * 4. User sees BlockedUserScreen on next render
                   */
                  if (
                    latestUser.status ===
                    "banned"
                  ) {
                    console.warn(
                      "[AuthContext] User banned. Signing out.",
                    );

                    await signOut(auth);

                    setUser(null);
                    return;
                  }

                  /**
                   * Suspended user warning.
                   *
                   * User remains authenticated but:
                   * - Firestore security rules block writes (isWriteable() = false)
                   * - SuspensionContext shows limited mode UI
                   * - Write attempts trigger toast notifications
                   */
                  if (
                    latestUser.status ===
                    "suspended"
                  ) {
                    console.warn(
                      "[AuthContext] User suspended.",
                    );
                  }

                  // Update state with latest user data
                  setUser(latestUser);
                  setLoading(false);
                } catch (error) {
                  console.error(
                    "[AuthContext] Snapshot processing error",
                    error,
                  );

                  // Fallback: clear user state on error
                  setUser(null);
                  setLoading(false);
                }
              },
              (error) => {
                console.error(
                  "[AuthContext] User listener error",
                  error,
                );

                // Fallback: clear user state on listener error
                setUser(null);
                setLoading(false);
              },
            );
        } catch (error) {
          console.error(
            "Error resolving auth state:",
            error,
          );

          // Fallback: clear user state on any error
          setUser(null);
          setLoading(false);
        }
      },
    );

    /**
     * Cleanup function.
     *
     * Unsubscribes from both:
     * 1. Firebase Auth state listener
     * 2. Firestore user document listener (if active)
     *
     * Prevents memory leaks when AuthProvider unmounts.
     */
    return () => {
      unsubscribeAuth();

      if (unsubscribeUserSnapshot) {
        unsubscribeUserSnapshot();
      }
    };
  }, []); // Empty dependency array: run once on mount

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};