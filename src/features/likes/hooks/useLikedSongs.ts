/**
 * @fileoverview Hook for fetching and subscribing to user's liked songs with full song data.
 *
 * Responsibilities:
 * - Subscribe to real-time updates of user's liked songs subcollection
 * - Fetch full song objects for each liked song ID
 * - Provide loading state while initial data is being fetched
 *
 * Related modules:
 * - getLikedSongs (src/features/likes/services/getLikedSongs.ts) - Contains subscribeToLikedSongs service
 * - LikedSongs page (src/features/likes/pages/LikedSongs.tsx) - Uses this hook to display liked songs
 * - SongCard (src/features/songs/components/SongCard.tsx) - Used to render each liked song
 *
 * Architectural role:
 * - **Data aggregation layer** for liked songs
 * - Combines two Firestore sources: liked songs subcollection + songs collection
 * - Returns fully populated song objects (not just IDs)
 *
 * Firestore data model (from HANDOFF_CORE.md):
 * - Liked songs subcollection: /users/{uid}/likedSongs/{songId}
 *   - Document fields: { createdAt: Timestamp }
 *   - Document ID = songId
 * - Songs collection: /songs/{songId}
 *   - Full song metadata (title, artist, coverUrl, audioUrl, etc.)
 *
 * Data flow:
 * 1. subscribeToLikedSongs listens to /users/{uid}/likedSongs subcollection
 * 2. Returns array of song IDs (ordered by createdAt descending)
 * 3. Fetch full song objects by ID from songs collection
 * 4. Return array of ISong objects for rendering
 *
 * Real-time behavior:
 * - When user likes a song: document created → callback fires → UI updates
 * - When user unlikes a song: document deleted → callback fires → UI updates
 * - When song metadata changes (admin edit): real-time updates reflect automatically
 *
 * Performance:
 * - Uses onSnapshot for real-time updates (single subscription to likedSongs)
 * - Individual song subscriptions handled by subscribeToLikedSongs service
 * - No polling or manual refresh needed
 *
 * Suspension awareness:
 * - Suspended users can read liked songs (isReadable() = true)
 * - Cannot like/unlike (isWriteable() = false) - hook doesn't perform writes
 *
 * @module features/likes/hooks
 */

import { useState, useEffect } from "react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { subscribeToLikedSongs } from "@/features/likes/services/getLikedSongs";
import { ISong } from "@/features/songs/types";

/**
 * Return type for useLikedSongs hook.
 *
 * @property likedSongs - Array of full song objects liked by the user (ordered most recent first)
 * @property loading - True while initial data is being fetched
 */
interface UseLikedSongsReturn {
  likedSongs: ISong[];
  loading: boolean;
}

/**
 * useLikedSongs - Hook for accessing user's liked songs with real-time updates.
 *
 * @returns Object containing likedSongs array and loading state
 *
 * @example
 * ```tsx
 * const { likedSongs, loading } = useLikedSongs();
 *
 * if (loading) return <LoadingSpinner />;
 * return likedSongs.map(song => <SongCard key={song.id} song={song} />);
 * ```
 */
export const useLikedSongs = (): UseLikedSongsReturn => {
  const { user } = useAuth();

  /** Array of liked songs (full song objects) */
  const [likedSongs, setLikedSongs] = useState<ISong[]>([]);

  /** True while initial subscription is establishing */
  const [loading, setLoading] = useState(true);

  /**
   * Effect: Subscribe to user's liked songs with real-time updates.
   *
   * Steps:
   * 1. If no user logged in: return empty array, clear loading
   * 2. Call subscribeToLikedSongs with user ID and callback
   * 3. Callback receives array of song objects (full metadata)
   * 4. Update likedSongs state and set loading = false
   * 5. Cleanup: unsubscribe on unmount or when user changes
   *
   * Dependency: user (re-runs when user logs in/out)
   */
  useEffect(() => {
    // No authenticated user: return empty liked songs
    if (!user) {
      setLikedSongs([]);
      setLoading(false);
      return;
    }

    /**
     * Subscribe to real-time liked songs updates.
     * The service handles:
     * - Listening to /users/{uid}/likedSongs subcollection
     * - Fetching full song objects for each liked song ID
     * - Maintaining order by createdAt (newest first)
     */
    const unsubscribe = subscribeToLikedSongs(user.uid, (songs) => {
      setLikedSongs(songs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  return { likedSongs, loading };
};