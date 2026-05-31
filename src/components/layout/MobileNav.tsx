/**
 * @fileoverview Bottom navigation bar for mobile and tablet viewports.
 *
 * Responsibilities:
 * - Render fixed-position tab bar at bottom of screen
 * - Highlight active route using brand color (#fa243c)
 * - Provide haptic-style active state indicator (dot below active tab)
 * - Handle safe area insets for notched devices (iOS dynamic island, home indicator)
 *
 * Related modules:
 * - MainLayout (src/components/layout/MainLayout.tsx) - Conditionally renders MobileNav when showMobileNav = true
 * - useResponsive hook - Determines when MobileNav should be visible (< 1180px)
 *
 * Architectural role:
 * - **Primary navigation for non-desktop viewports** (width < 1180px)
 * - Replaces desktop Sidebar for mobile/tablet users
 * - Fixed positioning ensures navigation is always accessible while scrolling
 *
 * Navigation structure (per HANDOFF_CORE.md):
 * - Home → "/" (HomePage)
 * - Library → "/library" (LibraryPage with songs, playlists, liked songs)
 * - Profile → "/profile" (ProfilePage with user info, playlists, listening history)
 *
 * Note: Inbox tab was removed as per HANDOFF_CORE.md:
 * "Router has no /inbox or /rewards routes" and "Sidebar has no 'My Rewards' NavItem"
 * MobileNav only shows 3 items (Home, Library, Profile) - matches current spec.
 *
 * Visual design:
 * - White background with 95% opacity + backdrop blur (glassmorphism)
   - Creates depth without completely hiding content underneath
 * - Thin top border for separation from content
 * - Active tab: Primary red (#fa243c) text + icon + small dot indicator
 * - Inactive tab: Gray (#9ca3af) for reduced visual prominence
 *
 * Safe area handling:
 * - paddingBottom: env(safe-area-inset-bottom) ensures content not hidden behind home indicator
 * - Critical for iPhone X and newer models with gesture bar
 * - Falls back to 0px if env() not supported
 *
 * Performance:
 * - No state, props, or side effects (pure presentational component)
 * - Re-renders only when location.pathname changes (React Router subscription)
 * - Minimal DOM structure (4 links maximum)
 *
 * Accessibility:
 * - Semantic <nav> element for screen reader navigation landmarks
 * - Link text provided via aria-label implicitly from inner span text
 * - Active state conveyed via color + dot indicator (redundant encoding for accessibility)
 *
 * @module components/layout
 */

import { Link, useLocation } from "react-router-dom";
import HomeIcon from "@mui/icons-material/Home";
import LibraryMusicIcon from "@mui/icons-material/LibraryMusic";
import PersonIcon from "@mui/icons-material/Person";

/**
 * Brand primary color constant.
 * Matches P = "#fa243c" from HANDOFF_CORE.md brand constants.
 * Used for active state highlighting and dot indicator.
 */
const PRIMARY = "#fa243c";

/**
 * MobileNav - Fixed bottom tab bar for mobile/tablet navigation.
 *
 * Visibility rules (from MainLayout + HANDOFF_CORE.md):
 * - Rendered when showMobileNav = true (viewport width < 1180px)
 * - Hidden on desktop (≥ 1180px) via lg:hidden Tailwind class
 *
 * Why lg:hidden instead of conditional rendering in MainLayout?
 * - MainLayout already conditionally renders based on showMobileNav
 * - lg:hidden provides additional CSS fallback if showMobileNav logic fails
 *
 * Navigation items:
 * - Order matches conventional mobile app patterns (primary destinations first)
 * - Each item includes path, MUI icon component, and display label
 *
 * Active route detection:
 * - Uses exact path matching (location.pathname === item.path)
 * - Nested routes (e.g., /playlist/123) will NOT match /library or /profile
 * - This is intentional: sub-pages should not highlight top-level nav items
 *
 * @returns Mobile navigation JSX with fixed positioning and safe area padding
 */
const MobileNav = () => {
  /**
   * React Router location object.
   * pathname used to determine active tab via exact path matching.
   * Re-renders component when route changes (React Router subscription).
   */
  const location = useLocation();

  /**
   * Navigation items configuration.
   *
   * Each item defines:
   * - path: Route path (must match exactly for active highlighting)
   * - icon: MUI icon component (rendered as JSX element)
   * - label: Display text below icon (10px font size)
   *
   * Array order determines render order in navigation bar (left to right).
   * Order: Home → Library → Profile (matches standard music app patterns).
   */
  const navItems = [
    { path: "/", icon: HomeIcon, label: "Home" },
    { path: "/library", icon: LibraryMusicIcon, label: "Library" },
    { path: "/profile", icon: PersonIcon, label: "Profile" },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 z-40 lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-center justify-around py-1">
        {navItems.map((item) => {
          const Icon = item.icon;

          /**
           * Determines if current route matches this nav item's path.
           * Uses strict equality (exact path matching) - not startsWith.
           * Prevents sub-route false positives (e.g., /profile/edit should not highlight /profile).
           */
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className="flex flex-col items-center px-3 py-1.5 rounded-xl transition-all duration-150 relative"
              style={{
                color: isActive ? PRIMARY : "#9ca3af",
              }}
            >
              <Icon fontSize="small" />

              <span className="text-[10px] mt-0.5 font-medium">
                {item.label}
              </span>

              {/* Active indicator dot - only shown when tab is active */}
              {isActive && (
                <span
                  className="absolute -bottom-0.5 w-1 h-1 rounded-full"
                  style={{ background: PRIMARY }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNav;