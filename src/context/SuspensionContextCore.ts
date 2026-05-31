/**
 * @fileoverview React Context definition for user suspension state management.
 *
 * Responsibilities:
 * - Define the shape of suspension state accessible across the application
 * - Provide type-safe context for suspension status, acknowledgment, and toast notifications
 * - Enable components to consume suspension state without prop drilling
 *
 * Related modules:
 * - SuspensionContextProvider (src/context/SuspensionContext.tsx) - Implements the actual provider logic
 * - useSuspension (src/context/useSuspension.tsx) - Custom hook for consuming this context
 * - SuspendedScreen (src/features/suspension/SuspendedScreen.tsx) - Reads isSuspended and calls acknowledge()
 * - SuspensionToast (src/features/suspension/SuspensionToast.tsx) - Reads showToast and calls dismissToast()
 * - SuspensionBanner (src/features/suspension/SuspensionBanner.tsx) - Renders when suspended and acknowledged
 *
 * Architectural role:
 * - **State contract** between suspension provider and consumers
 * - Enables real-time suspension status propagation across the component tree
 * - Coordinates three UI states: full-screen interstitial (not acknowledged), persistent banner (acknowledged), and transient toast (write attempts)
 *
 * Suspension flow (from HANDOFF_CORE.md):
 * 1. Firestore user document has status: "active" | "suspended" | "banned"
 * 2. SuspensionContext reads user.status from AuthContext (or separate user subscription)
 * 3. If status === "suspended" AND !hasAcknowledged → render <SuspendedScreen />
 * 4. User clicks "Continue in limited mode" → acknowledge() sets sessionStorage flag
 * 5. Subsequent renders show <SuspensionBanner /> instead of full-screen interstitial
 * 6. When suspended user attempts write operation → showToast becomes true → <SuspensionToast /> appears
 *
 * State persistence:
 * - isSuspended: Derived from Firestore user.status (reactive, not stored locally)
 * - hasAcknowledged: Stored in sessionStorage (cleared when browser tab closes)
 * - showToast: Ephemeral boolean (resets after toast dismisses or times out)
 *
 * Why sessionStorage for acknowledgment?
 * - Suspension is server-enforced; client acknowledgment should not override it
 * - Ensures user sees the suspension interstitial again on new browser session (re-education)
 * - Prevents accumulating Firestore writes for acknowledgment timestamps
 *
 * @module context
 */

import { createContext } from "react";

/**
 * Suspension context value interface.
 *
 * This defines the contract that the SuspensionProvider must fulfill
 * and that consumers can expect when using useSuspension().
 *
 * State flags:
 * - isSuspended: True when Firestore user.status === "suspended" (banned users handled separately)
 * - hasAcknowledged: True after user clicks "Continue in limited mode" (stored in sessionStorage)
 * - showToast: True when suspended user attempts a write operation (triggers toast notification)
 *
 * Actions:
 * - acknowledge(): Dismisses the full-screen SuspendedScreen, sets sessionStorage flag
 * - dismissToast(): Hides the toast notification, resets showToast to false
 *
 * UI state matrix:
 * | isSuspended | hasAcknowledged | showToast | Rendered UI                          |
 * |-------------|----------------|-----------|--------------------------------------|
 * | false       | *              | false     | Normal app (no suspension UI)        |
 * | true        | false          | false     | SuspendedScreen (full-screen)        |
 * | true        | true           | false     | SuspensionBanner (persistent banner) |
 * | true        | true           | true      | SuspensionToast (transient) + Banner |
 *
 * Note: Banned users (status === "banned") are handled by BlockedUserScreen,
 * not by this context. SuspensionContext only manages "suspended" status.
 *
 * @property isSuspended - Whether the current user has suspended status (read-only)
 * @property hasAcknowledged - Whether user has acknowledged suspension in current session
 * @property acknowledge - Callback to mark suspension as acknowledged (sets sessionStorage flag)
 * @property showToast - Whether to display the write-blocked toast notification
 * @property dismissToast - Callback to hide the toast notification
 */
export interface SuspensionContextValue {
  isSuspended: boolean;
  hasAcknowledged: boolean;
  acknowledge: () => void;
  showToast: boolean;
  dismissToast: () => void;
}

/**
 * SuspensionContext - React Context for user suspension state.
 *
 * Usage:
 * ```tsx
 * // Provider (in App.tsx or layout)
 * <SuspensionContext.Provider value={contextValue}>
 *   {children}
 * </SuspensionContext.Provider>
 *
 * // Consumer (via custom hook)
 * const { isSuspended, hasAcknowledged, acknowledge } = useSuspension();
 * ```
 *
 * Default value: undefined (requires provider wrapper).
 * Components must use useSuspension() hook which validates context presence.
 *
 * Why undefined default?
 * - Forces consumers to be wrapped by SuspensionProvider
 * - Prevents silent failures if context is accessed outside provider tree
 * - Enables early detection of missing provider via error throwing in useSuspension
 *
 * Type safety:
 * - Context value type is SuspensionContextValue | undefined
 * - useSuspension hook narrows type to SuspensionContextValue (throws if undefined)
 *
 * @see SuspensionContextProvider - Implementation of the provider logic
 * @see useSuspension - Type-safe consumer hook
 */
export const SuspensionContext = createContext<
  SuspensionContextValue | undefined
>(undefined);