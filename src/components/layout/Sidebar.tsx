/**
 * @fileoverview Primary navigation sidebar for desktop and mobile slide-out drawer.
 *
 * Responsibilities:
 * - Render persistent navigation sidebar on desktop (≥ 1180px)
 * - Render slide-out drawer navigation on mobile/tablet (< 1180px)
 * - Display user profile section with avatar, name, email, and dropdown menu
 * - Manage playlists section with expand/collapse toggle and create playlist button
 * - Handle responsive profile menu with click-outside and Escape key dismissal
 * - Conditionally show Admin Panel link based on user role
 *
 * Related modules:
 * - MainLayout (src/components/layout/MainLayout.tsx) - Renders Sidebar with appropriate props
 * - PlaylistList (src/features/playlists/components/PlaylistList.tsx) - Displays user's playlists
 * - CreatePlaylistModal (src/features/playlists/components/CreatePlaylistModal.tsx) - Modal for new playlist creation
 * - useAuth - Provides user authentication data (role, email)
 * - useProfile - Provides user profile data (name, photoURL)
 * - usePlayer - Provides currentTrack for dynamic bottom padding
 *
 * Architectural role:
 * - **Primary navigation hub** for authenticated users
 * - Dual-mode component: desktop persistent sidebar + mobile slide-out drawer
 * - Single source of truth for navigation items and user menu
 * - Manages local UI state for playlist expansion and profile menu
 *
 * Navigation structure (per HANDOFF_CORE.md sidebar bottom section):
 * 1. Playlists section (expandable with create button)
 * 2. Profile dropdown (avatar, display name, email, View Profile, Admin Panel if admin, Sign Out)
 *
 * Note: Inbox row is mentioned in HANDOFF_CORE.md as "present — to be removed/kept per your choice"
 * Current implementation has NO Inbox item (matches dropped inbox/messaging system requirement)
 *
 * Responsive behavior:
 * - Desktop (xl: always visible): width w-60, hidden below xl breakpoint
 * - Mobile (< xl): slide-out drawer triggered by isMobileMenuOpen prop
 * - Backdrop overlay with blur when drawer open on mobile
 *
 * State management:
 * - openModal: Local state for CreatePlaylistModal visibility
 * - isPlaylistExpanded: Local state for playlist section collapse/expand (persists during session)
 * - showProfileMenu: Local state for user dropdown menu (closes on outside click/Escape)
 *
 * Performance considerations:
 * - useCallback for all event handlers to prevent unnecessary child re-renders
 * - useMemo for isAdmin calculation (depends on user.role and profile.role)
 * - useEffect for click-outside and keyboard event listeners (cleanup on unmount)
 * - Avatar image onError handler prevents broken image icon from appearing
 *
 * @module components/layout
 */

import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import HomeIcon from "@mui/icons-material/Home";
import LibraryMusicIcon from "@mui/icons-material/LibraryMusic";
import PlaylistPlayIcon from "@mui/icons-material/PlaylistPlay";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import PlaylistList from "@/features/playlists/components/PlaylistList";
import CreatePlaylistModal from "@/features/playlists/components/CreatePlaylistModal";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useProfile } from "@/features/profile/hooks/useProfile";
import { usePlayer } from "@/features/player/hooks/usePlayer";
import { logoutUser } from "@/features/auth/services/auth.service";

/**
 * Props for the Sidebar component.
 *
 * @property isMobile - When true, renders as slide-out drawer instead of persistent sidebar
 * @property isMobileMenuOpen - Controls drawer visibility on mobile (only when isMobile = true)
 * @property onMobileMenuClose - Callback to close mobile drawer (closes backdrop and sets isMobileMenuOpen = false)
 */
interface SidebarProps {
  isMobile?: boolean;
  isMobileMenuOpen?: boolean;
  onMobileMenuClose?: () => void;
}

/**
 * Props for individual navigation item component.
 *
 * @property path - Route path for Link navigation
 * @property label - Display text for the nav item
 * @property icon - MUI icon component
 * @property active - Whether current route matches this item's path
 * @property onClick - Optional click handler (used for closing mobile drawer on navigation)
 */
