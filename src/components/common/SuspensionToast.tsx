/**
 * @fileoverview Transient toast notification for suspended users on write attempts.
 *
 * Responsibilities:
 * - Display non-intrusive notification when suspended user attempts a write operation
 * - Cycle through rotating educational messages on successive triggers
 * - Auto-dismiss after 6 seconds with animated progress bar
 * - Provide quick "Appeal" action without leaving current context
 *
 * Related modules:
 * - SuspensionContext (src/context/SuspensionContext.tsx) - Manages showToast state and dismissToast callback
 * - useSuspension hook - Provides showToast (boolean trigger) and dismissToast (reset function)
 *
 * Architectural role:
 * - Triggered by SuspensionContext when a suspended user attempts a prohibited action
 * - Prohibited actions include: liking a song, creating/editing playlists, adding to history
 * - Completely separate from SuspensionBanner (persistent status indicator)
 * - Toast appears and disappears; banner remains until user dismisses or signs out
 *
 * Usage pattern (from SuspensionContext):
 * - Any attempted write operation by suspended user calls showWriteBlockedToast()
 * - Sets showToast = true, which triggers this component to mount/update
 * - After 6 seconds or manual dismiss, dismissToast() resets state
 *
 * Message rotation rationale:
 * - Repeated write attempts show different educational messages
 * - Prevents user fatigue from seeing identical copy each time
 * - messageIndex persists across component remounts (module-level variable)
 *
 * @module features/suspension
 */

import { useEffect, useState } from "react";
import { useSuspension } from "@/context/useSuspension";

/**
 * Rotating educational messages for suspended users.
 *
 * Order matters - cycles through sequentially on each toast trigger.
 * Designed to:
 * 1. State the fact (features unavailable)
 * 2. Reinforce current mode (limited mode)
 * 3. Be specific (likes/playlists disabled)
 * 4. Provide action (contact support)
 */
const MESSAGES = [
  "Some features are unavailable while suspended.",
  "You're browsing in limited mode while suspended.",
  "Likes and playlists are disabled.",
  "Contact support to appeal your suspension.",
];

/**
 * Module-level message index counter.
 *
 * Why module-level instead of useState?
 * - Persists across component unmounts/remounts (toast disappears and reappears)
 * - Ensures rotation continues even if user navigates away and returns
 * - Simple increment without causing re-renders of unrelated components
 *
 * Performance: Number increments only on toast triggers (infrequent operation)
 */
let messageIndex = 0;

/**
 * SuspensionToast - Transient notification for blocked write operations.
 *
 * Visual design:
 * - Bottom-right positioned toast (Apple/linear style)
 * - Pink accent color (#ff375f) matching admin panel aesthetic
 * - Progress bar showing time remaining before auto-dismiss
 * - Entrance/exit animations with scale + opacity + translate
 *
 * Animation flow:
 * 1. showToast becomes true → component renders (initially hidden via st-out class)
 * 2. After 50ms, setVisible(true) → st-in class triggers entrance animation
 * 3. Progress bar animation (st-bar-run) starts (6 seconds duration)
 * 4. After 6 seconds, setVisible(false) → st-out triggers exit animation
 * 5. After 300ms (animation duration), call dismissToast() to reset parent state
 *
 * Why 50ms delay for setVisible?
 * - Ensures DOM has mounted before applying entrance animation
 * - Prevents animation from being skipped if component mounts with showToast=true
 *
 * Accessibility:
 * - role="alert" announces to screen readers
 * - aria-live="polite" prevents interrupting current speech
 * - aria-label on close button for screen reader users
 *
 * @component
 */
