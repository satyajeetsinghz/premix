/**
 * @fileoverview Modal form for creating and editing hero banners.
 *
 * Responsibilities:
 * - Provide form interface for banner configuration (title, subtitle, media, redirect)
 * - Handle image and video uploads to Cloudinary with preview
 * - Manage date range scheduling (start/end dates)
 * - Support redirect to songs, artists, or sections
 * - Create new banner or update existing in Firestore
 *
 * Related modules:
 * - BannerManager (src/features/banner/components/BannerManager.tsx) - Opens this modal
 * - cloudinary.service (src/features/admin/services/cloudinary.service.ts) - File uploads
 * - useSongs (src/features/songs/hooks/useSongs.ts) - Fetches songs for redirect dropdown
 * - media (src/features/banner/utils/media.ts) - Shared video/image detection helpers
 *
 * Architectural role:
 * - **Create/Edit modal** for banner management (admin only)
 * - Portal-rendered overlay with form validation
 * - Handles both creation and update operations (shared component)
 *
 * Media types:
 * - Image: Static banner background (fallback for all devices)
 * - Video: Animated banner background (modern browsers, graceful degradation)
 *
 * Redirect types:
 * - song: Navigate to song player (redirectId = song document ID)
 * - artist: Navigate to artist page (redirectId = artist ID)
 * - section: Navigate to home page section (redirectId = section ID)
 *
 * Scheduling logic:
 * - startDate: Banner becomes active after this date/time
 * - endDate: Banner expires after this date/time
 * - Empty dates: Banner always active (if isActive = true)
 * - Validation: endDate must be after startDate
 *
 * Date handling:
 * - Firestore stores Timestamp objects
 * - Form uses datetime-local input (YYYY-MM-DDThh:mm)
 * - Helper functions convert between formats
 *
 * Field cleanup:
 * - When editing, missing startDate/endDate triggers deleteField()
 * - Prevents stale date fields from persisting in Firestore
 *
 * mediaType integrity (bugfix):
 * - Previously, clicking the "Image" tab unconditionally set form.mediaType
 *   to "image", even when a video had already been uploaded — this silently
 *   corrupted video banners into { mediaType: "image", mediaUrl: <mp4> }.
 * - Fixed by decoupling `activeMediaTab` (purely a UI panel toggle) from
 *   `form.mediaType` (only ever set by a successful upload).
 * - `resolveMediaType()` is applied on initial load (self-heals existing
 *   corrupted documents when reopened for edit) and again in handleSubmit
 *   as a final defensive guard before writing to Firestore.
 *
 * @module features/banner/components
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  addDoc,
  updateDoc,
  deleteField,
  collection,
  doc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/services/firebase/config";
import CloseIcon from "@mui/icons-material/Close";
import ImageIcon from "@mui/icons-material/Image";
import VideoLibraryIcon from "@mui/icons-material/VideoLibrary";
import TitleIcon from "@mui/icons-material/Title";
import SubtitlesIcon from "@mui/icons-material/Subtitles";
import SortIcon from "@mui/icons-material/Sort";
import LinkIcon from "@mui/icons-material/Link";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import { uploadToCloudinary } from "@/features/admin/services/cloudinary.service";
import { useSongs } from "@/features/songs/hooks/useSongs";
import { resolveMediaType } from "../utils/media";
import { IBanner } from "../types";

/**
 * Supported redirect destination types.
 *
 * - song: Navigate to song player page
 * - playlist: Navigate to playlist page (reserved for future use)
 * - artist: Navigate to artist profile page
 * - section: Navigate to home page section
 */
type RedirectType = "song" | "playlist" | "artist" | "section";

/**
 * Props for the BannerFormModal component.
 *
 * @property banner - Existing banner for edit mode (null for create mode)
 * @property onClose - Callback to close modal (after save or cancel)
 */
interface Props {
  banner?: IBanner | null;
  onClose: () => void;
}

/**
 * Converts Firestore Timestamp to datetime-local input string format.
 *
 * Format: "YYYY-MM-DDThh:mm" (e.g., "2024-01-15T14:30")
 *
 * Handles multiple input types:
 * - Firestore Timestamp with .toDate() method
 * - JavaScript Date object
 * - String date
 * - Null/undefined values
 *
 * @param value - Timestamp, Date, string, or null/undefined
 * @returns Formatted string for datetime-local input, or empty string if invalid
 */
const toLocalInput = (value: any): string => {
  if (!value) return "";
  try {
    const date =
      typeof value?.toDate === "function"
        ? value.toDate()
        : value instanceof Date
          ? value
          : new Date(value);
    if (isNaN(date.getTime())) return "";
    const p = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
  } catch {
    return "";
  }
};

/**
 * Converts datetime-local input string to Firestore Timestamp.
 *
 * @param value - Datetime string from input (YYYY-MM-DDThh:mm)
 * @returns Firestore Timestamp or null if invalid/empty
 */
const toTimestamp = (value: string): Timestamp | null => {
  if (!value.trim()) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : Timestamp.fromDate(d);
};

/**
 * BannerFormModal - Modal for creating/editing homepage banners.
 *
 * Usage:
 * ```tsx
 * // Create mode
 * <BannerFormModal onClose={() => setModalOpen(false)} />
 *
 * // Edit mode
 * <BannerFormModal banner={selectedBanner} onClose={() => setModalOpen(false)} />
 * ```
 *
 * Form fields:
 * - Media type toggle (Image/Video) — UI panel switch only, does NOT
 *   directly set form.mediaType (see mediaType integrity note above)
 * - Media upload (image required, video optional)
 * - Title (required)
 * - Subtitle (optional)
 * - Button text (optional, default "Listen Now")
 * - Redirect type (song/artist/section)
 * - Redirect ID (required based on type)
 * - Display order (1-indexed integer)
 * - Start date (optional, schedule activation)
 * - End date (optional, schedule expiration)
 *
 * Validation:
 * - Title required
 * - Image URL required (must upload image before save)
 * - Redirect ID required (song, artist ID, or section ID)
 * - End date must be after start date (if both provided)
 * - Image/video file MIME type is validated before upload
 *
 * File upload constraints:
 * - Image: Max 5MB, JPG/PNG/WebP, 1200x400px recommended
 * - Video: Max 50MB, MP4/WebM, 1200x400px recommended
 *
 * @param props - BannerFormModalProps
 * @returns Modal JSX (portal not used, rendered inline)
 */
