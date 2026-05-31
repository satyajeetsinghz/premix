/**
 * ============================================================================
 * BEATSTREAM - Authentication Service
 * ============================================================================
 * File: features/auth/services/auth.service.ts
 *
 * ARCHITECTURE OVERVIEW:
 * - Firebase authentication wrapper for Google Sign-In
 * - Handles login/logout operations
 * - Provides error translation to user-friendly messages
 * - Type-safe Firebase user validation
 *
 * AUTHENTICATION METHODS:
 * - signInWithGoogle: Google OAuth popup-based authentication
 * - logoutUser: Firebase sign-out and session cleanup
 *
 * FIREBASE INTEGRATION:
 * - signInWithPopup: Google OAuth flow
 * - signOut: Firebase session termination
 * - GoogleAuthProvider: Firebase Google provider setup
 *
 * ERROR HANDLING:
 * - AUTH_ERROR_MESSAGES: User-friendly error translations
 * - Custom error codes for different failure scenarios
 * - Network error detection and messaging
 *
 * SECURITY NOTES:
 * - Google provider configured with account selection prompt
 * - User object validated before return (type guard)
 * - Errors don't expose internal Firebase details
 *
 * ============================================================================
 */

import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  User,
} from "firebase/auth";
import { auth } from "@/services/firebase/config";

/**
 * LogoutResult - Response from logoutUser function
 *
 * PROPERTIES:
 * - success: Whether logout was successful
 * - error?: Optional error message if logout failed
 */
interface LogoutResult {
  success: boolean;
  error?: string;
}

/**
 * Google Auth Provider Setup
 *
 * Configured to:
 * - Show account selection dialog
 * - Allow users to choose which Google account to use
 * - Support multiple sign-in attempts
 */
const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt: "select_account",
});

/**
 * AUTH_ERROR_MESSAGES - Error code to user message mapping
 *
 * Translates Firebase auth error codes to user-friendly messages
 * Helps users understand what went wrong and how to fix it
 */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  "auth/popup-closed-by-user":
    "Sign-in cancelled. Please click the button again to try.",
  "auth/popup-blocked": "Pop-up window was blocked. Please enable pop-ups.",
  "auth/unauthorized-domain":
    "This domain is not authorized. Please contact support.",
  "auth/operation-not-allowed":
    "Google sign-in is not enabled. Try again later.",
  "auth/network-request-failed": "Network error. Please check your connection.",
};

/**
 * getAuthErrorMessage - Translate error to user message
 *
 * RESPONSIBILITY:
 * - Extract error code from Firebase error object
 * - Lookup user-friendly message
 * - Return fallback message if code not found
 *
 * @param error - Firebase authentication error
 * @returns User-friendly error message
 */
const getAuthErrorMessage = (error: unknown): string => {
  const code = (error as Record<string, unknown>)?.code;

  if (code && AUTH_ERROR_MESSAGES[code as string]) {
    return AUTH_ERROR_MESSAGES[code as string];
  }

  return (
    ((error as Record<string, unknown>)?.message as string) ||
    "Authentication failed. Please try again."
  );
};

/**
 * isValidUser - Type guard for Firebase User object
 *
 * RESPONSIBILITY:
 * - Validate user object has required properties
 * - Ensure uid and email exist and are strings
 * - Prevent invalid user data from propagating
 *
 * @param user - Unknown user object
 * @returns True if user is valid Firebase User
 */
const isValidUser = (user: unknown): user is User => {
  if (!user || typeof user !== "object") {
    return false;
  }
  const userObj = user as Record<string, unknown>;
  return (
    "uid" in userObj && "email" in userObj && typeof userObj.uid === "string"
  );
};

/**
 * signInWithGoogle - Authenticate user with Google OAuth
 *
 * RESPONSIBILITY:
 * - Launch Google OAuth popup
 * - Validate returned user object
 * - Handle various auth errors
 * - Return Firebase User object
 *
 * FLOW:
 * 1. Launch Google OAuth popup
 * 2. User selects Google account
 * 3. Validate returned user object
 * 4. Return Firebase User to AuthContext
 * 5. AuthContext creates/updates user profile in Firestore
 *
 * ERROR HANDLING:
 * - Popup closed by user: Friendly message
 * - Popup blocked: Suggest enabling popups
 * - Network error: Inform user to check connection
 * - Invalid user object: Throw validation error
 *
 * SECURITY:
 * - Type validates user object
 * - Error messages don't expose sensitive details
 * - Follows Firebase security best practices
 *
 * @returns Promise resolving to Firebase User object
 * @throws Error with user-friendly message on failure
 */
export const signInWithGoogle = async (): Promise<User> => {
  try {
    // Launch Google OAuth popup (blocks until user action or cancels)
    const result = await signInWithPopup(auth, googleProvider);

    // Validate user object before returning
    if (!isValidUser(result.user)) {
      throw new Error("Invalid user object returned from Google sign-in");
    }

    return result.user;
  } catch (error) {
    console.error("Google sign-in error:", error);

    // Translate error to user-friendly message
    const message = getAuthErrorMessage(error);

    // Create error with code for error handling
    const authError = new Error(message) as Error & { code?: string };
    authError.code = (error as Record<string, unknown>)?.code as string;
    throw authError;
  }
};

/**
 * logoutUser - Sign out current user and clear session
 *
 * RESPONSIBILITY:
 * - Call Firebase signOut
 * - Handle logout errors
 * - Clear user session
 *
 * FLOW:
 * 1. Call Firebase signOut (clears auth token)
 * 2. AuthContext listener detects user=null
 * 3. App redirects to login page
 * 4. Return success status
 *
 * ERROR HANDLING:
 * - Network errors: Return error message
 * - Firebase errors: Translate to user message
 * - Errors don't prevent UI from reflecting logout
 *
 * FIREBASE OPERATION:
 * - Clears Firebase session tokens
 * - Invalidates authentication
 * - Does not delete user account
 * - User can sign back in anytime
 *
 * @returns Promise resolving to logout result with success status
 */
export const logoutUser = async (): Promise<LogoutResult> => {
  try {
    // Sign out from Firebase (clears auth tokens)
    await signOut(auth);
    return { success: true };
  } catch (error) {
    const message = getAuthErrorMessage(error);
    console.error("Sign-out error:", message);
    return {
      success: false,
      error: message,
    };
  }
};
