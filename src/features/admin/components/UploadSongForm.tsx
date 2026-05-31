/**
 * @fileoverview Admin panel form for uploading new songs to Cloudinary and Firestore.
 *
 * Responsibilities:
 * - Collect song metadata (title, artist, album, duration, sections)
 * - Handle audio file and cover image uploads with drag-and-drop support
 * - Validate required fields and file types before submission
 * - Upload files to Cloudinary via uploadSong service
 * - Store song document in Firestore after successful uploads
 * - Provide user feedback via toast notifications and loading states
 *
 * Related modules:
 * - uploadSong.service (src/features/admin/services/uploadSong.service.ts) - Orchestrates Cloudinary uploads and Firestore writes
 * - useSections (src/features/sections/hooks/useSections.ts) - Fetches available sections for song categorization
 * - Cloudinary service (src/features/admin/services/cloudinary.service.ts) - Handles file upload to Cloudinary
 *
 * Architectural role:
 * - **Admin-only song creation interface** (mounted in AdminPage under "Upload" tab)
 * - Requires isActiveAdmin() per Firestore security rules
 * - Serverless upload flow: Client → Cloudinary → Firestore (no backend API)
 *
 * Security boundary (from Firestore security rules):
 * - Only active admin users (isActiveAdmin()) can create songs
 * - Security rule validates all required fields are present
 * - likeCount must be 0 on creation (initially no likes)
 *
 * File upload flow:
 * 1. User selects audio file (MP3, WAV, FLAC, AAC) and cover image (PNG, JPG, GIF)
 * 2. Form validation checks required fields and file presence
 * 3. uploadSong service uploads files to Cloudinary (returns secure URLs)
 * 4. Song document created in Firestore with Cloudinary URLs
 * 5. Form resets on success, toast notification shown
 *
 * Drag-and-drop implementation:
 * - Separate drop zones for audio and cover (visual distinction)
 * - Drag state tracked via dragOver state variable
 * - Prevents default browser behavior on drag events
 * - Click-to-upload fallback via hidden file inputs
 *
 * Form validation:
 * - Title and artist required (trim whitespace)
 * - Audio file and cover image required
 * - Album and duration optional (can be empty string)
 * - Sections optional (empty array allowed)
 *
 * Toast notifications:
 * - Success: Green toast with checkmark icon
 * - Error: Red toast with warning icon
 * - Auto-dismiss after 4.5 seconds (TOAST_AUTO_DISMISS_DELAY)
 *
 * Performance:
 * - useCallback for event handlers (prevents recreation on each render)
 * - useMemo for activeSections (filters once) and canSubmit (derived state)
 * - URL.revokeObjectURL on cover image cleanup (prevents memory leaks)
 *
 * @module features/admin/components
 */

import { useState, useCallback, useRef, useMemo } from "react";
import { uploadSong } from "../services/uploadSong.service";
import { useSections } from "@/features/sections/hooks/useSections";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import ImageIcon from "@mui/icons-material/Image";
import AudioFileIcon from "@mui/icons-material/AudioFile";
import CloseIcon from "@mui/icons-material/Close";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";

/**
 * Toast notification types.
 * - success: Green toast for successful uploads
 * - error: Red toast for validation or upload failures
 */
type ToastType = "success" | "error";

/**
 * Toast state structure.
 * @property message - User-facing message (e.g., "Song uploaded successfully!")
 * @property type - Toast variant (success or error)
 */
interface ToastState {
  message: string;
  type: ToastType;
}

/**
 * Duration in milliseconds before toast auto-dismisses.
 * 4.5 seconds provides enough time to read but doesn't linger too long.
 */
const TOAST_AUTO_DISMISS_DELAY = 4500;

/**
 * Formats file size in bytes to human-readable string.
 *
 * Logic:
 * - If > 1 MB (1,048,576 bytes): show in MB (e.g., "2.3 MB")
 * - Otherwise: show in KB (e.g., "456 KB")
 *
 * Used in audio file preview to show file size.
 *
 * @param bytes - File size in bytes
 * @returns Formatted string with appropriate unit
 */
