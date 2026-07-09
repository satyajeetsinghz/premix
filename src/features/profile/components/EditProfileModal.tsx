/**
 * @fileoverview Modal for editing user profile (name and avatar image).
 *
 * Responsibilities:
 * - Provide form interface for updating display name and profile photo
 * - Handle image file selection with preview and cleanup
 * - Upload new profile image to Cloudinary
 * - Call parent onSave callback to update Firestore
 * - Handle loading states and error messages
 *
 * Related modules:
 * - cloudinaryService (src/features/profile/services/cloudinaryService.ts) - Contains uploadProfileImage
 * - ProfilePage (src/features/profile/ProfilePage.tsx) - Opens this modal and implements onSave
 * - useProfile (src/features/profile/hooks/useProfile.ts) - Provides profile data
 *
 * Architectural role:
 * - **User profile editing interface** accessible from ProfilePage
 * - Portal-based modal rendered directly under document.body
 * - Supports both avatar upload and name editing in a single modal
 *
 * Security boundary (from Firestore security rules):
 * - Update: isOwner(uid) AND isWriteable() AND onlyChanges(['name', 'email', 'photoURL'])
 * - Uploaded images stored in Cloudinary (unsigned preset)
 *
 * Image upload flow:
 * 1. User selects image file
 * 2. Object URL created for preview (revoked on unmount)
 * 3. On save: upload to Cloudinary via uploadProfileImage
 * 4. Get secure URL and pass to onSave callback
 * 5. Firestore user document updated with new photoURL
 *
 * Form validation:
 * - Name required (trimmed, non-empty)
 * - Name max 50 characters (enforced by input maxLength)
 * - Image optional (can keep existing or remove - removal not supported)
 *
 * Modal behavior:
 * - Escape key closes modal (unless loading)
 * - Click outside backdrop closes modal (unless loading)
 * - Body scroll locked while modal open
 * - Smooth entrance animation (sheetUp)
 *
 * DESIGN (this pass) — Apple Music Web dark/glassy, matching the same
 * frosted-glass recipe used across ProfilePage/PlaylistPage/SIDEBAR_MENU:
 * background rgba(31,31,31,.55-.68) + backdrop-filter blur/saturate/
 * brightness, 1px hairline borders (rgba(255,255,255,.06-.12)), text
 * #f5f5f7 / rgba(235,235,245,.6), accent #fc3c44 → hover #ff6961. All
 * state/handlers/effects are unchanged from the original — only markup
 * and styling were replaced.
 *
 * @module features/profile/components
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { uploadProfileImage } from "../services/cloudinaryService";
import { CameraAltRounded, CloseRounded } from "@mui/icons-material";

// Brand constants — matches P/PH used across ProfilePage & PlaylistPage
const P = "#fc3c44";
const PH = "#ff6961";
const TXT_PRIMARY = "#f5f5f7";
const TXT_SECONDARY = "rgba(235,235,245,0.60)";
const TXT_TERTIARY = "rgba(235,235,245,0.40)";
const HAIRLINE = "rgba(255,255,255,0.09)";

/**
 * Props for the EditProfileModal component.
 *
 * @property profile - Current user profile data (from useProfile hook)
 * @property onClose - Callback to close modal
 * @property onSave - Callback to save profile changes to Firestore
 */
interface Props {
  profile: any;
  onClose: () => void;
  onSave: (data: { displayName: string; photoURL?: string }) => Promise<void>;
}

/**
 * EditProfileModal - Modal for editing user name and avatar.
 *
 * Usage in ProfilePage:
 * ```tsx
 * const [isModalOpen, setIsModalOpen] = useState(false);
 *
 * <EditProfileModal
 *   profile={profile}
 *   onClose={() => setIsModalOpen(false)}
 *   onSave={handleProfileUpdate}
 * />
 * ```
 *
 * @param props - Component props
 * @returns Portal-rendered modal JSX
 */
