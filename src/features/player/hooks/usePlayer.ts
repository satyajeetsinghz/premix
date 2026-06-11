/**
 * ============================================================================
 * Premix - Player Hook
 * ============================================================================
 * File: features/player/hooks/usePlayer.ts
 *
 * ARCHITECTURE OVERVIEW:
 * - Custom React hook for accessing player state and controls
 * - Type-safe access to PlayerContext throughout application
 * - Enforces player to be called within PlayerProvider
 *
 * USAGE PATTERN:
 * - All components needing playback control use this hook
 * - Must be called within PlayerProvider's component tree
 * - Throws error if called outside provider (prevents silent failures)
 *
 * ============================================================================
 */

import { useContext } from "react";
import { PlayerContext } from "../context/PlayerContext";

/**
 * usePlayer Hook
 *
 * RESPONSIBILITY:
 * - Provide access to player state and control methods
 * - Enforce that hook is called within PlayerProvider
 * - Type-safe context consumption
 *
 * USAGE:
 * const player = usePlayer();
 * player.playTrack(track);
 * player.togglePlay();
 *
 * PLAYER CONTEXT ACCESS:
 * - currentTrack: Currently playing track (or null)
 * - isPlaying: Playback state
 * - currentTime: Current position in seconds
 * - duration: Total duration in seconds
 * - queue: Array of tracks in queue
 * - currentIndex: Index of current track
 * - volume: Volume 0-1
 * - isMuted: Mute state
 * - Control methods: playTrack, togglePlay, seek, etc.
 *
 * ERROR HANDLING:
 * - Throws descriptive error if used outside PlayerProvider
 * - Prevents undefined context errors
 *
 * DEPENDENCIES:
 * - Called from App.tsx via PlayerProvider wrapper
 * - PlayerProvider wraps entire app in App.tsx
 *
 * @returns Player context with state and control methods
 * @throws Error if PlayerContext is not found (called outside PlayerProvider)
 */
export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error("usePlayer must be used within PlayerProvider");
  }
  return context;
};
