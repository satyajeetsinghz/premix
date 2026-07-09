/**
 * @fileoverview PlayerBar — Apple Music Web Player floating pill.
 *
 * UI-ONLY redesign pass (iOS 26 liquid glass, dark theme — matches MobileNav dark).
 * No logic, state, hooks, or prop/behavior changes from the original file.
 * Only JSX structure kept 1:1; only className/style values were edited.
 */

import { useState, useEffect, useRef } from "react";
import { usePlayer } from "../hooks/usePlayer";

import ShuffleRoundedIcon from "@mui/icons-material/ShuffleRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import PauseRoundedIcon from "@mui/icons-material/PauseRounded";
import RepeatRoundedIcon from "@mui/icons-material/RepeatRounded";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import QueueMusicRoundedIcon from "@mui/icons-material/QueueMusicRounded";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";
import VolumeOffRoundedIcon from "@mui/icons-material/VolumeOffRounded";
import DefaultPlayer from "./DefaultPlayer";
import { FastForwardRounded, FastRewindRounded } from "@mui/icons-material";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// ─── Ghost icon button ────────────────────────────────────────────────────────

const Btn = ({
  onClick,
  label,
  size = 18,
  className = "",
  style = {},
  children,
}: {
  onClick?: () => void;
  label: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    aria-label={label}
    className={`
      flex
      items-center
      justify-center
      rounded-full
      p-1.5
      transition-all
      duration-150
      ${className}
    `}
    style={{
      color: "#ffffffeb",
      fontSize: size,
      ...style,
    }}
  >
    {children}
  </button>
);

// ─── PlayerBar ────────────────────────────────────────────────────────────────

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
    setVolume,
    toggleMute: playerToggleMute,
  } = usePlayer();

  const [volume, setLocalVolume] = useState(playerVolume ?? 0.7);
  const lastVol = useRef(playerVolume ?? 0.7);

  // Stay in sync when player changes volume externally (e.g. keyboard shortcut)
  useEffect(() => {
    if (playerVolume != null && playerVolume !== volume) {
      setLocalVolume(playerVolume);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerVolume]);

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    if (v > 0) lastVol.current = v;
    setLocalVolume(v);
    setVolume(v);
  };

  const handleMute = () => {
    if (volume > 0) {
      lastVol.current = volume;
      setLocalVolume(0);
      setVolume(0);
    } else {
      const r = lastVol.current || 0.7;
      setLocalVolume(r);
      setVolume(r);
    }
    playerToggleMute?.();
  };

  if (!currentTrack) return <DefaultPlayer logoSrc="/logos/premix_music_white_logo.png" mobileLogoSrc="/logos/premix_rounded_logo.png" />;

  const progress = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className="
    absolute
    inset-x-0
    bottom-20
    sm:bottom-0
    z-50
    flex
    justify-center
    px-3
  "
      style={{
        paddingBottom: "max(12px, env(safe-area-inset-bottom))",
        pointerEvents: "none",
      }}
    >

      {/* ── Mobile Floating Pill ── */}
      <div className="block md:hidden">
        <div
          className="relative w-[min(420px,calc(100vw-24px))] overflow-hidden"
          style={{
            borderRadius: 100,
            pointerEvents: "auto",
            background: "rgba(31, 31, 31, 0.55)", // #1f1f1f translucent glass tint

            backdropFilter: "blur(30px) saturate(180%) brightness(1.05)",
            WebkitBackdropFilter: "blur(30px) saturate(180%) brightness(1.05)",

            border: "1px solid rgba(255,255,255,0.06)",

            boxShadow: `
    inset 0 1px 0 rgba(255,255,255,0.08),
    inset 0 -1px 0 rgba(255,255,255,0.02),
    0 12px 40px rgba(0,0,0,0.35)
  `,
          }}
        >
          {/* Main Row */}
          <div
            className="flex items-center justify-between px-4"
            style={{ height: 56 }}
          >
            {/* Left Section */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div
                className="flex-shrink-0 rounded-md overflow-hidden"
                style={{
                  width: 36,
                  height: 36,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                }}
              >
                <img
                  src={currentTrack.coverUrl || "/default-album.jpg"}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              </div>

              <div className="flex-1 max-w-[70%]">
                <p
                  className="truncate"
                  style={{
                    fontSize: 13,
                    fontWeight: 400,
                    color: "#f5f5f7",
                    letterSpacing: "-0.1px",
                  }}
                >
                  {currentTrack.title}
                </p>

                <p
                  className="truncate"
                  style={{
                    fontSize: 11,
                    color: "rgba(235,235,245,0.45)",
                  }}
                >
                  {currentTrack.artist}
                </p>
              </div>
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={togglePlay}
                aria-label={isPlaying ? "Pause" : "Play"}
                className="flex items-center justify-center rounded-full"
                style={{
                  width: 36,
                  height: 36,
                  color: "#ffffffeb",
                }}
              >
                {isPlaying ? (
                  <PauseRoundedIcon sx={{ fontSize: 34 }} />
                ) : (
                  <PlayArrowRoundedIcon sx={{ fontSize: 38, marginLeft: "1px" }} />
                )}
              </button>

              <button
                onClick={playNext}
                aria-label="Next"
                className="flex items-center justify-center"
                style={{
                  width: 36,
                  height: 36,
                  color: "#ffffffeb",
                }}
              >
                <FastForwardRounded sx={{ fontSize: 34 }} />
              </button>
            </div>
          </div>

          {/* Progress Bar (same pattern as desktop) */}
          <div
            className="absolute bottom-0 left-0 right-0 cursor-pointer"
            style={{
              height: 2,
              background: "rgba(255,255,255,0.07)",
            }}
          >
            <div
              className="h-full"
              style={{
                width: `${progress}%`,
                background: "#ff6961",
                boxShadow: "0 0 6px rgba(255,105,97,0.6)",
                transition: "width 0.25s linear",
              }}
            />

            <input
              type="range"
              min={0}
              max={duration || 0}
              value={currentTime}
              onChange={(e) => seek(Number(e.target.value))}
              aria-label="Seek"
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
              style={{ height: "100%" }}
            />
          </div>
        </div>
      </div>

      {/* Desktop Pill */}
      <div className="hidden md:block">
        {/* ── Dekstop Floating pill ── */}
        <div
          className="relative w-[min(660px,calc(100vw-32px))] overflow-hidden"
          style={{
            borderRadius: 100,
            pointerEvents: "auto",
            background: "rgba(31, 31, 31, 0.55)", // #1f1f1f translucent glass tint

            backdropFilter: "blur(30px) saturate(180%) brightness(1.05)",
            WebkitBackdropFilter: "blur(30px) saturate(180%) brightness(1.05)",

            border: "1px solid rgba(255,255,255,0.06)",

            boxShadow: `
    inset 0 1px 0 rgba(255,255,255,0.08),
    inset 0 -1px 0 rgba(255,255,255,0.02),
    0 12px 40px rgba(0,0,0,0.35)
  `,
          }}
        >

          {/* ── Main row ── */}
          <div
            className="flex items-center gap-1 px-3"
            style={{ height: 48 }}
          >

            {/* ── LEFT — Transport ── */}
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <Btn label="Shuffle">
                <ShuffleRoundedIcon sx={{ fontSize: 16 }} />
              </Btn>

              <Btn label="Previous" style={{ padding: 0 }} onClick={playPrevious}>
                <FastRewindRounded sx={{ fontSize: 28 }} />
              </Btn>

              {/* Play / Pause — liquid-glass capsule with accent glow */}
              <button
                onClick={togglePlay}
                aria-label={isPlaying ? "Pause" : "Play"}
                className="flex items-center justify-center flex-shrink-0 transition-transform duration-100"
                style={{
                  width: 34,
                  height: 34,
                  color: "#ffffffeb",
                  background: "transparent"
                  // boxShadow:
                  //   "0 2px 8px rgba(250,88,106,0.4), inset 0 1px 1px rgba(255,255,255,0.18), inset 0 -1px 1px rgba(0,0,0,0.3)",
                }}
              >
                {isPlaying
                  ? <PauseRoundedIcon sx={{ fontSize: 34 }} />
                  : <PlayArrowRoundedIcon sx={{ fontSize: 38, marginLeft: "" }} />
                }
              </button>

              <Btn label="Next" style={{ padding: 0 }} onClick={playNext}>
                <FastForwardRounded sx={{ fontSize: 28 }} />
              </Btn>

              <Btn label="Repeat">
                <RepeatRoundedIcon sx={{ fontSize: 16 }} />
              </Btn>
            </div>

            {/* ── CENTER — Art + Metadata + Timestamps ── */}
            <div
              className="flex items-center gap-2.5 flex-1 min-w-0 px-2.5 mx-1"
            // style={{ borderLeft: "0.5px solid rgba(255,255,255,0.08)", borderRight: "0.5px solid rgba(255,255,255,0.08)" }}
            >
              {/* Album art */}
              <div
                className="flex-shrink-0 rounded-md overflow-hidden"
                style={{
                  width: 32,
                  height: 32,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                }}
              >
                <img
                  src={currentTrack.coverUrl || "/default-album.jpg"}
                  alt={`${currentTrack.title} cover`}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              </div>

              {/* Title + artist */}
              <div className="flex-1 min-w-0">
                <p
                  className="truncate leading-tight"
                  style={{ fontSize: 12, fontWeight: 400, color: "#f5f5f7", letterSpacing: "-0.1px" }}
                >
                  {currentTrack.title}
                </p>
                <p
                  className="truncate leading-tight mt-0.5"
                  style={{ fontSize: 11, color: "rgba(235,235,245,0.4)" }}
                >
                  {currentTrack.artist}
                  {/* {currentTrack.album ? ` — ${currentTrack.album}` : ""} */}
                </p>
              </div>

              {/* Timestamps — hidden on small screens */}
              <div
                className="hidden md:flex items-center gap-1 flex-shrink-0 tabular-nums select-none"
                style={{ fontSize: 11, color: "rgba(235,235,245,0.45)" }}
              >
                <span>{fmt(currentTime)}</span>
                {/* <span style={{ color: "rgba(235,235,245,0.18)" }}>/</span> */}
                {/* <span>{fmt(duration)}</span> */}
              </div>
            </div>

            {/* ── RIGHT — Extra + Volume ── */}
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <Btn label="More options">
                <MoreHorizIcon sx={{ fontSize: 18 }} />
              </Btn>

              <Btn label="Queue">
                <QueueMusicRoundedIcon sx={{ fontSize: 16 }} />
              </Btn>

              {/* Volume icon — click = mute toggle */}
              <Btn label={volume === 0 ? "Unmute" : "Mute"} onClick={handleMute}>
                {volume === 0
                  ? <VolumeOffRoundedIcon sx={{ fontSize: 17 }} />
                  : <VolumeUpRoundedIcon sx={{ fontSize: 17 }} />
                }
              </Btn>

              {/* Volume slider — hidden on mobile, visible md+ */}
              <div
                className="relative hidden md:flex items-center"
                style={{ width: 64, height: 20 }}
              >
                {/* Track */}
                <div
                  className="absolute w-full rounded-full"
                  style={{ height: 3, background: "rgba(255,255,255,0.10)" }}
                />
                {/* Fill */}
                <div
                  className="absolute rounded-full pointer-events-none"
                  style={{
                    height: 3,
                    width: `${volume * 100}%`,
                    background: "rgba(245,245,247,0.6)",
                    transition: "width 0.05s linear",
                  }}
                />
                {/* Range input */}
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={handleVolume}
                  aria-label="Volume"
                  className="absolute inset-0 w-full opacity-0 cursor-pointer"
                  style={{ height: "100%" }}
                />
              </div>
            </div>

          </div>{/* end main row */}

          {/* ── Progress bar — 2px stripe at absolute bottom of pill ── */}
          <div
            className="absolute bottom-0 left-0 right-0 cursor-pointer"
            style={{ height: 2, background: "rgba(255,255,255,0.07)" }}
          >
            {/* Filled portion */}
            <div
              className="h-full"
              style={{
                width: `${progress}%`,
                background: "#ff6961",
                boxShadow: "0 0 6px rgba(255,105,97,0.6)",
                transition: "width 0.25s linear",
              }}
            />
            {/* Invisible seek input */}
            <input
              type="range"
              min={0}
              max={duration || 0}
              value={currentTime}
              onChange={(e) => seek(Number(e.target.value))}
              aria-label="Seek"
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
              style={{ height: "100%" }}
            />
          </div>

        </div>{/* end pill */}
      </div>
    </div >
  );
};

export default PlayerBar;