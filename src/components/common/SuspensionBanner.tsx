/**
 * @fileoverview Persistent banner UI for suspended users in limited access mode.
 *
 * Responsibilities:
 * - Display non-intrusive status indicator when user.status === "suspended" and acknowledged
 * - Provide quick actions (Appeal, Sign Out) without leaving the current page
 * - Support collapse/expand to minimize visual footprint while maintaining awareness
 *
 * Related modules:
 * - SuspensionContext (src/context/SuspensionContext.tsx) - Renders this banner after acknowledge()
 * - useSuspension hook - Provides acknowledgment state (not directly used here, parent handles visibility)
 * - auth.service - logoutUser() for session termination
 *
 * Architectural role:
 * - Rendered as a fixed top banner for suspended users who clicked "Continue in limited mode"
 * - Replaces the full-screen SuspendedScreen interstitial with a less intrusive indicator
 * - Visually communicates read-only mode without blocking content interaction
 *
 * Behavior by user status (per Firestore security rules):
 * - Suspended: This banner appears, writes blocked by isWriteable() = false
 * - Active/Banned: This banner never renders (parent SuspensionContext handles conditional rendering)
 *
 * @module features/suspension
 */

import { useState } from "react";
import { logoutUser } from "@/features/auth/services/auth.service";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { LockOutlineRounded } from "@mui/icons-material";

/**
 * SuspensionBanner - Top fixed banner for suspended users in limited access mode.
 *
 * Visual states:
 * 1. Expanded (default): Full banner showing lock icon, status text, and action buttons
 * 2. Collapsed: Compact pill button centered at top, showing "Limited Mode"
 *
 * Why two states?
 * - Expanded: Educates user about limitations (first time after acknowledgment)
 * - Collapsed: Minimal footprint for users who understand restrictions but want screen space
 *
 * State management:
 * - Local collapsed state only (not persisted across sessions or page reloads)
 * - No props - visibility controlled by SuspensionContext parent
 *
 * Accessibility:
 * - role="alert" on expanded banner announces status to screen readers
 * - aria-label on collapse button describes action
 *
 * Performance:
 * - Uses CSS animations for enter/exit (GPU-accelerated transform)
 * - No Firestore subscriptions or network requests
 */
