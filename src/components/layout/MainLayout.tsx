/**
 * @fileoverview Primary layout wrapper for authenticated Premix pages.
 *
 * Layout architecture:
 * - --sidebar-inset: single source of truth for desktop sidebar width.
 * - --bottom-inset: single source of truth for reserved bottom UI
 *   (PlayerBar + MobileNav).
 *
 * All page content automatically reserves enough scrollable space so the
 * last item is never hidden beneath the PlayerBar or MobileNav.
 */

import { Outlet } from "react-router-dom";
import { useState, useMemo } from "react";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import PlayerBar from "@/features/player/components/PlayerBar";
import { useResponsive } from "./hooks/useResponsive";
import { usePlayer } from "@/features/player/hooks/usePlayer";
import { SIDEBAR_WIDTH_PX } from "./hooks/layout.constants";

const AMBIENT_BG = `
linear-gradient(
  180deg,
  rgba(42,42,44,0.92) 0%,
  rgba(31,31,31,0.88) 45%,
  rgba(22,22,24,0.92) 100%
)
`;

/**
 * Layout tokens
 * Keep these synced with the actual rendered component heights.
 */
const MOBILE_NAV_HEIGHT = 68;
const PLAYER_BAR_HEIGHT = 84;
const EXTRA_SCROLL_PADDING = 20;

const MainLayout = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { showMobileNav, showDesktopSidebar } = useResponsive();

  const { currentTrack } = usePlayer();

  const hasPlayer = Boolean(currentTrack);

  /**
   * Reserved space at bottom of scroll container.
   */
  const bottomInset = useMemo(() => {
    if (showMobileNav) {
      return hasPlayer
        ? MOBILE_NAV_HEIGHT + PLAYER_BAR_HEIGHT
        : MOBILE_NAV_HEIGHT;
    }

    return hasPlayer ? PLAYER_BAR_HEIGHT : 0;
  }, [showMobileNav, hasPlayer]);

  const rootStyle: React.CSSProperties = {
    background: AMBIENT_BG,

    ["--sidebar-inset" as string]: showDesktopSidebar
      ? `${SIDEBAR_WIDTH_PX}px`
      : "0px",

    ["--bottom-inset" as string]: `${bottomInset}px`,
  };

  return (
    <div
      className="relative h-dvh w-full overflow-hidden"
      style={rootStyle}
    >
      <main
        className="
          absolute inset-0
          z-10
          h-full
          w-full
          overflow-y-auto
          overflow-x-hidden
          overscroll-contain
          scroll-smooth
        "
        style={{
          paddingBottom: `calc(
            var(--bottom-inset)
            + env(safe-area-inset-bottom, 0px)
            + ${EXTRA_SCROLL_PADDING}px
          )`,
        }}
      >
        <Outlet />
      </main>

      {showDesktopSidebar ? (
        <Sidebar />
      ) : (
        <Sidebar
          isMobile
          isMobileMenuOpen={isMobileMenuOpen}
          onMobileMenuClose={() => setIsMobileMenuOpen(false)}
        />
      )}

      <div
        className="fixed bottom-0 z-40"
        style={{
          left: "var(--sidebar-inset)",
          right: 0,
        }}
      >
        <PlayerBar />
      </div>

      {showMobileNav && <MobileNav />}
    </div>
  );
};

export default MainLayout;