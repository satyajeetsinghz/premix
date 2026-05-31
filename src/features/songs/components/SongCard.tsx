/**
 * @fileoverview Reusable song card component with multiple visual variants and context menu.
 *
 * Responsibilities:
 * - Display song artwork, title, artist in three variants (default, compact, playlist)
 * - Provide play button to start playback with current queue
 * - Show like/unlike button with real-time status from Firestore
 * - Provide context menu (three dots) with "Add to Playlist" and "Add to Favorites" options
 * - Handle playlist selection submenu with visual feedback (checkmark) on successful add
 *
 * Related modules:
 * - usePlayer (src/features/player/hooks/usePlayer.ts) - Provides playTrack function
 * - useLike (src/features/likes/hooks/useLike.ts) - Provides like status and toggle function
 * - usePlaylists (src/features/playlists/hooks/usePlaylists.ts) - Provides user's playlists for "Add to Playlist"
 * - playlistService (src/features/playlists/services/playlistService.ts) - Handles adding songs to playlists
 *
 * Architectural role:
 * - **Core UI component** for displaying songs across the app
 * - Used in: HomePage (sections), LibraryPage, ProfilePage (history), PlaylistPage, LikedSongs
 *
 * Visual variants:
 *
 * 1. "default" (grid card):
 *    - Used in: SectionShell carousels (HomePage, ProfilePage history)
 *    - Square cover art (140x140 on mobile, 172x172 on desktop)
 *    - Hover: play button + more menu button slide up, dark overlay
 *
 * 2. "compact" (horizontal list item):
 *    - Used in: Currently not in production (reserved for future)
 *    - Small cover art (32-40px), horizontal layout
 *    - Like button appears on hover
 *
 * 3. "playlist" (table row):
 *    - Used in: PlaylistPage, LikedSongs page
 *    - Grid layout: index/play button | cover + title | artist | album | duration + like
 *    - Row click plays song from that position
 *
 * Context menu features:
 * - "Add to Playlist" → opens submenu with user's playlists (fetched from usePlaylists)
 * - "Add to Favorites" → toggle like (if not disabled via disableLike prop)
 * - "New Playlist" shortcut (placeholder - currently closes menu)
 *
 * Performance:
 * - React.memo prevents unnecessary re-renders of SongCard instances
 * - useCallback for event handlers (stable references for child components)
 * - ContextMenu uses createPortal (renders at document.body to avoid z-index issues)
 * - Dynamic position calculation prevents menu from overflowing viewport
 *
 * @module features/songs/components
 */

import { ISong } from "../types";
import { usePlayer } from "@/features/player/hooks/usePlayer";
import { useLike } from "@/features/likes/hooks/useLike";
import { usePlaylists } from "@/features/playlists/hooks/usePlaylists";
import {
  addSongToPlaylist,
  iSongToPlaylistSong,
} from "@/features/playlists/services/playlistService";
import { useRef, useState, useEffect, useCallback, memo } from "react";
import { createPortal } from "react-dom";

// MUI Icons - used for visual elements
import PlayCircleRoundedIcon from "@mui/icons-material/PlayCircleRounded";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import LibraryMusicIcon from "@mui/icons-material/LibraryMusic";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import CheckIcon from "@mui/icons-material/Check";
import AccessTimeIcon from "@mui/icons-material/AccessTime";

/**
 * Props for the SongCard component.
 *
 * @property track - Song object to display (contains title, artist, coverUrl, duration, etc.)
 * @property songs - Full array of songs (used for queue when playing from this card)
 * @property variant - Visual style: "default" (grid), "compact" (horizontal), "playlist" (table row)
 * @property index - Optional track number for playlist variant (1-indexed display)
 * @property disableLike - When true, hides like button (used in history section where likes are disabled)
 */
interface Props {
  track: ISong;
  songs: ISong[];
  variant?: "default" | "compact" | "playlist";
  index?: number;
  disableLike?: boolean;
}

