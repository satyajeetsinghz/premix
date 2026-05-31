/**
 * @fileoverview Admin panel component for managing the song catalog (CRUD operations).
 *
 * Responsibilities:
 * - Display songs in sortable, searchable table with statistics summary
 * - Support editing song metadata via slide-out modal
 * - Support deleting songs with confirmation flow
 * - Show loading states and empty states
 * - Provide real-time updates via Firestore subscriptions
 *
 * Related modules:
 * - useSongs (src/features/songs/hooks/useSongs.ts) - Fetches all songs with real-time listener
 * - SongEditModal (src/features/admin/components/SongEditModal.tsx) - Edit form for song metadata
 * - Firestore songs collection - Source of truth for song data
 *
 * Architectural role:
 * - **Admin-only song management interface** (mounted in AdminPage under "Songs" tab)
 * - Requires isActiveAdmin() per Firestore security rules
 * - Real-time updates ensure multiple admins see changes immediately
 *
 * Security boundary (from Firestore security rules):
 * - Only active admin users (isActiveAdmin()) can read songs collection
 * - Delete operations require isActiveAdmin()
 * - Update operations restricted to allowed fields (handled by SongEditModal)
 *
 * Features:
 * - Search: Debounced search across title, artist, album (uses useTransition for UI responsiveness)
 * - Sorting: Sort by title, artist, likeCount, createdAt (asc/desc toggle)
 * - Statistics: Total songs, total likes, songs with album info
 * - Delete confirmation: Two-step confirmation to prevent accidental deletion
 *
 * Performance optimizations:
 * - useMemo for stats calculation and filtered/sorted songs
 * - useCallback for event handlers (stable references)
 * - useTransition for search debouncing (prevents UI blocking on large datasets)
 * - CSS-only loading skeletons (no external library)
 *
 * Real-time behavior:
 * - useSongs hook subscribes to Firestore onSnapshot
 * - SongManager re-renders automatically when songs change (add/update/delete)
 * - No manual refresh needed
 *
 * @module features/admin/components
 */

import { useState, useMemo, useCallback, useTransition } from "react";
import { deleteDoc, doc } from "firebase/firestore";
import { db } from "@/services/firebase/config";
import { useSongs } from "@/features/songs/hooks/useSongs";
import { ISong } from "@/features/songs/types";
import SongEditModal from "./SongEditModal";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";

/**
 * Sortable column keys.
 *
 * - title: Song title (alphabetical)
 * - artist: Artist name (alphabetical)
 * - likeCount: Number of likes (numeric)
 * - createdAt: Firestore timestamp (chronological)
 */
type SortKey = "title" | "artist" | "likeCount" | "createdAt";

/**
 * Sort direction.
 *
 * - asc: Ascending (A-Z, 0-9, oldest first)
 * - desc: Descending (Z-A, 9-0, newest first)
 */
type SortDir = "asc" | "desc";

/**
 * Props for the StatCard component.
 *
 * @property label - Descriptive label (e.g., "Total Songs")
 * @property value - Numeric value to display
 * @property accent - Color for the value text (hex or Tailwind color class)
 */
interface StatCardProps {
  label: string;
  value: number;
  accent: string;
}

/**
 * Props for the SortIcon component.
 *
 * @property col - Column key this icon represents
 * @property sortKey - Currently active sort column
 * @property sortDir - Current sort direction
 */
interface SortIconProps {
  col: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
}

/**
 * Formats Firestore Timestamp to localized date string.
 *
 * Handles multiple timestamp formats:
 * - Firestore Timestamp object with .seconds property
 * - Date object with .toDate() method
 * - Invalid/null values (returns "—")
 *
 * Format: "MMM DD, YYYY" (e.g., "Jan 15, 2024")
 * Uses Intl.DateTimeFormat for locale-appropriate formatting.
 *
 * @param ts - Firestore Timestamp, Date, or null/undefined
 * @returns Formatted date string or "—" if invalid
 */
const formatDate = (ts: any): string => {
  if (!ts) return "—";
  try {
    const ms = ts?.seconds ? ts.seconds * 1000 : ts?.toDate?.()?.getTime?.();
    if (!ms) return "—";
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(ms));
  } catch {
    return "—";
  }
};

