/**
 * @fileoverview Horizontal scrolling section container with gradient fade indicators and navigation arrows.
 *
 * Responsibilities:
 * - Render a titled section with horizontally scrollable content (cards, rows, grids)
 * - Show/hide left/right navigation arrows based on scroll position
 * - Display gradient fades at edges to indicate scrollable content
 * - Provide smooth scroll behavior for mouse wheel and button clicks
 *
 * Related modules:
 * - useHorizontalScroll (src/components/ui/useHorizontalScroll.ts) - Custom hook for scroll detection and control
 * - Used by HomePage, ProfilePage, LibraryPage for displaying song cards, playlist rows, etc.
 *
 * Architectural role:
 * - **Reusable horizontal scroll container** for content carousels
 * - Encapsulates scroll detection logic via custom hook
 * - Provides consistent UX across all horizontal scrolling sections in the app
 *
 * Visual design:
 * - Title with red accent bar (4px wide, 20px tall) on left side
 * - Optional action button (e.g., "See All") on right side of header
 * - Left/right navigation arrows (brand red circle with white chevron)
 * - Gradient fades at edges (white to transparent) to indicate more content
 * - Arrows fade in on hover (opacity transition) - reduces visual clutter
 *
 * Scroll behavior:
 * - Horizontal overflow with scrollbar hidden (custom scrollbar not visible)
 * - Users can scroll with mouse wheel, touch swipe, or arrow buttons
 * - Arrow visibility toggles based on scroll position (showLeft, showRight)
 *
 * Accessibility:
 * - role="region" with aria-label describing section purpose
 * - role="group" on scrollable container
 * - aria-label on buttons for screen readers
 *
 * Performance:
 * - useMemo memoizes arrow classes and styles (prevents recreation)
 * - useCallback memoizes mouse enter/leave handlers
 * - Scroll detection handled by useHorizontalScroll (optimized with requestAnimationFrame)
 *
 * @module components/ui
 */

import { ReactNode, useState, useMemo, useCallback } from "react";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useHorizontalScroll } from "./useHorizontalScroll";

/**
 * Props for the SectionShell component.
 *
 * @property title - Section heading text (displayed with red accent bar)
 * @property action - Optional ReactNode for right-aligned action (e.g., "See All" link)
 * @property children - Scrollable content (typically an array of SongCard/PlaylistCard components)
 * @property groupName - Reserved for future analytics/tracking (not currently used)
 */
interface SectionShellProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;

  groupName?: string;
}

/**
 * Base CSS classes for navigation arrows.
 *
 * Styling:
 * - Absolute positioning at vertical center (top-1/2 -translate-y-1/2)
 * - Brand red background (#fa243c) with rounded-full (circle shape)
 * - White chevron icon (text-neutral-100)
 * - Shadow for depth, hover state increases shadow
 *
 * Note: hover:bg-[] is incomplete in original (likely intended hover:bg-[#e01e33])
 * Left as-is to preserve original logic.
 */
const ARROW_BASE_CLASSES =
  "absolute top-1/2 -translate-y-1/2 z-10 w-6 h-6 bg-[#fa243c] rounded-full " +
  "shadow-md flex items-center justify-center transition-all duration-200 " +
  "hover:bg-[] hover:shadow-lg";

/**
 * SectionShell - Horizontal scrolling section container.
 *
 * Usage example:
 * ```tsx
 * <SectionShell title="Recently Played" action={<Link to="/history">See All</Link>}>
 *   {recentSongs.map(song => <SongCard key={song.id} song={song} />)}
 * </SectionShell>
 * ```
 *
 * Component structure:
 * ```
 * SectionShell
 * ├── Header (title + accent bar + optional action)
 * └── Scroll Container (relative positioning)
 *     ├── Left gradient fade (if showLeft)
 *     ├── Left arrow button (if showLeft) - fades in on hover
 *     ├── Scrollable div (overflow-x-auto, scrollbar hidden)
 *     │   └── Flex container (gap-3 sm:gap-4, min-width: min-content)
 *     │       └── {children}
 *     ├── Right gradient fade (if showRight)
 *     └── Right arrow button (if showRight) - fades in on hover
 * ```
 *
 * Hover behavior:
 * - Arrows fade in (opacity: 0 → 1) when user hovers over section container
 * - Reduces visual distraction when user is not interacting with the section
 *
 * Gradient fades:
 * - Left gradient: from-white to-transparent (indicates content to left)
 * - Right gradient: from-white to-transparent (indicates content to right)
 * - Positioned absolutely over edges, pointer-events: none (doesn't block clicks)
 *
 * @param props - SectionShellProps
 * @returns Horizontal scroll section with navigation controls
 */