/**
 * Props for the MenuRowLight component.
 *
 * @property icon - React node for icon (left side of menu row)
 * @property iconCls - Optional CSS classes for icon styling (e.g., text color)
 * @property label - Menu item text
 * @property right - Optional element rendered on the right side (e.g., chevron or count)
 * @property onClick - Click handler for the menu row
 */
interface MenuRowProps {
  icon: React.ReactNode;
  iconCls?: string;
  label: string;
  right?: React.ReactNode;
  onClick: () => void;
}

/**
 * MenuRowLight - Reusable menu item component with icon + label + optional right element.
 *
 * Used in ContextMenu for "Add to Playlist" and "Add to Favorites" options.
 * Memoized with React.memo to prevent unnecessary re-renders when parent menu re-renders.
 *
 * @param props - MenuRowProps
 * @returns Button with menu item layout
 */
const MenuRowLight = memo(
  ({ icon, iconCls = "", label, right, onClick }: MenuRowProps) => (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 w-full px-3 py-[9px] hover:bg-gray-50 active:bg-gray-100 transition-colors duration-100 text-left"
    >
      <span className={`flex items-center shrink-0 ${iconCls}`}>{icon}</span>
      <span className="flex-1 text-[13px] text-gray-700 tracking-[-0.1px]">
        {label}
      </span>
      {right && (
        <span className="text-gray-300 flex items-center">{right}</span>
      )}
    </button>
  ),
);

MenuRowLight.displayName = "MenuRowLight";

/**
 * Props for the ContextMenu component.
 *
 * @property track - Song object (used for displaying in menu header)
 * @property isLiked - Whether the song is currently liked by the user
 * @property onToggleLike - Callback to toggle like status (calls useLike.toggleLike)
 * @property onClose - Callback to close the menu (called on any action or outside click)
 * @property anchorRef - Ref to the button that opened the menu (used for positioning)
 * @property disableLike - When true, hides the like option in menu
 */
interface ContextMenuProps {
  track: ISong;
  isLiked: boolean;
  onToggleLike: () => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  disableLike: boolean;
}

/**
 * ContextMenu - Floating menu with "Add to Playlist" and "Add to Favorites" options.
 *
 * Features:
 * - Rendered via createPortal at document.body (avoids z-index stacking issues)
 * - Dynamic positioning: calculates position relative to anchor button
 * - Prevents menu from overflowing viewport edges
 * - Two-level navigation: main menu → playlist selection submenu
 * - Shows checkmark animation when song added to playlist
 *
 * Performance:
 * - Memoized with React.memo (prevents re-renders when parent toggles visibility)
 * - Cleanup event listeners on unmount
 *
 * @param props - ContextMenuProps
 * @returns Portal-rendered context menu or null (if position not ready)
 */
