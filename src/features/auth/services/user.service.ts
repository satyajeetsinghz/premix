/**
 * @fileoverview Firestore user document management for Google OAuth authentication.
 *
 * Responsibilities:
 * - Create user document in Firestore on first sign-in
 * - Retrieve existing user document on subsequent sign-ins
 * - Validate and sanitize Firebase Auth user data before storage
 * - Update user's last login timestamp after successful authentication
 * - Enforce data type constraints and field length limits
 *
 * Related modules:
 * - auth.service.ts (src/features/auth/services/auth.service.ts) - Calls createUserIfNotExists after Google sign-in
 * - useAuth.ts (src/features/auth/hooks/useAuth.ts) - Provides user data to React components
 * - Firestore users collection - Source of truth for user metadata
 *
 * Architectural role:
 * - **User document orchestration layer** between Firebase Auth and Firestore
 * - Ensures Firestore user document exists for every authenticated user
 * - Called immediately after successful Google sign-in
 *
 * Security considerations (from HANDOFF_CORE.md Firestore rules):
 * - Users can only create their own document (isOwner(uid) check)
 * - Role defaults to "user" - only admins can upgrade via admin panel
 * - Status defaults to "active" - can be suspended/banned via admin panel
 * - Security rules enforce: request.resource.data.uid == uid
 *
 * Firestore user document structure:
 * ```
 * /users/{uid}
 * {
 *   uid: string,                    // Matches Firebase Auth UID
 *   name: string,                   // Display name (max 255 chars)
 *   email: string,                  // Email address (max 255 chars)
 *   photoURL?: string,              // Avatar URL (max 1024 chars)
 *   role: "user" | "admin",        // Permission level
 *   status?: "active" | "suspended" | "banned",  // Account access level
 *   createdAt: Timestamp,           // Account creation timestamp
 *   lastLoginAt?: Timestamp         // Last sign-in timestamp
 * }
 * ```
 *
 * Data flow on sign-in:
 * 1. User signs in with Google → Firebase Auth returns user object
 * 2. Auth service calls createUserIfNotExists with Auth user data
 * 3. Function checks if user document exists in Firestore
 * 4. If exists: returns existing document (preserves role/status)
 * 5. If not exists: creates new document with default role/status
 * 6. Auth service calls updateLastLoginTimestamp to track activity
 *
 * Field constraints:
 * - name: 255 chars (truncated if longer) - most real names are under 100
 * - email: 255 chars (truncated if longer) - email standard max is 320
 * - photoURL: 1024 chars (truncated if longer) - Cloudinary URLs are typically 200-500 chars
 *
 * @module features/auth/services
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/services/firebase/config";
import { IUser } from "../types";

/**
 * Firebase Authentication user object structure.
 *
 * Subset of Firebase User object containing fields needed for Firestore.
 * Nullable fields represent optional data from Google OAuth profile.
 *
 * @property uid - Unique user identifier (same as Firestore document ID)
 * @property displayName - User's full name from Google profile (can be null)
 * @property email - User's email address from Google account (can be null)
 * @property photoURL - Profile picture URL from Google (can be null)
 */
interface FirebaseAuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

/**
 * User role type (matches IUser interface from HANDOFF_CORE.md).
 *
 * - user: Regular authenticated user (standard read/write permissions)
 * - admin: Administrator with full access to admin panel and user management
 */
type UserRole = "user" | "admin";

/**
 * User status type (matches IUser interface from HANDOFF_CORE.md).
 *
 * - active: Full access (read + write) - normal operation
 * - suspended: Read-only access (can browse, cannot write) - shows suspension UI
 * - banned: No access (cannot read or write) - shows blocked screen
 */
type UserStatus = "active" | "suspended" | "banned";

/**
 * Default role for new users.
 *
 * Per Firestore security rules: must be "user" on creation.
 * Admin role can only be assigned via admin panel (requires isActiveAdmin()).
 */
const DEFAULT_USER_ROLE: UserRole = "user";

/**
 * Default status for new users.
 *
 * Per security rules: can be "active" on creation.
 * New users start with full access until suspension/banned by admin.
 */
const DEFAULT_USER_STATUS: UserStatus = "active";

/**
 * Firestore users collection name.
 * Matches security rule pattern: /users/{uid}
 */
const USERS_COLLECTION = "users";

