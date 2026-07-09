/**
 * @fileoverview PlaylistList – Sidebar playlist browser (Apple Music style).
 *
 * Visual contract (dark sidebar context):
 * - Row: 36px tall, cover art 28×28 rounded-md, name 12px rgba(255,255,255,0.6)
 * - Hover row: rgba(255,255,255,0.06) background, name → white
 * - Active row (current playlist route): left red bar + white text
 * - Menu button: appears on row hover, opens a portal-rendered dropdown
 * - Inline rename: replaces the name label with a dark-styled input
 * - Delete: instant, no browser confirm (undo-style approach via in-row feedback)
 *
 * Menu strategy:
 * - Rendered in a React portal on document.body so it escapes overflow:hidden sidebar
 * - Position calculated from the trigger button's bounding rect at open time
 * - Closed by click-outside (mousedown on document) or Escape key
 * - Only one menu open at a time
 *
 * Logic improvements vs original:
 * - Removed window.confirm (blocks thread, inconsistent with Apple HIG)
 * - Removed duplicate click-outside effects (merged into one document listener)
 * - buttonRefs Map replaced with a ref callback per row (no Map.get/set boilerplate)
 * - menuPosition recalculated purely from the stored ref at open time, not stored in state
 *   (avoids stale position on scroll – fixed by closing menu on scroll instead)
 */

