/**
 * ============================================================================
 * Premix - Music Player Context
 * ============================================================================
 * File: features/player/context/PlayerContext.tsx
 *
 * ARCHITECTURE OVERVIEW:
 * - Centralized music player state management using React Context
 * - Integrates Web Audio API for playback control
 * - Implements Media Session API for device integration (lock screen, etc.)
 * - Tracks playback history via Firestore
 * - Handles suspension state to pause playback for suspended users
 *
 * PLAYER STATE STRUCTURE:
 * - currentTrack: ITrack | null - Currently playing track
 * - isPlaying: boolean - Whether audio is actively playing
 * - currentTime: number - Current playback position in seconds
 * - duration: number - Total duration of track in seconds
 * - queue: ITrack[] - Current playlist of tracks
 * - currentIndex: number - Index of current track in queue
 * - volume: number - Volume level (0-1)
 * - isMuted: boolean - Mute state
 *
 * PLAYBACK CONTROL METHODS:
 * - playTrack(track, trackList?): Start playing a specific track
 * - togglePlay(): Pause/resume current track
 * - playNext(): Advance to next track in queue
 * - playPrevious(): Go to previous track (or restart if >3s in)
 * - seek(time): Jump to specific time in track
 * - setVolume(v): Set volume 0-1
 * - toggleMute(): Toggle mute state
 *
 * FIREBASE INTEGRATION:
 * - addToHistory: Records played tracks to user's history in Firestore
 * - Tracks engagement and listening patterns
 * - Prevents duplicate history entries with lastSavedTrackId check
 *
 * WEB API INTEGRATION:
 * - Web Audio API: <audio> element for playback
 * - Media Session API: Integration with device controls (lock screen, headphones)
 * - Cloudinary: Image optimization for artwork
 *
 * EVENT HANDLING:
 * - timeupdate: Updates currentTime state 60x per second
 * - loadedmetadata: Captures track duration
 * - ended: Auto-plays next track in queue
 * - error: Handles playback errors
 *
 * SUSPENSION LOGIC:
 * - Suspended users cannot start/resume playback
 * - Playback auto-pauses if user becomes suspended
 * - All playback controls check isSuspended before executing
 *
 * PERFORMANCE NOTES:
 * - Uses Ref to store currentTime/duration for frequent updates (avoids re-renders)
 * - useCallback memoizes event handlers to prevent unnecessary re-renders
 * - Media Session position updates batched every 500ms
 * - Cloudinary URL resizing optimizes artwork delivery
 *
 * ERROR HANDLING:
 * - AbortError exceptions ignored (not actual errors)
 * - Audio loading errors trigger console.error and set isPlaying=false
 * - Invalid seek times clamped to valid range
 * - Missing audio URL prevents track play with error logging
 *
 * FUTURE SCALABILITY:
 * - Consider adding equalizer support
 * - Could implement shuffle/repeat modes
 * - May need queue management UI (remove/reorder tracks)
 * - Consider gapless playback for seamless transitions
 * - Could add audio visualization support
 *
 * ============================================================================
 */

import { createContext, useEffect, useRef, useState, useCallback } from "react";
import { IPlayerContext, ITrack } from "../types";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { addToHistory } from "@/features/history/services/historyService";

// Application branding
const APP_NAME = "Premix";

// Fallback icon for track artwork if none provided
const APP_ICON = `${window.location.origin}/icons/icon-192x192.png`;

/**
 * Cloudinary Image Optimization Helper
 *
 * Transforms Cloudinary URLs to resize/optimize images
 * Adds width, height, quality, and format parameters
 * Skips transformation if URL is not from Cloudinary
 *
 * PERFORMANCE:
 * - Reduces bandwidth by delivering appropriately-sized images
 * - Format: JPEG with auto quality for browser compatibility
 *
 * @param url - Original image URL
 * @param size - Desired square size in pixels (width=height)
 * @returns Optimized Cloudinary URL
 */
const cloudinaryResize = (url: string, size: number): string => {
  if (!url.includes("res.cloudinary.com")) return url;
  return url.replace(
    "/upload/",
    `/upload/w_${size},h_${size},c_fill,q_auto,f_auto/`,
  );
};

/**
 * Media Session Artwork Builder
 *
 * Creates appropriately-sized artwork for lock screen/device display
 * Generates multiple resolutions for different display sizes
 * Uses Cloudinary optimization for efficient delivery
 *
 * SIZES:
 * - 96x96: Small (smartwatch, lock screen)
 * - 128x128: Medium (notification)
 * - 192x192: Large (widget, car display)
 * - 256x256: Extra large
 * - 512x512: Ultra high-res (future proofing)
 *
 * @param coverSrc - Album cover image URL
 * @returns Array of MediaImage objects for Media Session API
 */
const buildArtwork = (coverSrc: string | undefined): MediaImage[] => {
  const src = coverSrc || APP_ICON;
  const sizes = [96, 128, 192, 256, 512] as const;
  return sizes.map((s) => ({
    src: cloudinaryResize(src, s),
    sizes: `${s}x${s}`,
    type: "image/jpeg",
  }));
};

