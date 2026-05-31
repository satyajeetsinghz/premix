/**
 * @fileoverview Firestore transaction for atomic like/unlike operations on songs.
 *
 * Responsibilities:
 * - Toggle like status for a song (add if not liked, remove if liked)
 * - Keep liked songs subcollection and song likeCount in sync
 * - Execute atomic transaction to prevent data inconsistency
 *
 * Related modules:
 * - useLike (src/features/likes/hooks/useLike.ts) - Consumes this transaction
 * - LikedSongs page (src/features/likes/pages/LikedSongs.tsx) - Uses this for unlike operations
 * - SongCard (src/features/songs/components/SongCard.tsx) - Uses this for like/unlike
 *
 * Architectural role:
 * - **Atomic write coordination** for like operations
 * - Ensures two Firestore writes succeed or fail together
 * - Prevents scenarios where likeCount desyncs from likedSongs subcollection
 *
 * Firestore data model (from HANDOFF_CORE.md):
 * - Liked songs subcollection: /users/{uid}/likedSongs/{songId}
 *   - Document fields: { createdAt: Timestamp }
 *   - Document exists → user has liked the song
 * - Song document: /songs/{songId}
 *   - Field: likeCount (aggregated total for sorting/display)
 *
 * Transaction guarantee:
 * - Both operations (like subcollection + song likeCount) complete atomically
 * - If either operation fails, both are rolled back
 * - Retries automatically on contention (Firestore handles retries)
 *
 * Like flow:
 * 1. Check if like document exists in /users/{uid}/likedSongs/{songId}
 * 2. If DOES NOT exist (user hasn't liked): 
 *    - Create like document with createdAt timestamp
 *    - Increment song.likeCount by 1
 * 3. If DOES exist (user has liked):
 *    - Delete like document
 *    - Decrement song.likeCount by 1
 *
 * Security boundary (from Firestore security rules):
 * - Write to likedSongs: isOwner(uid) AND isWriteable() (active users only)
 * - Update song.likeCount: isAuthenticated() AND isWriteable()
 * - Transaction respects security rules (rejected if user is suspended)
 *
 * Suspension awareness:
 * - Suspended users cannot like/unlike (isWriteable() = false)
 * - Transaction will fail with permission denied
 * - UI should disable like buttons for suspended users
 *
 * Performance:
 * - Single Firestore transaction (atomic, minimal overhead)
 * - increment() is a Firestore field transform (no read-modify-write race conditions)
 *
 * Edge cases:
 * - Song document doesn't exist: transaction will fail (songRef doesn't exist)
 * - User likes same song multiple times: transaction prevents duplicate documents
 * - Race conditions: Firestore transaction retries on contention
 *
 * @module features/likes/services
 */

import { doc, runTransaction, increment } from "firebase/firestore";
import { db } from "@/services/firebase/config";

/**
 * Toggles like status for a song by a user.
 *
 * This function performs an atomic transaction that either:
 * - Adds a like (creates likedSongs doc + increments song.likeCount)
 * - Removes a like (deletes likedSongs doc + decrements song.likeCount)
 *
 * @param userId - User ID (from Firebase Auth)
 * @param songId - Song document ID to like/unlike
 * @returns Promise that resolves when transaction completes
 * @throws {Error} If transaction fails (network, permissions, or document missing)
 *
 * @example
 * ```tsx
 * // Like a song
 * await toggleLikeTransaction(user.uid, song.id);
 *
 * // Unlike the same song (call again)
 * await toggleLikeTransaction(user.uid, song.id);
 * ```
 */
export const toggleLikeTransaction = async (userId: string, songId: string): Promise<void> => {
  /**
   * Reference to user's like document for this song.
   * Path: /users/{userId}/likedSongs/{songId}
   * Document ID matches songId for easy lookup.
   */
  const userLikeRef = doc(db, "users", userId, "likedSongs", songId);

  /**
   * Reference to the song document.
   * Path: /songs/{songId}
   */
  const songRef = doc(db, "songs", songId);

  /**
   * Execute atomic transaction.
   * Firestore automatically retries on contention (max 5 attempts).
   */
  await runTransaction(db, async (transaction) => {
    // Read current like document (exists check)
    const likeDoc = await transaction.get(userLikeRef);

    if (likeDoc.exists()) {
      // --- Unlike flow: Remove like ---
      // 1. Delete like document from user's subcollection
      transaction.delete(userLikeRef);
      // 2. Decrement song's total like count
      transaction.update(songRef, {
        likeCount: increment(-1),
      });
    } else {
      // --- Like flow: Add like ---
      // 1. Create like document with creation timestamp
      transaction.set(userLikeRef, {
        createdAt: new Date(), // Firestore serverTimestamp could be used, but Date.now() is sufficient
      });
      // 2. Increment song's total like count
      transaction.update(songRef, {
        likeCount: increment(1),
      });
    }
  });
};