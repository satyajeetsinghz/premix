/**
 * @fileoverview Centralized responsive breakpoint detection hook for BeatStream layout system.
 *
 * Responsibilities:
 * - Provide comprehensive device/viewport detection flags from a single hook
 * - Expose canonical layout flags (showMobileNav, showDesktopSidebar) used across components
 * - Aggregate granular breakpoint queries into semantic, reusable booleans
 *
 * Related modules:
 * - Sidebar (src/components/layout/Sidebar.tsx) - Uses showDesktopSidebar
 * - MobileNav (src/components/layout/MobileNav.tsx) - Uses showMobileNav
 * - MainLayout (src/components/layout/MainLayout.tsx) - Uses isDesktop, isMobile for padding calculations
 * - PlayerBar (src/features/player/components/PlayerBar.tsx) - Uses device for responsive sizing
 *
 * Architectural role:
 * - **CANONICAL SOURCE OF TRUTH** for all responsive behavior in BeatStream
 * - Per HANDOFF_CORE.md: "Never re-derive these from isMobile/isTablet booleans inline — always use these canonical flags"
 * - Single point of modification if breakpoint values change
 * - Prevents fragmentation where different components use different breakpoint logic
 *
 * Why this abstraction instead of inline useMediaQuery calls?
 * - Centralizes breakpoint values (prevents magic numbers spread across codebase)
 * - Provides semantic names (isSmallMobile vs isMobile && width < 390)
 * - Ensures consistent device detection across all components
 * - Reduces duplicate useMediaQuery hooks (performance benefit)
 *
 * Breakpoint hierarchy (from HANDOFF_CORE.md):
 * - Mobile: ≤ 767px
 * - Tablet: 768px - 1179px
 * - Desktop: ≥ 1180px (sidebar visible threshold)
 *
 * Additional fine-grained breakpoints:
 * - Small mobile: ≤ 389px (iPhone SE, older Androids)
 * - Standard mobile: 390px - 767px (iPhone 12/13/14, modern Androids)
 * - Small tablet: 768px - 899px (iPad Mini portrait)
 * - Standard tablet: 900px - 1179px (iPad Air/Pro portrait)
 * - Small desktop: 1180px - 1439px (sidebar visible, compact desktop)
 * - Large desktop: 1440px - 1919px (standard desktop)
 * - XL desktop: ≥ 1920px (large monitors, 4K displays)
 *
 * Orientation detection:
 * - isLandscape / isPortrait - Critical for video players and carousels
 *
 * Touch detection:
 * - isTouch - Detects devices with coarse pointer (touchscreens)
 * - Uses (hover: none) and (pointer: coarse) - Modern, accurate touch detection
 * - Fallback for non-hover devices without pointer precision
 *
 * Performance:
 * - Each useMediaQuery creates its own subscription (8 total)
 * - All subscriptions respond to same resize events (batched by browser)
 * - Component re-renders when ANY queried breakpoint changes
 * - Memoization not needed as hook returns new object reference on every change
 *
 * @module components/layout/hooks
 */

import { useMediaQuery } from "./useMediaQuery";

/**
 * Comprehensive responsive state interface.
 *
 * Contains three categories of flags:
 * 1. Device type flags (isMobile, isTablet, isDesktop)
 * 2. Granular breakpoint flags (isSmallMobile, isStandardTablet, etc.)
 * 3. Utility flags (isLandscape, isTouch, device string)
 * 4. **Canonical layout flags** (showMobileNav, showDesktopSidebar)
 *
 * @property isMobile - Width ≤ 767px
 * @property isTablet - Width between 768px and 1179px (inclusive)
 * @property isDesktop - Width ≥ 1180px
 * @property isSmallDesktop - Desktop narrow: 1180px - 1439px
 * @property isLargeDesktop - Desktop standard: 1440px - 1919px
 * @property isXLDesktop - Desktop wide: ≥ 1920px
 * @property isSmallMobile - Mobile narrow: ≤ 389px (iPhone SE)
 * @property isStandardMobile - Mobile standard: 390px - 767px
 * @property isSmallTablet - Tablet narrow: 768px - 899px (iPad Mini)
 * @property isStandardTablet - Tablet standard: 900px - 1179px
 * @property isLandscape - Viewport width > height
 * @property isPortrait - Viewport height > width
 * @property isTouch - Device supports touch (coarse pointer, no hover)
 * @property showMobileNav - **Canonical flag:** true when mobile OR tablet navigation should be shown
 * @property showDesktopSidebar - **Canonical flag:** true when desktop sidebar should be visible (≥ 1180px)
 * @property device - String literal: "mobile" | "tablet" | "desktop"
 */
