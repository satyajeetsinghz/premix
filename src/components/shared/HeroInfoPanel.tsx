/**
 * @fileoverview Information panel component for hero sections (profile page, playlist header, album view).
 *
 * Responsibilities:
 * - Display title, subtitle (brand red), and truncated description with "Read More" expander
 * - Render metadata (stats, counts, timestamps) and action buttons (play, shuffle, like, etc.)
 * - Provide responsive layout: horizontal on desktop, stacked centered on mobile
 * - Manage description modal state (opens full description in modal dialog)
 *
 * Related modules:
 * - DescriptionModal (src/components/ui/DescriptionModal.tsx) - Displays full description when truncated
 * - ProfilePage (src/features/profile/ProfilePage.tsx) - Uses HeroInfoPanel for user header
 * - PlaylistPage (src/features/playlists/pages/PlaylistPage.tsx) - Uses HeroInfoPanel for playlist header
 *
 * Architectural role:
 * - **Reusable hero component** for pages with cover art + metadata header
 * - Encapsulates description truncation logic and modal triggering
 * - Provides consistent layout pattern across profile, playlist, and album pages
 *
 * Visual design (Apple Music style):
 * - Fixed cover height: 220px (paired with external cover image of same height)
 * - Title: clamp(28px, 3.5vw, 42px) - responsive fluid typography
 * - Subtitle: brand red (#fa243c) for visual hierarchy
 * - Description: 2-line clamp with fade-to-gray on hover + "Read More" link
 *
 * Responsive behavior:
 * - Desktop (≥ 640px): Horizontal layout with fixed height (matches cover image)
 * - Mobile (< 640px): Stacked vertical layout with centered text and full-width actions
 *
 * Description truncation logic:
 * - WebKit line clamp (2 lines) for cross-browser text truncation
 * - "Read More" link appears on hover (fades in with opacity transition)
 * - Clicking opens DescriptionModal with full text
 *
 * Performance:
 * - useMemo memoizes descriptionClampedStyle (static object, computed once)
 * - useCallback memoizes openModal/closeModal (stable references for child components)
 * - Modal conditionally rendered only when modalOpen = true (lazy initialization)
 *
 * Accessibility:
 * - button element for description expander (keyboard accessible)
 * - aria-label="Expand description" for screen readers
 * - title attribute provides tooltip on hover
 *
 * @module components/ui
 */

import { useState, useMemo, useCallback, CSSProperties } from "react";
import { ReactNode } from "react";
import { DescriptionModal } from "./DescriptionModal";

/**
 * Props for the HeroInfoPanel component.
 *
 * @property title - Primary heading (e.g., playlist name, user name)
 * @property subtitle - Secondary text in brand color (e.g., artist name, "Playlist · 50 songs")
 * @property description - Long-form text. Displays 2 lines clamped; full text in modal on click
 * @property meta - Metadata ReactNode (e.g., like count, creation date, song count)
 * @property actions - Action buttons ReactNode (e.g., Play button, Like button, Share button)
 */
interface HeroInfoPanelProps {
  title: string;
  subtitle: string;
  description: string;
  meta: ReactNode;
  actions: ReactNode;
}

/**
 * Fixed cover image height (matches external cover image dimensions).
 *
 * Used to align info panel with cover art horizontally on desktop.
 * Value: 220px (standard for album/playlist cover art in Premix).
 */
const COVER_H = 220;

/**
 * Returns CSS styles for 2-line text clamping.
 *
 * Implementation notes:
 * - Uses -webkit-line-clamp (supported in all modern browsers)
 * - WebkitBoxOrient requires 'vertical' string, but TypeScript expects a specific type
 * - Type assertion used to bypass TypeScript's limited CSSProperties type for this vendor property
 *
 * @returns CSSProperties object with line clamp configuration
 */
const getDescriptionClampedStyle = (): CSSProperties => ({
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical" as unknown as CSSProperties["WebkitBoxOrient"],
  overflow: "hidden",
  maxWidth: 520,
});

/**
 * HeroInfoPanel - Information panel for page hero sections.
 *
 * Usage example (PlaylistPage):
 * ```tsx
 * <HeroInfoPanel
 *   title="Chill Vibes"
 *   subtitle="Playlist · 42 songs"
 *   description="Lo-fi beats and ambient tracks for focus and relaxation..."
 *   meta={<span>Created by user • Updated 2 days ago</span>}
 *   actions={<PlayButton />}
 * />
 * ```
 *
 * Layout structure:
 * - Desktop: Title/Subtitle top, Description middle, Metadata + Actions bottom (fixed height container)
 * - Mobile: Centered stacked layout with full-width actions below metadata
 *
 * Description modal flow:
 * 1. User clicks on description text or "Read More" link
 * 2. setModalOpen(true) triggers modal render
 * 3. DescriptionModal displays full text in portal dialog
 * 4. User closes modal via overlay click, Escape key, or close button
 *
 * @param props - HeroInfoPanelProps
 * @returns Hero info panel with responsive layout and optional modal
 */
