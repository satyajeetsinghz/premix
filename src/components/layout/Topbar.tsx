/**
 * @fileoverview Top navigation bar for mobile and tablet viewports.
 *
 * Responsibilities:
 * - Render compact top bar with brand logo and user profile menu
 * - Provide profile dropdown with navigation to Profile, Admin Panel (conditional), and Sign Out
 * - Handle click-outside and Escape key dismissal for dropdown menus
 * - Manage search input toggle (currently non-functional, placeholder for future feature)
 *
 * Related modules:
 * - MainLayout (src/components/layout/MainLayout.tsx) - Does NOT render Topbar (desktop uses Sidebar only)
 * - This component appears to be UNUSED in current MainLayout structure
 * - May be intended for future responsive design iteration or alternative layout
 *
 * Architectural role:
 * - **Secondary navigation component** for viewports < 1024px (lg breakpoint)
 * - Complements mobile slide-out Sidebar by providing top-level user menu
 * - Not currently integrated into MainLayout (sidebar handles both desktop and mobile navigation)
 *
 * NOTE: According to MainLayout.tsx, there is NO Topbar rendering.
 * The current layout uses:
 * - Desktop: Sidebar (persistent left column) + no top bar
 * - Mobile: Slide-out Sidebar + MobileNav (bottom tabs) + no top bar
 *
 * This component appears to be a standalone or legacy component.
 * Consider integrating into MainLayout for mobile users or removing if unused.
 *
 * Visibility:
 * - Uses block lg:hidden classes (visible only below 1024px)
 * - Hidden on desktop (Sidebar provides all navigation)
 *
 * Profile menu behavior:
 * - Click outside menu closes it (uses mousedown event listener)
 * - Escape key closes menu (accessibility)
 * - Smooth transition with scale and opacity animations
 *
 * Search feature:
 * - Currently logs to console (placeholder implementation)
 * - Toggle button opens search input on mobile
 * - Click outside search closes it
 *
 * @module components/layout
 */

import { useAuth } from "@/features/auth/hooks/useAuth";
import { logoutUser } from "@/features/auth/services/auth.service";
import SearchIcon from "@mui/icons-material/Search";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { SettingsAccessibilityRounded } from "@mui/icons-material";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useProfile } from "@/features/profile/hooks/useProfile";

/**
 * Topbar - Mobile top navigation bar with user menu.
 *
 * Visual design:
 * - Sticky positioned at top of viewport (sticky top-0)
 * - White background with 80% opacity + backdrop blur (glassmorphism)
 * - Bottom border for separation from content
 * - Hidden on desktop (≥ 1024px via lg:hidden)
 *
 * State management:
 * - isUserMenuOpen: Controls profile dropdown visibility
 * - isSearchOpen: Controls mobile search input visibility
 *
 * Performance:
 * - Event listeners for click-outside and Escape key with proper cleanup
 * - No unnecessary re-renders (local state only)
 *
 * @returns Topbar JSX (only visible on screens < 1024px)
 */
