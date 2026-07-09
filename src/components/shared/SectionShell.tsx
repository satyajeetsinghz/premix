/**
 * @fileoverview Horizontal scrolling section container — Apple Music dark theme.
 *
 * Breakout technique fixed (this pass): previously used the
 * `left-1/2 -ml-[50vw] w-screen` trick, which is unreliable when nested
 * inside a `position: absolute` ancestor (MainLayout's <main>) combined
 * with an `overflow-hidden` root — `left: 50%` resolves against the
 * nearest POSITIONED ancestor, not the viewport, while `-50vw` remains
 * strictly viewport-relative. These stop canceling out correctly, causing
 * the inconsistent clipping seen in production.
 *
 * Fixed by switching to the exact same var(--sidebar-inset)-based
 * margin/width calc that FeaturedBanner already uses reliably — no vw
 * units anywhere, fully percentage/var-driven, immune to ancestor
 * positioning. IMPORTANT: this ONLY works correctly because HomePage no
 * longer nests RecentlyPlayed/DynamicSection inside max-w-[1400px]
 * mx-auto — see HomePage.tsx. A %-based cancellation cannot escape a
 * max-width ancestor; only removing that ancestor does.
 *
 * Heading alignment fixed (this pass): the header row and the scroll
 * track both compute their left inset from the SAME GUTTER_LEFT_PX
 * constant (imported from layout.constants), instead of independently
 * -chosen values that were never guaranteed to match pixel-for-pixel.
 * All spacing here is inline-style/calc-based rather than mixed
 * Tailwind-class + inline-style, specifically so the sidebar-inset
 * variable and the static gutter compose predictably in one `calc()`
 * rather than fighting for control of the same CSS property.
 */

import { ReactNode, useState, useCallback } from "react";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useHorizontalScroll } from "./useHorizontalScroll";
import { GUTTER_LEFT_PX, GUTTER_RIGHT_CLASS } from "@/components/layout/hooks/layout.constants";

interface SectionShellProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  groupName?: string;
}

export const SectionShell = ({ title, action, children }: SectionShellProps) => {
  const { ref, showLeft, showRight, onScroll, scrollLeft, scrollRight } =
    useHorizontalScroll(320);

  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleMouseLeave = useCallback(() => setIsHovered(false), []);

  return (
    <div
      className="w-full"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* ── Header — normal flow, left padding = GUTTER_LEFT_PX exactly,
             the same number the track below uses for its OWN gutter
             portion (before adding sidebar-inset on top of it). ── */}
      <div
        className={`flex items-center justify-between mb-4 ${GUTTER_RIGHT_CLASS}`}
        style={{ paddingLeft: GUTTER_LEFT_PX }}
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
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>

      {/* ── Scroll region — breaks out via var(--sidebar-inset) only.
             No vw units. Requires this component to NOT be nested inside
             a max-width ancestor (see HomePage.tsx). ── */}
      <div
        className="relative"
        style={{
          marginLeft: "calc(-1 * var(--sidebar-inset))",
          width: "calc(100% + var(--sidebar-inset))",
        }}
        role="region"
        aria-label={`${title} horizontal scroll section`}
      >
        {showLeft && (
          <button
            type="button"
            onClick={scrollLeft}
            aria-label="Scroll left"
            className="absolute top-[42%] -translate-y-1/2 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 hidden sm:flex"
            style={{
              left: "calc(var(--sidebar-inset) + clamp(16px, 5vw, 40px))",
              marginLeft: -12,
              background: "rgba(28,28,30,0.62)",
              backdropFilter: "blur(16px) saturate(180%)",
              WebkitBackdropFilter: "blur(16px) saturate(180%)",
              border: "1px solid rgba(255,255,255,0.09)",
              boxShadow: "0 2px 10px rgba(0,0,0,0.5)",
              opacity: isHovered ? 1 : 0,

            }}
          >
            <ChevronLeftIcon sx={{ fontSize: 18 }} style={{ color: "#f5f5f7" }} />
          </button>
        )}

        {/* Track — paddingLeft is EXACTLY sidebar-inset + GUTTER_LEFT_PX,
               composed in a single calc() so there's no risk of a
               Tailwind class and an inline style silently overriding
               each other. This is the same formula FeaturedBanner's
               track uses, guaranteeing pixel-identical alignment. */}
        <div
          ref={ref}
          onScroll={onScroll}
          className={`overflow-x-auto pb-2 ${GUTTER_RIGHT_CLASS}`}
          style={{
            paddingLeft: `calc(var(--sidebar-inset) + ${GUTTER_LEFT_PX})`,
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
          role="group"
          aria-label="Scrollable content"
        >
          <div className="flex gap-4">
            {children}
            <div
              aria-hidden
              className="flex-shrink-0 pr-[2px] sm:pr-4"
            />
          </div>
        </div>

        {showRight && (
          <button
            type="button"
            onClick={scrollRight}
            aria-label="Scroll right"
            className="absolute top-[42%] -translate-y-1/2 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 hidden sm:flex"
            style={{
              // Mirrors ProfilePage's arrow positioning: GUTTER on the right (no
              // sidebar-inset to compensate for on that side), pulled out -12px so
              // the icon centers on the row's edge instead of sitting fully inside
              // it. If arrowStyle previously carried right/left offsets, replace
              // it with this — don't merge the two, or the offsets fight.
              right: "clamp(16px, 5vw, 40px)",
              marginRight: -12,
              background: "rgba(28,28,30,0.62)",
              backdropFilter: "blur(16px) saturate(180%)",
              WebkitBackdropFilter: "blur(16px) saturate(180%)",
              border: "1px solid rgba(255,255,255,0.09)",
              boxShadow: "0 2px 10px rgba(0,0,0,0.5)",
              // Row-hover reveal, not button-hover — requires a `hovered` state on
              // SectionShell's row wrapper (onMouseEnter/onMouseLeave), same as
              // ScrollSection. Swap in whatever that state variable is named here.
              opacity: isHovered ? 1 : 0,
            }}
          >
            <ChevronRightIcon sx={{ fontSize: 18 }} style={{ color: "#f5f5f7" }} />
          </button>
        )}
      </div>
    </div>
  );
};