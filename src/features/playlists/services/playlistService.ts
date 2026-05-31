/**
 * @fileoverview Playlist service - Core Firestore operations and type conversions for playlist management.
 *
 * Responsibilities:
 * - Define Playlist and PlaylistSong interfaces
 * - Provide type conversion utilities between PlaylistSong, ISong, and ITrack
 * - CRUD operations for playlists (create, read, update, delete)
 * - Add/remove songs to/from playlists with atomic batch writes
 * - Real-time subscriptions for playlist songs and user playlists
 *
 * Related modules:
 * - PlaylistPage (src/features/playlists/pages/PlaylistPage.tsx) - Uses playlist CRUD and song subscriptions
 * - PlaylistList (src/features/playlists/components/PlaylistList.tsx) - Uses user playlists subscription
 * - CreatePlaylistModal (src/features/playlists/components/CreatePlaylistModal.tsx) - Uses createPlaylist
 *
 * Architectural role:
 * - **Data persistence layer** for all playlist-related operations
 * - Centralizes Firestore interactions and data transformations
 * - Provides both real-time (onSnapshot) and one-time (getDocs) APIs
 *
 * Firestore data model (from HANDOFF_CORE.md):
 * - Playlists collection: /playlists/{playlistId}
 *   - Fields: name, userId, coverURL, isPublic, songCount, createdAt, description
 * - Playlist songs subcollection: /playlists/{playlistId}/songs/{songId}
 *   - Document ID = songId (ensures uniqueness per playlist)
 *   - Fields: title, artist, coverUrl, audioUrl, duration, album, addedAt
 *
 * Security boundary (from Firestore security rules):
 * - Create: isAuthenticated() AND isWriteable() AND userId == request.auth.uid
 * - Read: isAuthenticated() AND isReadable() AND (userId == auth.uid OR isPublic == true)
 * - Update: isAuthenticated() AND isWriteable() AND userId == request.auth.uid
 * - Delete: isAuthenticated() AND isWriteable() AND userId == request.auth.uid
 *
 * Transaction patterns:
 * - addSongToPlaylist: Batch write (set song doc + increment songCount)
 * - removeSongFromPlaylist: Batch write (delete song doc + decrement songCount)
 * - deletePlaylist: Batch delete all songs subcollection + playlist document
 *
 * @module features/playlists/services
 */

import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  where,
  serverTimestamp,
  getDoc,
  updateDoc,
  onSnapshot,
  orderBy,
  writeBatch,
  increment,
} from "firebase/firestore";
import { db } from "@/services/firebase/config";
import { ISong } from "@/features/songs/types";
import { ITrack } from "@/features/player/types";

/**
 * Firestore playlist document structure.
 *
 * @property id - Firestore document ID
 * @property name - Playlist name (required, max 50 chars)
 * @property userId - Creator's user ID (used for ownership checks)
 * @property coverURL - Optional Cloudinary URL for playlist cover art
 * @property isPublic - Visibility flag (true = anyone can view, false = owner only)
 * @property songCount - Denormalized count of songs in playlist (maintained via batch writes)
 * @property createdAt - Firestore server timestamp (used for ordering)
 * @property description - Optional playlist description (max 120 chars)
 */
export interface Playlist {
  id: string;
  name: string;
  userId: string;
  coverURL?: string;
  isPublic: boolean;
  songCount: number;
  createdAt: any;
  description?: string;
}

/**
 * Denormalized song document stored in playlist's songs subcollection.
 *
 * Songs are denormalized (copied from /songs collection) to:
 * - Prevent broken references if source song is deleted
 * - Enable offline access without additional queries
 * - Maintain consistent ordering via addedAt timestamp
 *
 * @property id - Song ID (matches /songs/{id} document ID)
 * @property title - Song title (denormalized)
 * @property artist - Artist name (denormalized)
 * @property coverUrl - Cover image URL (denormalized)
 * @property imageUrl - Alias for coverUrl (legacy field)
 * @property audioUrl - Audio file URL (for playback)
 * @property addedAt - Server timestamp when added to playlist
 * @property duration - Track duration (MM:SS format)
 * @property album - Album name (optional)
 */
export interface PlaylistSong {
  id: string;
  title: string;
  artist: string;
  coverUrl?: string;
  imageUrl?: string;
  audioUrl?: string;
  addedAt?: any;
  duration?: string;
  album?: string;
}

/**
 * Converts PlaylistSong to ISong format.
 *
 * Adds default values for fields not stored in playlist songs:
 * - sectionIds: empty array (sections are home page only)
 * - likeCount: 0 (likes are user-specific, not stored in playlist)
 *
 * @param song - PlaylistSong from Firestore
 * @returns ISong compatible object
 */