const BannerFormModal = ({ banner, onClose }: Props) => {
  const { songs } = useSongs();

  // --- Form state ---
  const [form, setForm] = useState({
    title: banner?.title ?? "",
    subtitle: banner?.subtitle ?? "",
    eyebrow: banner?.eyebrow ?? "",
    caption: banner?.caption ?? "",
    imageUrl: banner?.imageUrl ?? "",
    mediaUrl: banner?.mediaUrl ?? "",
    buttonText: banner?.buttonText ?? "Listen Now",
    redirectType: banner?.redirectType ?? "song",
    redirectId: banner?.redirectId ?? "",
    order: banner?.order ?? 1,
    // Self-heals corrupted documents: if this banner was previously saved
    // with mediaType "image" alongside an actual video mediaUrl (the bug),
    // the edit form now opens already showing it correctly as a video.
    mediaType: resolveMediaType(banner?.mediaType, banner?.mediaUrl),
    startDate: toLocalInput(banner?.startDate),
    endDate: toLocalInput(banner?.endDate),
  });

  // --- UI state ---
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState({ image: false, video: false });
  const [imagePreview, setImagePreview] = useState(banner?.imageUrl ?? "");
  const [videoPreview, setVideoPreview] = useState(banner?.mediaUrl ?? "");
  // Purely a UI panel toggle — which upload section is visible. Does NOT
  // drive form.mediaType directly; that's only ever set by a successful
  // upload in handleImageUpload / handleVideoUpload.
  const [activeMediaTab, setActiveMediaTab] = useState<"image" | "video">(
    resolveMediaType(banner?.mediaType, banner?.mediaUrl),
  );
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [videoUploadError, setVideoUploadError] = useState<string | null>(null);

  // --- Refs for object URL cleanup ---
  const imageObjUrl = useRef<string | null>(null);
  const videoObjUrl = useRef<string | null>(null);

  /**
   * Cleanup object URLs on unmount to prevent memory leaks.
   */
  useEffect(() => {
    return () => {
      if (imageObjUrl.current) URL.revokeObjectURL(imageObjUrl.current);
      if (videoObjUrl.current) URL.revokeObjectURL(videoObjUrl.current);
    };
  }, []);

  /**
   * Handles image file upload to Cloudinary.
   *
   * Steps:
   * 1. Validate file selection + MIME type (must be image/*)
   * 2. Create object URL for preview (revoke old if exists)
   * 3. Set uploading state
   * 4. Upload to Cloudinary
   * 5. Update form.imageUrl with response URL
   * 6. Handle errors with user-friendly message
   *
   * Deliberately does NOT set form.mediaType — imageUrl is always the
   * poster/fallback image, never the field that determines video vs image.
   *
   * @param e - File input change event
   */
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploadError(null);
    if (!file.type.startsWith("image/")) {
      setImageUploadError("Please select a valid image file");
      return;
    }
    if (imageObjUrl.current) URL.revokeObjectURL(imageObjUrl.current);
    const objUrl = URL.createObjectURL(file);
    imageObjUrl.current = objUrl;
    setImagePreview(objUrl);
    setUploading((p) => ({ ...p, image: true }));
    try {
      const url = await uploadToCloudinary(file);
      setForm((p) => ({ ...p, imageUrl: url }));
    } catch (error) {
      console.error("Image upload error:", error);
      setImageUploadError("Failed to upload image. Please try again.");
      setImagePreview(form.imageUrl);
    } finally {
      setUploading((p) => ({ ...p, image: false }));
    }
  };

  /**
   * Handles video file upload to Cloudinary.
   *
   * Additional validation:
   * - File type must start with "video/"
   * - File size must be ≤ 50MB
   *
   * On success, sets both mediaUrl AND mediaType: "video" together —
   * this is the only place mediaType should ever become "video".
   *
   * @param e - File input change event
   */
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoUploadError(null);
    if (!file.type.startsWith("video/")) {
      setVideoUploadError("Please select a valid video file");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setVideoUploadError("Video size should be less than 50MB");
      return;
    }
    if (videoObjUrl.current) URL.revokeObjectURL(videoObjUrl.current);
    const objUrl = URL.createObjectURL(file);
    videoObjUrl.current = objUrl;
    setVideoPreview(objUrl);
    setUploading((p) => ({ ...p, video: true }));
    try {
      const url = await uploadToCloudinary(file);
      setForm((p) => ({ ...p, mediaUrl: url, mediaType: "video" }));
    } catch (error) {
      console.error("Video upload error:", error);
      setVideoUploadError("Failed to upload video. Please try again.");
      setVideoPreview(form.mediaUrl);
    } finally {
      setUploading((p) => ({ ...p, video: false }));
    }
  };

  /**
   * Handles start date change with end date validation.
   *
   * If end date exists and is <= new start date, clear end date.
   * Prevents invalid date ranges where end is before or equal to start.
   *
   * @param value - New start date string
   */
  const handleStartDateChange = (value: string) => {
    setForm((p) => ({
      ...p,
      startDate: value,
      endDate: p.endDate && value && p.endDate <= value ? "" : p.endDate,
    }));
  };

  /**
   * Handles end date change with validation.
   *
   * Prevents setting end date that is <= start date.
   * UI will disable the invalid selection (button disabled earlier).
   *
   * @param value - New end date string
   */
  const handleEndDateChange = (value: string) => {
    if (value && form.startDate && value <= form.startDate) return;
    setForm((p) => ({ ...p, endDate: value }));
  };

  /**
   * Submits the form to Firestore (create or update).
   *
   * Validation:
   * - Title and imageUrl required
   * - End date must be after start date (if both provided)
   *
   * mediaType is re-resolved one final time here as a defensive guard —
   * even if some future change to the tab UI reintroduces a similar bug,
   * this line guarantees Firestore never receives mediaType:"image"
   * alongside a mediaUrl that is actually a video asset.
   *
   * Create flow:
   * - Add document to banners collection
   * - Include createdAt server timestamp
   *
   * Update flow:
   * - Update existing document
   * - If startDate/endDate removed, use deleteField() to remove from Firestore
   *
   * @throws {Error} If Firestore operation fails (shows alert to user)
   */
  const handleSubmit = useCallback(async () => {
    // --- Validation ---
    if (!form.title || !form.imageUrl) {
      alert("Title and Image are required");
      return;
    }
    if (form.startDate && form.endDate && form.endDate <= form.startDate) {
      alert("End date must be after start date");
      return;
    }

    setLoading(true);
    try {
      const startTs = toTimestamp(form.startDate);
      const endTs = toTimestamp(form.endDate);

      // Final defensive normalization — never write an inconsistent
      // mediaType/mediaUrl pair to Firestore, regardless of how form state
      // got here.
      const finalMediaType = resolveMediaType(form.mediaType, form.mediaUrl);

      // Base payload (common to create and update)
      const basePayload: Record<string, any> = {
        title: form.title,
        subtitle: form.subtitle,
        eyebrow: form.eyebrow,
        caption: form.caption,
        imageUrl: form.imageUrl,
        mediaUrl: form.mediaUrl,
        mediaType: finalMediaType,
        buttonText: form.buttonText,
        redirectType: form.redirectType,
        redirectId: form.redirectId,
        order: Math.max(1, Number(form.order) || 1),
        isActive: banner?.isActive ?? true,
        ...(startTs && { startDate: startTs }),
        ...(endTs && { endDate: endTs }),
      };

      if (banner) {
        // --- Update existing banner ---
        // If startDate or endDate were removed, use deleteField() to clear them
        if (!startTs && banner.startDate) basePayload.startDate = deleteField();
        if (!endTs && banner.endDate) basePayload.endDate = deleteField();
        await updateDoc(doc(db, "banners", banner.id), basePayload);
      } else {
        // --- Create new banner ---
        await addDoc(collection(db, "banners"), {
          ...basePayload,
          createdAt: serverTimestamp(),
        });
      }

      onClose();
    } catch (error) {
      console.error("Error saving banner:", error);
      alert("Failed to save banner");
    } finally {
      setLoading(false);
    }
  }, [form, banner, onClose]);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Modal header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900">
            {banner ? "Edit Banner" : "Create Banner"}
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <CloseIcon className="text-gray-500" fontSize="small" />
          </button>
        </div>

        {/* Scrollable form content */}
        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
          {/* Media type toggle (Image/Video) — panel switch only,
              does not write to form.mediaType directly */}
          <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveMediaTab("image")}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeMediaTab === "image"
                ? "bg-white text-[#fa243c] shadow-sm"
                : "text-gray-600 hover:text-gray-900"
                }`}
            >
              <ImageIcon fontSize="small" /> Image
            </button>
            <button
              type="button"
              onClick={() => setActiveMediaTab("video")}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeMediaTab === "video"
                ? "bg-white text-[#fa243c] shadow-sm"
                : "text-gray-600 hover:text-gray-900"
                }`}
            >
              <VideoLibraryIcon fontSize="small" /> Video
            </button>
          </div>

          {/* Image upload section */}
          {activeMediaTab === "image" && (
            <div className="space-y-4">
              {imagePreview && (
                <div className="relative h-40 rounded-xl overflow-hidden border border-gray-200">
                  <img
                    src={imagePreview}
                    alt="Banner preview"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <span className="absolute bottom-2 left-3 text-xs text-white font-medium bg-black/30 backdrop-blur-sm px-2 py-1 rounded-full flex items-center gap-1">
                    <ImageIcon sx={{ fontSize: 14 }} /> Image Preview
                  </span>
                  {form.imageUrl && (
                    <span className="absolute top-2 right-2 text-xs bg-green-500 text-white px-2 py-1 rounded-full">
                      Uploaded ✓
                    </span>
                  )}
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  <div className="flex items-center gap-1">
                    <ImageIcon fontSize="small" className="text-gray-400" />
                    <span>Upload Banner Image</span>
                  </div>
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="banner-image-upload"
                  disabled={uploading.image}
                />
                <label
                  htmlFor="banner-image-upload"
                  className={`flex-1 w-full px-4 py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-600 hover:border-[#fa243c] hover:bg-gray-50 cursor-pointer transition-all text-center block ${uploading.image ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                >
                  {uploading.image ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-[#fa243c] border-t-transparent rounded-full animate-spin" />{" "}
                      Uploading...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <ImageIcon fontSize="small" /> Click to upload image
                    </span>
                  )}
                </label>
                {imageUploadError && (
                  <p className="text-xs text-[#fa243c] mt-1">{imageUploadError}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  Recommended: 1200x400px, JPG/PNG up to 5MB
                </p>
              </div>
            </div>
          )}

          {/* Video upload section */}
          {activeMediaTab === "video" && (
            <div className="space-y-4">
              {videoPreview && (
                <div className="relative h-40 rounded-xl overflow-hidden border border-gray-200 bg-black">
                  <video
                    src={videoPreview}
                    className="w-full h-full object-cover"
                    controls
                  />
                  <span className="absolute bottom-2 left-3 text-xs text-white font-medium bg-black/50 backdrop-blur-sm px-2 py-1 rounded-full flex items-center gap-1">
                    <PlayCircleIcon sx={{ fontSize: 14 }} /> Video Preview
                  </span>
                  {form.mediaUrl && (
                    <span className="absolute top-2 right-2 text-xs bg-green-500 text-white px-2 py-1 rounded-full">
                      Uploaded ✓
                    </span>
                  )}
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  <div className="flex items-center gap-1">
                    <VideoLibraryIcon
                      fontSize="small"
                      className="text-gray-400"
                    />
                    <span>Upload Banner Video</span>
                  </div>
                </label>
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleVideoUpload}
                  className="hidden"
                  id="banner-video-upload"
                  disabled={uploading.video}
                />
                <label
                  htmlFor="banner-video-upload"
                  className={`flex-1 w-full px-4 py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-600 hover:border-[#fa243c] hover:bg-gray-50 cursor-pointer transition-all text-center block ${uploading.video ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                >
                  {uploading.video ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-[#fa243c] border-t-transparent rounded-full animate-spin" />{" "}
                      Uploading...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <VideoLibraryIcon fontSize="small" /> Click to upload
                      video
                    </span>
                  )}
                </label>
                {videoUploadError && (
                  <p className="text-xs text-[#fa243c] mt-1">{videoUploadError}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  MP4, WebM up to 50MB. Recommended: 1200x400px
                </p>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                <p className="text-xs text-blue-700 flex items-start gap-1.5">
                  <span className="text-blue-500 text-sm">ℹ️</span>
                  <span>
                    <strong className="font-medium">Note:</strong> Even with
                    video, a fallback image is required for browsers that don't
                    support video or slow connections.
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* Title field */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              <div className="flex items-center gap-1">
                <TitleIcon fontSize="small" className="text-gray-400" />
                <span>Title</span>
              </div>
            </label>
            <input
              placeholder="e.g. New Album Release"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#fa243c]/20 focus:border-[#fa243c] transition-colors"
              value={form.title}
              onChange={(e) =>
                setForm((p) => ({ ...p, title: e.target.value }))
              }
            />
          </div>

          {/* Subtitle field */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              <div className="flex items-center gap-1">
                <SubtitlesIcon fontSize="small" className="text-gray-400" />
                <span>Subtitle</span>
              </div>
            </label>
            <input
              placeholder="e.g. The latest hits from your favorite artists"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#fa243c]/20 focus:border-[#fa243c] transition-colors"
              value={form.subtitle}
              onChange={(e) =>
                setForm((p) => ({ ...p, subtitle: e.target.value }))
              }
            />
          </div>

          {/* Eyebrow Field  */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Eyebrow
            </label>

            <input
              placeholder="e.g. Updated Playlist"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"
              value={form.eyebrow}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  eyebrow: e.target.value,
                }))
              }
            />
          </div>

          {/* Caption Field  */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Caption
            </label>

            <input
              placeholder="e.g. Experience the World Cup like never before"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"
              value={form.caption}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  caption: e.target.value,
                }))
              }
            />
          </div>

          {/* Button text field */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              <div className="flex items-center gap-1">
                <span className="text-gray-400 text-sm">🔘</span>
                <span>Button Text</span>
              </div>
            </label>
            <input
              placeholder="Listen Now"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#fa243c]/20 focus:border-[#fa243c] transition-colors"
              value={form.buttonText}
              onChange={(e) =>
                setForm((p) => ({ ...p, buttonText: e.target.value }))
              }
            />
          </div>

          {/* Redirect type selector */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              <div className="flex items-center gap-1">
                <LinkIcon fontSize="small" className="text-gray-400" />
                <span>Redirect Type</span>
              </div>
            </label>
            <select
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#fa243c]/20 focus:border-[#fa243c] transition-colors bg-white"
              value={form.redirectType}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  redirectType: e.target.value as RedirectType,
                  redirectId: "",
                }))
              }
            >
              <option value="song">Song</option>
              <option value="artist">Artist</option>
              <option value="section">Section</option>
            </select>
          </div>

          {/* Redirect ID field (dynamic based on type) */}
          {form.redirectType === "song" && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Select Song
              </label>
              <select
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#fa243c]/20 focus:border-[#fa243c] transition-colors bg-white"
                value={form.redirectId}
                onChange={(e) =>
                  setForm((p) => ({ ...p, redirectId: e.target.value }))
                }
              >
                <option value="">Select a song</option>
                {songs.map((song) => (
                  <option key={song.id} value={song.id}>
                    {song.title} - {song.artist}
                  </option>
                ))}
              </select>
            </div>
          )}
          {form.redirectType === "artist" && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Artist ID
              </label>
              <input
                placeholder="Enter artist ID"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#fa243c]/20 focus:border-[#fa243c] transition-colors"
                value={form.redirectId}
                onChange={(e) =>
                  setForm((p) => ({ ...p, redirectId: e.target.value }))
                }
              />
            </div>
          )}
          {form.redirectType === "section" && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Section ID
              </label>
              <input
                placeholder="Enter section ID"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#fa243c]/20 focus:border-[#fa243c] transition-colors"
                value={form.redirectId}
                onChange={(e) =>
                  setForm((p) => ({ ...p, redirectId: e.target.value }))
                }
              />
            </div>
          )}

          {/* Display order field */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              <div className="flex items-center gap-1">
                <SortIcon fontSize="small" className="text-gray-400" />
                <span>Display Order</span>
              </div>
            </label>
            <input
              type="number"
              min="1"
              placeholder="1"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#fa243c]/20 focus:border-[#fa243c] transition-colors"
              value={form.order}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  order: Math.max(1, Number(e.target.value) || 1),
                }))
              }
            />
          </div>

          {/* Date range (start/end) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Start Date
              </label>
              <input
                type="datetime-local"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"
                value={form.startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                End Date
              </label>
              <input
                type="datetime-local"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"
                min={form.startDate || undefined}
                value={form.endDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Modal footer with action buttons */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50/50">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-5 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              loading ||
              uploading.image ||
              uploading.video ||
              !form.title ||
              !form.imageUrl ||
              !form.redirectId
            }
            className="px-5 py-2 text-sm font-medium bg-[#fa243c] text-white rounded-full hover:bg-[#E01E5A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[80px] flex items-center justify-center"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : banner ? (
              "Update"
            ) : (
              "Create"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BannerFormModal;