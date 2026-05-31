/**
 * @fileoverview Media query hook for responsive breakpoint detection.
 *
 * Responsibilities:
 * - Safely subscribe to CSS media query changes in React component lifecycle
 * - Provide boolean indicating whether the query currently matches
 * - Clean up event listeners on unmount or query change
 *
 * Related modules:
 * - useResponsive (src/components/layout/hooks/useResponsive.ts) - Consumes this hook to provide canonical breakpoint flags
 * - Sidebar, MobileNav, MainLayout - Use useResponsive for layout decisions
 *
 * Architectural role:
 * - Low-level utility hook for responsive design
 * - Single source of truth for window.matchMedia subscriptions across the app
 * - Prevents duplicate event listeners by centralizing media query logic
 *
 * Why not use third-party libraries (e.g., react-responsive, usehooks-ts)?
 * - Avoids additional bundle size for a simple, stable utility
 * - Full control over re-render behavior and cleanup
 *
 * Performance considerations:
 * - Re-runs effect only when query string changes (stable dependency)
 * - State update only when match status actually changes (prevents unnecessary re-renders)
 * - Event listener uses passive handler (no performance impact on scroll/resize)
 *
 * @module hooks
 */

import { useState, useEffect } from "react";

/**
 * React hook that subscribes to a CSS media query and returns its current match status.
 *
 * Common breakpoint queries used in BeatStream (from HANDOFF_CORE.md):
 * - `(min-width: 1180px)` - Desktop sidebar visible threshold
 * - `(max-width: 1179px)` - Mobile navigation visible threshold
 * - `(min-width: 768px)` - Tablet breakpoint for grid layouts
 * - `(max-width: 640px)` - Mobile breakpoint for compact layouts
 *
 * Implementation notes:
 * - Uses `window.matchMedia` which returns a MediaQueryList object
 * - Modern browsers support addEventListener (deprecated addListener in older spec)
 * - Effect cleanup removes listener to prevent memory leaks in long-lived components
 *
 * Edge cases handled:
 * - SSR: Hook returns false on initial render (matches useState default)
 * - No window object: Assumes browser environment (Vite dev server provides window)
 * - Query string changes: Effect re-runs with new query, old listener cleaned up
 *
 * @param query - Valid CSS media query string (e.g., "(min-width: 768px)")
 * @returns Boolean indicating whether the media query currently matches
 *
 * @example
 * const isDesktop = useMediaQuery("(min-width: 1180px)");
 * const isMobile = useMediaQuery("(max-width: 640px)");
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia
 * @see https://developer.mozilla.org/en-US/docs/Web/API/MediaQueryList
 */
export const useMediaQuery = (query: string): boolean => {
  /**
   * Local match state.
   *
   * Initialized to false to:
   * - Avoid hydration mismatches with SSR (server has no window)
   * - Provide safe default before client-side mount
   * - Force re-evaluation after mount via useEffect
   */
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    /**
     * Create MediaQueryList object for the given query.
     *
     * Performance note: matchMedia is synchronous and inexpensive.
     * Does not trigger layout or repaint.
     */
    const mediaQueryList = window.matchMedia(query);

    /**
     * Sync initial state.
     *
     * Why check against current matches state?
     * - Prevents unnecessary re-render if component mounted with matching initial state
     * - Edge case: If SSR returned false but client matches, we need to update
     */
    if (mediaQueryList.matches !== matches) {
      setMatches(mediaQueryList.matches);
    }

    /**
     * Event handler for media query changes.
     *
     * Called on window resize, orientation change, or any factor affecting the query.
     * The event object contains the new .matches value.
     *
     * @param event - MediaQueryListEvent with updated .matches property
     */
    const handleMediaQueryChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    /**
     * Subscribe to change events.
     *
     * Note: .addEventListener is the modern API (supported in all evergreen browsers).
     * Older .addListener is deprecated and not used.
     */
    mediaQueryList.addEventListener("change", handleMediaQueryChange);

    /**
     * Cleanup subscription on unmount or before effect re-run.
     *
     * Why removeEventListener?
     * - Prevents memory leaks from accumulated listeners
     * - Critical for components that mount/unmount frequently (e.g., modal dialogs)
     * - Uses same function reference to ensure removal works
     */
    return () => {
      mediaQueryList.removeEventListener("change", handleMediaQueryChange);
    };
  }, [query]); // Re-run effect only when query string changes

  return matches;
};