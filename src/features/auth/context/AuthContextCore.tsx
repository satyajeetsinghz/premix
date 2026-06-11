/**
 * ============================================================================
 * Premix - Authentication Context Core
 * ============================================================================
 * File: features/auth/context/AuthContextCore.tsx
 *
 * ARCHITECTURE OVERVIEW:
 * - Defines the AuthContext TypeScript type definition
 * - Provides the React Context object for authentication state sharing
 * - Sets default values for initialization
 *
 * RESPONSIBILITY:
 * - Export AuthContext for use in AuthProvider
 * - Define the contract for authentication state shape
 * - Provide default values to prevent undefined context
 *
 * STATE SHAPE:
 * - user: IUser | null - Current authenticated user or null
 * - loading: boolean - True while Firebase auth state is being resolved
 *
 * USAGE PATTERN:
 * - AuthContext is created here with defaults
 * - AuthProvider in AuthContext.tsx uses this context
 * - useAuth hook consumes this context
 *
 * ============================================================================
 */

import { createContext } from "react";
import { IAuthContext } from "../types";

/**
 * Default auth context value used during provider initialization
 * Ensures consumer always receives valid context object
 */
const DEFAULT_AUTH_CONTEXT: IAuthContext = {
  user: null,
  loading: true,
};

export const AuthContext = createContext<IAuthContext>(DEFAULT_AUTH_CONTEXT);