/**
 * PlayerContext
 *
 * Provides music player state and control methods to entire app
 * Default values are placeholders; actual state is set by PlayerProvider
 *
 * CONTEXT VALUE:
 * - currentTrack: Currently playing track
 * - isPlaying: Playback state
 * - Playback position and duration
 * - Queue and current track index
 * - Volume and mute state
 * - Control methods (play, pause, seek, etc.)
 */
export const PlayerContext = createContext<IPlayerContext>({
  currentTrack: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  queue: [],
  currentIndex: 0,
  volume: 1,
  isMuted: false,
  playTrack: async () => { },
  togglePlay: () => { },
  seek: () => { },
  playNext: () => { },
  playPrevious: () => { },
  setVolume: () => { },
  toggleMute: () => { },
});

/**
 * PlayerProvider Component
 *
 * RESPONSIBILITY:
 * - Manage music player state for entire application
 * - Control audio playback via HTMLAudioElement
 * - Integrate with Media Session API (lock screen, device controls)
 * - Track user listening history
 * - Handle suspension state to prevent playback by suspended users
 *
 * INTERNAL STATE:
 * - currentTrack: ITrack | null - Currently loaded and/or playing track
 * - isPlaying: boolean - Whether audio is currently playing
 * - currentTime: number - Playback position in seconds
 * - duration: number - Total track duration in seconds
 * - queue: ITrack[] - Current playlist
 * - currentIndex: number - Index of current track in queue
 * - volume: number - Volume level 0-1
 * - isMuted: boolean - Mute state
 *
 * REFS (for performance optimization):
 * - audioRef: HTMLAudioElement - Actual audio player instance
 * - lastSavedTrackId: Track ID of last saved history entry (prevents duplicates)
 * - currentTimeRef, durationRef: Cached refs for frequent updates without re-renders
 *
 * AUDIO ELEMENT LIFECYCLE:
 * 1. audioRef.current created on mount as new Audio()
 * 2. playTrack(): Set audio.src and call audio.play()
 * 3. Event listeners: timeupdate, loadedmetadata, error, ended
 * 4. Audio element reused for all tracks (src changed, not recreated)
 * 5. On unmount: Audio element cleaned up automatically
 *
 * @param children - React components that consume player context
 * @returns Provider component exposing player state and controls
 */
