/**
 * @fileoverview Firestore user document management for Google OAuth authentication.
 *
 * Responsibilities:
 * - Create user document in Firestore on first sign-in
 * - Retrieve existing user document on subsequent sign-ins
 * - Validate and sanitize Firebase Auth user data before storage
 * - Enforce data type constraints and field length limits
 *
 * Related modules:
 * - auth.service.ts (src/features/auth/services/auth.service.ts) - Calls createUserIfNotExists after Google sign-in
 * - useAuth.ts (src/features/auth/hooks/useAuth.ts) - Provides user data to React components
 * - Firestore users collection (source of truth for user metadata)
 *
 * Architectural role:
 * - **User document orchestration layer** between Firebase Auth and Firestore
 * - Ensures Firestore user document exists for every authenticated user
 * - Called immediately after successful Google sign-in
 *
 * Security considerations:
 * - Works in conjunction with Firestore security rules (from HANDOFF_CORE.md)
 * - Users can only create their own document (isOwner(uid) check)
 * - Role defaults to "user" - only admins can upgrade via admin panel
 * - Status defaults to "active" - can be suspended/banned via admin panel
 *
 * Firestore user document structure (per HANDOFF_CORE.md):
 * ```
 * /users/{uid}
 * {
 *   uid: string,
 *   name: string,
 *   email: string,
 *   photoURL?: string,
 *   role: "user" | "admin",
 *   status?: "active" | "suspended" | "banned",
 *   createdAt: Timestamp,
 *   lastLoginAt?: Timestamp
 * }
 * ```
 *
 * Data flow on sign-in:
 * 1. User signs in with Google → Firebase Auth returns user object
 * 2. auth.service calls createUserIfNotExists with Auth user data
 * 3. Function checks if user document exists in Firestore
 * 4. If exists: returns existing document (preserves role/status)
 * 5. If not exists: creates new document with default role/status
 *
 * Why validate and sanitize?
 * - Firebase Auth displayName can be up to 256+ chars (Firestore limit 1MB per doc)
 * - Prevents excessively long strings from causing Firestore write failures
 * - Ensures required fields exist before Firestore write
 *
 * Field constraints:
 * - name: 255 chars (truncated if longer)
 * - email: 255 chars (truncated if longer)
 * - photoURL: 1024 chars (URLs can be long)
 *
 * @module features/auth/services
 */

import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/services/firebase/config";
import { IUser } from "../types";

/**
 * Firebase Authentication user object structure.
 *
 * Subset of Firebase User object containing fields needed for Firestore.
 *
 * @property uid - Unique user identifier (same as Firestore document ID)
 * @property displayName - User's full name (can be null if not provided)
 * @property email - User's email address (can be null for anonymous auth)
 * @property photoURL - Profile picture URL (can be null)
 */
interface FirebaseAuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

/**
 * User role type (matches types.ts from HANDOFF_CORE.md).
 *
 * - user: Regular authenticated user (read/write permissions)
 * - admin: Administrator with full access to admin panel
 */
type UserRole = "user" | "admin";

/**
 * User status type (matches types.ts from HANDOFF_CORE.md).
 *
 * - active: Full access (read + write)
 * - suspended: Read-only access (no writes)
 * - banned: No access (cannot read or write)
 */
type UserStatus = "active" | "suspended" | "banned";

/**
 * Default role for new users.
 *
 * Per security rules: must be "user" on creation (admins created via admin panel)
 */
const DEFAULT_USER_ROLE: UserRole = "user";

/**
 * Default status for new users.
 *
 * Per security rules: can be "active" on creation
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
 * Firestore document size limit is 1MB, but individual fields shouldn't exceed these limits.
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
 *
 * @param user - User object from Firebase Auth
 * @returns True if user has valid structure for Firestore storage
 */
