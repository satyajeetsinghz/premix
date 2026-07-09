/**
 * @fileoverview Reusable modal component for displaying rich text descriptions (e.g., song/album notes, artist bios).
 * Dark, centered card variant, matching Apple Music Web's "About" panel: a dimmed backdrop
 * that still shows the page behind it, a rounded dark-gray card floating in the center, a
 * plain close icon top-left, bold title + muted gray subtitle, a hairline divider, and a
 * scrollable body with a visible thin scrollbar and a bottom fade mask.
 *
 * Responsibilities:
 * - Render a centered modal card with a dimmed (non-blurred) overlay backdrop
 * - Display title, subtitle (muted gray, matching the reference), and multi-paragraph description
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
 * - Centered floating card over a dimmed backdrop — the reference keeps the page (sidebar,
 *   album art, track list) visible and simply darkened behind the card, rather than blurring
 *   or fully replacing it with a full-screen sheet.
 *
 * Design tokens (dark card, matched to reference):
 * - Overlay: solid dim (~45% black), no blur — the page stays sharp behind the card
 * - Card surface: dark gray (#2c2c2e), rounded-2xl corners, subtle shadow for lift
 * - Card width: wide (up to ~860px), height capped so the page frame stays visible around it
 * - Close icon: top-left, plain (no background chip), gray → white on hover
 * - Title: large, bold, near-white
 * - Subtitle: muted gray ("Artist · Year"), not the brand red
 * - Hairline divider beneath the header, separating it from the scrollable body
 * - Body text: off-white, generous line-height for long-form reading
 * - Custom scrollbar: thin gray thumb on a barely-visible track
 * - Bottom fade mask: content fades to the card background near the bottom edge of the
 *   scroll area, signaling there's more to scroll
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
 * @property subtitle - Secondary text displayed below title (e.g., "Artist · Year")
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
 * - MODAL_MAX_WIDTH: 860px — wide enough for the reference's generous line length while
 *   still leaving the page frame (sidebar, artwork) visible around it
 * - MODAL_MAX_HEIGHT: 78vh — keeps the card well inside the viewport so the dimmed
 *   backdrop reads clearly on all sides
 */
const MODAL_MAX_WIDTH = 860;
const MODAL_MAX_HEIGHT = "78vh";

/**
 * Dark card design tokens.
 * Centralized so the surface/text treatment stays consistent and easy to retune.
 */
const OVERLAY = "rgba(0,0,0,0.55)";
const CARD_BG = "#1f1f1f";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT_TITLE = "#f5f5f7";
const TEXT_SUBTITLE = "#8e8e93";
const TEXT_BODY = "rgba(245,245,247,0.92)";
const CLOSE_ICON = "#8e8e93";
const CLOSE_ICON_HOVER = "#f5f5f7";
const SCROLLBAR_CLASS = "description-modal-scroll";

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
 * DescriptionModal - Centered dark card for displaying formatted text content.
 *
 * Usage example:
 * ```tsx
 * <DescriptionModal
 *   title="Album Title"
 *   subtitle="Artist · Year"
 *   description="First paragraph of editorial copy...\n\nSecond paragraph..."
 *   onClose={() => setShowModal(false)}
 * />
 * ```
 *
 * Visual hierarchy:
 * 1. Title (28-32px bold, tight tracking, near-white) — pinned in the header
 * 2. Subtitle (14px medium, muted gray) — pinned in the header, directly under the title
 * 3. Description paragraphs (16px, 1.7 line height) — scrollable body beneath a hairline divider
 *
 * Dismissal methods:
 * - Clicking the dimmed backdrop
 * - Pressing Escape key
 * - Clicking the close icon (top-left, matching the reference)
 *
 * @param props - DescriptionModalProps
 * @returns Portal-rendered modal card
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
      className="fixed inset-0 z-[200] flex items-center justify-center p-7 sm:p-14 animate-in fade-in duration-200"
      style={{ backgroundColor: OVERLAY }}
      onClick={handleOverlayClick}
      role="presentation"
    >
      {/* Scoped scrollbar styling — thin gray thumb on a near-invisible track,
          matching the visible custom scrollbar in the reference rather than
          leaving the browser default in place. */}
      <style>{`
        .${SCROLLBAR_CLASS}::-webkit-scrollbar {
          width: 8px;
        }
        .${SCROLLBAR_CLASS}::-webkit-scrollbar-track {
          background: transparent;
        }
        .${SCROLLBAR_CLASS}::-webkit-scrollbar-thumb {
          background-color: rgba(255,255,255,0.28);
          border-radius: 9999px;
        }
        .${SCROLLBAR_CLASS}::-webkit-scrollbar-thumb:hover {
          background-color: rgba(255,255,255,0.4);
        }
        .${SCROLLBAR_CLASS} {
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.28) transparent;
        }
      `}</style>

      <div
        className="relative w-full rounded-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        style={{
          maxWidth: MODAL_MAX_WIDTH,
          maxHeight: MODAL_MAX_HEIGHT,
          backgroundColor: CARD_BG,
          boxShadow: "0 24px 70px rgba(0,0,0,0.5)",
        }}
        role="dialog"
        aria-modal="true"
        aria-label={`${title} description`}
      >
        {/* Close button - top-left, plain icon, matching the reference */}
        <button
          onClick={onClose}
          className="absolute top-3 left-3 z-10 w-8 h-8 flex items-center justify-center rounded-full transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ color: CLOSE_ICON, outlineColor: "#0a84ff" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = CLOSE_ICON_HOVER)}
          onMouseLeave={(e) => (e.currentTarget.style.color = CLOSE_ICON)}
          aria-label="Close description modal"
        >
          <CloseIcon sx={{ fontSize: 34 }} />
        </button>

        {/* Header — title + subtitle, hairline divider beneath */}
        <div
          className="pt-14 pb-3 px-5"
          style={{ borderBottom: `1px solid ${BORDER}` }}
        >
          <h2
            className="text-[26px] sm:text-[30px] font-semibold tracking-tight pr-8"
            style={{ color: TEXT_TITLE }}
          >
            {title}
          </h2>
          <p
            className="text-[14px] font-semibold -mt-[6px]"
            style={{ color: TEXT_SUBTITLE }}
          >
            {subtitle}
          </p>
        </div>

        {/* Scrollable content area with bottom fade mask hinting more content below */}
        <div
          className={`overflow-y-auto px-5 pt-2 pb-12 ${SCROLLBAR_CLASS}`}
          style={{
            maxHeight: `calc(${MODAL_MAX_HEIGHT} - 110px)`,
            maskImage:
              "linear-gradient(to bottom, black 0%, black 92%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, black 0%, black 92%, transparent 100%)",
          }}
        >
          <div
            className="text-[15px] space-y-4"
            style={{ color: TEXT_BODY }}
          >
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