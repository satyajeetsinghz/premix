/**
 * @fileoverview Primary navigation sidebar — Apple Music Web Player style (dark).
 *
 * Redesign highlights:
 * - Dark #1c1c1e background matching Apple Music web player
 * - #fc3c44 red accent on active items and Sign In button
 * - SF Pro-style typography with muted #98989d inactive text
 * - Compact playlist rows with small square thumbnails
 * - Pill-style signed-in user profile row at bottom
 * - Thin rgba dividers and subtle hover states
 */

import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import HomeIcon from "@mui/icons-material/Home";
import LibraryMusicIcon from "@mui/icons-material/LibraryMusic";
// import PlaylistPlayIcon from "@mui/icons-material/PlaylistPlay";
import SearchIcon from "@mui/icons-material/Search";
import RadioIcon from "@mui/icons-material/Radio";
import NewReleasesIcon from "@mui/icons-material/NewReleases";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PersonIcon from "@mui/icons-material/Person";
import PlaylistList from "@/features/playlists/components/PlaylistList";
import CreatePlaylistModal from "@/features/playlists/components/CreatePlaylistModal";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useProfile } from "@/features/profile/hooks/useProfile";
import { usePlayer } from "@/features/player/hooks/usePlayer";
import { logoutUser } from "@/features/auth/services/auth.service";
import { LogoutRounded, SettingsRounded } from "@mui/icons-material";

interface SidebarProps {
  isMobile?: boolean;
  isMobileMenuOpen?: boolean;
  onMobileMenuClose?: () => void;
}

interface NavItemProps {
  path: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  onClick?: () => void;
}

const PRIMARY = "#fc3c44";

/**
 * Apple Music dark nav item — white/10 pill on active, muted inactive text.
 */
