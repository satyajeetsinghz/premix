/**
 * @fileoverview Blocked user screen component for banned account state.
 *
 * Responsibilities:
 * - Render a visually distinct locked screen when user.status === "banned"
 * - Provide three clear exit paths: contact support, learn more, sign out
 * - Handle secure logout and redirect without leaving orphaned auth state
 *
 * Related modules:
 * - SuspensionContext (src/context/SuspensionContext.tsx) - Determines when to render this screen
 * - auth.service - logoutUser() for clean session termination
 *
 * Architectural role:
 * - Rendered by SuspensionContext when Firestore user document has status === "banned"
 * - Completely replaces MainLayout and all protected content per security rules
 * - No authenticated Firestore writes allowed from this component (matches isWriteable() = false for banned users)
 *
 * @module features/suspension
 */

import { logoutUser } from "@/features/auth/services/auth.service";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import { LockOutlineRounded } from "@mui/icons-material";

/**
 * Props for the BlockedUserScreen component.
 *
 * @property {string} [reason] - Optional lock reason from Firestore user.statusReason or admin-provided message.
 *                               Displayed below the main heading to provide audit context to the user.
 */
interface Props {
  reason?: string;
}

/**
 * Configuration for a single action card on the blocked screen.
 *
 * @property tag - Short label displayed above title (e.g., "Locked", "Support", "Exit")
 * @property title - Card heading (typically 2-4 words)
 * @property description - Explanatory text for the action
 * @property buttonLabel - CTA button text
 * @property icon - MUI icon component (size normalized internally)
 * @property onClick - Handler executed on button click
 * @property delay - CSS animation delay string (e.g., "55ms") for staggered entrance
 * @property primary - Visual emphasis flag. Primary card uses brand red (#fa243c); others use dark gray (#1d1d1f)
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
 * Individual action card component.
 *
 * Styling matches Apple Music's lock screen aesthetic:
 * - White card with subtle border via box-shadow (avoids performance-heavy border property)
 * - Hover: elevation increase + 3px upward translation
 * - Staggered entrance animations via inline style animationDelay
 *
 * Performance: Pure presentational component with no internal state.
 * Re-renders only when props change (parent passes stable onClick references).
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
          ? "bg-[#fa243c] text-white hover:bg-[#d93025]"
          : "bg-[#1d1d1f] text-white hover:bg-[#3a3a3c]"
        }`}
      onClick={onClick}
    >
      {buttonLabel}
    </button>
  </div>
);

/**
 * BlockedUserScreen - Rendered for users with Firestore user.status === "banned".
 *
 * Security boundary (per Firestore security rules):
 * - Banned users have isReadable() = false and isWriteable() = false
 * - This component makes NO Firestore read/write attempts (only logout and mailto navigation)
 * - Authenticated session still exists but cannot access any protected data
 *
 * User experience:
 * - Explains lock reason (if provided) for transparency
 * - Three clear paths: contact support, learn more (same support flow), sign out
 * - Staggered card entrance animations create deliberate, calm UX (not panicked)
 *
 * State management:
 * - No local state (stateless)
 * - Side effect: logoutUser() clears Firebase Auth and redirects to home
 *
 * @param reason - Optional lock reason displayed to user
 */
const BlockedUserScreen = ({ reason }: Props) => {
  /**
   * Handles secure logout from banned account state.
   *
   * Steps:
   * 1. Call logoutUser() from auth.service (clears Firebase Auth + Firestore user doc reference)
   * 2. Hard redirect to "/" (homepage) via window.location.href
   *
   * Why hard redirect instead of React Router navigate?
   * - Ensures complete auth state reset before re-rendering
   * - Prevents stale SuspensionContext state from showing screen again
   * - Clears any in-flight Firestore listeners
   *
   * Side effects: Clears persisted auth tokens (Firebase local storage)
   * Performance: logoutUser() is idempotent; safe to call even if already logged out
   */
  const handleSignOut = async () => {
    await logoutUser();
    // Hard navigation ensures complete auth state teardown.
    window.location.href = "/";
  };

  /**
   * Opens support email in user's default mail client.
   *
   * Why mailto instead of in-app support form?
   * - Banned users have no write access to Firestore; cannot submit tickets
   * - Email provides auditable, timestamped communication channel
   * - Support team can respond with investigation results without exposing internal tooling
   *
   * Future improvement: Add ?subject=Account%20Lock%20Appeal&body=UID: ${currentUser.uid}
   * to pre-populate critical context for support team.
   */
  const handleSupport = () => {
    window.location.href = "mailto:support@beatstream.com";
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col items-center justify-center px-8 py-[52px] pb-11 antialiased">
      {/* Header section with lock reason */}
      <div className="w-full max-w-[1040px] flex items-end justify-between gap-5 mb-7 animate-[fadeUp_0.4s_cubic-bezier(0.22,1,0.36,1)_both]">
        <div>
          <h1 className="text-[clamp(30px,3.8vw,46px)] font-bold text-[#1d1d1f] tracking-[-1px] leading-[1.08] mb-[10px]">
            Your account has been locked.
          </h1>

          {/* Conditionally render lock reason if provided by admin */}
          {reason && (
            <p className="text-[15px] text-[#6e6e73] leading-[1.5] max-w-[520px]">
              <span className="font-semibold text-[#fa243c]">Reason: </span>
              {reason}
            </p>
          )}
        </div>

        <a
          href="mailto:support@beatstream.com"
          className="text-[17px] font-medium text-[#fa243c] whitespace-nowrap shrink-0 pb-3 hover:opacity-65 transition-opacity"
        >
          Appeal decision ›
        </a>
      </div>

      {/* Three-column action card grid */}
      <div className="w-full max-w-[1040px] grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Primary card: Lock explanation - most prominent */}
        <OptionCard
          tag="Locked"
          icon={<LockOutlineRounded sx={{ fontSize: 18 }} />}
          title="Access permanently restricted"
          description="This account has been locked and no longer has access to BeatStream. All features and data have been locked."
          buttonLabel="Learn more"
          onClick={handleSupport}
          delay="0ms"
          primary
        />

        {/* Support card: Appeal path */}
        <OptionCard
          tag="Support"
          icon={<HelpOutlineIcon sx={{ fontSize: 18 }} />}
          title="Contact Support"
          description="If you believe this is a mistake, reach out to our team. We'll review your case and respond within 48 hours."
          buttonLabel="Get help"
          onClick={handleSupport}
          delay="55ms"
        />

        {/* Exit card: Session termination */}
        <OptionCard
          tag="Exit"
          icon={<ExitToAppIcon sx={{ fontSize: 18 }} />}
          title="Sign out"
          description="Return to the login screen. Your appeal can be submitted any time via our support team."
          buttonLabel="Sign out"
          onClick={handleSignOut}
          delay="110ms"
        />
      </div>

      {/* Subtle footer with product attribution */}
      <p className="mt-7 text-xs text-[#aeaeb2] tracking-[0.2px] animate-[fadeUp_0.4s_0.2s_cubic-bezier(0.22,1,0.36,1)_both]">
        BeatStream · Account Access Restricted
      </p>

      <style>{`
        /* Entrance animation for header section */
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
        
        /* Staggered card entrance animation.
           Each card receives a unique animationDelay (0ms, 55ms, 110ms)
           Creating a cascading reveal effect without JavaScript */
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

export default BlockedUserScreen;