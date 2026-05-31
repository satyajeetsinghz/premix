/**
 * @fileoverview Firestore service for admin user management operations.
 *
 * Responsibilities:
 * - Update user role (promote to admin / demote to user)
 * - Update user status (active / suspended / banned)
 * - Delete user account (deletes Firestore document only - Auth account remains)
 *
 * Related modules:
 * - UserActionsMenu (src/features/users/components/UserActionsMenu.tsx) - Calls these functions
 * - UserManagementPage (src/features/users/pages/UserManagementPage.tsx) - Parent component
 *
 * Architectural role:
 * - **Admin-only data mutation layer** for user management
 * - Works with Firestore users collection: /users/{uid}
 * - Security rules enforce isActiveAdmin() for these operations
 *
 * Security boundary (from Firestore security rules):
 * - Update: isActiveAdmin() AND isUnchanged('uid') AND isUnchanged('createdAt')
 * - Delete: isActiveAdmin()
 * - Regular users cannot modify other users (isOwner(uid) only allows their own document)
 *
 * Role updates:
 * - "admin": Grants full administrative access (admin panel, user management)
 * - "user": Standard user with no admin privileges
 *
 * Status updates (from HANDOFF_CORE.md):
 * - "active": Full access (read + write) - normal operation
 * - "suspended": Read-only access (cannot write) - shows suspension UI
 * - "banned": No access (cannot read or write) - shows banned UI
 *
 * Delete operation:
 * - Deletes ONLY the Firestore user document
 * - Does NOT delete Firebase Authentication account
 * - Does NOT delete user's subcollections (likedSongs, history, playlists)
 * - For full deletion, additional cleanup would be needed
 *
 * Real-time behavior:
 * - After update/delete, onSnapshot in useUsers/useCurrentUser triggers UI updates
 * - SuspensionContext detects status changes and shows appropriate screen
 *
 * @module features/users/services
 */

import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/services/firebase/config";

/**
 * Updates a user's role (admin or user).
 *
 * Role effects:
 * - admin: Access to AdminPanel, user management, section management, etc.
 * - user: Standard user privileges only
 *
 * @param uid - User ID (Firebase Auth UID)
 * @param role - New role ("user" or "admin")
 * @returns Promise that resolves when update completes
 *
 * @example
 * ```tsx
 * // Promote user to admin
 * await updateUserRole("user123", "admin");
 *
 * // Demote admin to user
 * await updateUserRole("admin456", "user");
 * ```
 */
export const updateUserRole = async (uid: string, role: "user" | "admin"): Promise<void> => {
  await updateDoc(doc(db, "users", uid), {
    role,
  });
};

/**
 * Updates a user's account status.
 *
 * Status effects (from HANDOFF_CORE.md):
 * - active: Full access (read + write)
 * - suspended: Read-only access (browse only, no writes)
 * - banned: No access (cannot read or write)
 *
 * @param uid - User ID (Firebase Auth UID)
 * @param status - New status ("active", "suspended", or "banned")
 * @returns Promise that resolves when update completes
 *
 * @example
 * ```tsx
 * // Suspend a user (read-only access)
 * await updateUserStatus("user123", "suspended");
 *
 * // Ban a user (no access)
 * await updateUserStatus("user123", "banned");
 *
 * // Reactivate a user
 * await updateUserStatus("user123", "active");
 * ```
 */
export const updateUserStatus = async (
  uid: string,
  status: "active" | "banned" | "suspended",
): Promise<void> => {
  await updateDoc(doc(db, "users", uid), {
    status,
  });
};

/**
 * Deletes a user's Firestore document.
 *
 * IMPORTANT LIMITATIONS:
 * - Does NOT delete the Firebase Authentication account
 * - Does NOT delete user's subcollections (likedSongs, history, playlists)
 * - User will still be able to sign in (Auth account still exists)
 * - On next sign-in, createUserIfNotExists will recreate the user document
 *
 * For complete user removal:
 * - Should also delete Auth account (requires Firebase Admin SDK or Cloud Function)
 * - Should also delete subcollections (likedSongs, history, playlists)
 *
 * @param uid - User ID (Firebase Auth UID)
 * @returns Promise that resolves when deletion completes
 *
 * @example
 * ```tsx
 * // Delete user document from Firestore
 * await deleteUser("user123");
 * ```
 */
export const deleteUser = async (uid: string): Promise<void> => {
  await deleteDoc(doc(db, "users", uid));
};