/**
 * @fileoverview Login page with Google OAuth authentication.
 *
 * Logic only — UI has been stripped out. Contains:
 * - signInWithGoogle call via handleLogin
 * - loading / error state management
 * - error message formatting
 *
 * Related modules:
 * - auth.service (src/features/auth/services/auth.service.ts) - Contains signInWithGoogle function
 * - ProtectedRoute (src/features/auth/components/ProtectedRoute.tsx) - Redirects authenticated users away from /login
 *
 * @module features/auth/pages
 */

import AnimatedSpinner from "@/components/ui/LoadingSpinner/AnimatedSpinner";
import { signInWithGoogle } from "../services/auth.service";
import { useState, useCallback, useEffect } from "react";
import { ErrorRounded } from "@mui/icons-material";

/**
 * User-facing error message constants.
 * Provides consistent error text across authentication failures.
 */
const ERROR_MESSAGES = {
  LOGIN_FAILED: "Sign in failed. Please try again.",
  GENERIC_ERROR: "An error occurred. Please refresh and try again.",
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
 * State management:
 * - loading: boolean - true during Google OAuth popup
 * - error: string | null - error message to display (cleared on new attempt)
 *
 * @returns Login page JSX
 */
const LoginPage = (): React.ReactElement => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-dismiss the toast after a few seconds
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(timer);
  }, [error]);

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

  const P = "#f5f5f7";

  return (
    <div
      className="min-h-screen relative"
      style={{
        background:
          "linear-gradient(180deg, rgba(42,42,44,0.92) 0%,rgba(31,31,31,0.88) 45%,rgba(22,22,24,0.92) 100%)",
      }}
    >
      {error && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
          role="alertdialog"
          aria-modal="true"
          aria-describedby="popup-message"
        >
          {/* backdrop */}
          <div
            className="absolute inset-0 animate-in fade-in duration-200"
            style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
            onClick={() => setError(null)}
            aria-hidden="true"
          />

          {/* pop card */}
          <div
            className="relative w-full max-w-[320px] rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
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
            <div className="flex flex-col items-center text-center px-6 pt-7 pb-5">
              <div
                className="flex items-center justify-center w-11 h-11 rounded-full mb-3.5"
                style={{ backgroundColor: "transparent" }}
              >
                <ErrorRounded sx={{ fontSize: 36 }} />
              </div>

              <p
                className="text-[15px] font-semibold leading-snug mb-1"
                style={{ color: "#f5f5f7" }}
              >
                Something went wrong
              </p>
              <p
                id="popup-message"
                className="text-[13px] leading-snug"
                style={{ color: "rgba(245,245,247,0.65)" }}
              >
                {error}
              </p>
            </div>

            {/* divider + action, matching Apple's system-alert button row */}
            <button
              type="button"
              onClick={() => setError(null)}
              className="w-full py-3 text-[15px] font-semibold transition-colors duration-150"
              style={{
                color: "#f5f5f7",
                borderTop: "1px solid rgba(255,255,255,0.08)",
                backgroundColor: "transparent",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.06)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              Got It
            </button>
          </div>
        </div>
      )}

      {/* Top-left brand mark — swap for your own logo */}
      {/* <div className="absolute top-6 left-6 sm:top-8 sm:left-8">
        <picture>
          <img
            src="logos/premix_rounded_logo.png"
            alt="Premix"
            className="size-8 object-cover"
          />
        </picture>
      </div> */}

      {/* Centered content */}
      <div className="flex min-h-screen items-center justify-center px-8 sm:px-4">
        <div className="w-full max-w-[420px]">
          <div className="flex flex-col items-center">
            <img
              src="logos/premix_rounded_logo.png"
              alt="Premix"
              className="mb-6 size-16 sm:size-20 object-cover"
            />

            <h1 className="text-center text-[28px] leading-tight font-normal text-[#f5f5f7] mb-6">
              Sign in to your Premix account
            </h1>
          </div>

          {/* Primary action — visually anchors the card, like the input in the reference */}
          <button
            onClick={handleLogin}
            disabled={loading}
            type="button"
            className="w-full flex items-center justify-center rounded-full border-2 border-transparent bg-[#FA243C] px-4 py-3.5 text-[15px] font-medium text-white transition-colors hover:bg-[#E01E33] disabled:cursor-not-allowed disabled:border-transparent disabled:bg-[#E01E33]"
          >
            {loading ? <AnimatedSpinner size={20} color={P} /> : "Continue with Google"}
          </button>

          {/* Secondary link, mirroring "Create Your Apple Account" */}
          <button
            onClick={handleLogin}
            type="button"
            className="mt-4 block text-[15px] font-medium text-[#d60017] hover:underline"
          >
            Create an account ↗
          </button>

          {/* Consent / info block, mirroring the icon + paragraph pattern */}
          <div className="mt-8 flex gap-3">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              className="mt-0.5 shrink-0 text-[#d60017]"
            >
              <circle cx="9" cy="8" r="3" fill="currentColor" />
              <path
                d="M4 19c0-3 2.5-5 5-5s5 2 5 5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <circle cx="17" cy="9" r="2.2" fill="currentColor" opacity="0.5" />
              <path
                d="M20 19c0-2.2-1.7-3.8-3.5-4.3"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                opacity="0.5"
              />
            </svg>
            <p className="text-[13px] leading-relaxed text-[#f5f5f7]">
              Your account information is used to sign you in securely and
              access your data. We only request access to your basic profile
              details.{" "}
              <a href="/privacy" className="text-[#d60017] hover:underline">
                See how your data is managed…
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;