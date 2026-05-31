/**
 * @fileoverview Global audio player bar with playback controls, progress seek, and volume management.
 *
 * Responsibilities:
 * - Display currently playing track with cover art, title, and artist
 * - Provide play/pause, next/previous, and seek controls
 * - Manage volume with mute toggle and slider
 * - Show progress bar with current time and duration
 * - Responsive layout: full bar on desktop, compact bar on mobile/tablet
 *
 * Related modules:
 * - usePlayer (src/features/player/hooks/usePlayer.ts) - Global player state and controls
 * - MainLayout (src/components/layout/MainLayout.tsx) - Conditionally renders PlayerBar when currentTrack exists
 *
 * Architectural role:
 * - **Global audio playback UI** (fixed bottom bar)
 * - Rendered in MainLayout, visible on all routes when a track is playing
 * - Positioned above MobileNav on mobile devices (z-index coordination)
 *
 * Layout behavior (from HANDOFF_CORE.md):
 * - Desktop: Fixed bottom bar with full controls (h-20 md:h-24)
 * - Mobile/Tablet: Compact bar above mobile navigation (bottom-[60px])
 * - Content padding adjusted to prevent overlap (pb-24 desktop, pb-40 mobile + player)
 *
 * Responsive variants:
 * - Desktop (> 1180px): Full bar with volume slider, expanded controls
 * - Tablet (768px-1179px): Compact but functional (smaller buttons, hidden volume text)
 * - Mobile (< 768px): Minimal bar with essential controls, volume in popup slider
 *
 * Volume persistence:
 * - Volume state managed in usePlayer (global)
 * - Mute state toggles between 0 and previous volume
 * - Mobile volume control uses popup slider with click-outside detection
 *
 * Progress seeking:
 * - Shows current time and duration
 * - Click/drag on progress bar seeks to position
 * - Smooth visual feedback with hover thumb
 *
 * Suspension awareness:
 * - PlayerBar renders for suspended users (read-only access to playback)
 * - Suspended users can still play/pause/seek (local audio operations)
 * - Writes (likes, history, playlists) are blocked elsewhere
 *
 * @module features/player/components
 */

import { usePlayer } from "../hooks/usePlayer";
import PlayCircleRoundedIcon from "@mui/icons-material/PlayCircleRounded";
import PauseCircleRoundedIcon from "@mui/icons-material/PauseCircleRounded";
import FastForwardRoundedIcon from "@mui/icons-material/FastForwardRounded";
import FastRewindRoundedIcon from "@mui/icons-material/FastRewindRounded";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import VolumeDownIcon from "@mui/icons-material/VolumeDown";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import VolumeMuteIcon from "@mui/icons-material/VolumeMute";

import { useState, useEffect, useRef } from "react";
import { useResponsive } from "@/components/layout/hooks/useResponsive";

/**
 * Formats time in seconds to MM:SS format.
 *
 * @param time - Time in seconds
 * @returns Formatted time string (e.g., "3:45")
 */
