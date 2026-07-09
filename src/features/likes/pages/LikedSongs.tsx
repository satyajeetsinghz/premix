/**
 * @fileoverview Liked Songs page — dark glassmorphism Apple Music redesign.
 *
 * Changes from previous version:
 * - Removed star/like icons from the left column of song rows entirely
 * - Added contextual dropdown menu on MoreHorizIcon click (mobile + desktop)
 *   Menu items: "Remove from Liked Songs" / "Add to Liked Songs", "Add to Playlist",
 *               "Share Song", "Go to Artist", "Go to Album"
 * - Menu positions itself above/below the trigger to stay in viewport
 * - Menu closes on outside click, Escape key, or selecting an item
 * - Subtle separator between the like action and secondary actions
 * - Apple Music 2026 menu style: dark glass, 12px radius, 220px min-width
 *
 * Bug fixes in this pass:
 * - Fixed corrupted hero description string that had the same sentence
 *   duplicated ~7 times with "play" and "Like" mashed together at each seam
 *   ("...ready to playike any song...") — replaced with a single clean paragraph.
 * - Removed a no-op `window.scrollY - window.scrollY` cancellation in the
 *   context menu's "open above" position calculation.
 *
 * All other functionality, hooks, and architecture unchanged from previous version.
 *
 * @module features/likes/pages
 */

import {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  useLayoutEffect,
} from "react";
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
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import StarBorderRoundedIcon from "@mui/icons-material/StarBorderRounded";
import {
  AlbumRounded,
  IosShareRounded,
  Person,
  PlayArrowRounded,
  PlaylistAddRounded,
  ShuffleOutlined,
} from "@mui/icons-material";
import AnimatedSpinner from "@/components/ui/LoadingSpinner/AnimatedSpinner";
import { createPortal } from "react-dom";

// ── Brand tokens ──────────────────────────────────────────────
const P = "#fa243c";
const PH = "#e01e33";
const GR = "linear-gradient(135deg, #fa243c 0%, #bf5af2 100%)";
// const COVER_H = 270;

// ── Dark-theme surface tokens ─────────────────────────────────
// const BG = "#1f1f1f";
const SURFACE = "#1f1f1f";
// const SURFACE_ALT = "rgba(255,255,255,0.025)";
const HOVER_ROW = "rgba(255,255,255,0.08)";
const BORDER = "rgba(255,255,255,0.07)";
const TEXT_PRI = "#ffffffeb";
const TEXT_SEC = "rgba(235,235,245,0.6)";
const TEXT_TER = "rgba(235,235,245,0.4)";

// Menu surface — slightly lighter than page for contrast
// const MENU_BG = "rgba(44,44,46,0.98)";
// const MENU_BORDER = "rgba(255,255,255,0.10)";
// const MENU_SEP = "rgba(255,255,255,0.08)";

const TABLE_COLS =
  "minmax(440px,4fr) minmax(240px,2fr) minmax(240px,2fr) 72px 40px";

// ── Fixed chrome that can overlap the menu ─────────────────────
const PLAYER_BAR_H = 90;   // adjust to your actual PlayerBar height
const MOBILE_NAV_H = 64;   // adjust to your actual MobileNav height

// ── Helpers ───────────────────────────────────────────────────
const parseSecs = (d?: string | number): number => {
  if (!d) return 0;
  if (typeof d === "string" && d.includes(":")) {
    const [m, s] = d.split(":").map(Number);
    return m * 60 + (s || 0);
  }
  const n = typeof d === "string" ? parseInt(d, 10) : d;
  return isNaN(n) ? 0 : n;
};

const fmtDur = (d?: string | number): string => {
  if (!d) return "—";
  if (typeof d === "string" && d.includes(":")) return d;
  const s = typeof d === "string" ? parseInt(d, 10) : d;
  if (isNaN(s)) return "—";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

// ── PillBtn ───────────────────────────────────────────────────
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
    className={`flex items-center justify-center gap-2 px-6 py-2 rounded-full text-[14px] font-semibold text-white shadow-sm transition-all disabled:opacity-40 ${className || ""}`}
    style={style}
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
  >
    {children}
  </button>
);

// ── Song context menu ─────────────────────────────────────────
interface SongMenuState {
  songId: string;
  song: ISong;
  anchorEl: HTMLButtonElement;
}

interface SongContextMenuProps {
  menu: SongMenuState;
  isLiked: boolean;
  isToggling: boolean;
  onLikeToggle: (songId: string) => void;
  onClose: () => void;
}

