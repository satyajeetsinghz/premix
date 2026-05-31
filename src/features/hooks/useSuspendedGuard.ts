/**
 * @fileoverview Guard hook that conditionally blocks actions when user account is suspended.
 *
 * Responsibilities:
 * - Wrap functions to prevent execution when user is suspended
 * - Provide a higher-order function that checks suspension status before executing
 * - Return early without calling the wrapped function if suspended
 *
 * Related modules:
 * - SuspensionContext (src/context/SuspensionContextCore.tsx) - Provides isSuspended state
 * - useSuspension (src/context/useSuspension.tsx) - Consumer hook for suspension state
 * - Used by components that perform write operations (likes, playlists, history, uploads)
 *
 * Architectural role:
 * - **Defense-in-depth layer** for write operations on suspended accounts
 * - Complements Firestore security rules (isWriteable() = false for suspended)
 * - Provides client-side feedback opportunity before blocked write reaches Firestore
 *
 * Suspension behavior (from HANDOFF_CORE.md):
 * - Suspended users: isWriteable() = false (Firestore blocks all writes)
 * - This guard provides early bailout to prevent unnecessary network requests
 * - Also enables showing toast notifications (handled by SuspensionContext)
 *
 * Usage pattern:
 * ```tsx
 * const { guardAction } = useSuspendedGuard();
 *
 * const handleLike = guardAction(async () => {
 *   // This code only runs if user is NOT suspended
 *   await likeSong(songId);
 * });
 * ```
 *
 * Why not just check isSuspended directly in components?
 * - Reduces boilerplate (no need to write `if (isSuspended) return;` everywhere)
 * - Centralizes suspension checking logic
 * - Type-safe wrapper preserves original function signature
 *
 * Performance considerations:
 * - useCallback ensures stable reference for guardAction
 * - Wrapped functions are re-created only when isSuspended changes
 * - Minimal overhead (simple conditional check)
 *
 * @module features/suspension/hooks
 */

import { useCallback } from "react";
import { useSuspension } from "@/context/useSuspension";

/**
 * Return type for useSuspendedGuard hook.
 *
 * @property guardAction - Higher-order function that wraps an action, preventing execution if suspended
 * @property isSuspended - Current suspension status (convenience access)
 */
interface UseSuspendedGuardReturn {
  guardAction: <T extends (...args: any[]) => any>(fn: T) => T;
  isSuspended: boolean;
}

/**
 * useSuspendedGuard - Hook that provides function wrapping for suspension-aware actions.
 *
 * This hook is designed for components that need to conditionally block user actions
 * when the account is suspended. It wraps functions and checks suspension status
 * before allowing execution.
 *
 * Example usage in a like button:
 * ```tsx
 * const { guardAction } = useSuspendedGuard();
 *
 * const handleLike = guardAction(async () => {
 *   await updateDoc(doc(db, "songs", songId), {
 *     likeCount: increment(1)
 *   });
 * });
 * ```
 *
 * Integration with SuspensionContext:
 * - When isSuspended = true, guardAction returns early without calling fn
 * - The SuspensionContext also sets showToast = true to notify user
 * - Toast appears explaining that writes are blocked while suspended
 *
 * @returns Object containing guardAction higher-order function and isSuspended flag
 */
export const useSuspendedGuard = (): UseSuspendedGuardReturn => {
  const { isSuspended } = useSuspension();

  /**
   * Wraps a function to prevent execution when user is suspended.
   *
   * Type safety: Preserves the original function's parameter and return types.
   *
   * @param fn - The function to wrap (typically an async action that writes to Firestore)
   * @returns Wrapped function that checks suspension status before executing
   *
   * @example
   * ```tsx
   * const handleSubmit = guardAction(async (formData) => {
   *   await saveToFirestore(formData);
   * });
   * ```
   */
  const guardAction = useCallback(
    <T extends (...args: any[]) => any>(fn: T): T => {
      return ((...args: Parameters<T>) => {
        // If user is suspended, block execution and return undefined
        if (isSuspended) {
          return;
        }
        // Otherwise, execute the original function
        return fn(...args);
      }) as T;
    },
    [isSuspended],
  );

  return { guardAction, isSuspended };
};