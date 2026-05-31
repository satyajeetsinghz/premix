/**
 * @fileoverview Modal for creating new playlists with cover image upload and privacy settings.
 *
 * Responsibilities:
 * - Provide form interface for playlist creation (name, description, cover image)
 * - Handle cover image upload to Cloudinary with preview
 * - Support public/private playlist toggle
 * - Create playlist document in Firestore with metadata
 *
 * Related modules:
 * - playlistService (src/features/playlists/services/playlistService.ts) - Contains createPlaylist function
 * - PlaylistList (src/features/playlists/components/PlaylistList.tsx) - Displays created playlists
 * - Sidebar (src/components/layout/Sidebar.tsx) - Contains button to open this modal
 *
 * Architectural role:
 * - **Playlist creation interface** accessible from Sidebar and LibraryPage
 * - Portal-based modal rendered directly under document.body
 *
 * Firestore data model (from HANDOFF_CORE.md):
 * - Collection: /playlists/{playlistId}
 * - Document fields:
 *   - name: string (required)
 *   - userId: string (creator's UID)
 *   - isPublic: boolean
 *   - songCount: number (initial 0)
 *   - createdAt: serverTimestamp
 *   - description?: string (optional)
 *   - coverURL?: string (optional, Cloudinary URL)
 *
 * Security boundary (from Firestore security rules):
 * - Create: isAuthenticated() AND isWriteable() (active users only)
 * - userId must match request.auth.uid
 * - songCount must be 0 on creation
 * - isPublic must be boolean
 *
 * Modal behavior:
 * - Opens as bottom sheet on mobile, centered modal on desktop
 * - Escape key closes modal
 * - Click outside backdrop closes modal
 * - Body scroll locked while open
 *
 * Form validation:
 * - Name required (trimmed, non-empty)
 * - Name max 50 characters
 * - Description max 120 characters (optional)
 * - Cover image optional (uploaded to Cloudinary)
 *
 * Upload flow:
 * 1. User selects image file
 * 2. Object URL created for preview (revoked on unmount)
 * 3. On create: upload to Cloudinary → get secure URL
 * 4. Pass URL to createPlaylist service
 * 5. On success: modal closes, playlist appears in list (real-time)
 *
 * Performance:
 * - useCallback for event handlers (stable references)
 * - Object URL cleanup on unmount prevents memory leaks
 * - useEffect resets form when modal opens
 *
 * @module features/playlists/components
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { createPlaylist } from "../services/playlistService";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { uploadToCloudinary } from "@/features/admin/services/cloudinary.service";
import AddIcon from "@mui/icons-material/Add";
import PublicIcon from "@mui/icons-material/Public";
import LockIcon from "@mui/icons-material/Lock";

// Brand constants (matches HANDOFF_CORE.md)
const P = "#fa243c";
const PH = "#e01e33";

/**
 * Props for the CreatePlaylistModal component.
 *
 * @property open - Whether modal is visible
 * @property onClose - Callback to close modal
 */
interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * CreatePlaylistModal - Modal for creating new playlists.
 *
 * Usage in Sidebar or LibraryPage:
 * ```tsx
 * const [isModalOpen, setIsModalOpen] = useState(false);
 *
 * <CreatePlaylistModal
 *   open={isModalOpen}
 *   onClose={() => setIsModalOpen(false)}
 * />
 * ```
 *
 * Modal features:
 * - Cover image upload (optional)
 * - Playlist name (required, max 50 chars)
 * - Description (optional, max 120 chars)
 * - Public/Private toggle
 *
 * @param props - Component props
 * @returns Portal-rendered modal JSX or null if not open
 */
