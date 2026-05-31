/**
 * @fileoverview Library page displaying user's playlists and liked songs collection.
 *
 * Responsibilities:
 * - Display user's playlists in grid or list view with sorting and metadata
 * - Show liked songs entry point with count
 * - Provide hero section with gradient cover art and user statistics
 * - Support creating new playlists via modal
 * - Show loading skeletons during data fetching
 * - Handle empty states with friendly UI and call-to-action
 *
 * Related modules:
 * - useUserPlaylists (src/features/playlists/hooks/useUserPlaylist.ts) - Fetches user's playlists
 * - useLikedSongs (src/features/likes/hooks/useLikedSongs.ts) - Fetches liked songs count
 * - HeroInfoPanel (src/components/shared/HeroInfoPanel.tsx) - Hero section component
 * - CreatePlaylistModal (src/features/playlists/components/CreatePlaylistModal.tsx) - Playlist creation modal
 *
 * Architectural role:
 * - **Primary library management page** for authenticated users
 * - Acts as central hub for user's music organization
 * - Route: /library (protected, inside MainLayout)
 *
 * Visual design (Apple Music style):
 * - Gradient cover art: linear-gradient(135deg, #fa243c 0%, #bf5af2 100%)
 * - Sticky top navigation with back button and "New Playlist" action
 * - Liked Songs card: gradient background + heart icon + chevron navigation
 * - Playlists section with view toggle (grid/list) and sort options
 *
 * View modes:
 * - Grid view: Visual card layout with cover art, playlist name, song count
 * - List view: Compact row layout with cover thumbnail, metadata, creation date
 * - View preference stored in local state (not persisted across sessions)
 *
 * Data fetching patterns:
 * - playlistsLoading: Shows 8 grid skeletons or 5 list skeletons
 * - likedLoading: Shows animated spinner in liked songs count
 * - Both queries execute in parallel (no sequential waterfall)
 *
 * Playlist metadata:
 * - songCount: Number of songs in playlist (from Firestore)
 * - createdAt: Timestamp formatted as "MMM YYYY" (e.g., "Jan 2024")
 * - isPublic: Privacy indicator (shows "Private" badge in list view)
 * - coverURL: Optional cover image (falls back to gradient icon)
 *
 * Empty states:
 * - No playlists: Shows centered illustration + "New Playlist" button
 * - No liked songs: Shows "0 songs" (no separate empty state)
 *
 * Accessibility:
 * - role="main" on container
 * - aria-label on interactive elements
 * - aria-pressed on view toggle buttons
 * - aria-busy during loading states
 * - aria-live polite for dynamic content updates
 *
 * Performance:
 * - useMemo for derived data (likedCount, displayName, description, playlistsDates)
 * - useCallback for event handlers (stable references)
 * - Lazy loading images via loading="lazy"
 * - Skeleton loading prevents layout shift
 *
 * @module features/library/pages
 */

import { useState, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useUserPlaylists } from "@/features/playlists/hooks/useUserPlaylist";
import { useLikedSongs } from "@/features/likes/hooks/useLikedSongs";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useProfile } from "@/features/profile/hooks/useProfile";
import CreatePlaylistModal from "@/features/playlists/components/CreatePlaylistModal";
import { HeroInfoPanel } from "@/components/shared/HeroInfoPanel";
import LibraryMusicIcon from "@mui/icons-material/LibraryMusic";
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import GridViewRoundedIcon from "@mui/icons-material/GridViewRounded";
import ViewListRoundedIcon from "@mui/icons-material/ViewListRounded";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import AnimatedSpinner from "@/components/ui/LoadingSpinner/AnimatedSpinner";

/**
 * Props for the Skeleton loading component.
 *
 * @property w - Width class (Tailwind CSS width, e.g., "w-full", "w-3/4")
 * @property h - Height class (Tailwind CSS height, e.g., "h-4", "h-11")
 */
interface SkeletonProps {
  w?: string;
  h?: string;
}

/**
 * Props for the PillBtn component.
 * Extends standard button props with optional style and hover handlers.
 */
interface PillBtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  style?: React.CSSProperties;
}

/**
 * Brand primary color constant (from HANDOFF_CORE.md).
 * Used for buttons, active states, and interactive elements.
 */
const PRIMARY = "#fa243c";

/**
 * Primary hover color (darker red for hover states).
 */
