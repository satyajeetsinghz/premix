/**
 * @fileoverview Suspended user screen with limited access mode entry point.
 *
 * Responsibilities:
 * - Render educational interstitial when user.status === "suspended"
 * - Provide three user choices: limited mode (acknowledge), contact support, or sign out
 * - Persist acknowledgment via sessionStorage to prevent repeated interruptions
 *
 * Related modules:
 * - SuspensionContext (src/context/SuspensionContext.tsx) - Conditionally renders this screen
 * - useSuspension hook (src/context/useSuspension.tsx) - Provides acknowledge() function
 * - auth.service - logoutUser() for clean session termination
 *
 * Architectural role:
 * - Rendered by SuspensionContext for suspended users who haven't acknowledged the screen
 * - After acknowledge(), user can browse but writes (likes/playlists/history) are blocked per Firestore isWriteable() = false
 * - acknowledgment lives in sessionStorage only (not Firestore) - user must re-acknowledge each browser session
 *
 * Security note: This component does NOT grant write permissions.
 * Firestore security rules independently enforce isWriteable() = false for suspended users.
 * The "Continue in limited mode" button only dismisses the UI overlay, not the Firestore restriction.
 *
 * @module features/suspension
 */

import { logoutUser } from "@/features/auth/services/auth.service";
import { useSuspension } from "@/context/useSuspension";
import PauseCircleOutlineIcon from "@mui/icons-material/PauseCircleOutline";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";

/**
 * Props for the SuspendedScreen component.
 *
 * @property {string} [reason] - Optional suspension reason from Firestore user.statusReason.
 *                               Displayed prominently to provide transparency and reduce support tickets.
 */
interface Props {
  reason?: string;
}

/**
 * Configuration for a single action card on the suspended screen.
 *
 * @property tag - Category label (e.g., "Limited Access", "Support", "Exit")
 * @property title - Concise card heading
 * @property description - Detailed explanation of the action's implications
 * @property buttonLabel - CTA button text
 * @property icon - MUI icon (size normalized to 18px via sx prop)
 * @property onClick - Handler executed on button click
 * @property delay - Staggered animation delay in CSS format (e.g., "55ms")
 * @property primary - Primary action uses brand red (#fa243c); secondary uses dark gray (#1d1d1f)
 */
interface CardProps {
  tag: string;
  title: string;
  description: string;
  buttonLabel: string;
  icon: React.ReactNode;
  onClick: () => void;
  delay: string;
  primary?: boolean;
}

/**
 * Reusable action card component.
 *
 * Visual design matches Apple Music's suspension interstitial:
 * - Clean white card with minimal shadow (no border, shadow creates subtle separation)
 * - Hover state elevates card + upward translation for tactile feedback
 * - Staggered entrance reduces cognitive load (cards don't appear simultaneously)
 *
 * Performance:
 * - Pure functional component with no hooks
 * - onClick handlers are stable if parent provides memoized callbacks
 * - CSS transitions use transform/opacity (GPU-accelerated properties only)
 */
const OptionCard = ({
  tag,
  title,
  description,
  buttonLabel,
  icon,
  onClick,
  delay,
  primary,
}: CardProps) => (
  <div
    className="bg-white rounded-[20px] p-[30px_26px_26px] flex flex-col shadow-[0_2px_8px_rgba(0,0,0,0.05),0_0_0_0.5px_rgba(0,0,0,0.06)] transition-all duration-200 hover:shadow-[0_12px_32px_rgba(0,0,0,0.1),0_0_0_0.5px_rgba(0,0,0,0.06)] hover:-translate-y-[3px] animate-[cardIn_0.45s_cubic-bezier(0.22,1,0.36,1)_both]"
    style={{ animationDelay: delay }}
  >
    <span className="inline-flex items-center gap-[6px] text-[13px] font-semibold text-[#fa243c] mb-[14px] tracking-[0.05px]">
      <span className="flex items-center shrink-0 text-[#fa243c]">{icon}</span>
      {tag}
    </span>

    <h3 className="text-2xl font-bold text-[#1d1d1f] tracking-[-0.5px] leading-[1.15] mb-[10px]">
      {title}
    </h3>

    <p className="text-[15px] text-[#6e6e73] leading-[1.6] mb-[28px] flex-1">
      {description}
    </p>

    <button
      className={`inline-flex items-center justify-center px-6 py-1.5 rounded-[980px] text-[15px] font-semibold cursor-pointer border-none self-start tracking-[-0.1px] transition-all duration-150 active:scale-[0.97] ${primary
          ? "bg-[#fa243c] text-white hover:bg-[#e02650]"
          : "bg-[#1d1d1f] text-white hover:bg-[#3a3a3c]"
        }`}
      onClick={onClick}
    >
      {buttonLabel}
    </button>
  </div>
);