/**
 * Maximum field length constraints.
 *
 * Prevents excessively long strings from causing Firestore write failures.
 * Firestore document size limit is 1MB, but individual fields shouldn't
 * exceed these limits as a defensive measure.
 *
 * - name: 255 chars (most real names are under 100)
 * - email: 255 chars (email standard max length is 320)
 * - photoURL: 1024 chars (Cloudinary URLs are typically 200-500 chars)
 */
const MAX_FIELD_LENGTHS = {
  name: 255,
  email: 255,
  photoURL: 1024,
} as const;

/**
 * Type guard for FirebaseAuthUser.
 *
 * Validates that the user object has the required structure:
 * - uid: non-empty string
 * - displayName: string or null
 * - email: string or null
 * - photoURL: string or null
 *
 * Called before any Firestore operations to ensure data integrity.
 * Prevents malformed user objects from causing Firestore write errors.
 *
 * @param user - User object from Firebase Auth (sign-in response)
 * @returns True if user has valid structure for Firestore storage
 */
const isValidFirebaseUser = (
  user: unknown,
): user is FirebaseAuthUser => {
  if (!user || typeof user !== "object") {
    return false;
  }

  const userObj = user as Record<string, unknown>;

  return (
    typeof userObj.uid === "string" &&
    userObj.uid.length > 0 &&
    (userObj.displayName === null ||
      typeof userObj.displayName === "string") &&
    (userObj.email === null ||
      typeof userObj.email === "string") &&
    (userObj.photoURL === null ||
      typeof userObj.photoURL === "string")
  );
};

/**
 * Truncates a string to a maximum length.
 *
 * Prevents overly long strings from causing Firestore errors.
 * Safe truncation (does not break UTF-8 characters as substring preserves them).
 *
 * @param value - String to truncate
 * @param maxLength - Maximum allowed length
 * @returns Truncated string (or original if within limit)
 */
const truncateString = (
  value: string,
  maxLength: number,
): string => {
  return value.length > maxLength
    ? value.substring(0, maxLength)
    : value;
};

/**
 * Sanitizes Firebase Auth user data for Firestore storage.
 *
 * Steps:
 * 1. Replace null values with empty strings
 * 2. Truncate strings to field length limits
 *
 * Why convert null to empty string?
 * - Firestore allows empty strings but not nulls in some contexts
 * - Simpler to store empty string than handle null checks in components
 * - photoURL: empty string means no avatar (shows fallback initials in UI)
 *
 * @param firebaseUser - Validated FirebaseAuthUser
 * @returns Sanitized user data object ready for Firestore
 */
const sanitizeUserData = (
  firebaseUser: FirebaseAuthUser,
) => {
  return {
    name: truncateString(
      firebaseUser.displayName ?? "",
      MAX_FIELD_LENGTHS.name,
    ),
    email: truncateString(
      firebaseUser.email ?? "",
      MAX_FIELD_LENGTHS.email,
    ),
    photoURL: truncateString(
      firebaseUser.photoURL ?? "",
      MAX_FIELD_LENGTHS.photoURL,
    ),
  };
};

/**
 * Validates user role value.
 *
 * Ensures role is either "user" or "admin".
 * Prevents invalid role values from being written to Firestore.
 *
 * @param role - Role value to validate
 * @returns True if role is valid
 */
const isValidUserRole = (
  role: unknown,
): role is UserRole => {
  return role === "user" || role === "admin";
};

/**
 * Creates a Firestore user document if it does not already exist.
 *
 * This is the primary function called after successful Google sign-in.
 *
 * **Flow:**
 * 1. Validate FirebaseAuthUser structure
 * 2. Validate role (if provided)
 * 3. Check if user document exists in Firestore
 * 4. If exists: return existing document (preserves role/status from admin)
 * 5. If not exists: create new document with default values
 *
 * **Important design decisions:**
 * - Does NOT update existing users (preserves role/status set by admin)
 * - Only writes on first sign-in (idempotent operation)
 * - Server timestamps for createdAt and lastLoginAt
 *
 * **Why not update lastLoginAt on every sign-in here?**
 * - Security rules allow isOwner(uid) to update lastLoginAt only
 * - Managed separately by updateLastLoginTimestamp for clarity
 * - Separates user creation from activity tracking
 *
 * **Error logging:**
 * - Detailed console.error with context for debugging
 * - Re-throws with user-friendly message for UI handling
 *
 * @param firebaseUser - User object from Firebase Auth after Google sign-in
 * @param role - Optional user role (default: "user") - only applies to new users
 * @returns User document data (either existing or newly created)
 * @throws {Error} If user validation fails, role invalid, or Firestore operation fails
 *
 * @example
 * ```tsx
 * const userCredential = await signInWithPopup(auth, googleProvider);
 * const user = await createUserIfNotExists(userCredential.user);
 * console.log(user.role); // "user" or "admin"
 * await updateLastLoginTimestamp(user.uid);
 * ```
 */
