/**
 * @fileoverview Login page with Google OAuth authentication.
 *
 * Responsibilities:
 * - Provide Google Sign-In button for authentication
 * - Handle loading states and error messages during authentication
 * - Display brand messaging and feature highlights
 * - Redirect authenticated users to home page (handled by ProtectedRoute)
 *
 * Related modules:
 * - auth.service (src/features/auth/services/auth.service.ts) - Contains signInWithGoogle function
 * - ProtectedRoute (src/features/auth/components/ProtectedRoute.tsx) - Redirects authenticated users away from /login
 *
 * Architectural role:
 * - **Public authentication entry point** for unauthenticated users
 * - Route: /login (public, redirects to / if already authenticated)
 * - Rendered without MainLayout (full-page layout)
 *
 * Authentication flow:
 * 1. User clicks "Continue with Google" or "Create an account"
 * 2. Firebase Google Auth popup opens
 * 3. User selects Google account and grants permissions
 * 4. On success: Firebase Auth state changes, ProtectedRoute redirects to /
 * 5. On failure: Display error message (popup blocked, cancelled, network error)
 *
 * Popup handling:
 * - Detects popup-blocked errors and shows user-friendly message
 * - Handles user cancellation gracefully (no scary error messages)
 *
 * Visual design:
 * - Centered card with glassmorphism effect (bg-white/80 backdrop-blur-xl)
 * - Brand red (#fa243c) primary button with hover animation
 * - Three feature badges (Unlimited, Quality, Streaming) with icons
 * - Responsive design: scales from mobile to desktop
 *
 * Error messages:
 * - Popup blocked: "Pop-up window was blocked. Please enable pop-ups for this site."
 * - User cancelled: "Sign in failed. Please try again." (generic)
 * - Network errors: Pass through original error message
 * - Unknown: Generic error message
 *
 * Accessibility:
 * - aria-label on all interactive elements
 * - role="alert" for error messages with aria-live="polite"
 * - Proper button disabled state during loading
 * - Semantic heading hierarchy (h1 → h2)
 *
 * Performance:
 * - useCallback for handleLogin (prevents recreation on each render)
 * - useMemo for benefitItems (static content, computed once)
 *
 * Security considerations:
 * - No hardcoded credentials or API keys
 * - Firebase handles OAuth securely
 * - User data stored in Firestore /users/{uid} after first sign-in
 *
 * @module features/auth/pages
 */

import { signInWithGoogle } from "../services/auth.service";
import GoogleIcon from "@mui/icons-material/Google";
import { useState, useCallback, useMemo } from "react";

// --- Brand constants (matches HANDOFF_CORE.md brand constants) ---
/** Primary brand color (#fa243c) used for buttons and active states */
const BRAND_COLOR = "#fa243c";

/** Darker brand variant for hover/loading states */
const BRAND_COLOR_DARK = "#E01E5A";

/** Application name displayed in header and legal text */
const BRAND_NAME = "Premix";

/** Current application version (displayed in footer) */
const APP_VERSION = "1.0.0";

/**
 * Featured benefits displayed as badges below welcome text.
 *
 * Each benefit has:
 * - label: Human-readable name (e.g., "Unlimited")
 * - icon: Visual symbol (∞, HD, 24/7)
 */
const FEATURED_BENEFITS = [
  { label: "Unlimited", icon: "∞" },
  { label: "Quality", icon: "HD" },
  { label: "Streaming", icon: "24/7" },
] as const;

/**
 * User-facing error message constants.
 * Provides consistent error text across authentication failures.
 */
const ERROR_MESSAGES = {
  LOGIN_FAILED: "Sign in failed. Please try again.",
  GENERIC_ERROR: "An error occurred. Please refresh and try again.",
} as const;

/**
 * ARIA labels for accessibility.
 * Ensures consistent screen reader announcements.
 */
const ARIA_LABELS = {
  SIGN_IN_BUTTON: "Sign in with Google",
  CREATE_ACCOUNT_BUTTON: "Create a new account or sign in",
  TERMS_LINK: "Opens Terms of Service",
  PRIVACY_LINK: "Opens Privacy Policy",
} as const;

