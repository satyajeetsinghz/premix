/**
 * @fileoverview Hook for real-time subscription to the current authenticated user's Firestore document.
 *
 * Responsibilities:
 * - Subscribe to real-time updates of the current user's Firestore document
 * - Provide user data (IUser) with role, status, name, email, etc.
 * - Handle loading state during subscription establishment
 * - Clean up subscription on unmount or when auth user changes
 *
 * Related modules:
 * - useAuth (src/features/auth/hooks/useAuth.ts) - Provides Firebase Auth user (uid, email, etc.)
 * - SuspensionContext (src/context/SuspensionContextCore.tsx) - Uses this to determine suspension status
 * - ProfilePage (src/features/profile/ProfilePage.tsx) - Uses this for profile data (via useProfile)
 * - UserManagementPage (src/features/users/pages/UserManagementPage.tsx) - Admin view of users
 *
 * Architectural role:
 * - **Real-time bridge** between Firebase Auth and Firestore user document
 * - Provides reactive user data that updates when role/status changes (admin actions)
 * - Single source of truth for current user's Firestore data across the app
 *
 * Firestore data model (from HANDOFF_CORE.md):
 * - Document path: /users/{uid}
 * - Document fields: uid, name, email, photoURL, role, status, createdAt, lastLoginAt
 *
 * Real-time behavior:
 * - onSnapshot subscribes to /users/{authUser.uid}
 * - Fires immediately on mount with current data
 * - Fires again when document changes (role/status update from admin panel)
 * - SuspensionContext uses this to detect status changes and show/hide suspension UI
 *
 * Security boundary (from Firestore security rules):
 * - Read: isOwner(uid) OR isAdmin()
 * - Users can only read their own document (unless admin)
 *
 * Status updates:
 * - When admin changes user.status to "suspended" or "banned"
 * - onSnapshot triggers, SuspensionContext re-evaluates, shows appropriate screen
 *
 * @module features/users/hooks
 */

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/services/firebase/config";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { IUser } from "../types";

/**
 * Return type for useCurrentUser hook.
 *
 * @property user - Current user's Firestore document data (null if not authenticated or document missing)
 * @property loading - True while initial subscription is establishing
 */
interface UseCurrentUserReturn {
  user: IUser | null;
  loading: boolean;
}

/**
 * useCurrentUser - Hook for real-time subscription to current user's Firestore document.
 *
 * @returns Object containing user data and loading state
 *
 * @example
 * ```tsx
 * const { user, loading } = useCurrentUser();
 *
 * if (loading) return <Spinner />;
 * if (!user) return <div>User not found</div>;
 * return <div>Welcome, {user.name}! Role: {user.role}</div>;
 * ```
 */
export const useCurrentUser = (): UseCurrentUserReturn => {
  const { user: authUser } = useAuth();

  const [user, setUser] = useState<IUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    /**
     * No authenticated user: reset state and return early.
     * This handles logout scenarios.
     */
    if (!authUser) {
      setUser(null);
      setLoading(false);
      return;
    }

    /**
     * Reference to user document in Firestore.
     * Path: /users/{authUser.uid}
     */
    const userRef = doc(db, "users", authUser.uid);

    /**
     * Real-time subscription to user document.
     * onSnapshot provides:
     * 1. Initial data load
     * 2. Real-time updates when document changes (role/status updates)
     * 3. Automatic cleanup via returned unsubscribe function
     *
     * The callback receives a DocumentSnapshot containing the user data
     * if the document exists, or empty snapshot if not.
     */
    const unsubscribe = onSnapshot(userRef, (snapshot) => {
      if (snapshot.exists()) {
        // Document exists: populate user state with Firestore data
        setUser(snapshot.data() as IUser);
      } else {
        // Document doesn't exist (shouldn't happen for authenticated users,
        // as createUserIfNotExists creates it on sign-in)
        setUser(null);
      }

      // Mark loading as complete (first snapshot has arrived)
      setLoading(false);
    });

    /**
     * Cleanup: Unsubscribe from Firestore listener when:
     * - Component unmounts
     * - authUser changes (user logs out/in)
     *
     * Prevents memory leaks and stale subscriptions.
     */
    return () => unsubscribe();
  }, [authUser]); // Re-run effect when authUser changes

  return { user, loading };
};