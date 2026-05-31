/**
 * @fileoverview One-time fetch service for retrieving all songs from Firestore.
 *
 * Responsibilities:
 * - Fetch all songs from Firestore using getDocs (one-time read, no real-time)
 * - Transform Firestore documents to ISong objects
 * - Return typed array of songs
 *
 * Related modules:
 * - usePlaylists (src/features/playlists/hooks/usePlaylists.ts) - May use this for playlist song lookup
 * - Any component that needs a one-time song fetch without real-time subscription
 *
 * Architectural role:
 * - **Alternative data fetching method** for scenarios where real-time updates aren't needed
 * - Complement to useSongs hook (which provides real-time subscription)
 * - Useful for: server-side operations, batch processing, non-reactive contexts
 *
 * Difference from useSongs:
 * - useSongs: Real-time subscription (onSnapshot) - stays in sync automatically
 * - fetchSongs: One-time fetch (getDocs) - static snapshot, no updates
 *
 * Use cases:
 * - Admin batch operations (export, processing)
 * - Initial data load before establishing real-time subscription
 * - Non-React contexts where hooks can't be used
 *
 * Security boundary (from Firestore security rules):
 * - Read: isAuthenticated() AND isReadable() (suspended users can read)
 *
 * Performance:
 * - getDocs performs a single read operation (no ongoing listener)
 * - More efficient for one-time operations
 * - Does not incur real-time listener overhead
 *
 * @module features/songs/services
 */

import { collection, getDocs } from "firebase/firestore";
import { db } from "@/services/firebase/config";
import { ISong } from "../types";

/**
 * Fetches all songs from Firestore in a single read operation.
 *
 * This function performs a one-time fetch of the entire songs collection.
 * Unlike useSongs hook, this does NOT establish a real-time listener.
 *
 * @returns Promise resolving to array of ISong objects
 *
 * @example
 * ```tsx
 * // One-time fetch (no real-time updates)
 * const songs = await fetchSongs();
 * console.log(songs.length);
 * ```
 *
 * @example
 * ```tsx
 * // Batch processing example
 * const allSongs = await fetchSongs();
 * const songTitles = allSongs.map(s => s.title);
 * ```
 */
export const fetchSongs = async (): Promise<ISong[]> => {
  /**
   * Execute one-time read operation on songs collection.
   * getDocs returns a QuerySnapshot containing all documents.
   *
   * Performance note: For large catalogs (>1000 songs), consider
   * pagination or limiting query. Current implementation fetches all songs.
   */
  const snapshot = await getDocs(collection(db, "songs"));

  /**
   * Transform Firestore documents to ISong objects.
   *
   * Mapping steps:
   * 1. snapshot.docs: Array of QueryDocumentSnapshot objects
   * 2. .map(): Transform each document
   *    - doc.id: Firestore document ID (song ID)
   *    - doc.data(): Document fields (title, artist, coverUrl, etc.)
   *    - Omit<ISong, "id">: Ensures data shape matches except id field
   *
   * Type assertion ensures the result matches ISong[] interface.
   */
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<ISong, "id">),
  }));
};