const SuspensionBanner = () => {
  const [collapsed, setCollapsed] = useState(false);

  /**
   * Signs out the suspended user and redirects to homepage.
   *
   * Same behavior as SuspendedScreen handleSignOut:
   * - Hard redirect ensures complete auth state teardown
   * - Prevents stale banner from reappearing after logout
   *
   * Side effects:
   * - Clears Firebase Auth session
   * - Window navigation resets React tree
   *
   * @async
   */
  const handleSignOut = async () => {
    await logoutUser();
    window.location.href = "/";
  };

  /**
   * Rendered when user has collapsed the banner.
   *
   * Returns a compact floating pill button that can be clicked to re-expand.
   * Position: fixed, centered horizontally, top with small offset.
   *
   * Why separate return branches instead of conditional CSS?
   * - Completely different DOM structures (pill vs full banner)
   * - Collapsed state removes banner height spacer div (h-[45px])
   * - Cleaner component logic than toggling visibility with display:none
   */
  if (collapsed) {
    return (
      <>
        <button
          className="fixed top-[10px] left-1/2 -translate-x-1/2 z-[9999] inline-flex items-center gap-[6px] px-[13px] py-[5px] bg-white border border-[#e5e5ea] rounded-[980px] text-xs font-semibold text-neutral-800 cursor-pointer whitespace-nowrap shadow-[0_1px_8px_rgba(0,0,0,0.1),0_0_0_0.5px_rgba(0,0,0,0.05)] transition-all duration-150 hover:shadow-[0_3px_16px_rgba(0,0,0,0.13)] hover:translate-x-[-50%] hover:-translate-y-[0px] antialiased"
          onClick={() => setCollapsed(false)}
        >
          <LockOutlineRounded sx={{ fontSize: 14, color: ["#fa243c"] }} />
          Limited Mode
        </button>

        <style>{`
          /* Animation keyframes for future use (not currently applied).
             Reserved for potential pulsing dot or status indicator animations. */
          @keyframes pdot {
            0%,100% { opacity: 1; }
            50%      { opacity: 0.35; }
          }
        `}</style>
      </>
    );
  }

  /**
   * Expanded banner view (default state).
   *
   * Layout structure:
   * - Fixed top banner with white background and subtle bottom border
   * - Centered content with max-width 1100px (matches main content width)
   * - Left section: Lock icon + status label + descriptive text
   * - Right section: Action buttons (Appeal, Sign Out) + collapse control
   *
   * Spacer div (h-[45px]) below banner prevents content from being hidden underneath.
   * Without this spacer, fixed positioning would obscure top of scrollable content.
   */
  return (
    <>
      <div
        className="fixed top-0 left-0 right-0 z-[9999] bg-white border-b border-[#e5e5ea] antialiased animate-[sbDown_0.28s_cubic-bezier(0.22,1,0.36,1)_both]"
        role="alert"
      >
        <div className="max-w-[1100px] mx-auto flex items-center justify-between px-5 py-[6px] gap-4">
          {/* Left section: Status messaging */}
          <div className="flex items-center justify-center gap-[8px] min-w-0 flex-1">
            <LockOutlineRounded sx={{ fontSize: 16, color: ["#fa243c"] }} />

            <span className="text-[13px] font-semibold text-[#6e6e73] whitespace-nowrap flex-shrink-0">
              Account Locked
            </span>

            {/* Vertical divider - hidden on mobile (< 640px) */}
            <span className="w-px h-[13px] bg-[#d1d1d6] flex-shrink-0 hidden sm:block" />

            {/* Descriptive text - hidden on mobile due to limited space */}
            <span className="text-[13px] text-[#6e6e73] hidden sm:block font-semibold whitespace-nowrap overflow-hidden text-ellipsis">
              Limited mode is on. Likes, playlists, and history are paused.
            </span>
          </div>

          {/* Right section: Action buttons and collapse control */}
          <div className="flex items-center gap-[6px] flex-shrink-0">
            {/* Appeal button - opens support email in default mail client */}
            <a
              href="mailto:support@Premix.com"
              className="inline-flex items-center justify-center px-4 py-1 rounded-[980px] text-[12px] font-medium cursor-pointer border-none no-underline whitespace-nowrap transition-all duration-150 active:scale-[0.96] bg-[#fa243c] text-white hover:bg-[#ef465c]"
            >
              Appeal
            </a>

            {/* Sign Out button - terminates session */}
            <button
              className="inline-flex items-center justify-center px-4 py-1 rounded-[980px] text-[12px] font-medium cursor-pointer border-none whitespace-nowrap transition-all duration-150 active:scale-[0.96] bg-[#fa243c] text-white hover:bg-[#ef465c]"
              onClick={handleSignOut}
            >
              Sign Out
            </button>

            {/* Collapse button - minimizes banner to floating pill */}
            <button
              className="flex items-center justify-center w-5 h-5 rounded-full bg-transparent border border-[#e5e5ea] text-[#aeaeb2] cursor-pointer transition-all duration-150 hover:bg-[#f5f5f7] hover:text-[#6e6e73] flex-shrink-0 ml-1"
              onClick={() => setCollapsed(true)}
              aria-label="Collapse banner"
            >
              <KeyboardArrowDownIcon sx={{ fontSize: 16 }} />
            </button>
          </div>
        </div>
      </div>

      {/* Spacer to push content below fixed banner.
          Height matches banner height (~45px) to prevent content overlap.
          Without this, main content would start at top of viewport (under banner). */}
      <div className="h-[45px]" />

      <style>{`
        /* Banner slide-down entrance animation.
           Banner starts hidden above viewport (translateY(-100%)) and slides into view.
           Uses Apple-style cubic-bezier easing: slow start, fast middle, gentle end. */
        @keyframes sbDown {
          from {
            transform: translateY(-100%);
          }
          to {
            transform: translateY(0);
          }
        }
        
        /* Reserved animation for potential status indicator (not currently used).
           Would create gentle pulsing effect for attention-grabbing scenarios. */
        @keyframes sbdot {
          0%,100% {
            opacity: 1;
          }
          50% {
            opacity: 0.3;
          }
        }
      `}</style>
    </>
  );
};

export default SuspensionBanner;