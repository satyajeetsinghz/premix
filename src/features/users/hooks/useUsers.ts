/**
 * @fileoverview Hook for real-time subscription to all users in the Firestore users collection.
 *
 * Responsibilities:
 * - Subscribe to real-time updates of the entire users collection
 * - Transform Firestore documents to IUser objects with uid field
 * - Provide loading state during initial subscription
 * - Clean up subscription on component unmount
 *
 * Related modules:
 * - UserManagementPage (src/features/users/pages/UserManagementPage.tsx) - Uses this hook for admin user list
 * - AdminPanel (src/features/admin/pages/AdminPage.tsx) - Users tab uses this via UserManagementPage
 *
 * Architectural role:
 * - **Real-time data provider** for admin user management
 * - Provides all users in the system for admin operations
 * - Updates in real-time when users are created, updated, or deleted
 *
 * Firestore data model (from HANDOFF_CORE.md):
 * - Collection: /users/{uid}
 * - Document fields: uid, name, email, photoURL, role, status, createdAt, lastLoginAt
 *
 * Security boundary (from Firestore security rules):
 * - Read: isOwner(uid) OR isAdmin()
 * - Regular users can only read their own document
 * - Admin users (isActiveAdmin()) can read all documents in users collection
 *
 * Real-time behavior:
 * - onSnapshot triggers on initial load and on any document change
 * - New user registrations appear automatically
 * - Role/status updates from admin panel appear instantly
 *
 * Data transformation:
 * - Firestore document ID is stored as the 'uid' field
 * - Document data spread into the object
 * - This ensures uid is always present and matches the document ID
 *
 * Performance:
 * - Subscribes to entire users collection (could be large)
 * - For large user bases (>1000), consider pagination or limiting
 * - Admin-only hook (only admins can access this data)
 *
 * @module features/users/hooks
 */

import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/services/firebase/config";
import { IUser } from "../types";

/**
 * Return type for useUsers hook.
 *
 * @property users - Array of all users from Firestore (admin only)
 * @property loading - True while initial subscription is establishing
 */
interface UseUsersReturn {
  users: IUser[];
  loading: boolean;
}

/**
 * useUsers - Hook for real-time subscription to all users (admin only).
 *
 * @returns Object containing users array and loading state
 *
 * @example
 * ```tsx
 * const { users, loading } = useUsers();
 *
 * if (loading) return <Spinner />;
 * return users.map(user => <UserRow key={user.uid} user={user} />);
 * ```
 */
export const useUsers = (): UseUsersReturn => {
  /**
   * State for storing all users fetched from Firestore.
   * Initialized as empty array.
   */
  const [users, setUsers] = useState<IUser[]>([]);

  /**
   * Loading state - true until the first snapshot arrives from Firestore.
   * Used to show loading indicators while initial data is being fetched.
   */
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    /**
     * Real-time subscription to users collection.
     * onSnapshot provides three key benefits:
     * 1. Initial data load (fires immediately)
     * 2. Real-time updates on any document change (add, update, delete)
     * 3. Automatic cleanup via returned unsubscribe function
     *
     * The callback receives a QuerySnapshot containing all documents
     * in the users collection (no filtering).
     */
    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
      /**
       * Transform Firestore documents to IUser objects.
       *
       * Mapping steps:
       * 1. snapshot.docs: Array of QueryDocumentSnapshot objects
       * 2. .map(): Transform each document
       *    - doc.id: Firestore document ID (user UID)
       *    - doc.data(): Document fields (name, email, role, status, etc.)
       * 3. Combine: { ...doc.data(), uid: doc.id }
       *    - Spread document data first, then add uid (ensures uid exists)
       */
      const data = snapshot.docs.map((doc) => ({
        ...(doc.data() as IUser), // Spread Firestore fields
        uid: doc.id, // Document ID is the user's UID
      }));

      // Update state with users array
      setUsers(data);

      // Mark loading as complete (first snapshot has arrived)
      setLoading(false);
    });

    /**
     * Cleanup function: Unsubscribe from Firestore listener when component unmounts.
     *
     * Why is this important?
     * - Prevents memory leaks from lingering subscriptions
     * - Stops unnecessary network activity when component is no longer in use
     * - React strict mode will call this on unmount and remount
     */
    return () => unsubscribe();
  }, []); // Empty dependency array: subscribe once on component mount

  return { users, loading };
};