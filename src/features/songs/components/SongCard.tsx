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
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import CheckIcon from "@mui/icons-material/Check";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import { PlayArrowRounded, StarBorderRounded, StarRounded } from "@mui/icons-material";

// Apple Music Design System
const APPLE_RED = "#fa243c";
// const BG_DARK = "#0f0f10";
// const SURFACE = "rgba(255,255,255,0.04)";
const GLASS_SURFACE = "rgba(255,255,255,0.06)";
const HOVER_SURFACE = "rgba(255,255,255,0.10)";
const BORDER = "rgba(255,255,255,0.08)";
// const STRONG_BORDER = "rgba(255,255,255,0.12)";
const PRIMARY_TEXT = "rgba(255,255,255,0.92)";
const SECONDARY_TEXT = "rgba(255,255,255,0.60)";
const MUTED_TEXT = "rgba(255,255,255,0.45)";

interface Props {
  track: ISong;
  songs: ISong[];
  variant?: "default" | "compact" | "playlist";
  index?: number;
  disableLike?: boolean;
}

interface MenuRowProps {
  icon: React.ReactNode;
  iconCls?: string;
  label: string;
  right?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

const MenuRowLight = memo(
  ({ icon, iconCls = "", label, right, danger = false, disabled = false, onClick }: MenuRowProps) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-between w-full px-3 transition-all duration-150 text-left"
      style={{
        height: 34,
        color: "#f5f5f7",
        background: "transparent",
        border: "none",
        cursor: disabled ? "default" : "pointer",
        fontSize: 13,
        fontWeight: 400,
        opacity: disabled ? 0.45 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = HOVER_SURFACE;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <span
        className="flex-1 truncate"
        style={{
          fontSize: 13,
          fontWeight: 400,
          letterSpacing: "-0.1px",
          color: "#f5f5f7",
        }}
      >
        {label}
      </span>

      <span
        className={`flex items-center shrink-0 ${iconCls}`}
        style={{ color: danger ? APPLE_RED : MUTED_TEXT, marginLeft: 8 }}
      >
        {right ?? icon}
      </span>
    </button>
  ),
);

MenuRowLight.displayName = "MenuRowLight";

interface ContextMenuProps {
  track: ISong;
  isLiked: boolean;
  onToggleLike: () => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  disableLike: boolean;
}

const ContextMenu = memo(
  ({
    track,
    isLiked,
    onToggleLike,
    onClose,
    anchorRef,
    disableLike,
  }: ContextMenuProps) => {
    const { playlists } = usePlaylists();
    const [activeMenu, setActiveMenu] = useState<"main" | "playlists">("main");
    const [addedId, setAddedId] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ top: 0, left: 0, ready: false });

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

        let left = btn.right + 8;
        let top = btn.top;

        if (left + mw > vw - 8) {
          left = btn.left - mw - 8;
          if (left < 8) {
            left = Math.max(8, (vw - mw) / 2);
          }
        }

        if (top + mh > vh - 8) {
          top = vh - mh - 8;
        }
        if (top < 8) {
          top = 8;
        }

        setPos({ top, left, ready: true });
      };