interface ResponsiveState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;

  isSmallDesktop: boolean;
  isLargeDesktop: boolean;
  isXLDesktop: boolean;

  isSmallMobile: boolean;
  isStandardMobile: boolean;

  isSmallTablet: boolean;
  isStandardTablet: boolean;

  isLandscape: boolean;
  isPortrait: boolean;

  isTouch: boolean;

  showMobileNav: boolean;
  showDesktopSidebar: boolean;
  device: "mobile" | "tablet" | "desktop";
}

/**
 * useResponsive - Primary responsive hook for BeatStream layout system.
 *
 * **IMPORTANT: Canonical source of truth for breakpoint detection.**
 * All components MUST use this hook's showMobileNav and showDesktopSidebar flags
 * instead of deriving their own breakpoint logic.
 *
 * Usage examples:
 *
 * ```tsx
 * // Sidebar visibility
 * const { showDesktopSidebar } = useResponsive();
 * if (!showDesktopSidebar) return null;
 *
 * // Mobile navigation
 * const { showMobileNav } = useResponsive();
 * <MobileNav className={showMobileNav ? "block" : "hidden"} />
 *
 * // Content padding
 * const { isDesktop, isMobile } = useResponsive();
 * const paddingBottom = isDesktop ? "pb-24" : isMobile ? "pb-40" : "pb-20";
 * ```
 *
 * Breakpoint decisions (from HANDOFF_CORE.md):
 * - Desktop sidebar visible at 1180px+ (showDesktopSidebar = isDesktop)
 * - Mobile navigation visible below 1180px (showMobileNav = isMobile OR isTablet)
 *
 * Device detection priority:
 * 1. Check isMobile first (narrowest)
 * 2. Then isTablet (medium)
 * 3. Fallback to isDesktop (widest, default)
 *
 * @returns ResponsiveState object with all breakpoint flags
 *
 * @see useMediaQuery - Underlying media query subscription hook
 * @see HANDOFF_CORE.md - Breakpoint specifications and layout requirements
 */
export const useResponsive = (): ResponsiveState => {
  // --- Primary device type detection (mutually exclusive by breakpoint ranges) ---
  const isMobile = useMediaQuery("(max-width: 767px)");
  const isTablet = useMediaQuery("(min-width: 768px) and (max-width: 1179px)");
  const isDesktop = useMediaQuery("(min-width: 1180px)");

  // --- Desktop granular breakpoints ---
  const isSmallDesktop = useMediaQuery(
    "(min-width: 1180px) and (max-width: 1439px)",
  );
  const isLargeDesktop = useMediaQuery("(min-width: 1440px)");
  const isXLDesktop = useMediaQuery("(min-width: 1920px)");

  // --- Mobile granular breakpoints ---
  const isSmallMobile = useMediaQuery("(max-width: 389px)");
  const isStandardMobile = useMediaQuery(
    "(min-width: 390px) and (max-width: 767px)",
  );

  // --- Tablet granular breakpoints ---
  const isSmallTablet = useMediaQuery(
    "(min-width: 768px) and (max-width: 899px)",
  );
  const isStandardTablet = useMediaQuery(
    "(min-width: 900px) and (max-width: 1179px)",
  );

  // --- Orientation detection ---
  // Critical for fullscreen video players and horizontal carousels
  const isLandscape = useMediaQuery("(orientation: landscape)");
  const isPortrait = useMediaQuery("(orientation: portrait)");

  // --- Touch capability detection ---
  // Detects touchscreens where hover states should be disabled
  // Used for optimizing hover effects on mobile/tablet devices
  const isTouch = useMediaQuery("(hover: none) and (pointer: coarse)");

  /**
   * Canonical flag for mobile/tablet navigation visibility.
   *
   * Show bottom navigation bar on all non-desktop viewports.
   * This matches the layout behavior described in HANDOFF_CORE.md:
   * "MobileNav fixed bottom, only below 1180px"
   *
   * @default true for width < 1180px
   */
  const showMobileNav = isMobile || isTablet;

  /**
   * Canonical flag for desktop sidebar visibility.
   *
   * Sidebar only appears on desktop viewports (≥ 1180px).
   * Per HANDOFF_CORE.md: "Sidebar (xl: always visible | <xl: slide-out)"
   *
   * @default true for width ≥ 1180px
   */
  const showDesktopSidebar = isDesktop;

  /**
   * Device type string for conditional rendering.
   *
   * Priority order: mobile → tablet → desktop (fallback)
   * Used primarily for analytics tracking and conditional CSS classes.
   */
  const device = isMobile
    ? "mobile"
    : isTablet
      ? "tablet"
      : isDesktop
        ? "desktop"
        : "desktop"; // Fallback to desktop if somehow none match

  return {
    isMobile,
    isTablet,
    isDesktop,

    isSmallDesktop,
    isLargeDesktop,
    isXLDesktop,

    isSmallMobile,
    isStandardMobile,

    isSmallTablet,
    isStandardTablet,

    isLandscape,
    isPortrait,

    isTouch,

    showMobileNav,
    showDesktopSidebar,
    device,
  };
};