const NavItem = ({
  path,
  label,
  icon: Icon,
  active,
  onClick,
}: NavItemProps) => (
  <Link
    to={path}
    onClick={onClick}
    className="flex items-center rounded-[8px] select-none"
    style={{
      height: 32,

      paddingLeft: 10,
      paddingRight: 10,

      gap: 10,

      background: active
        ? "rgba(255,255,255,.08)"
        : "transparent",

      color: active
        ? "#fa243c"
        : "rgba(235,235,245,.60)",

      textDecoration: "none",

      transition:
        "background .15s ease, color .15s ease",
    }}
    onMouseEnter={(e) => {
      if (!active) {
        e.currentTarget.style.color =
          "rgba(255,255,255,.88)";
      }
    }}
    onMouseLeave={(e) => {
      if (!active) {
        e.currentTarget.style.color =
          "rgba(235,235,245,.60)";
      }
    }}
  >
    <Icon
      sx={{
        fontSize: 18,
      }}
      style={{
        flexShrink: 0,
        color: active
          ? "#fa243c"
          : "inherit",
      }}
    />

    <span
      style={{
        fontSize: 13,

        fontWeight: 400,

        lineHeight: "18px",

        letterSpacing: "-0.08px",

        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  </Link>
);

const Sidebar = ({
  isMobile = false,
  isMobileMenuOpen = false,
  onMobileMenuClose,
}: SidebarProps) => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { currentTrack } = usePlayer();
  const location = useLocation();
  const navigate = useNavigate();

  const [openModal, setOpenModal] = useState(false);
  const [isPlaylistExpanded, setIsPlaylistExpanded] = useState(true);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Playlist scroll fade tracking
  const playlistScrollRef = useRef<HTMLDivElement>(null);
  const playlistRafRef = useRef(0);
  const [playlistAtTop, setPlaylistAtTop] = useState(true);
  const [playlistAtBottom, setPlaylistAtBottom] = useState(true);

  const measurePlaylistScroll = useCallback(() => {
    const el = playlistScrollRef.current;
    if (!el) return;
    setPlaylistAtTop(el.scrollTop <= 2);
    setPlaylistAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 2);
  }, []);

  const onPlaylistScroll = useCallback(() => {
    if (playlistRafRef.current) return;
    playlistRafRef.current = requestAnimationFrame(() => {
      playlistRafRef.current = 0;
      measurePlaylistScroll();
    });
  }, [measurePlaylistScroll]);

  useEffect(() => {
    measurePlaylistScroll();
  }, [measurePlaylistScroll, isPlaylistExpanded]);

  useEffect(
    () => () => {
      if (playlistRafRef.current) cancelAnimationFrame(playlistRafRef.current);
    },
    [],
  );

  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);

  const isPlayerVisible = !!currentTrack;

  const isAdmin = useMemo(
    () => user?.role === "admin" || profile?.role === "admin",
    [user?.role, profile?.role],
  );

  const isActive = useCallback(
    (path: string) => location.pathname === path,
    [location.pathname],
  );

  // Close mobile drawer on navigation
  useEffect(() => {
    if (isMobile) onMobileMenuClose?.();
  }, [location.pathname]);

  // Click-outside for profile menu
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        profileMenuRef.current?.contains(e.target as Node) ||
        profileButtonRef.current?.contains(e.target as Node)
      ) return;
      setShowProfileMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Escape key for profile menu
  useEffect(() => {
    if (!showProfileMenu) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowProfileMenu(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [showProfileMenu]);

  const handleSignOut = useCallback(async () => {
    setShowProfileMenu(false);
    try {
      await logoutUser();
    } catch (err) {
      console.error("Sign out error:", err);
    }
  }, []);

  const handleProfileClick = useCallback(() => {
    setShowProfileMenu(false);
    if (isMobile) onMobileMenuClose?.();
    navigate("/profile");
  }, [isMobile, onMobileMenuClose, navigate]);

  const handleAdminClick = useCallback(() => {
    setShowProfileMenu(false);
    if (isMobile) onMobileMenuClose?.();
    navigate("/admin");
  }, [isMobile, onMobileMenuClose, navigate]);

  const handleNavClick = useCallback(() => {
    if (isMobile) onMobileMenuClose?.();
  }, [isMobile, onMobileMenuClose]);

  const toggleProfileMenu = useCallback(() => setShowProfileMenu((v) => !v), []);
  const togglePlaylist = useCallback(() => setIsPlaylistExpanded((v) => !v), []);

  const displayName = profile?.name || user?.name || "User";
  const initial = displayName[0]?.toUpperCase() ?? "U";

  /** Small square avatar used in profile row */
  const Avatar = (
    <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden">
      {profile?.photoURL ? (
        <img
          src={profile.photoURL}
          alt={displayName}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center text-white text-[13px] font-semibold"
          style={{ background: PRIMARY }}
        >
          {initial}
        </div>
      )}
    </div>
  );

  const sidebarContent = (
    <div
      className="flex flex-col h-full"
      style={{ paddingBottom: isPlayerVisible ? "0px" : "0px" }}
    >
      {/* ── Logo ── */}
      <div className="flex items-center justify-between px-5 pt-5 pb-7">
        <div className="flex items-center gap-2">
          <img
            src="/logos/premix_music_black_logo.png"
            alt="Premix"
            className="h-6 w-auto object-contain brightness-0 invert"
          />
        </div>
        {isMobile && onMobileMenuClose && (
          <button
            onClick={onMobileMenuClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "#636366" }}
            aria-label="Close menu"
          >
            <CloseIcon sx={{ fontSize: 18 }} />
          </button>
        )}
      </div>

      {/* ── Scroll area ── */}
      <div className="flex-1 overflow-y-auto px-2" style={{ scrollbarWidth: "none" }}>

        {/* Primary nav */}
        <nav className="space-y-0.5 mb-1">
          <NavItem
            path="/search"
            label="Search"
            icon={SearchIcon}
            active={isActive("/search")}
            onClick={handleNavClick}
          />
          <NavItem
            path="/"
            label="Home"
            icon={HomeIcon}
            active={isActive("/")}
            onClick={handleNavClick}
          />
          <NavItem
            path="/new"
            label="New"
            icon={NewReleasesIcon}
            active={isActive("/new")}
            onClick={handleNavClick}
          />
          <NavItem
            path="/radio"
            label="Radio"
            icon={RadioIcon}
            active={isActive("/radio")}
            onClick={handleNavClick}
          />
        </nav>

        {/* Divider */}
        <div className="my-2.5 mx-2" style={{ height: "0.5px", background: "rgba(255,255,255,0.07)" }} />

        {/* Library */}
        <p className="text-[11px] font-medium px-2.5 pb-1 tracking-[0.5px]" style={{ color: "#636366" }}>
          Library
        </p>
        <nav className="space-y-0.5 mb-1">
          <NavItem
            path="/library"
            label="Your Library"
            icon={LibraryMusicIcon}
            active={isActive("/library")}
            onClick={handleNavClick}
          />
        </nav>

        {/* Divider */}
        <div className="my-2.5 mx-2" style={{ height: "0.5px", background: "rgba(255,255,255,0.07)" }} />

        {/* Playlists section */}
        <div className="mb-2">
          {/* Section header */}
          <div className="flex items-center justify-between px-2.5 pb-1">
            <p className="text-[11px] font-medium tracking-[0.5px]" style={{ color: "#636366" }}>
              Playlists
            </p>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setOpenModal(true)}
                className="p-1 rounded transition-colors"
                style={{ color: "#636366" }}
                aria-label="Create playlist"
                onMouseEnter={(e) => (e.currentTarget.style.color = "#98989d")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#636366")}
              >
                <AddIcon sx={{ fontSize: 16 }} />
              </button>
              <button
                onClick={togglePlaylist}
                className="p-1 rounded transition-colors"
                style={{ color: "#636366" }}
                aria-label={isPlaylistExpanded ? "Collapse playlists" : "Expand playlists"}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#98989d")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#636366")}
              >
                {isPlaylistExpanded
                  ? <ExpandLessIcon sx={{ fontSize: 16 }} />
                  : <ExpandMoreIcon sx={{ fontSize: 16 }} />
                }
              </button>
            </div>
          </div>

          {/* Playlist list */}
          {isPlaylistExpanded && (
            <div className="relative">
              <div
                className="pointer-events-none absolute top-0 left-0 right-0 h-4 z-10 transition-opacity duration-150"
                style={{
                  background: "linear-gradient(to bottom, rgba(31,31,31,1), transparent)",
                  opacity: playlistAtTop ? 0 : 1,
                }}
                aria-hidden="true"
              />

              <div
                ref={playlistScrollRef}
                onScroll={onPlaylistScroll}
                className="sidebar-playlist-scroll max-h-44 overflow-y-auto pr-1"
              >
                <PlaylistList />
              </div>

              <div
                className="pointer-events-none absolute bottom-0 left-0 right-0 h-4 z-10 transition-opacity duration-150"
                style={{
                  background: "linear-gradient(to top, rgba(31,31,31,1), transparent)",
                  opacity: playlistAtBottom ? 0 : 1,
                }}
                aria-hidden="true"
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom: Open in Music + Sign In / Profile ── */}
      <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.07)" }}>
        {user ? (
          /* Signed-in profile row */
          <div className="relative px-2 py-2">
            <button
              ref={profileButtonRef}
              onClick={toggleProfileMenu}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors"
              style={{ color: "#f5f5f7" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              aria-haspopup="true"
              aria-expanded={showProfileMenu}
            >
              {Avatar}
              <div className="flex-1 text-left min-w-0">
                <p className="text-[13px] font-medium truncate leading-snug" style={{ color: "#f5f5f7" }}>
                  {displayName}
                </p>
                <p className="text-[11px] truncate leading-tight" style={{ color: "#636366" }}>
                  {user?.email ?? ""}
                </p>
              </div>
              <ExpandMoreIcon
                sx={{ fontSize: 16 }}
                style={{
                  color: "#48484a",
                  transform: showProfileMenu ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s",
                  flexShrink: 0,
                }}
              />
            </button>

            {/* Profile dropdown */}
            {showProfileMenu && (
              <div
                ref={profileMenuRef}
                role="menu"
                className="absolute bottom-full left-10 mb-2 overflow-hidden rounded-lg z-50"
                style={{
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
                {/* View Profile */}
                <button
                  role="menuitem"
                  onClick={handleProfileClick}
                  className="group w-full flex items-center justify-between px-3 h-[34px] transition-colors duration-150"
                  style={{
                    color: "#F5F5F7",
                    background: "transparent",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "rgba(255,255,255,.06)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <span
                    style={{
                      // fontSize: 13,
                      fontWeight: 500,
                    }}
                    className="text-[13px]"
                  >
                    Profile
                  </span>

                  <PersonIcon
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

                {/* Admin */}
                {isAdmin && (
                  <>
                    <button
                      role="menuitem"
                      onClick={handleAdminClick}
                      className="group w-full flex items-center justify-between px-3 h-[34px] transition-colors duration-150"
                      style={{
                        color: "#F5F5F7",
                        background: "transparent",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "rgba(255,255,255,.06)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                    >
                      <span
                        style={{
                          // fontSize: 13,
                          fontWeight: 500,
                        }}
                        className="text-[13px]"
                      >
                        Admin Panel
                      </span>

                      <SettingsRounded
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
                  </>
                )}

                {/* Sign Out */}
                <button
                  role="menuitem"
                  onClick={handleSignOut}
                  className="group w-full flex items-center justify-between px-3 h-[34px] transition-colors duration-150"
                  style={{
                    color: "#F5F5F7",
                    background: "transparent",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "rgba(255,255,255,.06)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <span
                    style={{
                      // fontSize: 13,
                      fontWeight: 500,
                    }}
                    className="text-[13px]"
                  >
                    Sign Out
                  </span>

                  <LogoutRounded
                    sx={{
                      fontSize: 16,
                      color: "#f5f5f7",
                    }}
                  />
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Signed-out state */
          <div className="px-3 pt-3 pb-4">
            <button
              className="w-full flex items-center gap-2 px-3 py-2 mb-2 text-[12px] transition-colors rounded-lg"
              style={{ color: "#636366", background: "transparent" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#98989d")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#636366")}
            >
              <OpenInNewIcon sx={{ fontSize: 14 }} />
              Open in Music
            </button>
            <button
              onClick={() => navigate("/login")}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] font-semibold text-white transition-colors"
              style={{ background: PRIMARY }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#e0333b")}
              onMouseLeave={(e) => (e.currentTarget.style.background = PRIMARY)}
            >
              <PersonIcon sx={{ fontSize: 16 }} />
              Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // Desktop variant
  // Desktop variant
  if (!isMobile) {
    return (
      <>
        <aside
          className="
            hidden xl:flex
            fixed left-0 top-0 z-30
            w-60
            h-[calc(100vh-16px)]
            m-2
            flex-shrink-0
            flex-col
            rounded-2xl
            border border-white/[0.20]
          "
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
          {sidebarContent}
        </aside>
        <CreatePlaylistModal open={openModal} onClose={() => setOpenModal(false)} />
      </>
    );
  }

  // Mobile variant
  return (
    <>
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 xl:hidden"
          style={{
            background: `
    linear-gradient(
      180deg,
      rgba(42,42,44,0.92) 0%,
      rgba(31,31,31,0.88) 45%,
      rgba(22,22,24,0.92) 100%
    )
  `, backdropFilter: "blur(4px)"
          }}
          onClick={onMobileMenuClose}
          aria-hidden="true"
        />
      )}

      <aside
        className="fixed top-0 left-0 bottom-0 w-64 z-50 shadow-2xl transform transition-transform duration-500 ease-in-out xl:hidden overflow-y-auto"
        style={{
          background: "#1f1f1f",
          transform: isMobileMenuOpen ? "translateX(0)" : "translateX(-100%)",
        }}
      >
        {sidebarContent}
      </aside>

      <CreatePlaylistModal open={openModal} onClose={() => setOpenModal(false)} />
    </>
  );
};

export default Sidebar;