const formatTime = (time: number) => {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

/**
 * PlayerBar - Global audio playback control bar.
 *
 * Rendered conditionally in MainLayout when currentTrack is truthy.
 * Position: fixed bottom (z-50), above MobileNav on mobile.
 *
 * Component structure:
 * - Desktop: Left (cover + metadata) + Center (controls + progress) + Right (volume)
 * - Mobile: Compact horizontal layout with essential controls + popup volume slider
 *
 * State management:
 * - localVolume: Local copy of volume for UI responsiveness
 * - previousVolume: Stores volume before mute (for unmute restore)
 * - isVolumeSliderVisible: Controls mobile volume popup visibility
 *
 * @returns Player bar JSX or null if no currentTrack
 */
const PlayerBar = () => {
  const {
    currentTrack,
    isPlaying,
    togglePlay,
    currentTime,
    duration,
    seek,
    playNext,
    playPrevious,
    volume: playerVolume,
    setVolume: setPlayerVolume,
    toggleMute: playerToggleMute,
  } = usePlayer();

  const { isMobile, isTablet } = useResponsive();

  // --- Volume state ---
  const [localVolume, setLocalVolume] = useState(playerVolume || 0.7);
  const [previousVolume, setPreviousVolume] = useState(playerVolume || 0.7);
  const [isVolumeHovered, setIsVolumeHovered] = useState(false);
  const [isVolumeSliderVisible, setIsVolumeSliderVisible] = useState(false);

  // --- Refs for click-outside detection (mobile volume popup) ---
  const volumeButtonRef = useRef<HTMLDivElement>(null);
  const volumeSliderRef = useRef<HTMLDivElement>(null);

  /**
   * Sync local volume with global player volume when it changes.
   */
  useEffect(() => {
    if (playerVolume !== undefined) {
      setLocalVolume(playerVolume);
    }
  }, [playerVolume]);

  /**
   * Effect: Click-outside handler for mobile volume slider popup.
   *
   * Closes volume popup when clicking outside the button or popup area.
   * Cleanup: Removes event listener on unmount.
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        volumeSliderRef.current &&
        !volumeSliderRef.current.contains(event.target as Node) &&
        volumeButtonRef.current &&
        !volumeButtonRef.current.contains(event.target as Node)
      ) {
        setIsVolumeSliderVisible(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  /**
   * Handles volume slider change.
   * Updates both local state and global player volume.
   *
   * @param e - Range input change event
   */
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setLocalVolume(newVolume);
    setPlayerVolume(newVolume);
  };

  /**
   * Toggles mute state.
   *
   * Logic:
   * - If volume > 0: Store current volume, set to 0 (mute)
   * - If volume === 0: Restore previous volume (unmute)
   *
   * Uses local volume state and syncs to global player.
   */
  const handleToggleMute = () => {
    if (localVolume > 0) {
      setPreviousVolume(localVolume);
      setLocalVolume(0);
      setPlayerVolume(0);
    } else {
      setLocalVolume(previousVolume);
      setPlayerVolume(previousVolume);
    }
    if (playerToggleMute) {
      playerToggleMute();
    }
  };

  /**
   * Returns appropriate volume icon based on current volume level.
   *
   * Levels:
   * - 0: VolumeOff (muted)
   * - 0.1-0.3: VolumeMute (very quiet)
   * - 0.31-0.7: VolumeDown (medium)
   * - 0.71-1.0: VolumeUp (loud)
   *
   * @returns MUI icon component
   */
  const getVolumeIcon = () => {
    if (localVolume === 0)
      return <VolumeOffIcon fontSize="small" className="text-gray-400" />;
    if (localVolume < 0.3)
      return <VolumeMuteIcon fontSize="small" className="text-gray-400" />;
    if (localVolume < 0.7)
      return <VolumeDownIcon fontSize="small" className="text-gray-400" />;
    return <VolumeUpIcon fontSize="small" className="text-gray-400" />;
  };

  // Don't render anything if no track is playing
  if (!currentTrack) return null;

  // --- Mobile/Tablet layout (compact bar above mobile navigation) ---
  if (isMobile || isTablet) {
    return (
      <div className="fixed bottom-[60px] left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200 shadow-lg">
        <div className="px-3 sm:px-8 py-2 flex items-center gap-2">
          {/* Cover art */}
          <img
            src={currentTrack.coverUrl || "/default-album.jpg"}
            alt={currentTrack.title}
            className="w-10 h-10 rounded-md shadow-sm object-cover flex-shrink-0"
          />

          {/* Track metadata */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-900 text-xs truncate">
              {currentTrack.title}
            </h3>
            <p className="text-[10px] text-gray-500 truncate">
              {currentTrack.artist}
            </p>
          </div>

          {/* Playback controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={playPrevious}
              className="text-gray-600 hover:text-[#fa243c] transition-colors"
              aria-label="Previous track"
            >
              <FastRewindRoundedIcon sx={{ fontSize: "1.3rem" }} />
            </button>

            <button
              onClick={togglePlay}
              className="flex items-center justify-center"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <PauseCircleRoundedIcon
                  className="text-[#fa243c]"
                  sx={{ fontSize: "2.2rem" }}
                />
              ) : (
                <PlayCircleRoundedIcon
                  className="text-[#fa243c]"
                  sx={{ fontSize: "2.2rem" }}
                />
              )}
            </button>

            <button
              onClick={playNext}
              className="text-gray-600 hover:text-[#fa243c] transition-colors"
              aria-label="Next track"
            >
              <FastForwardRoundedIcon sx={{ fontSize: "1.3rem" }} />
            </button>
          </div>

          {/* Volume control (popup on mobile) */}
          <div className="relative" ref={volumeButtonRef}>
            <button
              onClick={() => setIsVolumeSliderVisible(!isVolumeSliderVisible)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Volume control"
            >
              {getVolumeIcon()}
            </button>

            {/* Volume popup slider (visible when toggled) */}
            {isVolumeSliderVisible && (
              <div
                ref={volumeSliderRef}
                className="absolute bottom-full right-0 mb-2 p-3 bg-white rounded-xl shadow-xl border border-gray-200 animate-fadeIn"
                style={{ minWidth: "200px" }}
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleToggleMute}
                    className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                  >
                    {getVolumeIcon()}
                  </button>

                  <div className="flex-1 relative group h-1">
                    <div className="absolute w-full h-1 bg-gray-200 rounded-full"></div>
                    <div
                      className="absolute h-1 bg-[#fa243c] rounded-full"
                      style={{ width: `${localVolume * 100}%` }}
                    ></div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={localVolume}
                      onChange={handleVolumeChange}
                      className="absolute top-0 left-0 w-full h-1 opacity-0 cursor-pointer z-10"
                      aria-label="Volume control"
                    />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-[#fa243c] rounded-full border-2 border-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{
                        left: `${localVolume * 100}%`,
                        transform: "translate(-50%, -50%)",
                      }}
                    ></div>
                  </div>

                  <span className="text-xs text-gray-400 w-8 text-right">
                    {Math.round(localVolume * 100)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Progress bar (below controls) */}
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400 w-8 text-right">
              {formatTime(currentTime)}
            </span>

            <div className="flex-1 relative h-1">
              <div className="absolute w-full h-1 bg-gray-200 rounded-full"></div>
              <div
                className="absolute h-1 bg-[#fa243c] rounded-full"
                style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
              ></div>
              <input
                type="range"
                min={0}
                max={duration || 0}
                value={currentTime}
                onChange={(e) => seek(Number(e.target.value))}
                className="absolute top-0 left-0 w-full h-1 opacity-0 cursor-pointer"
                aria-label="Seek progress"
              />
            </div>

            <span className="text-[10px] text-gray-400 w-8">
              {formatTime(duration)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // --- Desktop layout (full horizontal bar) ---
  return (
    <div
      className={`h-20 md:h-24 bg-white/95 backdrop-blur-md border-t border-gray-200 fixed bottom-0 left-0 right-0 z-50 shadow-lg ${isTablet ? "px-3" : "px-4 md:px-6"
        }`}
    >
      <div className="h-full flex items-center">
        {/* Left section: Cover art + track metadata */}
        <div className="w-1/4 min-w-[140px] md:min-w-[180px] flex items-center gap-2 md:gap-3">
          <img
            src={currentTrack.coverUrl || "/default-album.jpg"}
            alt={currentTrack.title}
            className="w-10 h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 rounded-md shadow-md object-cover"
          />
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-900 text-xs md:text-sm truncate">
              {currentTrack.title}
            </h3>
            <p className="text-[10px] md:text-xs text-gray-500 truncate">
              {currentTrack.artist}
            </p>
          </div>
        </div>

        {/* Center section: Playback controls + progress bar */}
        <div className="flex-1 max-w-2xl mx-auto flex flex-col items-center gap-1 md:gap-2">
          {/* Transport controls */}
          <div className="flex items-center gap-3 md:gap-4">
            <button
              onClick={playPrevious}
              className="text-gray-600 hover:text-[#fa243c] transition-colors"
              aria-label="Previous track"
            >
              <FastRewindRoundedIcon
                sx={{ fontSize: { xs: "1.5rem", sm: "1.8rem", md: "2.2rem" } }}
              />
            </button>

            <button
              onClick={togglePlay}
              className="flex items-center justify-center transition-transform hover:scale-105"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <PauseCircleRoundedIcon
                  className="text-[#fa243c]"
                  sx={{
                    fontSize: { xs: "2.2rem", sm: "2.5rem", md: "2.8rem" },
                  }}
                />
              ) : (
                <PlayCircleRoundedIcon
                  className="text-[#fa243c]"
                  sx={{
                    fontSize: { xs: "2.2rem", sm: "2.5rem", md: "2.8rem" },
                  }}
                />
              )}
            </button>

            <button
              onClick={playNext}
              className="text-gray-600 hover:text-[#fa243c] transition-colors"
              aria-label="Next track"
            >
              <FastForwardRoundedIcon
                sx={{ fontSize: { xs: "1.5rem", sm: "1.8rem", md: "2.2rem" } }}
              />
            </button>
          </div>

          {/* Progress bar with time labels */}
          <div className="w-full flex items-center gap-2">
            <span className="text-[10px] md:text-xs text-gray-400 w-8 md:w-10 text-right">
              {formatTime(currentTime)}
            </span>

            <div className="flex-1 relative group h-1">
              {/* Background track */}
              <div className="absolute w-full h-1 bg-gray-200 rounded-full"></div>
              {/* Progress fill */}
              <div
                className="absolute h-1 bg-[#fa243c] rounded-full transition-all duration-100"
                style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
              ></div>
              {/* Hidden input for seeking */}
              <input
                type="range"
                min={0}
                max={duration || 0}
                value={currentTime}
                onChange={(e) => seek(Number(e.target.value))}
                className="absolute top-0 left-0 w-full h-1 opacity-0 cursor-pointer z-10"
                aria-label="Seek progress"
              />
              {/* Hover thumb indicator */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-2 h-2 md:w-3 md:h-3 bg-[#fa243c] rounded-full border-2 border-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                style={{
                  left: `${(currentTime / (duration || 1)) * 100}%`,
                  transform: "translate(-50%, -50%)",
                }}
              ></div>
            </div>

            <span className="text-[10px] md:text-xs text-gray-400 w-8 md:w-10">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Right section: Volume controls */}
        <div className="w-1/4 min-w-[100px] md:min-w-[140px] lg:min-w-[180px] flex items-center justify-end gap-2 md:gap-3">
          <div className="flex items-center gap-1">
            {/* Mute/Unmute button */}
            <button
              onClick={handleToggleMute}
              className="text-gray-400 hover:text-gray-600"
              aria-label={localVolume === 0 ? "Unmute" : "Mute"}
            >
              {getVolumeIcon()}
            </button>

            {/* Volume slider (desktop only) */}
            <div
              className="relative group items-center hidden sm:flex"
              onMouseEnter={() => setIsVolumeHovered(true)}
              onMouseLeave={() => setIsVolumeHovered(false)}
            >
              <div className="relative w-12 md:w-16 h-1">
                <div className="absolute w-full h-1 bg-gray-200 rounded-full"></div>
                <div
                  className="absolute h-1 bg-[#fa243c] rounded-full transition-all duration-100"
                  style={{ width: `${localVolume * 100}%` }}
                ></div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={localVolume}
                  onChange={handleVolumeChange}
                  className="absolute top-0 left-0 w-full h-1 opacity-0 cursor-pointer z-10"
                  aria-label="Volume control"
                />
                {/* Hover thumb indicator */}
                <div
                  className={`absolute top-1/2 -translate-y-1/2 w-2 h-2 md:w-3 md:h-3 bg-[#fa243c] rounded-full border-2 border-white shadow-lg transition-all duration-200 ${isVolumeHovered
                    ? "opacity-100 scale-100"
                    : "opacity-0 scale-50"
                    }`}
                  style={{
                    left: `${localVolume * 100}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                ></div>
              </div>

              {/* Volume percentage text (visible on hover) */}
              <span
                className={`ml-1 text-[10px] md:text-xs text-gray-400 transition-opacity duration-200 ${isVolumeHovered ? "opacity-100" : "opacity-0"
                  }`}
              >
                {Math.round(localVolume * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerBar;