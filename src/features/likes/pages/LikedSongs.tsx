/**
 * @fileoverview Liked Songs page displaying user's favorited tracks with playlist-like interface.
 *
 * Responsibilities:
 * - Display all songs liked by the current user in a table/list view
 * - Provide play all and shuffle buttons for instant playback
 * - Show total tracks, total duration, and artist information
 * - Support toggling like status directly from the list
 * - Handle empty state with discovery CTA
 *
 * Related modules:
 * - subscribeToLikedSongs (src/features/likes/services/getLikedSongs.ts) - Fetches liked songs with real-time updates
 * - toggleLikeTransaction (src/features/likes/services/likeService.ts) - Handles like/unlike operations
 * - usePlayer (src/features/player/hooks/usePlayer.ts) - Controls playback
 * - HeroInfoPanel (src/components/shared/HeroInfoPanel.tsx) - Hero section component
 *
 * Architectural role:
 * - **User's personal playlist page** for liked content
 * - Route: /liked (protected, inside MainLayout)
 * - Similar visual style to Apple Music's "Liked Songs" playlist
 *
 * Firestore data model (from HANDOFF_CORE.md):
 * - Liked songs subcollection: /users/{uid}/likedSongs/{songId}
 * - Each document: { createdAt: Timestamp } (ordered by createdAt descending)
 * - Songs are resolved to full ISong objects via subscribeToLikedSongs
 *
 * Page structure:
 * 1. Sticky header with back button
 * 2. Hero section: Gradient cover art + HeroInfoPanel with stats and actions
 * 3. Table/list view of liked songs with sortable columns (visual only)
 * 4. Each row: like star, cover art, title, artist, album, duration, more menu
 *
 * Playback behavior:
 * - "Play" button: Plays first song in list with full queue (all liked songs)
 * - "Shuffle" button: Randomizes queue order before playback
 * - Clicking any row: Plays that song with all liked songs as queue
 *
 * Like toggling:
 * - Star button toggles like status (unlike removes from this list)
 * - Real-time update: subscribeToLikedSongs updates list immediately
 * - Loading state prevents double-click during toggle
 *
 * Empty state:
 * - Shows gradient heart icon and friendly message
 * - "Discover Music" button navigates to home page
 *
 * Performance:
 * - useMemo for totalMins (recalculates only when songs change)
 * - useCallback for event handlers (stable references)
 * - Optimistic UI for like toggle (togglingLike Set prevents duplicates)
 *
 * @module features/likes/pages
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { usePlayer } from "@/features/player/hooks/usePlayer";
import { subscribeToLikedSongs } from "@/features/likes/services/getLikedSongs";
import { toggleLikeTransaction } from "@/features/likes/services/likeService";
import { ISong } from "@/features/songs/types";
import { HeroInfoPanel } from "@/components/shared/HeroInfoPanel";
import FavoriteIcon from "@mui/icons-material/Favorite";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import LibraryMusicIcon from "@mui/icons-material/LibraryMusic";
import ChevronLeftRounded from "@mui/icons-material/ChevronLeftRounded";
import {
  PlayArrowRounded,
  ShuffleOutlined,
  Star,
  StarOutline,
} from "@mui/icons-material";
import AnimatedSpinner from "@/components/ui/LoadingSpinner/AnimatedSpinner";

// Brand constants (matches HANDOFF_CORE.md)
const P = "#fa243c";
const PH = "#e01e33";
const GR = "linear-gradient(135deg, #fa243c 0%, #bf5af2 100%)";
const COVER_H = 220;

/**
 * Parses duration string or number to total seconds.
 *
 * Handles formats:
 * - "3:45" → 225 seconds
 * - "180" (numeric string) → 180 seconds
 * - number → number
 *
 * @param d - Duration string (MM:SS), numeric string, or number
 * @returns Total seconds (default 0 if invalid)
 */
const parseSecs = (d?: string | number): number => {
  if (!d) return 0;
  if (typeof d === "string" && d.includes(":")) {
    const [m, s] = d.split(":").map(Number);
    return m * 60 + (s || 0);
  }
  const n = typeof d === "string" ? parseInt(d, 10) : d;
  return isNaN(n) ? 0 : n;
};

/**
 * Formats duration in seconds to MM:SS string.
 *
 * If already in MM:SS format, returns as-is.
 *
 * @param d - Duration in seconds or MM:SS string
 * @returns Formatted duration string (e.g., "3:45") or "—" if invalid
 */
