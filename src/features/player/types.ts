/**
 * ============================================================================
 * BEATSTREAM - Player Type Definitions
 * ============================================================================
 * File: features/player/types.ts
 *
 * ARCHITECTURE OVERVIEW:
 * - Defines TypeScript interfaces for music player
 * - Specifies track data model
 * - Defines player state and control methods shape
 *
 * FIREBASE SCHEMA:
 * Tracks stored in /songs collection with ITrack structure
 *
 * ============================================================================
 */

/**
 * ITrack - Music track data model
 *
 * Represents a single track in the music library
 * Persisted in Firestore /songs collection
 * Returned by song services and consumed by player
 *
 * PROPERTIES:
 * - id: Unique identifier for track (Firestore doc ID)
 * - title: Track name/title
 * - artist: Artist name
 * - coverUrl: Album artwork URL (from Cloudinary)
 * - duration?: Optional track length in seconds (or HH:MM:SS format)
 * - audioUrl?: Optional audio file URL (from Cloudinary storage)
 *
 * OPTIONAL FIELDS:
 * - duration and audioUrl are optional because some API responses
 *   may not include them until track is fully processed
 * - PlayerContext fills these in as metadata loads
 *
 * USAGE:
 * - Passed to playTrack() function
 * - Stored in queue array
 * - Used for media session display
 * - Persisted to history when played
 *
 * FIREBASE LOCATION:
 * /songs/{trackId}
 * {
 *   id: string,
 *   title: string,
 *   artist: string,
 *   coverUrl: string,
 *   duration: string,
 *   audioUrl: string
 * }
 */
export interface ITrack {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  duration?: string;
  audioUrl?: string;
}

/**
 * IPlayerContext - Music player state and controls
 *
 * Provided by PlayerProvider to entire app
 * Consumed via usePlayer hook
 *
 * STATE (read-only):
 * - currentTrack: Currently playing track (null if nothing playing)
 * - isPlaying: Whether audio is currently playing
 * - currentTime: Current playback position in seconds
 * - duration: Total duration of current track in seconds
 * - queue: Array of tracks in current playlist
 * - currentIndex: Index of current track in queue
 * - volume: Volume level from 0 (silent) to 1 (max)
 * - isMuted: Whether audio output is muted
 *
 * CONTROL METHODS:
 * - playTrack(track, trackList?): Start playing a track (optionally set queue)
 * - togglePlay(): Pause if playing, resume if paused
 * - seek(time): Jump to specific position in current track
 * - playNext(): Skip to next track in queue
 * - playPrevious(): Go to previous track (or restart if >3s in)
 * - setVolume(volume): Set volume level (0-1)
 * - toggleMute(): Toggle mute on/off
 *
 * SUSPENSION ENFORCEMENT:
 * - All control methods check isSuspended before executing
 * - Prevents playback by suspended users
 *
 * ERROR HANDLING:
 * - playTrack catches and logs audio errors
 * - Invalid seek times are clamped to valid range
 * - AbortError from play() is ignored (not a real error)
 *
 * PERFORMANCE:
 * - Context is updated frequently (currentTime every ~250ms)
 * - Use callbacks/memoization in consumer components to prevent re-renders
 * - Consider useCallback in components that subscribe to entire context
 */
export interface IPlayerContext {
  currentTrack: ITrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  queue: ITrack[];
  currentIndex: number;
  volume: number;
  isMuted: boolean;
  playTrack: (track: ITrack, trackList?: ITrack[]) => Promise<void>;
  togglePlay: () => void;
  seek: (time: number) => void;
  playNext: () => void;
  playPrevious: () => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
}