export const playlistSongToISong = (song: PlaylistSong): ISong => ({
  id: song.id,
  title: song.title,
  artist: song.artist,
  coverUrl: song.coverUrl || "/default-cover.jpg",
  duration: song.duration || "3:30",
  album: song.album || "Unknown Album",
  audioUrl: song.audioUrl,
  sectionIds: [],
  likeCount: 0,
});

/**
 * Converts PlaylistSong to ITrack format (for player).
 *
 * ITrack is a subset of ISong containing only playback-essential fields.
 *
 * @param song - PlaylistSong from Firestore
 * @returns ITrack compatible object
 */
export const playlistSongToITrack = (song: PlaylistSong): ITrack => ({
  id: song.id,
  title: song.title,
  artist: song.artist,
  coverUrl: song.coverUrl || "/default-cover.jpg",
  duration: song.duration || "3:30",
  audioUrl: song.audioUrl,
});

/**
 * Maps array of PlaylistSong to ISong array.
 */
export const playlistSongsToISongs = (songs: PlaylistSong[]): ISong[] =>
  songs.map(playlistSongToISong);

/**
 * Maps array of PlaylistSong to ITrack array.
 */
export const playlistSongsToITracks = (songs: PlaylistSong[]): ITrack[] =>
  songs.map(playlistSongToITrack);

/**
 * Converts ISong to PlaylistSong format for storage.
 *
 * Only includes fields that should be denormalized into playlist song documents.
 * Omits: sectionIds, likeCount (not relevant to playlists)
 *
 * @param song - ISong from songs collection
 * @returns PlaylistSong ready for Firestore storage
 */
export const iSongToPlaylistSong = (song: ISong): PlaylistSong => ({
  id: song.id,
  title: song.title,
  artist: song.artist,
  coverUrl: song.coverUrl ?? "",
  ...(song.audioUrl != null && { audioUrl: song.audioUrl }),
  ...(song.duration != null && { duration: song.duration }),
  ...(song.album != null && { album: song.album }),
});

/**
 * Converts ITrack to PlaylistSong format for storage.
 *
 * @param track - ITrack from player
 * @returns PlaylistSong ready for Firestore storage
 */
export const iTrackToPlaylistSong = (track: ITrack): PlaylistSong => ({
  id: track.id,
  title: track.title,
  artist: track.artist,
  coverUrl: track.coverUrl ?? "",
  ...(track.audioUrl != null && { audioUrl: track.audioUrl }),
  ...(track.duration != null && { duration: track.duration }),
});

/**
 * Creates a new playlist in Firestore.
 *
 * @param userId - Creator's user ID (must match request.auth.uid for security rules)
 * @param name - Playlist name (required, trimmed)
 * @param coverURL - Optional Cloudinary URL for cover art
 * @param description - Optional description (max 120 chars)
 * @param isPublic - Visibility flag (default: false)
 * @returns Promise resolving to DocumentReference
 */
export const createPlaylist = async (
  userId: string,
  name: string,
  coverURL: string = "",
  description: string = "",
  isPublic: boolean = false,
) => {
  return await addDoc(collection(db, "playlists"), {
    name,
    userId,
    coverURL,
    isPublic,
    songCount: 0,
    createdAt: serverTimestamp(),
    // Only include description if non-empty (prevents unnecessary field)
    ...(description.trim() && { description: description.trim() }),
  });
};

/**
 * Subscribes to real-time updates of user's playlists.
 *
 * Query: /playlists where userId == userId, ordered by createdAt desc.
 * Used in Sidebar and PlaylistList for real-time playlist updates.
 *
 * @param userId - User ID to filter by
 * @param callback - Called with updated playlists array on every change
 * @returns Unsubscribe function
 */
export const subscribeToUserPlaylists = (
  userId: string,
  callback: (playlists: Playlist[]) => void,
) => {
  const q = query(
    collection(db, "playlists"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
  );

  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Playlist, "id">),
      })),
    );
  });
};

/**
 * Adds a song to a playlist with atomic batch write.
 *
 * Operations in batch:
 * 1. Set song document in /playlists/{playlistId}/songs/{songId}
 * 2. Increment playlist.songCount by 1
 *
 * Additional post-batch logic:
 * - If playlist has no coverURL and song provides one, update playlist coverURL
 *   (First song's cover becomes playlist's default cover)
 *
 * Idempotency check: Returns early if song already exists in playlist.
 *
 * @param playlistId - Target playlist ID
 * @param song - PlaylistSong to add
 */
export const addSongToPlaylist = async (
  playlistId: string,
  song: PlaylistSong,
) => {
  const songRef = doc(db, "playlists", playlistId, "songs", song.id);
  if ((await getDoc(songRef)).exists()) return;

  const batch = writeBatch(db);
  const playlistRef = doc(db, "playlists", playlistId);

  batch.set(songRef, { ...song, addedAt: serverTimestamp() });
  batch.update(playlistRef, { songCount: increment(1) });
  await batch.commit();

  // Auto-set playlist cover from first song if not already set
  const snap = await getDoc(playlistRef);
  if (snap.exists() && !snap.data().coverURL && song.coverUrl) {
    await updateDoc(playlistRef, { coverURL: song.coverUrl });
  }
};