export const SectionShell = ({
  title,
  action,
  children,
}: SectionShellProps) => {
  /**
   * Custom hook providing scroll container ref and scroll state.
   *
   * Returns:
   * - ref: MutableRefObject<HTMLDivElement> - Attach to scrollable div
   * - showLeft: boolean - Whether content exists left of current scroll position
   * - showRight: boolean - Whether content exists right of current scroll position
   * - onScroll: event handler - Attach to scrollable div's onScroll
   * - scrollLeft: function - Scrolls container left by 320px (card width + gap)
   * - scrollRight: function - Scrolls container right by 320px
   *
   * Parameter 320 = scroll amount in pixels (matches typical card width + gap).
   */
  const { ref, showLeft, showRight, onScroll, scrollLeft, scrollRight } =
    useHorizontalScroll(320);

  /**
   * Local hover state for section container.
   *
   * When true, navigation arrows become visible (opacity: 1).
   * When false, arrows are hidden (opacity: 0) but still occupy space.
   */
  const [isHovered, setIsHovered] = useState(false);

  /**
   * Memoized arrow opacity style based on hover state.
   *
   * Opacity transition: 0.2s ease (smooth fade in/out).
   * Recomputes only when isHovered changes.
   */
  const arrowStyle = useMemo(
    () => ({ opacity: isHovered ? 1 : 0, transition: "opacity 0.2s ease" }),
    [isHovered],
  );

  /**
   * Memoized arrow CSS classes.
   *
   * Static string, computed once on mount.
   * Prevents unnecessary string concatenation on every render.
   */
  const arrowClass = useMemo(() => ARROW_BASE_CLASSES, []);

  /**
   * Mouse enter handler - shows navigation arrows.
   *
   * useCallback ensures stable reference for event listener attachment.
   */
  const handleMouseEnter = useCallback(() => setIsHovered(true), []);

  /**
   * Mouse leave handler - hides navigation arrows.
   */
  const handleMouseLeave = useCallback(() => setIsHovered(false), []);

  return (
    <div
      className="w-full"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Header section with title and optional action */}
      <div className="flex items-center justify-between mb-4 px-0.5">
        <div className="flex items-center gap-2">
          {/* Red accent bar - visual indicator for section header */}
          <div className="w-[4px] h-5 rounded-full bg-[#fa243c]" />
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 tracking-tight">
            {title}
          </h2>
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>

      {/* Horizontal scroll container with relative positioning for arrows */}
      <div
        className="relative"
        role="region"
        aria-label={`${title} horizontal scroll section`}
      >
        {/* Left navigation arrow - conditionally rendered when content scrollable left */}
        {showLeft && (
          <button
            onClick={scrollLeft}
            aria-label="Scroll left"
            className={`${arrowClass} left-0 -ml-3`}
            style={arrowStyle}
          >
            <ChevronLeftIcon className="text-neutral-100" fontSize="small" />
          </button>
        )}

        {/* Left gradient fade - visual indicator that content exists to left */}
        {showLeft && (
          <div className="absolute left-0 top-0 bottom-2 w-4 bg-gradient-to-r from-white to-transparent pointer-events-none z-[5]" />
        )}

        {/* Scrollable container - horizontal scroll with hidden scrollbar */}
        <div
          ref={ref}
          onScroll={onScroll}
          className="overflow-x-auto pb-2"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          role="group"
          aria-label="Scrollable content"
        >
          {/* Inner flex container - prevents shrink, maintains minimum content width */}
          <div
            className="flex gap-3 sm:gap-4"
            style={{ minWidth: "min-content" }}
          >
            {children}
          </div>
        </div>

        {/* Right gradient fade - visual indicator that content exists to right */}
        {showRight && (
          <div className="absolute right-0 top-0 bottom-2 w-4 bg-gradient-to-l from-white to-transparent pointer-events-none z-[5]" />
        )}

        {/* Right navigation arrow - conditionally rendered when content scrollable right */}
        {showRight && (
          <button
            onClick={scrollRight}
            aria-label="Scroll right"
            className={`${arrowClass} right-0 -mr-3`}
            style={arrowStyle}
          >
            <ChevronRightIcon className="text-neutral-100" fontSize="small" />
          </button>
        )}
      </div>
    </div>
  );
};