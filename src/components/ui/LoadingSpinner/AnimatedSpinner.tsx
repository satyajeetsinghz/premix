/**
 * @fileoverview Animated loading spinner component with pulsing bars arranged in a circular pattern.
 *
 * Responsibilities:
 * - Display a visually appealing loading indicator with 8 animated bars
 * - Support customizable size, primary color, and secondary color
 * - Provide accessible role and aria-label for screen readers
 *
 * Related modules:
 * - Used across the app for loading states: data fetching, authentication, uploads, modal content
 * - Common in Suspense fallbacks, lazy-loaded components, async operations
 *
 * Architectural role:
 * - **Standard loading indicator** for all asynchronous operations
 * - Consistent branding through default color (#ff375f - admin panel red)
 * - Reusable across features (auth, admin, player, library, profile)
 *
 * Visual design:
 * - 8 bars arranged in a circular pattern (every 45 degrees)
 * - Each bar pulses with staggered animation delays (0.1s increments)
 * - Primary color (#ff375f) pulses on top of secondary color (#D9D9D9)
 * - Creates a "radar sweep" or "progress ring" effect
 *
 * Animation details:
 * - Keyframes: pulse - opacity cycles from 0.3 → 1 → 0.3
 * - Duration: 1.2s per complete cycle
 * - Delay between bars: 0.1s (creates sequential wave effect)
 * - Total cycle: 0.7s delay on last bar + 1.2s animation = staggered wave
 *
 * Why SVG with inline styles?
 * - SVG provides crisp rendering at any size (vector-based)
 * - Inline <style> tag allows class-based animation without external CSS
 * - useMemo prevents style regeneration on every render (performance)
 *
 * Accessibility:
 * - role="status" - announces loading state to screen readers
 * - aria-label="Loading" - provides context for non-visual users
 * - No automatic focus changes (non-intrusive)
 *
 * Performance:
 * - useMemo memoizes animation style string (recomputes only when colors change)
 * - SVG viewBox fixed at 48x48, scales via width/height props
 *
 * Default colors:
 * - Primary: #ff375f (admin panel red, also used in SuspensionToast)
 * - Secondary: #D9D9D9 (light gray, subdued background for inactive bars)
 *
 * @module components/ui
 */

import { useMemo } from "react";

/**
 * Props for the AnimatedSpinner component.
 *
 * @property size - Width/height in pixels (default: 16px)
 * @property color - Primary animation color (pulsing bars) - default: #ff375f
 * @property secondaryColor - Base color for inactive bars - default: #D9D9D9
 * @property className - Additional CSS classes for custom styling (e.g., margin, positioning)
 */
interface AnimatedSpinnerProps {
  size?: number;
  color?: string;
  secondaryColor?: string;
  className?: string;
}

/**
 * Default dimensions and colors.
 *
 * DEFAULT_SIZE: 16px (matches standard icon size in UI)
 * DEFAULT_COLOR: #ff375f (brand red from admin panel and toasts)
 * DEFAULT_SECONDARY_COLOR: #D9D9D9 (soft gray, non-distracting background)
 */
const DEFAULT_SIZE = 16;
const DEFAULT_COLOR = "#ff375f";
const DEFAULT_SECONDARY_COLOR = "#D9D9D9";

/**
 * Generates CSS keyframes and class definitions for the spinner animation.
 *
 * Animation pattern:
 * - Pulse keyframes: opacity cycles 0.3 → 1 → 0.3
 * - Secondary color fills at low opacity (0.3)
 * - Primary color fills at full opacity (1)
 * - Creates "breathing" effect where bars light up sequentially
 *
 * Staggered delays:
 * - bar1: 0s delay (starts immediately)
 * - bar2: 0.1s delay
 * - bar3: 0.2s delay
 * - ...
 * - bar8: 0.7s delay
 *
 * Result: Wave of light travels around the circle.
 *
 * @param color - Primary animation color (pulsing bars)
 * @param secondaryColor - Base color (inactive bars)
 * @returns CSS string for injection into SVG <style> tag
 */
const buildAnimationStyle = (color: string, secondaryColor: string) => `
@keyframes pulse {
  0%, 100% { opacity: 0.3; fill: ${secondaryColor}; }
  50% { opacity: 1; fill: ${color}; }
}
.bar1 { animation: pulse 1.2s ease-in-out infinite; }
.bar2 { animation: pulse 1.2s ease-in-out 0.1s infinite; }
.bar3 { animation: pulse 1.2s ease-in-out 0.2s infinite; }
.bar4 { animation: pulse 1.2s ease-in-out 0.3s infinite; }
.bar5 { animation: pulse 1.2s ease-in-out 0.4s infinite; }
.bar6 { animation: pulse 1.2s ease-in-out 0.5s infinite; }
.bar7 { animation: pulse 1.2s ease-in-out 0.6s infinite; }
.bar8 { animation: pulse 1.2s ease-in-out 0.7s infinite; }
`;

