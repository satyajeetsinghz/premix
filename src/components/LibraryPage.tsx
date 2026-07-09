/**
 * @fileoverview Library page — dark glassmorphism Apple Music redesign.
 *
 * Design changes from original:
 * - Page bg: #0a0a0a
 * - Header: rgba(10,10,10,0.75) + backdrop-blur(24px), border rgba(255,255,255,0.07)
 *   Height locked to 52px (consistent with all pages)
 * - Grid/list cards: glass surface rgba(255,255,255,0.05) with blur + rounded-xl
 * - Liked Songs card: glass surface with gradient icon, border rgba(255,255,255,0.07)
 * - View toggle: dark pill container
 * - Skeleton: dark shimmer (rgba(255,255,255,0.06))
 * - Text: #f5f5f7 / rgba(235,235,245,0.6) / rgba(235,235,245,0.4)
 *
 * All functionality, hooks, and architecture unchanged from original.
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
import ViewAgendaRoundedIcon from "@mui/icons-material/ViewAgendaRounded";
import AnimatedSpinner from "@/components/ui/LoadingSpinner/AnimatedSpinner";

// ── Brand tokens ──────────────────────────────────────────────
const PRIMARY = "#fa243c";
const PRIMARY_HOVER = "#e01e33";
const GRADIENT = "linear-gradient(135deg, #fa243c 0%, #bf5af2 100%)";
// const COVER_H = 220;
// const COVER_SIZE = 270; // px — same across all pages


// ── Dark surface tokens ───────────────────────────────────────
const P = "#fa243c";
// const BG = "#1f1f1f";
const SURFACE = "#1f1f1f";
const SURFACE_HVR = "#1f1f1f";
const BORDER = "rgba(255,255,255,0.07)";
const TEXT_PRI = "#f5f5f7";
const TEXT_SEC = "rgba(235,235,245,0.6)";
const TEXT_TER = "rgba(235,235,245,0.4)";

// ── Skeleton ──────────────────────────────────────────────────
interface SkeletonProps { w?: string; h?: string }
const Skeleton = ({ w = "w-full", h = "h-4" }: SkeletonProps) => (
  <div
    className={`${w} ${h} rounded-lg animate-pulse`}
    style={{ background: "rgba(255,255,255,0.07)" }}
  />
);

// ── PillBtn ───────────────────────────────────────────────────
interface PillBtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  style?: React.CSSProperties;
}
const PillBtn = ({
  onClick,
  children,
  style,
  onMouseEnter,
  onMouseLeave,
}: PillBtnProps) => (
  <button
    onClick={onClick}
    className="hidden sm:flex items-center gap-2 px-6 py-2 rounded-full text-[14px] font-semibold text-white shadow-sm transition-colors"
    style={style}
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
    aria-label="Create new playlist"
  >
    {children}
  </button>
);

// ── Page ──────────────────────────────────────────────────────
const LibraryPage = () => {
  const [showModal, setShowModal] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");

  const { playlists, loading: playlistsLoading } = useUserPlaylists();
  const { likedSongs, loading: likedLoading } = useLikedSongs();
  const { user } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();

  const likedCount = useMemo(() => likedSongs?.length ?? 0, [likedSongs]);
  const displayName = useMemo(
    () => profile?.name || user?.name || "You",
    [profile?.name, user?.name],
  );

  const playlistsDates = useMemo(() => {
    const m = new Map<string, string | null>();
    playlists.forEach((p) => {
      try {
        const d = p.createdAt?.toDate?.() ?? new Date(p.createdAt);
        m.set(p.id, d.toLocaleDateString("en-US", { month: "short", year: "numeric" }));
      } catch {
        m.set(p.id, null);
      }
    });
    return m;
  }, [playlists]);

  const description = useMemo(() => {
    const playlistWord = playlists.length === 1 ? "playlist" : "playlists";
    const songWord = likedCount === 1 ? "song" : "songs";
    return `Your personal music collection containing ${playlists.length} ${playlistWord} and ${likedCount} liked ${songWord}.\n\nOrganise your favourite tracks into playlists, save songs you love, and keep everything in one place.`;
  }, [playlists.length, likedCount]);

  const openModal = useCallback(() => setShowModal(true), []);
  const closeModal = useCallback(() => setShowModal(false), []);
  const setGridView = useCallback(() => setView("grid"), []);
  const setListView = useCallback(() => setView("list"), []);

  const renderLikedSongCount = () => {
    if (likedLoading) return <AnimatedSpinner size={13} color={PRIMARY} />;
    return `${likedCount} ${likedCount === 1 ? "song" : "songs"}`;
  };

  const isInitialLoading = playlistsLoading && likedLoading;

  if (isInitialLoading) {
    return (
      <div
        className="min-h-screen"
        style={{ background: "transparent", paddingLeft: "var(--sidebar-inset)" }}
        role="main"
        aria-label="Library page"
      >
        <div className="min-h-screen flex items-center justify-center" style={{ background: "transparent" }}>
          <div className="flex flex-col items-center gap-3">
            <AnimatedSpinner size={28} color={P} />
            {/* <p className="text-[13px]" style={{ color: TEXT_SEC }}>
              Loading your liked songs…
            </p> */}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: "transparent", paddingLeft: "var(--sidebar-inset)" }}
      role="main"
      aria-label="Library page"
    >
      <div className="min-h-screen" style={{ background: "transparent" }} role="main" aria-label="Library page">

        {/* ── Sticky header ── */}
        <div
          className="sticky top-0 z-40 border-b"
          style={{
            background: "transparent",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            borderColor: BORDER,
          }}
        >
          <div className="max-w-7xl mx-auto px-6 sm:px-8 flex items-center justify-between h-[52px]">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-0.5 text-[15px] font-semibold transition-opacity hover:opacity-70"
              style={{ color: PRIMARY }}
              aria-label="Go back"
            >
              <ChevronLeftRoundedIcon sx={{ fontSize: 26 }} />
              <span>Library</span>
            </button>

            <button
              onClick={openModal}
              className="flex items-center gap-1 text-[13px] font-semibold transition-opacity hover:opacity-70"
              style={{ color: PRIMARY }}
              aria-label="Create new playlist"
            >
              <AddRoundedIcon sx={{ fontSize: 18 }} />
              New Playlist
            </button>
          </div>
        </div>

        {/* ── Main content ── */}
        <div
          className="
    max-w-[1600px]
    mx-auto
    px-4
    sm:px-6
    md:px-8
    xl:px-10
    pb-24
    bg-transparent
  "
        >

          {/* ── Hero ── */}
          <div className="pt-8 pb-6">
            <div
              className="
    flex
    flex-col
    sm:flex-row
    items-center
    lg:items-start
    gap-6
    sm:gap-8
    lg:gap-10
  "
            >
              {/* ───────────────── LEFT COLUMN ───────────────── */}
              <div
                className="
    shrink-0
    w-full
    max-w-[220px]
    sm:max-w-[240px]
    md:max-w-[270px]
    lg:w-[270px]
  "
              >
                <div
                  className="
          overflow-hidden
          mx-auto
          lg:mx-0
  aspect-square
  w-full

        "
                  style={{
                    borderRadius: 12,
                    boxShadow: "0 12px 40px rgba(0,0,0,.35)",
                    background: GRADIENT,
                  }}
                >
                  <div className="w-full h-full flex items-center justify-center">
                    <LibraryMusicIcon
                      className="text-white/80"
                      sx={{ fontSize: 84 }}
                    />
                  </div>
                </div>
              </div>

              {/* ───────────────── RIGHT COLUMN ───────────────── */}
              <div
                className="
    flex-1
    min-w-0
    w-full
    lg:min-h-[270px]
  "
              >
                <HeroInfoPanel
                  title="Your Library"
                  subtitle={displayName}
                  description={description}
                  meta={
                    <div className="flex items-center gap-1.5">
                      <span>
                        {playlists.length}{" "}
                        {playlists.length === 1 ? "playlist" : "playlists"}
                      </span>

                      <span style={{ color: "rgba(235,235,245,0.3)" }}>
                        ·
                      </span>

                      <span>
                        {likedCount} liked{" "}
                        {likedCount === 1 ? "song" : "songs"}
                      </span>
                    </div>
                  }
                  actions={
                    <PillBtn
                      onClick={openModal}
                      style={{
                        background: "#fff",
                        color: "#000",
                      }}
                    >
                      <AddRoundedIcon sx={{ fontSize: 18 }} />
                      New Playlist
                    </PillBtn>
                  }
                />
              </div>
            </div>
          </div>

          {/* ── Liked Songs card ── */}
          <div className="mb-8">
            <Link
              to="/liked"
              className="flex items-center gap-4 px-5 py-4 rounded-xl transition-colors group border"
              style={{ background: SURFACE, borderColor: BORDER }}
              onMouseEnter={(e) => (e.currentTarget.style.background = SURFACE_HVR)}
              onMouseLeave={(e) => (e.currentTarget.style.background = SURFACE)}
              aria-label="Liked songs"
            >
              <div
                className="w-[52px] h-[52px] rounded-xl shrink-0 flex items-center justify-center"
                style={{ background: GRADIENT }}
              >
                <FavoriteRoundedIcon className="text-white" sx={{ fontSize: 24 }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold" style={{ color: TEXT_PRI }}>
                  Liked Songs
                </p>
                <p className="text-[12px] mt-0.5 flex items-center gap-1" style={{ color: TEXT_SEC }}>
                  {renderLikedSongCount()}
                </p>
              </div>
              <ChevronRightRoundedIcon style={{ color: TEXT_TER, flexShrink: 0 }} sx={{ fontSize: 20 }} />
            </Link>
          </div>

          {/* ── Playlists header + view toggle ── */}
          {/* ── Playlists Header ───────────────────────────── */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2
                className="
        text-[22px]
        font-semibold
        tracking-[-0.02em]
      "
                style={{ color: TEXT_PRI }}
              >
                Playlists
              </h2>

              <p
                className="text-[13px] mt-0.5"
                style={{ color: TEXT_SEC }}
              >
                {playlists.length} playlists
              </p>
            </div>

            {/* Apple Music View Toggle */}
            <div
              className="
      flex
      items-center
      gap-1
      p-1
      rounded-full
    "
              style={{
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${BORDER}`,
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
              }}
            >
              {/* Grid */}
              <button
                onClick={setGridView}
                aria-label="Grid view"
                aria-pressed={view === "grid"}
                className="
        relative
        flex
        items-center
        justify-center
        w-8
        h-8
        rounded-full
        transition-all
        duration-200
      "
                style={{
                  background:
                    view === "grid"
                      ? "rgba(255,255,255,0.10)"
                      : "transparent",

                  color:
                    view === "grid"
                      ? TEXT_PRI
                      : TEXT_TER,
                }}
              >
                <GridViewRoundedIcon sx={{ fontSize: 18 }} />
              </button>

              {/* List */}
              <button
                onClick={setListView}
                aria-label="List view"
                aria-pressed={view === "list"}
                className="
        relative
        flex
        items-center
        justify-center
        w-8
        h-8
        rounded-full
        transition-all
        duration-200
      "
                style={{
                  background:
                    view === "list"
                      ? "rgba(255,255,255,0.10)"
                      : "transparent",

                  color:
                    view === "list"
                      ? TEXT_PRI
                      : TEXT_TER,
                }}
              >
                <ViewAgendaRoundedIcon sx={{ fontSize: 18 }} />
              </button>
            </div>
          </div>

          {/* ── Loading — grid ── */}
          {playlistsLoading && view === "grid" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5" aria-busy="true">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i}>
                  <Skeleton w="w-full" h="aspect-square rounded-xl mb-2.5" />
                  <Skeleton w="w-3/4" h="h-[13px] mb-1.5" />
                  <Skeleton w="w-1/2" h="h-[11px]" />
                </div>
              ))}
            </div>
          )}

          {/* ── Loading — list ── */}
          {playlistsLoading && view === "list" && (
            <div
              className="rounded-xl overflow-hidden border"
              style={{ background: SURFACE, borderColor: BORDER }}
              aria-busy="true"
            >
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 px-5 py-3.5 animate-pulse border-b last:border-0"
                  style={{ borderColor: BORDER }}
                >
                  <Skeleton w="w-11 shrink-0" h="h-11 rounded-lg" />
                  <div className="flex-1">
                    <Skeleton w="w-2/3" h="h-[13px] mb-1.5" />
                    <Skeleton w="w-1/3" h="h-[11px]" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Empty state ── */}
          {!playlistsLoading && playlists.length === 0 && (
            <div
              className="flex flex-col items-center py-20 text-center rounded-xl border"
              style={{ background: SURFACE, borderColor: BORDER }}
              role="status"
              aria-live="polite"
            >
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
                style={{ background: "rgba(255,255,255,0.07)" }}
              >
                <LibraryMusicIcon sx={{ fontSize: 36 }} style={{ color: TEXT_TER }} />
              </div>
              <h3 className="text-[15px] font-semibold mb-1.5" style={{ color: TEXT_PRI }}>
                No playlists yet
              </h3>
              <p className="text-[13px] mb-6 max-w-[220px]" style={{ color: TEXT_SEC }}>
                Create your first playlist to organise your music
              </p>
              <button
                onClick={openModal}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-semibold text-white shadow-md transition-colors"
                style={{ background: PRIMARY }}
                onMouseEnter={(e) => (e.currentTarget.style.background = PRIMARY_HOVER)}
                onMouseLeave={(e) => (e.currentTarget.style.background = PRIMARY)}
                aria-label="Create first playlist"
              >
                <AddRoundedIcon sx={{ fontSize: 16 }} />
                New Playlist
              </button>
            </div>
          )}

          {/* ── Grid view ── */}
          {!playlistsLoading && playlists.length > 0 && view === "grid" && (
            <div
              className="grid grid-cols-2
sm:grid-cols-3
md:grid-cols-4
lg:grid-cols-5
xl:grid-cols-6
2xl:grid-cols-7 gap-5"
              aria-live="polite"
            >
              {playlists.map((p) => (
                <Link
                  key={p.id}
                  to={`/playlist/${p.id}`}
                  className="group"
                  aria-label={`Open playlist ${p.name}`}
                >
                  <div className="aspect-square w-full mb-2.5 rounded-xl overflow-hidden transition-all duration-200 group-hover:brightness-90 group-hover:scale-[1.02]"
                    style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}
                  >
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
                  <p className="text-[13px] font-semibold truncate" style={{ color: TEXT_PRI }}>
                    {p.name}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: TEXT_SEC }}>
                    {p.songCount ?? 0} {p.songCount === 1 ? "song" : "songs"}
                  </p>
                </Link>
              ))}
            </div>
          )}

          {/* ── List view ── */}
          {!playlistsLoading && playlists.length > 0 && view === "list" && (
            <div
              className="rounded-xl overflow-hidden border"
              style={{ background: SURFACE, borderColor: BORDER }}
              aria-live="polite"
            >
              {playlists.map((p) => (
                <Link
                  key={p.id}
                  to={`/playlist/${p.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 transition-colors group border-b last:border-0"
                  style={{ borderColor: BORDER }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = SURFACE_HVR)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  aria-label={`Open playlist ${p.name}`}
                >
                  <div className="w-11 h-11 shrink-0 rounded-lg overflow-hidden">
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
                        <LibraryMusicIcon sx={{ fontSize: 16 }} className="text-white/80" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold truncate" style={{ color: TEXT_PRI }}>
                      {p.name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[11px]" style={{ color: TEXT_SEC }}>
                      <span>{p.songCount ?? 0} {p.songCount === 1 ? "song" : "songs"}</span>
                      {playlistsDates.get(p.id) && (
                        <>
                          <span className="w-[3px] h-[3px] rounded-full" style={{ background: TEXT_TER }} />
                          <span>{playlistsDates.get(p.id)}</span>
                        </>
                      )}
                      {p.isPublic === false && (
                        <>
                          <span className="w-[3px] h-[3px] rounded-full" style={{ background: TEXT_TER }} />
                          <span>Private</span>
                        </>
                      )}
                    </div>
                  </div>
                  <ChevronRightRoundedIcon style={{ color: TEXT_TER, flexShrink: 0 }} sx={{ fontSize: 18 }} />
                </Link>
              ))}
            </div>
          )}
        </div>

        <CreatePlaylistModal open={showModal} onClose={closeModal} />
      </div>
    </div>
  );
};

export default LibraryPage;