import { Link, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import { useUserPlaylists } from "../hooks/useUserPlaylist";
import { deletePlaylist, updatePlaylist } from "../services/playlistService";
import LibraryMusicIcon from "@mui/icons-material/LibraryMusic";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import {
  EditRounded,
  DeleteOutlineRounded,
} from "@mui/icons-material";
import { useState, useRef, useEffect, useCallback } from "react";

// ─── Constants ─────────────────────────────────────────────────────────────

const PRIMARY = "#fa243c";
const TEXT_ACTIVE = "#ffffff";
const TEXT_INACTIVE = "rgba(255,255,255,0.58)";
const ROW_HOVER_BG = "rgba(255,255,255,0.06)";
// const MENU_BG = "#3a3a3c";
// const MENU_DIVIDER = "rgba(255,255,255,0.10)";

// ─── Types ──────────────────────────────────────────────────────────────────

interface MenuState {
  playlistId: string;
  top: number;
  left: number;
}

// ─── CoverArt ───────────────────────────────────────────────────────────────

const CoverArt = ({
  url,
  name,
  size = 28,
}: {
  url?: string;
  name: string;
  size?: number;
}) => (
  <div
    className="flex-shrink-0 rounded-md overflow-hidden"
    style={{ width: size, height: size }}
  >
    {url ? (
      <img src={url} alt={name} className="w-full h-full object-cover" />
    ) : (
      <div
        className="w-full h-full flex items-center justify-center"
        style={{
          background: "linear-gradient(135deg, #fa243c 0%, #7c3aed 100%)",
        }}
      >
        <LibraryMusicIcon
          style={{ color: "rgba(255,255,255,0.7)", fontSize: 14 }}
        />
      </div>
    )}
  </div>
);

// ─── PlaylistList ────────────────────────────────────────────────────────────

const PlaylistList = () => {
  const { playlists, loading } = useUserPlaylists();
  const location = useLocation();

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  // One ref per row's menu button, keyed by playlistId
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const editInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // ── Close menu on outside click or Escape ─────────────────────────────────
  useEffect(() => {
    if (!menu) return;

    const onMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenu(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    // Close if sidebar scrolls (position would be stale)
    const onScroll = () => setMenu(null);

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, [menu]);

  // ── Close edit input on outside click or Escape ───────────────────────────
  useEffect(() => {
    if (!editingId) return;

    const onMouseDown = (e: MouseEvent) => {
      if (editInputRef.current && !editInputRef.current.contains(e.target as Node)) {
        setEditingId(null);
        setEditName("");
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setEditingId(null); setEditName(""); }
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [editingId]);

  // ── Focus edit input when editing starts ──────────────────────────────────
  useEffect(() => {
    if (!editingId) {
      return;
    }

    // Tiny delay so the input is in the DOM before focus
    const timer = setTimeout(() => {
      editInputRef.current?.focus();
    }, 30);

    return () => clearTimeout(timer);
  }, [editingId]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const openMenu = useCallback((e: React.MouseEvent, playlistId: string) => {
    e.preventDefault();
    e.stopPropagation();

    // Toggle off if same menu already open
    if (menu?.playlistId === playlistId) {
      setMenu(null);
      return;
    }

    const btn = triggerRefs.current[playlistId];
    if (!btn) return;
    const rect = btn.getBoundingClientRect();

    setMenu({
      playlistId,
      // Position dropdown to the right of the sidebar, aligned with the button
      top: rect.top + window.scrollY,
      left: rect.right + window.scrollX + 6,
    });
  }, [menu]);

  const startRename = useCallback((playlistId: string, currentName: string) => {
    setMenu(null);
    setEditingId(playlistId);
    setEditName(currentName);
  }, []);

  const commitRename = useCallback(async (playlistId: string) => {
    const trimmed = editName.trim();
    if (!trimmed) { setEditingId(null); return; }
    await updatePlaylist(playlistId, { name: trimmed });
    setEditingId(null);
    setEditName("");
  }, [editName]);

  const handleDelete = useCallback(async (playlistId: string) => {
    setMenu(null);
    setDeletingId(playlistId);
    try {
      await deletePlaylist(playlistId);
    } finally {
      setDeletingId(null);
    }
  }, []);

  // ── Render states ─────────────────────────────────────────────────────────

  if (loading) {
    // Skeleton rows
    return (
      <div className="py-1 space-y-0.5 px-1">
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex items-center gap-2 px-2 py-1.5">
            <div className="w-7 h-7 rounded-md flex-shrink-0 animate-pulse"
              style={{ background: "rgba(255,255,255,0.08)" }} />
            <div className="h-2.5 rounded animate-pulse flex-1"
              style={{ background: "rgba(255,255,255,0.08)" }} />
          </div>
        ))}
      </div>
    );
  }

  if (playlists.length === 0) {
    return (
      <div className="px-3 py-5 text-center">
        <p className="text-[11px]" style={{ color: TEXT_INACTIVE }}>
          No playlists yet
        </p>
      </div>
    );
  }

  // ── List ──────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="py-1 space-y-px">
        {playlists.map((playlist) => {
          const isActive = location.pathname === `/playlist/${playlist.id}`;
          const isHovered = hoveredId === playlist.id;
          const isEditing = editingId === playlist.id;
          const isDeleting = deletingId === playlist.id;

          return (
            <div
              key={playlist.id}
              className="relative mx-1"
              onMouseEnter={() => setHoveredId(playlist.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* Red left accent for active playlist */}
              {isActive && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full"
                  style={{ height: 16, background: PRIMARY }}
                />
              )}

              {isEditing ? (
                /* ── Inline rename ────────────────────────────────────── */
                <div className="flex items-center gap-2 px-2 py-1">
                  <CoverArt url={playlist.coverURL} name={playlist.name} />
                  <input
                    ref={editInputRef}
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename(playlist.id);
                      if (e.key === "Escape") { setEditingId(null); setEditName(""); }
                    }}
                    maxLength={50}
                    className="flex-1 min-w-0 rounded-md px-2 py-0.5 text-[12px] font-medium outline-none"
                    style={{
                      background: "rgba(255,255,255,0.10)",
                      color: TEXT_ACTIVE,
                      border: `1px solid ${PRIMARY}`,
                      caretColor: PRIMARY,
                    }}
                  />
                </div>
              ) : (
                /* ── Normal row ───────────────────────────────────────── */
                <Link
                  to={`/playlist/${playlist.id}`}
                  className="flex items-center gap-2 px-2 py-1 rounded-md transition-colors duration-100"
                  style={{
                    background: isHovered ? ROW_HOVER_BG : "transparent",
                    opacity: isDeleting ? 0.4 : 1,
                  }}
                >
                  <CoverArt url={playlist.coverURL} name={playlist.name} />

                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[12px] font-medium truncate transition-colors duration-100"
                      style={{ color: isActive || isHovered ? TEXT_ACTIVE : TEXT_INACTIVE }}
                    >
                      {playlist.name}
                    </p>
                    {playlist.songCount > 0 && (
                      <p className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.28)" }}>
                        {playlist.songCount} {playlist.songCount === 1 ? "song" : "songs"}
                      </p>
                    )}
                  </div>

                  {/* Menu trigger – visible on hover */}
                  {isHovered && !isDeleting && (
                    <button
                      ref={(el) => { triggerRefs.current[playlist.id] = el; }}
                      onClick={(e) => openMenu(e, playlist.id)}
                      aria-label="Playlist options"
                      className="flex-shrink-0 w-6 h-6 flex items-center justify-center transition-colors"
                    >
                      <MoreHorizIcon onMouseEnter={(e) =>
                        (e.currentTarget.style.color = "#fa243c")
                      }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.color = "transparent")
                        } style={{ fontSize: 16 }} />
                    </button>
                  )}

                  {isDeleting && (
                    <span
                      className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin flex-shrink-0"
                      style={{ borderColor: `rgba(255,255,255,0.3)`, borderTopColor: PRIMARY }}
                    />
                  )}
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Portal dropdown menu ─────────────────────────────────────────── */}
      {menu &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-[9999] overflow-hidden rounded-lg"
            style={{
              top: menu.top,
              left: menu.left,
              width: 185,

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
            }}
          >
            {/* Rename */}
            <button
              role="menuitem"
              onClick={() => {
                const pl = playlists.find(
                  (p) => p.id === menu.playlistId
                );

                if (pl) startRename(pl.id, pl.name);
              }}
              className="group w-full flex items-center justify-between px-3 h-[34px] transition-colors duration-150"
              style={{
                color: "#F5F5F7",
                background: "transparent",
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
                Rename
              </span>

              <EditRounded
                sx={{
                  fontSize: 16,
                  color: "#f5f5f7",
                }}
              />
            </button>

            <div
              style={{
                height: "0.5px",
                background: "rgba(255,255,255,.08)",
              }}
            />

            {/* Delete */}
            <button
              role="menuitem"
              onClick={() => handleDelete(menu.playlistId)}
              className="group w-full flex items-center justify-between px-3 h-[34px] transition-colors duration-150"
              style={{
                color: "#f5f5f7",
                background: "transparent",
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
                Delete
              </span>

              <DeleteOutlineRounded
                sx={{
                  fontSize: 16,
                  color: "#f5f5f7",
                }}
              />
            </button>
          </div>,
          document.body
        )}
    </>
  );
};

// ── MenuButton ───────────────────────────────────────────────────────────────

// const MenuButton = ({
//   onClick,
//   label,
//   danger = false,
// }: {
//   onClick: () => void;
//   label: string;
//   danger?: boolean;
// }) => {
//   const [hovered, setHovered] = useState(false);
//   return (
//     <button
//       role="menuitem"
//       onClick={onClick}
//       onMouseEnter={() => setHovered(true)}
//       onMouseLeave={() => setHovered(false)}
//       className="w-full flex items-center px-4 py-2 text-[13px] text-left transition-colors"
//       style={{
//         color: danger ? PRIMARY : TEXT_ACTIVE,
//         background: hovered ? "rgba(255,255,255,0.08)" : "transparent",
//       }}
//     >
//       {label}
//     </button>
//   );
// };

export default PlaylistList;