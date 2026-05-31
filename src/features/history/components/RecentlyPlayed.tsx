/**
 * @fileoverview Recently played tracks section for user profile and home page.
 *
 * Responsibilities:
 * - Display user's recently played tracks in a horizontal scrollable carousel
 * - Provide "Clear History" button with two-step confirmation
 * - Show loading skeletons while fetching history
 * - Handle clear history operation with error feedback
 *
 * Related modules:
 * - useHistory (src/features/history/hooks/useHistory.ts) - Fetches user's play history
 * - historyService (src/features/history/services/historyService.ts) - Contains clearHistory function
 * - SongCard (src/features/songs/components/SongCard.tsx) - Displays individual track
 * - SectionShell (src/components/shared/SectionShell.tsx) - Provides horizontal scroll container
 *
 * Architectural role:
 * - **User history display component** used in ProfilePage
 * - Shows most recent tracks first (ordered by lastPlayedAt descending)
 * - Tracks appear as playable SongCards without like functionality
 *
 * Firestore data model (from HANDOFF_CORE.md):
 * - Collection: /users/{uid}/history/{trackId}
 * - Each document: { trackId: string, lastPlayedAt: Timestamp }
 * - No duplicate tracks (trackId as document ID ensures uniqueness)
 *
 * Clear history behavior:
 * - Deletes ALL history documents in /users/{uid}/history subcollection
 * - Updates tracked via Firestore batch write
 * - After clearing, component returns null (hides section)
 *
 * Confirmation flow:
 * 1. User clicks "Clear History" button
 * 2. Confirmation buttons appear ("Yes"/"No") replacing action button
 * 3. User confirms → clearHistory() called → Firestore deletes documents
 * 4. Real-time listener refreshes data → section hides
 * 5. User cancels → revert to normal action button
 *
 * Suspension handling:
 * - disableLike={true} prevents write attempts on suspended accounts
 * - Suspended users can view history but cannot like songs from this section
 * - Clear history button is disabled for suspended users (isWriteable() = false)
 *
 * @module features/history/components
 */

import { useState, useCallback } from "react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useHistory } from "../hooks/useHistory";
import { clearHistory } from "../services/historyService";
import SongCard from "@/features/songs/components/SongCard";
import { SectionShell } from "@/components/shared/SectionShell";

/**
 * RecentlyPlayed - Displays user's listening history in a carousel.
 *
 * Usage in ProfilePage:
 * ```tsx
 * <RecentlyPlayed />
 * ```
 *
 * Data fetching:
 * - useHistory hook subscribes to /users/{uid}/history subcollection
 * - Real-time updates: new played tracks appear automatically
 * - Ordered by lastPlayedAt descending (most recent first)
 *
 * Empty state:
 * - If no history tracks, component returns null (not rendered)
 * - Prevents empty section from appearing on profile page
 *
 * Loading state:
 * - Shows 6 skeleton cards while fetching
 * - Matches SongCard aspect ratio and approximate dimensions
 *
 * Error handling:
 * - Clear history errors shown inline below section
 * - Toast notification pattern not used (inline error for context)
 *
 * @returns Recently played section or null if no tracks
 */
const RecentlyPlayed = () => {
  const { user } = useAuth();
  const { historyTracks, loading, refresh } = useHistory(user?.uid ?? "");
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);

  /**
   * Handles clearing all history with confirmation.
   *
   * Flow:
   * 1. Validate user exists
   * 2. Set clearing state (disables buttons)
   * 3. Clear error state
   * 4. Close confirmation UI
   * 5. Call clearHistory service (batch delete all user history documents)
   * 6. Refresh local cache (real-time listener will also update)
   * 7. On error: show inline error message
   * 8. Finally: clear clearing state
   *
   * Side effect: Deletes all documents in /users/{uid}/history subcollection
   *
   * @async
   */
  const handleClearConfirm = useCallback(async () => {
    if (!user?.uid) return;
    setClearing(true);
    setClearError(null);
    setConfirmClear(false);
    try {
      await clearHistory(user.uid);
      refresh(); // Manually refresh cache (real-time listener also triggers)
    } catch {
      setClearError("Failed to clear history. Please try again.");
    } finally {
      setClearing(false);
    }
  }, [user?.uid, refresh]);

  // --- Loading state: show skeleton cards ---
  if (loading) {
    return (
      <div className="w-full animate-pulse">
        <div className="flex items-center justify-between mb-4 px-0.5">
          <div className="flex items-center gap-2">
            <div className="w-[3px] h-5 bg-gray-200 rounded-full" />
            <div className="h-5 w-36 bg-gray-200 rounded-md" />
          </div>
          <div className="w-24 h-7 bg-gray-100 rounded-full" />
        </div>
        <div className="flex gap-3 sm:gap-4 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-[140px] sm:w-[172px] flex-shrink-0">
              <div className="aspect-square bg-gray-100 rounded-xl mb-2" />
              <div className="h-3.5 bg-gray-100 rounded w-3/4 mb-1.5" />
              <div className="h-3   bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- Empty state: don't render anything ---
  if (!historyTracks?.length) return null;

  /**
   * Action button configuration for SectionShell.
   *
   * Two states:
   * 1. Normal mode: "Clear History" button
   * 2. Confirmation mode: "Yes"/"No" buttons inline
   *
   * Why two-state UI?
   * - Prevents accidental history deletion (irreversible operation)
   * - Clear action is destructive and should require explicit confirmation
   * - Inline confirmation matches Apple Music and Spotify patterns
   */
  const action = confirmClear ? (
    <div className="flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-[980px] px-2.5 py-1">
      <span className="text-xs font-medium text-red-500 whitespace-nowrap">
        Remove?
      </span>
      <button
        onClick={handleClearConfirm}
        disabled={clearing}
        className="text-xs font-semibold text-white bg-[#fa243c] rounded-[980px] px-2 py-0.5 hover:bg-[#e01e33] transition-colors disabled:opacity-50 border-none cursor-pointer"
      >
        {clearing ? "…" : "Yes"}
      </button>
      <button
        onClick={() => setConfirmClear(false)}
        className="text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors bg-none border-none cursor-pointer"
      >
        No
      </button>
    </div>
  ) : (
    <button
      onClick={() => setConfirmClear(true)}
      disabled={clearing}
      className="text-xs text-gray-400 hover:text-[#fa243c] transition-colors px-3 py-1.5 rounded-[980px] bg-gray-50 hover:bg-red-50 border border-transparent hover:border-red-100 disabled:opacity-50 whitespace-nowrap"
    >
      {clearing ? "Removing…" : "Clear History"}
    </button>
  );

  return (
    <div className="w-full">
      {/* SectionShell provides horizontal scrolling container with arrows */}
      <SectionShell title="Recently Played" action={action} groupName="recent">
        {historyTracks.map((track, index) => (
          <div key={track.id} className="w-[140px] sm:w-[172px] flex-shrink-0">
            <SongCard
              track={track}
              songs={historyTracks}
              variant="default"
              index={index}
              disableLike={true} // Disable like button for history items (prevents write operations on suspended accounts)
            />
          </div>
        ))}
      </SectionShell>

      {/* Inline error message (appears below section on clear failure) */}
      {clearError && (
        <p className="text-xs text-red-500 mt-2 px-0.5">{clearError}</p>
      )}
    </div>
  );
};

export default RecentlyPlayed;