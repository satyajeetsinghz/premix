/**
 * @fileoverview Custom hook for fetching and managing user play history.
 *
 * Responsibilities:
 * - Subscribe to real-time updates of user's history subcollection
 * - Map history document IDs to full song objects from songs catalog
 * - Provide loading and error states
 * - Support manual refresh capability
 *
 * Related modules:
 * - historyService (src/features/history/services/historyService.ts) - Contains subscribeToHistory function
 * - useSongs (src/features/songs/hooks/useSongs.ts) - Provides song catalog for mapping
 * - RecentlyPlayed (src/features/history/components/RecentlyPlayed.tsx) - Consumes this hook
 *
 * Architectural role:
 * - **Data orchestration layer** for user listening history
 * - Combines two Firestore sources: user history subcollection + songs collection
 * - Returns fully populated song objects (not just IDs)
 *
 * Firestore data model (from HANDOFF_CORE.md):
 * - Collection: /users/{uid}/history/{trackId}
 * - Document fields: { trackId: string, lastPlayedAt: Timestamp }
 * - Document ID = trackId (no duplicates per user)
 *
 * Data flow:
 * 1. subscribeToHistory listens to /users/{uid}/history subcollection
 * 2. Returns array of track IDs (ordered by lastPlayedAt descending)
 * 3. useSongs provides full song catalog from /songs collection
 * 4. useMemo maps IDs to song objects (preserves order)
 *
 * Real-time behavior:
 * - When user plays a new track, history document is created/updated
 * - subscribeToHistory triggers callback with updated IDs
 * - Component re-renders with new historyTracks
 *
 * Performance considerations:
 * - useMemo prevents re-mapping on every render (only when historyIds or songs change)
 * - songsLoading tracked separately (history may load faster than songs)
 * - Multiple timeouts used to prevent React batch update warnings (see note below)
 *
 * Note about setTimeout(..., 0):
 * - Used to break React batch update cycles
 * - Prevents "Cannot update a component while rendering another component" warnings
 * - Alternative to useTransition or useDeferredValue (simpler for this case)
 *
 * Suspension awareness:
 * - Hook works for suspended users (read access only)
 * - Suspended users can view history but cannot add new tracks
 * - No write operations performed by this hook
 *
 * @module features/history/hooks
 */

import { useEffect, useState, useMemo } from "react";
import { subscribeToHistory } from "../services/historyService";
import { useSongs } from "@/features/songs/hooks/useSongs";
import { ISong } from "@/features/songs/types";

/**
 * Return type for useHistory hook.
 *
 * @property historyTracks - Array of full song objects in history (ordered most recent first)
 * @property loading - True if either history or songs are still loading
 * @property error - Error object if subscription or mapping fails
 * @property refresh - Function to manually refresh history subscription
 */
interface UseHistoryReturn {
  historyTracks: ISong[];
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

/**
 * useHistory - Hook for accessing user's play history.
 *
 * @param uid - User ID (from Firebase Auth). Empty string returns empty history.
 * @returns Object containing historyTracks, loading state, error, and refresh function
 *
 * @example
 * ```tsx
 * const { historyTracks, loading, refresh } = useHistory(user?.uid ?? '');
 *
 * if (loading) return <LoadingSpinner />;
 * return <SongList songs={historyTracks} />;
 * ```
 */
export const useHistory = (uid: string): UseHistoryReturn => {
  const { songs, loading: songsLoading } = useSongs();

  /**
   * Array of track IDs from user's history subcollection.
   * Order matches Firestore query (lastPlayedAt descending).
   */
  const [historyIds, setHistoryIds] = useState<string[]>([]);

  /** Loading state for history subscription */
  const [loading, setLoading] = useState<boolean>(true);

  /** Error state for subscription failures */
  const [error, setError] = useState<Error | null>(null);

  /** Refresh key - increments to force subscription re-creation */
  const [refreshKey, setRefreshKey] = useState<number>(0);

  /**
   * Effect: Subscribe to user's history subcollection.
   *
   * Steps:
   * 1. If no uid, return empty history and clear loading
   * 2. Set loading = true, clear error
   * 3. Call subscribeToHistory with callback
   * 4. On success: update historyIds, set loading = false
   * 5. On error: set error state, set loading = false
   * 6. Cleanup: unsubscribe on unmount or when uid/refreshKey changes
   *
   * The setTimeout(..., 0) calls are used to break React batch update cycles,
   * preventing state update warnings during component lifecycle.
   *
   * Dependencies: uid, refreshKey (refresh forces re-subscription)
   */
  useEffect(() => {
    // No user ID: return empty history immediately
    if (!uid) {
      const timer = setTimeout(() => {
        setHistoryIds([]);
        setLoading(false);
      }, 0);
      return () => clearTimeout(timer);
    }

    // Set loading state (next tick to avoid batch updates)
    const loadingTimer = setTimeout(() => {
      setLoading(true);
      setError(null);
    }, 0);

    let unsubscribe: (() => void) | undefined;

    const setupSubscription = () => {
      try {
        unsubscribe = subscribeToHistory(uid, (ids) => {
          setHistoryIds(ids);
          setLoading(false);
        });
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error("Failed to fetch history"),
        );
        setLoading(false);
      }
    };

    // Delay subscription setup to next tick
    const subscriptionTimer = setTimeout(setupSubscription, 0);

    // Cleanup: clear timers and unsubscribe
    return () => {
      clearTimeout(loadingTimer);
      clearTimeout(subscriptionTimer);
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [uid, refreshKey]);

  /**
   * Memoized: Map history IDs to full song objects.
   *
   * Steps:
   * 1. If no history IDs or songs not loaded → return empty array
   * 2. Map each ID to corresponding song object from songs array
   * 3. Filter out undefined values (songs that no longer exist)
   *
   * Maintains original order from historyIds (most recent first).
   *
   * Performance: Recalculates only when historyIds or songs change.
   */
  const historyTracks = useMemo(() => {
    if (!historyIds.length || !songs.length) return [];

    return historyIds
      .map((id) => songs.find((song) => song.id === id))
      .filter((song): song is ISong => Boolean(song));
  }, [historyIds, songs]);

  /**
   * Forces refresh of history subscription.
   *
   * Increments refreshKey, triggering useEffect re-run.
   * Useful after clearing history or manual refresh actions.
   */
  const refresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return {
    historyTracks,
    loading: loading || songsLoading, // Loading until both history AND songs are ready
    error,
    refresh,
  };
};