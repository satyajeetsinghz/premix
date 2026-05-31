/**
 * @fileoverview Firestore service for user play history management.
 *
 * Responsibilities:
 * - Add tracks to user's play history (upsert pattern)
 * - Subscribe to real-time history updates
 * - Clear all history documents for a user
 *
 * Related modules:
 * - useHistory (src/features/history/hooks/useHistory.ts) - Consumes subscribeToHistory
 * - RecentlyPlayed (src/features/history/components/RecentlyPlayed.tsx) - Uses clearHistory
 * - PlayerBar (src/features/player/components/PlayerBar.tsx) - Calls addToHistory when track plays
 *
 * Architectural role:
 * - **Data persistence layer** for user listening history
 * - Works with Firestore subcollection: /users/{uid}/history
 * - Supports real-time subscriptions for reactive UI updates
 *
 * Firestore data model (from HANDOFF_CORE.md):
 * - Collection path: /users/{uid}/history/{trackId}
 * - Document ID: trackId (ensures uniqueness per user per track)
 * - Document fields:
 *   - trackId: string (same as document ID)
 *   - lastPlayedAt: serverTimestamp (updated on each play)
 *
 * Upsert pattern (addToHistory):
 * - Uses setDoc instead of addDoc
 * - Document ID = trackId (no auto-generated IDs)
 * - Overwrites existing document if track already in history
 * - Updates lastPlayedAt to current timestamp
 * - Results in single document per track per user (no duplicate history entries)
 *
 * Security boundary (from Firestore security rules):
 * - Write: isOwner(uid) AND isWriteable() (active users only)
 * - Read: isOwner(uid) AND isReadable() (suspended users can read)
 * - Delete: isOwner(uid) OR isActiveAdmin() (admins can clear any user's history)
 *
 * Real-time behavior:
 * - subscribeToHistory uses onSnapshot for live updates
 * - Callback fires on initial load and on any change
 * - Returns unsubscribe function for cleanup
 *
 * Performance considerations:
 * - clearHistory uses getDocs + Promise.all (batch delete)
 * - No Firestore batch (individual deletes) - acceptable for small history size
 * - History typically limited to 50-100 tracks per user
 *
 * @module features/history/services
 */

import {
  doc,
  setDoc,
  collection,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  getDocs,
  deleteDoc,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "@/services/firebase/config";

/**
 * Adds or updates a track in user's play history.
 *
 * Upsert behavior:
 * - If track already in history: updates lastPlayedAt timestamp
 * - If track not in history: creates new document
 *
 * Why upsert instead of append-only?
 * - Prevents duplicate entries for the same track
 * - Maintains single document per track per user
 * - lastPlayedAt always reflects most recent play time
 *
 * Called from:
 * - PlayerBar when track completes or advances
 * - Any component that needs to record a play event
 *
 * @param uid - User ID (from Firebase Auth)
 * @param trackId - Song document ID to add to history
 * @returns Promise that resolves when Firestore write completes
 *
 * @example
 * ```tsx
 * await addToHistory(user.uid, currentTrack.id);
 * ```
 */
export const addToHistory = async (uid: string, trackId: string): Promise<void> => {
  // Document path: /users/{uid}/history/{trackId}
  const historyRef = doc(db, "users", uid, "history", trackId);

  await setDoc(historyRef, {
    trackId,
    lastPlayedAt: serverTimestamp(),
  });
};

/**
 * Subscribes to real-time updates of user's play history.
 *
 * Query:
 * - Collection: /users/{uid}/history
 * - Order: lastPlayedAt descending (most recent first)
 *
 * Real-time events trigger callback when:
 * - New track added to history
 * - Existing track's lastPlayedAt updates
 * - Track deleted from history (clearHistory or individual delete)
 *
 * Memory management: Caller must unsubscribe on component unmount.
 *
 * @param uid - User ID (from Firebase Auth)
 * @param callback - Function called with ordered array of track IDs on every change
 * @returns Unsubscribe function to stop listening
 *
 * @example
 * ```tsx
 * useEffect(() => {
 *   const unsubscribe = subscribeToHistory(uid, (trackIds) => {
 *     setHistoryIds(trackIds);
 *   });
 *   return unsubscribe;
 * }, [uid]);
 * ```
 */
export const subscribeToHistory = (
  uid: string,
  callback: (trackIds: string[]) => void,
): Unsubscribe => {
  const historyCollection = collection(db, "users", uid, "history");
  const q = query(historyCollection, orderBy("lastPlayedAt", "desc"));

  return onSnapshot(q, (snapshot) => {
    // Extract trackId from each document (matches document ID)
    const trackIds = snapshot.docs.map((doc) => doc.data().trackId as string);
    callback(trackIds);
  });
};

/**
 * Deletes all history documents for a user.
 *
 * Steps:
 * 1. Fetch all documents in /users/{uid}/history subcollection
 * 2. Create delete promises for each document
 * 3. Execute all deletes in parallel (Promise.all)
 *
 * Performance:
 * - Uses Promise.all for parallel deletion (faster than sequential)
 * - No batch write (individual deletes) - acceptable for typical history size (50-100 docs)
 * - For very large history, consider batched writes (not needed for this use case)
 *
 * Called from:
 * - RecentlyPlayed component's "Clear History" button
 * - Admin user management (when deleting user account)
 *
 * @param uid - User ID (from Firebase Auth)
 * @returns Promise that resolves when all history documents are deleted
 *
 * @example
 * ```tsx
 * await clearHistory(user.uid);
 * // History subcollection is now empty
 * ```
 */
export const clearHistory = async (uid: string): Promise<void> => {
  const historyRef = collection(db, "users", uid, "history");
  const snapshot = await getDocs(historyRef);

  // Create delete promise for each document
  const deletePromises = snapshot.docs.map((document) =>
    deleteDoc(doc(db, "users", uid, "history", document.id)),
  );

  // Execute all deletes in parallel
  await Promise.all(deletePromises);
};