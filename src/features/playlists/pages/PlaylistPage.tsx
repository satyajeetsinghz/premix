/**
 * @fileoverview Playlist detail page — dark glassmorphism Apple Music redesign.
 *
 * Changes from previous version:
 * - Updated table columns to match LikedSongs: minmax(440px,4fr) minmax(240px,2fr) minmax(240px,2fr) 72px 40px
 * - Removed like/star column from desktop rows (like button moved to context menu)
 * - Added SongContextMenu with: "Add to Liked Songs", "Add to Playlist", "Share Song", "Go to Artist", "Go to Album"
 * - Menu positions itself above/below the trigger to stay in viewport
 * - Menu closes on outside click, Escape key, or selecting an item
 * - Subtle separator between the like action and secondary actions
 * - Apple Music 2026 menu style: dark glass, 12px radius, 220px min-width
 * - Table wrapped with rounded-2xl and glass backdrop
 * - Full mobile responsiveness matching LikedSongs
 *
 * Bug fixes in this pass:
 * - Fixed disconnected delete-dialog state: PlaylistPage was setting `confirmDelete`
 *   but rendering the dialog based on `showDeleteDialog`, which was never declared
 *   in this component's scope (it only existed as unused local state inside the
 *   separate SongContextMenu component). Consolidated to a single `showDeleteDialog`
 *   state in PlaylistPage and removed the dead/shadowing state from SongContextMenu.
 * - Removed a no-op `window.scrollY - window.scrollY` cancellation in the menu's
 *   "open above" position calculation.
 *
 * Latest pass — Playlist options menu now matches SongContextMenu's behavior:
 * - The header's "More options" menu (Public/Private, Delete Playlist) was rendered
 *   with `position: absolute` inside the sticky header, which sits inside an
 *   `overflow`/backdrop-filter-bearing ancestor. That clipped/altered how its own
 *   `backdrop-filter` composited, making the glass panel read far more transparent
 *   than the (visually identical) SongContextMenu, which portals to `document.body`
 *   with `position: fixed` and therefore blurs the true page background correctly.
 * - Extracted a new `PlaylistOptionsMenu` component that mirrors SongContextMenu:
 *   portals to document.body, computes position via getBoundingClientRect on the
 *   trigger button, and manages its own outside-click/Escape dismissal — instead of
 *   being nested/absolute inside the header and relying on the page's shared
 *   useClickOutside/menuRef wiring.
 * - The trigger button no longer needs a wrapping `relative` container for the menu;
 *   position is computed from the button's own anchor rect, same as song rows.
 *
 * All functionality, hooks, and architecture otherwise unchanged from original.
 *
 * @module features/playlists/pages
 */

import { useEffect, useState, useRef, useCallback, useMemo, useLayoutEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getPlaylistById,
  subscribeToPlaylistSongs,
  updatePlaylist,
  deletePlaylist,
  Playlist,
  PlaylistSong,
  playlistSongsToITracks,
} from "../services/playlistService";
import { HeroInfoPanel } from "@/components/shared/HeroInfoPanel";
import LibraryMusicIcon from "@mui/icons-material/LibraryMusic";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import PublicIcon from "@mui/icons-material/Public";
import LockIcon from "@mui/icons-material/Lock";
import ChevronLeftRounded from "@mui/icons-material/ChevronLeftRounded";
import AnimatedSpinner from "@/components/ui/LoadingSpinner/AnimatedSpinner";
import { usePlayer } from "@/features/player/hooks/usePlayer";
import { useAuth } from "@/features/auth/hooks/useAuth";
// import { useClickOutside } from "@/features/playlists/hooks/useClickOutside";
import { useLikedSongs } from "@/features/likes/hooks/useLikedSongs";
import { toggleLikeTransaction } from "@/features/likes/services/likeService";
import {
  AlbumRounded,
  DeleteOutlineRounded,
  DeleteRounded,
  IosShareRounded,
  LockOpenRounded,
  LockRounded,
  Person,
  PlayArrowRounded,
  PlaylistAddRounded,
  ShuffleOutlined,
  StarBorderRounded,
  StarRounded,
} from "@mui/icons-material";
import { createPortal } from "react-dom";