const PRIMARY_HOVER = "#e01e33";

/**
 * Gradient for cover art and special elements.
 * Transitions from brand red to purple (#bf5af2).
 */
const GRADIENT = "linear-gradient(135deg, #fa243c 0%, #bf5af2 100%)";

/**
 * Fixed cover image height (matches HeroInfoPanel COVER_H).
 * Aligns with external cover art dimensions.
 */
const COVER_H = 220;

/**
 * Skeleton loading placeholder for content.
 *
 * Uses Tailwind's animate-pulse for shimmer effect.
 * Provides visual feedback during data fetching.
 *
 * @param w - Width class (default: "w-full")
 * @param h - Height class (default: "h-4")
 * @returns Animated placeholder div
 */
const Skeleton = ({ w = "w-full", h = "h-4" }: SkeletonProps) => (
  <div className={`${w} ${h} rounded-md animate-pulse bg-gray-200`} />
);

/**
 * Pill-shaped button for desktop view (hidden on mobile).
 *
 * Used for primary actions (e.g., "New Playlist").
 * Styled with brand colors and hover transitions.
 *
 * @param props - Button props including onClick, children, style, hover handlers
 * @returns Styled button component
 */
const PillBtn = ({
  onClick,
  children,
  style,
  onMouseEnter,
  onMouseLeave,
}: PillBtnProps) => (
  <button
    onClick={onClick}
    className="hidden sm:flex items-center gap-2 px-7 py-[9px] rounded-md text-[13px] font-semibold text-white shadow-sm transition-colors"
    style={style}
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
    aria-label="Create new playlist"
  >
    {children}
  </button>
);

/**
 * LibraryPage - User's personal music collection page.
 *
 * Route: /library (protected)
 * Layout hierarchy: MainLayout → Outlet → LibraryPage
 *
 * Page structure:
 * 1. Sticky header: Back button + "New Playlist" button
 * 2. Hero section: Gradient cover + HeroInfoPanel with stats and actions
 * 3. Liked Songs card: Prominent entry point with count and chevron
 * 4. Playlists section: Title + view toggle + grid/list content
 * 5. Empty state (if no playlists) with "Create First Playlist" CTA
 * 6. CreatePlaylistModal (conditionally rendered)
 *
 * State management:
 * - showModal: Controls CreatePlaylistModal visibility
 * - view: Current view mode ("grid" or "list") - local state only
 *
 * Data dependencies:
 * - playlists: Array of user's playlists from Firestore
 * - likedSongs: Array of liked song IDs (count derived)
 * - user/profile: User identity for display name
 *
 * @returns Library page JSX
 */