const Topbar = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  /**
   * Effect 1: Click-outside handler for both user menu and search.
   *
   * Closes dropdown when clicking outside menu or button.
   * Closes search when clicking outside search container.
   *
   * Uses mousedown (not click) for faster response and better mobile compatibility.
   *
   * Cleanup: Removes both event listeners on unmount.
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Close user menu if click is outside menu AND button
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }

      // Close search if click is outside search container
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setIsSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  /**
   * Effect 2: Escape key handler for closing menus.
   *
   * Accessibility: Pressing Escape closes both user menu and search if open.
   *
   * Cleanup: Removes listener on unmount.
   */
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsUserMenuOpen(false);
        setIsSearchOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscKey);
    return () => {
      document.removeEventListener("keydown", handleEscKey);
    };
  }, []);

  /**
   * Navigates to profile page and closes menu.
   */
  const handleProfileClick = () => {
    setIsUserMenuOpen(false);
    navigate("/profile");
  };

  /**
   * Navigates to admin panel and closes menu.
   * Only available to admin users (conditionally rendered in menu).
   */
  const handleAdminClick = () => {
    navigate("/admin");
    setIsUserMenuOpen(false);
  };

  /**
   * Signs out the user and closes menu.
   *
   * Note: No hard redirect needed - logoutUser() clears auth state
   * and ProtectedRoute will redirect to /login.
   */
  const handleSignOut = async () => {
    setIsUserMenuOpen(false);
    await logoutUser();
  };

  /**
   * Placeholder search handler.
   *
   * TODO: Implement actual search functionality
   * Should search songs, artists, playlists across Firestore
   * Consider debouncing for performance
   */
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - search input name access
    console.log("Searching for:", (e.target as any).search.value);
  };

  /**
   * Admin status check.
   * Checks both user.role and profile.role for consistency.
   */
  const isAdmin = user?.role === "admin" || profile?.role === "admin";

  return (
    <>
      {/* Main top bar - visible only below lg breakpoint (1024px) */}
      <div className="block lg:hidden h-14 sm:h-16 bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 left-0 right-0 z-50 px-5 sm:px-4 md:px-6">
        <div className="flex items-center justify-between h-full max-w-7xl mx-auto">
          {/* Left section: Brand logo */}
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => navigate("/")}
              className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 hover:text-gray-700 transition-colors"
            >
              <span className="block md:hidden">BS</span>
              {/* Full "BeatStream" text could be shown on larger tablets if needed */}
            </button>
          </div>

          {/* Right section: User menu + Search toggle (search button not currently rendered) */}
          <div className="flex items-center gap-1 sm:gap-2 md:gap-3">
            <div className="relative">
              {/* User menu button - shows avatar and chevron */}
              <button
                ref={buttonRef}
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-1 sm:gap-2 bg-gray-100 hover:bg-gray-200 rounded-full pl-1 sm:pl-2 pr-1 py-0.5 sm:py-1 transition-colors"
                aria-expanded={isUserMenuOpen}
                aria-haspopup="true"
              >
                <img
                  src={profile?.photoURL || "/default-avatar.png"}
                  alt="Profile"
                  className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-full object-cover border-2 border-white"
                />
                {/* Chevron rotates 180deg when menu open */}
                <ExpandMoreIcon
                  fontSize="small"
                  className={`text-gray-500 transition-transform duration-300 hidden sm:block ${isUserMenuOpen ? "rotate-180" : ""
                    }`}
                />
              </button>

              {/* Profile dropdown menu - positioned below button */}
              <div
                ref={menuRef}
                className={`absolute right-0 mt-2 w-52 sm:w-56 md:w-64 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50 transform transition-all duration-300 origin-top-right ${isUserMenuOpen
                    ? "opacity-100 scale-100 translate-y-0"
                    : "opacity-0 scale-95 -translate-y-2 pointer-events-none"
                  }`}
              >
                {/* User info header */}
                <div className="px-3 sm:px-4 py-2 sm:py-3 border-b border-gray-100">
                  <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                    {profile?.displayName || user?.name || "User"}
                  </p>
                  <p className="text-[10px] sm:text-xs text-gray-500 truncate mt-0.5">
                    {user?.email || ""}
                  </p>
                </div>

                {/* Navigation items */}
                <div className="py-1">
                  <button
                    onClick={handleProfileClick}
                    className="w-full text-left px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 sm:gap-3"
                  >
                    <span className="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center text-gray-400">
                      <svg
                        className="w-3 h-3 sm:w-4 sm:h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                    </span>
                    <span>Profile</span>
                  </button>

                  {/* Admin panel link - conditionally rendered */}
                  {isAdmin && (
                    <button
                      onClick={handleAdminClick}
                      className="w-full text-left px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 sm:gap-3"
                    >
                      <span className="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center text-gray-400">
                        <SettingsAccessibilityRounded fontSize="small" />
                      </span>
                      <span>Admin</span>
                    </button>
                  )}
                </div>

                <div className="border-t border-gray-100 my-1" />

                {/* Sign out button - red text for visual distinction */}
                <div className="py-1">
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2 sm:gap-3"
                  >
                    <span className="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center">
                      <svg
                        className="w-3 h-3 sm:w-4 sm:h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                        />
                      </svg>
                    </span>
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile search input - conditionally rendered */}
      {isSearchOpen && (
        <div
          ref={searchRef}
          className="md:hidden fixed top-14 left-0 right-0 bg-white border-b border-gray-200 p-3 sm:p-4 z-40 animate-slideDown"
        >
          <form onSubmit={handleSearch}>
            <div className="relative">
              <SearchIcon
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                fontSize="small"
              />
              <input
                name="search"
                type="search"
                placeholder="Search songs, artists..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-gray-100 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FA2E6E]/20 focus:bg-white transition-all"
                autoFocus
              />
            </div>
          </form>
        </div>
      )}
    </>
  );
};

export default Topbar;