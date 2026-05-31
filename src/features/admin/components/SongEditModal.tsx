/**
 * @fileoverview Slide-out drawer modal for editing song metadata (admin only).
 *
 * Responsibilities:
 * - Provide inline form for editing song details (title, artist, album, duration)
 * - Manage section assignment (which home page sections display this song)
 * - Handle form validation, save to Firestore, and optimistic UI updates
 * - Animate entrance/exit with slide transition from right edge
 *
 * Related modules:
 * - SongManager (src/features/admin/components/SongManager.tsx) - Opens this modal on edit action
 * - useSections (src/features/sections/hooks/useSections.ts) - Fetches available sections for assignment
 * - Firestore songs collection - Updates song document on save
 *
 * Architectural role:
 * - **Admin-only UI** for managing song catalog metadata
 * - Portal-based modal rendered directly under document.body (avoids z-index issues)
 * - Slide-out drawer pattern (right side) - consistent with user management modal
 *
 * Security boundary (from Firestore security rules):
 * - Only active admin users (isActiveAdmin()) can update songs
 * - Updates restricted to allowed fields: title, artist, album, duration, sectionIds, likeCount
 * - This component only modifies non-likeCount fields (likeCount handled by like/unlike actions)
 *
 * Form validation:
 * - Title and artist are required (isValid = title.trim() && artist.trim())
 * - Album and duration are optional (empty string allowed)
 * - SectionIds can be empty (song not displayed on any section)
 *
 * Modal flow:
 * 1. Parent component passes song prop (null when closed)
 * 2. useEffect populates form when song changes
 * 3. Modal slides in from right (visible state after 10ms delay)
 * 4. User edits fields, selects/deselects sections
 * 5. Save button triggers Firestore updateDoc
 * 6. On success: slides out, calls onClose, parent refreshes song list
 *
 * Animation details:
 * - Entrance: opacity (backdrop) + translateX (modal content)
 * - Duration: 260ms matches modal transition constant
 * - Cubic-bezier easing: (0.32,0,0.15,1) - custom Apple-style curve
 *
 * Accessibility:
 * - role="dialog" with aria-modal="true"
 * - aria-labelledby references modal title
 * - Escape key closes modal
 * - aria-required and aria-invalid on required fields
 * - aria-pressed on section toggle buttons
 * - Disabled save button when invalid or saving
 *
 * Performance:
 * - useCallback for event handlers (toggleSection, updateFormField, handleClose, handleSave)
 * - useMemo for activeSections (filters sections once) and isValid (recalculates on form changes)
 * - Form updates are local state (no Firestore writes until save)
 *
 * @module features/admin/components
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/services/firebase/config";
import { ISong } from "@/features/songs/types";
import { useSections } from "@/features/sections/hooks/useSections";

/**
 * Props for the SongEditModal component.
 *
 * @property song - Song to edit (null when modal is closed/not visible)
 * @property onClose - Callback invoked when modal should close (after animation completes)
 */
interface SongEditModalProps {
  song: ISong | null;
  onClose: () => void;
}

/**
 * Form data structure for song editing.
 *
 * All fields are strings (even sectionIds is string array).
 * Matches Firestore song document fields that admin can edit.
 *
 * @property title - Song title (required)
 * @property artist - Artist name (required)
 * @property album - Album name (optional)
 * @property duration - Track duration string (e.g., "3:45") - optional
 * @property sectionIds - Array of section IDs where this song should appear on home page
 */
interface SongFormData {
  title: string;
  artist: string;
  album: string;
  duration: string;
  sectionIds: string[];
}

/**
 * Modal transition duration in milliseconds.
 * Must match CSS transition duration for smooth animation.
 * Used to delay onClose callback until exit animation completes.
 */
const MODAL_TRANSITION_DURATION = 260;

/**
 * User-facing error message for save failures.
 * Generic to avoid leaking implementation details.
 */
const SAVE_ERROR_MESSAGE = "Failed to save changes";

