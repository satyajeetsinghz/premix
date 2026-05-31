/**
 * ============================================================================
 * BEATSTREAM - User Suspension Context Provider
 * ============================================================================
 * File: context/SuspensionContext.tsx
 *
 * ARCHITECTURE OVERVIEW:
 * - Manages user suspension state and acknowledgment
 * - Provides UI controls for suspension warnings and reminders
 * - Integrates with AuthContext to detect suspension status changes
 * - Handles periodic reminder toasts for suspended users
 *
 * SUSPENSION STATES:
 * - Not suspended: Normal operation, no restrictions
 * - Suspended (not acknowledged): Full-screen warning, must accept
 * - Suspended (acknowledged): Banner warning, reminder toasts every 60s
 * - Banned: Blocked at app level (see App.tsx)
 *
 * FLOW:
 * 1. App starts → user.status checked
 * 2. If suspended: SuspensionScreen forces acknowledgment
 * 3. After acknowledge: App shows SuspensionBanner + allows access
 * 4. Every 60s: Toast reminder that account is suspended
 * 5. On unsuspend: State resets automatically
 *
 * STATE MANAGEMENT:
 * - hasAcknowledged: User clicked "I understand" on suspension screen
 * - showToast: Current toast visibility state
 * - isSuspended: Derived from user.status (from AuthContext)
 *
 * REMINDERS:
 * - Interval: 60 seconds (REMINDER_INTERVAL_MS)
 * - Only shows if suspended AND acknowledged
 * - Dismissed by user closing toast
 *
 * PERFORMANCE:
 * - useMemo: Prevents unnecessary re-renders with derived state
 * - useCallback: Memoizes action handlers
 * - Interval cleanup: Properly cleared on unmount and state changes
 *
 * ============================================================================
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import {
  SuspensionContext,
  SuspensionContextValue,
} from "@/context/SuspensionContextCore";

export interface SuspensionProviderProps {
  children: React.ReactNode;
}

// How often to remind suspended users (in milliseconds)
const REMINDER_INTERVAL_MS = 60_000; // 60 seconds

/**
 * Helper to safely clear reminder interval
 *
 * @param intervalRef - Ref to active interval
 */
const clearReminderInterval = (
  intervalRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>,
) => {
  if (intervalRef.current) {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  }
};

/**
 * SuspensionProvider Component
 *
 * RESPONSIBILITY:
 * - Track suspension state and acknowledgment
 * - Show periodic reminders to suspended users
 * - Reset state when user becomes unsuspended
 * - Provide suspension context to entire app
 *
 * STATE:
 * - hasAcknowledged: User acknowledged suspension warning
 * - showToast: Whether to display reminder toast
 * - isSuspended: Derived from user.status from AuthContext
 *
 * REFS:
 * - intervalRef: Reference to reminder interval (for cleanup)
 * - resetTimeoutRef: Reference to reset timeout (for cleanup)
 *
 * LIFECYCLE:
 * 1. User gets suspended:
 *    a. isSuspended becomes true
 *    b. App shows SuspensionScreen (full-screen warning)
 *    c. User clicks acknowledge button
 *    d. hasAcknowledged becomes true
 *    e. App shows SuspensionBanner (header warning)
 *    f. Reminder interval starts
 * 2. Every 60 seconds:
 *    a. showToast set to true
 *    b. Toast component displays reminder
 *    c. User can dismiss or wait for auto-hide
 * 3. User becomes unsuspended (admin removes suspension):
 *    a. user.status changes (from AuthContext)
 *    b. isSuspended becomes false
 *    c. Reset effect clears hasAcknowledged and showToast
 *    d. No more reminders
 *    e. Normal operation resumes
 *
 * @param children - React components to provide suspension context to
 * @returns Provider component with suspension state
 */
export const SuspensionProvider = ({ children }: SuspensionProviderProps) => {
  // Track whether user has acknowledged the suspension warning
  const [hasAcknowledged, setHasAcknowledged] = useState(false);

  // Track whether to show reminder toast
  const [showToast, setShowToast] = useState(false);

  // Reference to reminder interval (for cleanup)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reference to reset timeout (for cleanup)
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get user from auth context
  const { user } = useAuth();

  /**
   * isSuspended - Derived state
   * True if user status is "suspended"
   * Memoized to prevent unnecessary recalculations
   */
  const isSuspended = useMemo(
    () => user?.status === "suspended",
    [user?.status],
  );

  /**
   * effectiveHasAcknowledged - Derived state
   * Only true if user is actually suspended AND acknowledged
   * Prevents retaining acknowledgment state after user is unsuspended
   * Memoized for performance
   */
  const effectiveHasAcknowledged = useMemo(
    () => (isSuspended ? hasAcknowledged : false),
    [isSuspended, hasAcknowledged],
  );

  /**
   * effectiveShowToast - Derived state
   * Only true if user is actually suspended AND toast should show
   * Memoized for performance
   */
  const effectiveShowToast = useMemo(
    () => (isSuspended ? showToast : false),
    [isSuspended, showToast],
  );

  /**
   * acknowledge Action
   * Called when user clicks "I understand" on suspension screen
   * Allows access to rest of app with suspension banner visible
   */
  const acknowledge = useCallback(() => {
    setHasAcknowledged(true);
  }, []);

  /**
   * dismissToast Action
   * Called when user closes reminder toast
   * Can show again after next interval
   */
  const dismissToast = useCallback(() => {
    setShowToast(false);
  }, []);

  /**
   * Build context value with all state and actions
   * Memoized to prevent unnecessary re-renders of consumers
   */
  const contextValue = useMemo<SuspensionContextValue>(
    () => ({
      isSuspended,
      hasAcknowledged: effectiveHasAcknowledged,
      acknowledge,
      showToast: effectiveShowToast,
      dismissToast,
    }),
    [
      isSuspended,
      effectiveHasAcknowledged,
      effectiveShowToast,
      acknowledge,
      dismissToast,
    ],
  );

  /**
   * Reminder Toast Interval
   *
   * When user is suspended and acknowledged:
   * - Start 60-second interval
   * - Every 60s: set showToast=true (triggers reminder)
   * - Clean up interval when suspension ends or unsuspended
   */
  useEffect(() => {
    // Don't set interval if not suspended or not acknowledged
    if (!isSuspended || !hasAcknowledged) {
      clearReminderInterval(intervalRef);
      return;
    }

    // Set up reminder interval every 60 seconds
    intervalRef.current = setInterval(() => {
      setShowToast(true);
    }, REMINDER_INTERVAL_MS);

    // Cleanup interval on effect cleanup
    return () => {
      clearReminderInterval(intervalRef);
    };
  }, [isSuspended, hasAcknowledged]);

  /**
   * Suspension State Reset
   *
   * When user transitions from suspended to not suspended:
   * - Clear acknowledgment state
   * - Hide any visible toast
   * - Stop reminder interval
   *
   * TIMING:
   * - Uses setTimeout(0) to defer reset (ensures state is read fresh)
   * - Allows other effects to see the transition
   */
  useEffect(() => {
    if (!isSuspended) {
      // Use setTimeout to defer reset (allows other effects to process)
      resetTimeoutRef.current = setTimeout(() => {
        setHasAcknowledged(false);
        setShowToast(false);
      }, 0);
      clearReminderInterval(intervalRef);
    }

    // Cleanup timeout on effect cleanup
    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
        resetTimeoutRef.current = null;
      }
    };
  }, [isSuspended]);

  // Provide context to entire app
  return (
    <SuspensionContext.Provider value={contextValue}>
      {children}
    </SuspensionContext.Provider>
  );
};