const EditProfileModal = ({ profile, onClose, onSave }: Props) => {
  // --- Form state ---
  const [name, setName] = useState<string>(profile?.name ?? "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    profile?.photoURL ?? null,
  );

  // --- UI state ---
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Refs ---
  const backdropRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objUrlRef = useRef<string | null>(null);

  /**
   * Effect 1: Body scroll lock + object URL cleanup.
   *
   * Prevents background scrolling while modal is open.
   * Cleans up object URL on unmount to prevent memory leaks.
   */
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      if (objUrlRef.current) URL.revokeObjectURL(objUrlRef.current);
    };
  }, []);

  /**
   * Effect 2: Escape key handler.
   *
   * Closes modal when Escape key is pressed (not during loading).
   */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose, loading]);

  /**
   * Handles backdrop click to close modal.
   * Only closes if clicking directly on backdrop (not content) and not loading.
   */
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === backdropRef.current && !loading) onClose();
    },
    [onClose, loading],
  );

  /**
   * Handles image file selection.
   *
   * Steps:
   * 1. Get selected file from input
   * 2. Revoke previous object URL if exists
   * 3. Create new object URL for preview
   * 4. Store file and preview URL in state
   * 5. Clear any previous error
   *
   * @param e - File input change event
   */
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] ?? null;
      if (!file) return;

      if (objUrlRef.current) URL.revokeObjectURL(objUrlRef.current);
      const url = URL.createObjectURL(file);
      objUrlRef.current = url;
      setImageFile(file);
      setImagePreview(url);
      setError(null);
    },
    [],
  );

  /**
   * Handles form submission - saves profile changes.
   *
   * Steps:
   * 1. Validate name (non-empty)
   * 2. Set loading state
   * 3. If new image selected: upload to Cloudinary
   * 4. Call onSave callback with new name and photoURL
   * 5. On success: close modal
   * 6. On error: show error message
   * 7. Finally: clear loading states
   */
  const handleSubmit = useCallback(async () => {
    if (!name.trim() || loading) return;
    setError(null);
    setLoading(true);

    try {
      let photoURL = profile?.photoURL as string | undefined;

      if (imageFile) {
        setUploading(true);
        photoURL = await uploadProfileImage(imageFile);
        setUploading(false);
      }

      await onSave({ displayName: name.trim(), photoURL });
      onClose();
    } catch (err) {
      console.error("[EditProfileModal]", err);
      setError("Something went wrong. Please try again.");
      setUploading(false);
    } finally {
      setLoading(false);
    }
  }, [name, loading, imageFile, profile?.photoURL, onSave, onClose]);

  /**
   * Handles Enter key press in name input.
   * Submits form when Enter pressed.
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") handleSubmit();
    },
    [handleSubmit],
  );

  /**
   * Generates avatar initials from profile name.
   * Takes first two letters of first two words, uppercase.
   * Example: "John Doe" → "JD"
   */
  const initials = (profile?.name || "U")
    .split(" ")
    .map((w: string) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const isValid = name.trim().length > 0;

  return createPortal(
    <>
      {/* Animation + input styles */}
      <style>{`
        @keyframes sheetUp {
          from { opacity: 0; transform: translateY(20px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        .ep-input {
          width: 100%;
          background: rgba(255,255,255,0.06);
          border: 1px solid ${HAIRLINE};
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 14px;
          color: ${TXT_PRIMARY};
          outline: none;
          transition: border-color 0.15s, background 0.15s;
        }
        .ep-input:focus { border-color: ${P}; background: rgba(255,255,255,0.08); }
        .ep-input::placeholder { color: ${TXT_TERTIARY}; }
        .ep-input:disabled { opacity: 0.5; }
        .ep-input[readonly] { color: ${TXT_TERTIARY}; cursor: default; }
      `}</style>

      {/* Backdrop overlay */}
      <div
        ref={backdropRef}
        onClick={handleBackdropClick}
        className="fixed inset-0 z-[9999] flex items-center justify-center p-8 sm:p-4"
        style={{ background: "rgba(0,0,0,0.55)" }}
      >
        {/* Modal container — frosted glass, same recipe as SIDEBAR_MENU/PlaylistPage dialogs */}
        <div
          className="relative w-full max-w-[420px] rounded-[20px] overflow-hidden mx-auto"
          style={{
            background: "rgba(31, 31, 31, 0.68)",
            backdropFilter: "blur(38px) saturate(190%) brightness(1.05) contrast(1.05)",
            WebkitBackdropFilter: "blur(38px) saturate(190%) brightness(1.05) contrast(1.05)",
            border: "1px solid rgba(255,255,255,0.10)",
            boxShadow: `
              0 24px 60px rgba(0,0,0,.48),
              0 10px 24px rgba(0,0,0,.28),
              0 2px 6px rgba(0,0,0,.18),
              inset 0 1px 0 rgba(255,255,255,.10),
              inset 0 -1px 0 rgba(0,0,0,.25)
            `,
            animation: "sheetUp 0.28s cubic-bezier(0.34,1.3,0.64,1)",
            maxHeight: "calc(100vh - 32px)",
            overflowY: "auto",
          }}
        >
          {/* Drag indicator (mobile only) */}
          <div className="flex justify-center pt-2.5 pb-0 sm:hidden">
            <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.18)" }} />
          </div>

          {/* Header */}
          <div className="px-5 pt-5 pb-0 flex items-center justify-between">
            <h2
              className="font-semibold text-[20px]"
              style={{ color: TXT_PRIMARY, letterSpacing: "-0.4px" }}
            >
              Edit profile
            </h2>
            <button
              onClick={onClose}
              disabled={loading}
              aria-label="Close"
              className="flex items-center justify-center w-7 h-7 rounded-full transition-colors disabled:opacity-40"
              style={{ background: "rgba(255,255,255,0.08)", color: TXT_SECONDARY }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.14)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
            >
              <CloseRounded sx={{ fontSize: 16 }} />
            </button>
          </div>

          {/* Form content */}
          <div className="px-5 pt-5 pb-1 flex flex-col sm:flex-row items-start gap-5">
            {/* Avatar */}
            <div className="relative self-center sm:self-start flex-shrink-0">
              <div
                className="w-20 h-20 sm:w-[88px] sm:h-[88px] rounded-full overflow-hidden flex items-center justify-center"
                style={{
                  background: imagePreview
                    ? "transparent"
                    : "linear-gradient(135deg, #3a3a3c, #1c1c1e)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
                }}
              >
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <span
                    className="font-semibold select-none text-2xl"
                    style={{ color: TXT_PRIMARY }}
                  >
                    {initials}
                  </span>
                )}
              </div>

              <label
                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-colors"
                style={{
                  background: P,
                  border: "2px solid rgba(31,31,31,0.9)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = PH)}
                onMouseLeave={(e) => (e.currentTarget.style.background = P)}
                aria-label="Change photo"
              >
                <CameraAltRounded sx={{ fontSize: 14 }} style={{ color: "#fff" }} />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              {uploading && (
                <div
                  className="absolute inset-0 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(0,0,0,0.45)" }}
                >
                  <span
                    className="w-5 h-5 rounded-full border-2 animate-spin"
                    style={{ borderColor: "rgba(255,255,255,0.25)", borderTopColor: "#fff" }}
                  />
                </div>
              )}
            </div>

            {/* Fields */}
            <div className="flex-1 w-full space-y-3">
              <div>
                <p
                  className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide"
                  style={{ color: TXT_SECONDARY }}
                >
                  Name
                </p>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError(null);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Your name"
                  maxLength={50}
                  disabled={loading}
                  className="ep-input"
                  style={{ caretColor: P }}
                  autoFocus
                />
              </div>

              {profile?.email && (
                <div>
                  <p
                    className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide"
                    style={{ color: TXT_SECONDARY }}
                  >
                    Username
                  </p>
                  <input
                    type="text"
                    value={
                      profile?.username
                        ? `@${profile.username}`
                        : `@${profile.email.split("@")[0]}`
                    }
                    readOnly
                    className="ep-input"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Helper text */}
          <p
            className="px-5 pt-3 text-[12px] leading-[1.5]"
            style={{ color: TXT_TERTIARY }}
          >
            Your photo, name, and username will be visible to others.
          </p>

          {/* Error message */}
          {error && (
            <p className="px-5 pt-2 text-[12px] text-center" style={{ color: P }}>
              {error}
            </p>
          )}

          <div className="mx-5 my-4" style={{ height: 0.5, background: HAIRLINE }} />

          {/* Actions */}
          <div className="px-5 pb-6 flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={!isValid || loading}
              className="flex-1 py-2.5 rounded-full text-[14px] font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-40"
              style={{ background: P, color: "#ffffff" }}
              onMouseEnter={(e) => {
                if (!loading && isValid) e.currentTarget.style.background = PH;
              }}
              onMouseLeave={(e) => (e.currentTarget.style.background = P)}
            >
              {loading ? (
                <>
                  <span
                    className="w-4 h-4 rounded-full border-2 animate-spin"
                    style={{ borderColor: "rgba(255,255,255,0.4)", borderTopColor: "#fff" }}
                  />
                  Saving
                </>
              ) : (
                "Save"
              )}
            </button>

            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2.5 rounded-full text-[14px] font-semibold transition-colors disabled:opacity-40"
              style={{ background: "rgba(255,255,255,0.08)", color: TXT_PRIMARY }}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.background = "rgba(255,255,255,0.14)";
              }}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
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

export default EditProfileModal;