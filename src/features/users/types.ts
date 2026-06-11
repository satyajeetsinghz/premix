/**
 * @fileoverview Type definitions for user data structures.
 *
 * Responsibilities:
 * - Define the shape of user documents stored in Firestore
 * - Document all available fields with their types and optionality
 * - Provide type safety across user-related components and services
 *
 * Related modules:
 * - useUsers (src/features/users/hooks/useUsers.ts) - Returns IUser arrays
 * - useCurrentUser (src/features/users/hooks/useCurrentUser.ts) - Returns current user as IUser
 * - UserManagementPage (src/features/users/pages/UserManagementPage.tsx) - Manages IUser objects
 * - UserRow (src/features/users/components/UserRow.tsx) - Displays IUser data
 * - UserDetailsModal (src/features/users/components/UserDetailsModal.tsx) - Shows IUser details
 * - UserActionsMenu (src/features/users/components/UserActionsMenu.tsx) - Modifies IUser role/status
 *
 * Architectural role:
 * - **Core data contract** for all user-related features
 * - Ensures consistency between Firestore documents and TypeScript code
 * - Enables IntelliSense and compile-time type checking
 *
 * Firestore collection: /users/{uid}
 *
 * Security rules (from HANDOFF_CORE.md):
 * - Read: isOwner(uid) OR isAdmin()
 * - Create: isOwner(uid) (during sign-in only)
 * - Update: isOwner(uid) OR isActiveAdmin()
 * - Delete: isActiveAdmin()
 *
 * Field validation (enforced by security rules):
 * - uid: required, string, matches document ID
 * - name: required, string
 * - email: required, string
 * - role: required, must be "user" or "admin"
 * - status: optional, defaults to "active"
 * - createdAt: required on creation (serverTimestamp)
 *
 * @module features/users/types
 */

/**
 * IUser - Firestore document structure for user accounts.
 *
 * Users are created automatically on first sign-in via Google OAuth.
 * Admins can modify roles and statuses via UserManagementPage.
 *
 * Field categories:
 * - Identification: uid, name, email, photoURL
 * - Permissions: role, status
 * - Metadata: createdAt, lastLoginAt
 *
 * @property uid - Unique user identifier (matches Firebase Auth UID and Firestore document ID)
 * @property name - User's display name (from Google profile or user-set)
 * @property email - User's email address (from Google Auth)
 * @property photoURL - Optional profile photo URL (from Google profile or Cloudinary)
 *
 * @property role - User's permission level:
 *                  - "user": Standard user (read/write own data)
 *                  - "admin": Administrator (full access to admin panel and user management)
 * @property status - Account access level (from HANDOFF_CORE.md):
 *                    - "active": Full access (read + write)
 *                    - "suspended": Read-only access (browse only, no writes)
 *                    - "banned": No access (cannot read or write)
 *
 * @property createdAt - Firestore server timestamp (set on first sign-in)
 * @property lastLoginAt - Optional timestamp of last sign-in (updated on each login)
 *
 * @example
 * // Regular active user
 * {
 *   uid: "abc123",
 *   name: "John Doe",
 *   email: "john@example.com",
 *   photoURL: "https://...",
 *   role: "user",
 *   status: "active",
 *   createdAt: Timestamp { seconds: 1704067200 },
 *   lastLoginAt: Timestamp { seconds: 1704153600 }
 * }
 *
 * @example
 * // Suspended user (read-only)
 * {
 *   uid: "def456",
 *   name: "Jane Smith",
 *   email: "jane@example.com",
 *   role: "user",
 *   status: "suspended",
 *   createdAt: Timestamp { seconds: 1704067200 }
 * }
 *
 * @example
 * // Admin user
 * {
 *   uid: "ghi789",
 *   name: "Admin User",
 *   email: "admin@Premix.com",
 *   role: "admin",
 *   status: "active",
 *   createdAt: Timestamp { seconds: 1704067200 }
 * }
 */
export interface IUser {
  uid: string;
  name: string;
  email: string;
  photoURL: string;
  role: "user" | "admin";
  status: "active" | "banned" | "suspended";
  createdAt: any;
  lastLoginAt?: any;
}