/**
 * Adds a song to a playlist from ISong object.
 * Convenience wrapper for iSongToPlaylistSong + addSongToPlaylist.
 */
export const addSongToPlaylistFromISong = (playlistId: string, song: ISong) =>
  addSongToPlaylist(playlistId, iSongToPlaylistSong(song));

/**
 * Adds a song to a playlist from ITrack object.
 * Convenience wrapper for iTrackToPlaylistSong + addSongToPlaylist.
 */
export const addSongToPlaylistFromITrack = (
  playlistId: string,
  track: ITrack,
) => addSongToPlaylist(playlistId, iTrackToPlaylistSong(track));

/**
 * Removes a song from a playlist with atomic batch write.
 *
 * Operations in batch:
 * 1. Delete song document from /playlists/{playlistId}/songs/{songId}
 * 2. Decrement playlist.songCount by 1
 *
 * @param playlistId - Target playlist ID
 * @param songId - Song ID to remove
 */
export const removeSongFromPlaylist = async (
  playlistId: string,
  songId: string,
) => {
  const batch = writeBatch(db);
  batch.delete(doc(db, "playlists", playlistId, "songs", songId));
  batch.update(doc(db, "playlists", playlistId), { songCount: increment(-1) });
  await batch.commit();
};

/**
 * Subscribes to real-time updates of songs in a playlist.
 *
 * Query: /playlists/{playlistId}/songs, ordered by addedAt desc (newest first).
 * Used in PlaylistPage for live song list updates.
 *
 * @param playlistId - Playlist ID to listen to
 * @param callback - Called with updated songs array on every change
 * @returns Unsubscribe function
 */
export const subscribeToPlaylistSongs = (
  playlistId: string,
  callback: (songs: PlaylistSong[]) => void,
) => {
  const q = query(
    collection(db, "playlists", playlistId, "songs"),
    orderBy("addedAt", "desc"),
  );

  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as PlaylistSong[],
    );
  });
};

/**
 * Subscribes to playlist songs as ISong array.
 * Convenience wrapper for subscribeToPlaylistSongs + playlistSongsToISongs.
 */
export const subscribeToPlaylistSongsAsISongs = (
  playlistId: string,
  callback: (songs: ISong[]) => void,
) =>
  subscribeToPlaylistSongs(playlistId, (s) =>
    callback(playlistSongsToISongs(s)),
  );

/**
 * Subscribes to playlist songs as ITrack array.
 * Convenience wrapper for subscribeToPlaylistSongs + playlistSongsToITracks.
 */
export const subscribeToPlaylistSongsAsITracks = (
  playlistId: string,
  callback: (tracks: ITrack[]) => void,
) =>
  subscribeToPlaylistSongs(playlistId, (s) =>
    callback(playlistSongsToITracks(s)),
  );

/**
 * Fetches a single playlist by ID (one-time read, no real-time).
 *
 * @param id - Playlist document ID
 * @returns Playlist object or null if not found
 */
export const getPlaylistById = async (id: string): Promise<Playlist | null> => {
  const snap = await getDoc(doc(db, "playlists", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Playlist, "id">) };
};

/**
 * Updates playlist metadata.
 *
 * @param playlistId - Playlist ID to update
 * @param data - Partial update object (fields to change)
 */
export const updatePlaylist = async (
  playlistId: string,
  data: Partial<Playlist>,
) => updateDoc(doc(db, "playlists", playlistId), data);

/**
 * Deletes a playlist and all its songs.
 *
 * Steps:
 * 1. Fetch all documents in /playlists/{playlistId}/songs subcollection
 * 2. Batch delete all song documents
 * 3. Batch delete the playlist document
 * 4. Commit batch (atomic delete of all documents)
 *
 * @param playlistId - Playlist ID to delete
 */
export const deletePlaylist = async (playlistId: string) => {
  const songsSnapshot = await getDocs(
    collection(db, "playlists", playlistId, "songs"),
  );
  const batch = writeBatch(db);
  songsSnapshot.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, "playlists", playlistId));
  await batch.commit();
};

/**
 * Fetches all playlists for a user (one-time read, no real-time).
 *
 * For real-time updates, use subscribeToUserPlaylists instead.
 *
 * @param userId - User ID to filter by
 * @returns Array of user's playlists
 */
export const getUserPlaylists = async (userId: string): Promise<Playlist[]> => {
  const snapshot = await getDocs(
    query(collection(db, "playlists"), where("userId", "==", userId)),
  );
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<Playlist, "id">),
  }));
};