/**
 * AnimatedSpinner - Loading indicator with 8 pulsing bars.
 *
 * Usage examples:
 * ```tsx
 * // Default spinner (16px, #ff375f)
 * <AnimatedSpinner />
 *
 * // Large spinner for page loading
 * <AnimatedSpinner size={48} className="mx-auto my-8" />
 *
 * // Custom colors for brand consistency
 * <AnimatedSpinner color="#fa243c" secondaryColor="#f0f0f0" />
 *
 * // In Suspense fallback
 * <Suspense fallback={<AnimatedSpinner size={32} className="my-4" />}>
 *   <LazyComponent />
 * </Suspense>
 * ```
 *
 * Bar arrangement (clock positions):
 * - bar1: 12 o'clock (top, no rotation)
 * - bar2: 1:30 (45deg)
 * - bar3: 3 o'clock (90deg)
 * - bar4: 4:30 (135deg)
 * - bar5: 6 o'clock (180deg, bottom)
 * - bar6: 7:30 (225deg)
 * - bar7: 9 o'clock (270deg)
 * - bar8: 10:30 (315deg)
 *
 * Each bar is a 4x12 rounded rectangle positioned via SVG transforms.
 * ViewBox: 48x48, center at (24,24).
 *
 * Performance note: SVG with CSS animations is GPU-accelerated by modern browsers.
 * 8 concurrently animating elements have minimal performance impact.
 *
 * @param props - AnimatedSpinnerProps
 * @returns SVG spinner with pulsing animation
 */
export const AnimatedSpinner = ({
  size = DEFAULT_SIZE,
  color = DEFAULT_COLOR,
  secondaryColor = DEFAULT_SECONDARY_COLOR,
  className = "",
}: AnimatedSpinnerProps) => {
  /**
   * Memoized animation styles.
   *
   * Prevents style string regeneration on every render.
   * Recomputes only when color or secondaryColor changes.
   * Critical for performance if spinner is frequently shown/hidden.
   */
  const animationStyles = useMemo(
    () => buildAnimationStyle(color, secondaryColor),
    [color, secondaryColor],
  );

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="status"
      aria-label="Loading"
    >
      {/* Inject animation styles */}
      <style>{animationStyles}</style>

      {/* Bar 1: 12 o'clock (top) - no rotation */}
      <rect
        x="22"
        width="4"
        height="12"
        rx="2"
        fill={secondaryColor}
        className="bar1"
      />

      {/* Bar 5: 6 o'clock (bottom) - 180deg rotation */}
      <rect
        x="22"
        y="36"
        width="4"
        height="12"
        rx="2"
        fill={secondaryColor}
        className="bar5"
      />

      {/* Bar 3: 3 o'clock (right) - 90deg rotation */}
      <rect
        y="26"
        width="4"
        height="12"
        rx="2"
        transform="rotate(-90 0 26)"
        fill={secondaryColor}
        className="bar3"
      />

      {/* Bar 7: 9 o'clock (left) - 90deg rotation from (36,26) */}
      <rect
        x="36"
        y="26"
        width="4"
        height="12"
        rx="2"
        transform="rotate(-90 36 26)"
        fill={secondaryColor}
        className="bar7"
      />

      {/* Bar 2: 1:30 position - 45deg rotation */}
      <rect
        x="5.61523"
        y="8.4436"
        width="4"
        height="12"
        rx="2"
        transform="rotate(-45 5.61523 8.4436)"
        fill={secondaryColor}
        className="bar2"
      />

      {/* Bar 6: 7:30 position - 45deg rotation offset by 180deg */}
      <rect
        x="31.071"
        y="33.8995"
        width="4"
        height="12"
        rx="2"
        transform="rotate(-45 31.071 33.8995)"
        fill={secondaryColor}
        className="bar6"
      />

      {/* Bar 4: 4:30 position - 135deg rotation */}
      <rect
        x="8.4436"
        y="42.3848"
        width="4"
        height="12"
        rx="2"
        transform="rotate(-135 8.4436 42.3848)"
        fill={secondaryColor}
        className="bar4"
      />

      {/* Bar 8: 10:30 position - 135deg rotation offset */}
      <rect
        x="33.8994"
        y="16.9288"
        width="4"
        height="12"
        rx="2"
        transform="rotate(-135 33.8994 16.9288)"
        fill={secondaryColor}
        className="bar8"
      />
    </svg>
  );
};

export default AnimatedSpinner;