/**
 * Formats authentication error into user-friendly message.
 *
 * Special handling:
 * - "popup-blocked": Guide user to enable popups
 * - "cancelled": Generic login failed (user didn't actually cancel, something else went wrong)
 * - Other errors: Return original message if available
 *
 * @param error - Caught error from signInWithGoogle
 * @returns User-friendly error message string
 */
const formatErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    if (error.message.includes("popup-blocked")) {
      return "Pop-up window was blocked. Please enable pop-ups for this site.";
    }
    if (error.message.includes("cancelled")) {
      return ERROR_MESSAGES.LOGIN_FAILED;
    }
    return error.message;
  }
  return ERROR_MESSAGES.GENERIC_ERROR;
};

/**
 * LoginPage - Public authentication entry point.
 *
 * Route configuration (from src/app/router.tsx):
 * - Path: "/login"
 * - Public: accessible without authentication
 * - Redirects to "/" if user already authenticated (via ProtectedRoute wrapper)
 *
 * Component structure:
 * - Brand header (Premix)
 * - Welcome message
 * - Feature badges row
 * - Google Sign-In button (primary)
 * - Divider with "New to Premix?" text
 * - "Create an account" button (secondary)
 * - Legal links (Terms, Privacy)
 * - Version footer
 *
 * State management:
 * - loading: boolean - Disables button and shows spinner during auth
 * - error: string | null - Error message to display (cleared on new attempt)
 *
 * @returns Login page JSX
 */
