/**
 * @fileoverview Service for subscribing to user's liked songs with real-time updates.
 *
 * Responsibilities:
 * - Subscribe to real-time changes in user's liked songs subcollection
 * - Fetch full song objects for each liked song ID
 * - Return ordered array of liked songs with complete metadata
 *
 * Related modules:
 * - useLikedSongs (src/features/likes/hooks/useLikedSongs.ts) - Consumes this service
 * - LikedSongs page (src/features/likes/pages/LikedSongs.tsx) - Uses this service directly
 *
 * Architectural role:
 * - **Data aggregation layer** between Firestore and UI components
 * - Combines liked songs subcollection with songs collection
 * - Provides type-safe callback for real-time updates
 *
 * Firestore data model (from HANDOFF_CORE.md):
 * - Liked songs subcollection: /users/{uid}/likedSongs/{songId}
 *   - Document fields: { createdAt: Timestamp }
 *   - Document ID = songId
 * - Songs collection: /songs/{songId}
 *   - Full song metadata (title, artist, coverUrl, audioUrl, etc.)
 *
 * Data flow:
 * 1. onSnapshot listens to /users/{uid}/likedSongs subcollection
 * 2. When snapshot changes, iterate through document IDs (song IDs)
 * 3. For each song ID, fetch full song document from /songs collection
 * 4. Collect resolved song objects into array
 * 5. Return array via callback (caller handles ordering/display)
 *
 * Real-time behavior:
 * - When user likes a song: document created → snapshot triggers → fetches new song → callback fires
 * - When user unlikes a song: document deleted → snapshot triggers → excludes removed song → callback fires
 * - When song metadata changes (admin edit): NOT automatically reflected
 *   - Songs are fetched on each snapshot (no caching)
 *   - Subsequent like/unlike will re-fetch all songs (includes updated metadata)
 *
 * Performance considerations:
 * - Sequential getDoc calls for each liked song (not parallel)
 *   - Avoids rate limiting on large liked song collections
 *   - Typical liked songs count < 500, sequential is acceptable
 * - No caching: re-fetches all songs on every snapshot
 *   - Trade-off: simpler implementation vs network efficiency
 *   - Could optimize with in-memory cache if needed
 *
 * Security boundary (from Firestore security rules):
 * - Read access: isOwner(uid) AND isReadable() (suspended users can read)
 * - Songs collection read: isAuthenticated() AND isReadable()
 *
 * Potential improvements:
 * - Parallel fetching with Promise.all for better performance
 * - Order by createdAt descending (newest liked first)
 * - Memoization to avoid re-fetching unchanged songs
 *
 * @module features/likes/services
 */

import { collection, onSnapshot, doc, getDoc, Unsubscribe } from "firebase/firestore";
import { db } from "@/services/firebase/config";
import { ISong } from "@/features/songs/types";

/**
 * Subscribes to real-time updates of user's liked songs.
 *
 * @param userId - User ID (from Firebase Auth)
 * @param callback - Function called with array of liked songs on every change
 * @returns Unsubscribe function to stop listening
 *
 * @example
 * ```tsx
 * useEffect(() => {
 *   const unsubscribe = subscribeToLikedSongs(user.uid, (songs) => {
 *     setLikedSongs(songs);
 *   });
 *   return unsubscribe;
 * }, [user]);
 * ```
 */
export const subscribeToLikedSongs = (
  userId: string,
  callback: (songs: ISong[]) => void,
): Unsubscribe => {
  /**
   * Reference to user's liked songs subcollection.
   * Path: /users/{userId}/likedSongs
   */
  const likedRef = collection(db, "users", userId, "likedSongs");

  /**
   * Real-time listener on liked songs subcollection.
   * Fires on initial load and whenever a document is added or removed.
   */
  return onSnapshot(likedRef, async (snapshot) => {
    const songs: ISong[] = [];

    /**
     * Iterate through each liked song document.
     * Document ID = song ID (no additional data fields except createdAt)
     */
    for (const docSnap of snapshot.docs) {
      const songId = docSnap.id;

      /**
       * Fetch full song document from /songs collection.
       * Note: Sequential await (not Promise.all) to avoid overwhelming Firestore
       * on large liked song collections.
       */
      const songDoc = await getDoc(doc(db, "songs", songId));

      // Only include song if it still exists in catalog
      if (songDoc.exists()) {
        songs.push({
          id: songDoc.id,
          ...(songDoc.data() as Omit<ISong, "id">),
        });
      }
      // If song document doesn't exist, skip it (orphaned liked reference)
    }

    /**
     * Callback with resolved songs array.
     * Note: Order is NOT guaranteed (Firestore doesn't guarantee order without orderBy).
     * Caller should handle sorting if needed (e.g., by createdAt from liked subcollection).
     */
    callback(songs);
  });
};