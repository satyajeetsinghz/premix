/**
 * @fileoverview useResponsive – canonical breakpoint flags for Premix.
 *
 * The single source of truth for all layout decisions.
 * Components MUST use showMobileNav and showDesktopSidebar from here —
 * never re-derive them inline.
 *
 * Breakpoints (from design spec):
 *   Mobile  ≤ 767 px
 *   Tablet  768 – 1179 px
 *   Desktop ≥ 1180 px   ← sidebar becomes persistent
 */

import { useMediaQuery } from "./useMediaQuery";

export interface ResponsiveState {
  /** Viewport ≤ 767 px */
  isMobile: boolean;
  /** Viewport 768 – 1179 px */
  isTablet: boolean;
  /** Viewport ≥ 1180 px */
  isDesktop: boolean;

  // ── Granular desktop ──────────────────────────────────────────────
  isSmallDesktop: boolean;   // 1180 – 1439 px
  isLargeDesktop: boolean;   // ≥ 1440 px
  isXLDesktop: boolean;      // ≥ 1920 px

  // ── Granular mobile ───────────────────────────────────────────────
  isSmallMobile: boolean;    // ≤ 389 px (iPhone SE)
  isStandardMobile: boolean; // 390 – 767 px

  // ── Granular tablet ───────────────────────────────────────────────
  isSmallTablet: boolean;    // 768 – 899 px
  isStandardTablet: boolean; // 900 – 1179 px

  // ── Utility ───────────────────────────────────────────────────────
  isLandscape: boolean;
  isPortrait: boolean;
  isTouch: boolean;

  // ── Canonical layout flags ────────────────────────────────────────
  /** true when bottom tab bar should render (< 1180 px) */
  showMobileNav: boolean;
  /** true when persistent sidebar should render (≥ 1180 px) */
  showDesktopSidebar: boolean;
  /** "mobile" | "tablet" | "desktop" */
  device: "mobile" | "tablet" | "desktop";
}

export const useResponsive = (): ResponsiveState => {
  const isMobile  = useMediaQuery("(max-width: 767px)");
  const isTablet  = useMediaQuery("(min-width: 768px) and (max-width: 1179px)");
  const isDesktop = useMediaQuery("(min-width: 1180px)");

  const isSmallDesktop   = useMediaQuery("(min-width: 1180px) and (max-width: 1439px)");
  const isLargeDesktop   = useMediaQuery("(min-width: 1440px)");
  const isXLDesktop      = useMediaQuery("(min-width: 1920px)");

  const isSmallMobile    = useMediaQuery("(max-width: 389px)");
  const isStandardMobile = useMediaQuery("(min-width: 390px) and (max-width: 767px)");

  const isSmallTablet    = useMediaQuery("(min-width: 768px) and (max-width: 899px)");
  const isStandardTablet = useMediaQuery("(min-width: 900px) and (max-width: 1179px)");

  const isLandscape = useMediaQuery("(orientation: landscape)");
  const isPortrait  = useMediaQuery("(orientation: portrait)");
  const isTouch     = useMediaQuery("(hover: none) and (pointer: coarse)");

  const showMobileNav     = isMobile || isTablet;
  const showDesktopSidebar = isDesktop;

  const device: "mobile" | "tablet" | "desktop" = isMobile
    ? "mobile"
    : isTablet
      ? "tablet"
      : "desktop";

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