/**
 * StatCard - Displays a single statistic in a card layout.
 *
 * Used in the statistics row above the song table.
 * Shows total count with accent-colored value.
 *
 * @param label - Descriptive label
 * @param value - Numeric value
 * @param accent - Color for the value text
 * @returns Statistic card JSX
 */
const StatCard = ({ label, value, accent }: StatCardProps) => (
  <div
    className="bg-white border border-[#e5e5ea] rounded-[18px] p-[20px_18px_18px] flex flex-col gap-1 shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
    role="region"
    aria-label={`${label}: ${value}`}
  >
    <span
      className="text-[28px] font-bold tracking-[-1px] leading-none"
      style={{ color: accent }}
      aria-label={`Value: ${value}`}
    >
      {value}
    </span>
    <span className="text-[12px] font-medium text-[#6e6e73]">{label}</span>
  </div>
);

/**
 * SortIcon - Visual indicator for sortable columns.
 *
 * Three states:
 * - Inactive (default): Shows both up and down arrows (gray)
 * - Active ascending: Shows single up arrow (brand red)
 * - Active descending: Shows single down arrow (brand red)
 *
 * @param col - Column this icon belongs to
 * @param sortKey - Currently active sort column
 * @param sortDir - Current sort direction
 * @returns SVG icon
 */
