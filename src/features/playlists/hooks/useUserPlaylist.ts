/**
 * @fileoverview Hook for real-time subscription to current user's playlists.
 *
 * Responsibilities:
 * - Subscribe to Firestore playlists collection filtered by current user ID
 * - Provide real-time updates when playlists are added, updated, or deleted
 * - Handle loading and error states during subscription
 * - Clean up subscription on unmount
 *
 * Related modules:
 * - playlistService (src/features/playlists/services/playlistService.ts) - Playlist type definition
 * - PlaylistList (src/features/playlists/components/PlaylistList.tsx) - Consumes this hook
 *
 * Architectural role:
 * - **Real-time data provider** for user's playlists in Sidebar and LibraryPage
 * - Uses Firestore onSnapshot for live updates across devices/tabs
 * - Preferred over usePlaylists for real-time scenarios
 *
 * Firestore data model (from HANDOFF_CORE.md):
 * - Collection: /playlists/{playlistId}
 * - Query: where("userId", "==", currentUser.uid) + orderBy("createdAt", "desc")
 * - Real-time: onSnapshot triggers on any document change
 *
 * Real-time behavior:
 * - Initial snapshot loads all user playlists
 * - Subsequent snapshots fire when playlists are created, updated, or deleted
 * - No manual refresh needed (unsubscribe handles cleanup)
 *
 * Error handling:
 * - Listener errors captured in onSnapshot error callback
 * - Error state propagated to consuming component
 * - Console.error for debugging
 *
 * Performance:
 * - Single Firestore subscription per hook instance
 * - orderBy("createdAt") requires composite index (userId + createdAt)
 * - Cleanup prevents memory leaks
 *
 * @module features/playlists/hooks
 */

import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "@/services/firebase/config";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { Playlist } from "../services/playlistService";

/**
 * Return type for useUserPlaylists hook.
 *
 * @property playlists - Array of user's playlists (real-time updates)
 * @property loading - True while initial subscription is establishing
 * @property error - Error message if subscription fails, null otherwise
 */
interface UseUserPlaylistsReturn {
  playlists: Playlist[];
  loading: boolean;
  error: string | null;
}

/**
 * useUserPlaylists - Hook for real-time subscription to current user's playlists.
 *
 * @returns Object containing playlists, loading state, and error state
 *
 * @example
 * ```tsx
 * const { playlists, loading, error } = useUserPlaylists();
 *
 * if (loading) return <Spinner />;
 * if (error) return <ErrorMessage message={error} />;
 * return playlists.map(p => <PlaylistItem key={p.id} playlist={p} />);
 * ```
 */
export const useUserPlaylists = (): UseUserPlaylistsReturn => {
  const { user } = useAuth();

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // No authenticated user: return empty array
    if (!user) {
      setPlaylists([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Query: /playlists where userId == current user, ordered by createdAt desc
    const q = query(
      collection(db, "playlists"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
    );

    // Real-time subscription
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data: Playlist[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Playlist, "id">),
        }));

        setPlaylists(data);
        setLoading(false);
      },
      (err) => {
        console.error("Playlist listener error:", err);
        setError("Failed to load playlists");
        setLoading(false);
      },
    );

    // Cleanup: unsubscribe on unmount or when user.uid changes
    return () => unsubscribe();
  }, [user?.uid]);

  return { playlists, loading, error };
};