const ContextMenu = memo(
  ({
    track,
    isLiked,
    onToggleLike,
    onClose,
    anchorRef,
    disableLike,
  }: ContextMenuProps) => {
    const { playlists } = usePlaylists(); // Fetch user's playlists for "Add to Playlist" submenu
    const [activeMenu, setActiveMenu] = useState<"main" | "playlists">("main"); // Track which submenu is visible
    const [addedId, setAddedId] = useState<string | null>(null); // Track which playlist got the add (for checkmark)
    const menuRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ top: 0, left: 0, ready: false });

    /**
     * Effect 1: Calculate menu position relative to anchor button.
     *
     * Steps:
     * 1. Get bounding rectangles of anchor button and menu
     * 2. Default position: right of button (btn.right + 8)
     * 3. If menu would overflow right edge: position left of button (btn.left - menu.width - 8)
     * 4. If still off-screen: center horizontally (fallback)
     * 5. Adjust vertical position if menu would overflow bottom/top
     * 6. Set pos.ready = true to trigger opacity transition
     *
     * Delay (setTimeout 10ms) ensures menu DOM has rendered before measuring.
     *
     * Re-runs when anchorRef or activeMenu changes (menu width may differ between main and playlists view).
     */
    useEffect(() => {
      if (!anchorRef.current || !menuRef.current) return;

      const updatePosition = () => {
        if (!anchorRef.current || !menuRef.current) return;

        const btn = anchorRef.current.getBoundingClientRect();
        const menu = menuRef.current.getBoundingClientRect();
        const mw = menu.width;
        const mh = menu.height;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        // Default: position menu to the right of the button
        let left = btn.right + 8;
        let top = btn.top;

        // If menu would overflow right edge, position to the left instead
        if (left + mw > vw - 8) {
          left = btn.left - mw - 8;

          // If still off-screen, center horizontally
          if (left < 8) {
            left = Math.max(8, (vw - mw) / 2);
          }
        }

        // Prevent vertical overflow (bottom)
        if (top + mh > vh - 8) {
          top = vh - mh - 8;
        }
        // Prevent vertical overflow (top)
        if (top < 8) {
          top = 8;
        }

        setPos({ top, left, ready: true });
      };

      const timer = setTimeout(updatePosition, 10);
      return () => clearTimeout(timer);
    }, [anchorRef, activeMenu]); // Re-run when submenu changes (different menu height)

    /**
     * Effect 2: Close menu on scroll or resize.
     *
     * When user scrolls or resizes window, the anchor button position changes.
     * Rather than repositioning, we simply close the menu (cleaner UX).
     *
     * Uses capture phase (true) to catch scroll events before they bubble.
     */
    useEffect(() => {
      if (!pos.ready) return;

      const handleClose = () => onClose();

      window.addEventListener("scroll", handleClose, true);
      window.addEventListener("resize", handleClose);

      return () => {
        window.removeEventListener("scroll", handleClose, true);
        window.removeEventListener("resize", handleClose);
      };
    }, [onClose, pos.ready]);

    /**
     * Effect 3: Close menu when clicking outside.
     *
     * Checks if click target is outside both the menu and the anchor button.
     * Uses mousedown (not click) for faster response.
     */
    useEffect(() => {
      const handler = (e: MouseEvent) => {
        if (menuRef.current?.contains(e.target as Node)) return;
        if (anchorRef.current?.contains(e.target as Node)) return;
        onClose();
      };

      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }, [onClose, anchorRef]);

    /**
     * Adds current song to selected playlist.
     *
     * Steps:
     * 1. Set addedId to show checkmark animation
     * 2. Call addSongToPlaylist service (batch write: song doc + increment songCount)
     * 3. Wait 750ms (shows checkmark), then close menu
     * 4. On error: console log (no UI feedback - keeps menu open)
     *
     * @param playlistId - ID of playlist to add song to
     */
    const handleAddToPlaylist = useCallback(
      async (playlistId: string) => {
        try {
          setAddedId(playlistId);
          await addSongToPlaylist(playlistId, iSongToPlaylistSong(track));
          // Delay close to show checkmark animation
          setTimeout(() => {
            setAddedId(null);
            onClose();
          }, 750);
        } catch (error) {
          console.error("Failed to add song to playlist:", error);
          setAddedId(null);
        }
      },
      [track, onClose],
    );

    return createPortal(
      <>
        {/* CSS animations for menu entrance and submenu transitions */}
        <style>{`
                @keyframes menuPop {
                    from { opacity: 0; transform: scale(0.88) translateY(-6px); }
                    to   { opacity: 1; transform: scale(1)    translateY(0); }
                }
                @keyframes slideIn {
                    from { opacity: 0; transform: translateX(12px); }
                    to   { opacity: 1; transform: translateX(0); }
                }
                @keyframes slideBack {
                    from { opacity: 0; transform: translateX(-12px); }
                    to   { opacity: 1; transform: translateX(0); }
                }
            `}</style>

        {/* Menu container - positioned absolutely based on calculated coordinates */}
        <div
          ref={menuRef}
          className="fixed z-[9999] rounded-xl overflow-hidden"
          style={{
            width: Math.min(232, window.innerWidth - 32), // Max 232px, prevent overflow on small screens
            top: pos.top,
            left: pos.left,
            opacity: pos.ready ? 1 : 0, // Fade in only after position calculated
            background: "rgba(255,255,255,0.98)",
            backdropFilter: "blur(20px) saturate(180%)", // Glassmorphism effect
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow:
              "0 10px 30px rgba(0,0,0,0.12), 0 1px 8px rgba(0,0,0,0.04)",
            transition: "opacity 0.2s ease",
          }}
        >
          {/* Menu header - shows song artwork, title, artist */}
          <div className="flex items-center gap-3 px-3 py-3 border-b border-gray-200/60">
            <img
              src={track.coverUrl || "/default-album.jpg"}
              alt={track.title}
              className="w-10 h-10 rounded-lg object-cover shrink-0 shadow-sm"
            />
            <div className="overflow-hidden">
              <p className="text-[13px] font-semibold text-gray-800 truncate tracking-[-0.1px]">
                {track.title}
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                {track.artist}
              </p>
            </div>
          </div>

          {/* Main menu (first level) */}
          {activeMenu === "main" && (
            <div
              className="py-1"
              style={{ animation: pos.ready ? "slideIn 0.15s ease" : "none" }}
            >
              <MenuRowLight
                icon={<PlaylistAddIcon sx={{ fontSize: 16 }} />}
                iconCls="text-[#fa243c]"
                label="Add to Playlist"
                right={<ChevronRightIcon sx={{ fontSize: 14 }} />}
                onClick={() => setActiveMenu("playlists")}
              />

              {/* Like/Unlike option - hidden if disableLike = true */}
              {!disableLike && (
                <MenuRowLight
                  icon={
                    isLiked ? (
                      <FavoriteIcon sx={{ fontSize: 15 }} />
                    ) : (
                      <FavoriteBorderIcon sx={{ fontSize: 15 }} />
                    )
                  }
                  iconCls={isLiked ? "text-[#fa243c]" : "text-gray-400"}
                  label={isLiked ? "Remove from Favorites" : "Add to Favorites"}
                  onClick={() => {
                    onToggleLike(); // Toggle like status via useLike hook
                    onClose(); // Close menu after action
                  }}
                />
              )}
            </div>
          )}

          {/* Playlist selection submenu (second level) */}
          {activeMenu === "playlists" && (
            <div
              className="py-1"
              style={{ animation: pos.ready ? "slideBack 0.15s ease" : "none" }}
            >
              {/* Back button to return to main menu */}
              <button
                onClick={() => setActiveMenu("main")}
                className="flex items-center gap-1.5 w-full px-3 py-2 text-[12.5px] text-[#fa243c] hover:bg-gray-50 transition-colors"
              >
                <ChevronLeftIcon sx={{ fontSize: 14 }} />
                <span>Back</span>
              </button>
              <div className="h-px bg-gray-100 my-1" />

              {/* Empty state: no playlists yet */}
              {playlists.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-5 text-gray-300">
                  <LibraryMusicIcon sx={{ fontSize: 22, color: "#d1d5db" }} />
                  <p className="text-[12px] text-gray-400">No playlists yet</p>
                </div>
              ) : (
                /* Scrollable list of playlists (max height 208px) */
                <div className="max-h-52 overflow-y-auto">
                  {playlists.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleAddToPlaylist(p.id)}
                      className="flex items-center gap-2.5 w-full px-3 py-[9px] hover:bg-gray-50 transition-colors"
                    >
                      <span className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 shrink-0">
                        <LibraryMusicIcon sx={{ fontSize: 13 }} />
                      </span>
                      <span className="flex-1 text-[13px] text-gray-700 text-left truncate">
                        {p.name}
                      </span>
                      {/* Show checkmark when added, otherwise song count */}
                      {addedId === p.id ? (
                        <span className="text-[#fa243c]">
                          <CheckIcon sx={{ fontSize: 14 }} />
                        </span>
                      ) : (
                        <span className="text-[11px] text-gray-400">
                          {p.songCount ?? 0}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              <div className="h-px bg-gray-100 my-1" />

              {/* New Playlist shortcut (placeholder - currently just closes menu) */}
              <button
                onClick={() => {
                  onClose();
                  setActiveMenu("main");
                }}
                className="flex items-center gap-2.5 w-full px-3 py-[9px] text-[#fa243c] text-[13px] hover:bg-gray-50 transition-colors"
              >
                <span className="text-[18px] leading-none">+</span>
                <span>New Playlist</span>
              </button>
            </div>
          )}
        </div>
      </>,
      document.body, // Render at document.body to escape parent z-index/overflow constraints
    );
  },
);

ContextMenu.displayName = "ContextMenu";

/**
 * EqBars - Animated equalizer bars for currently playing song indicator.
 *
 * Three bars with staggered animation delays create a pulsing effect.
 * Used in playlist variant when song is currently playing (currently not implemented).
 *
 * Animation: bars grow from 25% to 100% height, alternating.
 *
 * @returns SVG-like div-based equalizer animation
 */
const EqBars = memo(() => (
  <div className="flex items-end gap-px h-3.5">
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        className="w-[3px] rounded-sm bg-[#fa243c] animate-eqBar"
        style={{ animationDelay: `${i * 0.15}s` }}
      />
    ))}
    <style>{`
            @keyframes eqBar {
                0%, 100% { height: 25%; }
                50% { height: 100%; }
            }
            .animate-eqBar {
                animation: eqBar 0.7s ease-in-out infinite alternate;
            }
        `}</style>
  </div>
));

