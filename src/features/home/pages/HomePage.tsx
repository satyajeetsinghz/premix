/**
 * @fileoverview Home page - Main landing page with dynamic sections, featured banner, and recently played tracks.
 *
 * Responsibilities:
 * - Display featured banner carousel
 * - Show recently played tracks for authenticated users
 * - Render dynamic home page sections (configured by admin via SectionManager)
 * - Provide mobile profile menu (since desktop sidebar is hidden on mobile)
 * - Handle scroll-to-top button visibility and behavior
 * - Show empty state when no content exists
 *
 * Related modules:
 * - FeaturedBanner (src/features/banner/components/FeaturedBanner.tsx) - Hero carousel
 * - RecentlyPlayed (src/features/history/components/RecentlyPlayed.tsx) - User listening history
 * - DynamicSection (src/features/sections/components/DynamicSection.tsx) - Renders each home section
 * - useSections (src/features/sections/hooks/useSections.ts) - Fetches section configuration
 * - useResponsive (src/components/layout/hooks/useResponsive.ts) - Provides responsive flags
 *
 * Architectural role:
 * - **Primary landing page** for authenticated users (route: "/")
 * - Wrapped by MainLayout (provides sidebar, mobile navigation, player bar)
 * - Orchestrates all home page content components
 *
 * Layout structure:
 * ```
 * HomePage (scrollable container)
 * ├── Mobile Header (lg:hidden) - Shows "Home" title + profile menu
 * ├── FeaturedBanner - Hero carousel
 * ├── RecentlyPlayed (if user logged in)
 * ├── Dynamic Sections (from Firestore /sections collection)
 * └── Empty state (if no sections and no songs)
 * ```
 *
 * Dynamic sections (from HANDOFF_CORE.md):
 * - Sections stored in Firestore /sections collection
 * - Each section has: title, isActive, createdAt
 * - Songs assigned to sections via song.sectionIds array
 * - Only active sections (isActive = true) are displayed
 *
 * Profile menu (mobile only):
 * - Desktop users use Sidebar profile dropdown
 * - Mobile users (lg:hidden) see profile button in top-right corner
 * - Menu includes: user info, Profile link, Admin Panel (if admin), Sign Out
 *
 * Scroll-to-top button:
 * - Appears when user scrolls down > 300px
 * - Position: bottom-right, above PlayerBar and MobileNav
 * - Smooth scroll behavior
 *
 * Empty state:
 * - Shown when: no active sections AND no songs in catalog
 * - Encourages user to browse music or explore sections
 * - Buttons are placeholders (future feature)
 *
 * Performance:
 * - useMemo for isAdmin and sectionElements (prevents unnecessary re-renders)
 * - useCallback for event handlers (stable references)
 * - IntersectionObserver not used (simple scroll listener is sufficient)
 *
 * @module features/home/pages
 */

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/services/firebase/config";

import RecentlyPlayed from "@/features/history/components/RecentlyPlayed";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import PersonIcon from "@mui/icons-material/Person";
import { useSections } from "@/features/sections/hooks/useSections";
import { DynamicSection } from "@/features/sections/components/DynamicSection";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useProfile } from "@/features/profile/hooks/useProfile";
import { logoutUser } from "@/features/auth/services/auth.service";
import { useNavigate } from "react-router-dom";
import FeaturedBanner from "@/features/banner/components/FeaturedBanner";
import { useResponsive } from "@/components/layout/hooks/useResponsive";
import AnimatedSpinner from "@/components/ui/LoadingSpinner/AnimatedSpinner";

// Brand constants (matches HANDOFF_CORE.md)
const PRIMARY = "#fa243c";
const PRIMARY_H = "#e01e33";

/**
 * HomePage - Main landing page after authentication.
 *
 * Route: "/" (protected, inside MainLayout)
 *
 * Data fetching:
 * - useSections: Fetches active sections from Firestore with real-time updates
 * - Songs check: Listens to /songs collection to determine if empty state should show
 *
 * Responsive behavior:
 * - Desktop (≥ 1280px): Sidebar provides navigation (profile menu not shown here)
 * - Mobile/Tablet (< 1280px): Shows inline profile menu in top-right corner
 *
 * @returns Home page JSX with dynamic sections and content
 */
