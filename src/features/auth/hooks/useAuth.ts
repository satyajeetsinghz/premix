/**
 * ============================================================================
 * Premix - Authentication Hooks
 * ============================================================================
 * File: features/auth/hooks/useAuth.ts
 *
 * ARCHITECTURE OVERVIEW:
 * - Custom React hook for accessing authentication state
 * - Provides user role validation helpers
 * - Type-safe access to AuthContext throughout application
 *
 * USAGE PATTERN:
 * - All components needing auth state use this hook
 * - Must be called within AuthProvider's component tree
 * - Throws error if called outside provider (prevents silent failures)
 *
 * ============================================================================
 */

import { useContext } from "react";
import { AuthContext } from "../context/AuthContextCore";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/services/firebase/config";

/**
 * UserRole type for role-based access control
 * Includes "moderator" for potential future expansion
 */
type UserRole = "admin" | "moderator" | "user";

/**
 * FetchUserRoleResult - Response from fetchUserRole function
 *
 * PROPERTIES:
 * - role: User's role (defaults to "user")
 * - exists: Whether user document exists in Firestore
 * - error?: Optional error message if role fetch failed
 */
interface FetchUserRoleResult {
  role: UserRole;
  exists: boolean;
  error?: string;
}

// Default role when no role is found in Firestore
const DEFAULT_USER_ROLE: UserRole = "user";

// Valid roles that can be assigned in the system
const VALID_USER_ROLES: readonly UserRole[] = ["admin", "moderator", "user"];

/**
 * Type guard for validating user roles
 *
 * @param role - Unknown role value
 * @returns True if role is a valid UserRole
 */
const isValidUserRole = (role: unknown): role is UserRole => {
  return VALID_USER_ROLES.includes(role as UserRole);
};

/**
 * useAuth Hook
 *
 * RESPONSIBILITY:
 * - Provide access to current user and auth state
 * - Enforce that hook is called within AuthProvider
 * - Type-safe context consumption
 *
 * USAGE:
 * const { user, loading } = useAuth();
 *
 * AUTHENTICATION STATE:
 * - user: null during app initialization or if not logged in
 * - loading: true while Firebase resolves auth state
 * - user object: Contains uid, email, role, status once loaded
 *
 * ERROR HANDLING:
 * - Throws descriptive error if used outside AuthProvider
 * - Prevents undefined context errors
 *
 * @returns Current auth context with user and loading state
 * @throws Error if AuthContext is not found (called outside AuthProvider)
 */
export const useAuth = () => {
  const authContext = useContext(AuthContext);

  if (!authContext) {
    throw new Error(
      "useAuth must be used within an AuthProvider. Ensure your component tree is wrapped with <AuthProvider>.",
    );
  }

  return authContext;
};

/**
 * fetchUserRole - Async function to fetch user role from Firestore
 *
 * RESPONSIBILITY:
 * - Query Firestore for user document
 * - Extract and validate role field
 * - Return role with metadata
 * - Handle errors gracefully
 *
 * DATA FLOW:
 * 1. Validate input UID
 * 2. Query Firestore: /users/{uid}
 * 3. Check if document exists
 * 4. Extract role field from document
 * 5. Validate role is one of valid roles
 * 6. Return result with role, exists status, error (if any)
 *
 * ERROR HANDLING:
 * - Invalid UID: Returns default role + error
 * - Document not found: Returns default role + error
 * - Invalid role in document: Returns default role + warning + error
 * - Network/Firestore errors: Returns default role + error message
 *
 * PERFORMANCE:
 * - Direct document read (fast)
 * - No subcollections queried
 * - Suitable for permission checks on login
 *
 * FIREBASE INTERACTION:
 * - Reads from /users/{uid} collection
 * - Uses getDoc for single document fetch
 * - Serverless operation (no backend call)
 *
 * USE CASES:
 * - ProtectedAdminRoute checks if user is admin
 * - Admin panel initialization
 * - Permission-based feature access
 *
 * @param uid - Firebase user ID
 * @returns Promise resolving to role fetch result with status and error info
 */
export const fetchUserRole = async (
  uid: string,
): Promise<FetchUserRoleResult> => {
  try {
    // Validate input UID
    if (!uid || typeof uid !== "string") {
      return {
        role: DEFAULT_USER_ROLE,
        exists: false,
        error: "Invalid user ID provided to fetchUserRole",
      };
    }

    // Query Firestore for user document
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);

    // Check if user document exists
    if (!docSnap.exists()) {
      return {
        role: DEFAULT_USER_ROLE,
        exists: false,
        error: `User document not found for UID: ${uid}`,
      };
    }

    // Extract role field from document data
    const userData = docSnap.data();
    const roleValue = userData?.role;

    // Validate role is one of the valid roles
    if (!isValidUserRole(roleValue)) {
      console.warn(
        `Invalid role "${roleValue}" found for user ${uid}, defaulting to "user"`,
      );
      return {
        role: DEFAULT_USER_ROLE,
        exists: true,
        error: `Invalid role value: ${roleValue}`,
      };
    }

    // Role is valid: return it
    return {
      role: roleValue,
      exists: true,
    };
  } catch (error) {
    // Handle unexpected errors (network, Firestore, etc.)
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error fetching role for user ${uid}:`, errorMessage);

    return {
      role: DEFAULT_USER_ROLE,
      exists: false,
      error: `Failed to fetch user role: ${errorMessage}`,
    };
  }
};
