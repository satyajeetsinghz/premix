/**
 * @fileoverview Cloudinary upload service for audio and image files.
 *
 * Responsibilities:
 * - Upload files (audio/images) to Cloudinary using unsigned upload presets
 * - Validate environment variables and file inputs before upload
 * - Handle upload timeouts and network errors gracefully
 * - Return secure Cloudinary URLs for storage in Firestore
 *
 * Related modules:
 * - uploadSong.service.ts - Uses this service to upload audio and cover files
 * - EditProfileModal - Uses this service to upload avatar images
 * - UploadSongForm - Uses this service via uploadSong service
 *
 * Architectural role:
 * - **File upload abstraction** for all user-generated content
 * - Single source of truth for Cloudinary configuration and upload logic
 * - Provides consistent error handling and timeout management
 *
 * Security considerations:
 * - Uses unsigned upload presets (no API key in client)
 * - Upload preset must be configured in Cloudinary dashboard
 * - Preset should have appropriate file type restrictions
 * - Environment variables validated at runtime (fail early)
 *
 * Configuration (required in .env):
 * ```
 * VITE_CLOUDINARY_CLOUD_NAME="your_cloud_name"
 * VITE_CLOUDINARY_UPLOAD_PRESET="your_upload_preset"
 * ```
 *
 * API reference:
 * - Cloudinary Upload API: https://cloudinary.com/documentation/image_upload_api_reference
 * - Endpoint: POST https://api.cloudinary.com/v1_1/{cloud_name}/auto/upload
 *
 * Upload flow:
 * 1. Validate environment variables (throw if missing)
 * 2. Create FormData with file and upload_preset
 * 3. POST to Cloudinary API with 30-second timeout
 * 4. Validate response status and structure
 * 5. Return secure_url for Firestore storage
 *
 * Error handling:
 * - Missing env vars → Error thrown immediately
 * - Network errors → Propagates to caller with user-friendly message
 * - Timeout (30s) → Aborts request, throws timeout error
 * - Invalid response (missing secure_url) → Throws error
 *
 * Performance considerations:
 * - No compression or resizing (upload original files)
 * - Timeout prevents hanging requests from blocking UI
 * - AbortController cancels fetch on timeout
 *
 * @module features/admin/services
 */

/**
 * Cloudinary API response structure for successful uploads.
 *
 * Reference: https://cloudinary.com/documentation/upload_images#upload_response
 *
 * @property public_id - Unique identifier for the asset in Cloudinary
 * @property version - Version number (increments on overwrites)
 * @property signature - Security signature (only for signed uploads)
 * @property width - Image width in pixels (null for audio files)
 * @property height - Image height in pixels (null for audio files)
 * @property format - File format (jpg, png, mp3, etc.)
 * @property resource_type - "image" or "video" or "raw" (audio is "video" for streaming)
 * @property created_at - ISO timestamp of upload
 * @property tags - Array of assigned tags (empty if none)
 * @property bytes - File size in bytes
 * @property type - Upload type (always "upload" for unsigned)
 * @property etag - Entity tag for caching
 * @property placeholder - Whether asset is a placeholder
 * @property url - Non-secure HTTP URL (use secure_url instead)
 * @property secure_url - HTTPS URL for production use (recommended)
 * @property folder - Folder path in Cloudinary (empty if none)
 * @property original_filename - Original file name before upload
 */
interface CloudinaryResponse {
  public_id: string;
  version: number;
  signature: string;
  width: number;
  height: number;
  format: string;
  resource_type: string;
  created_at: string;
  tags: string[];
  bytes: number;
  type: string;
  etag: string;
  placeholder: boolean;
  url: string;
  secure_url: string;
  folder: string;
  original_filename: string;
}

/**
 * Cloudinary configuration from environment variables.
 *
 * @property cloudName - Cloudinary cloud name (subdomain in cloud URL)
 * @property uploadPreset - Unsigned upload preset name (configured in Cloudinary dashboard)
 */
interface CloudinaryConfig {
  cloudName: string;
  uploadPreset: string;
}

/**
 * Base URL for Cloudinary API.
 * Format: https://api.cloudinary.com/v1_1/{cloud_name}
 */
const CLOUDINARY_API_BASE = "https://api.cloudinary.com/v1_1";

/**
 * Upload endpoint path.
 * Using "auto/upload" instead of "image/upload" or "video/upload"
 * allows Cloudinary to auto-detect resource type (image, video, raw).
 * Audio files are treated as "video" resource type for streaming support.
 */
const UPLOAD_ENDPOINT = "auto/upload";

/**
 * Request timeout in milliseconds (30 seconds).
 *
 * Cloudinary uploads typically complete within 10-15 seconds for reasonable file sizes.
 * 30 second timeout allows for slower connections and larger files.
 * Prevents UI from hanging indefinitely on network issues.
 */
const REQUEST_TIMEOUT_MS = 30000;

/**
 * Retrieves and validates Cloudinary configuration from environment variables.
 *
 * Environment variables required:
 * - VITE_CLOUDINARY_CLOUD_NAME: Cloudinary cloud name (e.g., "my-cloud-name")
 * - VITE_CLOUDINARY_UPLOAD_PRESET: Unsigned upload preset (e.g., "beatstream_preset")
 *
 * Why throw errors?
 * - Fail fast if configuration is missing (prevents silent upload failures)
 * - Clear error messages help developers debug missing env vars
 * - No default values (would mask configuration errors)
 *
 * @returns Validated Cloudinary configuration object
 * @throws {Error} If cloud name or upload preset is missing
 */
