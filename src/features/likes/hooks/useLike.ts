/**
 * @fileoverview Hook for managing like/unlike state of a song with real-time synchronization.
 *
 * Responsibilities:
 * - Subscribe to Firestore to track whether current user has liked a specific song
 * - Provide toggleLike function to add or remove like (with transaction support)
 * - Handle loading state while subscription initializes
 *
 * Related modules:
 * - likeService (src/features/likes/services/likeService.ts) - Contains toggleLikeTransaction
 * - SongCard (src/features/songs/components/SongCard.tsx) - Consumes this hook for like button
 * - LikedSongs page - Uses similar pattern for displaying liked songs
 *
 * Architectural role:
 * - **Like state manager** for individual songs
 * - Provides real-time like status across multiple devices/tabs
 * - Handles Firestore transaction to keep song likeCount in sync with likedSongs subcollection
 *
 * Firestore data model (from HANDOFF_CORE.md):
 * - Liked songs subcollection: /users/{uid}/likedSongs/{songId}
 *   - Document fields: { createdAt: Timestamp }
 *   - Document ID = songId (ensures uniqueness)
 * - Song document: /songs/{songId}
 *   - Field: likeCount (aggregated total)
 *
 * Transaction guarantee (via toggleLikeTransaction):
 * - When liking: Adds document to likedSongs + increments song.likeCount
 * - When unliking: Deletes document from likedSongs + decrements song.likeCount
 * - Both operations succeed or fail together (atomic)
 *
 * Real-time behavior:
 * - onSnapshot on /users/{uid}/likedSongs/{songId} triggers on any change
 * - If user likes song on another device, isLiked updates automatically
 * - No need to manually refresh or poll
 *
 * Suspension awareness:
 * - Firestore security rules block writes for suspended users (isWriteable() = false)
 * - toggleLike will fail silently (transaction rejected by security rules)
 * - SuspensionContext handles showing toast notification for blocked writes
 *
 * Performance:
 * - Single document subscription per song (lightweight)
 * - useEffect cleanup prevents memory leaks
 * - No unnecessary re-renders (state updates only when like status changes)
 *
 * @module features/likes/hooks
 */

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/services/firebase/config";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { toggleLikeTransaction } from "../services/likeService";

/**
 * Return type for useLike hook.
 *
 * @property isLiked - Whether current user has liked the song
 * @property toggleLike - Function to toggle like status (handles both like and unlike)
 * @property loading - True while initial like status is being fetched
 */
interface UseLikeReturn {
  isLiked: boolean;
  toggleLike: () => Promise<void>;
  loading: boolean;
}

/**
 * useLike - Hook for managing like status of a song.
 *
 * @param songId - ID of the song to track like status for
 * @returns Object containing isLiked status, toggleLike function, and loading state
 *
 * @example
 * ```tsx
 * const { isLiked, toggleLike, loading } = useLike(song.id);
 *
 * return (
 *   <button onClick={toggleLike} disabled={loading}>
 *     {isLiked ? 'Unlike' : 'Like'}
 *   </button>
 * );
 * ```
 */
export const useLike = (songId: string): UseLikeReturn => {
  const { user } = useAuth();

  /** Whether the current user has liked this song */
  const [isLiked, setIsLiked] = useState(false);

  /** True while initial subscription is establishing (first snapshot pending) */
  const [loading, setLoading] = useState(true);

  /**
   * Effect: Subscribe to like status for the given song.
   *
   * Subscribes to document: /users/{uid}/likedSongs/{songId}
   * - Document exists → user has liked the song
   * - Document does not exist → user has not liked the song
   *
   * Cleanup: Unsubscribes on unmount or when user/songId changes.
   */
  useEffect(() => {
    // No user logged in: can't have liked songs
    if (!user) return;

    const likeRef = doc(db, "users", user.uid, "likedSongs", songId);

    /**
     * onSnapshot provides real-time updates:
     * - Initial snapshot fires immediately
     * - Subsequent snapshots fire when document is created or deleted
     */
    const unsubscribe = onSnapshot(likeRef, (docSnap) => {
      setIsLiked(docSnap.exists());
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, songId]);

  /**
   * Toggles like status for the song.
   *
   * Calls toggleLikeTransaction which:
   * - If not liked: Creates likedSongs document + increments song.likeCount
   * - If liked: Deletes likedSongs document + decrements song.likeCount
   *
   * Atomic operation: Both subcollection and counter stay in sync.
   *
   * Note: No try/catch needed here - errors are handled by the service
   * and can be caught by the caller if needed.
   */
  const toggleLike = async (): Promise<void> => {
    if (!user) return;
    await toggleLikeTransaction(user.uid, songId);
  };

  return { isLiked, toggleLike, loading };
};