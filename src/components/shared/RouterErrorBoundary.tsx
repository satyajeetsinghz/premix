/**
 * @fileoverview RouteErrorBoundary — authentic Apple Music error page.
 * Wire as the `errorElement` on your root/layout route.
 *
 * Redesign rationale (why the previous pass didn't read as "Apple Music"):
 * - Real Apple Music/Apple system error & empty states are almost entirely
 *   monochrome — a soft gray glyph in a flat circle, no color glow, no
 *   gradient icon tiles, no pulsing accent rings. Color (their red) is
 *   reserved for tiny functional touches (a play badge, a live dot), never
 *   spent on decorating an error screen.
 * - Apple's primary CTA in dark surfaces is a solid *white* pill with black
 *   text — not a brand-colored gradient button. The previous red gradient
 *   button read as a generic SaaS "oops" page, not Apple's actual system.
 * - Motion is a single restrained fade-up on entry, not an infinite ambient
 *   glow + breathing ring — Apple doesn't animate error states as if they're
 *   "alive," it just presents the fact calmly.
 * - Typography leans slightly smaller/tighter than a marketing hero (this is
 *   a utility screen, not a landing page), with generous but not oversized
 *   whitespace around a centered, single-column layout.
 */

import { useRouteError, isRouteErrorResponse, useNavigate } from "react-router-dom";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";

export default function RouteErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();

  const status = isRouteErrorResponse(error) ? error.status : 500;
  const statusText = isRouteErrorResponse(error)
    ? error.statusText
    : error instanceof Error
      ? error.message
      : undefined;

  const is404 = status === 404;
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{
        background: "#1c1c1e",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif',
      }}
    >
      <style>{`
        @keyframes errBoundaryFadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .err-stagger > * { animation: errBoundaryFadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) backwards; }
        .err-stagger > *:nth-child(1) { animation-delay: 0s; }
        .err-stagger > *:nth-child(2) { animation-delay: 0.06s; }
        .err-stagger > *:nth-child(3) { animation-delay: 0.12s; }
        .err-stagger > *:nth-child(4) { animation-delay: 0.18s; }
        .err-stagger > *:nth-child(5) { animation-delay: 0.24s; }
        @media (prefers-reduced-motion: reduce) {
          .err-stagger > * { animation: none !important; }
        }
      `}</style>

      <div className="err-stagger w-full max-w-[420px] flex flex-col items-center text-center">
        {/* Glyph — flat circle, monochrome, no glow */}
        <div
          className="flex items-center justify-center rounded-full mb-4 sm:mb-7"
          style={{
            width: 88,
            height: 88,
            background: "transparent",
          }}
        >
          {/* <Icon sx={{ fontSize: 40 }} style={{ color: "rgba(255,255,255,0.55)" }} /> */}
          <picture>
            <img
              src="logos/premix_rounded_logo.png"
              alt="Premix"
              className="size-16 sm:size-20 object-cover"
            />
          </picture>
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: 22,
            fontWeight: 600,
            lineHeight: 1.3,
            letterSpacing: "-0.01em",
            color: "#f5f5f7",
          }}
        >
          {is404 ? "We can't find that page" : "Something went wrong"}
        </h1>

        {/* Description */}
        <p
          className="mt-2 max-w-[340px]"
          style={{
            fontSize: 14,
            lineHeight: 1.5,
            color: "rgba(235,235,245,0.6)",
          }}
        >
          {is404
            ? "The page you're looking for may have been moved or no longer exists."
            : statusText || "This page couldn't load. Try again, or head back to Home."}
        </p>

        {/* Actions */}
        <div className="flex flex-col items-center gap-3 mt-8 w-full">
          <button
            onClick={() => navigate("/")}
            className="w-full max-w-[220px] flex items-center justify-center rounded-full transition-opacity duration-150 hover:opacity-85 active:opacity-70"
            style={{
              height: 40,
              background: "#ffffff",
              color: "#000000",
              fontWeight: 600,
              fontSize: 14,
            }}
            onFocus={(e) => (e.currentTarget.style.outline = "2px solid rgba(255,255,255,0.5)")}
            onBlur={(e) => (e.currentTarget.style.outline = "none")}
          >
            Go to Home
          </button>

          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 transition-colors duration-150"
            style={{
              height: 32,
              padding: "0 8px",
              background: "transparent",
              color: "rgba(235,235,245,0.6)",
              fontWeight: 500,
              fontSize: 13,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#f5f5f7")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(235,235,245,0.6)")}
            onFocus={(e) => (e.currentTarget.style.outline = "2px solid rgba(255,255,255,0.3)")}
            onBlur={(e) => (e.currentTarget.style.outline = "none")}
          >
            <ReplayRoundedIcon sx={{ fontSize: 15 }} />
            Go Back
          </button>
        </div>

        {!is404 && (
          <p className="mt-8" style={{ fontSize: 11, color: "rgba(235,235,245,0.35)" }}>
            Error {status}
          </p>
        )}
      </div>
    </div>
  );
}