      const timer = setTimeout(updatePosition, 10);
      return () => clearTimeout(timer);
    }, [anchorRef, activeMenu]);

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

    useEffect(() => {
      const handler = (e: MouseEvent) => {
        if (menuRef.current?.contains(e.target as Node)) return;
        if (anchorRef.current?.contains(e.target as Node)) return;
        onClose();
      };

      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }, [onClose, anchorRef]);

    const handleAddToPlaylist = useCallback(
      async (playlistId: string) => {
        try {
          setAddedId(playlistId);
          await addSongToPlaylist(playlistId, iSongToPlaylistSong(track));
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
        <style>{`
          @keyframes menuPop {
            from { opacity: 0; transform: scale(0.96) translateY(-4px); }
            to   { opacity: 1; transform: scale(1) translateY(0); }
          }
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(6px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          .glass-scroll::-webkit-scrollbar {
            width: 3px;
          }
          .glass-scroll::-webkit-scrollbar-track {
            background: transparent;
          }
          .glass-scroll::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,0.15);
            border-radius: 999px;
          }
          .glass-scroll::-webkit-scrollbar-thumb:hover {
            background: rgba(255,255,255,0.25);
          }
        `}</style>

        <div
          ref={menuRef}
          className="fixed z-[9999] rounded-xl overflow-hidden glass-scroll"
          style={{
            width: Math.min(200, window.innerWidth - 32),
            top: pos.top,
            left: pos.left,
            opacity: pos.ready ? 1 : 0,

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

            transition: "opacity 0.2s ease",
          }}
        >
          {activeMenu === "main" && (
            <div style={{ animation: pos.ready ? "slideUp .18s cubic-bezier(.2,.8,.2,1)" : "none" }}>
              {/* Song identity header */}
              <div style={{ padding: "8px 12px" }}>
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 400,
                    color: "#f5f5f7",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {track.title}
                </p>
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 400,
                    color: "MUTED_TEXT",
                    marginTop: 1,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {track.artist}
                </p>
              </div>

              <div style={{ height: 0.5, background: BORDER }} />

              <MenuRowLight
                label="Add to Playlist"
                icon={<PlaylistAddIcon sx={{ fontSize: 17, color: "#f5f5f7" }} />}
                onClick={() => setActiveMenu("playlists")}
              />

              {!disableLike && (
                <>
                  <div style={{ height: 0.5, background: BORDER }} />
                  <MenuRowLight
                    label={isLiked ? "Remove Favorite" : "Add Favorite"}
                    danger={isLiked}
                    icon={
                      isLiked ? (
                        <StarRounded sx={{ fontSize: 16 }} style={{ color: APPLE_RED }} />
                      ) : (
                        <StarBorderRounded sx={{ fontSize: 16 }} />
                      )
                    }
                    onClick={() => {
                      onToggleLike();
                      onClose();
                    }}
                  />
                </>
              )}
            </div>
          )}

          {activeMenu === "playlists" && (
            <div style={{ animation: pos.ready ? "slideUp .18s cubic-bezier(.2,.8,.2,1)" : "none" }}>
              <button
                onClick={() => setActiveMenu("main")}
                className="flex items-center gap-1 w-full px-3 transition-colors"
                style={{ height: 34, color: APPLE_RED, fontSize: 13, fontWeight: 400 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = HOVER_SURFACE)}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <ChevronLeftIcon sx={{ fontSize: 16 }} />
                <span className="mb-[1.5px] ">Back</span>
              </button>

              <div style={{ height: 0.5, background: BORDER }} />

              {playlists.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-5">
                  <LibraryMusicIcon sx={{ fontSize: 20 }} style={{ color: "#f5f5f7" }} />
                  <p style={{ fontSize: 12, color: "#f5f5f7" }}>No playlists yet</p>
                </div>
              ) : (
                <div className="max-h-52 overflow-y-auto glass-scroll">
                  {playlists.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleAddToPlaylist(p.id)}
                      className="flex items-center justify-between gap-2 w-full px-3 transition-colors"
                      style={{ height: 34, color: "#f5f5f7" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = HOVER_SURFACE)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <span
                        className="flex-1 text-left truncate"
                        style={{ fontSize: 13, fontWeight: 400, letterSpacing: "-0.1px" }}
                      >
                        {p.name}
                      </span>

                      {addedId === p.id ? (
                        <CheckIcon sx={{ fontSize: 15 }} style={{ color: APPLE_RED }} />
                      ) : (
                        <LibraryMusicIcon sx={{ fontSize: 14 }} style={{ color: "#f5f5f7" }} />
                      )}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ height: 0.5, background: BORDER }} />

              <button
                onClick={() => {
                  onClose();
                  setActiveMenu("main");
                }}
                className="flex items-center justify-between w-full px-3 transition-colors"
                style={{ height: 34, color: APPLE_RED, fontSize: 13, fontWeight: 400 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = HOVER_SURFACE)}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span className="flex-1 text-left">New Playlist</span>
                <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
              </button>
            </div>
          )}
        </div>
      </>,
      document.body,
    );
  },
);

ContextMenu.displayName = "ContextMenu";