const getCloudinaryConfig = (): CloudinaryConfig => {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName) {
    throw new Error(
      "VITE_CLOUDINARY_CLOUD_NAME environment variable is not set",
    );
  }

  if (!uploadPreset) {
    throw new Error(
      "VITE_CLOUDINARY_UPLOAD_PRESET environment variable is not set",
    );
  }

  return { cloudName, uploadPreset };
};

/**
 * Creates FormData object for Cloudinary upload.
 *
 * Required fields:
 * - file: The file to upload (Blob/File object)
 * - upload_preset: Unsigned upload preset name
 *
 * Optional fields (not included):
 * - public_id: Custom identifier (let Cloudinary generate)
 * - folder: Target folder (preset determines this)
 * - tags: Array of tags (preset may add default tags)
 *
 * @param file - File to upload (audio or image)
 * @param uploadPreset - Cloudinary unsigned upload preset
 * @returns FormData ready for POST request
 */
const createUploadFormData = (file: File, uploadPreset: string): FormData => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  return formData;
};

/**
 * Constructs full Cloudinary API URL.
 *
 * Format: https://api.cloudinary.com/v1_1/{cloud_name}/auto/upload
 *
 * @param cloudName - Cloudinary cloud name
 * @returns Complete upload endpoint URL
 */
const constructUploadUrl = (cloudName: string): string => {
  return `${CLOUDINARY_API_BASE}/${cloudName}/${UPLOAD_ENDPOINT}`;
};

/**
 * Validates HTTP response from Cloudinary.
 *
 * Checks:
 * - HTTP status code (200-299 is ok)
 * - Extracts error message from response body if available
 *
 * Why not just check response.ok?
 * - response.ok doesn't provide error details
 * - Cloudinary includes error.message in response body
 * - Parsing error body gives better error messages
 *
 * @param response - Fetch Response object
 * @throws {Error} If response status is not ok
 */
const validateResponse = async (response: Response): Promise<void> => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage =
      errorData.error?.message ||
      `Upload failed with status ${response.status}`;
    throw new Error(errorMessage);
  }
};

/**
 * Uploads a file to Cloudinary and returns the secure URL.
 *
 * This is the main public API for file uploads in BeatStream.
 *
 * Supported file types:
 * - Images: PNG, JPG, GIF, WebP, etc.
 * - Audio: MP3, WAV, FLAC, AAC, etc.
 *
 * Upload process:
 * 1. Validate file input (non-null, instanceof File)
 * 2. Read Cloudinary config from environment
 * 3. Create FormData with file and upload preset
 * 4. POST to Cloudinary API with timeout abort
 * 5. Validate response (status + structure)
 * 6. Return secure_url for database storage
 *
 * Timeout handling:
 * - AbortController signals timeout after REQUEST_TIMEOUT_MS
 * - Clean up timeout ID after response or error
 * - Prevents memory leaks from dangling timeouts
 *
 * Error propagation:
 * - Missing env vars → Error "VITE_CLOUDINARY_CLOUD_NAME..."
 * - Invalid file → Error "File is required..."
 * - Timeout → Error "Upload request timed out..."
 * - Network error → Propagates original error
 * - Missing secure_url → Error "No secure URL returned..."
 *
 * @param file - File object to upload (audio or image)
 * @returns Promise resolving to secure Cloudinary URL (HTTPS)
 * @throws {Error} If upload fails (validation, network, timeout, API error)
 *
 * @example
 * ```tsx
 * const audioUrl = await uploadToCloudinary(audioFile);
 * const coverUrl = await uploadToCloudinary(coverImage);
 * ```
 */
export const uploadToCloudinary = async (file: File): Promise<string> => {
  // --- Input validation ---
  if (!file) {
    throw new Error("File is required for upload");
  }

  if (!(file instanceof File)) {
    throw new Error("Invalid file object");
  }

  try {
    // --- Get configuration ---
    const { cloudName, uploadPreset } = getCloudinaryConfig();

    // --- Prepare request ---
    const formData = createUploadFormData(file, uploadPreset);
    const uploadUrl = constructUploadUrl(cloudName);

    // --- Setup timeout abort ---
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      // --- Execute upload ---
      const response = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      // --- Clear timeout on success/failure ---
      clearTimeout(timeoutId);

      // --- Validate response status ---
      await validateResponse(response);

      // --- Parse and validate response data ---
      const data: CloudinaryResponse = await response.json();

      if (!data.secure_url) {
        throw new Error("No secure URL returned from Cloudinary");
      }

      // --- Return secure URL for storage ---
      return data.secure_url;
    } catch (error) {
      // --- Clear timeout if still pending ---
      clearTimeout(timeoutId);

      // --- Enhance timeout error with friendly message ---
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(
          `Upload request timed out after ${REQUEST_TIMEOUT_MS}ms`,
        );
      }

      throw error;
    }
  } catch (error) {
    // --- Convert unknown errors to user-friendly format ---
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unknown error occurred during upload";

    console.error("Cloudinary upload error:", errorMessage);
    throw new Error(`Cloudinary upload failed: ${errorMessage}`);
  }
};