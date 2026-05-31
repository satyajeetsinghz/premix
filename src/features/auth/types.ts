/**
 * ============================================================================
 * BEATSTREAM - Authentication Type Definitions
 * ============================================================================
 * File: features/auth/types.ts
 *
 * ARCHITECTURE OVERVIEW:
 * - Defines all TypeScript interfaces and types for authentication
 * - Provides type guards for runtime validation
 * - Establishes user model structure across entire application
 * - Centralizes auth-related constants
 *
 * USER STATUS ENUM:
 * - "active": User can access all features
 * - "suspended": User is temporarily blocked (suspension reason shown)
 * - "banned": User is permanently blocked (cannot login)
 *
 * USER ROLE ENUM:
 * - "user": Regular user with standard permissions
 * - "admin": Administrator with access to admin panel and all features
 *
 * FIREBASE SCHEMA:
 * Documents stored in /users/{uid} collection with IUser structure
 *
 * ============================================================================
 */

import { FieldValue } from "firebase/firestore";

/**
 * UserStatus - Defines possible account states
 * Used for access control and suspension enforcement
 */
export type UserStatus = "active" | "suspended" | "banned";

/**
 * UserRole - Defines user permission levels
 * Checked in ProtectedAdminRoute for access control
 */
export type UserRole = "user" | "admin";

/**
 * IUser - Application user model
 *
 * Represents a user in the BeatStream application
 * Persisted in Firestore at /users/{uid}
 * Returned by AuthContext and consumed throughout app
 *
 * PROPERTIES:
 * - uid: Firebase auth UID (unique identifier)
 * - name: User's display name
 * - email: User's email address
 * - photoURL: Profile picture URL (from Firebase auth or Cloudinary)
 * - role: Permission level (user or admin)
 * - status: Account state (active/suspended/banned)
 * - createdAt: Account creation timestamp
 * - lastLoginAt: Most recent login timestamp (updated on each login)
 *
 * USAGE:
 * - Used in AuthContext to represent authenticated user
 * - Checked for role in ProtectedAdminRoute
 * - Checked for status in App.tsx for access control
 */
export interface IUser {
  uid: string;
  name: string;
  email: string;
  photoURL: string;
  role: UserRole;
  status: UserStatus;
  createdAt: FieldValue;
  lastLoginAt: FieldValue;
}

/**
 * IAuthContext - Shape of AuthContext value
 *
 * Provided by AuthProvider to entire app
 * Consumed via useAuth hook
 *
 * PROPERTIES:
 * - user: Current authenticated user or null (if not logged in)
 * - loading: True while Firebase auth state is being resolved
 */
export interface IAuthContext {
  user: IUser | null;
  loading: boolean;
}

// Default role for new users
export const DEFAULT_USER_ROLE: UserRole = "user";

// Default status for new users
export const DEFAULT_USER_STATUS: UserStatus = "active";

/**
 * Type guard to validate UserStatus at runtime
 * Use when receiving user data from external sources (API, Firestore)
 *
 * @param value - Unknown value to validate
 * @returns True if value is valid UserStatus
 */
export const isUserStatus = (value: unknown): value is UserStatus =>
  value === "active" || value === "suspended" || value === "banned";

/**
 * Type guard to validate UserRole at runtime
 * Use when receiving role data from Firestore
 *
 * @param value - Unknown value to validate
 * @returns True if value is valid UserRole
 */
export const isUserRole = (value: unknown): value is UserRole =>
  value === "user" || value === "admin";