export const createUserIfNotExists = async (
  firebaseUser: FirebaseAuthUser,
  role: UserRole = DEFAULT_USER_ROLE,
): Promise<IUser> => {
  try {
    // --- Validate input ---
    if (!isValidFirebaseUser(firebaseUser)) {
      throw new Error(
        "Invalid Firebase user object.",
      );
    }

    if (!isValidUserRole(role)) {
      throw new Error(
        `Invalid user role "${role}".`,
      );
    }

    const userRef = doc(
      db,
      USERS_COLLECTION,
      firebaseUser.uid,
    );

    const snapshot = await getDoc(userRef);

    /**
     * Existing user — return document without modifications.
     * Preserves any role/status changes made by admin.
     */
    if (snapshot.exists()) {
      const existingUser =
        snapshot.data() as IUser;

      // Validate existing document integrity (defensive check)
      if (
        !existingUser.uid ||
        !existingUser.email
      ) {
        throw new Error(
          `Corrupted user document for uid ${firebaseUser.uid}`,
        );
      }

      return existingUser;
    }

    /**
     * First-time user — create new document with default values.
     */
    const sanitizedData =
      sanitizeUserData(firebaseUser);

    const newUser: IUser = {
      uid: firebaseUser.uid,
      name: sanitizedData.name,
      email: sanitizedData.email,
      photoURL: sanitizedData.photoURL,
      role,
      status: DEFAULT_USER_STATUS,
      createdAt:
        serverTimestamp() as unknown as IUser["createdAt"],

      // IMPORTANT:
      // Your Firestore rules must allow this field on create.
      // Security rule requires isOwner(uid) and isWriteable()
      lastLoginAt:
        serverTimestamp() as unknown as IUser["lastLoginAt"],
    };

    // Wrapped in separate try-catch for granular error logging
    try {
      await setDoc(userRef, newUser);

      return newUser;
    } catch (firestoreError) {
      console.error(
        "[UserService] Failed creating Firestore user document",
        {
          uid: firebaseUser.uid,
          payload: newUser,
          error: firestoreError,
        },
      );

      throw firestoreError;
    }
  } catch (error) {
    console.error(
      "[UserService] createUserIfNotExists failed",
      error,
    );

    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unknown Firestore error";

    throw new Error(
      `Failed to create or retrieve user: ${errorMessage}`,
    );
  }
};

/**
 * Updates user's last login activity timestamp.
 *
 * **Call after successful sign-in** to track user activity.
 * This field is used for:
 * - "Last Login" column in User Management table
 * - Identifying inactive accounts
 * - Activity auditing
 *
 * **Security context:**
 * - Firestore rules allow isOwner(uid) to update lastLoginAt field only
 * - Does not require admin privileges
 * - Safe to call on every sign-in (doesn't affect other fields)
 *
 * **Why separate from createUserIfNotExists?**
 * - Separation of concerns (creation vs. activity tracking)
 * - Can be called on every sign-in without affecting creation logic
 * - Allows granular error handling
 *
 * @param uid - User ID (Firebase Auth UID)
 * @returns Promise that resolves when update completes
 * @throws {Error} If Firestore update fails (propagates to caller)
 *
 * @example
 * ```tsx
 * // After successful sign-in
 * await updateLastLoginTimestamp(user.uid);
 * ```
 */
export const updateLastLoginTimestamp =
  async (
    uid: string,
  ): Promise<void> => {
    try {
      const userRef = doc(
        db,
        USERS_COLLECTION,
        uid,
      );

      await updateDoc(userRef, {
        lastLoginAt: serverTimestamp(),
      });
    } catch (error) {
      console.error(
        "[UserService] Failed updating lastLoginAt",
        {
          uid,
          error,
        },
      );

      throw error;
    }
  };