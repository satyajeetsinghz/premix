/**
 * @fileoverview useMediaQuery – subscribes to a CSS media query.
 *
 * Returns true when the query matches, false otherwise.
 * Initialises to false (safe for SSR / before hydration).
 * Cleans up the listener on unmount or query change.
 */

import { useState, useEffect } from "react";

export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    // Sync immediately after mount
    setMatches(mql.matches);

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
};