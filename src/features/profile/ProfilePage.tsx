/**
 * @fileoverview User profile page with Apple Music-style hero header and content sections.
 *
 * Responsibilities:
 * - Display user profile information (avatar, name, username)
 * - Show user's playlists in horizontal scrollable section
 * - Show listening history in horizontal scrollable section
 * - Provide edit profile functionality via modal
 * - Handle loading and empty states for playlists and history
 *
 * Related modules:
 * - useProfile (src/features/profile/hooks/useProfile.ts) - Fetches and updates user profile
 * - useUserPlaylists (src/features/playlists/hooks/useUserPlaylist.ts) - Fetches user's playlists
 * - useHistory (src/features/history/hooks/useHistory.ts) - Fetches listening history
 * - usePlayer (src/features/player/hooks/usePlayer.ts) - Plays tracks from history
 * - EditProfileModal (src/features/profile/components/EditProfileModal.tsx) - Profile editing interface
 *
 * Architectural role:
 * - **User profile landing page** for authenticated users
 * - Route: /profile (protected, inside MainLayout)
 * - Displays personalized content: user's playlists + listening history
 *
 * Page structure:
 * 1. Hero header: Blurred background avatar, centered avatar, name/username, Edit button + More menu
 * 2. Playlists section: Horizontal scrollable carousel of user's playlists (if any)
 * 3. Listening To section: Horizontal scrollable carousel of recently played tracks
 * 4. Footer: BeatStream branding
 *
 * Visual variants:
 *
 * With photoURL:
 * - Blurred, scaled background image
 * - Dark gradient overlay for text readability
 * - White text with text shadow
 *
 * Without photoURL:
 * - Solid light gray background (#d1d1d6)
 * - Light gradient overlay
 * - Dark text (not white)
 *
 * ScrollSection component:
 * - Reusable horizontal scrollable section with navigation arrows
 * - Shows left/right arrows on hover (when content overflows)
 * - Gradient fades at edges for visual scroll indication
 *
 * Empty states:
 * - No playlists: Shows friendly message with link to Library page
 * - No history: Section not rendered (null)
 *
 * @module features/profile/pages
 */

import { useState, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useProfile } from "./hooks/useProfile";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useUserPlaylists } from "@/features/playlists/hooks/useUserPlaylist";
import { useHistory } from "@/features/history/hooks/useHistory";
import { usePlayer } from "@/features/player/hooks/usePlayer";
import EditProfileModal from "./components/EditProfileModal";
import AnimatedSpinner from "@/components/ui/LoadingSpinner/AnimatedSpinner";
import LibraryMusicIcon from "@mui/icons-material/LibraryMusic";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";

// Brand constants (matches HANDOFF_CORE.md)
const P = "#fa243c";
const PH = "#e01e33";
const GR = "linear-gradient(135deg, #fa243c 0%, #bf5af2 100%)";

/**
 * Extracts initials from a name for avatar fallback.
 * Takes first letter of first two words, uppercase.
 * Example: "John Doe" → "JD", "Jane" → "J"
 *
 * @param name - User's display name
 * @returns Uppercase initials (max 2 characters)
 */
const getInitials = (name: string) =>
  name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";

/**
 * PlaylistCard component for playlist section.
 * Displays playlist cover art, name, and song count.
 *
 * @param playlist - Playlist object with id, name, coverURL, songCount
 */
