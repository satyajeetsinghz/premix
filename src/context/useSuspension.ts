/**
 * @fileoverview Type-safe consumer hook for the SuspensionContext.
 *
 * Responsibilities:
 * - Provide convenient access to suspension state and actions
 * - Validate that context is used within the provider tree
 * - Memoize context value to prevent unnecessary consumer re-renders
 * - Throw descriptive error when provider is missing
 *
 * Related modules:
 * - SuspensionContextCore (src/context/SuspensionContextCore.tsx) - Context definition and provider
 * - SuspensionContextProvider (src/context/SuspensionContext.tsx) - Implements the provider logic
 * - SuspendedScreen (src/features/suspension/SuspendedScreen.tsx) - Reads isSuspended, calls acknowledge()
 * - SuspensionToast (src/features/suspension/SuspensionToast.tsx) - Reads showToast, calls dismissToast()
 * - SuspensionBanner (src/features/suspension/SuspensionBanner.tsx) - Renders when suspended and acknowledged
 *
 * Architectural role:
 * - **Public API** for consuming suspension state across the app
 * - Encapsulates context validation logic in one place
 * - Provides memoized context value for performance optimization
 *
 * Why a custom hook instead of direct useContext?
 * 1. Validation: Throws clear error if used outside provider (prevents silent failures)
 * 2. Type safety: Automatically narrows from SuspensionContextValue | undefined to SuspensionContextValue
 * 3. Performance: Memoization prevents re-renders when context value hasn't changed
 * 4. Maintainability: Single source of truth for consumption pattern
 * 5. Refactoring: Easy to change underlying implementation (e.g., add logging, devtools)
 *
 * Usage pattern (throughout the app):
 * ```tsx
 * // In any component that needs suspension state
 * const { isSuspended, hasAcknowledged, acknowledge, showToast, dismissToast } = useSuspension();
 *
 * if (isSuspended && !hasAcknowledged) {
 *   return <SuspendedScreen />;
 * }
 * ```
 *
 * Provider requirement:
 * - SuspensionProvider must be mounted higher in the component tree
 * - Typically placed in App.tsx wrapping the entire application
 * - Without provider, this hook throws an error during development/runtime
 *
 * Error message format:
 * - Clear, actionable error indicating missing provider
 * - Includes recommendation to wrap component tree with <SuspensionProvider>
 * - Follows React Context best practices for error messaging
 *
 * Performance note:
 * - useMemo ensures stable reference to context value
 * - Prevents components from re-rendering when context value reference changes but content is identical
 * - Critical for components that consume suspension state frequently (e.g., PlayerBar, Sidebar)
 *
 * @module context
 */

import { useContext, useMemo } from "react";
import {
  SuspensionContext,
  SuspensionContextValue,
} from "./SuspensionContextCore";

/**
 * Result type for useSuspension hook.
 *
 * Alias of SuspensionContextValue for semantic clarity.
 * Indicates this hook returns the full suspension context value.
 */
export type UseSuspensionResult = SuspensionContextValue;

/**
 * Error message displayed when useSuspension is called outside SuspensionProvider.
 *
 * Components affected:
 * - Components that conditionally render based on suspension status
 * - Components that need to show suspension banner or toast
 *
 * Why throw instead of returning default?
 * - Suspension state is critical for security (blocked writes)
 * - Silent failure could allow write operations on suspended accounts
 * - Throwing error makes missing provider immediately visible during development
 */
const MISSING_PROVIDER_ERROR =
  "useSuspension must be used within a SuspensionProvider. " +
  "Wrap your component tree with <SuspensionProvider> in App.tsx.";

/**
 * useSuspension - Hook for accessing suspension state and actions.
 *
 * This is the recommended way for any component to interact with suspension system.
 *
 * @returns Suspension context value containing:
 *   - isSuspended: boolean - Whether user account is suspended
 *   - hasAcknowledged: boolean - Whether user dismissed suspension screen in this session
 *   - acknowledge: () => void - Call to dismiss suspension screen (sets sessionStorage flag)
 *   - showToast: boolean - Whether to show write-blocked toast notification
 *   - dismissToast: () => void - Call to hide the toast notification
 *
 * @throws {Error} If used outside of SuspensionProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isSuspended, hasAcknowledged, acknowledge } = useSuspension();
 *
 *   if (isSuspended && !hasAcknowledged) {
 *     return <SuspendedScreen onAcknowledge={acknowledge} />;
 *   }
 *
 *   return <NormalContent />;
 * }
 * ```
 *
 * @example
 * ```tsx
 * function WriteOperationButton() {
 *   const { isSuspended, showToast, dismissToast } = useSuspension();
 *
 *   const handleLike = async () => {
 *     if (isSuspended) {
 *       // Toast will be shown automatically by SuspensionContext
 *       return;
 *     }
 *     await performLike();
 *   };
 * }
 * ```
 */
export const useSuspension = (): UseSuspensionResult => {
  /**
   * Consume context value from SuspensionContext.
   *
   * Type: SuspensionContextValue | undefined
   * Undefined occurs when component is rendered outside SuspensionProvider.
   */
  const context: SuspensionContextValue | undefined = useContext<
    SuspensionContextValue | undefined
  >(SuspensionContext);

  /**
   * Validate context presence.
   *
   * If undefined, throw descriptive error.
   * This validation is the primary value-add of this custom hook.
   */
  if (!context) {
    throw new Error(MISSING_PROVIDER_ERROR);
  }

  /**
   * Memoize context value to prevent unnecessary re-renders.
   *
   * Without memoization, any component using useSuspension would re-render
   * every time the context provider re-renders, even if the context value
   * hasn't changed structurally.
   *
   * With memoization, components only re-render when the actual context
   * values (isSuspended, hasAcknowledged, showToast) change.
   *
   * Performance impact: Critical for components that consume suspension
   * state but don't need to react to every change (e.g., layout components).
   */
  const memoizedContext = useMemo(() => context, [context]);

  return memoizedContext;
};