const EqBars = memo(() => (
  <div className="flex items-end gap-px h-3.5">
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        className="w-[3px] rounded-sm"
        style={{
          background: APPLE_RED,
          animation: "eqBar 0.7s ease-in-out infinite alternate",
          animationDelay: `${i * 0.15}s`,
        }}
      />
    ))}
    <style>{`
      @keyframes eqBar {
        0%, 100% { height: 25%; }
        50% { height: 100%; }
      }
    `}</style>
  </div>
));

EqBars.displayName = "EqBars";

const SongCard = memo(
  ({
    track,
    songs,
    variant = "default",
    index,
    disableLike = false,
  }: Props) => {
    const { playTrack } = usePlayer();
    const { isLiked, toggleLike } = useLike(track.id);
    const [isHovered, setIsHovered] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const moreButtonRef = useRef<HTMLButtonElement>(null);

    const handlePlay = useCallback(() => {
      playTrack(track, songs);
    }, [playTrack, track, songs]);

    const active = isHovered || isMenuOpen;

    // ==================== VARIANT: DEFAULT (GRID CARD) ====================
    if (variant === "default") {
      return (
        <div
          className="relative w-full select-none"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className="relative w-full aspect-square rounded-md overflow-hidden cursor-pointer"
          >
            <img
              src={track.coverUrl || "/default-album.jpg"}
              alt={track.title}
              className="w-full h-full object-cover block"
              loading="lazy"
              style={{
                boxShadow: active
                  ? "0 16px 32px rgba(0,0,0,0.4)"
                  : "0 8px 16px rgba(0,0,0,0.3)",
                transition: "box-shadow 0.2s ease",
              }}
            />

            <div
              className="absolute inset-0 transition-opacity duration-200"
              style={{
                background: active ? "rgba(0,0,0,0.35)" : "transparent",
              }}
            />

            <button
              onClick={handlePlay}
              className="absolute bottom-3 sm:bottom-[10px] left-2 flex items-center justify-center rounded-full transition-all duration-200"
              style={{
                width: 30,
                height: 30,
                opacity: active ? 1 : 0,
                transform: `translateY(${active ? 0 : "6px"}) scale(${active ? 1 : 0.9})`,
                background: "rgba(0,0,0,0.4)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
              }}
              aria-label="Play song"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#fa243c";
                // e.currentTarget.style.transform = "scale(1.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(0,0,0,0.4)";
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              <PlayArrowRounded
                sx={{
                  fontSize: 24,
                  color: "#fff",
                  marginLeft: "1px",
                }}
              />

            </button>

            <button
              ref={moreButtonRef}
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen((v) => !v);
              }}
              className="absolute bottom-3.5 sm:bottom-2.5 right-2 rounded-full flex items-center justify-center transition-all duration-200"
              style={{
                width: 30,
                height: 30,
                background: "rgba(0,0,0,0.4)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                opacity: active ? 1 : 0,
                transform: `translateY(${active ? 0 : "6px"}) scale(${active ? 1 : 0.9})`,
                boxShadow: isMenuOpen ? `0 0 20px ${APPLE_RED}30` : "0 4px 12px rgba(0,0,0,0.3)",
              }}
              aria-label="More options"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#fa243c";
                // e.currentTarget.style.transform = "scale(1.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(0,0,0,0.4)";
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              <MoreHorizIcon
                sx={{ fontSize: { xs: 16, sm: 20 }, color: "white" }}
              />
            </button>
          </div>

          <div className="mt-3 px-0.5">
            <p className="text-[13px] font-medium truncate leading-tight" style={{ color: PRIMARY_TEXT }}>
              {track.title}
            </p>
            <p className="text-[12px] truncate mt-0.5" style={{ color: SECONDARY_TEXT }}>
              {track.artist}
            </p>
          </div>

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

    // ==================== VARIANT: COMPACT ====================
    if (variant === "compact") {
      return (
        <div
          className="group flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-all duration-150"
          style={{
            background: isHovered ? GLASS_SURFACE : "transparent",
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0">
            <img
              src={track.coverUrl || "/default-album.jpg"}
              alt={track.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />

            <div
              className="absolute inset-0 flex items-center justify-center transition-opacity duration-150"
              style={{
                background: "rgba(0,0,0,0.4)",
                opacity: isHovered ? 1 : 0,
                backdropFilter: "blur(4px)",
                WebkitBackdropFilter: "blur(4px)",
              }}
            >
              <button
                onClick={handlePlay}
                className="text-white transition-transform duration-200"
                style={{
                  transform: `scale(${isHovered ? 1 : 0.8})`,
                }}
                aria-label="Play song"
              >
                <PlayCircleRoundedIcon
                  sx={{
                    fontSize: 32,
                    color: "#fff",
                  }}
                />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <p className="text-[13px] font-medium truncate tracking-[-0.1px]" style={{ color: PRIMARY_TEXT }}>
              {track.title}
            </p>
            <p className="text-[12px] truncate mt-0.5" style={{ color: SECONDARY_TEXT }}>
              {track.artist}
            </p>
          </div>

          {!disableLike && (
            <button
              onClick={toggleLike}
              className="shrink-0 transition-all duration-150 p-1"
              style={{
                opacity: isHovered || isLiked ? 1 : 0,
                transform: `scale(${isHovered || isLiked ? 1 : 0.85})`,
                color: isLiked ? APPLE_RED : MUTED_TEXT,
              }}
              aria-label={isLiked ? "Remove from favorites" : "Add to favorites"}
            >
              {isLiked ? (
                <FavoriteIcon sx={{ fontSize: 16 }} />
              ) : (
                <FavoriteBorderIcon sx={{ fontSize: 16 }} />
              )}
            </button>
          )}
        </div>
      );
    }

    // ==================== VARIANT: PLAYLIST ====================
    if (variant === "playlist") {
      return (
        <div
          className="group grid items-center gap-3 sm:gap-4 px-3 sm:px-4 py-2.5 rounded-xl transition-all duration-150 cursor-pointer"
          style={{
            gridTemplateColumns: "24px 1fr 1fr 1fr auto",
            background: isHovered ? GLASS_SURFACE : "transparent",
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className="flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 shrink-0">
            {isHovered ? (
              <button
                onClick={handlePlay}
                className="transition-colors"
                style={{ color: SECONDARY_TEXT }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = APPLE_RED;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = SECONDARY_TEXT;
                }}
                aria-label="Play song"
              >
                <PlayCircleIcon sx={{ fontSize: { xs: 16, sm: 20 } }} />
              </button>
            ) : (
              <span className="text-[13px] font-medium tabular-nums" style={{ color: MUTED_TEXT }}>
                {index ?? "•"}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 overflow-hidden">
            <div className="relative w-9 h-9 rounded-md overflow-hidden shrink-0">
              <img
                src={track.coverUrl || "/default-album.jpg"}
                alt={track.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="overflow-hidden">
              <p className="text-[13px] font-medium truncate" style={{ color: PRIMARY_TEXT }}>
                {track.title}
              </p>
              <p className="text-[12px] truncate mt-0.5 sm:hidden" style={{ color: SECONDARY_TEXT }}>
                {track.artist}
              </p>
            </div>
          </div>

          <p className="text-[13px] truncate px-2 hidden sm:block" style={{ color: SECONDARY_TEXT }}>
            {track.artist}
          </p>

          <p className="text-[13px] truncate px-2 hidden lg:block" style={{ color: MUTED_TEXT }}>
            {track.album ?? "—"}
          </p>

          <div className="flex items-center gap-2 sm:gap-3 justify-end">
            {!disableLike && (
              <button
                onClick={toggleLike}
                className="transition-all duration-150"
                style={{
                  opacity: isHovered || isLiked ? 1 : 0,
                  transform: `scale(${isHovered || isLiked ? 1 : 0.85})`,
                  color: isLiked ? APPLE_RED : MUTED_TEXT,
                }}
                aria-label={isLiked ? "Remove from favorites" : "Add to favorites"}
              >
                {isLiked ? (
                  <FavoriteIcon sx={{ fontSize: 15 }} />
                ) : (
                  <FavoriteBorderIcon sx={{ fontSize: 15 }} />
                )}
              </button>
            )}
            <div className="flex items-center gap-1" style={{ color: MUTED_TEXT }}>
              <AccessTimeIcon sx={{ fontSize: 12 }} />
              <span className="text-[12px] tabular-nums">
                {track.duration ?? "3:45"}
              </span>
            </div>
          </div>
        </div>
      );
    }

    return null;
  },
);

SongCard.displayName = "SongCard";

export default SongCard;