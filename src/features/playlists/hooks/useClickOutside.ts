/**
 * @fileoverview Custom hook for detecting clicks outside a referenced DOM element.
 *
 * Responsibilities:
 * - Attach event listeners for mousedown and touchstart
 * - Call provided callback when click/touch occurs outside the referenced element
 * - Clean up event listeners on unmount
 *
 * Related modules:
 * - PlaylistList (src/features/playlists/components/PlaylistList.tsx) - Uses this hook to close menu dropdowns
 * - Any component requiring click-outside detection for modals, dropdowns, or popups
 *
 * Architectural role:
 * - **Reusable event handling abstraction** for dismissible UI elements
 * - Enables closing menus, modals, and popups when user clicks outside
 * - Supports both mouse and touch events for mobile compatibility
 *
 * Common use cases:
 * - Dropdown menus (close when clicking outside)
 * - Modal dialogs (close on backdrop click - often handled separately)
 * - Popup tooltips (dismiss on outside click)
 * - Inline editors (cancel edit when clicking outside)
 *
 * Event types:
 * - mousedown: Desktop mouse clicks (fires before click event)
 * - touchstart: Mobile touch events (better responsiveness than touch)
 *
 * Why mousedown instead of click?
 * - Fires earlier in event lifecycle
 * - Prevents race conditions where click handlers inside element might fire after outside detection
 *
 * Why both mousedown and touchstart?
 * - mousedown: Desktop compatibility
 * - touchstart: Mobile touch compatibility
 * - Both needed for cross-device support
 *
 * Performance considerations:
 * - Event listeners attached at document level (global)
 * - Callback function should be memoized with useCallback to prevent unnecessary re-subscriptions
 * - Ref should be stable (useRef) to avoid effect re-running
 *
 * Edge cases:
 * - If ref.current is null (element not mounted), callback is not called
 * - If callback changes (dependencies), effect re-runs and re-attaches listeners
 *
 * @module features/playlists/hooks
 */

import { useEffect } from "react";

/**
 * useClickOutside - Hook that triggers callback when clicking outside a referenced element.
 *
 * @param ref - React ref object pointing to the DOM element to watch
 * @param callback - Function called when click/touch occurs outside the referenced element
 *
 * @example
 * ```tsx
 * const menuRef = useRef<HTMLDivElement>(null);
 * const [isOpen, setIsOpen] = useState(false);
 *
 * useClickOutside(menuRef, () => {
 *   setIsOpen(false);
 * });
 *
 * return (
 *   <div ref={menuRef}>
 *     <button>Menu</button>
 *     {isOpen && <div>Dropdown content</div>}
 *   </div>
 * );
 * ```
 *
 * @example
 * ```tsx
 * // With memoized callback for performance
 * const handleClose = useCallback(() => {
 *   setShowMenu(false);
 * }, []);
 *
 * useClickOutside(menuRef, handleClose);
 * ```
 */
export const useClickOutside = (
  ref: React.RefObject<HTMLElement>,
  callback: () => void,
) => {
  useEffect(() => {
    /**
     * Event handler for mouse and touch events.
     * Checks if the click/touch target is outside the referenced element.
     *
     * @param event - MouseEvent or TouchEvent
     */
    const handleClick = (event: MouseEvent | TouchEvent) => {
      // Guard: element not mounted yet
      if (!ref.current) return;

      // If target is NOT inside the referenced element, execute callback
      if (!ref.current.contains(event.target as Node)) {
        callback();
      }
    };

    // Attach event listeners to document (global events)
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("touchstart", handleClick);

    // Cleanup: remove listeners on unmount or when dependencies change
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("touchstart", handleClick);
    };
  }, [ref, callback]); // Re-run effect if ref or callback changes
};