export const HeroInfoPanel = ({
  title,
  subtitle,
  description,
  meta,
  actions,
}: HeroInfoPanelProps) => {
  /**
   * Modal visibility state.
   *
   * When true, DescriptionModal renders (portal to document.body).
   * When false, modal is not rendered (lazy initialization).
   */
  const [modalOpen, setModalOpen] = useState(false);

  /**
   * Memoized description clamp styles.
   *
   * Static object (no dependencies), computed once on mount.
   * Prevents recreation on every render.
   */
  const descriptionClampedStyle = useMemo(
    () => getDescriptionClampedStyle(),
    [],
  );

  /**
   * Opens description modal.
   *
   * Only opens if description exists (prevents empty modal).
   * Wrapped in useCallback to maintain stable reference.
   */
  const openModal = useCallback(() => {
    if (!description) return;
    setModalOpen(true);
  }, [description]);

  /**
   * Closes description modal.
   *
   * Wrapped in useCallback for stable reference (used in useEffect of DescriptionModal).
   */
  const closeModal = useCallback(() => {
    setModalOpen(false);
  }, []);

  /**
   * Renders the description section with truncation and expand functionality.
   *
   * Returns null if no description provided.
   *
   * Interactive behavior:
   * - Entire button area is clickable (not just "Read More" text)
   * - Description text color darkens on hover (group-hover)
   * - "Read More" text fades in on hover (opacity transition)
   *
   * Accessibility:
   * - button element enables keyboard navigation
   * - title attribute provides tooltip
   * - aria-label describes action for screen readers
   *
   * @returns JSX element or null
   */
  const renderDescription = () => {
    if (!description) return null;

    return (
      <div className="mt-3 flex-1 flex items-start">
        <button
          className="text-left group w-full"
          onClick={openModal}
          title="Click to read more"
          aria-label="Expand description"
        >
          <p
            className="text-[13px] text-[#6e6e73] leading-[1.6] group-hover:text-[#3c3c43] transition-colors"
            style={descriptionClampedStyle}
          >
            {description}
          </p>
          <span
            className="text-[12px] font-medium mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: "#fa243c" }}
          >
            Read More
          </span>
        </button>
      </div>
    );
  };

  return (
    <>
      {/* Desktop layout (≥ 640px) - horizontal with fixed height */}
      <div
        className="flex-1 hidden sm:flex flex-col text-left"
        style={{ height: COVER_H }}
      >
        {/* Top section: Title and subtitle */}
        <div>
          <h1
            className="font-bold text-[#1d1d1f] tracking-[-0.5px] leading-none"
            style={{ fontSize: "clamp(28px, 3.5vw, 42px)" }}
          >
            {title}
          </h1>
          <p
            className="text-[17px] font-semibold mt-1.5"
            style={{ color: "#fa243c" }}
          >
            {subtitle}
          </p>
        </div>

        {/* Middle section: Description (if exists) */}
        {renderDescription()}

        {/* Bottom section: Metadata and actions (pushed to bottom via mt-auto) */}
        <div className="mt-auto">
          <div className="text-[12px] text-[#6e6e73] mb-4">{meta}</div>
          <div className="flex items-center gap-3">{actions}</div>
        </div>
      </div>

      {/* Mobile layout (< 640px) - stacked vertical with center alignment */}
      <div className="flex sm:hidden flex-col items-center text-center gap-4 w-full">
        <div>
          <h1 className="text-[28px] font-bold text-[#1d1d1f] tracking-[-0.4px] leading-tight">
            {title}
          </h1>
          <p
            className="text-[16px] font-semibold mt-1"
            style={{ color: "#fa243c" }}
          >
            {subtitle}
          </p>
        </div>

        {/* Metadata - horizontal padding for better mobile readability */}
        <div className="text-[12px] text-[#6e6e73] px-4">{meta}</div>

        {/* Actions - full width for buttons to extend edge-to-edge */}
        <div className="w-full px-4">{actions}</div>
      </div>

      {/* Description modal - conditionally rendered when user clicks expand */}
      {modalOpen && (
        <DescriptionModal
          title={title}
          subtitle={subtitle}
          description={description}
          onClose={closeModal}
        />
      )}
    </>
  );
};