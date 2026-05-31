/**
 * @fileoverview Primary layout wrapper for authenticated BeatStream pages.
 *
 * Responsibilities:
 * - Orchestrate responsive layout switching between desktop sidebar and mobile navigation
 * - Conditionally render PlayerBar based on global playback state
 * - Manage mobile sidebar drawer state (slide-out menu)
 * - Apply dynamic content padding based on visible UI elements (nav + player)
 *
 * Related modules:
 * - Sidebar (src/components/layout/Sidebar.tsx) - Desktop and mobile slide-out variants
 * - MobileNav (src/components/layout/MobileNav.tsx) - Bottom tab bar for < 1180px
 * - PlayerBar (src/features/player/components/PlayerBar.tsx) - Global playback controls
 * - useResponsive hook - Canonical breakpoint flags
 * - usePlayer hook - Global player state (currentTrack, queue, playback status)
 *
 * Architectural role:
 * - **Layout orchestrator** for all protected routes (wrapped around Router's outlet)
 * - Single source of truth for content padding calculations
 * - Determines which navigation component renders based on viewport size
 * - Manages mobile sidebar open/close state (local to layout, not global)
 *
 * Layout hierarchy (from HANDOFF_CORE.md):
 * ```
 * h-screen flex overflow-hidden
 * ├── Sidebar (xl: always visible | <xl: slide-out)
 * ├── <main> flex-1 overflow-y-auto
 * │     └── <Outlet /> (all child routes render here)
 * ├── <PlayerBar /> (fixed bottom, only when currentTrack exists)
 * └── <MobileNav /> (fixed bottom, only below 1180px)
 * ```
 *
 * Padding strategy:
 * - Prevents content from being hidden behind fixed-positioned UI elements
 * - Different padding values account for varying heights of navigation components
 * - Padding applied to <main> element (scrollable container)
 *
 * Responsive behavior (per HANDOFF_CORE.md):
 * - Desktop (≥ 1180px): showDesktopSidebar = true, showMobileNav = false
 *   - Sidebar renders as persistent left column
 *   - No MobileNav (bottom tabs)
 *   - PlayerBar appears at bottom when active
 *
 * - Mobile/Tablet (< 1180px): showDesktopSidebar = false, showMobileNav = true
 *   - Sidebar renders as slide-out drawer (triggered by hamburger menu)
 *   - MobileNav renders as bottom tab bar
 *   - PlayerBar appears above MobileNav when active (creates stacking)
 *
 * Performance:
 * - No unnecessary re-renders: padding recalculates only when showMobileNav or isPlayerVisible changes
 * - Sidebar component receives isMobile prop to render appropriate variant
 * - Mobile menu state is local (not in global context) to avoid unnecessary context updates
 *
 * @module components/layout
 */

import { Outlet } from "react-router-dom";
import { useState } from "react";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import PlayerBar from "@/features/player/components/PlayerBar";
import { useResponsive } from "./hooks/useResponsive";
import { usePlayer } from "@/features/player/hooks/usePlayer";

/**
 * MainLayout - Primary layout wrapper for authenticated application routes.
 *
 * Rendered by router for all routes under the protected route tree (except /admin).
 * AdminPage uses its own shell (ProtectedAdminRoute) and does NOT use MainLayout.
 *
 * Component communication flow:
 * - Receives no props (layout is route-level wrapper)
 * - Consumes global player state via usePlayer() to conditionally show PlayerBar
 * - Consumes responsive state via useResponsive() for layout decisions
 * - Manages local UI state for mobile sidebar (isMobileMenuOpen)
 *
 * State ownership:
 * - isMobileMenuOpen: LOCAL state (only affects mobile sidebar visibility)
 * - currentTrack: GLOBAL state (from usePlayer context)
 * - responsive flags: DERIVED state (from useResponsive hook)
 *
 * Why isMobileMenuOpen not in global state?
 * - Only one component (mobile Sidebar) needs this state
 * - No other components read or modify it
 * - Keeping it local prevents unnecessary context re-renders
 *
 * @returns MainLayout JSX with conditional sidebar, outlet, player, and mobile navigation
 */
const MainLayout = () => {
  /**
   * Local state for mobile slide-out sidebar visibility.
   *
   * When true, the mobile Sidebar component renders as an overlay drawer.
   * Toggled by hamburger menu button (inside Sidebar component, not shown here).
   * Default: false (drawer closed on initial render).
   */
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  /**
   * Canonical responsive flags from useResponsive hook.
   *
   * Per HANDOFF_CORE.md: "Never re-derive these from isMobile/isTablet booleans inline"
   *
   * - showMobileNav: true when viewport width < 1180px (bottom tab bar visible)
   * - showDesktopSidebar: true when viewport width ≥ 1180px (persistent sidebar)
   */
  const { showMobileNav, showDesktopSidebar } = useResponsive();

  /**
   * Global player state from usePlayer context.
   *
   * currentTrack: Currently playing track object, or null if nothing is playing.
   * isPlayerVisible derived as !!currentTrack (PlayerBar only renders when something is playing).
   */
  const { currentTrack } = usePlayer();
  const isPlayerVisible = !!currentTrack;

  /**
   * Dynamic bottom padding for main content area.
   *
   * Prevents scrollable content from being hidden behind fixed-positioned UI elements:
   * - PlayerBar (~80px height)
   * - MobileNav (~60px height when visible)
   *
   * Padding values (from HANDOFF_CORE.md):
   * - Mobile + player visible: pb-40 (160px = 80px PlayerBar + 60px MobileNav + 20px buffer)
   * - Mobile, no player: pb-20 (80px buffer for MobileNav + spacing)
   * - Desktop + player: pb-24 (96px buffer for PlayerBar)
   * - Desktop, no player: pb-6 (24px minimal spacing)
   *
   * Why Tailwind arbitrary values not used?
   * - Classes are predefined in Tailwind config (pb-6, pb-20, pb-24, pb-40)
   * - Consistent with design system spacing scale
   *
   * Performance note: Recalculates only when showMobileNav or isPlayerVisible changes.
   */
  const contentPadding = showMobileNav
    ? isPlayerVisible
      ? "pb-40"
      : "pb-20"
    : isPlayerVisible
      ? "pb-24"
      : "pb-6";

  return (
    <div className="h-screen bg-white flex overflow-hidden">
      {/* Desktop persistent sidebar (≥ 1180px) */}
      {showDesktopSidebar && <Sidebar />}

      {/* Mobile slide-out sidebar (< 1180px) - controlled by local state */}
      {!showDesktopSidebar && (
        <Sidebar
          isMobile={true}
          isMobileMenuOpen={isMobileMenuOpen}
          onMobileMenuClose={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main content area - scrollable, receives dynamic bottom padding */}
      <main
        className={`flex-1 overflow-y-auto bg-white scroll-smooth ${contentPadding}`}
      >
        <Outlet /> {/* Child routes render here */}
      </main>

      {/* Global player bar - conditionally rendered when track is playing */}
      {isPlayerVisible && <PlayerBar />}

      {/* Mobile bottom navigation - only visible on < 1180px viewports */}
      {showMobileNav && <MobileNav />}
    </div>
  );
};

export default MainLayout;