const formatSize = (bytes: number): string =>
  bytes > 1_048_576
    ? `${(bytes / 1_048_576).toFixed(1)} MB`
    : `${(bytes / 1024).toFixed(0)} KB`;

/**
 * UploadSongForm - Admin form for uploading new songs.
 *
 * Usage in AdminPage:
 * ```tsx
 * <TabPanel value="upload">
 *   <UploadSongForm />
 * </TabPanel>
 * ```
 *
 * Form fields:
 * - Song Title (required)
 * - Artist (required)
 * - Album (optional)
 * - Duration (optional, free text like "3:45")
 * - Sections (multi-select, optional)
 * - Cover Image (required, drag-drop or click)
 * - Audio File (required, drag-drop or click)
 *
 * Real-time validation:
 * - Submit button enabled only when canSubmit = true
 * - Validation runs on every keystroke/file change
 * - Clear error messages guide user to complete missing fields
 *
 * Memory management:
 * - Cover image preview uses URL.createObjectURL
 * - URL.revokeObjectURL called when cover is removed or changed
 * - Prevents memory leaks from hanging blob URLs
 *
 * @returns Upload form JSX with drag-drop zones and validation
 */
const UploadSongForm = () => {
  // --- Form field state ---
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [album, setAlbum] = useState("");
  const [duration, setDuration] = useState("");
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  // --- UI state ---
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [dragOver, setDragOver] = useState<"audio" | "cover" | null>(null);

  // --- Hooks ---
  const { sections } = useSections();

  // --- Refs for hidden file inputs ---
  const audioInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  /**
   * Memoized list of active sections.
   *
   * Only sections with isActive = true are shown in UI.
   * Inactive sections cannot have songs assigned (they don't appear on home page).
   */
  const activeSections = useMemo(
    () => sections.filter((s) => s.isActive),
    [sections],
  );

  /**
   * Memoized submit button enabled state.
   *
   * Requirements:
   * - Title and artist must have non-whitespace content
   * - Audio file and cover file must be selected
   * - Not currently uploading (loading = false)
   *
   * Used to disable submit button and show helper text.
   */
  const canSubmit = useMemo(
    () =>
      !!(title.trim() && artist.trim() && audioFile && coverFile && !loading),
    [title, artist, audioFile, coverFile, loading],
  );

  /**
   * Displays a toast notification that auto-dismisses.
   *
   * @param message - User-facing message
   * @param type - Toast variant (success or error)
   */
  const showToast = useCallback((message: string, type: ToastType) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), TOAST_AUTO_DISMISS_DELAY);
  }, []);

  /**
   * Sets cover image file and creates object URL for preview.
   *
   * Memory management:
   * - Revokes previous object URL before creating new one
   * - Prevents memory leaks from hanging blob URLs
   * - Clears file input value to allow re-uploading same file
   *
   * @param file - Cover image file or null to clear
   */
  const setCover = useCallback((file: File | null) => {
    setCoverPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
    setCoverFile(file);
    if (!file && coverInputRef.current) coverInputRef.current.value = "";
  }, []);

  /**
   * Clears selected audio file and resets file input.
   *
   * Allows user to re-select a different audio file.
   */
  const clearAudio = useCallback(() => {
    setAudioFile(null);
    if (audioInputRef.current) audioInputRef.current.value = "";
  }, []);

  /**
   * Handles file selection via file input.
   *
   * @param e - Change event from file input
   * @param type - File type ("audio" or "cover")
   */
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, type: "audio" | "cover") => {
      const file = e.target.files?.[0] ?? null;
      if (!file) return;
      if (type === "audio") setAudioFile(file);
      else setCover(file);
    },
    [setCover],
  );

  /**
   * Handles file drop on drag-and-drop zones.
   *
   * Prevents default browser behavior and validates file type:
   * - Cover: Must have image MIME type (starts with "image/")
   * - Audio: Must have audio MIME type (starts with "audio/")
   *
   * @param e - Drag event
   * @param type - Drop zone type ("audio" or "cover")
   */
  const handleDrop = useCallback(
    (e: React.DragEvent, type: "audio" | "cover") => {
      e.preventDefault();
      setDragOver(null);
      const file = e.dataTransfer.files?.[0] ?? null;
      if (!file) return;
      if (type === "cover" && file.type.startsWith("image/")) setCover(file);
      if (type === "audio" && file.type.startsWith("audio/"))
        setAudioFile(file);
    },
    [setCover],
  );

  /**
   * Toggles section selection for song categorization.
   *
   * If section ID already selected: removes it
   * If section ID not selected: adds it
   *
   * @param id - Section document ID
   */
  const toggleSection = useCallback(
    (id: string) =>
      setSelectedSections((prev) =>
        prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
      ),
    [],
  );

  /**
   * Resets all form fields to initial state.
   *
   * Called after successful upload to prepare form for next song.
   * Clears text inputs, files, preview, and section selections.
   */
  const resetForm = useCallback(() => {
    setTitle("");
    setArtist("");
    setAlbum("");
    setDuration("");
    clearAudio();
    setCover(null);
    setSelectedSections([]);
  }, [clearAudio, setCover]);

  /**
   * Handles form submission - uploads song to Cloudinary and Firestore.
   *
   * Validation steps before upload:
   * 1. Title not empty
   * 2. Artist not empty
   * 3. Audio file selected
   * 4. Cover image selected
   *
   * Upload flow:
   * 1. Set loading = true (disables form, shows spinner)
   * 2. Call uploadSong service (uploads files → creates Firestore doc)
   * 3. On success: show success toast, reset form
   * 4. On error: log error, show error toast, keep form state
   * 5. Finally: set loading = false
   *
   * @param e - Form submit event
   */
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!title.trim()) return showToast("Song title is required", "error");
      if (!artist.trim()) return showToast("Artist name is required", "error");
      if (!audioFile) return showToast("Audio file is required", "error");
      if (!coverFile) return showToast("Cover image is required", "error");

      setLoading(true);
      try {
        await uploadSong(
          title.trim(),
          artist.trim(),
          audioFile,
          coverFile,
          selectedSections,
          duration.trim(),
          album.trim(),
        );
        showToast("Song uploaded successfully!", "success");
        resetForm();
      } catch (err) {
        console.error("Upload failed:", err);
        showToast("Upload failed. Please try again.", "error");
      } finally {
        setLoading(false);
      }
    },
    [
      title,
      artist,
      audioFile,
      coverFile,
      selectedSections,
      duration,
      album,
      showToast,
      resetForm,
    ],
  );

  /**
   * Base CSS classes for drag-and-drop zones.
   *
   * Shared between audio and cover drop zones.
   * - Fixed height: 152px
   * - Rounded corners: 12px
   * - Dashed border: 2px
   * - Flex column layout for centering content
   */
  const zoneBase =
    "h-[152px] rounded-[12px] border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-all";

  /**
   * CSS classes for idle state (not dragging).
   *
   * - Light gray border (#e5e5ea)
   * - Very light gray background (#fafafa)
   * - On hover: brand red border + pinkish background
   */
  const zoneIdle =
    "border-[#e5e5ea] bg-[#fafafa] hover:border-[#fa243c] hover:bg-[#fff8f9]";

  /**
   * CSS classes for drag-over state (file being dragged over zone).
   *
   * - Brand red border (#fa243c)
   * - Pink background (#fff0f3)
   * - Gives visual feedback that drop is valid
   */
  const zoneDrag = "border-[#fa243c] bg-[#fff0f3]";

  return (
    <div
      className="w-full bg-white rounded-[18px] border border-[#e5e5ea] shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden"
      role="main"
      aria-label="Upload New Song Form"
    >
      {/* Header section */}
      <div className="px-8 pt-7 pb-5 border-b border-[#f5f5f7] flex items-end justify-between gap-4">
        <div>
          <h2 className="text-[clamp(22px,2.5vw,28px)] font-bold text-[#1d1d1f] tracking-[-0.6px] leading-[1.1] mb-1">
            Upload New Song
          </h2>
          <p className="text-[14px] text-[#6e6e73] m-0">
            Add a new track to your music library
          </p>
        </div>
        <span
          className="text-[12px] text-[#aeaeb2] whitespace-nowrap pb-0.5"
          aria-label="Required fields indicator"
        >
          * Required
        </span>
      </div>

      {/* Toast notification - conditionally rendered */}
      {toast && (
        <div
          className={`mx-8 mt-5 flex items-center gap-3 px-4 py-3 rounded-[12px] border text-[13px] font-medium ${toast.type === "success"
              ? "bg-[#f0fdf4] border-[#bbf7d0] text-[#166534]"
              : "bg-[#fff0f3] border-[#ffd1d9] text-[#fa243c]"
            }`}
          role="alert"
          aria-live="assertive"
          aria-label={`${toast.type === "success" ? "Success" : "Error"}: ${toast.message}`}
        >
          {toast.type === "success" ? (
            <CheckCircleOutlineIcon sx={{ fontSize: 16 }} aria-hidden="true" />
          ) : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx="7"
                cy="7"
                r="5.5"
                stroke="currentColor"
                strokeWidth="1.4"
              />
              <path
                d="M7 4v3.5M7 9.5v.3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          )}
          {toast.message}
        </div>
      )}

      {/* Main form - two-column layout */}
      <form
        onSubmit={handleSubmit}
        noValidate
        role="form"
        aria-label="Song upload form"
      >
        <div className="p-8 grid grid-cols-2 gap-8">
          {/* Left column: Text fields and sections */}
          <div className="flex flex-col gap-5">
            {/* Song Title (required) */}
            <div>
              <label
                className="block text-[11px] font-semibold text-[#aeaeb2] uppercase tracking-[0.6px] mb-2"
                htmlFor="song-title"
              >
                Song Title *
              </label>
              <input
                id="song-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Bohemian Rhapsody"
                className="w-full px-4 py-2.5 bg-white border border-[#e5e5ea] rounded-[10px] text-[13px] text-[#1d1d1f] outline-none transition-all placeholder:text-[#aeaeb2] focus:border-[#fa243c] focus:shadow-[0_0_0_3px_rgba(255,55,95,0.1)]"
                aria-required="true"
                aria-describedby="title-error"
              />
            </div>

            {/* Artist (required) */}
            <div>
              <label
                className="block text-[11px] font-semibold text-[#aeaeb2] uppercase tracking-[0.6px] mb-2"
                htmlFor="song-artist"
              >
                Artist *
              </label>
              <input
                id="song-artist"
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="e.g. Queen"
                className="w-full px-4 py-2.5 bg-white border border-[#e5e5ea] rounded-[10px] text-[13px] text-[#1d1d1f] outline-none transition-all placeholder:text-[#aeaeb2] focus:border-[#fa243c] focus:shadow-[0_0_0_3px_rgba(255,55,95,0.1)]"
                aria-required="true"
                aria-describedby="artist-error"
              />
            </div>

            {/* Album and Duration (both optional) - two-column grid */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  className="block text-[11px] font-semibold text-[#aeaeb2] uppercase tracking-[0.6px] mb-2"
                  htmlFor="song-album"
                >
                  Album
                </label>
                <input
                  id="song-album"
                  type="text"
                  value={album}
                  onChange={(e) => setAlbum(e.target.value)}
                  placeholder="e.g. A Night at the Opera"
                  className="w-full px-4 py-2.5 bg-white border border-[#e5e5ea] rounded-[10px] text-[13px] text-[#1d1d1f] outline-none transition-all placeholder:text-[#aeaeb2] focus:border-[#fa243c] focus:shadow-[0_0_0_3px_rgba(255,55,95,0.1)]"
                />
              </div>
              <div>
                <label
                  className="block text-[11px] font-semibold text-[#aeaeb2] uppercase tracking-[0.6px] mb-2"
                  htmlFor="song-duration"
                >
                  Duration
                </label>
                <input
                  id="song-duration"
                  type="text"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="e.g. 3:45"
                  className="w-full px-4 py-2.5 bg-white border border-[#e5e5ea] rounded-[10px] text-[13px] text-[#1d1d1f] outline-none transition-all placeholder:text-[#aeaeb2] focus:border-[#fa243c] focus:shadow-[0_0_0_3px_rgba(255,55,95,0.1)]"
                />
              </div>
            </div>

            {/* Sections (optional multi-select) */}
            <div>
              <label className="block text-[11px] font-semibold text-[#aeaeb2] uppercase tracking-[0.6px] mb-2">
                Sections
                {selectedSections.length > 0 && (
                  <span
                    className="ml-2 text-[#fa243c] normal-case tracking-normal"
                    aria-live="polite"
                  >
                    {selectedSections.length} selected
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
                  aria-label="Song sections"
                >
                  {activeSections.map((section) => {
                    const sel = selectedSections.includes(section.id);
                    return (
                      <button
                        type="button"
                        key={section.id}
                        onClick={() => toggleSection(section.id)}
                        className={`px-3 py-1.5 rounded-[980px] text-[12px] font-semibold border transition-all ${sel
                            ? "bg-[#fa243c] text-white border-[#fa243c]"
                            : "bg-white text-[#6e6e73] border-[#e5e5ea] hover:border-[#fa243c] hover:text-[#fa243c]"
                          }`}
                        aria-pressed={sel}
                        aria-label={`${sel ? "Remove" : "Add"} section: ${section.title}`}
                      >
                        {section.title}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right column: File uploads (cover + audio) */}
          <div className="flex flex-col gap-5">
            {/* Cover Image upload zone (required) */}
            <div>
              <label className="block text-[11px] font-semibold text-[#aeaeb2] uppercase tracking-[0.6px] mb-2">
                Cover Image *
              </label>
              {!coverPreview ? (
                /* Empty state - drop zone */
                <div
                  onDrop={(e) => handleDrop(e, "cover")}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver("cover");
                  }}
                  onDragLeave={() => setDragOver(null)}
                  onClick={() => coverInputRef.current?.click()}
                  className={`${zoneBase} ${dragOver === "cover" ? zoneDrag : zoneIdle
                    }`}
                  role="button"
                  tabIndex={0}
                  aria-label="Upload cover image - click or drag and drop"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      coverInputRef.current?.click();
                    }
                  }}
                >
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, "cover")}
                    className="hidden"
                    aria-label="Cover image file input"
                  />
                  <div className="w-10 h-10 rounded-full bg-white border border-[#e5e5ea] flex items-center justify-center shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                    <ImageIcon
                      sx={{ fontSize: 18 }}
                      className="text-[#aeaeb2]"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-[13px] font-medium text-[#1d1d1f]">
                      Drop or click to upload
                    </p>
                    <p className="text-[11px] text-[#aeaeb2] mt-0.5">
                      PNG, JPG, GIF
                    </p>
                  </div>
                </div>
              ) : (
                /* Preview state - shows uploaded image with remove button */
                <div className="h-[152px] rounded-[12px] overflow-hidden border border-[#e5e5ea] relative group">
                  <img
                    src={coverPreview}
                    alt="Cover preview"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all" />
                  <button
                    type="button"
                    onClick={() => setCover(null)}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white shadow-md flex items-center justify-center text-[#6e6e73] hover:text-[#fa243c] transition-colors opacity-0 group-hover:opacity-100"
                    aria-label="Remove cover image"
                  >
                    <CloseIcon sx={{ fontSize: 13 }} aria-hidden="true" />
                  </button>
                  <span
                    className="absolute bottom-2 left-2 bg-black/50 text-white text-[10px] font-semibold px-2 py-0.5 rounded-[4px]"
                    aria-label="Cover image uploaded"
                  >
                    Cover set ✓
                  </span>
                </div>
              )}
            </div>

            {/* Audio File upload zone (required) */}
            <div>
              <label className="block text-[11px] font-semibold text-[#aeaeb2] uppercase tracking-[0.6px] mb-2">
                Audio File *
              </label>
              {!audioFile ? (
                /* Empty state - drop zone */
                <div
                  onDrop={(e) => handleDrop(e, "audio")}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver("audio");
                  }}
                  onDragLeave={() => setDragOver(null)}
                  onClick={() => audioInputRef.current?.click()}
                  className={`${zoneBase} ${dragOver === "audio" ? zoneDrag : zoneIdle
                    }`}
                  role="button"
                  tabIndex={0}
                  aria-label="Upload audio file - click or drag and drop"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      audioInputRef.current?.click();
                    }
                  }}
                >
                  <input
                    ref={audioInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={(e) => handleFileChange(e, "audio")}
                    className="hidden"
                    aria-label="Audio file input"
                  />
                  <div className="w-10 h-10 rounded-full bg-white border border-[#e5e5ea] flex items-center justify-center shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                    <AudioFileIcon
                      sx={{ fontSize: 18 }}
                      className="text-[#aeaeb2]"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-[13px] font-medium text-[#1d1d1f]">
                      Drop or click to upload
                    </p>
                    <p className="text-[11px] text-[#aeaeb2] mt-0.5">
                      MP3, WAV, FLAC, AAC
                    </p>
                  </div>
                </div>
              ) : (
                /* Preview state - shows file name and size with remove button */
                <div className="h-[152px] rounded-[12px] border border-[#e5e5ea] bg-[#fafafa] flex flex-col items-center justify-center gap-3 px-5 relative">
                  <div className="w-10 h-10 rounded-full bg-[#fff0f3] border border-[#ffd1d9] flex items-center justify-center">
                    <AudioFileIcon
                      sx={{ fontSize: 18 }}
                      className="text-[#fa243c]"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="text-center min-w-0 w-full">
                    <p
                      className="text-[13px] font-semibold text-[#1d1d1f] truncate px-8"
                      title={audioFile.name}
                    >
                      {audioFile.name}
                    </p>
                    <p className="text-[11px] text-[#aeaeb2] mt-0.5">
                      {formatSize(audioFile.size)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={clearAudio}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white border border-[#e5e5ea] flex items-center justify-center text-[#aeaeb2] hover:text-[#fa243c] hover:border-[#ffd1d9] transition-all shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                    aria-label="Remove audio file"
                  >
                    <CloseIcon sx={{ fontSize: 12 }} aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Submit button section */}
        <div className="px-8 pb-8 pt-0">
          <div className="pt-6 border-t border-[#f5f5f7]">
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-[980px] bg-[#fa243c] text-white text-[15px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-[#fa243c] active:enabled:scale-[0.99]"
              aria-describedby={
                !canSubmit && !loading ? "submit-hint" : undefined
              }
            >
              {loading ? (
                <>
                  <span
                    className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                    aria-hidden="true"
                  />
                  Uploading…
                </>
              ) : (
                <>
                  <CloudUploadIcon sx={{ fontSize: 18 }} aria-hidden="true" />
                  Upload Song
                </>
              )}
            </button>

            {/* Helper text when submit is disabled */}
            {!canSubmit && !loading && (
              <p
                id="submit-hint"
                className="text-center text-[12px] text-[#aeaeb2] mt-3"
                role="status"
                aria-live="polite"
              >
                {!title.trim() || !artist.trim()
                  ? "Fill in title and artist to continue"
                  : "Upload both audio and cover files to continue"}
              </p>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};

export default UploadSongForm;