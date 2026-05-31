/**
 * @fileoverview Type definitions for song data structures.
 *
 * Responsibilities:
 * - Define the shape of song documents stored in Firestore
 * - Document all available fields with their types and optionality
 * - Provide type safety across all song-related components and services
 *
 * Related modules:
 * - useSongs (src/features/songs/hooks/useSongs.ts) - Returns ISong arrays from Firestore
 * - fetchSongs (src/features/songs/services/fetchSongs.ts) - One-time fetch returning ISong[]
 * - SongCard (src/features/songs/components/SongCard.tsx) - Accepts ISong as track prop
 * - useLike (src/features/likes/hooks/useLike.ts) - Tracks like status on ISong
 * - PlaylistPage (src/features/playlists/pages/PlaylistPage.tsx) - Displays songs as ISong
 *
 * Architectural role:
 * - **Core data contract** for all song-related features
 * - Ensures consistency between Firestore documents and TypeScript code
 * - Enables IntelliSense and compile-time type checking across the app
 *
 * Firestore collection: /songs/{songId}
 *
 * Security rules (from HANDOFF_CORE.md):
 * - Read: isAuthenticated() AND isReadable() (not banned)
 * - Create: isActiveAdmin()
 * - Update: isActiveAdmin() OR (isAuthenticated() AND onlyChanges(['likeCount']))
 * - Delete: isActiveAdmin()
 *
 * Field validation (enforced by security rules):
 * - title: required, string
 * - artist: required, string
 * - likeCount: required, number (0 on creation)
 * - sectionIds: required, array of strings
 *
 * @module features/songs/types
 */

import { Timestamp } from "firebase/firestore";

/**
 * ISong - Firestore document structure for songs in the music catalog.
 *
 * Songs are the core content type in BeatStream. They are displayed
 * on the home page (via sections), in playlists, liked songs, and history.
 *
 * Field categories:
 * - Identification: id, title, artist, album
 * - Media: audioUrl, coverUrl, imageUrl (legacy alias)
 * - Metadata: duration, sectionIds, likeCount, createdAt
 *
 * @property id - Unique document ID (Firestore auto-generated)
 * @property title - Song title (required, max 255 chars)
 * @property artist - Artist name (required, max 255 chars)
 *
 * @property audioUrl - Cloudinary URL for audio file (required for playback)
 *                      Generated during upload by cloudinary.service
 *
 * @property coverUrl - Cloudinary URL for cover image (required for display)
 *                      Used as primary image source across components
 * @property imageUrl - Legacy field alias for coverUrl (some older documents may have this)
 *                      Components should check both fields (coverUrl || imageUrl)
 *
 * @property duration - Track duration in MM:SS format (e.g., "3:45")
 *                      Optional, used for display and total duration calculations
 *
 * @property album - Album name (optional, max 255 chars)
 *                   Used for grouping and display in table views
 *
 * @property sectionIds - Array of section IDs where this song appears on home page
 *                        Example: ["section_trending", "section_new_releases"]
 *                        Songs can belong to multiple sections
 *
 * @property likeCount - Total number of likes across all users (aggregated)
 *                       Updated via toggleLikeTransaction (atomic increment/decrement)
 *                       Used for sorting and popularity metrics
 *
 * @property createdAt - Firestore server timestamp (set on creation)
 *                       Used for ordering (newest first in queries)
 *
 * @example
 * // Complete song document
 * {
 *   id: "song_123",
 *   title: "Bohemian Rhapsody",
 *   artist: "Queen",
 *   audioUrl: "https://res.cloudinary.com/.../song.mp3",
 *   coverUrl: "https://res.cloudinary.com/.../cover.jpg",
 *   duration: "5:55",
 *   album: "A Night at the Opera",
 *   sectionIds: ["section_trending", "section_rock_classics"],
 *   likeCount: 1243,
 *   createdAt: Timestamp { seconds: 1704067200 }
 * }
 *
 * @example
 * // Minimal song document (after upload)
 * {
 *   id: "song_456",
 *   title: "New Track",
 *   artist: "New Artist",
 *   audioUrl: "https://...",
 *   coverUrl: "https://...",
 *   sectionIds: [],
 *   likeCount: 0,
 *   createdAt: Timestamp { seconds: 1704153600 }
 * }
 */
export interface ISong {
  id: string;
  title: string;
  artist: string;
  audioUrl?: string;
  coverUrl: string;
  imageUrl?: string; // Legacy alias for coverUrl (deprecated, prefer coverUrl)
  duration?: string;
  album?: string;
  sectionIds: string[];
  likeCount: number;
  createdAt?: Timestamp;
}