// ── Brand tokens ──────────────────────────────────────────────
const P = "#fa243c";
const PH = "#e01e33";
const GR = "linear-gradient(135deg, #fa243c 0%, #bf5af2 100%)";
const COVER_H = 270;

// ── Dark-theme surface tokens ─────────────────────────────────
const SURFACE = "#1f1f1f";
const HOVER_ROW = "rgba(255,255,255,0.08)";
const BORDER = "rgba(255,255,255,0.07)";
const TEXT_PRI = "#ffffffeb";
const TEXT_SEC = "rgba(235,235,245,0.6)";
const TEXT_TER = "rgba(235,235,245,0.4)";

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
  song: PlaylistSong;
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

  useLayoutEffect(() => {
    const rect = menu.anchorEl.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight ?? 260;
    const viewH = window.innerHeight;

    const isMobile = window.innerWidth < 640;
    const bottomChrome = isMobile ? MOBILE_NAV_H + PLAYER_BAR_H : PLAYER_BAR_H;
    const usableViewH = viewH - bottomChrome;

    const spaceBelow = usableViewH - rect.bottom;
    const spaceAbove = rect.top;

    const right = window.innerWidth - rect.right + window.scrollX;

    if (spaceBelow >= menuHeight + 8 || spaceBelow >= spaceAbove) {
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
    separator?: boolean;
  }> = [
      {
        icon: isLiked ? (
          <StarRounded sx={{ fontSize: 16, color: "#fa233b" }} />
        ) : (
          <StarBorderRounded sx={{ fontSize: 16, color: "#f5f5f7" }} />
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
        zIndex: 999999,
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
      <div style={{ padding: "8px 12px" }}>
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

      <div style={{ height: 0.5, background: "rgba(255,255,255,.08)" }} />

      {menuItems.map((item, i) => (
        <div key={i}>
          {item.separator && (
            <div style={{ height: 0.5, background: "rgba(255,255,255,.08)" }} />
          )}
          <button
            role="menuitem"
            disabled={isToggling && item.label.includes("Liked")}
            onClick={item.onClick}
            style={{
              width: "100%",
              height: 34,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 12px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "#F5F5F7",
              fontSize: 13,
              fontWeight: 500,
              transition: "background .15s ease",
              opacity: isToggling && item.label.includes("Liked") ? 0.45 : 1,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,.06)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.label}
            </span>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: item.danger ? "#fa233b" : "#F5F5F7",
                flexShrink: 0,
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

// ── Playlist options menu (header "More options": Public/Private, Delete) ──
interface PlaylistOptionsMenuProps {
  anchorEl: HTMLButtonElement;
  isPublic: boolean;
  onTogglePublic: () => void;
  onRequestDelete: () => void;
  onClose: () => void;
}

/**
 * Floating menu for the playlist header's "More options" trigger.
 *
 * Mirrors SongContextMenu exactly (same portal target, same fixed positioning
 * strategy, same glass styling) rather than being nested with
 * `position: absolute` inside the sticky header. The header sits inside an
 * ancestor that clips/backdrop-filters its own content (needed for the sticky
 * blur), which was interfering with this menu's own backdrop-filter and
 * making it render far more transparent than the Song menu. Portaling to
 * document.body with position: fixed — exactly like SongContextMenu —
 * removes it from that ancestor's stacking/clipping context entirely.
 */
const PlaylistOptionsMenu = ({
  anchorEl,
  isPublic,
  onTogglePublic,
  onRequestDelete,
  onClose,
}: PlaylistOptionsMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null);

  useLayoutEffect(() => {
    const rect = anchorEl.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight ?? 160;
    const viewH = window.innerHeight;

    const isMobile = window.innerWidth < 640;
    const bottomChrome = isMobile ? MOBILE_NAV_H + PLAYER_BAR_H : PLAYER_BAR_H;
    const usableViewH = viewH - bottomChrome;

    const spaceBelow = usableViewH - rect.bottom;
    const spaceAbove = rect.top;

    const right = window.innerWidth - rect.right + window.scrollX;

    if (spaceBelow >= menuHeight + 8 || spaceBelow >= spaceAbove) {
      const top = Math.min(
        rect.bottom + window.scrollY + 6,
        window.scrollY + usableViewH - menuHeight - 8,
      );
      setPos({ top, right });
    } else {
      setPos({ bottom: viewH - rect.top + 6, right });
    }
  }, [anchorEl]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        e.target !== anchorEl &&
        !anchorEl.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    const tid = setTimeout(() => document.addEventListener("mousedown", handler), 50);
    return () => {
      clearTimeout(tid);
      document.removeEventListener("mousedown", handler);
    };
  }, [onClose, anchorEl]);

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label="Playlist options"
      style={{
        position: "fixed",
        ...(pos?.top !== undefined ? { top: pos.top } : {}),
        ...(pos?.bottom !== undefined ? { bottom: pos.bottom } : {}),
        right: pos?.right ?? 16,
        width: 200,
        zIndex: 999999,
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
      {/* Public / Private */}
      <button
        role="menuitem"
        onClick={() => {
          onTogglePublic();
          onClose();
        }}
        style={{
          width: "100%",
          height: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
          background: "transparent",
          border: "none",
          color: "#F5F5F7",
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: "-0.08px",
          cursor: "pointer",
          transition: "background .15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,.05)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <span>{isPublic ? "Make Private" : "Make Public"}</span>
        {isPublic ? (
          <LockRounded sx={{ fontSize: 16, color: "#F5F5F7", opacity: 0.9 }} />
        ) : (
          <LockOpenRounded sx={{ fontSize: 16, color: "#F5F5F7", opacity: 0.9 }} />
        )}
      </button>

      <div style={{ height: 0.5, background: "rgba(255,255,255,.08)" }} />

      {/* Delete Playlist */}
      <button
        role="menuitem"
        onClick={() => {
          onRequestDelete();
          onClose();
        }}
        style={{
          width: "100%",
          height: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
          background: "transparent",
          border: "none",
          color: "#F5F5F7",
          fontSize: 13,
          fontWeight: 500,
          cursor: "pointer",
          transition: "background .15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,.05)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <span>Delete Playlist</span>
        <DeleteOutlineRounded sx={{ fontSize: 16, color: "#F5F5F7", opacity: 0.9 }} />
      </button>
    </div>,
    document.body,
  );
};

// ── Page ──────────────────────────────────────────────────────
const PlaylistPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { playTrack } = usePlayer();
  const { user } = useAuth();
  const { likedSongs } = useLikedSongs();

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [songs, setSongs] = useState<PlaylistSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [playlistMenuAnchor, setPlaylistMenuAnchor] = useState<HTMLButtonElement | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [togglingLike, setTogglingLike] = useState<Set<string>>(new Set());
  const [activeMenu, setActiveMenu] = useState<SongMenuState | null>(null);

  useEffect(() => {
    if (!id) return;
    getPlaylistById(id).then((d) => {
      setPlaylist(d);
      setLoading(false);
    });
    return subscribeToPlaylistSongs(id, setSongs);
  }, [id]);

  const likedSongIds = useMemo(
    () => new Set(likedSongs.map((song) => song.id)),
    [likedSongs],
  );

  const tracks = useMemo(() => playlistSongsToITracks(songs), [songs]);

  const totalMins = useMemo(
    () => Math.floor(songs.reduce((a, s) => a + parseSecs(s.duration), 0) / 60),
    [songs],
  );

  const handlePlayAll = useCallback(() => {
    if (tracks.length) playTrack(tracks[0], tracks);
  }, [tracks, playTrack]);

  const handleShuffle = useCallback(() => {
    if (!songs.length) return;
    const sh = playlistSongsToITracks([...songs].sort(() => Math.random() - 0.5));
    playTrack(sh[0], sh);
  }, [songs, playTrack]);

  const handleDelete = useCallback(async () => {
    if (!id) return;
    await deletePlaylist(id);
    navigate("/library");
  }, [id, navigate]);

  const togglePublic = useCallback(async () => {
    if (!id || !playlist) return;
    await updatePlaylist(id, { isPublic: !playlist.isPublic });
    setPlaylist((p) => (p ? { ...p, isPublic: !p.isPublic } : p));
  }, [id, playlist]);

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
   * Opens (or closes if already open) the header's playlist options menu.
   */
  const handleOpenPlaylistMenu = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const btn = e.currentTarget;
    setPlaylistMenuAnchor((prev) => (prev ? null : btn));
  }, []);

  const handleClosePlaylistMenu = useCallback(() => setPlaylistMenuAnchor(null), []);

  /**
   * Opens (or closes if same song) the context menu for a song row.
   */
  const handleOpenMenu = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>, song: PlaylistSong) => {
      e.stopPropagation();
      const btn = e.currentTarget;
      setActiveMenu((prev) =>
        prev?.songId === song.id ? null : { songId: song.id, song, anchorEl: btn },
      );
    },
    [],
  );

  const handleCloseMenu = useCallback(() => setActiveMenu(null), []);

  // ── Loading ───────────────────────────────────────────────
  if (loading) {
    return (
      <div
        className="min-h-screen"
        style={{ background: "transparent", paddingLeft: "var(--sidebar-inset)" }}
        role="main"
        aria-label="Library page"
      >
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ background: "transparent" }}
        >
          <div className="flex flex-col items-center gap-3">
            <AnimatedSpinner size={28} color={P} />
            <p className="text-[13px]" style={{ color: TEXT_SEC }}>
              Loading playlist…
            </p>
          </div>
        </div>
      </div>
    );
  }
  if (!playlist) return null;

  const isOwner = user?.uid === playlist.userId;
  const createdDate =
    playlist.createdAt?.toDate?.()?.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }) ?? "";

  const description =
    playlist.description ||
    `A collection of ${songs.length} ${songs.length === 1 ? "song" : "songs"}${user?.name ? ` curated by ${user.name}` : ""}.\n\nBuild this playlist by adding songs from your library and discover new music to keep it fresh.`;

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
          <div className="max-w-7xl mx-auto px-6 sm:px-8 flex items-center justify-between h-[52px]">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-0.5 text-[15px] font-semibold transition-opacity hover:opacity-70"
              style={{ color: P }}
            >
              <ChevronLeftRounded sx={{ fontSize: 26 }} />
              <span>Playlist</span>
            </button>

            {isOwner && (
              <button
                onClick={handleOpenPlaylistMenu}
                aria-label="Playlist options"
                aria-haspopup="menu"
                aria-expanded={!!playlistMenuAnchor}
                className="p-1.5"
                style={{ color: P }}
              >
                <MoreHorizIcon sx={{ fontSize: 22 }} />
              </button>
            )}
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-8 pb-24">

          {/* ── Hero ── */}
          <div className="pt-10 pb-10">
            <div className="flex flex-col sm:flex-row gap-8 items-start">

              {/* Cover art */}
              <div
                className="shrink-0 mx-auto sm:mx-0 rounded-2xl overflow-hidden"
                style={{
                  width: COVER_H,
                  height: COVER_H,
                  background: GR,
                }}
              >
                {playlist.coverURL ? (
                  <img
                    src={playlist.coverURL}
                    alt={playlist.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <LibraryMusicIcon className="text-white/80" sx={{ fontSize: 84 }} />
                  </div>
                )}
              </div>

              {/* Info panel */}
              <HeroInfoPanel
                title={playlist.name}
                subtitle={isOwner ? "Your Playlist" : "Playlist"}
                description={description}
                meta={
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1">
                      {playlist.isPublic ? (
                        <PublicIcon sx={{ fontSize: 12 }} style={{ color: TEXT_TER }} />
                      ) : (
                        <LockIcon sx={{ fontSize: 12 }} style={{ color: TEXT_TER }} />
                      )}
                      {playlist.isPublic ? "Public" : "Private"}
                    </span>
                    <span className="w-[3px] h-[3px] rounded-full" style={{ background: TEXT_TER }} />
                    <span>
                      {songs.length} {songs.length === 1 ? "song" : "songs"}
                    </span>
                    <span className="w-[3px] h-[3px] rounded-full" style={{ background: TEXT_TER }} />
                    <span>{totalMins} min</span>
                    {createdDate && (
                      <>
                        <span className="w-[3px] h-[3px] rounded-full" style={{ background: TEXT_TER }} />
                        <span>{createdDate}</span>
                      </>
                    )}
                  </div>
                }
                actions={
                  <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto mt-4 sm:mt-0">
                    <div className="flex w-full gap-2 sm:w-auto">
                      <PillBtn
                        onClick={handlePlayAll}
                        disabled={songs.length === 0}
                        style={{ background: P }}
                        onMouseEnter={(e) => {
                          if (songs.length > 0) e.currentTarget.style.background = PH;
                        }}
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
                        onMouseEnter={(e) => {
                          if (songs.length > 0) e.currentTarget.style.background = HOVER_ROW;
                        }}
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
          {songs.length > 0 ? (
            <div
              className="overflow-hidden"
              style={{
                background: "transparent",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
              }}
            >
              {/* Desktop Header */}
              <div
                className="hidden sm:grid items-center h-11 px-0 border-b"
                style={{ borderColor: BORDER, gridTemplateColumns: TABLE_COLS }}
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

              {songs.map((song, i) => {
                const rowMenuOpen = activeMenu?.songId === song.id;

                return (
                  <div
                    key={song.id}
                    onClick={() => playTrack(tracks[i], tracks)}
                    className="group cursor-pointer transition-colors"
                    style={{ background: rowMenuOpen ? "rgba(255,255,255,0.06)" : undefined }}
                    onMouseEnter={(e) => {
                      if (!rowMenuOpen) e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                    }}
                    onMouseLeave={(e) => {
                      if (!rowMenuOpen) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {/* ── Mobile row ── */}
                    <div
                      className="flex sm:hidden items-center gap-3 px-2 h-[64px] border-b"
                      style={{ borderColor: BORDER }}
                    >
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

                      <div className="flex-1 min-w-0">
                        <p className="truncate text-[13px]" style={{ color: TEXT_PRI }}>
                          {song.title}
                        </p>
                        <p className="truncate text-[12px] mt-0.5" style={{ color: TEXT_SEC }}>
                          {song.artist}
                        </p>
                      </div>

                      <button
                        onClick={(e) => handleOpenMenu(e, song)}
                        aria-label={`More options for ${song.title}`}
                        aria-expanded={rowMenuOpen}
                        aria-haspopup="menu"
                        className="flex items-center justify-center shrink-0 w-11 h-11 transition-all duration-200"
                        style={{ color: "#fa243c" }}
                      >
                        <MoreHorizIcon sx={{ fontSize: 22 }} />
                      </button>
                    </div>

                    {/* ── Desktop row ── */}
                    <div
                      className="hidden sm:grid items-center h-[56px] px-1 border-b"
                      style={{ borderColor: BORDER, gridTemplateColumns: TABLE_COLS }}
                    >
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

                      <div className="truncate pr-4 text-[13px]" style={{ color: TEXT_SEC }}>
                        {song.artist}
                      </div>

                      <div className="hidden lg:block truncate pr-4 text-[13px]" style={{ color: TEXT_SEC }}>
                        {song.album || "—"}
                      </div>

                      <div className="text-right text-[12px] tabular-nums" style={{ color: TEXT_TER }}>
                        {fmtDur(song.duration)}
                      </div>

                      <button
                        onClick={(e) => handleOpenMenu(e, song)}
                        aria-label={`More options for ${song.title}`}
                        aria-expanded={rowMenuOpen}
                        aria-haspopup="menu"
                        className="flex items-center justify-center pl-2 transition-colors duration-200 hover:text-[#fa243c]"
                        style={{ background: "transparent", opacity: rowMenuOpen ? 1 : undefined, color: "#fa243c" }}
                      >
                        <MoreHorizIcon sx={{ fontSize: 16 }} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ── Empty state ── */
            <div
              className="flex flex-col items-center py-20 text-center rounded-2xl border"
              style={{ background: "transparent", borderColor: BORDER }}
            >
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
                style={{ background: "rgba(255,255,255,0.07)" }}
              >
                <LibraryMusicIcon sx={{ fontSize: 36 }} style={{ color: TEXT_TER }} />
              </div>
              <h3 className="text-[15px] font-semibold mb-1.5" style={{ color: TEXT_PRI }}>
                No songs yet
              </h3>
              <p className="text-[13px]" style={{ color: TEXT_SEC }}>
                Add songs to this playlist from the home screen
              </p>
            </div>
          )}
        </div>

        {/* ── Floating context menu (portal, fixed position) ── */}
        {activeMenu && (
          <SongContextMenu
            menu={activeMenu}
            isLiked={likedSongIds.has(activeMenu.songId)}
            isToggling={togglingLike.has(activeMenu.songId)}
            onLikeToggle={handleLikeToggle}
            onClose={handleCloseMenu}
          />
        )}

        {/* ── Playlist header options menu (portal, fixed position) ── */}
        {playlistMenuAnchor && (
          <PlaylistOptionsMenu
            anchorEl={playlistMenuAnchor}
            isPublic={!!playlist.isPublic}
            onTogglePublic={togglePublic}
            onRequestDelete={() => setShowDeleteDialog(true)}
            onClose={handleClosePlaylistMenu}
          />
        )}
      </div>

      {showDeleteDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
          role="alertdialog"
          aria-modal="true"
        >
          {/* backdrop — matches LoginPage exactly */}
          <div
            className="absolute inset-0 animate-in fade-in duration-200"
            style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
            onClick={() => setShowDeleteDialog(false)}
            aria-hidden="true"
          />

          {/* pop card */}
          <div
            className="relative w-full max-w-[320px] rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            style={{
              background: "rgba(31, 31, 31, 0.55)", // #1f1f1f translucent glass tint

              backdropFilter: "blur(30px) saturate(180%) brightness(1.05)",
              WebkitBackdropFilter: "blur(30px) saturate(180%) brightness(1.05)",

              border: "1px solid rgba(255,255,255,0.06)",

              boxShadow: `
          inset 0 1px 0 rgba(255,255,255,0.08),
          inset 0 -1px 0 rgba(255,255,255,0.02),
          0 12px 40px rgba(0,0,0,0.35)
        `,
            }}
          >
            <div className="flex flex-col items-center text-center px-6 pt-4 pb-5">
              <p
                className="text-[16px] font-semibold leading-snug mb-1"
                style={{ color: "#f5f5f7" }}
              >
                {/* Delete playlist? */}
                <DeleteRounded sx={{fontSize: 28}}/>
              </p>
              <p
                className="text-[13px] mt-2 leading-snug"
                style={{ color: "rgba(245,245,247,0.65)" }}
              >
                This playlist will be permanently deleted. This action cannot be undone.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                handleDelete();
                setShowDeleteDialog(false);
              }}
              className="w-full py-3 text-[15px] font-semibold transition-colors duration-150"
              style={{
                color: "#ff453a",
                borderTop: "1px solid rgba(255,255,255,0.08)",
                backgroundColor: "transparent",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.06)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              Delete playlist
            </button>

            <button
              type="button"
              onClick={() => setShowDeleteDialog(false)}
              className="w-full py-3 text-[15px] font-semibold transition-colors duration-150"
              style={{
                color: "#f5f5f7",
                borderTop: "1px solid rgba(255,255,255,0.08)",
                backgroundColor: "transparent",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.06)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlaylistPage;