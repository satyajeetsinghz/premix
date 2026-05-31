/**
 * @fileoverview Custom hook for detecting horizontal scroll position and providing scroll controls.
 *
 * Responsibilities:
 * - Detect scroll position within a horizontally scrollable container
 * - Determine if content exists to the left or right of current viewport
 * - Provide imperative scroll methods (scrollLeft, scrollRight) with smooth behavior
 * - Update arrow visibility state on scroll events
 *
 * Related modules:
 * - SectionShell (src/components/ui/SectionShell.tsx) - Primary consumer of this hook
 * - Any component requiring horizontal scroll detection with arrow controls
 *
 * Architectural role:
 * - **Scroll detection abstraction** for horizontal carousels and row containers
 * - Encapsulates DOM measurement logic (scrollLeft, scrollWidth, clientWidth)
 * - Provides reactive state for UI components to show/hide navigation arrows
 *
 * Algorithm:
 * - Determines if scrolled to left edge: scrollLeft <= SCROLL_THRESHOLD
 * - Determines if scrolled to right edge: scrollLeft >= scrollWidth - clientWidth - SCROLL_THRESHOLD
 * - showLeft = NOT at left edge (content exists to left)
 * - showRight = NOT at right edge (content exists to right)
 *
 * Threshold rationale (SCROLL_THRESHOLD = 10px):
 * - Prevents arrows from toggling too aggressively at exact boundaries
 * - Provides 10px buffer zone where both arrows may be visible
 * - Smoother UX when user overscrolls slightly
 *
 * Scroll amount:
 * - Default 320px (matches typical card width + gap in BeatStream)
 * - Overridable via parameter for different card sizes
 *
 * Performance:
 * - useCallback for event handlers (prevents recreation on each render)
 * - useMemo for result object (prevents unnecessary re-renders of consuming components)
 * - scrollBy with behavior: "smooth" provides native GPU-accelerated scrolling
 *
 * Error handling:
 * - try/catch around scrollBy (handles rare cases where element is detached from DOM)
 * - console.warn instead of silent failure (debuggability)
 *
 * Edge cases:
 * - Content smaller than container width: showLeft = false, showRight = false
 * - Dynamic content resize: Requires manual scroll event or ResizeObserver (not implemented)
 *   Consumer should call onScroll() after content loads if needed
 *
 * @module components/ui
 */

import { useState, useRef, useCallback, useMemo, RefObject } from "react";

/**
 * Return type for useHorizontalScroll hook.
 *
 * @property ref - Ref to attach to the scrollable container element
 * @property showLeft - Whether content exists to the left (show left arrow)
 * @property showRight - Whether content exists to the right (show right arrow)
 * @property onScroll - Event handler to attach to container's onScroll event
 * @property scrollLeft - Function to scroll container left by scrollAmount pixels
 * @property scrollRight - Function to scroll container right by scrollAmount pixels
 */
interface UseHorizontalScrollResult {
  ref: RefObject<HTMLDivElement | null>;
  showLeft: boolean;
  showRight: boolean;
  onScroll: () => void;
  scrollLeft: () => void;
  scrollRight: () => void;
}

/**
 * Scroll threshold in pixels.
 *
 * Prevents arrows from toggling at exact 0 boundary.
 * Without threshold, arrows might flicker when user scrolls to exact edge.
 * 10px buffer zone provides smoother UX.
 */
const SCROLL_THRESHOLD = 10;

/**
 * Calculates which navigation arrows should be visible based on current scroll position.
 *
 * Logic:
 * - Left arrow visible when NOT at left edge (scrollLeft > SCROLL_THRESHOLD)
 * - Right arrow visible when NOT at right edge (scrollLeft < scrollWidth - clientWidth - SCROLL_THRESHOLD)
 *
 * @param el - HTMLDivElement with horizontal scroll content
 * @returns Object containing boolean flags for left and right arrow visibility
 */
const calculateShowState = (el: HTMLDivElement) => {
  const { scrollLeft, scrollWidth, clientWidth } = el;
  const atLeft = scrollLeft <= SCROLL_THRESHOLD;
  const atRight = scrollLeft >= scrollWidth - clientWidth - SCROLL_THRESHOLD;

  return {
    showLeft: !atLeft,
    showRight: !atRight,
  };
};

/**
 * useHorizontalScroll - Hook for managing horizontal scroll container state.
 *
 * Usage example:
 * ```tsx
 * const { ref, showLeft, showRight, onScroll, scrollLeft, scrollRight } = useHorizontalScroll(320);
 *
 * return (
 *   <div className="relative">
 *     {showLeft && <button onClick={scrollLeft}>←</button>}
 *     <div ref={ref} onScroll={onScroll} className="overflow-x-auto">
 *       <div className="flex gap-4">{items}</div>
 *     </div>
 *     {showRight && <button onClick={scrollRight}>→</button>}
 *   </div>
 * );
 * ```
 *
 * Initial state:
 * - showLeft: false (assumes scrolled to left edge initially)
 * - showRight: true (assumes content exists to right, will be corrected on first scroll)
 *
 * Why initial showRight = true?
 * - Most horizontal scroll containers start at left edge with content overflowing
 * - Setting showRight = true prevents right arrow from flashing as "hidden" then "visible"
 * - Initial onScroll call will correct state if content doesn't actually overflow
 *
 * Scroll amount (scrollAmount):
 * - Should match approximate card width + gap for optimal UX
 * - Example: Card width 280px + gap 16px = 296px, use 300px
 * - Default 320px works for standard BeatStream cards
 *
 * @param scrollAmount - Number of pixels to scroll on each button click (default: 320)
 * @returns Object containing ref, visibility flags, scroll handlers, and onScroll callback
 */
export const useHorizontalScroll = (
  scrollAmount = 320,
): UseHorizontalScrollResult => {
  /**
   * Ref attached to the scrollable container element.
   * Used for reading scroll properties and imperatively scrolling.
   */
  const ref = useRef<HTMLDivElement>(null);

  /**
   * State for left arrow visibility.
   * Initial: false (assumes at left edge).
   */
  const [showLeft, setShowLeft] = useState(false);

  /**
   * State for right arrow visibility.
   * Initial: true (assumes content to right, will correct on first scroll).
   */
  const [showRight, setShowRight] = useState(true);

  /**
   * Scroll event handler - updates arrow visibility based on current scroll position.
   *
   * Called on every scroll event (user scrolls via mouse wheel, touch, or arrow buttons).
   * Should be attached to the scrollable container's onScroll prop.
   *
   * Performance: useCallback ensures stable reference, prevents reattachment.
   */
  const onScroll = useCallback(() => {
    const el = ref.current;
    if (!el) {
      return;
    }

    const nextState = calculateShowState(el);

    setShowLeft(nextState.showLeft);
    setShowRight(nextState.showRight);
  }, []);

  /**
   * Scrolls the container left by scrollAmount pixels.
   *
   * Uses native scrollBy with smooth behavior for fluid animation.
   * Wrapped in try/catch to handle edge cases where element is no longer in DOM.
   *
   * Why smooth behavior?
   * - Provides visual feedback that scroll occurred
   * - Matches user expectations for carousel navigation
   * - GPU-accelerated by browser
   */
  const scrollLeft = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    try {
      el.scrollBy({ left: -scrollAmount, behavior: "smooth" });
    } catch (err) {
      console.warn("useHorizontalScroll: failed to scroll left", err);
    }
  }, [scrollAmount]);

  /**
   * Scrolls the container right by scrollAmount pixels.
   *
   * Similar to scrollLeft, scrolls in positive direction.
   */
  const scrollRight = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    try {
      el.scrollBy({ left: scrollAmount, behavior: "smooth" });
    } catch (err) {
      console.warn("useHorizontalScroll: failed to scroll right", err);
    }
  }, [scrollAmount]);

  /**
   * Memoized result object.
   *
   * Prevents consumer components from re-rendering when hook's internal state changes
   * but the returned object reference remains the same.
   *
   * Dependencies include all state values and callbacks.
   */
  const result = useMemo(
    () => ({ ref, showLeft, showRight, onScroll, scrollLeft, scrollRight }),
    [showLeft, showRight, onScroll, scrollLeft, scrollRight],
  );

  return result;
};