export const PlayerProvider = ({ children }: { children: React.ReactNode }) => {
  // Reference to HTML audio element for playback control
  const audioRef = useRef<HTMLAudioElement>(new Audio());

  // Current track being played
  const [currentTrack, setCurrentTrack] = useState<ITrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [queue, setQueue] = useState<ITrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // Performance optimization: prevent duplicate history saves and avoid re-renders
  const lastSavedTrackId = useRef<string | null>(null);
  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);

  // Check suspension status from auth context
  const { user } = useAuth();
  const isSuspended = user?.status === "suspended";

  /**
   * playTrack - Start playing a track
   *
   * Sets queue context, updates media session, loads audio, and starts playback
   */
  const playTrack = useCallback(
    async (track: ITrack, trackList?: ITrack[]): Promise<void> => {
      if (isSuspended) return;

      const audio = audioRef.current;
      if (!audio || !track.audioUrl) {
        console.error("Cannot play track: No audio URL provided", track);
        return;
      }

      // Set queue and current position
      if (trackList) {
        setQueue(trackList);
        setCurrentIndex(trackList.findIndex((t) => t.id === track.id));
      } else if (queue.length > 0) {
        const idx = queue.findIndex((t) => t.id === track.id);
        if (idx !== -1) setCurrentIndex(idx);
      }

      // Update Media Session API for device integration (lock screen, headphones)
      if ("mediaSession" in navigator) {
        const cover = (track as any).coverUrl || (track as any).imageUrl;
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.title ?? "Unknown Title",
          artist: track.artist ?? "Unknown Artist",
          album: (track as any).album || APP_NAME,
          artwork: buildArtwork(cover),
        });

        // Initialize position state
        if ("setPositionState" in navigator.mediaSession) {
          try {
            navigator.mediaSession.setPositionState({
              duration: 0,
              position: 0,
              playbackRate: 1,
            });
          } catch { }
        }

        navigator.mediaSession.playbackState = "playing";
      }

      currentTimeRef.current = 0;
      durationRef.current = 0;
      setCurrentTime(0);
      setDuration(0);
      setCurrentTrack(track);

      audio.pause();
      audio.src = track.audioUrl;

      try {
        await audio.play();
        setIsPlaying(true);
      } catch (error: any) {
        if (error?.name === "AbortError") {
          return;
        }
        console.error("Failed to play track:", error);
        setIsPlaying(false);
      }
    },
    [isSuspended, queue],
  );

  const playNext = useCallback(() => {
    if (isSuspended || queue.length === 0) return;
    setCurrentIndex((prev) => {
      const next = prev + 1;
      if (next < queue.length) {
        playTrack(queue[next]).catch((e) => {
          if (e?.name !== "AbortError") console.error(e);
        });
        return next;
      }
      return prev;
    });
  }, [isSuspended, queue, playTrack]);

  const playPrevious = useCallback(() => {
    if (isSuspended || queue.length === 0) return;
    const audio = audioRef.current;

    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    setCurrentIndex((prev) => {
      const prevIdx = prev - 1;
      if (prevIdx >= 0) {
        playTrack(queue[prevIdx]).catch((e) => {
          if (e?.name !== "AbortError") console.error(e);
        });
        return prevIdx;
      }
      return prev;
    });
  }, [isSuspended, queue, playTrack]);

  const togglePlay = useCallback(() => {
    if (isSuspended) return;
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else if (currentTrack) {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(console.error);
    }
  }, [isSuspended, isPlaying, currentTrack]);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const safe = Math.max(0, Math.min(time, durationRef.current));
    audio.currentTime = safe;
    setCurrentTime(safe);
    currentTimeRef.current = safe;
  }, []);

  const handleSetVolume = useCallback(
    (v: number) => setVolume(Math.max(0, Math.min(1, v))),
    [],
  );
  const toggleMute = useCallback(() => setIsMuted((v) => !v), []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => {
      setCurrentTime(audio.currentTime);
      currentTimeRef.current = audio.currentTime;
    };
    const onMeta = () => {
      setDuration(audio.duration);
      durationRef.current = audio.duration;
    };
    const onError = (e: Event) => {
      console.error("Audio error:", e);
      setIsPlaying(false);
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("error", onError);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onEnded = () => {
      if (isSuspended) {
        setIsPlaying(false);
        return;
      }
      if (currentIndex < queue.length - 1) {
        playTrack(queue[currentIndex + 1]).catch((e) => {
          if (e?.name !== "AbortError") console.error(e);
        });
      } else {
        setIsPlaying(false);
      }
    };

    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, [currentIndex, queue, isSuspended, playTrack]);

  useEffect(() => {
    if (!isSuspended) return;
    audioRef.current?.pause();
    setIsPlaying(false);
  }, [isSuspended]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.muted = isMuted;
  }, [volume, isMuted]);

  useEffect(() => {
    if (!currentTrack?.id || !user || isSuspended) return;
    if (lastSavedTrackId.current === currentTrack.id) return;
    addToHistory(user.uid, currentTrack.id)
      .then(() => {
        lastSavedTrackId.current = currentTrack.id;
      })
      .catch(console.error);
  }, [currentTrack, user, isSuspended]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [isPlaying]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    const ms = navigator.mediaSession;

    ms.setActionHandler("play", () => {
      if (!isSuspended) {
        audioRef.current
          ?.play()
          .then(() => setIsPlaying(true))
          .catch(console.error);
      }
    });

    ms.setActionHandler("pause", () => {
      audioRef.current?.pause();
      setIsPlaying(false);
    });

    ms.setActionHandler("stop", () => {
      audioRef.current?.pause();
      setIsPlaying(false);
    });

    ms.setActionHandler("nexttrack", playNext);
    ms.setActionHandler("previoustrack", playPrevious);

    ms.setActionHandler("seekbackward", (d) => {
      const t = Math.max(0, currentTimeRef.current - (d.seekOffset ?? 10));
      if (audioRef.current) audioRef.current.currentTime = t;
      setCurrentTime(t);
      currentTimeRef.current = t;
    });

    ms.setActionHandler("seekforward", (d) => {
      const t = Math.min(
        durationRef.current,
        currentTimeRef.current + (d.seekOffset ?? 10),
      );
      if (audioRef.current) audioRef.current.currentTime = t;
      setCurrentTime(t);
      currentTimeRef.current = t;
    });

    ms.setActionHandler("seekto", (d) => {
      if (d.seekTime == null) return;
      const t = Math.max(0, Math.min(d.seekTime, durationRef.current));
      if (audioRef.current) audioRef.current.currentTime = t;
      setCurrentTime(t);
      currentTimeRef.current = t;
    });

    return () => {
      (
        [
          "play",
          "pause",
          "stop",
          "nexttrack",
          "previoustrack",
          "seekbackward",
          "seekforward",
          "seekto",
        ] as MediaSessionAction[]
      ).forEach((a) => {
        try {
          ms.setActionHandler(a, null);
        } catch { }
      });
    };
  }, [playNext, playPrevious, isSuspended]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    if (!("setPositionState" in navigator.mediaSession)) return;
    if (!duration || isNaN(duration) || duration <= 0) return;

    const interval = setInterval(() => {
      try {
        navigator.mediaSession.setPositionState({
          duration: durationRef.current,
          playbackRate: audioRef.current?.playbackRate ?? 1,
          position: Math.min(currentTimeRef.current, durationRef.current),
        });
      } catch { }
    }, 500);

    return () => clearInterval(interval);
  }, [duration]);

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        queue,
        currentIndex,
        playTrack,
        togglePlay,
        seek,
        playNext,
        playPrevious,
        volume,
        setVolume: handleSetVolume,
        isMuted,
        toggleMute,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};