const LoginPage = (): React.ReactElement => {
  /** Loading state - true during Google OAuth popup */
  const [loading, setLoading] = useState(false);

  /** Error message - null when no error, string when auth fails */
  const [error, setError] = useState<string | null>(null);

  /**
   * Initiates Google Sign-In flow.
   *
   * Steps:
   * 1. Clear any previous error
   * 2. Set loading = true (disables button, shows spinner)
   * 3. Call signInWithGoogle from auth.service
   * 4. On success: Firebase Auth state changes, ProtectedRoute redirects to home
   * 5. On error: Format error message and set error state
   * 6. Finally: Set loading = false
   *
   * Security: No password collection (Google OAuth only)
   *
   * Side effects:
   * - Opens Google OAuth popup
   * - Updates Firebase Auth state on success
   * - Creates/updates Firestore user document (via auth.service)
   */
  const handleLogin = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      await signInWithGoogle();
    } catch (error) {
      const errorMessage = formatErrorMessage(error);
      setError(errorMessage);
      console.error("Login failed:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Memoized feature badges JSX.
   *
   * Static content, computed once on component mount.
   * Prevents unnecessary recreation on each render.
   */
  const benefitItems = useMemo(
    () =>
      FEATURED_BENEFITS.map((benefit) => (
        <div
          key={benefit.label}
          className="text-center p-2 sm:p-3 bg-gray-50/80 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-gray-100"
        >
          <div
            className="text-xl sm:text-2xl md:text-3xl font-bold mb-1"
            style={{ color: BRAND_COLOR }}
          >
            {benefit.icon}
          </div>
          <p className="text-[10px] sm:text-xs text-gray-600">
            {benefit.label}
          </p>
        </div>
      )),
    [],
  );

  /**
   * Primary sign-in button with Google icon and loading state.
   *
   * Visual states:
   * - Default: Google icon + "Continue with Google" text
   * - Loading: Spinner + "Signing in..." text (button disabled)
   *
   * @returns Sign-in button JSX
   */
  const renderSignInButton = () => (
    <button
      onClick={handleLogin}
      disabled={loading}
      type="button"
      aria-label={ARIA_LABELS.SIGN_IN_BUTTON}
      className="w-full text-white font-medium py-3 sm:py-3.5 px-4 sm:px-6 rounded-xl sm:rounded-2xl transition-all duration-300 flex items-center justify-center gap-2 sm:gap-3 group shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none"
      style={{
        backgroundColor: loading ? BRAND_COLOR_DARK : BRAND_COLOR,
      }}
    >
      {loading ? (
        <>
          <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          <span className="text-xs sm:text-sm">Signing in...</span>
        </>
      ) : (
        <>
          <GoogleIcon
            fontSize="small"
            className="text-white text-sm sm:text-base"
          />
          <span className="text-xs sm:text-sm">Continue with Google</span>
        </>
      )}
    </button>
  );

  /**
   * Secondary "Create an account" button.
   *
   * Calls the same handleLogin function (Google OAuth).
   * Different text provides user choice without extra logic.
   *
   * @returns Create account button JSX
   */
  const renderCreateAccountButton = () => (
    <button
      onClick={handleLogin}
      type="button"
      aria-label={ARIA_LABELS.CREATE_ACCOUNT_BUTTON}
      className="w-full bg-white hover:bg-gray-50 text-gray-700 font-medium py-3 sm:py-3.5 px-4 sm:px-6 rounded-xl sm:rounded-2xl transition-all duration-200 border border-gray-200 flex items-center justify-center gap-2 group"
    >
      <span className="text-xs sm:text-sm">Create an account</span>
      <svg
        className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 group-hover:text-[#fa243c] transition-colors"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5l7 7-7 7"
        />
      </svg>
    </button>
  );

  /**
   * Error alert banner.
   *
   * Conditionally rendered when error state is not null.
   * Uses role="alert" for screen reader announcement.
   *
   * @returns Error alert JSX or null
   */
  const renderErrorAlert = () =>
    error && (
      <div
        className="w-full mb-6 sm:mb-8 p-4 bg-red-50 border border-red-200 rounded-lg"
        role="alert"
        aria-live="polite"
      >
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-[90%] xs:max-w-sm sm:max-w-md md:max-w-lg mx-auto">
        {/* Main login card */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-200/50 p-6 sm:p-8 md:p-10">
          {/* Brand header */}
          <div className="flex justify-center items-center mb-2 sm:mb-2">
            <div className="relative inline-block">
              <div
                className="absolute inset-0 rounded-2xl animate-ping -z-10"
                style={{ backgroundColor: `${BRAND_COLOR}20` }}
              />
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">
              {/* {BRAND_NAME} */}
              <img
                src="/logos/premix_music_black_logo.png"
                alt="Premix"
                className="
    h-10
    sm:h-12
    w-auto
    object-contain
  "
              />
            </h1>
          </div>
          <p className="text-[12px] text-neutral-800 font-bold pt-2 text-center tracking-wide">Listen Your Way</p>

          {/* Welcome message */}
          <div className="text-center mt-6 mb-6 sm:mb-8">
            <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 mb-1 sm:mb-2">
              Welcome Back
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 px-2">
              Sign in to continue your musical journey
            </p>
          </div>

          {/* Error alert */}
          {renderErrorAlert()}

          {/* Feature badges row */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6 sm:mb-8">
            {benefitItems}
          </div>

          {/* Primary sign-in button */}
          {renderSignInButton()}

          {/* Divider with "New to Premix?" text */}
          <div className="relative my-6 sm:my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-white text-gray-400 text-[10px] sm:text-xs">
                New to {BRAND_NAME}?
              </span>
            </div>
          </div>

          {/* Secondary create account button */}
          {renderCreateAccountButton()}

          {/* Legal footer links */}
          <p className="text-[10px] sm:text-xs text-gray-400 text-center mt-6 sm:mt-8 leading-relaxed">
            By continuing, you agree to our{" "}
            <a
              href="#"
              className="text-gray-600 hover:text-[#fa243c] underline underline-offset-2 transition-colors font-medium"
              aria-label={ARIA_LABELS.TERMS_LINK}
            >
              Terms
            </a>{" "}
            and{" "}
            <a
              href="#"
              className="text-gray-600 hover:text-[#fa243c] underline underline-offset-2 transition-colors font-medium"
              aria-label={ARIA_LABELS.PRIVACY_LINK}
            >
              Privacy Policy
            </a>
          </p>
        </div>

        {/* Version footer */}
        <p className="text-[10px] sm:text-xs text-gray-400 text-center mt-4 sm:mt-6">
          {BRAND_NAME} Beta • Version {APP_VERSION}
        </p>
      </div>
    </div>
  );
};

export default LoginPage;