/**
 * @fileoverview Recently played tracks section — Apple Music dark theme.
 *
 * All business logic, Firebase integration, and data flow are unchanged:
 * - useHistory hook subscription to /users/{uid}/history
 * - Two-step clear confirmation (irreversible destructive action)
 * - disableLike on SongCard to prevent writes on suspended accounts
 * - Inline error feedback below section on clear failure
 *
 * Visual changes:
 * - Dark-theme action button and confirmation pill
 * - Loading skeletons use dark surface colours (#1c1c1e)
 * - All spacing follows the 4/8/12/16/24 scale
 * - Typography uses SF Pro weights (500 medium, 600 semibold)
 */

import { useState, useCallback } from "react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useHistory } from "../hooks/useHistory";
import { clearHistory } from "../services/historyService";
import SongCard from "@/features/songs/components/SongCard";
import { SectionShell } from "@/components/shared/SectionShell";

// ── Design tokens (inline for portability) ────────────────────────────────────
const RED = "#fa243c";
const RED_ALPHA_12 = "rgba(250,36,60,0.12)";
const RED_ALPHA_20 = "rgba(250,36,60,0.20)";
const RED_ALPHA_08 = "rgba(250,36,60,0.08)";
const RED_ALPHA_18 = "rgba(250,36,60,0.18)";
const RED_HOVER = "#e01e33";
const SURFACE_CARD = "#1c1c1e"; // dark card surface
const TEXT_MUTED = "#6e6e73";
const TEXT_SECONDARY = "#8e8e93";

// ─────────────────────────────────────────────────────────────────────────────

const RecentlyPlayed = () => {
  const { user } = useAuth();
  const { historyTracks, loading, refresh } = useHistory(user?.uid ?? "");
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);

  const handleClearConfirm = useCallback(async () => {
    if (!user?.uid) return;
    setClearing(true);
    setClearError(null);
    setConfirmClear(false);
    try {
      await clearHistory(user.uid);
      refresh();
    } catch {
      setClearError("Couldn't clear history. Please try again.");
    } finally {
      setClearing(false);
    }
  }, [user?.uid, refresh]);

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="w-full">
        {/* Skeleton header */}
        <div className="flex items-center justify-between mb-4 px-0.5">
          <div className="flex items-center gap-2">
            <div
              className="rounded-full animate-pulse"
              style={{ width: 3, height: 18, background: SURFACE_CARD }}
            />
            <div
              className="rounded-md animate-pulse"
              style={{ width: 144, height: 15, background: SURFACE_CARD }}
            />
          </div>
          <div
            className="rounded-full animate-pulse"
            style={{ width: 80, height: 26, background: SURFACE_CARD }}
          />
        </div>

        {/* Skeleton cards */}
        <div className="flex gap-3 sm:gap-4 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex-shrink-0"
              style={{ width: "clamp(140px, 18vw, 172px)" }}
            >
              <div
                className="animate-pulse rounded-[10px] mb-2"
                style={{
                  aspectRatio: "1",
                  background: SURFACE_CARD,
                }}
              />
              <div
                className="animate-pulse rounded mb-1.5"
                style={{ height: 11, width: "75%", background: SURFACE_CARD }}
              />
              <div
                className="animate-pulse rounded"
                style={{ height: 10, width: "50%", background: SURFACE_CARD }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (!historyTracks?.length) return null;

  // ── Action slot (passed to SectionShell) ────────────────────────────────────
  /**
   * Two-step confirmation pill.
   *
   * Confirmation mode: "Remove? [Yes] [No]" — compact inline pill.
   * Normal mode: "Clear History" — quiet ghost button.
   *
   * Colour: red-tinted backgrounds, not solid red, so the action
   * reads as secondary (destructive but not primary CTA).
   */
  const action = confirmClear ? (
    <div
      className="flex items-center gap-1.5"
      style={{
        background: RED_ALPHA_08,
        border: `1px solid ${RED_ALPHA_18}`,
        borderRadius: 980,
        padding: "5px 10px",
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: RED,
          whiteSpace: "nowrap",
        }}
      >
        Remove?
      </span>
      <button
        onClick={handleClearConfirm}
        disabled={clearing}
        className="border-none cursor-pointer transition-colors duration-150 disabled:opacity-50"
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "#ffffff",
          background: RED,
          borderRadius: 980,
          padding: "3px 10px",
        }}
        onMouseOver={(e) =>
          ((e.target as HTMLButtonElement).style.background = RED_HOVER)
        }
        onMouseOut={(e) =>
          ((e.target as HTMLButtonElement).style.background = RED)
        }
      >
        {clearing ? "…" : "Yes"}
      </button>
      <button
        onClick={() => setConfirmClear(false)}
        className="border-none cursor-pointer transition-colors duration-150 bg-transparent"
        style={{ fontSize: 11, fontWeight: 600, color: TEXT_SECONDARY }}
      >
        No
      </button>
    </div>
  ) : (
    <button
      onClick={() => setConfirmClear(true)}
      disabled={clearing}
      className="border-none cursor-pointer transition-all duration-150 disabled:opacity-50 whitespace-nowrap"
      style={{
        fontSize: 12,
        fontWeight: 500,
        color: TEXT_MUTED,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 980,
        padding: "5px 14px",
      }}
      onMouseOver={(e) => {
        const btn = e.currentTarget;
        btn.style.color = RED;
        btn.style.background = RED_ALPHA_12;
        btn.style.borderColor = RED_ALPHA_20;
      }}
      onMouseOut={(e) => {
        const btn = e.currentTarget;
        btn.style.color = TEXT_MUTED;
        btn.style.background = "rgba(255,255,255,0.06)";
        btn.style.borderColor = "rgba(255,255,255,0.08)";
      }}
    >
      {clearing ? "Removing…" : "Clear History"}
    </button>
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="w-full">
      <SectionShell title="Recently Played" action={action}>
        {historyTracks.map((track, index) => (
          <div
            key={track.id}
            className="flex-shrink-0"
            style={{
              width: "clamp(132px, 32vw, 172px)",
            }}
          >
            <SongCard
              track={track}
              songs={historyTracks}
              variant="default"
              index={index}
              disableLike
            />
          </div>
        ))}
      </SectionShell>

      {/* Inline clear-history error */}
      {clearError && (
        <p
          className="mt-2 px-0.5"
          style={{ fontSize: 12, color: RED }}
          role="alert"
        >
          {clearError}
        </p>
      )}
    </div>
  );
};

export default RecentlyPlayed;