/**
 * @fileoverview Hook for real-time subscription to songs collection.
 *
 * Responsibilities:
 * - Subscribe to Firestore songs collection with real-time updates
 * - Order songs by createdAt descending (newest first)
 * - Provide loading state during initial subscription
 * - Clean up subscription on component unmount
 *
 * Related modules:
 * - HomePage (src/features/home/pages/HomePage.tsx) - Uses this hook to display songs in sections
 * - LibraryPage (src/features/library/pages/LibraryPage.tsx) - Uses this hook for song counts
 * - DynamicSection (src/features/sections/components/DynamicSection.tsx) - Filters songs by sectionId
 * - SongManager (src/features/admin/components/SongManager.tsx) - Uses this hook for admin management
 * - useHistory (src/features/history/hooks/useHistory.ts) - Maps history IDs to full song objects
 * - useLikedSongs (src/features/likes/hooks/useLikedSongs.ts) - Resolves liked song IDs to songs
 *
 * Architectural role:
 * - **Real-time data provider** for all song-related components
 * - Centralizes Firestore query logic for songs collection
 * - Single source of truth for song catalog across the app
 *
 * Firestore data model (from HANDOFF_CORE.md):
 * - Collection: /songs/{songId}
 * - Document fields:
 *   - title: string (required)
 *   - artist: string (required)
 *   - audioUrl: string (Cloudinary URL)
 *   - coverUrl: string (Cloudinary URL)
 *   - sectionIds: string[] (array of section IDs this song belongs to)
 *   - likeCount: number (aggregated total likes)
 *   - duration: string (optional, MM:SS format)
 *   - album: string (optional)
 *   - createdAt: serverTimestamp (used for ordering)
 *
 * Query details:
 * - orderBy("createdAt", "desc"): Newest songs first
 * - No where clause: Returns ALL songs (catalog is public to authenticated users)
 *
 * Real-time behavior:
 * - onSnapshot triggers on initial load and on any document change
 * - Songs added/updated/deleted reflect instantly in UI
 * - Unsubscribe cleanup prevents memory leaks
 *
 * Performance:
 * - Single Firestore subscription shared across all consuming components
 * - Each consumer receives the same songs array reference (React context would be better, but hook works)
 * - For large catalogs, consider pagination (not currently implemented)
 *
 * Security boundary (from Firestore security rules):
 * - Read: isAuthenticated() AND isReadable() (suspended users can read)
 * - Write: isActiveAdmin() (create, update, delete)
 * - likeCount updates: isAuthenticated() AND isWriteable() (active users only)
 *
 * @module features/songs/hooks
 */

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/services/firebase/config";
import { ISong } from "../types";

/**
 * Return type for useSongs hook.
 *
 * @property songs - Array of all songs from Firestore (ordered by createdAt desc)
 * @property loading - True while initial subscription is establishing
 */
interface UseSongsReturn {
  songs: ISong[];
  loading: boolean;
}

/**
 * useSongs - Hook for real-time subscription to the songs collection.
 *
 * @returns Object containing songs array and loading state
 *
 * @example
 * ```tsx
 * const { songs, loading } = useSongs();
 *
 * if (loading) return <Spinner />;
 * return songs.map(song => <SongCard key={song.id} track={song} songs={songs} />);
 * ```
 */
export const useSongs = (): UseSongsReturn => {
  /**
   * State for storing all songs fetched from Firestore.
   * Initialized as empty array.
   */
  const [songs, setSongs] = useState<ISong[]>([]);

  /**
   * Loading state - true until the first snapshot arrives from Firestore.
   * Used to show loading indicators while initial data is being fetched.
   */
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    /**
     * Query configuration:
     * - Collection: "songs" (top-level collection)
     * - Order: createdAt descending (newest songs first)
     *
     * Why createdAt desc?
     * - Homepage sections show newer songs prominently
     * - Admin panel shows newest songs at top of table
     */
    const q = query(collection(db, "songs"), orderBy("createdAt", "desc"));

    /**
     * Real-time subscription to songs collection.
     * onSnapshot provides three key benefits:
     * 1. Initial data load (fires immediately)
     * 2. Real-time updates on any document change (add, update, delete)
     * 3. Automatic cleanup via returned unsubscribe function
     *
     * The callback receives a QuerySnapshot containing all documents
     * that match the query (no filtering, all songs).
     */
    const unsubscribe = onSnapshot(q, (snapshot) => {
      /**
       * Transform Firestore documents to ISong objects.
       *
       * Mapping steps:
       * 1. snapshot.docs: Array of QueryDocumentSnapshot objects
       * 2. .map(): Transform each document
       *    - doc.id: Firestore document ID (song ID)
       *    - doc.data(): Document fields (title, artist, coverUrl, etc.)
       * 3. Spread operator combines id and data into single object
       *
       * Type assertion "as ISong[]" tells TypeScript the resulting array
       * matches the ISong interface.
       */
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ISong[];

      // Update state with new songs array
      setSongs(data);

      // Mark loading as complete (first snapshot has arrived)
      setLoading(false);
    });

    /**
     * Cleanup function: Unsubscribe from Firestore listener when component unmounts.
     *
     * Why is this important?
     * - Prevents memory leaks from lingering subscriptions
     * - Stops unnecessary network activity when component is no longer in use
     * - React strict mode will call this on unmount and remount
     */
    return () => unsubscribe();
  }, []); // Empty dependency array: subscribe once on component mount

  return { songs, loading };
};