const isValidFirebaseUser = (user: unknown): user is FirebaseAuthUser => {
  if (!user || typeof user !== "object") {
    return false;
  }
  const userObj = user as Record<string, unknown>;
  return (
    typeof userObj.uid === "string" &&
    userObj.uid.length > 0 &&
    (userObj.displayName === null || typeof userObj.displayName === "string") &&
    (userObj.email === null || typeof userObj.email === "string") &&
    (userObj.photoURL === null || typeof userObj.photoURL === "string")
  );
};

/**
 * Truncates a string to a maximum length.
 *
 * Prevents overly long strings from causing Firestore errors.
 * Safe truncation (does not break UTF-8 characters).
 *
 * @param value - String to truncate
 * @param maxLength - Maximum allowed length
 * @returns Truncated string (or original if within limit)
 */
const truncateString = (value: string, maxLength: number): string => {
  return value.length > maxLength ? value.substring(0, maxLength) : value;
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
 * - photoURL: empty string means no avatar (shows fallback initial)
 *
 * @param firebaseUser - Validated FirebaseAuthUser
 * @returns Sanitized user data object
 */
const sanitizeUserData = (firebaseUser: FirebaseAuthUser) => {
  return {
    name: truncateString(
      firebaseUser.displayName ?? "",
      MAX_FIELD_LENGTHS.name,
    ),
    email: truncateString(firebaseUser.email ?? "", MAX_FIELD_LENGTHS.email),
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
 *
 * @param role - Role value to validate
 * @returns True if role is valid
 */
const isValidUserRole = (role: unknown): role is UserRole => {
  return role === "user" || role === "admin";
};

/**
 * Creates a Firestore user document if it doesn't exist.
 *
 * This is the primary function called after successful Google sign-in.
 *
 * Flow:
 * 1. Validate FirebaseAuthUser structure
 * 2. Validate role (if provided)
 * 3. Check if user document exists in Firestore
 * 4. If exists: return existing document (no updates)
 * 5. If not exists: create new document with default values
 *
 * Important design decisions:
 * - Does NOT update existing users (preserves role/status from admin panel)
 * - Only writes on first sign-in (idempotent operation)
 * - Server timestamps for createdAt and lastLoginAt
 *
 * Why not update lastLoginAt on every sign-in?
 * - Security rules allow isOwner(uid) to update lastLoginAt only
 * - Could be added but would increase Firestore writes
 * - Current design accepts stale lastLoginAt in exchange for fewer writes
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
        "Invalid Firebase user object: uid, displayName, email, and photoURL are required",
      );
    }

    if (!isValidUserRole(role)) {
      throw new Error(
        `Invalid user role "${role}". Must be "user" or "admin".`,
      );
    }

    // --- Check if user document exists ---
    const userRef = doc(db, USERS_COLLECTION, firebaseUser.uid);
    const snapshot = await getDoc(userRef);

    // --- Return existing document (preserves role/status) ---
    if (snapshot.exists()) {
      const existingUser = snapshot.data() as IUser;

      // Validate existing document integrity
      if (!existingUser.uid || !existingUser.email) {
        throw new Error(
          `Corrupted user document for uid ${firebaseUser.uid}: missing required fields`,
        );
      }

      return existingUser;
    }

    // --- Create new user document ---
    const sanitizedData = sanitizeUserData(firebaseUser);

    const newUser: IUser = {
      uid: firebaseUser.uid,
      name: sanitizedData.name,
      email: sanitizedData.email,
      photoURL: sanitizedData.photoURL,
      role: role,
      status: DEFAULT_USER_STATUS,
      createdAt: serverTimestamp() as unknown as IUser["createdAt"],
      lastLoginAt: serverTimestamp() as unknown as IUser["lastLoginAt"],
    };

    await setDoc(userRef, newUser);
    return newUser;
  } catch (error) {
    // --- Error handling: log and re-throw with user-friendly message ---
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error creating/retrieving user:", errorMessage);

    throw new Error(`Failed to create or retrieve user: ${errorMessage}`);
  }
};