const CreatePlaylistModal = ({ open, onClose }: Props) => {
  const { user } = useAuth();

  // --- Form state ---
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  // --- UI state ---
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Refs ---
  const backdropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objUrlRef = useRef<string | null>(null);

  /**
   * Effect 1: Reset form when modal opens.
   *
   * Clears all fields, errors, and revokes any existing object URL.
   * Focuses name input after 120ms (allows animation to complete).
   */
  useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    setIsPublic(false);
    setCoverFile(null);
    setCoverPreview(null);
    setError(null);
    if (objUrlRef.current) {
      URL.revokeObjectURL(objUrlRef.current);
      objUrlRef.current = null;
    }
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [open]);

  /**
   * Effect 2: Cleanup object URL on unmount.
   *
   * Prevents memory leaks from hanging blob URLs.
   */
  useEffect(
    () => () => {
      if (objUrlRef.current) URL.revokeObjectURL(objUrlRef.current);
    },
    [],
  );

  /**
   * Effect 3: Escape key handler.
   *
   * Closes modal when Escape key is pressed (not during loading/uploading).
   */
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) handleClose();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, loading]);

  /**
   * Effect 4: Body scroll lock.
   *
   * Prevents background scrolling while modal is open.
   * Restores overflow on close.
   */
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  /**
   * Handles cover image file selection.
   *
   * Creates object URL for preview and revokes previous URL.
   *
   * @param e - File input change event
   */
  const handleCoverChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (objUrlRef.current) URL.revokeObjectURL(objUrlRef.current);
      const url = URL.createObjectURL(file);
      objUrlRef.current = url;
      setCoverFile(file);
      setCoverPreview(url);
      setError(null);
    },
    [],
  );

  /**
   * Handles modal close with state guards.
   *
   * Prevents closing while upload/create is in progress.
   */
  const handleClose = useCallback(() => {
    if (loading || uploading) return;
    onClose();
  }, [loading, uploading, onClose]);

  /**
   * Handles backdrop click to close modal.
   *
   * Only closes if click target is the backdrop overlay (not content).
   *
   * @param e - Mouse event
   */
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === backdropRef.current) handleClose();
    },
    [handleClose],
  );

  /**
   * Creates playlist in Firestore.
   *
   * Flow:
   * 1. Validate name and user
   * 2. Set loading state
   * 3. If cover image selected: upload to Cloudinary
   * 4. Call createPlaylist service with metadata
   * 5. On success: close modal
   * 6. On error: show error message
   * 7. Finally: clear loading states
   */
  const handleCreate = useCallback(async () => {
    const trimmedName = name.trim();
    if (!user || !trimmedName || loading || uploading) return;
    setError(null);
    setLoading(true);
    try {
      let coverURL = "";
      if (coverFile) {
        setUploading(true);
        coverURL = await uploadToCloudinary(coverFile);
        setUploading(false);
      }
      await createPlaylist(
        user.uid,
        trimmedName,
        coverURL,
        description.trim(),
        isPublic,
      );
      onClose();
    } catch (err) {
      console.error("[CreatePlaylistModal]", err);
      setError("Something went wrong. Please try again.");
      setUploading(false);
    } finally {
      setLoading(false);
    }
  }, [
    user,
    name,
    description,
    isPublic,
    coverFile,
    loading,
    uploading,
    onClose,
  ]);

  /**
   * Handles Enter key press in name input.
   * Submits form when Enter pressed.
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") handleCreate();
    },
    [handleCreate],
  );

  if (!open) return null;

  const isValid = name.trim().length > 0;
  const isBusy = loading || uploading;
  const btnLabel = uploading ? "Uploading…" : loading ? "Creating…" : "Create";

  return createPortal(
    <>
      {/* Animation styles */}
      <style>{`
        @keyframes backdropIn { from { opacity: 0; } to { opacity: 1; } }

        @keyframes sheetMobile {
          from { opacity: 0; transform: translateY(100%); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        
        @keyframes sheetDesktop {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }

        .cpm-sheet-mobile  { animation: sheetMobile  0.28s cubic-bezier(0.32,0.72,0,1); }
        .cpm-sheet-desktop { animation: sheetDesktop 0.24s cubic-bezier(0.34,1.3,0.64,1); }

        .cpm-underline {
          width: 100%;
          background: transparent;
          border: none;
          border-bottom: 1.5px solid #d1d1d6;
          padding: 6px 0;
          font-size: 14px;
          color: #1c1c1e;
          outline: none;
          transition: border-color 0.15s;
        }
        .cpm-underline:focus       { border-bottom-color: ${P}; }
        .cpm-underline::placeholder { color: #aeaeb2; }
      `}</style>

      {/* Backdrop overlay */}
      <div
        ref={backdropRef}
        onClick={handleBackdropClick}
        className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:p-4"
        style={{
          background: "rgba(0,0,0,0.48)",
          animation: "backdropIn 0.18s ease",
        }}
      >
        {/* Modal content */}
        <div
          className={`
            relative w-full bg-white overflow-hidden
            rounded-t-2xl sm:rounded-2xl
            cpm-sheet-mobile sm:cpm-sheet-desktop
          `}
          style={{
            maxWidth: 560,
            maxHeight: "88vh",
            display: "flex",
            flexDirection: "column",
            boxShadow:
              "0 -4px 32px rgba(0,0,0,0.14), 0 28px 64px rgba(0,0,0,0.18)",
          }}
        >
          {/* Drag indicator (mobile only) */}
          <div className="flex justify-center pt-2.5 pb-1 sm:hidden flex-shrink-0">
            <div className="w-9 h-1 rounded-full bg-black/15" />
          </div>

          {/* Modal header */}
          <div className="px-5 sm:px-6 pt-3 sm:pt-5 pb-3 sm:pb-4 border-b border-[#f2f2f7] flex-shrink-0">
            <h2 className="text-[17px] sm:text-[19px] font-bold text-[#1d1d1f] tracking-tight">
              New Playlist
            </h2>
          </div>

          {/* Scrollable form content */}
          <div className="overflow-y-auto flex-1">
            <div className="px-5 sm:px-6 py-4 sm:py-5 flex flex-col sm:flex-row gap-4 sm:gap-6">
              {/* Cover image section */}
              <div className="flex flex-row sm:flex-col gap-4 sm:gap-0 items-start">
                <div className="flex-shrink-0">
                  <label
                    htmlFor="cpm-cover"
                    className="block cursor-pointer"
                    aria-label="Upload cover image"
                  >
                    <div
                      className="rounded-xl overflow-hidden flex items-center justify-center transition-all duration-200 hover:opacity-90"
                      style={{
                        width: "clamp(88px, 22vw, 140px)",
                        height: "clamp(88px, 22vw, 140px)",
                        background: coverPreview ? "transparent" : "#f5f5f7",
                        border: `2px ${coverPreview ? "solid" : "dashed"} ${P}`,
                        boxShadow: coverPreview
                          ? "0 4px 12px rgba(0,0,0,0.12)"
                          : "none",
                      }}
                    >
                      {coverPreview ? (
                        <img
                          src={coverPreview}
                          alt="Cover preview"
                          className="w-full h-full object-cover"
                          draggable={false}
                        />
                      ) : (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ background: P }}
                        >
                          <AddIcon
                            sx={{ fontSize: 20 }}
                            className="text-white"
                          />
                        </div>
                      )}
                    </div>
                    <input
                      id="cpm-cover"
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleCoverChange}
                      className="hidden"
                      disabled={isBusy}
                    />
                  </label>

                  {/* Upload progress indicator */}
                  {uploading && (
                    <div className="mt-2 h-[3px] rounded-full bg-[#e5e5ea] overflow-hidden">
                      <div
                        className="h-full rounded-full animate-pulse"
                        style={{ background: P, width: "60%" }}
                      />
                    </div>
                  )}

                  {/* Remove cover button */}
                  {coverPreview && !uploading && (
                    <button
                      onClick={() => {
                        setCoverFile(null);
                        setCoverPreview(null);
                      }}
                      className="mt-1.5 w-full text-center text-[11px] font-medium transition-colors"
                      style={{ color: P }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = PH)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = P)}
                      disabled={isBusy}
                    >
                      Remove
                    </button>
                  )}
                </div>

                {/* Mobile: Name + Description (compact layout) */}
                <div className="flex-1 flex flex-col gap-4 sm:hidden min-w-0">
                  <div>
                    <input
                      ref={inputRef}
                      type="text"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setError(null);
                      }}
                      onKeyDown={handleKeyDown}
                      placeholder="Playlist Title"
                      maxLength={50}
                      disabled={isBusy}
                      className="cpm-underline disabled:opacity-50"
                      style={{ caretColor: P }}
                      aria-label="Playlist Title"
                    />
                    <div className="flex justify-end mt-1">
                      <span
                        className="text-[10px]"
                        style={{
                          color: name.length > 42 ? "#ff9f0a" : "#aeaeb2",
                        }}
                      >
                        {name.length}/50
                      </span>
                    </div>
                  </div>

                  <div className="hidden xs:block">
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Description (Optional)"
                      maxLength={120}
                      disabled={isBusy}
                      className="cpm-underline disabled:opacity-50"
                      style={{ caretColor: P }}
                      aria-label="Description"
                    />
                  </div>
                </div>
              </div>

              {/* Desktop: Name + Description (full width) */}
              <div className="hidden sm:flex flex-col gap-5 flex-1">
                <div>
                  <input
                    ref={inputRef}
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setError(null);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Playlist Title"
                    maxLength={50}
                    disabled={isBusy}
                    className="cpm-underline disabled:opacity-50"
                    style={{ caretColor: P }}
                    aria-label="Playlist Title"
                  />
                  <div className="flex justify-end mt-1">
                    <span
                      className="text-[11px]"
                      style={{
                        color: name.length > 42 ? "#ff9f0a" : "#aeaeb2",
                      }}
                    >
                      {name.length}/50
                    </span>
                  </div>
                </div>
                <div>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Description (Optional)"
                    maxLength={120}
                    disabled={isBusy}
                    className="cpm-underline disabled:opacity-50"
                    style={{ caretColor: P }}
                    aria-label="Description"
                  />
                  <div className="flex justify-end mt-1">
                    <span className="text-[11px] text-[#aeaeb2]">
                      {description.length}/120
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile-only description field (shown below cover on extra small screens) */}
            <div className="px-5 sm:hidden pb-2">
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (Optional)"
                maxLength={120}
                disabled={isBusy}
                className="cpm-underline disabled:opacity-50 xs:hidden"
                style={{ caretColor: P }}
                aria-label="Description"
              />
            </div>

            {/* Public/Private toggle */}
            <div className="px-5 sm:px-6 pb-4">
              <div
                className="flex items-center gap-3 cursor-pointer select-none"
                onClick={() => !isBusy && setIsPublic((v) => !v)}
              >
                {/* Custom checkbox */}
                <div
                  className="w-[18px] h-[18px] sm:w-5 sm:h-5 rounded flex items-center justify-center flex-shrink-0 transition-all duration-150 border"
                  style={{
                    background: isPublic ? P : "transparent",
                    borderColor: isPublic ? P : "#c7c7cc",
                    borderWidth: "1.5px",
                  }}
                >
                  {isPublic && (
                    <svg width="10" height="8" viewBox="0 0 11 9" fill="none">
                      <path
                        d="M1 4L4 7L10 1"
                        stroke="white"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {isPublic ? (
                    <PublicIcon
                      sx={{ fontSize: 14 }}
                      className="text-[#6e6e73]"
                    />
                  ) : (
                    <LockIcon
                      sx={{ fontSize: 14 }}
                      className="text-[#aeaeb2]"
                    />
                  )}
                  <span
                    className="text-[12px] sm:text-[13px]"
                    style={{ color: isPublic ? "#1c1c1e" : "#6e6e73" }}
                  >
                    {isPublic ? "Public playlist" : "Private playlist"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <p
              className="px-5 sm:px-6 py-1.5 text-[12px] text-center flex-shrink-0"
              style={{ color: P }}
            >
              {error}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex gap-2.5 sm:gap-3 px-5 sm:px-6 py-3 sm:py-4 border-t border-[#f2f2f7] flex-shrink-0">
            <button
              onClick={handleCreate}
              disabled={!isValid || isBusy}
              className="flex-1 py-2 sm:py-2.5 rounded-full sm:rounded-md text-[14px] font-semibold text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-40"
              style={{ background: P }}
              onMouseEnter={(e) => {
                if (isValid && !isBusy) e.currentTarget.style.background = PH;
              }}
              onMouseLeave={(e) => (e.currentTarget.style.background = P)}
            >
              {isBusy && (
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              )}
              {btnLabel}
            </button>

            <button
              onClick={handleClose}
              disabled={isBusy}
              className="flex-1 py-2 sm:py-2.5 rounded-full sm:rounded-md text-[14px] font-semibold transition-colors disabled:opacity-40"
              style={{ background: "#f5f5f7", color: "#3c3c43" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#e5e5ea")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "#f5f5f7")
              }
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
};

export default CreatePlaylistModal;