const HomePage = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { sections, loading: sectionsLoading } = useSections();
  const { isMobile } = useResponsive();
  const navigate = useNavigate();

  /**
   * Memoized admin status check.
   * Checks both user.role and profile.role for consistency.
   */
  const isAdmin = useMemo(
    () => user?.role === "admin" || profile?.role === "admin",
    [user?.role, profile?.role],
  );

  // --- UI state ---
  const [hasSongs, setHasSongs] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  // --- Refs ---
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);

  /**
   * Effect 1: Check if songs exist in catalog (for empty state).
   *
   * Only runs if sections are empty (avoids duplicate listener when sections exist).
   * Listens to /songs collection (no filter, just existence check).
   * Real-time: updates if first song is added or last song is deleted.
   */
  useEffect(() => {
    if (sections.length > 0) {
      return;
    }
    const q = query(collection(db, "songs"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snap) => {
      setHasSongs(!snap.empty);
    });
    return () => unsubscribe();
  }, [sections.length]);

  /**
   * Effect 2: Scroll listener for scroll-to-top button visibility.
   *
   * Shows button when scroll position > 300px from top.
   * Uses passive: true for better scroll performance.
   */
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const handleScroll = () => setShowScrollTop(el.scrollTop > 300);
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  /**
   * Effect 3: Click-outside handler for mobile profile menu.
   *
   * Closes menu when clicking outside menu or button.
   * Uses mousedown for faster response.
   */
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        profileMenuRef.current?.contains(e.target as Node) ||
        profileButtonRef.current?.contains(e.target as Node)
      )
        return;
      setIsProfileMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /**
   * Effect 4: Escape key handler for mobile profile menu.
   *
   * Accessibility: Pressing Escape closes the menu.
   */
  useEffect(() => {
    if (!isProfileMenuOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsProfileMenuOpen(false);
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isProfileMenuOpen]);

  /**
   * Scrolls the main content container to top with smooth behavior.
   */
  const scrollToTop = useCallback(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  /**
   * Navigates to profile page and closes mobile menu.
   */
  const handleProfileClick = useCallback(() => {
    setIsProfileMenuOpen(false);
    navigate("/profile");
  }, [navigate]);

  /**
   * Navigates to admin panel and closes mobile menu.
   * Only available to admin users.
   */
  const handleAdminClick = useCallback(() => {
    setIsProfileMenuOpen(false);
    navigate("/admin");
  }, [navigate]);

  /**
   * Signs out user and closes mobile menu.
   * Navigation handled by auth.service or ProtectedRoute.
   */
  const handleSignOut = useCallback(async () => {
    setIsProfileMenuOpen(false);
    try {
      await logoutUser();
    } catch (err) {
      console.error("Sign out error:", err);
    }
  }, []);

  /**
   * Toggles mobile profile menu visibility.
   */
  const toggleProfileMenu = useCallback(() => {
    setIsProfileMenuOpen((v) => !v);
  }, []);

  /**
   * Memoized section elements with staggered animation delays.
   *
   * Each section gets a progressive animation delay (index * 100ms)
   * Creates cascading fade-in effect as user scrolls.
   *
   * Re-renders only when sections array changes.
   */
  const sectionElements = useMemo(
    () =>
      sections.map((section, index) => (
        <section
          key={section.id}
          className="animate-fadeIn"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <DynamicSection section={section} />
        </section>
      )),
    [sections],
  );

  // --- Loading state ---
  if (sectionsLoading) {
    return (
      <div className="h-[calc(100vh-6rem)] bg-[#f5f5f7]/50 backdrop-blur-md flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <AnimatedSpinner size={28} color={PRIMARY} />
          <p className="text-xs sm:text-sm text-gray-400 font-medium">
            Loading your music…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      className="h-full overflow-y-auto bg-[#f5f5f7]/50 backdrop-blur-md scroll-smooth"
      style={{ scrollbarWidth: "thin" }}
    >
      <div className={isMobile ? "pb-4" : "pb-0"}>
        <div className="space-y-6 sm:space-y-8 md:space-y-10 px-3 sm:px-4 md:px-6 lg:px-8 max-w-7xl mx-auto py-10 lg:py-0">

          {/* Mobile header - visible only below lg breakpoint (1280px) */}
          <div className="flex items-center justify-between lg:hidden py-2 px-2">
            <h1 className="text-2xl font-bold text-gray-900">Home</h1>

            {/* Mobile profile menu button (replaces desktop sidebar profile) */}
            <div className="relative">
              <button
                ref={profileButtonRef}
                onClick={toggleProfileMenu}
                className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-white font-medium shadow-md transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{ background: PRIMARY }}
                aria-label="Profile menu"
                aria-haspopup="true"
                aria-expanded={isProfileMenuOpen}
              >
                {profile?.photoURL ? (
                  <img
                    src={profile.photoURL}
                    alt={profile?.name || user?.name || "User"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <PersonIcon fontSize="medium" />
                )}
              </button>

              {/* Mobile profile dropdown menu */}
              {isProfileMenuOpen && (
                <div
                  ref={profileMenuRef}
                  role="menu"
                  aria-label="Profile options"
                  className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-[60] animate-slideDown"
                >
                  {/* User info header */}
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {profile?.name || user?.name || "User"}
                    </p>
                    <p className="text-xs text-gray-400 truncate mt-0.5">
                      {user?.email || ""}
                    </p>
                  </div>

                  {/* Profile link */}
                  <button
                    role="menuitem"
                    onClick={handleProfileClick}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
                  >
                    <span>Profile</span>
                  </button>

                  {/* Admin Panel link (conditionally rendered) */}
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
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left"
                    style={{ color: PRIMARY }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = PRIMARY_H)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = PRIMARY)
                    }
                  >
                    <span className="text-gray-700">Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Featured banner carousel */}
          <section>
            <FeaturedBanner />
          </section>

          {/* Recently played section - only for authenticated users */}
          {user && (
            <section className="animate-fadeIn">
              <RecentlyPlayed />
            </section>
          )}

          {/* Dynamic sections (configured by admin) */}
          {sectionElements}

          {/* Empty state - shown when no sections AND no songs in catalog */}
          {sections.length === 0 && !hasSongs && (
            <div className="text-center py-12 sm:py-16 bg-gray-50 rounded-xl sm:rounded-2xl px-4 sm:px-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                <MusicNoteIcon
                  className="text-gray-300"
                  style={{ fontSize: "clamp(28px, 5vw, 40px)" }}
                />
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
                Welcome to BeatStream
              </h3>
              <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
                Start adding your favourite tracks to get personalised
                recommendations.
              </p>

              {/* Call-to-action buttons (placeholders for future features) */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6 sm:mt-8">
                <button
                  className="w-full sm:w-auto px-6 py-2.5 text-white text-sm font-semibold rounded-full shadow-sm transition-colors"
                  style={{ background: PRIMARY }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = PRIMARY_H)
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = PRIMARY)
                  }
                >
                  Browse Music
                </button>
                <button className="w-full sm:w-auto px-6 py-2.5 bg-white text-gray-700 text-sm font-semibold rounded-full border border-gray-200 hover:bg-gray-50 transition-colors">
                  Explore Sections
                </button>
              </div>
            </div>
          )}

          {/* Bottom spacer for scroll behavior */}
          <div className="h-4 sm:h-6 md:h-8" />
        </div>
      </div>

      {/* Scroll-to-top button - appears when scrolled > 300px */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className={`fixed z-[50] w-9 h-9 md:w-10 md:h-10 text-white rounded-full shadow-lg transition-all duration-200 flex items-center justify-center hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${isMobile
              ? "bottom-24 right-4" // Above MobileNav (bottom-24 = 96px)
              : "bottom-28 right-6 md:right-8" // Above PlayerBar (bottom-28 = 112px)
            }`}
          style={{ background: PRIMARY }}
          aria-label="Scroll to top"
        >
          <KeyboardArrowUpIcon fontSize="small" />
        </button>
      )}
    </div>
  );
};

export default HomePage;