const fmtDur = (d?: string | number): string => {
  if (!d) return "—";
  if (typeof d === "string" && d.includes(":")) return d;
  const s = typeof d === "string" ? parseInt(d, 10) : d;
  if (isNaN(s)) return "—";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

/**
 * Pill-shaped button component for hero actions.
 *
 * Used for Play and Shuffle buttons.
 * Extends standard button HTML attributes.
 */
const PillBtn = ({
  onClick,
  children,
  disabled,
  style,
  onMouseEnter,
  onMouseLeave,
  className,
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { className?: string }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center justify-center gap-2 px-7 py-[9px] rounded-full sm:rounded-md text-[13px] font-semibold text-white shadow-sm transition-colors disabled:opacity-40 ${className || ""}`}
    style={style}
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
  >
    {children}
  </button>
);

/**
 * LikedSongs - Page displaying user's favorited tracks.
 *
 * Route: "/liked" (protected, inside MainLayout)
 *
 * Data fetching:
 * - subscribeToLikedSongs provides real-time updates
 * - Returns full song objects ordered by liked date (newest first)
 *
 * Page features:
 * - Gradient cover art with heart icon
 * - HeroInfoPanel with total count and total duration
 * - Play all / Shuffle buttons
 * - Sortable table columns (visual only, no actual sorting logic implemented)
 *
 * @returns Liked songs page JSX
 */
const LikedSongs = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { playTrack } = usePlayer();

  // --- State ---
  const [songs, setSongs] = useState<ISong[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingLike, setTogglingLike] = useState<Set<string>>(new Set());

  /**
   * Effect: Subscribe to user's liked songs with real-time updates.
   *
   * subscribeToLikedSongs:
   * - Listens to /users/{uid}/likedSongs subcollection
   * - Resolves each song ID to full ISong object
   * - Orders by createdAt descending (newest liked first)
   */
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToLikedSongs(user.uid, (data) => {
      setSongs(data);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  /**
   * Memoized total duration in minutes.
   *
   * Sums duration of all liked songs (parsed to seconds)
   * Converts to minutes (floor) for display.
   */
  const totalMins = useMemo(
    () => Math.floor(songs.reduce((a, s) => a + parseSecs(s.duration), 0) / 60),
    [songs],
  );

  /**
   * Plays all liked songs starting from the first track.
   *
   * Queue = all liked songs in current order.
   * Calls playTrack with first song and full queue.
   */
  const handlePlayAll = useCallback(() => {
    if (songs.length) playTrack(songs[0], songs);
  }, [songs, playTrack]);

  /**
   * Plays all liked songs in random order (shuffle).
   *
   * Creates shuffled copy of songs array.
   * First shuffled track becomes current song, rest as queue.
   */
  const handleShuffle = useCallback(() => {
    if (!songs.length) return;
    const sh = [...songs].sort(() => Math.random() - 0.5);
    playTrack(sh[0], sh);
  }, [songs, playTrack]);

  /**
   * Toggles like status for a song.
   *
   * Called from star button in table row.
   * Since song is already liked, this will unlike it.
   *
   * Optimistic UI:
   * - Add songId to togglingLike Set (disables button)
   * - Call toggleLikeTransaction
   * - On success, subscribeToLikedSongs removes song from list
   * - On error, button re-enabled with no UI change
   *
   * @param songId - ID of song to unlike
   */
  const handleLikeToggle = useCallback(
    async (songId: string) => {
      if (!user) return;
      if (togglingLike.has(songId)) return;

      setTogglingLike((prev) => new Set(prev).add(songId));

      try {
        await toggleLikeTransaction(user.uid, songId);
      } catch (error) {
        console.error("Failed to toggle like:", error);
      } finally {
        setTogglingLike((prev) => {
          const next = new Set(prev);
          next.delete(songId);
          return next;
        });
      }
    },
    [user, togglingLike],
  );

  /**
   * Dynamic description for HeroInfoPanel.
   *
   * Includes:
   * - Number of tracks (with correct pluralization)
   * - Total minutes
   * - Educational text about liking songs
   */
  const description = `All the songs you've liked in one place — ${songs.length} ${songs.length === 1 ? "track" : "tracks"} and ${totalMins} minutes of music.\n\nLike any song while browsing or listening and it will appear here automatically. Your taste in one collection, always ready to play.`;

  // --- Loading state ---
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <AnimatedSpinner size={28} color={P} />
          <p className="text-[13px] text-[#6e6e73]">
            Loading your liked songs…
          </p>
        </div>
      </div>
    );
  }

  // --- Empty state (no liked songs) ---
  if (!songs.length) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <div className="flex flex-col items-center text-center px-8 py-16 max-w-sm">
          <div
            className="w-24 h-24 rounded-md flex items-center justify-center shadow-lg mb-6"
            style={{ background: GR }}
          >
            <FavoriteIcon className="text-white" sx={{ fontSize: 44 }} />
          </div>
          <h1 className="text-[22px] font-bold text-[#1d1d1f] mb-2">
            No Liked Songs Yet
          </h1>
          <p className="text-[13px] text-[#6e6e73] leading-relaxed mb-8">
            Songs you like will appear here. Tap the heart icon on any track to
            save it.
          </p>
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 px-7 py-[9px] rounded-md text-[13px] font-semibold text-white shadow-sm transition-colors"
            style={{ background: P }}
            onMouseEnter={(e) => (e.currentTarget.style.background = PH)}
            onMouseLeave={(e) => (e.currentTarget.style.background = P)}
          >
            <PlayArrowIcon sx={{ fontSize: 18 }} />
            Discover Music
          </button>
        </div>
      </div>
    );
  }

  // --- Main view (songs exist) ---
  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      {/* Sticky header with back button */}
      <div className="sticky top-0 z-20 bg-[#f5f5f7]/50 backdrop-blur-md border-b border-black/[0.06]">
        <div className="max-w-7xl mx-aut px-6 sm:px-8 flex items-center justify-between h-14">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-0.5 text-[15px] font-semibold"
            style={{ color: P }}
          >
            <ChevronLeftRounded sx={{ fontSize: 26 }} />
            <span>Liked</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-aut px-1 sm:px-8 pb-16">
        {/* Hero section */}
        <div className="pt-10 pb-10">
          <div className="flex flex-col sm:flex-row gap-8 items-start">
            {/* Gradient cover art with heart icon */}
            <div
              className="shrink-0 mx-auto sm:mx-0 rounded-md overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.18)]"
              style={{ width: COVER_H, height: COVER_H, background: GR }}
            >
              <div className="w-full h-full flex items-center justify-center">
                <FavoriteIcon className="text-white/90" sx={{ fontSize: 88 }} />
              </div>
            </div>

            {/* Hero info panel with metadata and actions */}
            <HeroInfoPanel
              title="Liked Songs"
              subtitle={user?.name || "Your Collection"}
              description={description}
              meta={
                <div className="flex flex-wrap items-center gap-2">
                  <span>Various Artists</span>
                  <span className="w-[3px] h-[3px] rounded-md bg-[#aeaeb2]" />
                  <span>
                    {songs.length} {songs.length === 1 ? "song" : "songs"}
                  </span>
                  <span className="w-[3px] h-[3px] rounded-md bg-[#aeaeb2]" />
                  <span>{totalMins} min</span>
                </div>
              }
              actions={
                <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                  <div className="flex w-full gap-2 sm:w-auto">
                    {/* Play All button */}
                    <PillBtn
                      onClick={handlePlayAll}
                      disabled={songs.length === 0}
                      style={{ background: P }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = PH)
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = P)
                      }
                      className="flex-1 sm:flex-initial"
                    >
                      <PlayArrowRounded sx={{ fontSize: 18 }} />
                      Play
                    </PillBtn>

                    {/* Shuffle button */}
                    <PillBtn
                      onClick={handleShuffle}
                      disabled={songs.length === 0}
                      style={{ background: P }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = PH)
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = P)
                      }
                      className="flex-1 sm:flex-initial"
                    >
                      <ShuffleOutlined sx={{ fontSize: 16 }} />
                      Shuffle
                    </PillBtn>
                  </div>

                  {/* More options button (placeholder) */}
                  <button className="hidden sm:block p-2 rounded-md hover:bg-black/[0.06] transition-colors text-[#6e6e73]">
                    <MoreHorizIcon sx={{ fontSize: 20 }} />
                  </button>
                </div>
              }
            />
          </div>
        </div>

        {/* Songs table/list view */}
        <div className="overflow-hidden">
          {/* Table header (sticky, hidden on mobile) */}
          <div
            className="grid items-center pr-1 sm:px-5 py-2.5 border-b border-[#f2f2f7]"
            style={{ gridTemplateColumns: "40px 1fr 1fr 1fr 56px 32px" }}
          >
            <span className="text-[11px] font-semibold text-[#8e8e93] tracking-wider"></span>
            <span className="text-[11px] font-semibold text-[#8e8e93] tracking-wider hidden md:block">
              Song
            </span>
            <span className="text-[11px] font-semibold text-[#8e8e93] tracking-wider hidden md:block">
              Artist
            </span>
            <span className="text-[11px] font-semibold text-[#8e8e93] tracking-wider hidden lg:block">
              Album
            </span>
            <span className="text-[11px] font-semibold text-[#8e8e93] tracking-wider text-right hidden sm:table-cell">
              Time
            </span>
            <span />
          </div>

          {/* Song rows */}
          {songs.map((song, i) => {
            const isLiked = true; // All songs in this list are liked
            const isToggling = togglingLike.has(song.id);

            return (
              <div
                key={song.id}
                onClick={() => playTrack(song, songs)}
                className={`
                  group grid items-center pr-1 sm:px-5 py-2.5 cursor-pointer transition-colors rounded-md 
                  hover:bg-[#e8e8e8] 
                  ${i % 2 === 0 ? "bg-[#f5f5f7]" : "bg-[#fafafa]"}
                  ${i !== songs.length - 1 ? "border-b border-[#f5f5f7]" : ""}
                  grid-cols-[25px_1fr_40px] sm:grid-cols-[40px_1fr_1fr_1fr_56px_32px]
                `}
              >
                {/* Like star button column */}
                <div className="flex items-center justify-start relative">
                  <button
                    className={`
                      transition-all duration-200 w-6 h-6 flex items-center justify-center rounded-md
                      ${isLiked
                        ? "opacity-100 hover:bg-black/[0.08]"
                        : "opacity-0 group-hover:opacity-100 hover:bg-black/[0.08]"
                      }
                      ${isToggling ? "opacity-50 cursor-progress" : ""}
                      ${!user ? "opacity-0 pointer-events-none" : ""}
                      group/star-btn relative
                    `}
                    style={{ color: P }}
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent row click from triggering playback
                      handleLikeToggle(song.id);
                    }}
                    disabled={isToggling || !user}
                    aria-label={
                      isLiked
                        ? `Remove ${song.title} from likes`
                        : `Like ${song.title}`
                    }
                  >
                    {isLiked ? (
                      <Star sx={{ fontSize: 12 }} />
                    ) : (
                      <StarOutline sx={{ fontSize: 12 }} />
                    )}

                    {/* Tooltip on hover */}
                    <span
                      className="
                        absolute left-1/2 -translate-x-[15%] sm:-translate-x-1/2 bottom-full mb-1 
                        px-2 py-1 text-[10px] font-medium text-neutral-800 bg-neutral-50 rounded
                        opacity-0 group-hover/star-btn:opacity-100 transition-opacity
                        pointer-events-none whitespace-nowrap z-10
                        shadow-lg
                      "
                    >
                      {isLiked ? "Favourited" : "Favourite"}
                    </span>
                  </button>
                </div>

                {/* Cover art + Title (mobile shows artist below) */}
                <div className="flex items-center gap-3 min-w-0 pr-2 sm:pr-4">
                  <div className="w-10 h-10 shrink-0 rounded-md overflow-hidden shadow-sm">
                    {song.coverUrl || song.imageUrl ? (
                      <img
                        src={song.coverUrl || song.imageUrl}
                        alt={song.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center"
                        style={{ background: GR }}
                      >
                        <LibraryMusicIcon
                          sx={{ fontSize: 13 }}
                          className="text-white/80"
                        />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-[#1d1d1f] truncate leading-tight">
                      {song.title}
                    </p>
                    {/* Artist appears below title on mobile */}
                    <p className="text-[11px] text-[#6e6e73] truncate mt-0.5 md:hidden">
                      {song.artist}
                    </p>
                  </div>
                </div>

                {/* Artist (hidden on mobile) */}
                <p className="text-[13px] text-[#3c3c43] truncate pr-4 hidden sm:block">
                  {song.artist}
                </p>

                {/* Album (hidden on tablet and below) */}
                <p className="text-[13px] text-[#3c3c43] truncate pr-4 hidden lg:block">
                  {song.album || "—"}
                </p>

                {/* Duration (hidden on mobile) */}
                <span className="text-[13px] text-[#8e8e93] tabular-nums text-right hidden sm:block">
                  {fmtDur(song.duration)}
                </span>

                {/* More options button (placeholder) */}
                <button
                  className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-black/[0.08] ml-auto sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                  style={{ color: P }}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="More options"
                >
                  <MoreHorizIcon sx={{ fontSize: 16 }} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LikedSongs;