const PlaylistCard = ({ playlist }: { playlist: any }) => (
  <Link
    to={`/playlist/${playlist.id}`}
    className="group flex-shrink-0 w-[148px] sm:w-[164px] md:w-[176px]"
  >
    <div className="w-full aspect-square rounded-md overflow-hidden shadow-md mb-2.5 transition-all duration-200 group-hover:brightness-90 group-hover:shadow-lg">
      {playlist.coverURL ? (
        <img
          src={playlist.coverURL}
          alt={playlist.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center"
          style={{ background: GR }}
        >
          <LibraryMusicIcon className="text-white/80" sx={{ fontSize: 44 }} />
        </div>
      )}
    </div>
    <p className="text-[13px] font-semibold text-[#1d1d1f] truncate leading-tight">
      {playlist.name}
    </p>
    <p className="text-[11px] text-[#6e6e73] mt-0.5">
      {playlist.songCount ?? 0} {playlist.songCount === 1 ? "song" : "songs"}
    </p>
  </Link>
);

/**
 * TrackCard component for listening history section.
 * Displays track cover art, title, and artist.
 * Clicking plays the track with full history as queue.
 *
 * @param track - Track object with id, title, artist, coverUrl/imageUrl
 * @param onClick - Callback when card is clicked (plays track)
 */
const TrackCard = ({ track, onClick }: { track: any; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="group flex-shrink-0 w-[148px] sm:w-[164px] md:w-[176px] text-left"
  >
    <div className="w-full aspect-square rounded-md overflow-hidden shadow-md mb-2.5 transition-all duration-200 group-hover:brightness-90 group-hover:shadow-lg">
      {track.imageUrl || track.coverUrl ? (
        <img
          src={track.imageUrl || track.coverUrl}
          alt={track.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center"
          style={{ background: GR }}
        >
          <LibraryMusicIcon className="text-white/80" sx={{ fontSize: 44 }} />
        </div>
      )}
    </div>
    <p className="text-[13px] font-semibold text-[#1d1d1f] truncate leading-tight">
      {track.title}
    </p>
    <p className="text-[11px] text-[#6e6e73] mt-0.5 truncate">{track.artist}</p>
  </button>
);

/**
 * ScrollSection - Reusable horizontal scrollable section with navigation arrows.
 *
 * Features:
 * - Title with optional "See All" link
 * - Horizontal scroll container with hidden scrollbar
 * - Left/right navigation arrows (visible on hover when content overflows)
 * - Gradient fades at edges for visual scroll indication
 *
 * @param title - Section title
 * @param linkTo - Optional route for "See All" link
 * @param children - Scrollable content (cards)
 */
const ScrollSection = ({
  title,
  linkTo,
  children,
}: {
  title: string;
  linkTo?: string;
  children: React.ReactNode;
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowL] = useState(false);
  const [showRight, setShowR] = useState(true);
  const [hovered, setHov] = useState(false);

  /**
   * Updates arrow visibility based on current scroll position.
   * Called on scroll and resize events.
   */
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setShowL(el.scrollLeft > 10);
    setShowR(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  /**
   * Scrolls the container left or right by 300px.
   * @param dir - Direction: "l" for left, "r" for right
   */
  const scroll = (dir: "l" | "r") =>
    scrollRef.current?.scrollBy({
      left: dir === "l" ? -300 : 300,
      behavior: "smooth",
    });

  const arrowCls =
    "absolute top-[42%] -translate-y-1/2 z-10 w-6 h-6 bg-[#fa243c] rounded-full shadow-md " +
    "flex items-center justify-center hover:shadow-lg transition-all duration-200";

  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-[4px] h-5 rounded-full" style={{ background: P }} />
          <h2 className="text-[17px] font-bold text-[#1d1d1f] tracking-tight">
            {title}
          </h2>
        </div>
        {linkTo && (
          <Link
            to={linkTo}
            className="flex items-center gap-0.5 text-[12px] font-semibold transition-colors"
            style={{ color: P }}
            onMouseEnter={(e) => (e.currentTarget.style.color = PH)}
            onMouseLeave={(e) => (e.currentTarget.style.color = P)}
          >
            See All
            <ChevronRightRounded sx={{ fontSize: 17 }} />
          </Link>
        )}
      </div>

      {/* Scrollable container with arrows */}
      <div className="relative">
        {/* Left gradient fade and arrow */}
        {showLeft && (
          <>
            <div className="absolute left-0 top-0 bottom-2 w-4 bg-gradient-to-r from-[#f5f5f7] to-transparent pointer-events-none z-[5]" />
            <button
              onClick={() => scroll("l")}
              aria-label="Scroll left"
              className={`${arrowCls} left-0 -ml-3`}
              style={{ opacity: hovered ? 1 : 0, transition: "opacity 0.2s" }}
            >
              <ChevronLeftIcon sx={{ fontSize: 18 }} className="text-white" />
            </button>
          </>
        )}

        {/* Scrollable content */}
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="overflow-x-auto pb-2"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          <div className="flex gap-4" style={{ minWidth: "min-content" }}>
            {children}
          </div>
        </div>

        {/* Right gradient fade and arrow */}
        {showRight && (
          <>
            <div className="absolute right-0 top-0 bottom-2 w-4 bg-gradient-to-l from-[#f5f5f7] to-transparent pointer-events-none z-[5]" />
            <button
              onClick={() => scroll("r")}
              aria-label="Scroll right"
              className={`${arrowCls} right-0 -mr-3`}
              style={{ opacity: hovered ? 1 : 0, transition: "opacity 0.2s" }}
            >
              <ChevronRightIcon sx={{ fontSize: 18 }} className="text-white" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

/**
 * Skeleton loading card for playlists and history sections.
 * Shows animated placeholder while data is loading.
 */
const SkCard = () => (
  <div className="flex-shrink-0 w-[148px] sm:w-[164px] md:w-[176px] animate-pulse">
    <div className="w-full aspect-square rounded-md bg-gray-200 mb-2.5" />
    <div className="h-5.5 w-3/4 bg-gray-200 rounded mb-1.5" />
    <div className="h-5 w-1/2 bg-gray-200 rounded" />
  </div>
);

/**
 * ProfilePage - User profile page with hero header and content sections.
 *
 * Route: "/profile" (protected, inside MainLayout)
 *
 * Data fetching:
 * - useProfile: Fetches user profile from /users/{uid}
 * - useUserPlaylists: Real-time subscription to user's playlists
 * - useHistory: Real-time subscription to listening history
 *
 * Page features:
 * - Hero header with avatar, name, username, Edit button, More menu
 * - Playlists section (horizontal scrollable carousel)
 * - Listening history section (horizontal scrollable carousel)
 * - Edit profile modal for updating name and avatar
 *
 * @returns Profile page JSX
 */
const ProfilePage = () => {
  const { profile, loading, updateProfile } = useProfile();
  const { user } = useAuth();
  const { playlists, loading: pL } = useUserPlaylists();
  const { historyTracks, loading: hL } = useHistory(user?.uid ?? "");
  const { playTrack } = usePlayer();
  const navigate = useNavigate();

  const [modalOpen, setModalOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const openModal = useCallback(() => setModalOpen(true), []);
  const closeModal = useCallback(() => setModalOpen(false), []);
  const handleSave = useCallback(
    async (data: any) => {
      await updateProfile(data);
    },
    [updateProfile],
  );

  const displayName = profile?.name || user?.name || "User";
  const username = profile?.username
    ? `@${profile.username}`
    : user?.email?.split("@")[0]
      ? `@${user.email.split("@")[0]}`
      : "";
  const initials = getInitials(displayName);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <AnimatedSpinner size={28} color={P} />
          <p className="text-[13px] text-[#6e6e73]">Loading profile…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      {/* Hero header with blurred background */}
      <div
        className="relative w-full overflow-hidden"
        style={{ height: "clamp(240px, 32vw, 320px)" }}
      >
        {/* Blurred background image (if photo exists) */}
        {profile?.photoURL ? (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${profile.photoURL})`,
              backgroundSize: "cover",
              backgroundPosition: "center top",
              filter: "blur(30px) brightness(0.76) saturate(1.25)",
              transform: "scale(1.16)",
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-[#d1d1d6]" />
        )}

        {/* Gradient overlay for text readability */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.22) 80%, rgba(0,0,0,0.30) 100%)",
          }}
        />

        {/* Centered avatar */}
        <div className="absolute left-1/2 -translate-x-1/2 top-8 sm:top-10 md:top-12">
          <div
            className="rounded-full overflow-hidden flex items-center justify-center"
            style={{
              width: "clamp(88px, 13vw, 132px)",
              height: "clamp(88px, 13vw, 132px)",
              background: profile?.photoURL ? "transparent" : "#8e8e93",
              boxShadow:
                "0 6px 32px rgba(0,0,0,0.30), 0 0 0 3.5px rgba(255,255,255,0.24)",
            }}
          >
            {profile?.photoURL ? (
              <img
                src={profile.photoURL}
                alt={displayName}
                className="w-full h-full object-cover"
                draggable={false}
              />
            ) : (
              <span
                className="text-white font-bold select-none"
                style={{
                  fontSize: "clamp(26px, 4.5vw, 46px)",
                  letterSpacing: "-1px",
                }}
              >
                {initials}
              </span>
            )}
          </div>
        </div>

        {/* Bottom bar with name, username, and action buttons */}
        <div
          className="absolute bottom-0 left-0 right-0 flex items-end justify-between pb-4 sm:pb-5"
          style={{ padding: "0 clamp(16px, 4vw, 40px) clamp(14px, 2vw, 22px)" }}
        >
          <div className="min-w-0 pr-4">
            <h1
              className="font-bold leading-tight text-white truncate"
              style={{
                fontSize: "clamp(17px, 2.5vw, 24px)",
                letterSpacing: "-0.4px",
                textShadow: "0 1px 8px rgba(0,0,0,0.45)",
              }}
            >
              {displayName}
            </h1>
            {username && (
              <p
                className="text-white mt-0.5 truncate"
                style={{
                  fontSize: "clamp(11px, 1.5vw, 13px)",
                  textShadow: "0 1px 4px rgba(0,0,0,0.35)",
                }}
              >
                {username}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Edit button */}
            <button
              onClick={openModal}
              className="px-5 py-[7px] rounded-full sm:rounded-md text-[13px] font-bold text-white tracking-wide transition-opacity hover:opacity-85 active:opacity-60"
              style={{ background: P }}
            >
              Edit
            </button>

            {/* More options dropdown */}
            <div className="relative">
              <button
                onClick={() => setMoreOpen((v) => !v)}
                className="w-9 h-9 rounded-full sm:rounded-md flex items-center justify-center text-white transition-opacity hover:opacity-85 active:opacity-60"
                style={{ background: P }}
                aria-label="More options"
              >
                <MoreHorizIcon sx={{ fontSize: 19 }} />
              </button>

              {moreOpen && (
                <>
                  {/* Backdrop for closing dropdown */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setMoreOpen(false)}
                  />
                  <div className="absolute right-0 bottom-full mb-2 w-44 bg-white rounded-md shadow-xl border border-black/[0.08] py-1.5 z-50">
                    <button
                      onClick={() => {
                        setMoreOpen(false);
                        openModal();
                      }}
                      className="w-full text-left px-4 py-2.5 text-[13px] text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors"
                    >
                      Edit Profile
                    </button>
                    <div className="h-px bg-[#f2f2f7] my-1" />
                    <button
                      onClick={() => {
                        setMoreOpen(false);
                        navigate("/library");
                      }}
                      className="w-full text-left px-4 py-2.5 text-[13px] text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors"
                    >
                      My Library
                    </button>
                    <button
                      onClick={() => setMoreOpen(false)}
                      className="w-full text-left px-4 py-2.5 text-[13px] text-[#6e6e73] hover:bg-[#f5f5f7] transition-colors"
                    >
                      Share Profile
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main content sections */}
      <div
        className="max-w-7xl mx-auto flex flex-col gap-10 py-8"
        style={{ padding: "32px clamp(16px, 5vw, 40px) 48px" }}
      >
        {/* Playlists section */}
        <section>
          {pL ? (
            // Loading skeletons
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-[4px] h-5 rounded-full bg-[#e5e5ea] animate-pulse" />
                <div className="h-5 w-24 bg-[#e5e5ea] rounded-md animate-pulse" />
              </div>
              <div className="flex gap-4 overflow-hidden">
                {Array.from({ length: 4 }).map((_, i) => (
                  <SkCard key={i} />
                ))}
              </div>
            </div>
          ) : playlists.length === 0 ? (
            // Empty state: no playlists
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div
                  className="w-[4px] h-5 rounded-full bg-[#fa243c]"
                  style={{ background: P }}
                />
                <h2 className="text-[17px] font-bold text-[#1d1d1f]">
                  Playlists
                </h2>
              </div>
              <div className="flex flex-col items-center py-12 bg-white rounded-md border border-black/[0.05] text-center">
                <LibraryMusicIcon
                  sx={{ fontSize: 40 }}
                  className="text-[#c7c7cc] mb-3"
                />
                <p className="text-[14px] font-semibold text-[#1d1d1f] mb-1">
                  No playlists yet
                </p>
                <p className="text-[12px] text-[#6e6e73] mb-5">
                  Create your first playlist from your Library
                </p>
                <Link
                  to="/library"
                  className="text-[13px] font-semibold px-5 py-2.5 rounded-md text-white transition-colors"
                  style={{ background: P }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = PH)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = P)}
                >
                  Go to Library
                </Link>
              </div>
            </div>
          ) : (
            // Playlists grid (horizontal scroll)
            <ScrollSection title="Playlists" linkTo="/library">
              {playlists.map((p) => (
                <PlaylistCard key={p.id} playlist={p} />
              ))}
            </ScrollSection>
          )}
        </section>

        {/* Listening history section */}
        {hL ? (
          // Loading skeletons
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-[4px] h-5 rounded-full bg-[#e5e5ea] animate-pulse" />
              <div className="h-5 w-32 bg-[#e5e5ea] rounded-md animate-pulse" />
            </div>
            <div className="flex gap-4 overflow-hidden">
              {Array.from({ length: 5 }).map((_, i) => (
                <SkCard key={i} />
              ))}
            </div>
          </section>
        ) : historyTracks && historyTracks.length > 0 ? (
          // History tracks (horizontal scroll, max 20 tracks)
          <section>
            <ScrollSection title="Listening To">
              {historyTracks.slice(0, 20).map((track) => (
                <TrackCard
                  key={track.id}
                  track={track}
                  onClick={() => playTrack(track, historyTracks)}
                />
              ))}
            </ScrollSection>
          </section>
        ) : null}

        {/* Footer */}
        <p className="text-center text-[11px] text-[#aeaeb2] font-semibold tracking-widest uppercase">
          BeatStream · Beta · 2026
        </p>
      </div>

      {/* Edit profile modal */}
      {modalOpen && (
        <EditProfileModal
          profile={profile}
          onClose={closeModal}
          onSave={handleSave}
        />
      )}
    </div>
  );
};

export default ProfilePage;