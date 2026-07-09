/**
 * @fileoverview User profile page — Apple Music (2026) DARK visual language,
 * wired to this app's real data layer.
 *
 * DESIGN TOKENS (Apple Music dark / glassy)
 * ------------------------------------------------------------------
 * Surfaces
 *   --bg-root       #000000   true-black canvas (Apple Music dark home/library bg)
 *   --bg-elevated   #121214   faint lift for full-bleed sections under the hero
 *   --glass         rgba(28,28,30,0.62) + backdrop-blur(24px) saturate(180%)
 *   --glass-soft    rgba(255,255,255,0.06)  hairline card fill (skeletons, empty state)
 *   --hairline      rgba(255,255,255,0.09)  1px separators / borders
 * Text
 *   --text-primary    #f5f5f7               (systemLabel, dark)
 *   --text-secondary  rgba(235,235,245,0.60) (systemSecondaryLabel, dark)
 *   --text-tertiary   rgba(235,235,245,0.30) (systemTertiaryLabel, dark)
 * Accent
 *   --accent        #fc3c44   Apple Music red, dark-mode variant
 *   --accent-hover   #ff6961
 *   --accent-gradient linear-gradient(135deg,#fa2d48 0%,#c644fc 100%) — editorial
 *                      fallback artwork gradient, matches MusicKit "For You" tiles
 *   --focus-ring     #0a84ff  system blue focus ring (unchanged across appearances)
 * Type
 *   -apple-system / BlinkMacSystemFont / "SF Pro Display" / "SF Pro Text" stack
 *   (renders as real SF Pro on Apple platforms, closest system match elsewhere)
 * ------------------------------------------------------------------
 *
 * BREAKOUT ARCHITECTURE (matches HomePage / FeaturedBanner exactly)
 * ------------------------------------------------------------------
 * "Playlists" and "Listening To" reach full width via a real breakout:
 * the OUTSIDE root cancels the page's `--sidebar-inset` with a negative
 * margin + compensating width (`BREAKOUT_STYLE`), then the header/track
 * re-add that same offset via `LEFT_GUTTER` padding on themselves — the
 * same two-step cancel/re-add FeaturedBanner does with `trackGutter`.
 * Net effect: the scrollable track's box physically spans the true
 * viewport width (reclaiming the sidebar's width for scrolling), while
 * the title and first card still visually start at the same x-position
 * as the hero above them. Loading skeletons and the empty state are
 * rendered by ScrollSection itself (`state="loading" | "empty" | "content"`)
 * so there's exactly one place that owns the gutter math.
 * ------------------------------------------------------------------
 *
 * MENU PORTAL FIX (this pass)
 * ------------------------------------------------------------------
 * ProfileActions' "More options" dropdown previously lived nested with
 * `position: absolute` inside ProfileHero's `overflow-hidden` box, which
 * also carries its own blurred/scaled background image (`filter: blur(34px)
 * ... transform: scale(1.18)`) and stacking context. A `backdrop-filter`
 * nested inside an ancestor with `overflow-hidden` + its own filter/transform
 * gets clipped to that ancestor's box and composites against the
 * *already-blurred* hero art instead of the true page background — which
 * is what made the menu look washed out / blended into the hero.
 *
 * Fixed by porting the exact pattern PlaylistPage's SongContextMenu /
 * PlaylistOptionsMenu already use: `createPortal(..., document.body)` +
 * `position: fixed`, with position computed from the trigger button's
 * `getBoundingClientRect()` in `useLayoutEffect`. This removes the menu
 * from ProfileHero's clipping/filter stacking context entirely, so its
 * `backdrop-filter` now blurs the real page background instead of the
 * hero's pre-blurred art — matching Sidebar's dropdown visually AND
 * structurally now, not just visually.
 * ------------------------------------------------------------------
 *
 * Responsibilities:
 * - Display user profile information (avatar, name, username)
 * - Show user's playlists in a horizontal scrollable section
 * - Show listening history in a horizontal scrollable section
 * - Provide edit profile functionality via modal
 * - Handle loading, empty, and error-free states for both sections
 *
 * Related modules:
 * - useProfile (src/features/profile/hooks/useProfile.ts) - Fetches and updates user profile
 * - useUserPlaylists (src/features/playlists/hooks/useUserPlaylist.ts) - Fetches user's playlists
 * - useHistory (src/features/history/hooks/useHistory.ts) - Fetches listening history
 * - usePlayer (src/features/player/hooks/usePlayer.ts) - Plays tracks from history
 * - EditProfileModal (src/features/profile/components/EditProfileModal.tsx) - Profile editing interface
 *   NOTE: EditProfileModal's source wasn't provided, so its internals are untouched here.
 *
 * Architectural role:
 * - **User profile landing page** for authenticated users
 * - Route: /profile (protected, inside MainLayout)
 * - Displays personalized content: user's playlists + listening history
 *
 * @module features/profile/pages
 */