interface NavItemProps {
  path: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  onClick?: () => void;
}

/**
 * Brand primary color constant.
 * Matches P = "#fa243c" from HANDOFF_CORE.md brand constants.
 * Used for active state indicators, avatar background, and beta badge.
 */
const PRIMARY = "#fa243c";

/**
 * Individual navigation link component.
 *
 * Visual design:
 * - Active state: left accent bar (3px wide, PRIMARY color), icon color PRIMARY, text dark gray
 * - Inactive state: no accent bar, icon gray-400, text gray-600 on hover
 * - Smooth transitions on all interactive properties
 *
 * Performance: Pure component - re-renders only when active prop or onClick changes
 *
 * @param props - NavItemProps
 * @returns Navigation link JSX
 */
const NavItem = ({
  path,
  label,
  icon: Icon,
  active,
  onClick,
}: NavItemProps) => (
  <Link
    to={path}
    onClick={onClick}
    className="flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200 group relative select-none"
    style={{
      background: active ? "" : undefined,
      color: active ? "#1a1a1a" : "#374151",
    }}
  >
    {/* Left accent bar - visible only when active */}
    <span
      className="absolute left-0 w-[3px] h-3.5 rounded-md transition-all duration-200"
      style={{
        background: PRIMARY,
        opacity: active ? 1 : 0,
        transform: active ? "scaleY(1)" : "scaleY(0)",
        transformOrigin: "center",
      }}
    />

    <Icon
      fontSize="small"
      style={{ color: active ? PRIMARY : undefined }}
      className={
        active
          ? ""
          : "text-gray-400 group-hover:text-gray-600 transition-colors"
      }
    />

    <span className="text-sm font-medium">{label}</span>
  </Link>
);

/**
 * Sidebar - Main navigation component with responsive dual-mode rendering.
 *
 * Desktop mode (isMobile = false):
 * - Persistent sidebar visible on xl breakpoint (≥ 1280px) via hidden xl:flex classes
 * - Fixed width (w-60), full height, white background with right border
 *
 * Mobile mode (isMobile = true):
 * - Slide-out drawer from left (transform: translateX)
 * - Backdrop overlay with blur when open
 * - Shadow-2xl for elevation
 * - Transition duration-300 ease-in-out for smooth animation
 *
 * Profile menu behavior:
 * - Click outside menu closes it (uses mousedown event listener)
 * - Escape key closes menu (accessibility)
 * - Menu appears above button (bottom-full) to avoid being cut off by viewport edge
 *
 * Playlist section:
 * - Expandable/collapsible with chevron icon
 * - State persists during session (not saved to localStorage)
 * - Create playlist button opens modal
 * - PlaylistList component scrolls independently (max-h-52 overflow-y-auto)
 *
 * Bottom padding adjustment:
 * - Increased padding-bottom (96px) when player is visible (isPlayerVisible = true)
 * - Prevents playlist list from being hidden behind PlayerBar (fixed bottom)
 *
 * @param props - SidebarProps
 * @returns Sidebar component JSX (desktop or mobile variant)
 */
