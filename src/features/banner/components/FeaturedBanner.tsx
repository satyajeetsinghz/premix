/**
 * @fileoverview Hero banner carousel component for the homepage.
 *
 * Responsibilities:
 * - Display active banners in an auto-sliding carousel
 * - Support both image and video banner backgrounds
 * - Provide manual navigation (arrows, progress dots, keyboard)
 * - Handle banner click actions (play song, navigate to artist/section)
 * - Auto-pause on hover, resume on mouse leave
 *
 * Related modules:
 * - useBanners (src/features/banner/hooks/useBanners.ts) - Fetches active banners ordered by 'order' field
 * - useSongs (src/features/songs/hooks/useSongs.ts) - Fetches songs for redirect target lookup
 * - usePlayer (src/features/player/hooks/usePlayer.ts) - Plays songs when banner redirects to song
 * - useResponsive (src/components/layout/hooks/useResponsive.ts) - Responsive sizing for different devices
 *
 * Architectural role:
 * - **Homepage hero section component** (rendered on route "/")
 * - Fetches only active banners (isActive = true) within date range
 * - Banners ordered by 'order' field (1-indexed, ascending)
 *
 * Security boundary (from Firestore security rules):
 * - All authenticated users can read banners (isReadable() = true)
 * - Suspended users can still see banners (read-only access)
 * - Banned users never reach this component (blocked earlier)
 *
 * Banner filtering (useBanners with activeOnly = false):
 * - This component uses activeOnly = true to fetch only active banners
 * - Banners automatically filtered by date range in the hook
 * - Expired/scheduled banners not shown (isActive check + date validation)
 *
 * Auto-slide behavior:
 * - Slides change every SLIDE_INTERVAL_MS (6 seconds)
 * - Pauses when user hovers over carousel
 * - Resumes on mouse leave
 * - Cleans up interval on unmount
 *
 * Accessibility:
 * - Keyboard navigation (left/right arrows)
 * - ARIA labels for all interactive elements
 * - Progress dots with hover tooltips
 * - Focus management for keyboard users
 *
 * Performance:
 * - useMemo for mappedSongs (prevents re-mapping on every render)
 * - useCallback for event handlers (stable references)
 * - Framer Motion animations with GPU acceleration (transform/opacity)
 * - Lazy loading for images (not applicable to hero banner, uses eager)
 *
 * @module features/banner/components
 */

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useBanners } from "../hooks/useBanners";
import { useSongs } from "@/features/songs/hooks/useSongs";
import { usePlayer } from "@/features/player/hooks/usePlayer";
import { useNavigate } from "react-router-dom";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { useResponsive } from "@/components/layout/hooks/useResponsive";

/**
 * Auto-slide interval in milliseconds.
 * Slides change every 6 seconds (provides enough time to read content).
 */
const SLIDE_INTERVAL_MS = 6000;

/**
 * Props for the ProgressDot component.
 *
 * @property index - Slide index (0-based)
 * @property isActive - Whether this dot represents the current slide
 * @property isPaused - Whether auto-slide is paused (affects progress bar animation)
 * @property isMobile - Responsive flag for sizing
 * @property isTablet - Responsive flag for sizing
 * @property onClick - Click handler to navigate to slide
 */
interface ProgressDotProps {
  index: number;
  isActive: boolean;
  isPaused: boolean;
  isMobile: boolean;
  isTablet: boolean;
  onClick: (index: number) => void;
}

/**
 * ProgressDot - Animated pagination indicator for carousel slides.
 *
 * Visual design:
 * - Inactive: small gray dot
 * - Active: wider red dot with animated progress bar
 * - Progress bar animation timing matches SLIDE_INTERVAL_MS
 * - Progress bar pauses when carousel is hovered
 *
 * @param props - ProgressDotProps
 * @returns Animated button for slide navigation
 */
const ProgressDot = ({
  index,
  isActive,
  isPaused,
  isMobile,
  isTablet,
  onClick,
}: ProgressDotProps) => {
  /**
   * Dynamic width based on device:
   * - Mobile: 16px active, 4px inactive
   * - Tablet: 24px active, 6px inactive
   * - Desktop: 32px active, 6px inactive
   */
  const activeWidth = isMobile ? 16 : isTablet ? 24 : 32;
  const inactiveWidth = isMobile ? 4 : 6;

  return (
    <motion.button
      onClick={() => onClick(index)}
      className="relative cursor-pointer group/dot"
      aria-label={`Go to slide ${index + 1}`}
      whileHover={{ scale: 1.2 }}
      whileTap={{ scale: 0.9 }}
    >
      {/* Dot container - width animates on active/inactive transition */}
      <motion.div
        className="rounded-full overflow-hidden"
        animate={{
          backgroundColor: isActive ? "#fa243c" : "rgba(255,255,255,0.35)",
          width: isActive ? activeWidth : inactiveWidth,
          height: 4,
        }}
        transition={{ duration: 0.3 }}
      >
        {/* Progress bar - only visible on active dot */}
        {isActive && (
          <motion.div
            className="h-full bg-white rounded-full"
            initial={{ width: "0%" }}
            animate={{ width: isPaused ? "0%" : "100%" }}
            transition={{
              duration: SLIDE_INTERVAL_MS / 1000,
              ease: "linear",
            }}
          />
        )}
      </motion.div>

      {/* Tooltip on hover (desktop only) */}
      <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/70 backdrop-blur-md text-white text-xs rounded-lg opacity-0 group-hover/dot:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none hidden sm:block">
        Slide {index + 1}
      </div>
    </motion.button>
  );
};

