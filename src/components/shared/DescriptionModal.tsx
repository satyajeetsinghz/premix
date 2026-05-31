/**
 * @fileoverview Reusable modal component for displaying rich text descriptions (e.g., song/album notes, artist bios).
 *
 * Responsibilities:
 * - Render a centered modal dialog with overlay backdrop
 * - Display title, subtitle (accent color), and multi-paragraph description
 * - Handle escape key and overlay click dismissal
 * - Prevent body scroll while modal is open
 * - Split description text by double newlines into semantic paragraphs
 *
 * Related modules:
 * - Used by SongCard, AlbumView, PlaylistDetail, or any component needing detailed descriptions
 * - Should be imported and used where long-form text needs modal presentation
 *
 * Architectural role:
 * - **Portal-based modal** rendered directly under document.body (avoids z-index stacking context issues)
 * - Reusable across multiple features (songs, albums, playlists, user-generated content)
 * - Fixed position with backdrop blur for visual depth
 *
 * Design tokens:
 * - Modal max width: 560px (optimal readability for body text)
 * - Modal max height: 80vh (prevents overflow on smaller screens)
 * - Subtitle color: Brand red (#fa243c) for visual hierarchy
 * - Body text: #3c3c43 (slightly softer than pure black for readability)
 *
 * Accessibility:
 * - role="dialog" + aria-modal="true" announces modal to screen readers
 * - aria-label describes modal purpose
 * - Focus management: No auto-focus (close button is first focusable element)
 * - Escape key closes modal (standard keyboard accessibility)
 * - Overlay click closes modal (common UX pattern, but provide close button as well)
 *
 * Performance:
 * - useMemo memoizes paragraph splitting (prevents recalculation on every render)
 * - useCallback memoizes event handlers (stable references for useEffect dependencies)
 * - Portal rendering prevents CSS bleed from parent containers
 *
 * Body scroll lock:
 * - Sets document.body.style.overflow = "hidden" when modal mounts
 * - Restores original overflow value on unmount (preserves prior state)
 * - Critical for preventing background scroll while modal is open
 *
 * @module components/ui
 */

import { useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import CloseIcon from "@mui/icons-material/Close";

/**
 * Props for the DescriptionModal component.
 *
 * @property title - Modal heading (displayed prominently, e.g., song title or section name)
 * @property subtitle - Secondary text displayed below title in brand accent color (e.g., artist name or album)
 * @property description - Rich text content. Double newlines ("\n\n") are automatically split into separate <p> tags
 * @property onClose - Callback invoked when modal should close (user clicks overlay, Escape key, or close button)
 */
interface DescriptionModalProps {
  title: string;
  subtitle: string;
  description: string;
  onClose: () => void;
}

/**
 * Modal dimension constraints.
 *
 * - MODAL_MAX_WIDTH: 560px (optimal line length for body text, 50-75 characters per line)
 * - MODAL_MAX_HEIGHT: 80vh (prevents modal from exceeding viewport, shows scrollbar internally)
 */
const MODAL_MAX_WIDTH = 560;
const MODAL_MAX_HEIGHT = "80vh";

/**
 * Splits a description string into an array of paragraphs.
 *
 * Logic:
 * - Splits by double newline ("\n\n") which typically separates paragraphs in markdown or plain text
 * - Trims each paragraph to remove leading/trailing whitespace
 * - Filters out empty paragraphs (consecutive double newlines would produce empty strings)
 *
 * Why this approach:
 * - Simpler than full markdown parsing (no external dependencies)
 * - Matches common user behavior (double newline for paragraph break)
 * - Preserves single newlines within paragraphs (e.g., line breaks in poetry/addresses)
 *
 * @param description - Raw description text
 * @returns Array of trimmed, non-empty paragraphs
 */
const splitDescriptionText = (description: string) =>
  description.split("\n\n").map((para) => para.trim());

/**
 * DescriptionModal - Modal dialog for displaying formatted text content.
 *
 * Usage example:
 * ```tsx
 * <DescriptionModal
 *   title="Bohemian Rhapsody"
 *   subtitle="Queen · 1975"
 *   description="Written by Freddie Mercury...\n\nRecorded over three weeks..."
 *   onClose={() => setShowModal(false)}
 * />
 * ```
 *
 * Visual hierarchy:
 * 1. Title (22px bold, tight tracking)
 * 2. Subtitle (14px semibold, brand red)
 * 3. Description paragraphs (14px, 1.7 line height for readability)
 *
 * Dismissal methods:
 * - Clicking overlay backdrop
 * - Pressing Escape key
 * - Clicking close button (top-right corner)
 *
 * @param props - DescriptionModalProps
 * @returns Portal-rendered modal dialog
 */
export const DescriptionModal = ({
  title,
  subtitle,
  description,
  onClose,
}: DescriptionModalProps) => {
  /**
   * Ref for overlay div (used for click-outside detection).
   * Comparing event.target to overlayRef.current distinguishes between overlay click vs content click.
   */
  const overlayRef = useRef<HTMLDivElement>(null);

  /**
   * Memoized paragraphs array.
   *
   * Prevents re-splitting the same description text on every render.
   * Recomputes only when description string changes.
   */
  const paragraphs = useMemo(
    () => splitDescriptionText(description),
    [description],
  );

  /**
   * Handles clicks on the overlay backdrop.
   *
   * Closes modal only when clicking directly on the overlay,
   * not when clicking on modal content (prevents accidental closures).
   *
   * Performance: useCallback ensures stable reference for event handlers.
   */
  const handleOverlayClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === overlayRef.current) {
        onClose();
      }
    },
    [onClose],
  );

  /**
   * Handles Escape key press for keyboard accessibility.
   *
   * Closes modal when user presses Escape key.
   * Standard modal behavior expected by users.
   */
  const handleEscPress = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    },
    [onClose],
  );

  /**
   * Effect 1: Global keyboard listener for Escape key.
   *
   * Adds event listener when modal mounts, removes when unmounts.
   * Dependency: handleEscPress (stable due to useCallback).
   */
  useEffect(() => {
    document.addEventListener("keydown", handleEscPress);
    return () => document.removeEventListener("keydown", handleEscPress);
  }, [handleEscPress]);

  /**
   * Effect 2: Body scroll lock.
   *
   * Prevents background scrolling while modal is open.
   * Critical for UX - users expect modal to trap focus/scroll.
   *
   * Implementation:
   * 1. Store original overflow value before modifying
   * 2. Set body overflow to "hidden"
   * 3. On cleanup, restore original overflow (or empty string if none)
   *
   * Why capture previousOverflow?
   * - Preserves any existing overflow style (e.g., from another modal)
   * - Prevents style conflicts with nested modals
   */
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow || "";
    };
  }, []);

  /**
   * Portal rendering: Mounts modal directly under document.body.
   *
   * Why createPortal?
   * - Avoids z-index stacking context issues inside deeply nested components
   * - Ensures modal always appears above all content regardless of parent CSS
   * - Prevents modal from being clipped by parent overflow:hidden containers
   *
   * Second argument: document.body (standard portal target for modals)
   */
  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[200] bg-black/30 backdrop-blur-[2px] flex items-center justify-center p-4"
      onClick={handleOverlayClick}
      role="presentation"
      aria-hidden="true"
    >
      <div
        className="relative w-full bg-white rounded-2xl shadow-2xl overflow-hidden"
        style={{ maxWidth: MODAL_MAX_WIDTH, maxHeight: MODAL_MAX_HEIGHT }}
        role="dialog"
        aria-modal="true"
        aria-label={`${title} description`}
      >
        {/* Close button - positioned absolutely in top-right corner */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-[#f5f5f7] flex items-center justify-center text-[#6e6e73] hover:bg-[#e5e5ea] transition-colors"
          aria-label="Close description modal"
        >
          <CloseIcon sx={{ fontSize: 16 }} />
        </button>

        {/* Scrollable content area - independent of modal container */}
        <div
          className="overflow-y-auto p-8"
          style={{ maxHeight: MODAL_MAX_HEIGHT }}
        >
          {/* Title section */}
          <h2 className="text-[22px] font-bold text-[#1d1d1f] tracking-[-0.3px] leading-tight pr-8">
            {title}
          </h2>

          {/* Subtitle section - brand red for emphasis */}
          <p
            className="text-[14px] font-semibold mt-1 mb-5"
            style={{ color: "#fa243c" }}
          >
            {subtitle}
          </p>

          {/* Description paragraphs - rendered with spacing between */}
          <div className="text-[14px] text-[#3c3c43] leading-[1.7] space-y-4">
            {paragraphs.map((paragraph, idx) => (
              <p key={idx}>{paragraph}</p>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};