/**
 * SongEditModal - Slide-out drawer for editing song metadata.
 *
 * Usage in SongManager:
 * ```tsx
 * const [editingSong, setEditingSong] = useState<ISong | null>(null);
 *
 * <SongEditModal
 *   song={editingSong}
 *   onClose={() => setEditingSong(null)}
 * />
 * ```
 *
 * Firestore update operation:
 * - Updates specific fields only (preserves likeCount, createdAt, audioUrl, coverUrl)
 * - Uses updateDoc (not setDoc) to avoid overwriting existing fields
 * - Throws error if user is not admin (security rule enforces)
 *
 * Section assignment:
 * - Sections are categories on home page (e.g., "Trending", "New Releases")
 * - Songs can belong to multiple sections (appears in each)
 * - Only active sections (isActive: true) are shown in selection UI
 *
 * @param props - SongEditModalProps
 * @returns Portal-rendered modal or null if song is null
 */
const SongEditModal = ({ song, onClose }: SongEditModalProps) => {
  /**
   * Controls modal visibility for animation purposes.
   *
   * Separate from song prop because:
   * - song null = modal not rendered at all
   * - visible false = modal exists but hidden (for exit animation)
   *
   * Flow:
   * 1. song becomes non-null → component renders (visible false)
   * 2. setTimeout 10ms → setVisible(true) → entrance animation plays
   * 3. onClose called → setVisible(false) → exit animation plays
   * 4. setTimeout 260ms → onClose callback (parent removes song prop)
   */
  const [visible, setVisible] = useState(false);

  /** Save operation in progress (disables button, shows spinner) */
  const [saving, setSaving] = useState(false);

  /** Form field values */
  const [form, setForm] = useState<SongFormData>({
    title: "",
    artist: "",
    album: "",
    duration: "",
    sectionIds: [],
  });

  /**
   * Fetch available sections from Firestore.
   * Returns all sections (useSections hook includes active/inactive filtering).
   */
  const { sections } = useSections();

  /**
   * Effect 1: Populate form when song changes and trigger entrance animation.
   *
   * When song prop becomes non-null:
   * 1. Reset form with song data (or empty strings if undefined)
   * 2. Delay 10ms then setVisible(true) to trigger entrance animation
   *
   * Why 10ms delay?
   * - Ensures DOM has mounted before applying transition
   * - Prevents animation from being skipped on initial render
   *
   * When song becomes null: reset visible to false (modal hidden)
   */
  useEffect(() => {
    if (song) {
      setForm({
        title: song.title ?? "",
        artist: song.artist ?? "",
        album: song.album ?? "",
        duration: song.duration ?? "",
        sectionIds: song.sectionIds ?? [],
      });
      setTimeout(() => setVisible(true), 10);
    } else {
      setVisible(false);
    }
  }, [song]);

  /**
   * Memoized list of active sections.
   *
   * Only sections with isActive = true are shown in UI.
   * Inactive sections cannot have songs assigned (they don't appear on home page).
   *
   * Performance: Recomputes only when sections array changes.
   */
  const activeSections = useMemo(
    () => sections.filter((s) => s.isActive),
    [sections],
  );

  /**
   * Memoized form validation.
   *
   * Title and artist are required (must have non-whitespace content).
   * Album, duration, and sectionIds are optional.
   *
   * Used to disable save button and prevent submission.
   */
  const isValid = useMemo(
    () => form.title.trim() && form.artist.trim(),
    [form.title, form.artist],
  );

  /**
   * Handles modal close with exit animation.
   *
   * Flow:
   * 1. Set visible = false (triggers exit animation)
   * 2. Wait MODAL_TRANSITION_DURATION ms for animation to complete
   * 3. Call onClose callback (parent removes song prop)
   *
   * Why not call onClose immediately?
   * - Would unmount modal before exit animation completes
   * - Results in jarring disappearance instead of smooth slide-out
   */
  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, MODAL_TRANSITION_DURATION);
  }, [onClose]);

  /**
   * Effect 2: Escape key handler for closing modal.
   *
   * Pressing Escape triggers handleClose (with animation).
   * Standard modal behavior expected by users.
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleClose]);

  /**
   * Toggles section ID in sectionIds array.
   *
   * If section ID exists: removes it (deselect)
   * If section ID doesn't exist: adds it (select)
   *
   * Immutable update: creates new array rather than mutating existing one.
   */
  const toggleSection = useCallback((id: string) => {
    setForm((prev) => ({
      ...prev,
      sectionIds: prev.sectionIds.includes(id)
        ? prev.sectionIds.filter((s) => s !== id)
        : [...prev.sectionIds, id],
    }));
  }, []);

  /**
   * Saves form changes to Firestore.
   *
   * Steps:
   * 1. Validate song exists and form is valid
   * 2. Set saving = true (disables button, shows spinner)
   * 3. Update Firestore document with form values (trimmed strings)
   * 4. On success: call handleClose (closes modal with animation)
   * 5. On error: show alert, log error, keep modal open
   * 6. finally: set saving = false (reenables button)
   *
   * Security note: Firestore security rules enforce admin-only writes.
   * Regular users cannot update songs even if they call this function.
   *
   * Field updates:
   * - All string fields are trimmed (removes leading/trailing spaces)
   * - sectionIds stored as array of strings
   * - likeCount, createdAt, audioUrl, coverUrl NOT updated (preserved)
   */
  const handleSave = useCallback(async () => {
    if (!song || !isValid) return;

    setSaving(true);
    try {
      await updateDoc(doc(db, "songs", song.id), {
        title: form.title.trim(),
        artist: form.artist.trim(),
        album: form.album.trim(),
        duration: form.duration.trim(),
        sectionIds: form.sectionIds,
      });
      handleClose();
    } catch (err) {
      console.error("Failed to update song:", err);
      alert(SAVE_ERROR_MESSAGE);
    } finally {
      setSaving(false);
    }
  }, [song, isValid, form, handleClose]);

  /**
   * Updates a single form field.
   *
   * Generic handler for all text input fields.
   * Uses functional update to avoid stale closure issues.
   *
   * @param field - Field name (keyof SongFormData)
   * @param value - New string value
   */
  const updateFormField = useCallback(
    (field: keyof SongFormData, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  /**
   * Renders a labeled form input field.
   *
   * Abstraction to reduce repetitive JSX for title, artist, album, duration fields.
   * Handles required indicator, ARIA attributes, and styling consistently.
   *
   * @param label - Human-readable label (e.g., "Song Title")
   * @param field - Form field key
   * @param placeholder - Input placeholder text
   * @param required - Whether field is required (shows "*" and validation)
   * @returns Form field JSX
   */
  const renderFormField = (
    label: string,
    field: keyof SongFormData,
    placeholder: string,
    required = false,
  ) => (
    <div>
      <label className="block text-[11px] font-semibold text-[#aeaeb2] uppercase tracking-[0.6px] mb-2">
        {label} {required && "*"}
      </label>
      <input
        type="text"
        value={form[field] as string}
        onChange={(e) => updateFormField(field, e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 bg-white border border-[#e5e5ea] rounded-[10px] text-[13px] text-[#1d1d1f] outline-none transition-all placeholder:text-[#aeaeb2] focus:border-[#fa243c] focus:shadow-[0_0_0_3px_rgba(255,55,95,0.1)]"
        aria-required={required}
        aria-invalid={
          !required || (form[field] as string).trim() ? "false" : "true"
        }
      />
    </div>
  );

  // Don't render anything if no song is being edited.
  if (!song) return null;

  return createPortal(
    <>
      {/* Backdrop overlay - click to close */}
      <div
        onClick={handleClose}
        style={{
          opacity: visible ? 1 : 0,
          transition: "opacity 0.26s ease",
        }}
        className="fixed inset-0 bg-black/20 backdrop-blur-[6px] z-[300]"
        aria-hidden="true"
      />

      {/* Modal drawer - slides in from right */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="song-edit-title"
        style={{
          transform: visible ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.26s cubic-bezier(0.32,0,0.15,1)",
        }}
        className="fixed top-0 right-0 bottom-0 w-[400px] max-w-[95vw] bg-white border-l border-[#e5e5ea] z-[301] flex flex-col overflow-y-auto"
      >
        {/* Modal header with close, title, and save button */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#f5f5f7] sticky top-0 bg-white z-10">
          <button
            onClick={handleClose}
            className="w-[30px] h-[30px] rounded-full bg-[#f5f5f7] border border-[#e5e5ea] flex items-center justify-center text-[#aeaeb2] hover:bg-[#e5e5ea] hover:text-[#6e6e73] transition-all flex-shrink-0"
            aria-label="Close edit modal"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M2 2l10 10M12 2L2 12"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <span
            id="song-edit-title"
            className="flex-1 text-[13px] font-semibold text-[#aeaeb2]"
          >
            Edit Song
          </span>
          <button
            onClick={handleSave}
            disabled={saving || !isValid}
            className="flex items-center justify-center px-4 py-[7px] rounded-[980px] bg-[#fa243c] text-white text-[13px] font-semibold border-none cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#e02650] min-w-[72px]"
            aria-label={saving ? "Saving changes" : "Save changes"}
          >
            {saving ? (
              <span
                className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block"
                aria-hidden="true"
              />
            ) : (
              "Save"
            )}
          </button>
        </div>

        {/* Current song preview (cover art + title/artist) */}
        <div className="px-5 pt-6 pb-4 flex items-center gap-4">
          <div className="w-[72px] h-[72px] rounded-[12px] overflow-hidden bg-[#f5f5f7] flex-shrink-0 shadow-sm">
            {song.coverUrl ? (
              <img
                src={song.coverUrl}
                alt={song.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M9 19V6l12-3v13"
                    stroke="#d1d1d6"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx="6"
                    cy="19"
                    r="3"
                    stroke="#d1d1d6"
                    strokeWidth="1.5"
                  />
                  <circle
                    cx="18"
                    cy="16"
                    r="3"
                    stroke="#d1d1d6"
                    strokeWidth="1.5"
                  />
                </svg>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-[#1d1d1f] truncate">
              {song.title}
            </p>
            <p className="text-[13px] text-[#aeaeb2] truncate mt-0.5">
              {song.artist}
            </p>
          </div>
        </div>

        <div className="h-px bg-[#f5f5f7] mx-5" />

        {/* Edit form */}
        <form
          className="px-5 pt-5 pb-6 flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
        >
          {renderFormField(
            "Song Title",
            "title",
            "e.g. Bohemian Rhapsody",
            true,
          )}
          {renderFormField("Artist", "artist", "e.g. Queen", true)}

          <div className="grid grid-cols-2 gap-3">
            {renderFormField("Album", "album", "e.g. A Night at the Opera")}
            {renderFormField("Duration", "duration", "e.g. 3:45")}
          </div>

          {/* Section assignment - multi-select buttons */}
          <div>
            <label className="block text-[11px] font-semibold text-[#aeaeb2] uppercase tracking-[0.6px] mb-2">
              Sections
              {form.sectionIds.length > 0 && (
                <span className="ml-2 text-[#fa243c] normal-case tracking-normal">
                  {form.sectionIds.length} selected
                </span>
              )}
            </label>
            {activeSections.length === 0 ? (
              <p className="text-[12px] text-[#aeaeb2]">
                No active sections available
              </p>
            ) : (
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label="Select song sections"
              >
                {activeSections.map((section) => {
                  const selected = form.sectionIds.includes(section.id);
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => toggleSection(section.id)}
                      className={`px-3 py-1.5 rounded-[980px] text-[12px] font-semibold border transition-all ${selected
                          ? "bg-[#fa243c] text-white border-[#fa243c]"
                          : "bg-white text-[#6e6e73] border-[#e5e5ea] hover:border-[#fa243c] hover:text-[#fa243c]"
                        }`}
                      aria-pressed={selected}
                      aria-label={`${selected ? "Remove" : "Add"} ${section.title} section`}
                    >
                      {section.title}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </form>
      </div>
    </>,
    document.body,
  );
};

export default SongEditModal;