/**
 * Floating context menu — Apple Music 2026 style.
 *
 * Positioning:
 * - Measures trigger button position via getBoundingClientRect
 * - Opens below trigger if space is available, otherwise above
 * - Pinned 8px from right edge of trigger
 * - useLayoutEffect recalculates on each open to handle scroll position
 */
const SongContextMenu = ({
  menu,
  isLiked,
  isToggling,
  onLikeToggle,
  onClose,
}: SongContextMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null);

  // Calculate position after paint so we know menu dimensions
  useLayoutEffect(() => {
    const rect = menu.anchorEl.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight ?? 260;
    const viewH = window.innerHeight;
    const spaceBelow = viewH - rect.bottom;
    const spaceAbove = rect.top;

    const right = window.innerWidth - rect.right + window.scrollX;

    if (spaceBelow >= menuHeight + 8 || spaceBelow >= spaceAbove) {
      setPos({ top: rect.bottom + window.scrollY + 6, right });
    } else {
      // Distance from the viewport bottom up to the anchor's top edge, plus a small gap.
      setPos({ bottom: viewH - rect.top + 6, right });
    }
  }, [menu.anchorEl]);

  useLayoutEffect(() => {
    const rect = menu.anchorEl.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight ?? 260;
    const viewH = window.innerHeight;

    // Reserve space for fixed chrome sitting on top of the page content
    const isMobile = window.innerWidth < 640; // matches your sm: breakpoint
    const bottomChrome = isMobile ? MOBILE_NAV_H + PLAYER_BAR_H : PLAYER_BAR_H;
    const usableViewH = viewH - bottomChrome;

    const spaceBelow = usableViewH - rect.bottom;
    const spaceAbove = rect.top;

    const right = window.innerWidth - rect.right + window.scrollX;

    if (spaceBelow >= menuHeight + 8 || spaceBelow >= spaceAbove) {
      // Clamp so it never runs past the usable area, even if anchor is low
      const top = Math.min(
        rect.bottom + window.scrollY + 6,
        window.scrollY + usableViewH - menuHeight - 8,
      );
      setPos({ top, right });
    } else {
      setPos({ bottom: viewH - rect.top + 6, right });
    }
  }, [menu.anchorEl]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        e.target !== menu.anchorEl &&
        !menu.anchorEl.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    // Slight delay so the triggering click doesn't immediately close
    const tid = setTimeout(() => document.addEventListener("mousedown", handler), 50);
    return () => {
      clearTimeout(tid);
      document.removeEventListener("mousedown", handler);
    };
  }, [onClose, menu.anchorEl]);

  const menuItems: Array<{
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    danger?: boolean;
    separator?: boolean; // separator ABOVE this item
  }> = [
      {
        icon: isLiked ? (
          <StarRoundedIcon
            sx={{
              fontSize: 16,
              color: "#fa233b",
            }}
          />
        ) : (
          <StarBorderRoundedIcon
            sx={{
              fontSize: 16,
              color: "#f5f5f7",
            }}
          />
        ),
        label: isLiked ? "Favourited" : "Favourite",
        danger: isLiked,
        onClick: () => {
          onLikeToggle(menu.songId);
          onClose();
        },
      },
      {
        icon: <PlaylistAddRounded sx={{ fontSize: 16 }} />,
        label: "Add to Playlist",
        separator: true,
        onClick: () => onClose(),
      },
      {
        icon: <IosShareRounded sx={{ fontSize: 16 }} />,
        label: "Share Song",
        onClick: () => onClose(),
      },
      {
        icon: <Person sx={{ fontSize: 16 }} />,
        label: "Go to Artist",
        separator: true,
        onClick: () => onClose(),
      },
      {
        icon: <AlbumRounded sx={{ fontSize: 16 }} />,
        label: "Go to Album",
        onClick: () => onClose(),
      },
    ];

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={`Options for ${menu.song.title}`}
      style={{
        position: "fixed",
        ...(pos?.top !== undefined ? { top: pos.top } : {}),
        ...(pos?.bottom !== undefined ? { bottom: pos.bottom } : {}),
        right: pos?.right ?? 16,
        width: 200,
        zIndex: 999999, // above PlayerBar / MobileNav, whatever they use
        background: "rgba(31,31,31,.68)",

        backdropFilter: "blur(38px) saturate(190%) brightness(1.05) contrast(1.05)",
        WebkitBackdropFilter: "blur(38px) saturate(190%) brightness(1.05) contrast(1.05)",

        border: "1px solid rgba(255,255,255,.12)",

        borderRadius: 10,

        overflow: "hidden",

        boxShadow: `
  0 24px 60px rgba(0,0,0,.48),
  0 10px 24px rgba(0,0,0,.28),
  0 2px 6px rgba(0,0,0,.18),
  inset 0 1px 0 rgba(255,255,255,.14),
  inset 0 -1px 0 rgba(0,0,0,.25),
  inset 0 0 0 1px rgba(255,255,255,.03)
`,
        animation: "slideUp .18s cubic-bezier(.2,.8,.2,1)",
        visibility: pos ? "visible" : "hidden",
      }}
    >
      {/* Song info */}
      <div
        style={{
          padding: "8px 12px",
        }}
      >
        <p
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "#F5F5F7",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {menu.song.title}
        </p>

        <p
          style={{
            fontSize: 11,
            color: "rgba(235,235,245,.55)",
            marginTop: 1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {menu.song.artist}
        </p>
      </div>

      <div
        style={{
          height: .5,
          background: "rgba(255,255,255,.08)",
        }}
      />

      {menuItems.map((item, i) => (
        <div key={i}>
          {item.separator && (
            <div
              style={{
                height: .5,
                background: "rgba(255,255,255,.08)",
              }}
            />
          )}

          <button
            role="menuitem"
            disabled={isToggling && item.label.includes("Liked")}
            onClick={item.onClick}
            className="group w-full flex items-center justify-between px-3 h-[34px] transition-colors duration-150"
            style={{
              background: "transparent",
              color: "#F5F5F7",

              opacity:
                isToggling && item.label.includes("Liked")
                  ? .45
                  : 1,
            }}
            onMouseEnter={(e) =>
            (e.currentTarget.style.background =
              "rgba(255,255,255,.06)")
            }
            onMouseLeave={(e) =>
            (e.currentTarget.style.background =
              "transparent")
            }
          >
            <span
              className="text-[13px]"
              style={{
                fontWeight: 500,
              }}
            >
              {item.label}
            </span>

            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",

                color: item.danger
                  ? "#ff453a"
                  : "#F5F5F7",
              }}
            >
              {item.icon}
            </span>
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
};

// ── Page ──────────────────────────────────────────────────────
const LikedSongs = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { playTrack } = usePlayer();

  const [songs, setSongs] = useState<ISong[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingLike, setTogglingLike] = useState<Set<string>>(new Set());
  const [activeMenu, setActiveMenu] = useState<SongMenuState | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToLikedSongs(user.uid, (data) => {
      setSongs(data);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const totalMins = useMemo(
    () => Math.floor(songs.reduce((a, s) => a + parseSecs(s.duration), 0) / 60),
    [songs],
  );

  const handlePlayAll = useCallback(() => {
    if (songs.length) playTrack(songs[0], songs);
  }, [songs, playTrack]);

  const handleShuffle = useCallback(() => {
    if (!songs.length) return;
    const sh = [...songs].sort(() => Math.random() - 0.5);
    playTrack(sh[0], sh);
  }, [songs, playTrack]);

  const handleLikeToggle = useCallback(
    async (songId: string) => {
      if (!user || togglingLike.has(songId)) return;
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
   * Opens (or closes if same song) the context menu for a song row.
   */
  const handleOpenMenu = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>, song: ISong) => {
      e.stopPropagation();
      const btn = e.currentTarget;
      setActiveMenu((prev) =>
        prev?.songId === song.id ? null : { songId: song.id, song, anchorEl: btn },
      );
    },
    [],
  );

  const handleCloseMenu = useCallback(() => setActiveMenu(null), []);

  const description = `All the songs you've liked in one place — ${songs.length} ${songs.length === 1 ? "track" : "tracks"} and ${totalMins} minutes of music.\n\nLike any song while browsing or listening and it will appear here automatically. Your taste in one collection, always ready to play.`;

  // ── Loading ───────────────────────────────────────────────
  if (loading) {
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
            <p className="text-[13px]" style={{ color: TEXT_SEC }}>
              Loading your liked songs…
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────
  if (!songs.length) {
    return (
      <div
        className="min-h-screen"
        style={{ background: "transparent", paddingLeft: "var(--sidebar-inset)" }}
        role="main"
        aria-label="Library page"
      >
        <div className="min-h-screen flex items-center justify-center" style={{ background: "transparent" }}>
          <div className="flex flex-col items-center text-center px-8 py-16 max-w-sm">
            <div
              className="w-24 h-24 rounded-2xl flex items-center justify-center shadow-2xl mb-6"
              style={{ background: GR }}
            >
              <FavoriteIcon className="text-white" sx={{ fontSize: 44 }} />
            </div>
            <h1 className="text-[22px] font-bold mb-2" style={{ color: TEXT_PRI }}>
              No Liked Songs Yet
            </h1>
            <p className="text-[13px] leading-relaxed mb-8" style={{ color: TEXT_SEC }}>
              Songs you like will appear here. Tap the heart icon on any track to save it.
            </p>
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 px-7 py-2.5 rounded-lg text-[13px] font-semibold text-white shadow-md transition-colors"
              style={{ background: P }}
              onMouseEnter={(e) => (e.currentTarget.style.background = PH)}
              onMouseLeave={(e) => (e.currentTarget.style.background = P)}
            >
              <PlayArrowIcon sx={{ fontSize: 18 }} />
              Discover Music
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main ──────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen"
      style={{ background: "transparent", paddingLeft: "var(--sidebar-inset)" }}
      role="main"
      aria-label="Library page"
    >
      <div className="min-h-screen" style={{ background: "transparent" }}>

        {/* ── Sticky header ── */}
        <div
          className="sticky top-0 z-20 border-b"
          style={{
            background: "transparent",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            borderColor: BORDER,
          }}
        >
          <div className="max-w-7xl mx-auto px-6 sm:px-8 flex items-center h-[52px]">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-0.5 text-[15px] font-semibold transition-opacity hover:opacity-70"
              style={{ color: P }}
            >
              <ChevronLeftRounded sx={{ fontSize: 26 }} />
              <span>Liked</span>
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-8 pb-24">

          {/* ── Hero ── */}
          <div className="pt-10 pb-10">
            <div className="flex flex-col sm:flex-row gap-8 items-start">
              <div
                className="shrink-0 w-[200px] h-[200px]  sm:min-w-[270px] sm:min-h-[270px] mx-auto sm:mx-0 rounded-2xl overflow-hidden"
                style={{
                  background: GR,
                }}
              >
                <div className="w-full h-full flex items-center justify-center">
                  <FavoriteIcon className="text-white/90" sx={{ fontSize: 88 }} />
                </div>
              </div>

              <HeroInfoPanel
                title="Liked Songs"
                subtitle={user?.name || "Your Collection"}
                description={description}
                meta={
                  <div className="flex flex-wrap items-center gap-2">
                    <span>Various Artists</span>
                    <span className="w-[3px] h-[3px] rounded-full" style={{ background: TEXT_TER }} />
                    <span>{songs.length} {songs.length === 1 ? "song" : "songs"}</span>
                    <span className="w-[3px] h-[3px] rounded-full" style={{ background: TEXT_TER }} />
                    <span>{totalMins} min</span>
                  </div>
                }
                actions={
                  <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto mt-4 sm:mt-0">
                    <div className="flex w-full gap-2 sm:w-auto">
                      <PillBtn
                        onClick={handlePlayAll}
                        disabled={songs.length === 0}
                        style={{ background: P }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = PH)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = P)}
                        className="flex-1 sm:flex-initial"
                      >
                        <PlayArrowRounded sx={{ fontSize: 18 }} />
                        Play
                      </PillBtn>
                      <PillBtn
                        onClick={handleShuffle}
                        disabled={songs.length === 0}
                        style={{
                          background: SURFACE,
                          border: `1px solid ${BORDER}`,
                          backdropFilter: "blur(12px)",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = HOVER_ROW)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = SURFACE)}
                        className="flex-1 sm:flex-initial"
                      >
                        <ShuffleOutlined sx={{ fontSize: 16 }} />
                        Shuffle
                      </PillBtn>
                    </div>
                    <button
                      className="hidden sm:flex items-center justify-center p-2 rounded-lg transition-colors"
                      style={{ color: TEXT_SEC }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = SURFACE)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <MoreHorizIcon sx={{ fontSize: 20 }} />
                    </button>
                  </div>
                }
              />
            </div>
          </div>

          {/* ── Song table ── */}
          <div
            className="overflow-hidden"
            style={{
              background: "transparent",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            }}
          >
            {/* ── Desktop header ── */}
            <div
              className="hidden sm:grid items-center h-11 px-0 border-b"
              style={{
                borderColor: BORDER,
                gridTemplateColumns: TABLE_COLS,
              }}
            >
              <span className="text-[12px] font-medium pl-1" style={{ color: TEXT_TER }}>
                Song
              </span>
              <span className="text-[12px] font-medium" style={{ color: TEXT_TER }}>
                Artist
              </span>
              <span className="hidden lg:block text-[12px] font-medium" style={{ color: TEXT_TER }}>
                Album
              </span>
              <span className="text-[12px] font-medium text-right" style={{ color: TEXT_TER }}>
                Time
              </span>
              <span />
            </div>

            {/* ── Rows ── */}
            {songs.map((song) => {
              // const isToggling = togglingLike.has(song.id);
              const menuOpen = activeMenu?.songId === song.id;
              // All songs in this view are liked
              // const isLiked = true;

              return (
                <div
                  key={song.id}
                  onClick={() => playTrack(song, songs)}
                  className="group cursor-pointer transition-colors"
                  style={{
                    background: menuOpen ? "rgba(255,255,255,0.06)" : undefined,
                  }}
                  onMouseEnter={(e) => {
                    if (!menuOpen) e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                  }}
                  onMouseLeave={(e) => {
                    if (!menuOpen) e.currentTarget.style.background = "transparent";
                  }}
                >
                  {/* ── Mobile row ── */}
                  <div
                    className="flex sm:hidden items-center gap-3 px-2 h-[64px] border-b"
                    style={{ borderColor: BORDER }}
                  >
                    {/* Artwork */}
                    <div className="w-10 h-10 rounded-md overflow-hidden shrink-0">
                      {song.coverUrl || song.imageUrl ? (
                        <img
                          src={song.coverUrl || song.imageUrl}
                          alt={song.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center" style={{ background: GR }}>
                          <LibraryMusicIcon sx={{ fontSize: 14 }} className="text-white/70" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-[13px]" style={{ color: TEXT_PRI }}>
                        {song.title}
                      </p>
                      <p className="truncate text-[12px] mt-0.5" style={{ color: TEXT_SEC }}>
                        {song.artist}
                      </p>
                    </div>

                    {/* More button */}
                    <button
                      onClick={(e) => handleOpenMenu(e, song)}
                      aria-label={`More options for ${song.title}`}
                      aria-expanded={menuOpen}
                      aria-haspopup="menu"
                      className="
    flex
    items-center
    justify-center
    shrink-0
    w-11
    h-11
    transition-all
    duration-200
  "
                      style={{color: "#fa243c"}}
                    >
                      <MoreHorizIcon sx={{ fontSize: 22 }} />
                    </button>
                  </div>

                  {/* ── Desktop row ── */}
                  <div
                    className="hidden sm:grid items-center h-[56px] px-1 border-b"
                    style={{
                      borderColor: BORDER,
                      gridTemplateColumns: TABLE_COLS,
                    }}
                  >
                    {/* Song + cover */}
                    <div className="flex items-center gap-4 min-w-0 w-full pl-1">
                      <div className="w-9 h-9 rounded-md overflow-hidden shrink-0">
                        {song.coverUrl || song.imageUrl ? (
                          <img
                            src={song.coverUrl || song.imageUrl}
                            alt={song.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center" style={{ background: GR }}>
                            <LibraryMusicIcon sx={{ fontSize: 13 }} className="text-white/70" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[13px]" style={{ color: TEXT_PRI }}>
                          {song.title}
                        </p>
                      </div>
                    </div>

                    {/* Artist */}
                    <div className="truncate pr-4 text-[13px]" style={{ color: TEXT_SEC }}>
                      {song.artist}
                    </div>

                    {/* Album */}
                    <div className="hidden lg:block truncate pr-4 text-[13px]" style={{ color: TEXT_SEC }}>
                      {song.album || "—"}
                    </div>

                    {/* Time */}
                    <div className="text-right text-[12px] tabular-nums" style={{ color: TEXT_TER }}>
                      {fmtDur(song.duration)}
                    </div>

                    {/* More button */}
                    <button
                      onClick={(e) => handleOpenMenu(e, song)}
                      aria-label={`More options for ${song.title}`}
                      aria-expanded={menuOpen}
                      aria-haspopup="menu"
                      className="
    flex
    items-center
    justify-center
    pl-2
    transition-colors
    duration-200
    hover:text-[#fa243c]
  "
                      style={{
                        color: "#fa243c",
                        background: "transparent",
                        opacity: menuOpen ? 1 : undefined,
                      }}
                    >
                      <MoreHorizIcon sx={{ fontSize: 16 }} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Floating context menu (portal-like, fixed position) ── */}
        {activeMenu && (
          <SongContextMenu
            menu={activeMenu}
            isLiked={true}
            isToggling={togglingLike.has(activeMenu.songId)}
            onLikeToggle={handleLikeToggle}
            onClose={handleCloseMenu}
          />
        )}
      </div>
    </div>
  );
};

export default LikedSongs;