/**
 * Props for the NavArrow component.
 *
 * @property direction - "left" or "right" (determines arrow icon)
 * @property onClick - Click handler with event parameter (stops propagation)
 */
interface NavArrowProps {
  direction: "left" | "right";
  onClick: (e: React.MouseEvent) => void;
}

/**
 * NavArrow - Navigation button for carousel (previous/next).
 *
 * Visible on hover (desktop only), hidden on mobile (progress dots suffice).
 *
 * @param props - NavArrowProps
 * @returns Animated button with arrow icon
 */
const NavArrow = ({ direction, onClick }: NavArrowProps) => (
  <motion.button
    whileHover={{ scale: 1.1, backgroundColor: "rgba(0,0,0,0.55)" }}
    whileTap={{ scale: 0.9 }}
    onClick={onClick}
    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/30 backdrop-blur-md text-white flex items-center justify-center cursor-pointer"
    aria-label={direction === "left" ? "Previous slide" : "Next slide"}
  >
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d={direction === "left" ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"}
      />
    </svg>
  </motion.button>
);

/**
 * FeaturedBanner - Hero banner carousel for the homepage.
 *
 * Usage in HomePage:
 * ```tsx
 * <FeaturedBanner />
 * ```
 *
 * Data fetching:
 * - useBanners(activeOnly = true) fetches only banners with isActive = true
 * - Automatically filters by date range (active banners only)
 * - Sorted by 'order' field (1-indexed, ascending)
 *
 * Animation flow:
 * 1. Banner fades in (opacity 0 → 1) over 0.45s
 * 2. Text content slides up (y: 20 → 0) with 0.2s delay
 * 3. Background image scales (scale: 1.06 → 1) over 5s (subtle zoom)
 * 4. Progress bar animation starts (width: 0% → 100%) over 6s
 * 5. After 6s: next banner fades in
 *
 * User interactions:
 * - Hover: pauses auto-slide, shows navigation arrows (desktop only)
 * - Click arrows: manual navigation, resets interval
 * - Click progress dots: jump to slide, resets interval
 * - Keyboard arrows: previous/next (global, works anywhere)
 *
 * Redirect handling:
 * - "song": Finds song in mappedSongs, calls playTrack with queue
 * - "artist": Navigates to /artist/{id}
 * - "section": Navigates to /section/{id}
 *
 * @returns Hero banner carousel JSX (or loading/empty placeholder)
 */
const FeaturedBanner = () => {
  const { banners, loading } = useBanners(false);
  const { songs } = useSongs();
  const { playTrack } = usePlayer();
  const navigate = useNavigate();
  const { isMobile, isTablet } = useResponsive();

  // --- State ---
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // --- Refs for lifecycle management ---
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  /**
   * Track component mount state to prevent state updates after unmount.
   */
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * Clears the auto-slide interval.
   */
  const clearSlideInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  /**
   * Starts the auto-slide interval if component is mounted.
   *
   * Called when:
   * - Component mounts
   * - isPaused becomes false
   * - banners.length changes
   */
  const startSlideInterval = useCallback(() => {
    clearSlideInterval();
    if (!banners.length || !mountedRef.current) return;

    intervalRef.current = setInterval(() => {
      if (mountedRef.current) {
        setCurrent((prev) => (prev + 1) % banners.length);
      }
    }, SLIDE_INTERVAL_MS);
  }, [banners.length, clearSlideInterval]);

  /**
   * Effect 1: Handle auto-slide based on pause state.
   *
   * When paused: clear interval
   * When unpaused: start interval
   *
   * Cleanup: clear interval on unmount or when dependencies change.
   */
  useEffect(() => {
    if (isPaused) {
      clearSlideInterval();
    } else {
      startSlideInterval();
    }

    return () => {
      clearSlideInterval();
    };
  }, [isPaused, startSlideInterval, clearSlideInterval]);

  /**
   * Effect 2: Clamp current index if it exceeds banners length.
   *
   * Prevents index out of bounds when banners are deleted.
   */
  useEffect(() => {
    if (banners.length && current >= banners.length && mountedRef.current) {
      setCurrent(banners.length - 1);
    }
  }, [banners.length, current]);

  /**
   * Effect 3: Reset current index when banners change.
   *
   * Ensures component starts at slide 0 when new banners load.
   */
  useEffect(() => {
    if (banners.length > 0 && mountedRef.current) {
      setCurrent(0);
    }
  }, [banners.length]);

  /**
   * Effect 4: Keyboard navigation (left/right arrows).
   *
   * Works globally when carousel is visible.
   * Left arrow: previous slide
   * Right arrow: next slide
   */
  useEffect(() => {
    if (!banners.length) return;

    const handler = (e: KeyboardEvent) => {
      if (!mountedRef.current) return;

      if (e.key === "ArrowLeft") {
        setCurrent((p) => (p - 1 + banners.length) % banners.length);
      } else if (e.key === "ArrowRight") {
        setCurrent((p) => (p + 1) % banners.length);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [banners.length]);

  /**
   * Memoized songs array for quick redirect lookup.
   *
   * Maps songs to { id, title, artist, audioUrl, coverUrl }.
   * Used when banner redirects to a song.
   *
   * Performance: Recalculates only when songs array changes.
   */
  const mappedSongs = useMemo(
    () =>
      songs.map((s) => ({
        id: s.id,
        title: s.title,
        artist: s.artist,
        audioUrl: s.audioUrl,
        coverUrl: s.coverUrl,
      })),
    [songs],
  );

  /**
   * Handles click on banner's primary action button.
   *
   * Redirects based on banner.redirectType:
   * - song: Find song in mappedSongs and play with full queue
   * - artist: Navigate to /artist/{id}
   * - section: Navigate to /section/{id}
   *
   * @param e - Mouse event (stops propagation)
   */
  const handlePlayClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      const banner = banners[current];
      if (!banner?.redirectType) return;

      switch (banner.redirectType) {
        case "song": {
          const track = mappedSongs.find((s) => s.id === banner.redirectId);
          if (!track) {
            console.warn(
              `[FeaturedBanner] Song not found: ${banner.redirectId}`,
            );
            return;
          }
          playTrack(track, mappedSongs);
          break;
        }
        case "artist":
          navigate(`/artist/${banner.redirectId}`);
          break;
        case "section":
          navigate(`/section/${banner.redirectId}`);
          break;
        default:
          console.warn(
            `[FeaturedBanner] Unknown redirect type: ${banner.redirectType}`,
          );
      }
    },
    [banners, current, mappedSongs, navigate, playTrack],
  );

  /**
   * Handles click on "Learn More" button.
   *
   * Currently logs to console (placeholder for future feature).
   * Could open modal or navigate to dedicated page.
   *
   * @param e - Mouse event (stops propagation)
   */
  const handleLearnMoreClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      console.info("[FeaturedBanner] Learn more:", banners[current]?.title);
    },
    [banners, current],
  );

  /**
   * Navigates to a specific slide and restarts auto-slide interval.
   *
   * @param index - Target slide index (0-based)
   */
  const goTo = useCallback(
    (index: number) => {
      if (!mountedRef.current) return;
      setCurrent(index);
      startSlideInterval();
    },
    [startSlideInterval],
  );

  /**
   * Navigates to previous slide and restarts interval.
   *
   * @param e - Mouse event (stops propagation)
   */
  const goPrev = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!banners.length || !mountedRef.current) return;
      goTo((current - 1 + banners.length) % banners.length);
    },
    [current, banners.length, goTo],
  );

  /**
   * Navigates to next slide and restarts interval.
   *
   * @param e - Mouse event (stops propagation)
   */
  const goNext = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!banners.length || !mountedRef.current) return;
      goTo((current + 1) % banners.length);
    },
    [current, banners.length, goTo],
  );

  // --- Loading state ---
  if (loading) {
    return (
      <div className="relative w-full h-[180px] sm:h-[260px] bg-gray-200 rounded-2xl mb-8 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-[#fa243c] rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading promotions...</p>
        </div>
      </div>
    );
  }

  // --- Empty state (no active banners) ---
  if (!banners.length) {
    return (
      <div className="relative w-full h-[180px] sm:h-[260px] bg-gray-200 rounded-2xl mb-8 flex items-center justify-center">
        <p className="text-gray-500 font-semibold text-sm">
          No active promotions
        </p>
      </div>
    );
  }

  const banner = banners[current];
  if (!banner) return null;

  /**
   * Responsive banner height:
   * - Mobile: 200px
   * - Tablet: 250px
   * - Desktop: 300px
   */
  const bannerHeight = isMobile ? 200 : isTablet ? 250 : 300;
  const showControls = banners.length > 1;

  return (
    <div
      className="relative w-full overflow-hidden rounded-3xl mb-6 sm:mb-8 md:mb-12 group/banner"
      style={{ height: bannerHeight }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={banner.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          {/* Background media (image or video) with subtle zoom effect */}
          <motion.div
            className="absolute inset-0"
            initial={{ scale: 1.06 }}
            animate={{ scale: 1 }}
            transition={{ duration: 5, ease: "easeOut" }}
          >
            {banner.mediaType === "video" && banner.mediaUrl ? (
              <video
                key={banner.id}
                src={banner.mediaUrl}
                autoPlay
                muted
                loop
                playsInline
                className="w-full h-full object-cover pointer-events-none"
                onError={(e) => {
                  console.error("Video failed to load:", e);
                  // Fallback: hide video element (image will still show)
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <img
                src={banner.imageUrl}
                alt={banner.title}
                loading="eager"
                draggable={false}
                className="w-full h-full object-cover pointer-events-none select-none"
              />
            )}
          </motion.div>

          {/* Gradient overlays for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-transparent to-transparent pointer-events-none" />

          {/* Content overlay (title, subtitle, buttons) */}
          <div className="absolute inset-0 flex items-end md:items-center px-4 sm:px-6 md:px-12 lg:px-16 pb-12 sm:pb-0">
            <motion.div
              className="max-w-lg sm:max-w-xl md:max-w-2xl text-white"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.45, ease: "easeOut" }}
            >
              {/* "Featured" badge */}
              <span className="inline-block px-2.5 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] sm:text-xs font-semibold mb-2 sm:mb-3 tracking-wide uppercase select-none">
                Featured
              </span>

              {/* Banner title */}
              <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold mb-1.5 sm:mb-2 md:mb-3 tracking-tight leading-tight line-clamp-2">
                {banner.title}
              </h1>

              {/* Banner subtitle (optional) */}
              {banner.subtitle && (
                <p className="text-xs sm:text-sm md:text-base text-white/70 mb-4 sm:mb-5 max-w-md line-clamp-2">
                  {banner.subtitle}
                </p>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {/* Primary button (Play/Listen Now) */}
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={handlePlayClick}
                  className="flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-1.5 sm:py-2 bg-white text-gray-900 font-semibold rounded-full hover:bg-[#fa243c] hover:text-white transition-colors duration-200 shadow-lg text-xs sm:text-sm cursor-pointer select-none"
                >
                  <PlayCircleIcon sx={{ fontSize: isMobile ? 16 : 18 }} />
                  <span>
                    {banner.buttonText || (isMobile ? "Play" : "Play Now")}
                  </span>
                </motion.button>

                {/* Secondary button (Learn More) - hidden on mobile */}
                {!isMobile && (
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={handleLearnMoreClick}
                    className="flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-1.5 sm:py-2 bg-white/20 backdrop-blur-md text-white font-semibold rounded-full hover:bg-white/30 transition-colors duration-200 border border-white/15 text-xs sm:text-sm cursor-pointer select-none"
                  >
                    <InfoOutlinedIcon sx={{ fontSize: 16 }} />
                    <span>Learn More</span>
                  </motion.button>
                )}
              </div>
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Progress dots (pagination) */}
      {showControls && (
        <div className="absolute bottom-3 sm:bottom-4 md:bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 sm:gap-2 z-30">
          {banners.map((_, index) => (
            <ProgressDot
              key={index}
              index={index}
              isActive={index === current}
              isPaused={isPaused}
              isMobile={isMobile}
              isTablet={isTablet}
              onClick={goTo}
            />
          ))}
        </div>
      )}

      {/* Navigation arrows - visible on hover (desktop only) */}
      {showControls && (
        <div className="hidden sm:flex absolute inset-0 items-center justify-between px-3 sm:px-4 opacity-0 group-hover/banner:opacity-100 transition-opacity duration-300 z-30 pointer-events-none">
          <div className="pointer-events-auto">
            <NavArrow direction="left" onClick={goPrev} />
          </div>
          <div className="pointer-events-auto">
            <NavArrow direction="right" onClick={goNext} />
          </div>
        </div>
      )}

      {/* Slide counter (e.g., "1 / 5") */}
      {showControls && (
        <div className="absolute top-3 sm:top-4 right-3 sm:right-4 px-2.5 py-1 bg-black/30 backdrop-blur-md rounded-full text-[10px] sm:text-xs text-white/80 z-30 tabular-nums font-medium select-none pointer-events-none">
          {current + 1} / {banners.length}
        </div>
      )}
    </div>
  );
};

export default FeaturedBanner;