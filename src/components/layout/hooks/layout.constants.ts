/**
 * @fileoverview Single source of truth for shared layout dimensions.
 * Every scrollable row's track padding AND every static heading's
 * padding import these exact values — this is what guarantees
 * pixel-identical alignment across FeaturedBanner, SectionShell, and
 * HomePage's own header.
 */

/** Sidebar's total on-screen footprint: w-60 (240px) + m-2 on both sides (16px) */
export const SIDEBAR_WIDTH_PX = 256;

/**
 * Fixed left gutter — deliberately a single static px value (not
 * responsive) so it can be composed inside a calc() alongside
 * var(--sidebar-inset) without Tailwind/inline-style precedence
 * ambiguity. 24px matches the visual weight of the app's existing
 * lg:px-10 scale.
 */
export const GUTTER_LEFT_PX = "24px";

/** Right-side gutter can safely stay responsive — no sidebar to compose against */
export const GUTTER_RIGHT_CLASS = "pr-4 md:pr-8";

/** Static (non-scrolling) content gutter — page header, empty states, etc. */
export const GUTTER_STATIC_CLASS = "px-4 md:px-8 lg:px-10";