import { useState, useCallback, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
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
import EditRounded from "@mui/icons-material/EditRounded";
import IosShareRounded from "@mui/icons-material/IosShareRounded";
import PlayArrowRounded from "@mui/icons-material/PlayArrowRounded";
import { useMediaQuery } from "@/components/layout/hooks/useMediaQuery";

// Brand constants — Apple Music DARK theme (matches HANDOFF_CORE.md, dark variant)
const P = "#fc3c44"; // accent (dark-mode red)
const PH = "#ff6961"; // accent hover
const GR = "linear-gradient(135deg, #fa2d48 0%, #c644fc 100%)"; // fallback artwork gradient
const BG_ROOT = "#000000";
const GLASS = "rgba(28,28,30,0.62)";
const GLASS_SOFT = "rgba(255,255,255,0.06)";
const HAIRLINE = "rgba(255,255,255,0.09)";
const TXT_PRIMARY = "#f5f5f7";
const TXT_SECONDARY = "rgba(235,235,245,0.60)";

// Single shared horizontal gutter — used by the hero AND every scroll
// row's track/header, so all their edges line up.
const GUTTER = "clamp(16px, 5vw, 40px)";

// Left-side gutter for rows that break out past the sidebar: composes the
// page's own `--sidebar-inset` with GUTTER, so a card row can physically
// span the TRUE viewport width (reclaiming the sidebar's width for its
// scrollable box) while still visually starting its content in the same
// place GUTTER alone would have. Mirrors FeaturedBanner's `trackGutter`
// paddingLeft on the homepage exactly.
const LEFT_GUTTER = `calc(var(--sidebar-inset) + ${GUTTER})`;

// The same negative-margin + compensating-width breakout HomePage applies
// to the <section> wrapping FeaturedBanner — cancels the page's
// sidebar-inset padding for ONE row only, letting that row's box reach
// the true viewport edge instead of stopping at `100% - sidebar-inset`.
const BREAKOUT_STYLE: React.CSSProperties = {
  marginLeft: "calc(-1 * var(--sidebar-inset))",
  width: "calc(100% + var(--sidebar-inset))",
};

// Fixed chrome that can overlap a portaled floating menu, used to keep
// it inside the usable viewport (mirrors PlaylistPage's constants).
const PLAYER_BAR_H = 90;
const MOBILE_NAV_H = 64;

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
 * Shared card artwork shell — square art, hover lift, hover play affordance.
 * Used by both PlaylistCard and TrackCard so the two sections feel identical.
 */
const CardArtwork = ({
  imageUrl,
  alt,
}: {
  imageUrl?: string | null;
  alt: string;
}) => (
  <div
    className="relative w-full aspect-square rounded-lg overflow-hidden mb-2.5 transition-transform duration-200 ease-out"
    style={{
      boxShadow: "0 8px 20px rgba(0,0,0,0.55)",
      border: `1px solid ${HAIRLINE}`,
    }}
  >
    {imageUrl ? (
      <img
        src={imageUrl}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover transition-[filter] duration-200 ease-out group-hover:brightness-[0.55]"
      />
    ) : (
      <div
        className="w-full h-full flex items-center justify-center"
        style={{ background: GR }}
      >
        <LibraryMusicIcon className="text-white/85" sx={{ fontSize: 44 }} />
      </div>
    )}
    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-out">
      <span
        className="flex items-center justify-center rounded-full"
        style={{
          width: 36,
          height: 36,
          background: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "#fa243c"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.4)"; }}
      >
        <PlayArrowRounded sx={{ fontSize: 28 }} style={{ color: "#ffffff", marginLeft: "1px" }} />
      </span>
    </div>
  </div>
);

/**
 * PlaylistCard component for playlist section.
 * Displays playlist cover art, name, and song count.
 *
 * @param playlist - Playlist object with id, name, coverURL, songCount
 */
const PlaylistCard = ({ playlist }: { playlist: any }) => (
  <Link
    to={`/playlist/${playlist.id}`}
    className="group flex-shrink-0 w-[148px] sm:w-[164px] md:w-[176px] snap-start focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 rounded-lg"
    aria-label={`Open playlist ${playlist.name}`}
  >
    <CardArtwork imageUrl={playlist.coverURL} alt={playlist.name} />
    <p
      className="text-[13px] font-semibold truncate leading-tight"
      style={{ color: TXT_PRIMARY }}
    >
      {playlist.name}
    </p>
    <p className="text-[11px] mt-0.5" style={{ color: TXT_SECONDARY }}>
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
const TrackCard = ({
  track,
  onClick,
}: {
  track: any;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex-shrink-0 w-[148px] sm:w-[164px] md:w-[176px] text-left snap-start focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 rounded-lg"
    aria-label={`Play ${track.title} by ${track.artist}`}
  >
    <CardArtwork imageUrl={track.imageUrl || track.coverUrl} alt={track.title} />
    <p
      className="text-[13px] font-semibold truncate leading-tight"
      style={{ color: TXT_PRIMARY }}
    >
      {track.title}
    </p>
    <p className="text-[11px] mt-0.5 truncate" style={{ color: TXT_SECONDARY }}>
      {track.artist}
    </p>
  </button>
);

/**
 * Skeleton loading card — shares exact geometry with the real cards so
 * layout never shifts once data arrives. Uses the soft-glass fill.
 */
const SkCard = () => (
  <div
    className="flex-shrink-0 w-[148px] sm:w-[164px] md:w-[176px] animate-pulse"
    aria-hidden="true"
  >
    <div
      className="w-full aspect-square rounded-lg mb-2.5"
      style={{ background: GLASS_SOFT, border: `1px solid ${HAIRLINE}` }}
    />
    <div className="h-3 w-3/4 rounded-full mb-1.5" style={{ background: GLASS_SOFT }} />
    <div className="h-2.5 w-1/2 rounded-full" style={{ background: GLASS_SOFT }} />
  </div>
);

/**
 * Centered, icon-led empty state shared by both sections. Rendered as a
 * frosted-glass panel over the black canvas.
 */
const EmptyState = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) => (
  <div
    className="flex flex-col items-center justify-center text-center py-12 px-6 rounded-xl"
    style={{
      background: GLASS,
      backdropFilter: "blur(24px) saturate(180%)",
      WebkitBackdropFilter: "blur(24px) saturate(180%)",
      border: `1px solid ${HAIRLINE}`,
    }}
  >
    <div
      className="flex items-center justify-center w-11 h-11 rounded-full mb-3"
      style={{ background: "rgba(255,255,255,0.08)" }}
    >
      <Icon sx={{ fontSize: 22 }} style={{ color: TXT_SECONDARY }} />
    </div>
    <p className="text-[14px] font-semibold mb-1" style={{ color: TXT_PRIMARY }}>
      {title}
    </p>
    <p className="text-[12px] mb-5 max-w-xs" style={{ color: TXT_SECONDARY }}>
      {description}
    </p>
    {actionLabel && (
      <button
        type="button"
        onClick={onAction}
        className="text-[13px] font-semibold px-5 py-2.5 rounded-full text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        style={{ background: P }}
        onMouseEnter={(e) => (e.currentTarget.style.background = PH)}
        onMouseLeave={(e) => (e.currentTarget.style.background = P)}
      >
        {actionLabel}
      </button>
    )}
  </div>
);

/**
 * ScrollSection - Reusable, self-contained full-bleed horizontal
 * scrollable section, built on the exact HomePage/FeaturedBanner breakout
 * pattern.
 *
 * ScrollSection is a full-width sibling wherever it's rendered — it never
 * needs to sit inside a `max-w-*` wrapper. It cancels the page's
 * `--sidebar-inset` on its own root (`BREAKOUT_STYLE`, identical to the
 * `<section>` HomePage wraps FeaturedBanner in) so its track's real
 * scrollable width reaches the true viewport edge, then re-adds that same
 * offset via `LEFT_GUTTER` padding on the header and the track — the same
 * two-step cancel/re-add FeaturedBanner does with `trackGutter`. The net
 * result: the title and the first card always sit at the same
 * x-position as everything else on the page, while the row itself can
 * scroll all the way to the true right edge.
 *
 * `state` picks which body renders — `content` (real cards), `loading`
 * (skeleton cards, same geometry, no layout shift once data arrives), or
 * `empty` (centered glass panel). All three share the exact same header
 * and gutter math, so there's exactly one place that can get the
 * alignment wrong instead of three hand-duplicated ones.
 *
 * @param title - Section title
 * @param linkTo - Optional route for "View All" link (content state only)
 * @param state - Which body to render: 'content' | 'loading' | 'empty'
 * @param skeletonCount - Number of skeleton cards to show when state is 'loading'
 * @param emptyState - Node to render when state is 'empty'
 * @param children - Scrollable cards, rendered when state is 'content'
 */
const ScrollSection = ({
  title,
  linkTo,
  state = "content",
  skeletonCount = 4,
  emptyState,
  children,
}: {
  title: string;
  linkTo?: string;
  state?: "content" | "loading" | "empty";
  skeletonCount?: number;
  emptyState?: React.ReactNode;
  children?: React.ReactNode;
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [hovered, setHovered] = useState(false);

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    measure();
  }, [measure, state, children]);

  const onScroll = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      measure();
    });
  }, [measure]);

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  // Scroll by roughly one card-width + gap, same "arrow moves one card"
  // feel as FeaturedBanner's scrollByCard.
  const scroll = (dir: "l" | "r") =>
    scrollRef.current?.scrollBy({
      left: dir === "l" ? -320 : 320,
      behavior: "smooth",
    });

  const arrowCls =
    "absolute top-[42%] -translate-y-1/2 z-10 w-8 h-8 rounded-full " +
    "flex items-center justify-center transition-all duration-200 ease-out " +
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

  const isContent = state === "content";

  return (
    <div
      className="relative w-full group/row"
      style={BREAKOUT_STYLE}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Header — LEFT_GUTTER on the left re-adds the inset this root just
          cancelled, so the title lines up with the hero above it; plain
          GUTTER on the right since there's no inset to compensate for
          on that side. */}
      <div
        className="flex items-center justify-between mb-4"
        style={{ paddingLeft: LEFT_GUTTER, paddingRight: GUTTER }}
      >
        <div className="flex items-center gap-2">
          <div
            className="flex-shrink-0 rounded-full"
            style={{ width: 3, height: 18, background: "#fa243c" }}
            aria-hidden="true"
          />
          <h2
            className="font-semibold tracking-tight"
            style={{ fontSize: 17, color: "#f5f5f7", letterSpacing: "-0.3px" }}
          >
            {title}
          </h2>
        </div>
        {isContent && linkTo && (
          <Link
            to={linkTo}
            className="flex items-center gap-0.5 text-[12px] font-semibold transition-colors"
            style={{ color: P }}
            onMouseEnter={(e) => (e.currentTarget.style.color = PH)}
            onMouseLeave={(e) => (e.currentTarget.style.color = P)}
          >
            View All
            <ChevronRightRounded sx={{ fontSize: 17 }} />
          </Link>
        )}
      </div>

      {state === "empty" ? (
        <div style={{ paddingLeft: LEFT_GUTTER, paddingRight: GUTTER }}>{emptyState}</div>
      ) : (
        <div className="relative">
          {isContent && !atStart && (
            <button
              type="button"
              onClick={() => scroll("l")}
              aria-label="Scroll left"
              className={`${arrowCls} hidden sm:flex`}
              style={{
                left: LEFT_GUTTER,
                marginLeft: -12,
                background: GLASS,
                backdropFilter: "blur(16px) saturate(180%)",
                WebkitBackdropFilter: "blur(16px) saturate(180%)",
                border: `1px solid ${HAIRLINE}`,
                boxShadow: "0 2px 10px rgba(0,0,0,0.5)",
                opacity: hovered ? 1 : 0,
              }}
            >
              <ChevronLeftIcon sx={{ fontSize: 18 }} style={{ color: TXT_PRIMARY }} />
            </button>
          )}

          {/*
            Scrollable track — this is the FeaturedBanner `trackGutter`
            move: paddingLeft re-adds LEFT_GUTTER so the first card starts
            exactly under the title above it, while the track's own box
            (thanks to the root's BREAKOUT_STYLE) now physically spans the
            true viewport width, so scrollWidth actually includes the
            space reclaimed from the sidebar. A trailing spacer div (not
            paddingRight) gives right-edge breathing room, matching
            FeaturedBanner's own trailing spacer exactly.
          */}
          <div
            ref={scrollRef}
            onScroll={onScroll}
            className="overflow-x-auto overflow-y-hidden pb-2 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{
              WebkitOverflowScrolling: "touch",
              paddingLeft: LEFT_GUTTER,
              scrollPaddingLeft: LEFT_GUTTER,
            }}
            role="list"
          >
            <div className="flex gap-4" style={{ minWidth: "max-content" }}>
              {state === "loading"
                ? Array.from({ length: skeletonCount }).map((_, i) => <SkCard key={i} />)
                : children}
              <div
                className="flex-shrink-0"
                style={{ width: GUTTER }}
                aria-hidden="true"
              />
            </div>
          </div>

          {isContent && !atEnd && (
            <button
              type="button"
              onClick={() => scroll("r")}
              aria-label="Scroll right"
              className={`${arrowCls} hidden sm:flex`}
              style={{
                right: GUTTER,
                marginRight: -12,
                background: GLASS,
                backdropFilter: "blur(16px) saturate(180%)",
                WebkitBackdropFilter: "blur(16px) saturate(180%)",
                border: `1px solid ${HAIRLINE}`,
                boxShadow: "0 2px 10px rgba(0,0,0,0.5)",
                opacity: hovered ? 1 : 0,
              }}
            >
              <ChevronRightIcon sx={{ fontSize: 18 }} style={{ color: TXT_PRIMARY }} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * SIDEBAR_MENU tokens — lifted verbatim from Sidebar's ProfileMenu dropdown
 * (the "Profile / Admin Panel / Sign Out" popover) so every dropdown menu
 * in the app — sidebar or page-level — renders from the SAME frosted-glass
 * recipe instead of each screen approximating it slightly differently.
 * If Sidebar's dropdown tokens ever change, mirror the change here too;
 * if that drift starts happening often, promote this block to a shared
 * `dropdownMenu.constants.ts` both components import from.
 */
const SIDEBAR_MENU = {
  panelWidth: 185,
  panelBg: "rgba(31,31,31,.68)",
  panelBackdropFilter: "blur(38px) saturate(190%) brightness(1.05) contrast(1.05)",
  panelBorder: "1px solid rgba(255,255,255,.12)",
  panelRadius: 10,
  panelShadow: `
    0 24px 60px rgba(0,0,0,.48),
    0 10px 24px rgba(0,0,0,.28),
    0 2px 6px rgba(0,0,0,.18),
    inset 0 1px 0 rgba(255,255,255,.14),
    inset 0 -1px 0 rgba(0,0,0,.25),
    inset 0 0 0 1px rgba(255,255,255,.03)
  `,
  rowHeight: 34,
  rowTextColor: "#F5F5F7",
  rowHoverBg: "rgba(255,255,255,.06)",
  dividerColor: "rgba(255,255,255,.08)",
} as const;

/**
 * SidebarStyleMenuItem — one row of the dropdown: label on the left,
 * icon on the right, exactly Sidebar's "Profile / Admin Panel / Sign Out"
 * row shape (`justify-between`, h-[34px], text-[13px] font-weight 300,
 * 16px icon). Shared here so ProfileActions' three rows can't drift from
 * each other the way three hand-written buttons previously could.
 */
const SidebarStyleMenuItem = ({
  label,
  icon: Icon,
  onClick,
  withTopDivider,
}: {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  withTopDivider?: boolean;
}) => (
  <>
    {withTopDivider && (
      <div style={{ height: "0.5px", background: SIDEBAR_MENU.dividerColor }} />
    )}
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="group w-full flex items-center justify-between px-3 h-[34px] transition-colors duration-150"
      style={{ color: SIDEBAR_MENU.rowTextColor, background: "transparent" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = SIDEBAR_MENU.rowHoverBg)}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <span style={{ fontWeight: 300 }} className="text-[13px]">
        {label}
      </span>
      <Icon sx={{ fontSize: 16, color: "#f5f5f7" }} />
    </button>
  </>
);

/**
 * ProfileActions — frosted-glass capsule holding two icon-only buttons
 * (Share, More). The "More" button opens a dropdown that is a
 * byte-for-byte visual match of Sidebar's ProfileMenu dropdown — same
 * background/blur/border/shadow/radius, same row height, type scale,
 * icon-on-the-right layout, and 0.5px divider.
 *
 * MENU PORTAL FIX: the dropdown now portals to `document.body` with
 * `position: fixed`, positioned via `getBoundingClientRect()` on the
 * trigger button — identical to PlaylistPage's SongContextMenu /
 * PlaylistOptionsMenu. Previously it was `position: absolute` nested
 * inside ProfileHero's `overflow-hidden` box (which also carries its own
 * blurred/scaled background image), so its `backdrop-filter` composited
 * against the hero's already-blurred art instead of the true page
 * background — that's what caused the menu to visually blend/wash out.
 * Portaling removes it from that ancestor's clipping/filter stacking
 * context entirely.
 */
const ProfileActions = ({
  onEdit,
  onOpenLibrary,
  onShare,
}: {
  onEdit: () => void;
  onOpenLibrary: () => void;
  onShare?: () => void;
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const handleShare = useCallback(() => {
    if (onShare) return onShare();
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      (navigator as any).share({ url: window.location.href }).catch(() => { });
    }
  }, [onShare]);

  // Position computed from the trigger's real screen rect, recalculated
  // every time the menu opens — same approach as SongContextMenu /
  // PlaylistOptionsMenu in PlaylistPage, clamped to stay above fixed
  // bottom chrome (player bar / mobile nav).
  useLayoutEffect(() => {
    if (!menuOpen || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight ?? 3 * SIDEBAR_MENU.rowHeight;
    const isMobile = window.innerWidth < 640;
    const bottomChrome = isMobile ? MOBILE_NAV_H + PLAYER_BAR_H : PLAYER_BAR_H;
    const usableViewH = window.innerHeight - bottomChrome;

    const top = Math.min(
      rect.bottom + window.scrollY + 6,
      window.scrollY + usableViewH - menuHeight - 8,
    );
    const right = window.innerWidth - rect.right + window.scrollX;

    setPos({ top, right });
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        closeMenu();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    const tid = setTimeout(() => document.addEventListener("mousedown", handleClick), 50);
    document.addEventListener("keydown", handleKey);
    return () => {
      clearTimeout(tid);
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen, closeMenu]);

  const iconBtnCls =
    "flex items-center justify-center w-7 h-7 transition-colors duration-150 ease-out rounded-full";

  return (
    <div
      ref={containerRef}
      className="relative flex items-center rounded-full"
      style={{
        // Same frosted capsule recipe as the dropdown panel below (and as
        // Sidebar's own trigger surfaces), rather than the flatter
        // "#1c1c1e" fill this used before — one glass recipe, used
        // everywhere a floating control sits over content.
        background: SIDEBAR_MENU.panelBg,
        backdropFilter: SIDEBAR_MENU.panelBackdropFilter,
        WebkitBackdropFilter: SIDEBAR_MENU.panelBackdropFilter,
        border: SIDEBAR_MENU.panelBorder,
        padding: "4px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.45)",
      }}
    >
      {/* Share */}
      <button
        type="button"
        onClick={handleShare}
        aria-label="Share profile"
        className={iconBtnCls}
        style={{ color: TXT_PRIMARY }}
      >
        <IosShareRounded sx={{ fontSize: 20 }} />
      </button>

      {/* More — opens the Sidebar-matched dropdown, now portaled */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="More options"
        className={iconBtnCls}
        style={{ color: TXT_PRIMARY }}
      >
        <MoreHorizIcon sx={{ fontSize: 20 }} />
      </button>

      {/*
        Dropdown panel — portaled to document.body + position: fixed, so
        it escapes ProfileHero's overflow-hidden and pre-blurred
        background entirely. backdrop-filter now blurs the real page
        content behind it instead of the hero's own blurred art.
      */}
      {menuOpen &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label="Profile options"
            style={{
              position: "fixed",
              top: pos?.top ?? 0,
              right: pos?.right ?? 16,
              width: SIDEBAR_MENU.panelWidth,
              zIndex: 999999,
              background: SIDEBAR_MENU.panelBg,
              backdropFilter: SIDEBAR_MENU.panelBackdropFilter,
              WebkitBackdropFilter: SIDEBAR_MENU.panelBackdropFilter,
              border: SIDEBAR_MENU.panelBorder,
              borderRadius: SIDEBAR_MENU.panelRadius,
              boxShadow: SIDEBAR_MENU.panelShadow,
              overflow: "hidden",
              animation: "slideUp .18s cubic-bezier(.2,.8,.2,1)",
              visibility: pos ? "visible" : "hidden",
            }}
          >
            {/*
              `slideUp` is assumed to already exist as a global keyframe
              (Sidebar's dropdown relies on it without defining it inline).
              Defined here too, scoped to this instance via a plain <style>
              tag, so this component still animates correctly even if it's
              ever used on a page before that global stylesheet loads. Safe
              to delete once the global definition is confirmed to always
              be present by the time this mounts.
            */}
            <style>{`
              @keyframes slideUp {
                from { opacity: 0; transform: translateY(8px); }
                to { opacity: 1; transform: translateY(0); }
              }
            `}</style>

            <SidebarStyleMenuItem
              label="Edit Profile"
              icon={EditRounded}
              onClick={() => {
                closeMenu();
                onEdit();
              }}
            />
            <SidebarStyleMenuItem
              label="My Library"
              icon={LibraryMusicIcon}
              onClick={() => {
                closeMenu();
                onOpenLibrary();
              }}
              withTopDivider
            />
            <SidebarStyleMenuItem
              label="Share Profile"
              icon={IosShareRounded}
              onClick={() => {
                closeMenu();
                handleShare();
              }}
              withTopDivider
            />
          </div>,
          document.body,
        )}
    </div>
  );
};

/**
 * ProfileHero — Apple Music DARK-style hero: deeply darkened blurred cover
 * (or graphite fallback), a single centered column (avatar → name → username),
 * actions pinned top-right on a frosted layer.
 *
 * NOTE on spacing: this component no longer sets its own outer margin —
 * the parent (ProfilePage) wraps it in the same `max-w-7xl` + `GUTTER`
 * container used by the sections below. Unlike the two ScrollSections,
 * the hero intentionally stays constrained/centered rather than
 * breaking out — same split HomePage draws between a bounded header and
 * its full-bleed FeaturedBanner row.
 */
const ProfileHero = ({
  photoURL,
  displayName,
  username,
  initials,
  onEdit,
  onOpenLibrary,
}: {
  photoURL?: string | null;
  displayName: string;
  username: string;
  initials: string;
  onEdit: () => void;
  onOpenLibrary: () => void;
}) => (
  <div
    className="relative w-full overflow-hidden xl:rounded-2xl"
    style={{ height: "min(320px, 42vw)", minHeight: 320 }}
  >
    {/* Background */}
    <div className="absolute inset-0">
      {photoURL ? (
        <>
          <img
            src={photoURL}
            alt=""
            className="w-full h-full object-cover"
            style={{ filter: "blur(34px) saturate(1.15) brightness(0.55)", transform: "scale(1.18)" }}
          />
          <div className="absolute inset-0" style={{ backgroundColor: "rgba(0,0,0,0.55)" }} />
        </>
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 140% at 50% 0%, #2c2c2e 0%, #1c1c1e 45%, #000000 100%)",
          }}
        />
      )}
      {/* Bottom fade into the true-black page body */}
      <div
        className="absolute inset-x-0 bottom-0 h-24"
        style={{ background: `linear-gradient(to bottom, transparent, ${BG_ROOT})` }}
      />
    </div>

    {/* Centered content */}
    <div className="relative h-full flex flex-col items-center justify-center px-6">
      <div
        className="rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
        style={{
          width: 116,
          height: 116,
          background: photoURL ? "transparent" : "linear-gradient(135deg, #3a3a3c, #1c1c1e)",
          border: "3px solid rgba(255,255,255,0.18)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
        }}
      >
        {photoURL ? (
          <img
            src={photoURL}
            alt={displayName}
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <span
            className="font-bold select-none"
            style={{ fontSize: 40, letterSpacing: "-1px", color: TXT_PRIMARY }}
          >
            {initials}
          </span>
        )}
      </div>

      <h1
        className="mt-4 text-[20px] sm:text-[28px] leading-tight font-bold tracking-tight text-center truncate max-w-full"
        style={{ color: TXT_PRIMARY, textShadow: "0 1px 10px rgba(0,0,0,0.6)" }}
      >
        {displayName}
      </h1>
      {username && (
        <p
          className="mt-1 text-[14px] font-medium truncate max-w-full"
          style={{ color: TXT_SECONDARY, textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}
        >
          {username}
        </p>
      )}
    </div>

    <div className="absolute right-5 top-5">
      <ProfileActions onEdit={onEdit} onOpenLibrary={onOpenLibrary} />
    </div>
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
 * @returns Profile page JSX
 */
const ProfilePage = () => {
  const { profile, loading, updateProfile } = useProfile();
  const { user } = useAuth();
  const { playlists, loading: pL } = useUserPlaylists();
  const { historyTracks, loading: hL } = useHistory(user?.uid ?? "");
  const { playTrack } = usePlayer();
  const navigate = useNavigate();
  const isXL = useMediaQuery("(min-width:1280px)");

  const [modalOpen, setModalOpen] = useState(false);

  const openModal = useCallback(() => setModalOpen(true), []);
  const closeModal = useCallback(() => setModalOpen(false), []);
  const goToLibrary = useCallback(() => navigate("/library"), [navigate]);
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

  // Initial profile load
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "transparent" }}
      >
        <div className="flex flex-col items-center gap-3">
          <AnimatedSpinner size={28} color={P} />
          <p className="text-[13px]" style={{ color: TXT_SECONDARY }}>
            Loading profile…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen pb-12"
      style={{ background: "transparent", paddingLeft: "var(--sidebar-inset)" }}
      role="main"
      aria-label="Library page"
    >
      <div className="min-h-screen" style={{ backgroundColor: "transparent" }}>
        {/* Hero — the one section that stays bounded/centered, same as
            HomePage's greeting header staying out of the breakout. */}
        <div style={isXL ? { padding: `12px ${GUTTER} 0` } : undefined} className="max-w-7xl mx-auto">
          <ProfileHero
            photoURL={profile?.photoURL}
            displayName={displayName}
            username={username}
            initials={initials}
            onEdit={openModal}
            onOpenLibrary={goToLibrary}
          />
        </div>

        {/*
          Main content sections — "Playlists" and "Listening To" are now
          full-width siblings, exactly like FeaturedBanner / RecentlyPlayed
          on HomePage. Each ScrollSection owns its own breakout
          (BREAKOUT_STYLE on its root) rather than being wrapped in a
          `max-w-*` container here, so its track can scroll all the way to
          the true viewport edge — while still visually starting each row
          under its title, which lines up with the hero above it.
        */}
        <div
          className="w-full flex flex-col gap-10"
          style={{ padding: "32px 0 48px", backgroundColor: "transparent" }}
        >
          {/* Playlists section */}
          <ScrollSection
            title="Your Playlists"
            linkTo="/library"
            state={pL ? "loading" : playlists.length === 0 ? "empty" : "content"}
            skeletonCount={4}
            emptyState={
              <EmptyState
                icon={LibraryMusicIcon}
                title="No playlists yet"
                description="Create your first playlist from your Library."
                actionLabel="Go to Library"
                onAction={goToLibrary}
              />
            }
          >
            {playlists.map((p: any) => (
              <PlaylistCard key={p.id} playlist={p} />
            ))}
          </ScrollSection>

          {/* Listening history section — only rendered once we know
              there's something to show (matches previous behavior of
              hiding the row entirely when history is empty). */}
          {hL ? (
            <ScrollSection title="Listening To" state="loading" skeletonCount={5} />
          ) : historyTracks && historyTracks.length > 0 ? (
            <ScrollSection title="Listening To" state="content">
              {historyTracks.slice(0, 20).map((track: any) => (
                <TrackCard
                  key={track.id}
                  track={track}
                  onClick={() => playTrack(track, historyTracks)}
                />
              ))}
            </ScrollSection>
          ) : null}
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
    </div>
  );
};

export default ProfilePage;