const LibraryPage = () => {
  const [showModal, setShowModal] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");

  const { playlists, loading: playlistsLoading } = useUserPlaylists();
  const { likedSongs, loading: likedLoading } = useLikedSongs();
  const { user } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();

  /**
   * Memoized liked songs count.
   * Falls back to 0 if likedSongs is null/undefined.
   */
  const likedCount = useMemo(() => likedSongs?.length ?? 0, [likedSongs]);

  /**
   * Memoized display name for hero subtitle.
   * Prefers profile.name (Firestore) over user.name (Auth).
   * Falls back to "You".
   */
  const displayName = useMemo(
    () => profile?.name || user?.name || "You",
    [profile?.name, user?.name],
  );

  /**
   * Memoized map of playlist creation dates formatted as "MMM YYYY".
   *
   * Why use Map instead of object?
   * - Efficient lookups by playlist ID (O(1))
   * - Handles Firestore Timestamp or string date
   *
   * Formatting:
   * - Converts Firestore Timestamp to Date using .toDate() (if available)
   * - Fallback to new Date(p.createdAt) for string dates
   * - Returns "MMM YYYY" (e.g., "Jan 2024")
   * - Returns null if date parsing fails
   */
  const playlistsDates = useMemo(() => {
    const m = new Map<string, string | null>();
    playlists.forEach((p) => {
      try {
        const d = p.createdAt?.toDate?.() ?? new Date(p.createdAt);
        m.set(
          p.id,
          d.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        );
      } catch {
        m.set(p.id, null);
      }
    });
    return m;
  }, [playlists]);

  /**
   * Memoized library description for HeroInfoPanel.
   *
   * Dynamic content:
   - Includes playlist count and liked songs count
   - Pluralization handled (playlist/playlists, song/songs)
   - Educational text about library features
   *
   * Why in useMemo?
   * - Prevents recalculation on every render
   * - Depends on playlists.length and likedCount
   */
  const description = useMemo(() => {
    const playlistWord = playlists.length === 1 ? "playlist" : "playlists";
    const songWord = likedCount === 1 ? "song" : "songs";
    return `Your personal music collection containing ${playlists.length} ${playlistWord} and ${likedCount} liked ${songWord}.\n\nOrganise your favourite tracks into playlists, save songs you love, and keep everything in one place. Your library grows with you — add new playlists any time to keep your music organised the way you like it.`;
  }, [playlists.length, likedCount]);

  /**
   * Opens the create playlist modal.
   */
  const openModal = useCallback(() => setShowModal(true), []);

  /**
   * Closes the create playlist modal.
   */
  const closeModal = useCallback(() => setShowModal(false), []);

  /**
   * Switches view to grid mode.
   */
  const setGridView = useCallback(() => setView("grid"), []);

  /**
   * Switches view to list mode.
   */
  const setListView = useCallback(() => setView("list"), []);

  /**
   * Renders liked song count with loading spinner.
   *
   * Shows animated spinner while loading.
   * Shows formatted count when loaded (e.g., "42 songs").
   *
   * @returns JSX element (spinner or text)
   */
  const renderLikedSongCount = () => {
    if (likedLoading) return <AnimatedSpinner size={13} color={PRIMARY} />;
    return `${likedCount} ${likedCount === 1 ? "song" : "songs"}`;
  };

  return (
    <div
      className="min-h-screen bg-[#f5f5f7]/50 backdrop-blur-md"
      role="main"
      aria-label="Library page"
    >
      {/* Sticky header navigation */}
      <div
        className="sticky top-0 z-20 bg-[#f5f5f7]/50 backdrop-blur-md border-b border-black/[0.06]"
        role="navigation"
        aria-label="Library navigation"
      >
        <div className="max-w-7xl mx-auto px-6 sm:px-8 flex items-center justify-between h-14">
          {/* Back button - navigates to previous page */}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-0.5 text-[15px] font-semibold"
            style={{ color: PRIMARY }}
            aria-label="Go back"
          >
            <ChevronLeftRoundedIcon sx={{ fontSize: 26 }} />
            <span>Library</span>
          </button>

          {/* New Playlist button (mobile/tablet) */}
          <button
            onClick={openModal}
            className="flex items-center gap-1 text-[13px] font-semibold transition-colors"
            style={{ color: PRIMARY }}
            onMouseEnter={(e) => (e.currentTarget.style.color = PRIMARY_HOVER)}
            onMouseLeave={(e) => (e.currentTarget.style.color = PRIMARY)}
            aria-label="Create new playlist"
          >
            <AddRoundedIcon sx={{ fontSize: 18 }} />
            New Playlist
          </button>
        </div>
      </div>

      {/* Main content container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 pb-16">
        {/* Hero section */}
        <div className="pt-10 pb-10">
          <div className="flex flex-col sm:flex-row gap-8 items-start">
            {/* Gradient cover art */}
            <div
              className="shrink-0 mx-auto sm:mx-0 rounded-md overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.18)]"
              style={{ width: COVER_H, height: COVER_H, background: GRADIENT }}
            >
              <div className="w-full h-full flex items-center justify-center">
                <LibraryMusicIcon
                  className="text-white/80"
                  sx={{ fontSize: 84 }}
                />
              </div>
            </div>

            {/* Hero info panel with metadata and actions */}
            <HeroInfoPanel
              title="Your Library"
              subtitle={displayName}
              description={description}
              meta={
                <div className="flex items-center gap-2">
                  <span>
                    {playlists.length}{" "}
                    {playlists.length === 1 ? "playlist" : "playlists"}
                  </span>
                  <span className="w-[3px] h-[3px] rounded-md bg-[#aeaeb2]" />
                  <span>
                    {likedCount} liked {likedCount === 1 ? "song" : "songs"}
                  </span>
                </div>
              }
              actions={
                <>
                  {/* Desktop "New Playlist" button */}
                  <PillBtn
                    onClick={openModal}
                    style={{ background: PRIMARY }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = PRIMARY_HOVER)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = PRIMARY)
                    }
                  >
                    <AddRoundedIcon sx={{ fontSize: 16 }} />
                    New Playlist
                  </PillBtn>

                  {/* More options button (future feature) */}
                  <button
                    className="hidden p-2 rounded-md hover:bg-black/[0.06] transition-colors"
                    aria-label="More options"
                  >
                    <MoreHorizIcon sx={{ fontSize: 20 }} />
                  </button>
                </>
              }
            />
          </div>
        </div>

        {/* Liked Songs card - prominent entry point */}
        <div className="mb-8">
          <Link
            to="/liked"
            className="flex items-center gap-4 px-5 py-4 rounded-md bg-white hover:bg-[#f0f0f0] transition-colors shadow-[0_1px_4px_rgba(0,0,0,0.06)] border border-black/[0.05] group"
            aria-label="Liked songs"
          >
            {/* Gradient icon container */}
            <div
              className="w-[52px] h-[52px] rounded-md shrink-0 flex items-center justify-center"
              style={{ background: GRADIENT }}
            >
              <FavoriteRoundedIcon
                className="text-white"
                sx={{ fontSize: 24 }}
              />
            </div>

            {/* Text content */}
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-[#1d1d1f]">
                Liked Songs
              </p>
              <p className="text-[12px] text-[#6e6e73] mt-0.5">
                {renderLikedSongCount()}
              </p>
            </div>

            {/* Chevron indicator */}
            <ChevronRightRoundedIcon
              className="text-[#c7c7cc] group-hover:text-[#aeaeb2] shrink-0"
              sx={{ fontSize: 20 }}
            />
          </Link>
        </div>

        {/* Playlists section header with view toggle */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[17px] font-bold text-[#1d1d1f]">Playlists</h2>

          {/* View toggle buttons (grid/list) */}
          <div
            className="flex items-center gap-0.5 bg-[#e5e5ea] rounded-md p-[3px]"
            role="group"
            aria-label="Playlist view toggle"
          >
            <button
              onClick={setGridView}
              className={`px-2 py-1.5 rounded-md transition-colors ${view === "grid" ? "bg-white shadow-sm" : "hover:bg-[#d1d1d6]"
                }`}
              aria-label="Grid view"
              aria-pressed={view === "grid"}
            >
              <GridViewRoundedIcon
                sx={{ fontSize: 15 }}
                className={
                  view === "grid" ? "text-[#1d1d1f]" : "text-[#8e8e93]"
                }
              />
            </button>
            <button
              onClick={setListView}
              className={`px-2 py-1.5 rounded-md transition-colors ${view === "list" ? "bg-white shadow-sm" : "hover:bg-[#d1d1d6]"
                }`}
              aria-label="List view"
              aria-pressed={view === "list"}
            >
              <ViewListRoundedIcon
                sx={{ fontSize: 15 }}
                className={
                  view === "list" ? "text-[#1d1d1f]" : "text-[#8e8e93]"
                }
              />
            </button>
          </div>
        </div>

        {/* Loading skeletons (grid view) */}
        {playlistsLoading &&
          (view === "grid" ? (
            <div
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5"
              aria-busy="true"
            >
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i}>
                  <Skeleton w="w-full" h="aspect-square mb-2.5" />
                  <Skeleton w="w-3/4" h="h-[13px] mb-1.5" />
                  <Skeleton w="w-1/2" h="h-[11px]" />
                </div>
              ))}
            </div>
          ) : (
            /* Loading skeletons (list view) */
            <div
              className="bg-white rounded-md overflow-hidden border border-black/[0.05]"
              aria-busy="true"
            >
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 px-5 py-3.5 animate-pulse border-b border-[#f2f2f7] last:border-0"
                >
                  <Skeleton w="w-11" h="h-11 shrink-0" />
                  <div className="flex-1">
                    <Skeleton w="w-2/3" h="h-[13px] mb-1.5" />
                    <Skeleton w="w-1/3" h="h-[11px]" />
                  </div>
                </div>
              ))}
            </div>
          ))}

        {/* Empty state - no playlists */}
        {!playlistsLoading && playlists.length === 0 && (
          <div
            className="flex flex-col items-center py-20 text-center bg-white rounded-md border border-black/[0.05] shadow-sm"
            role="status"
            aria-live="polite"
          >
            <div className="w-20 h-20 rounded-md bg-[#f5f5f7] flex items-center justify-center mb-5">
              <LibraryMusicIcon
                sx={{ fontSize: 36 }}
                className="text-[#c7c7cc]"
              />
            </div>
            <h3 className="text-[15px] font-semibold text-[#1d1d1f] mb-1.5">
              No playlists yet
            </h3>
            <p className="text-[13px] text-[#6e6e73] mb-6 max-w-[220px]">
              Create your first playlist to organise your music
            </p>
            <button
              onClick={openModal}
              className="flex items-center gap-2 px-5 py-2.5 rounded-md text-[13px] font-semibold text-white shadow-sm transition-colors"
              style={{ background: PRIMARY }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = PRIMARY_HOVER)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = PRIMARY)
              }
              aria-label="Create first playlist"
            >
              <AddRoundedIcon sx={{ fontSize: 16 }} />
              New Playlist
            </button>
          </div>
        )}

        {/* Playlist grid view (loaded, has content) */}
        {!playlistsLoading && playlists.length > 0 && view === "grid" && (
          <div
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5"
            aria-live="polite"
          >
            {playlists.map((p) => (
              <Link
                key={p.id}
                to={`/playlist/${p.id}`}
                className="group"
                aria-label={`Open playlist ${p.name}`}
              >
                {/* Playlist cover art */}
                <div className="aspect-square w-full mb-2.5 rounded-md overflow-hidden shadow-md transition-all duration-200 group-hover:brightness-90 group-hover:shadow-lg">
                  {p.coverURL ? (
                    <img
                      src={p.coverURL}
                      alt={p.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center"
                      style={{ background: GRADIENT }}
                    >
                      <LibraryMusicIcon
                        className="text-white/80"
                        sx={{ fontSize: { xs: 36, sm: 48 } }}
                      />
                    </div>
                  )}
                </div>

                {/* Playlist metadata */}
                <p className="text-[13px] font-semibold text-[#1d1d1f] truncate">
                  {p.name}
                </p>
                <p className="text-[11px] text-[#6e6e73] mt-0.5">
                  {p.songCount ?? 0} {p.songCount === 1 ? "song" : "songs"}
                </p>
              </Link>
            ))}
          </div>
        )}

        {/* Playlist list view (loaded, has content) */}
        {!playlistsLoading && playlists.length > 0 && view === "list" && (
          <div
            className="bg-white rounded-md shadow-[0_1px_4px_rgba(0,0,0,0.06)] border border-black/[0.05] overflow-hidden"
            aria-live="polite"
          >
            {playlists.map((p, i) => (
              <Link
                key={p.id}
                to={`/playlist/${p.id}`}
                className={`flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[#f5f5f7] group ${i !== playlists.length - 1 ? "border-b border-[#f2f2f7]" : ""
                  }`}
                aria-label={`Open playlist ${p.name}`}
              >
                {/* Playlist thumbnail */}
                <div className="w-11 h-11 shrink-0 rounded-md overflow-hidden shadow-sm">
                  {p.coverURL ? (
                    <img
                      src={p.coverURL}
                      alt={p.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center"
                      style={{ background: GRADIENT }}
                    >
                      <LibraryMusicIcon
                        sx={{ fontSize: 16 }}
                        className="text-white/80"
                      />
                    </div>
                  )}
                </div>

                {/* Playlist info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-[#1d1d1f] truncate">
                    {p.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-[#6e6e73]">
                    <span>
                      {p.songCount ?? 0} {p.songCount === 1 ? "song" : "songs"}
                    </span>
                    {/* Creation date (if available) */}
                    {playlistsDates.get(p.id) && (
                      <>
                        <span className="w-[3px] h-[3px] rounded-md bg-[#c7c7cc]" />
                        <span>{playlistsDates.get(p.id)}</span>
                      </>
                    )}
                    {/* Privacy indicator */}
                    {p.isPublic === false && (
                      <>
                        <span className="w-[3px] h-[3px] rounded-md bg-[#c7c7cc]" />
                        <span>Private</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Chevron indicator */}
                <ChevronRightRoundedIcon
                  className="text-[#c7c7cc] group-hover:text-[#aeaeb2] shrink-0"
                  sx={{ fontSize: 18 }}
                />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Create playlist modal */}
      <CreatePlaylistModal open={showModal} onClose={closeModal} />
    </div>
  );
};

export default LibraryPage;