const SortIcon = ({ col, sortKey, sortDir }: SortIconProps) => {
  const active = sortKey === col;
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 11 11"
      fill="none"
      style={{ color: active ? "#fa243c" : "#d1d1d6", flexShrink: 0 }}
      aria-hidden="true"
      role="img"
      aria-label={
        active
          ? `Sorted ${sortDir === "asc" ? "ascending" : "descending"} by ${col}`
          : "Sortable column"
      }
    >
      {active && sortDir === "asc" ? (
        // Up arrow (ascending)
        <path
          d="M2 7l3.5-4L9 7"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : active && sortDir === "desc" ? (
        // Down arrow (descending)
        <path
          d="M2 4l3.5 4L9 4"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        // Inactive: both arrows (gray)
        <>
          <path
            d="M2 4l3.5-3L9 4"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M2 7l3.5 3L9 7"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </svg>
  );
};

/**
 * SongManager - Admin panel component for managing song catalog.
 *
 * Usage in AdminPage:
 * ```tsx
 * <TabPanel value="songs">
 *   <SongManager />
 * </TabPanel>
 * ```
 *
 * Real-time updates:
 * - useSongs hook subscribes to Firestore songs collection
 * - Any change (add/edit/delete) triggers re-render with fresh data
 * - No need for manual refresh buttons
 *
 * Search debouncing with useTransition:
 * - Immediate search state (search) updates input value
 * - Deferred search state (deferredSearch) triggers filtering
 * - During transition, table shows opacity overlay (isPending)
 * - Prevents UI blocking on large song catalogs
 *
 * Delete flow:
 * 1. User clicks delete button → confirmDeleteId set to song.id
 * 2. Confirmation buttons appear ("Yes"/"No")
 * 3. User clicks "Yes" → handleDeleteConfirm called
 * 4. Firestore deleteDoc executed
 * 5. Real-time listener updates UI automatically
 *
 * @returns Song management interface with table, search, and statistics
 */
const SongManager = () => {
  // --- Search state with transition debouncing ---
  const [search, setSearch] = useState("");
  const [deferredSearch, setDeferredSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  // --- Sorting state ---
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // --- Modal and delete state ---
  const [editSong, setEditSong] = useState<ISong | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // --- Fetch songs with real-time listener ---
  const { songs, loading } = useSongs();

  /**
   * Memoized statistics derived from songs array.
   *
   * - total: Number of songs in catalog
   * - totalLikes: Sum of likeCount across all songs
   * - withAlbum: Count of songs with non-empty album field
   *
   * Performance: Recalculates only when songs array changes.
   */
  const stats = useMemo(
    () => ({
      total: songs.length,
      totalLikes: songs.reduce((acc, s) => acc + (s.likeCount ?? 0), 0),
      withAlbum: songs.filter((s) => s.album && s.album.trim() !== "").length,
    }),
    [songs],
  );

  /**
   * Memoized filtered and sorted songs.
   *
   * Steps:
   * 1. Filter by search term (if any) across title, artist, album
   * 2. Sort based on sortKey and sortDir
   *
   * Sorting logic:
   * - createdAt: Compares .seconds property (numeric)
   * - likeCount: Compares numeric values
   * - title/artist: Case-insensitive string comparison
   *
   * Performance: Recalculates when songs, deferredSearch, sortKey, or sortDir changes.
   */
  const filtered = useMemo<ISong[]>(() => {
    const q = deferredSearch.trim().toLowerCase();

    // Filter step
    let result = q
      ? songs.filter(
        (s) =>
          s.title?.toLowerCase().includes(q) ||
          s.artist?.toLowerCase().includes(q) ||
          s.album?.toLowerCase().includes(q),
      )
      : [...songs];

    // Sort step
    result.sort((a, b) => {
      let av: any, bv: any;

      if (sortKey === "createdAt") {
        av = a.createdAt?.seconds ?? 0;
        bv = b.createdAt?.seconds ?? 0;
      } else if (sortKey === "likeCount") {
        av = a.likeCount ?? 0;
        bv = b.likeCount ?? 0;
      } else {
        av = (a[sortKey] ?? "").toLowerCase();
        bv = (b[sortKey] ?? "").toLowerCase();
      }

      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [songs, deferredSearch, sortKey, sortDir]);

  /**
   * Handles search input with transition debouncing.
   *
   * Updates immediate search state (input value) immediately.
   * Defers filtering via startTransition to keep UI responsive.
   *
   * @param value - Search query string
   */
  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    startTransition(() => setDeferredSearch(value));
  }, []);

  /**
   * Handles column sorting with toggle logic.
   *
   * If same column clicked: toggle direction (asc ↔ desc)
   * If different column: set new column and default to ascending
   *
   * @param key - Column key to sort by
   */
  const handleSort = useCallback(
    (key: SortKey) => {
      if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      else {
        setSortKey(key);
        setSortDir("asc");
      }
    },
    [sortKey],
  );

  /**
   * Deletes a song from Firestore with confirmation.
   *
   * Steps:
   * 1. Set deletingId (disables button, shows spinner)
   * 2. Clear confirmation state
   * 3. Execute deleteDoc on songs/{id}
   * 4. On error: log to console and show alert
   * 5. Finally: clear deletingId state
   *
   * Note: Real-time listener in useSongs will automatically update the UI
   * when delete completes.
   *
   * @param id - Song document ID to delete
   */
  const handleDeleteConfirm = useCallback(async (id: string) => {
    setDeletingId(id);
    setConfirmDeleteId(null);
    try {
      await deleteDoc(doc(db, "songs", id));
    } catch (error) {
      console.error("Delete error:", error);
      alert("Failed to delete song");
    } finally {
      setDeletingId(null);
    }
  }, []);

  // Loading state: Show centered spinner
  if (loading) {
    return (
      <div
        className="bg-white rounded-[18px] border border-[#e5e5ea] p-8 shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
        role="status"
        aria-live="polite"
        aria-label="Loading songs"
      >
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-7 h-7 border-2 border-[#ffd1d9] border-t-[#fa243c] rounded-full animate-spin" />
          <p className="text-[13px] text-[#aeaeb2]">Loading songs…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className="flex flex-col gap-7"
        role="main"
        aria-label="Song Library Management"
      >
        {/* Header section with title and song count */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-[clamp(24px,2.8vw,34px)] font-bold text-[#1d1d1f] tracking-[-0.7px] leading-[1.08] mb-1.5">
              Song Library
            </h1>
            <p className="text-[15px] text-[#6e6e73] m-0">
              Manage your music catalog
            </p>
          </div>
          <span className="text-[15px] font-medium text-[#6e6e73] whitespace-nowrap pb-[3px]">
            {stats.total} songs
          </span>
        </div>

        {/* Statistics cards row */}
        <div
          className="grid grid-cols-3 gap-3.5"
          role="region"
          aria-label="Song Statistics"
        >
          <StatCard label="Total Songs" value={stats.total} accent="#1d1d1f" />
          <StatCard
            label="Total Likes"
            value={stats.totalLikes}
            accent="#fa243c"
          />
          <StatCard
            label="With Album"
            value={stats.withAlbum}
            accent="#34c759"
          />
        </div>

        {/* Search bar and result count */}
        <div
          className="flex items-center gap-2 flex-wrap"
          role="search"
          aria-label="Search songs"
        >
          <div className="flex-1 min-w-[200px] relative flex items-center">
            <SearchIcon
              className="absolute left-3 text-[#aeaeb2] pointer-events-none"
              sx={{ fontSize: 14 }}
              aria-hidden="true"
            />
            <input
              type="text"
              placeholder="Search by title, artist or album…"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full py-2.5 pl-9 pr-9 bg-white border border-[#e5e5ea] rounded-lg text-[13px] text-[#1d1d1f] outline-none shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all placeholder:text-[#aeaeb2] focus:border-[#fa243c] focus:shadow-[0_0_0_3px_rgba(255,55,95,0.1)]"
              aria-label="Search songs by title, artist, or album"
            />
            {/* Clear search button (appears only when search has content) */}
            {search && (
              <button
                onClick={() => handleSearch("")}
                className="absolute right-2 w-5 h-5 bg-[#f5f5f7] rounded-full flex items-center justify-center text-[#aeaeb2] hover:bg-[#e5e5ea] hover:text-[#6e6e73] transition-all"
                aria-label="Clear search"
              >
                <CloseIcon sx={{ fontSize: 12 }} aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Result count with opacity transition during search */}
          <span
            className="text-[13px] text-[#aeaeb2] ml-auto whitespace-nowrap tabular-nums transition-opacity duration-150"
            style={{ opacity: isPending ? 0.4 : 1 }}
            aria-live="polite"
            aria-label={`Showing ${filtered.length} of ${stats.total} songs`}
          >
            {filtered.length} of {stats.total}
          </span>
        </div>

        {/* Songs table container */}
        <div
          className="bg-white border border-[#e5e5ea] rounded-[18px] shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden transition-opacity duration-150 flex flex-col"
          style={{ opacity: isPending ? 0.65 : 1, maxHeight: "600px" }}
          role="table"
          aria-label="Songs table"
        >
          {filtered.length === 0 ? (
            /* Empty state: No songs match criteria */
            <div
              className="flex flex-col items-center justify-center py-20 gap-4"
              role="status"
              aria-live="polite"
            >
              <svg
                width="44"
                height="44"
                viewBox="0 0 44 44"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  cx="22"
                  cy="22"
                  r="20"
                  stroke="#e5e5ea"
                  strokeWidth="1.5"
                />
                <path
                  d="M14 32V18l16-4v14"
                  stroke="#d1d1d6"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle
                  cx="11"
                  cy="32"
                  r="3"
                  stroke="#d1d1d6"
                  strokeWidth="1.4"
                />
                <circle
                  cx="27"
                  cy="28"
                  r="3"
                  stroke="#d1d1d6"
                  strokeWidth="1.4"
                />
              </svg>
              <div className="text-center">
                <p className="text-[14px] text-[#6e6e73]">No songs found</p>
                <p className="text-[12px] text-[#aeaeb2] mt-1">
                  {search
                    ? "Try a different search term"
                    : "Upload your first song to get started"}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Table header - sticky */}
              <div
                className="sticky top-0 z-10 bg-white border-b border-[#f5f5f7]"
                role="rowgroup"
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[700px]">
                    <thead>
                      <tr className="bg-[#fafafa]" role="row">
                        {/* Cover art column (no sort) */}
                        <th className="px-5 py-3 text-left w-14" scope="col" />

                        {/* Sortable columns: Title, Artist */}
                        {(
                          [
                            { key: "title", label: "Title" },
                            { key: "artist", label: "Artist" },
                          ] as { key: SortKey; label: string }[]
                        ).map((col) => (
                          <th
                            key={col.key}
                            className="px-4 py-3 text-left"
                            scope="col"
                          >
                            <button
                              onClick={() => handleSort(col.key)}
                              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#aeaeb2] uppercase tracking-[0.6px] hover:text-[#6e6e73] transition-colors cursor-pointer bg-none border-none p-0"
                              aria-label={`Sort by ${col.label} ${sortKey === col.key
                                ? sortDir === "asc"
                                  ? "ascending"
                                  : "descending"
                                : ""
                                }`}
                            >
                              {col.label}
                              <SortIcon
                                col={col.key}
                                sortKey={sortKey}
                                sortDir={sortDir}
                              />
                            </button>
                          </th>
                        ))}

                        {/* Album column (no sort) */}
                        <th className="px-4 py-3 text-left" scope="col">
                          <span className="text-[11px] font-semibold text-[#aeaeb2] uppercase tracking-[0.6px]">
                            Album
                          </span>
                        </th>

                        {/* Likes column (sortable) */}
                        <th className="px-4 py-3 text-center" scope="col">
                          <button
                            onClick={() => handleSort("likeCount")}
                            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#aeaeb2] uppercase tracking-[0.6px] hover:text-[#6e6e73] transition-colors cursor-pointer bg-none border-none p-0"
                            aria-label={`Sort by Likes ${sortKey === "likeCount"
                              ? sortDir === "asc"
                                ? "ascending"
                                : "descending"
                              : ""
                              }`}
                          >
                            Likes
                            <SortIcon
                              col="likeCount"
                              sortKey={sortKey}
                              sortDir={sortDir}
                            />
                          </button>
                        </th>

                        {/* Added date column (sortable) - hidden on tablet/mobile */}
                        <th
                          className="px-4 py-3 text-left hidden lg:table-cell"
                          scope="col"
                        >
                          <button
                            onClick={() => handleSort("createdAt")}
                            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#aeaeb2] uppercase tracking-[0.6px] hover:text-[#6e6e73] transition-colors cursor-pointer bg-none border-none p-0"
                            aria-label={`Sort by Added ${sortKey === "createdAt"
                              ? sortDir === "asc"
                                ? "ascending"
                                : "descending"
                              : ""
                              }`}
                          >
                            Added
                            <SortIcon
                              col="createdAt"
                              sortKey={sortKey}
                              sortDir={sortDir}
                            />
                          </button>
                        </th>

                        {/* Actions column (no sort) */}
                        <th className="px-4 py-3 text-right" scope="col">
                          <span className="text-[11px] font-semibold text-[#aeaeb2] uppercase tracking-[0.6px]">
                            Actions
                          </span>
                        </th>
                      </tr>
                    </thead>
                  </table>
                </div>
              </div>

              {/* Scrollable table body */}
              <div
                className="overflow-y-auto"
                style={{ maxHeight: "calc(600px - 53px)" }}
                role="rowgroup"
              >
                <table className="w-full text-sm min-w-[700px]">
                  <tbody className="divide-y divide-[#f5f5f7]">
                    {filtered.map((song) => (
                      <tr
                        key={song.id}
                        className="hover:bg-[#fafafa] transition-colors group"
                        role="row"
                      >
                        {/* Cover art thumbnail */}
                        <td className="px-5 py-3.5" role="cell">
                          <div className="w-11 h-11 rounded-[8px] overflow-hidden bg-[#f5f5f7] shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex-shrink-0">
                            {song.coverUrl ? (
                              <img
                                src={song.coverUrl}
                                alt={song.title}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <svg
                                  width="16"
                                  height="16"
                                  viewBox="0 0 16 16"
                                  fill="none"
                                  aria-hidden="true"
                                >
                                  <path
                                    d="M6 13V5l9-2v8"
                                    stroke="#d1d1d6"
                                    strokeWidth="1.3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                  <circle
                                    cx="3.5"
                                    cy="13"
                                    r="2.5"
                                    stroke="#d1d1d6"
                                    strokeWidth="1.3"
                                  />
                                  <circle
                                    cx="12.5"
                                    cy="11"
                                    r="2.5"
                                    stroke="#d1d1d6"
                                    strokeWidth="1.3"
                                  />
                                </svg>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Title + duration */}
                        <td className="px-4 py-3.5 max-w-[180px]" role="cell">
                          <p className="text-[13px] font-semibold text-[#1d1d1f] truncate">
                            {song.title}
                          </p>
                          {song.duration && (
                            <p className="text-[11px] text-[#aeaeb2] mt-0.5">
                              {song.duration}
                            </p>
                          )}
                        </td>

                        {/* Artist */}
                        <td className="px-4 py-3.5 max-w-[140px]" role="cell">
                          <p className="text-[13px] text-[#6e6e73] truncate">
                            {song.artist}
                          </p>
                        </td>

                        {/* Album (optional) */}
                        <td className="px-4 py-3.5 max-w-[140px]" role="cell">
                          <p className="text-[13px] text-[#aeaeb2] truncate">
                            {song.album && song.album.trim() ? song.album : "—"}
                          </p>
                        </td>

                        {/* Like count with heart icon */}
                        <td className="px-4 py-3.5 text-center" role="cell">
                          <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[#fa243c]">
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 10 10"
                              fill="currentColor"
                              aria-hidden="true"
                            >
                              <path d="M5 9L1.07 5.07a2.5 2.5 0 0 1 3.54-3.54L5 2.04l.39-.51a2.5 2.5 0 1 1 3.54 3.54L5 9z" />
                            </svg>
                            {song.likeCount ?? 0}
                          </span>
                        </td>

                        {/* Creation date - hidden on tablet/mobile */}
                        <td
                          className="px-4 py-3.5 hidden lg:table-cell"
                          role="cell"
                        >
                          <span className="text-[12px] text-[#aeaeb2] tabular-nums">
                            {formatDate(song.createdAt)}
                          </span>
                        </td>

                        {/* Action buttons: Edit + Delete */}
                        <td className="px-4 py-3.5" role="cell">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Edit button - opens SongEditModal */}
                            <button
                              onClick={() => setEditSong(song)}
                              className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[#aeaeb2] hover:text-[#1d1d1f] hover:bg-[#f5f5f7] transition-all opacity-0 group-hover:opacity-100"
                              title="Edit song"
                              aria-label={`Edit ${song.title}`}
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 14 14"
                                fill="none"
                                aria-hidden="true"
                              >
                                <path
                                  d="M10 2l2 2-8 8H2v-2L10 2z"
                                  stroke="currentColor"
                                  strokeWidth="1.4"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>

                            {/* Delete button with confirmation flow */}
                            {confirmDeleteId === song.id ? (
                              /* Confirmation UI (shown after clicking delete) */
                              <div
                                className="flex items-center gap-1.5 bg-[#fff0f3] border border-[#ffd1d9] rounded-[980px] px-2 py-1"
                                role="group"
                                aria-label="Delete confirmation"
                              >
                                <span className="text-[11px] font-medium text-[#fa243c] whitespace-nowrap">
                                  Delete?
                                </span>
                                <button
                                  onClick={() => handleDeleteConfirm(song.id)}
                                  disabled={deletingId === song.id}
                                  className="text-[11px] font-semibold text-white bg-[#fa243c] rounded-[980px] px-2 py-0.5 hover:bg-[#fa243c] transition-all disabled:opacity-50"
                                  aria-label="Confirm delete"
                                >
                                  {deletingId === song.id ? "…" : "Yes"}
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="text-[11px] font-semibold text-[#6e6e73] hover:text-[#1d1d1f] transition-colors"
                                  aria-label="Cancel delete"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              /* Delete button (initial state) */
                              <button
                                onClick={() => setConfirmDeleteId(song.id)}
                                disabled={deletingId === song.id}
                                className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[#aeaeb2] hover:text-[#fa243c] hover:bg-[#fff0f3] transition-all opacity-0 group-hover:opacity-100 disabled:cursor-not-allowed"
                                title="Delete song"
                                aria-label={`Delete ${song.title}`}
                              >
                                {deletingId === song.id ? (
                                  <span
                                    className="w-3.5 h-3.5 border-2 border-[#ffd1d9] border-t-[#fa243c] rounded-full animate-spin inline-block"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <svg
                                    width="13"
                                    height="13"
                                    viewBox="0 0 13 13"
                                    fill="none"
                                    aria-hidden="true"
                                  >
                                    <path
                                      d="M2 3.5h9M5 3.5V2h3v1.5M4.5 3.5v7h4v-7"
                                      stroke="currentColor"
                                      strokeWidth="1.3"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Table footer with summary stats */}
              <div
                className="px-5 py-3.5 border-t border-[#f5f5f7] bg-[#fafafa] flex items-center justify-between"
                role="contentinfo"
              >
                <p className="text-[12px] text-[#aeaeb2]">
                  {filtered.length} {filtered.length === 1 ? "song" : "songs"}
                  {search && filtered.length !== stats.total && (
                    <span> · filtered from {stats.total} total</span>
                  )}
                </p>
                <p className="text-[12px] text-[#aeaeb2]">
                  {stats.totalLikes.toLocaleString()} total likes
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Edit modal - renders when editSong is not null */}
      <SongEditModal song={editSong} onClose={() => setEditSong(null)} />
    </>
  );
};

export default SongManager;