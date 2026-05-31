/**
 * @fileoverview Firestore service for user profile read and update operations.
 *
 * Responsibilities:
 * - Fetch user profile document from Firestore by UID
 * - Update user profile fields (display name, photo URL)
 *
 * Related modules:
 * - useProfile (src/features/profile/hooks/useProfile.ts) - Consumes these functions
 * - EditProfileModal (src/features/profile/components/EditProfileModal.tsx) - Triggers profile updates
 *
 * Architectural role:
 * - **Profile data persistence layer** for user account management
 * - Simple CRUD operations on /users/{uid} Firestore documents
 * - No real-time subscriptions (one-time read/write)
 *
 * Firestore data model (from HANDOFF_CORE.md):
 * - Collection: /users/{uid}
 * - Document fields: uid, name, email, photoURL, role, status, createdAt, lastLoginAt
 *
 * Security boundary (from Firestore security rules):
 * - Read: isOwner(uid) OR isAdmin()
 * - Update: isOwner(uid) AND isWriteable() AND onlyChanges(['name', 'email', 'photoURL'])
 * - Email updates not actually supported here (only displayName and photoURL)
 *
 * Update limitations:
 * - Only displayName and photoURL can be updated
 * - Email changes would require Firebase Auth update (not supported in this service)
 * - Role and status changes are admin-only (handled separately in user management)
 *
 * @module features/profile/services
 */

import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/services/firebase/config";

/**
 * Fetches user profile document from Firestore.
 *
 * @param uid - User ID (Firebase Auth UID)
 * @returns User profile data object or null if document doesn't exist
 *
 * @example
 * ```tsx
 * const profile = await getUserProfile(user.uid);
 * console.log(profile.name, profile.email);
 * ```
 */
export const getUserProfile = async (uid: string) => {
  const docRef = doc(db, "users", uid);
  const snap = await getDoc(docRef);

  if (!snap.exists()) return null;

  return snap.data();
};

/**
 * Updates user profile fields in Firestore.
 *
 * Allowed fields (per Firestore security rules):
 * - displayName: maps to 'name' field in Firestore
 * - photoURL: profile image URL from Cloudinary
 *
 * Note: Email updates are not supported here.
 * Users would need to change email via Firebase Auth directly.
 *
 * @param uid - User ID (Firebase Auth UID)
 * @param data - Object containing displayName and/or photoURL
 *
 * @example
 * ```tsx
 * await updateUserProfile(user.uid, {
 *   displayName: "New Name",
 *   photoURL: "https://cloudinary.com/.../avatar.jpg"
 * });
 * ```
 */
export const updateUserProfile = async (
  uid: string,
  data: { displayName?: string; photoURL?: string },
) => {
  const docRef = doc(db, "users", uid);
  await updateDoc(docRef, data);
};