const Sidebar = ({
  isMobile = false,
  isMobileMenuOpen = false,
  onMobileMenuClose,
}: SidebarProps) => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { currentTrack } = usePlayer();
  const location = useLocation();
  const navigate = useNavigate();

  // --- Local UI State ---
  const [openModal, setOpenModal] = useState(false);
  const [isPlaylistExpanded, setIsPlaylistExpanded] = useState(true);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // --- Refs for click-outside detection ---
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);

  /**
   * Determines if PlayerBar is visible (used for dynamic padding).
   * PlayerBar renders at bottom of screen when track is playing.
   */
  const isPlayerVisible = !!currentTrack;

  /**
   * Memoized admin status check.
   *
   * Checks both user.role (from auth context) and profile.role (from Firestore).
   * Dual check ensures admin status is detected regardless of which context loads first.
   *
   * Performance: useMemo prevents recalculation on every render.
   */
  const isAdmin = useMemo(
    () => user?.role === "admin" || profile?.role === "admin",
    [user?.role, profile?.role],
  );

  /**
   * Checks if a given path matches the current location.
   * Uses strict equality (exact path matching) for consistency with MobileNav.
   *
   * Performance: useCallback memoized with location.pathname dependency.
   */
  const isActive = useCallback(
    (path: string) => location.pathname === path,
    [location.pathname],
  );

  /**
   * Effect 1: Close mobile drawer when navigating to a new route.
   *
   * This provides a better UX: after selecting a nav item, the drawer auto-closes.
   * Dependency: location.pathname (runs on every route change).
   */
  useEffect(() => {
    if (isMobile) onMobileMenuClose?.();
  }, [location.pathname]);

  /**
   * Effect 2: Click-outside handler for profile menu.
   *
   * Closes dropdown when user clicks anywhere outside the menu or button.
   * Uses mousedown (not click) for faster response.
   *
   * Cleanup: Removes event listener on unmount.
   */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        profileMenuRef.current?.contains(e.target as Node) ||
        profileButtonRef.current?.contains(e.target as Node)
      )
        return;

      setShowProfileMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /**
   * Effect 3: Escape key handler for profile menu.
   *
   * Accessibility: Pressing Escape closes the dropdown menu.
   * Only adds listener when menu is open (performance optimization).
   *
   * Cleanup: Removes listener when menu closes or component unmounts.
   */
  useEffect(() => {
    if (!showProfileMenu) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowProfileMenu(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [showProfileMenu]);

  /**
   * Handles user sign out.
   *
   * Steps:
   * 1. Close profile menu
   * 2. Call logoutUser() from auth.service (clears Firebase Auth)
   * 3. Navigation handled by auth.service or ProtectedRoute (redirects to /login)
   *
   * Error handling: Logs error but doesn't show toast (sign-out failure is rare).
   */
  const handleSignOut = useCallback(async () => {
    setShowProfileMenu(false);
    try {
      await logoutUser();
    } catch (err) {
      console.error("Sign out error:", err);
    }
  }, []);

  /**
   * Navigates to profile page and closes mobile drawer if open.
   */
  const handleProfileClick = useCallback(() => {
    setShowProfileMenu(false);
    if (isMobile) onMobileMenuClose?.();
    navigate("/profile");
  }, [isMobile, onMobileMenuClose, navigate]);

  /**
   * Navigates to admin panel and closes mobile drawer if open.
   * Only visible to users with admin role.
   */
  const handleAdminClick = useCallback(() => {
    setShowProfileMenu(false);
    if (isMobile) onMobileMenuClose?.();
    navigate("/admin");
  }, [isMobile, onMobileMenuClose, navigate]);

  /**
   * Closes mobile drawer when any navigation link is clicked.
   */
  const handleNavClick = useCallback(() => {
    if (isMobile) onMobileMenuClose?.();
  }, [isMobile, onMobileMenuClose]);

  /**
   * Toggles profile dropdown menu visibility.
   */
  const toggleProfileMenu = useCallback(
    () => setShowProfileMenu((v) => !v),
    [],
  );

  /**
   * Toggles playlist section expand/collapse state.
   */
  const togglePlaylist = useCallback(
    () => setIsPlaylistExpanded((v) => !v),
    [],
  );

  /**
   * User's display name (prefers profile.name over user.name).
   * Falls back to "User" if neither exists.
   */
  const displayName = profile?.name || user?.name || "User";

  /**
   * First letter of display name for avatar fallback.
   */
  const initial = displayName[0]?.toUpperCase() ?? "U";

  /**
   * Avatar component (reused in both profile button and dropdown menu).
   *
   * Shows photoURL if available, otherwise colored circle with initial.
   * onError handler hides broken image and falls back to initial div.
   */
  const Avatar = (
    <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden border border-gray-200">
      {profile?.photoURL ? (
        <img
          src={profile.photoURL}
          alt={displayName}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center text-white text-xs font-bold"
          style={{ background: PRIMARY }}
        >
          {initial}
        </div>
      )}
    </div>
  );

  /**
   * Shared sidebar content used by both desktop and mobile variants.
   *
   * Contains:
   * - Header with BeatStream logo and Beta badge (close button on mobile)
   * - Navigation items (Home, Your Library)
   * - Playlists section header with expand/collapse and create button
   * - PlaylistList component (conditionally rendered based on isPlaylistExpanded)
   * - User profile dropdown (avatar, name, email, menu items)
   *
   * Dynamic padding: pb-[96px] when player visible, pb-[20px] when not.
   * Prevents content from being hidden behind fixed PlayerBar.
   */
  const sidebarContent = (
    <div
      className="px-2 py-5 h-full flex flex-col transition-all duration-300"
      style={{ paddingBottom: isPlayerVisible ? "96px" : "20px" }}
    >
      {/* Header section */}
      <div className="flex items-center justify-between mb-6 px-1">
        <div className="flex items-center gap-1.5">
          <span className="text-lg font-bold text-gray-900 tracking-tight">
            BeatStream
          </span>
          <span
            className="text-[10px] font-semibold px-2 py-0 rounded-full text-white"
            style={{ background: PRIMARY }}
          >
            Beta
          </span>
        </div>
        {/* Close button for mobile drawer */}
        {isMobile && onMobileMenuClose && (
          <button
            onClick={onMobileMenuClose}
            className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
            aria-label="Close menu"
          >
            <CloseIcon fontSize="small" className="text-gray-500" />
          </button>
        )}
      </div>

      {/* Navigation and playlists section (scrollable) */}
      <div className="flex-1 overflow-y-auto space-y-0.5 pr-0.5">
        <nav className="space-y-0.5">
          <NavItem
            path="/"
            label="Home"
            icon={HomeIcon}
            active={isActive("/")}
            onClick={handleNavClick}
          />
          <NavItem
            path="/library"
            label="Your Library"
            icon={LibraryMusicIcon}
            active={isActive("/library")}
            onClick={handleNavClick}
          />

          {/* Playlists section header with custom active state detection */}
          <div
            className="flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200 group relative cursor-pointer select-none"
            style={{
              background: location.pathname.includes("/playlist")
                ? ""
                : undefined,
            }}
          >
            {/* Left accent bar - visible when viewing any playlist detail page */}
            <span
              className="absolute left-0 w-[3px] h-3.5 rounded-md transition-all duration-200"
              style={{
                background: PRIMARY,
                opacity: location.pathname.includes("/playlist") ? 1 : 0,
                transform: location.pathname.includes("/playlist")
                  ? "scaleY(1)"
                  : "scaleY(0)",
                transformOrigin: "center",
              }}
            />

            <PlaylistPlayIcon
              fontSize="small"
              className="text-gray-400 group-hover:text-gray-600 transition-colors flex-shrink-0"
              style={{
                color: location.pathname.includes("/playlist")
                  ? PRIMARY
                  : undefined,
              }}
            />

            <span className="text-sm font-medium flex-1 text-gray-700 group-hover:text-gray-900 transition-colors">
              Playlists
            </span>

            {/* Expand/collapse and create playlist buttons */}
            <div className="flex items-center gap-0.5">
              <button
                onClick={togglePlaylist}
                className="p-1 rounded-md hover:bg-gray-200 transition-colors text-gray-400 hover:text-gray-600"
                aria-label={
                  isPlaylistExpanded ? "Collapse playlists" : "Expand playlists"
                }
              >
                {isPlaylistExpanded ? (
                  <ExpandLessIcon fontSize="small" />
                ) : (
                  <ExpandMoreIcon fontSize="small" />
                )}
              </button>
              <button
                onClick={() => setOpenModal(true)}
                className="p-1 rounded-md hover:bg-gray-200 transition-colors text-gray-400 hover:text-gray-600"
                aria-label="Create playlist"
              >
                <AddIcon fontSize="small" />
              </button>
            </div>
          </div>
        </nav>

        {/* Playlist list - conditionally rendered based on expansion state */}
        {isPlaylistExpanded && (
          <div className="px-1 pt-0.5">
            <div className="max-h-52 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
              <PlaylistList />
            </div>
          </div>
        )}
      </div>

      {/* User profile section (bottom of sidebar) */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="relative">
          {/* Profile button - opens dropdown menu */}
          <button
            ref={profileButtonRef}
            onClick={toggleProfileMenu}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-gray-50 transition-colors group"
            aria-haspopup="true"
            aria-expanded={showProfileMenu}
          >
            {Avatar}

            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
                {displayName}
              </p>
              <p className="text-[10px] text-gray-400 truncate leading-tight">
                {user?.email ?? ""}
              </p>
            </div>

            {/* Animated chevron - rotates 180deg when menu open */}
            <ExpandMoreIcon
              fontSize="small"
              className="text-gray-400 transition-transform duration-200 flex-shrink-0"
              style={{
                transform: showProfileMenu ? "rotate(180deg)" : "rotate(0deg)",
              }}
            />
          </button>

          {/* Profile dropdown menu - positioned above button (bottom-full) */}
          {showProfileMenu && (
            <div
              ref={profileMenuRef}
              role="menu"
              className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-md shadow-lg border border-gray-100 py-1.5 z-50 max-h-64 overflow-y-auto"
              style={{ animation: "slideUp 0.15s ease" }}
            >
              {/* User info header in dropdown */}
              <div className="px-4 py-2.5 border-b border-gray-100 mb-1">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {displayName}
                </p>
                <p className="text-xs text-gray-400 truncate mt-0.5">
                  {user?.email ?? ""}
                </p>
              </div>

              {/* View Profile button */}
              <button
                role="menuitem"
                onClick={handleProfileClick}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
              >
                <span>View Profile</span>
              </button>

              {/* Admin Panel button - only shown to admin users */}
              {isAdmin && (
                <button
                  role="menuitem"
                  onClick={handleAdminClick}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
                >
                  <span>Admin Panel</span>
                </button>
              )}

              <div className="border-t border-gray-100 my-1" />

              {/* Sign Out button */}
              <button
                role="menuitem"
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left text-gray-700 hover:bg-neutral-50"
              >
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  /**
   * Desktop variant: Persistent sidebar visible on xl breakpoint.
   *
   * Note: Uses hidden xl:flex classes - visible only on screens ≥ 1280px.
   * This matches the design system breakpoint (not 1180px mentioned in HANDOFF).
   * 1180px is used for showDesktopSidebar logic in useResponsive, but Tailwind's xl
   * breakpoint (1280px) provides a slightly better tablet-to-desktop transition.
   */
  if (!isMobile) {
    return (
      <>
        <aside className="w-60 h-screen bg-white border-r border-gray-100 flex-col hidden xl:flex overflow-hidden">
          {sidebarContent}
        </aside>
        <CreatePlaylistModal
          open={openModal}
          onClose={() => setOpenModal(false)}
        />
      </>
    );
  }

  /**
   * Mobile variant: Slide-out drawer with backdrop overlay.
   *
   * Backdrop: Semi-transparent black with blur, closes drawer when clicked.
   * Drawer: Fixed position, width 240px, transform animation for slide-in/out.
   * Both backdrop and drawer only render when isMobileMenuOpen = true.
   */
  return (
    <>
      {/* Backdrop overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40 xl:hidden"
          onClick={onMobileMenuClose}
          aria-hidden="true"
        />
      )}

      {/* Slide-out drawer */}
      <aside
        className="fixed top-0 left-0 bottom-0 w-60 bg-white z-50 shadow-2xl transform transition-transform duration-300 ease-in-out xl:hidden"
        style={{
          transform: isMobileMenuOpen ? "translateX(0)" : "translateX(-100%)",
        }}
      >
        <div className="h-full flex flex-col overflow-y-auto">
          {sidebarContent}
        </div>
      </aside>

      {/* Create playlist modal - shared across both variants */}
      <CreatePlaylistModal
        open={openModal}
        onClose={() => setOpenModal(false)}
      />
    </>
  );
};

export default Sidebar;