EqBars.displayName = "EqBars";

/**
 * SongCard - Main component for displaying a song.
 *
 * Memoized with React.memo to prevent re-rendering when parent re-renders
 * but track and songs props haven't changed.
 *
 * @param props - Props
 * @returns Song card JSX based on variant
 */
const SongCard = memo(
  ({
    track,
    songs,
    variant = "default",
    index,
    disableLike = false,
  }: Props) => {
    const { playTrack } = usePlayer(); // Global playback control
    const { isLiked, toggleLike } = useLike(track.id); // Like status and toggle function
    const [isHovered, setIsHovered] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const moreButtonRef = useRef<HTMLButtonElement>(null);

    /**
     * Handles play button click.
     * Calls playTrack with current song and full queue (songs array).
     *
     * useCallback ensures stable reference for child components.
     */
    const handlePlay = useCallback(() => {
      playTrack(track, songs);
    }, [playTrack, track, songs]);

    // Menu is considered "active" when either hovered OR menu is open (keeps buttons visible)
    const active = isHovered || isMenuOpen;

    // ==================== VARIANT: DEFAULT (GRID CARD) ====================
    if (variant === "default") {
      return (
        <div
          className="relative w-[140px] sm:w-[172px] select-none"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Cover art container */}
          <div className="relative w-[140px] h-[140px] sm:w-[172px] sm:h-[172px] rounded-md overflow-hidden cursor-pointer">
            <img
              src={track.coverUrl || "/default-album.jpg"}
              alt={track.title}
              className="w-full h-full object-cover block"
              loading="lazy" // Lazy load images below viewport
              style={{
                // Dynamic shadow based on hover state
                boxShadow: active
                  ? "0 20px 32px rgba(0,0,0,0.25), 0 4px 12px rgba(0,0,0,0.15)"
                  : "0 8px 20px rgba(0,0,0,0.1)",
              }}
            />

            {/* Dark overlay on hover */}
            <div
              className="absolute inset-0 bg-black/30 transition-opacity duration-200"
              style={{ opacity: active ? 1 : 0 }}
            />

            {/* Play button - slides up on hover */}
            <button
              onClick={handlePlay}
              className="absolute bottom-2.5 sm:bottom-1.5 left-2 w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center"
              style={{
                opacity: active ? 1 : 0,
                transform: `translateY(${active ? 0 : "8px"})`,
                transition:
                  "opacity 0.2s ease, transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1.2)",
              }}
              aria-label="Play song"
            >
              <PlayCircleRoundedIcon
                sx={{
                  fontSize: { xs: 28, sm: 34 },
                  color: "#fff",
                  transition: "color 0.2s ease",
                  "&:hover": {
                    color: "#fa243c", // Brand red on hover
                  },
                }}
              />
            </button>

            {/* More options (three dots) button - slides up on hover */}
            <button
              ref={moreButtonRef}
              onClick={(e) => {
                e.stopPropagation(); // Prevent triggering play
                setIsMenuOpen((v) => !v);
              }}
              className="absolute bottom-3 sm:bottom-2 right-2 w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center"
              style={{
                background: "rgba(28,28,30,0.8)",
                backdropFilter: "blur(4px)",
                WebkitBackdropFilter: "blur(4px)",
                opacity: active ? 1 : 0,
                transform: `translateY(${active ? 0 : "8px"})`,
                transition:
                  "opacity 0.2s ease, transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1.2)",
                border: isMenuOpen ? "1px solid rgba(255,255,255,0.3)" : "none",
              }}
              aria-label="More options"
            >
              <MoreHorizIcon
                sx={{ fontSize: { xs: 14, sm: 18 }, color: "white" }}
              />
            </button>
          </div>

          {/* Song metadata (title + artist) */}
          <div className="mt-2 px-1">
            <p className="text-[11px] sm:text-[13px] font-medium text-gray-900 truncate leading-tight">
              {track.title}
            </p>
            <p className="text-[10px] sm:text-[11px] text-gray-500 truncate mt-0.5">
              {track.artist}
            </p>
          </div>

          {/* Context menu (portal) - conditionally rendered */}
          {isMenuOpen && (
            <ContextMenu
              track={track}
              isLiked={isLiked}
              onToggleLike={toggleLike}
              onClose={() => setIsMenuOpen(false)}
              anchorRef={moreButtonRef}
              disableLike={disableLike}
            />
          )}
        </div>
      );
    }

    // ==================== VARIANT: COMPACT (HORIZONTAL LIST) ====================
    if (variant === "compact") {
      return (
        <div
          className="group flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 rounded-xl cursor-pointer transition-colors duration-150 hover:bg-gray-50"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Cover art container with play overlay on hover */}
          <div className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-lg overflow-hidden shrink-0">
            <img
              src={track.coverUrl || "/default-album.jpg"}
              alt={track.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />

            {/* Play button overlay - appears on hover with scale animation */}
            <div
              className="absolute inset-0 bg-black/45 flex items-center justify-center transition-opacity duration-150"
              style={{ opacity: isHovered ? 1 : 0 }}
            >
              <button
                onClick={handlePlay}
                className="text-white"
                style={{
                  transform: `scale(${isHovered ? 1 : 0.7})`,
                  transition: "transform 0.2s cubic-bezier(0.34,1.56,0.64,1)",
                }}
                aria-label="Play song"
              >
                <PlayCircleRoundedIcon
                  sx={{
                    fontSize: 34,
                    color: "#fff",
                    transition: "color 0.2s ease",
                    "&:hover": {
                      color: "#fa243c",
                    },
                  }}
                />
              </button>
            </div>
          </div>

          {/* Song info (title + artist) */}
          <div className="flex-1 overflow-hidden">
            <p className="text-[11px] sm:text-[13px] font-medium text-gray-900 truncate tracking-[-0.1px]">
              {track.title}
            </p>
            <p className="text-[10px] sm:text-[11.5px] text-gray-500 truncate mt-0.5">
              {track.artist}
            </p>
          </div>

          {/* Like button - visible on hover OR if already liked */}
          {!disableLike && (
            <button
              onClick={toggleLike}
              className="shrink-0 transition-all duration-150 p-1"
              style={{
                opacity: isHovered || isLiked ? 1 : 0,
                transform: `scale(${isHovered || isLiked ? 1 : 0.8})`,
                color: isLiked ? "#fa243c" : "rgba(156,163,175,0.6)",
              }}
              aria-label={
                isLiked ? "Remove from favorites" : "Add to favorites"
              }
            >
              {isLiked ? (
                <FavoriteIcon sx={{ fontSize: { xs: 14, sm: 16 } }} />
              ) : (
                <FavoriteBorderIcon sx={{ fontSize: { xs: 14, sm: 16 } }} />
              )}
            </button>
          )}
        </div>
      );
    }

    // ==================== VARIANT: PLAYLIST (TABLE ROW) ====================
    if (variant === "playlist") {
      return (
        <div
          className="group grid items-center gap-2 sm:gap-4 px-2 sm:px-4 py-2 rounded-xl transition-colors duration-150 hover:bg-gray-50 cursor-pointer"
          style={{ gridTemplateColumns: "24px 1fr 1fr 1fr auto" }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Column 1: Track number (or play button on hover) */}
          <div className="flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 shrink-0">
            {isHovered ? (
              <button
                onClick={handlePlay}
                className="text-gray-600 hover:text-gray-900 transition-colors"
                aria-label="Play song"
              >
                <PlayCircleIcon sx={{ fontSize: { xs: 16, sm: 20 } }} />
              </button>
            ) : (
              <span className="text-[11px] sm:text-[13px] text-gray-400 font-medium tabular-nums">
                {index ?? "•"} {/* Show index or bullet if not provided */}
              </span>
            )}
          </div>

          {/* Column 2: Cover art + Title + Artist (mobile shows artist below title) */}
          <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
            <div className="relative w-7 h-7 sm:w-9 sm:h-9 rounded-md overflow-hidden shrink-0">
              <img
                src={track.coverUrl || "/default-album.jpg"}
                alt={track.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="overflow-hidden">
              <p className="text-[11px] sm:text-[13px] font-medium text-gray-900 truncate">
                {track.title}
              </p>
              {/* Artist appears below title on mobile (hidden on desktop via hidden md:block on parent) */}
              <p className="text-[10px] sm:text-[11px] text-gray-500 truncate mt-0.5">
                {track.artist}
              </p>
            </div>
          </div>

          {/* Column 3: Artist (hidden on mobile, visible on tablet/desktop) */}
          <p className="text-[11px] sm:text-[13px] text-gray-500 truncate px-1 sm:px-2 hidden sm:block">
            {track.artist}
          </p>

          {/* Column 4: Album (hidden on tablet, visible on desktop/large) */}
          <p className="text-[11px] sm:text-[13px] text-gray-500 truncate px-1 sm:px-2 hidden lg:block">
            {track.album ?? "—"}
          </p>

          {/* Column 5: Duration + Like button */}
          <div className="flex items-center gap-1 sm:gap-3 justify-end">
            {/* Like button - appears on hover or if already liked */}
            {!disableLike && (
              <button
                onClick={toggleLike}
                className="transition-all duration-150"
                style={{
                  opacity: isHovered || isLiked ? 1 : 0,
                  transform: `scale(${isHovered || isLiked ? 1 : 0.8})`,
                  color: isLiked ? "#fa243c" : "rgba(156,163,175,0.5)",
                }}
                aria-label={
                  isLiked ? "Remove from favorites" : "Add to favorites"
                }
              >
                {isLiked ? (
                  <FavoriteIcon sx={{ fontSize: { xs: 13, sm: 15 } }} />
                ) : (
                  <FavoriteBorderIcon sx={{ fontSize: { xs: 13, sm: 15 } }} />
                )}
              </button>
            )}
            {/* Duration with clock icon */}
            <div className="flex items-center gap-0.5 sm:gap-1 text-gray-400">
              <AccessTimeIcon sx={{ fontSize: { xs: 10, sm: 12 } }} />
              <span className="text-[9px] sm:text-[11px] tabular-nums">
                {track.duration ?? "3:45"}
              </span>
            </div>
          </div>
        </div>
      );
    }

    return null; // Fallback for unknown variant
  },
);

SongCard.displayName = "SongCard";

export default SongCard;