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
 * Performance:
 * - Object URL cleanup on unmount prevents memory leaks
 * - useCallback for event handlers (stable references)
 * - File input ref for programmatic reset
 *
 * @module features/profile/components
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { uploadProfileImage } from "../services/cloudinaryService";
import { CameraAltRounded } from "@mui/icons-material";

// Brand primary color constant (matches HANDOFF_CORE.md)
const P = "#fa243c";

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
      {/* Animation styles */}
      <style>{`
        @keyframes sheetUp {
          from { opacity: 0; transform: translateY(20px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        .ep-input {
          width: 100%;
          background: #fff;
          border: 1px solid #d1d1d6;
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 14px;
          color: #1c1c1e;
          outline: none;
          transition: border-color 0.15s;
        }
        .ep-input:focus { border-color: ${P}; }
        .ep-input::placeholder { color: #aeaeb2; }
      `}</style>

      {/* Backdrop overlay with blur */}
      <div
        ref={backdropRef}
        onClick={handleBackdropClick}
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        style={{
          background: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        {/* Modal container */}
        <div
          className="relative w-full max-w-[420px] rounded-[20px] overflow-hidden mx-auto"
          style={{
            background: "#f2f2f7",
            boxShadow:
              "0 24px 64px rgba(0,0,0,0.28), 0 4px 16px rgba(0,0,0,0.12)",
            animation: "sheetUp 0.28s cubic-bezier(0.34,1.3,0.64,1)",
            maxHeight: "calc(100vh - 32px)",
            overflowY: "auto",
          }}
        >
          {/* Drag indicator (mobile only) */}
          <div className="flex justify-center pt-2.5 pb-0 sm:hidden">
            <div className="w-10 h-1 rounded-full bg-black/15" />
          </div>

          {/* Modal header */}
          <div className="px-5 pt-5 pb-0">
            <h2
              className="font-semibold text-[20px] text-[#1c1c1e]"
              style={{ letterSpacing: "-0.4px" }}
            >
              Edit Profile
            </h2>
          </div>

          {/* Form content - two column layout on desktop, stacked on mobile */}
          <div className="px-5 pt-4 pb-1 flex flex-col sm:flex-row items-start gap-5">
            {/* Avatar section */}
            <div className="relative self-center sm:self-start flex-shrink-0">
              <div
                className="w-20 h-20 sm:w-[88px] sm:h-[88px] rounded-full overflow-hidden flex items-center justify-center"
                style={{
                  background: imagePreview ? "transparent" : "#c7c7cc",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
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
                  <span className="font-semibold select-none text-2xl text-[#3a3a3c]">
                    {initials}
                  </span>
                )}
              </div>

              {/* Camera button for image upload */}
              <label
                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer"
                style={{
                  background: "rgba(60,60,67,0.55)",
                  backdropFilter: "blur(4px)",
                }}
                aria-label="Change photo"
              >
                <CameraAltRounded
                  sx={{ fontSize: 15 }}
                  style={{ color: "#fff" }}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              {/* Upload overlay spinner */}
              {uploading && (
                <div className="absolute inset-0 rounded-full flex items-center justify-center bg-black/30">
                  <span className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                </div>
              )}
            </div>

            {/* Form fields section */}
            <div className="flex-1 w-full space-y-3">
              <div>
                <p className="mb-1.5 text-[12px] font-semibold text-[#3a3a3c] uppercase tracking-wide">
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
                  className="ep-input disabled:opacity-50"
                  style={{ caretColor: P }}
                  autoFocus
                />
              </div>

              {/* Username field (read-only, derived from email) */}
              {profile?.email && (
                <div>
                  <p className="mb-1.5 text-[12px] font-semibold text-[#3a3a3c] uppercase tracking-wide">
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
                    style={{ color: "#8e8e93", cursor: "default" }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Helper text */}
          <p className="px-5 pt-2 text-[12px] text-[#8e8e93] leading-[1.5]">
            Your photo, name and username will be visible to others.
          </p>

          {/* Error message */}
          {error && (
            <p
              className="px-5 pt-2 text-[12px] text-center"
              style={{ color: P }}
            >
              {error}
            </p>
          )}

          <div className="mx-5 my-4 h-px bg-[#c6c6c8]" />

          {/* Action buttons */}
          <div className="px-5 pb-6 flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={!isValid || loading}
              className="flex-1 py-2 rounded-full text-[14px] font-semibold flex items-center justify-center gap-2 transition-opacity disabled:opacity-40 text-white"
              style={{ background: P }}
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  Saving
                </>
              ) : (
                "Save"
              )}
            </button>

            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2 rounded-full text-[14px] font-semibold transition-opacity disabled:opacity-40"
              style={{ background: "#e5e5ea", color: "#3a3a3c" }}
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