/**
 * SuspendedScreen - Interstitial for users with Firestore user.status === "suspended".
 *
 * Behavior per Firestore security rules (from HANDOFF_CORE.md):
 * - isReadable() = true for suspended users (can view songs, playlists, browse)
 * - isWriteable() = false for suspended users (cannot like, create playlists, modify history)
 *
 * User experience:
 * - Explains suspension reason (if admin provided one) for clarity
 * - "Continue in limited mode" dismisses the screen and grants read-only access
 * - Acknowledgment stored in sessionStorage only (not persisted across browser sessions)
 * - "Get help" opens support email for appeal process
 * - "Sign out" clears auth state and redirects to login
 *
 * Why sessionStorage instead of Firestore flag?
 * - Suspension is a server-enforced status; client acknowledgment should not override it
 * - sessionStorage ensures user sees screen again on new browser session (re-education)
 * - Prevents accumulating "acknowledgedAt" timestamps that serve no audit purpose
 *
 * State management:
 * - No local component state
 * - Side effect: acknowledge() sets sessionStorage flag and triggers SuspensionContext re-render
 *
 * @param reason - Optional suspension reason from admin action
 */
const SuspendedScreen = ({ reason }: Props) => {
  const { acknowledge } = useSuspension();

  /**
   * Signs out the suspended user and redirects to homepage.
   *
   * Why hard redirect (window.location.href) instead of React Router navigate?
   * - Ensures complete teardown of Firebase Auth state before re-rendering
   * - Prevents SuspensionContext from briefly re-showing the screen after logout
   * - Clears any in-flight Firestore listeners that might be polling restricted data
   *
   * Side effects:
   * - Calls logoutUser() which clears Firebase Auth token and local storage
   * - Window navigation resets React component tree entirely
   */
  const handleSignOut = async () => {
    await logoutUser();

    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col items-center justify-center px-8 py-[52px] pb-11 antialiased">
      {/* Header section with suspension reason */}
      <div className="w-full max-w-[1040px] flex items-end justify-between gap-5 mb-7 animate-[fadeUp_0.4s_cubic-bezier(0.22,1,0.36,1)_both]">
        <div>
          <h1 className="text-[clamp(30px,3.8vw,46px)] font-bold text-[#1d1d1f] tracking-[-1px] leading-[1.08] mb-[10px]">
            Your account is suspended.
          </h1>

          {/* Conditional reason display - helps users understand violation without contacting support */}
          {reason && (
            <p className="text-[15px] text-[#6e6e73] leading-[1.5] max-w-[520px]">
              <span className="font-semibold text-[#fa243c]">Reason: </span>
              {reason}
            </p>
          )}
        </div>

        {/* Direct appeal link - reduces friction for wrongly suspended users */}
        <a
          href="mailto:support@Premix.com"
          className="text-[17px] font-medium text-[#fa243c] whitespace-nowrap shrink-0 pb-3 hover:opacity-65 transition-opacity"
        >
          Appeal decision ›
        </a>
      </div>

      {/* Three action cards - primary is "Continue in limited mode" */}
      <div className="w-full max-w-[1040px] grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Primary card: Limited access mode - most users will click this */}
        <OptionCard
          tag="Limited Access"
          icon={<PauseCircleOutlineIcon sx={{ fontSize: 18 }} />}
          title="Continue in limited mode"
          description="Browse music and view your playlists. Playback, likes and history are paused while suspended."
          buttonLabel="Continue anyway"
          onClick={acknowledge}
          delay="0ms"
          primary
        />

        {/* Support card: Appeal path for disputed suspensions */}
        <OptionCard
          tag="Support"
          icon={<HelpOutlineIcon sx={{ fontSize: 18 }} />}
          title="Contact Support"
          description="Think this is a mistake? Reach our team and we'll review your account."
          buttonLabel="Get help"
          onClick={() => {
            window.location.href = "mailto:support@Premix.com";
          }}
          delay="55ms"
        />

        {/* Exit card: Complete session termination */}
        <OptionCard
          tag="Exit"
          icon={<ExitToAppIcon sx={{ fontSize: 18 }} />}
          title="Sign out"
          description="Return to the login screen. Your data, playlists and history are safe."
          buttonLabel="Sign out"
          onClick={handleSignOut}
          delay="110ms"
        />
      </div>

      {/* Footer attribution - consistent with blocked screen for brand cohesion */}
      <p className="mt-7 text-xs text-[#aeaeb2] tracking-[0.2px] animate-[fadeUp_0.4s_0.2s_cubic-bezier(0.22,1,0.36,1)_both]">
        Premix · Limited Access Mode
      </p>

      <style>{`
        /* Fade up animation for header and footer */
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        /* Card entrance animation with staggered delays.
           Uses cubic-bezier(0.22,1,0.36,1) - Apple-style easing curve (slow start, fast middle, gentle end)
           Each card animates independently to create cascading reveal effect */
        @keyframes cardIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default SuspendedScreen;