const SuspensionToast = () => {
  const { showToast, dismissToast } = useSuspension();

  /**
   * Controls toast visibility for animation purposes.
   *
   * Separate from showToast because:
   * - showToast: Parent trigger (boolean from context)
   * - visible: Local animation state (delayed entry, early exit for exit animation)
   *
   * This separation allows exit animations to complete before dismissing from context.
   */
  const [visible, setVisible] = useState(false);

  /**
   * Current message to display, selected from MESSAGES array.
   * Rotates on each toast trigger (increments messageIndex).
   */
  const [message, setMessage] = useState(MESSAGES[0]);

  /**
   * Effect 1: Handle toast entrance and message rotation.
   *
   * Triggered when showToast changes (parent requests new toast).
   *
   * Flow:
   * - If showToast is false → hide immediately (no animation needed)
   * - If showToast is true:
   *   1. Rotate message (messageIndex % MESSAGES.length)
   *   2. Increment messageIndex for next trigger
   *   3. Delay 50ms then setVisible(true) to trigger entrance animation
   *
   * Cleanup: Clears timeout if showToast changes before 50ms completes
   * (prevents race conditions on rapid successive triggers).
   */
  useEffect(() => {
    if (!showToast) {
      setVisible(false);
      return;
    }

    setMessage(MESSAGES[messageIndex % MESSAGES.length]);
    messageIndex++;

    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, [showToast]);

  /**
   * Effect 2: Handle auto-dismiss timeout.
   *
   * Triggered when showToast becomes true.
   *
   * Flow:
   * 1. Start 6000ms timer
   * 2. When timer completes: trigger exit animation (setVisible(false))
   * 3. After 300ms (animation duration), call dismissToast() to reset parent state
   *
   * Why nested timeouts?
   * - First timeout: Wait 6 seconds (toast visible duration)
   * - Second timeout: Allow exit animation to complete (300ms) before resetting context
   *
   * Without the second timeout, dismissToast() would unmount the component
   * immediately, cutting off the exit animation.
   *
   * Cleanup: Clears both timeouts if showToast changes or component unmounts.
   */
  useEffect(() => {
    if (!showToast) return;

    const t = setTimeout(() => {
      setVisible(false);
      // Wait for exit animation (300ms) before clearing parent state
      setTimeout(dismissToast, 300);
    }, 6000);

    return () => clearTimeout(t);
  }, [showToast, dismissToast]);

  /**
   * Manually dismiss the toast (user clicks close button or taps outside).
   *
   * Same pattern as auto-dismiss:
   * 1. Trigger exit animation (setVisible(false))
   * 2. Wait 300ms for animation to complete
   * 3. Call dismissToast() to reset parent state
   *
   * Why not call dismissToast() immediately?
   * - Would unmount component before exit animation runs
   * - Results in jarring disappearance instead of smooth fade-out
   */
  const handleDismiss = () => {
    setVisible(false);
    setTimeout(dismissToast, 300);
  };

  // Don't render anything if parent hasn't triggered a toast.
  if (!showToast) return null;

  return (
    <>
      <div
        className={`st-root ${visible ? "st-in" : "st-out"}`}
        role="alert"
        aria-live="polite"
      >
        {/* Warning icon - exclamation mark inside circle */}
        <div className="st-icon">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.5" stroke="#ff375f" strokeWidth="1.4" />
            <path
              d="M8 5v4M8 11v.3"
              stroke="#ff375f"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Text content area */}
        <div className="st-body">
          <p className="st-title">Account Suspended</p>
          <p className="st-msg">{message}</p>
        </div>

        {/* Action buttons container */}
        <div className="st-right">
          {/* Appeal link - opens support email (same as banner/blocked screen) */}
          <a href="mailto:support@beatstream.com" className="st-appeal">
            Appeal
          </a>

          {/* Manual dismiss button */}
          <button
            className="st-close"
            onClick={handleDismiss}
            aria-label="Dismiss notification"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path
                d="M2 2l6 6M8 2l-6 6"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Progress bar - visual timer indicating remaining display duration */}
        <div className={`st-bar ${visible ? "st-bar-run" : ""}`} />
      </div>

      <style>{`
        /* Import DM Sans as primary font (matches Apple system font stack fallback) */
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');

        /* Toast container - fixed position, bottom-right on desktop */
        .st-root {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 9999;
          width: 340px;
          background: #ffffff;
          border: 1px solid #e5e5ea;
          border-radius: 16px;
          overflow: hidden;
          font-family: -apple-system, 'DM Sans', BlinkMacSystemFont, sans-serif;
          -webkit-font-smoothing: antialiased;
          box-shadow:
            0 4px 24px rgba(0,0,0,0.08),
            0 1px 4px rgba(0,0,0,0.04),
            0 0 0 0.5px rgba(0,0,0,0.04);
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 14px 14px 16px;
          transition:
            transform 0.28s cubic-bezier(0.22,1,0.36,1),
            opacity 0.22s ease;
        }

        /* Entrance and exit animation states */
        .st-in { transform: translateY(0) scale(1); opacity: 1; }
        .st-out { transform: translateY(10px) scale(0.97); opacity: 0; pointer-events: none; }

        /* Icon container with pink background and border */
        .st-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: #fff0f3;
          border: 1px solid #ffd1d9;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: 1px;
        }

        /* Text content area */
        .st-body {
          flex: 1;
          min-width: 0;
        }
        .st-title {
          font-size: 13px;
          font-weight: 600;
          color: #1d1d1f;
          margin: 0 0 3px;
          letter-spacing: -0.1px;
        }
        .st-msg {
          font-size: 12.5px;
          color: #6e6e73;
          margin: 0;
          line-height: 1.5;
        }

        /* Right-side action buttons container */
        .st-right {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
          margin-top: 1px;
        }

        /* Appeal button - solid pink (#ff375f matches admin tab indicator) */
        .st-appeal {
          display: inline-flex;
          align-items: center;
          padding: 5px 14px;
          border-radius: 980px;
          font-size: 12px;
          font-weight: 600;
          font-family: inherit;
          background: #ff375f;
          color: #ffffff;
          text-decoration: none;
          white-space: nowrap;
          transition: background 0.13s;
          -webkit-font-smoothing: antialiased;
        }
        .st-appeal:hover {
          background: #e02650;
        }

        /* Close button - circular with border */
        .st-close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: transparent;
          border: 1px solid #e5e5ea;
          color: #aeaeb2;
          cursor: pointer;
          flex-shrink: 0;
          transition: background 0.12s, color 0.12s;
        }
        .st-close:hover {
          background: #f5f5f7;
          color: #6e6e73;
        }

        /* Progress bar - tracks remaining display time */
        .st-bar {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: #f5f5f7;
          transform-origin: left;
          transform: scaleX(0);
        }
        
        /* Active progress bar animation - shrinks from right to left over 6 seconds */
        .st-bar-run {
          background: #ff375f;
          animation: stDrain 6s linear forwards;
        }
        
        @keyframes stDrain {
          from {
            transform: scaleX(1);
          }
          to {
            transform: scaleX(0);
          }
        }

        /* Mobile responsive: reduce padding and use full width minus margins */
        @media (max-width: 400px) {
          .st-root {
            /* Full width minus 32px for margins on small screens */
            width: calc(100vw - 32px);
            right: 16px;
            bottom: 16px;
          }
        }
      `}</style>
    </>
  );
};

export default SuspensionToast;