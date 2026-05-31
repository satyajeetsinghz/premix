/**
 * @fileoverview Hook for managing user playlists with fetch and create operations.
 *
 * Responsibilities:
 * - Fetch user's playlists from Firestore on component mount
 * - Provide function to create new playlists
 * - Refresh playlist list after creation
 * - Manage loading state
 *
 * Related modules:
 * - playlistService (src/features/playlists/services/playlistService.ts)
 * - PlaylistList, CreatePlaylistModal
 *
 * Architectural role:
 * - Data fetching hook for playlist management
 *
 * Performance notes:
 * - No real-time subscription (single fetch only)
 * - useUserPlaylists preferred for real-time updates
 *
 * @module features/playlists/hooks
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { createPlaylist, getUserPlaylists } from "../services/playlistService";

export const usePlaylists = () => {
  const { user } = useAuth();
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      if (!user?.uid) return;
      const data = await getUserPlaylists(user.uid);
      setPlaylists(data);
      setLoading(false);
    };

    fetch();
  }, [user?.uid]);

  const handleCreate = async (name: string) => {
    if (!user?.uid) return;
    await createPlaylist(user.uid, name);
    const updated = await getUserPlaylists(user.uid);
    setPlaylists(updated);
  };

  return { playlists, loading, handleCreate };
};