/**
 * @fileoverview Orchestrates song upload workflow: Cloudinary uploads + Firestore document creation.
 *
 * Responsibilities:
 * - Validate all song data before upload (title, artist, files, sections)
 * - Upload audio and cover image files to Cloudinary in parallel
 * - Create Firestore document with Cloudinary URLs and metadata
 * - Support two calling patterns: positional parameters or object parameter
 *
 * Related modules:
 * - cloudinary.service.ts - Handles individual file uploads to Cloudinary
 * - UploadSongForm (src/features/admin/components/UploadSongForm.tsx) - UI that calls this service
 * - Firestore songs collection - Destination for uploaded song documents
 *
 * Architectural role:
 * - **Upload orchestration layer** between UI and infrastructure services
 * - Encapsulates business logic for song creation (validation, defaults, transformations)
 * - Provides consistent error handling and retry semantics
 *
 * Firestore security rules (from HANDOFF_CORE.md):
 * - Only active admin users (isActiveAdmin()) can create songs
 * - Required fields: title, artist, audioUrl, coverUrl, sectionIds, likeCount, createdAt, duration, album
 * - likeCount must be 0 on creation (enforced by security rule)
 * - SectionIds array must reference existing sections (not enforced in rules, handled by validation)
 *
 * Upload flow:
 * 1. Validate input parameters (title, artist, files, sections)
 * 2. Upload audio file to Cloudinary → get audioUrl
 * 3. Upload cover image to Cloudinary → get coverUrl (parallel execution)
 * 4. Construct Song object with Cloudinary URLs and metadata
 * 5. Add document to Firestore "songs" collection
 * 6. Return DocumentReference for caller (optional)
 *
 * Validation rules:
 * - Title: Required, string, max 255 chars
 * - Artist: Required, string, max 255 chars
 * - Album: Optional, if provided max 255 chars
 * - Duration: Optional, if provided max 20 chars (format: "MM:SS")
 * - Audio file: Valid File object, non-empty
 * - Cover file: Valid File object, non-empty
 * - SectionIds: Array of non-empty strings
 *
 * Error handling strategy:
 * - Validation errors: throw immediately with descriptive message
 * - Cloudinary upload errors: aggregate and throw with context
 * - Firestore write errors: throw with original error message
 * - All errors caught and re-thrown with user-friendly prefix
 *
 * Performance optimizations:
 * - Parallel file uploads via Promise.all (reduces total upload time)
 * - No unnecessary data transformations (trim only when needed)
 * - Single Firestore write operation (no updates after creation)
 *
 * @module features/admin/services
 */

import { db } from "@/services/firebase/config";
import {
  collection,
  addDoc,
  serverTimestamp,
  DocumentReference,
} from "firebase/firestore";
import { uploadToCloudinary } from "./cloudinary.service";

/**
 * Firestore song document structure after upload.
 *
 * Matches ISong interface in src/features/songs/types.ts
 * with the addition of serverTimestamp for createdAt.
 *
 * @property title - Song title (trimmed, max 255 chars)
 * @property artist - Artist name (trimmed, max 255 chars)
 * @property audioUrl - Cloudinary secure URL for audio file
 * @property coverUrl - Cloudinary secure URL for cover image
 * @property sectionIds - Array of section IDs for home page categorization
 * @property likeCount - Initial like count (always 0 for new songs)
 * @property duration - Track duration string (e.g., "3:45") or empty string
 * @property album - Album name (trimmed) or empty string
 * @property createdAt - Firestore server timestamp (set by security rules)
 */
interface Song {
  title: string;
  artist: string;
  audioUrl: string;
  coverUrl: string;
  sectionIds: string[];
  likeCount: number;
  duration: string;
  album: string;
  createdAt: ReturnType<typeof serverTimestamp>;
}

/**
 * Parameters for song upload operation.
 *
 * Supports both required and optional fields.
 *
 * @property title - Song title (required)
 * @property artist - Artist name (required)
 * @property audioFile - Audio file object (required)
 * @property coverFile - Cover image file object (required)
 * @property sectionIds - Array of section IDs (required, may be empty)
 * @property duration - Track duration (optional, default empty string)
 * @property album - Album name (optional, default empty string)
 */
interface UploadSongParams {
  title: string;
  artist: string;
  audioFile: File;
  coverFile: File;
  sectionIds: string[];
  duration?: string;
  album?: string;
}

/**
 * Firestore collection name for songs.
 * Matches security rule pattern: /songs/{songId}
 */
const SONGS_COLLECTION_NAME = "songs";

/**
 * Default initial like count for new songs.
 * Per security rules: likeCount must be 0 on creation.
 * Likes are incremented via separate update operation.
 */
const DEFAULT_LIKE_COUNT = 0;

/**
 * Default value for optional duration field.
 * Empty string indicates no duration provided.
 */
const DEFAULT_DURATION = "";

/**
 * Default value for optional album field.
 * Empty string indicates no album provided.
 */
const DEFAULT_ALBUM = "";

/**
 * Maximum length constraints for string fields.
 *
 * - Title: 255 chars (Firestore string limit, also UI display limit)
 * - Artist: 255 chars
 * - Album: 255 chars
 * - Duration: 20 chars (supports formats like "MM:SS" or "HH:MM:SS")
 */
const MAX_TITLE_LENGTH = 255;
const MAX_ARTIST_LENGTH = 255;
const MAX_ALBUM_LENGTH = 255;
const MAX_DURATION_LENGTH = 20;

/**
 * Validates a required string field.
 *
 * Checks:
 * - Field exists and is a string
 * - Trimmed value is not empty
 * - Trimmed value does not exceed maxLength
 *
 * @param value - Field value to validate
 * @param fieldName - Human-readable field name for error messages
 * @param maxLength - Maximum allowed length after trimming
 * @throws {Error} If validation fails
 */
const validateStringField = (
  value: string,
  fieldName: string,
  maxLength: number,
): void => {
  if (!value || typeof value !== "string") {
    throw new Error(`${fieldName} is required and must be a string`);
  }

  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    throw new Error(`${fieldName} cannot be empty`);
  }

  if (trimmedValue.length > maxLength) {
    throw new Error(
      `${fieldName} exceeds maximum length of ${maxLength} characters`,
    );
  }
};

/**
 * Validates a File object for upload.
 *
 * Checks:
 * - File is a File instance (not null or other type)
 * - File size is not zero (prevents empty file uploads)
 *
 * Note: Does NOT validate file type or max size.
 * Type validation happens in UI (accept attribute) and Cloudinary.
 * Max size validation could be added here (e.g., 50MB for audio, 10MB for images).
 *
 * @param file - File object to validate
 * @param fileType - Human-readable file type for error messages
 * @throws {Error} If validation fails
 */
const validateFile = (file: File, fileType: string): void => {
  if (!(file instanceof File)) {
    throw new Error(`${fileType} must be a valid File object`);
  }

  if (file.size === 0) {
    throw new Error(`${fileType} file is empty`);
  }
};

/**
 * Validates sectionIds array.
 *
 * Checks:
 * - Is an array
 * - All elements are non-empty strings
 *
 * Note: Does NOT validate that section IDs exist in Firestore.
 * Security rules will reject if section doesn't exist (per /sections/ match).
 * This validation prevents malformed data before hitting Firestore.
 *
 * @param sectionIds - Array to validate
 * @throws {Error} If validation fails
 */
const validateSectionIds = (sectionIds: unknown): void => {
  if (!Array.isArray(sectionIds)) {
    throw new Error("sectionIds must be an array");
  }

  if (!sectionIds.every((id) => typeof id === "string" && id.length > 0)) {
    throw new Error("All sectionIds must be non-empty strings");
  }
};

/**
 * Normalizes optional string fields with default values.
 *
 * If value is a non-empty string after trimming, returns trimmed value.
 * Otherwise returns defaultValue.
 *
 * @param value - Optional field value
 * @param defaultValue - Default value if field is empty
 * @returns Normalized string (trimmed or default)
 */
const normalizeOptionalField = (
  value: string | undefined,
  defaultValue: string,
): string => {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : defaultValue;
};

/**
 * Validates all upload parameters before processing.
 *
 * Aggregates validation for:
 * - Required string fields (title, artist)
 * - File objects (audio, cover)
 * - SectionIds array
 * - Optional fields (album, duration) if provided
 *
 * Called before any network requests to fail fast.
 *
 * @param params - Upload parameters to validate
 * @throws {Error} If any validation fails
 */
const validateUploadParams = (params: UploadSongParams): void => {
  const { title, artist, audioFile, coverFile, sectionIds, duration, album } =
    params;

  // Required fields
  validateStringField(title, "Title", MAX_TITLE_LENGTH);
  validateStringField(artist, "Artist", MAX_ARTIST_LENGTH);
  validateFile(audioFile, "Audio");
  validateFile(coverFile, "Cover image");
  validateSectionIds(sectionIds);

  // Optional fields (only if non-empty)
  if (album !== undefined && album.length > 0) {
    const trimmedAlbum = album.trim();
    if (trimmedAlbum.length > MAX_ALBUM_LENGTH) {
      throw new Error(
        `Album exceeds maximum length of ${MAX_ALBUM_LENGTH} characters`,
      );
    }
  }

  if (duration !== undefined && duration.length > 0) {
    const trimmedDuration = duration.trim();
    if (trimmedDuration.length > MAX_DURATION_LENGTH) {
      throw new Error(
        `Duration exceeds maximum length of ${MAX_DURATION_LENGTH} characters`,
      );
    }
  }
};

/**
 * Uploads audio and cover files to Cloudinary in parallel.
 *
 * Performance:
 * - Uses Promise.all for parallel uploads
 * - Reduces total upload time compared to sequential uploads
 * - Fail-fast: if one upload fails, both are rejected
 *
 * @param audioFile - Audio file to upload
 * @param coverFile - Cover image to upload
 * @returns Object containing audioUrl and coverUrl
 * @throws {Error} If either upload fails
 */
const uploadMediaFiles = async (
  audioFile: File,
  coverFile: File,
): Promise<{ audioUrl: string; coverUrl: string }> => {
  try {
    const [audioUrl, coverUrl] = await Promise.all([
      uploadToCloudinary(audioFile),
      uploadToCloudinary(coverFile),
    ]);

    return { audioUrl, coverUrl };
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unknown error during media upload";
    throw new Error(`Failed to upload media files: ${errorMessage}`);
  }
};

/**
 * Uploads a new song to Premix.
 *
 * This is the main entry point for song creation in the admin panel.
 *
 * Two calling patterns (for backward compatibility):
 *
 * Pattern 1: Object parameter (recommended)
 * ```tsx
 * await uploadSong({
 *   title: "Bohemian Rhapsody",
 *   artist: "Queen",
 *   audioFile: audioFileObject,
 *   coverFile: coverFileObject,
 *   sectionIds: ["section123"],
 *   duration: "5:55",
 *   album: "A Night at the Opera"
 * });
 * ```
 *
 * Pattern 2: Positional parameters (legacy)
 * ```tsx
 * await uploadSong(
 *   "Bohemian Rhapsody",
 *   "Queen",
 *   audioFileObject,
 *   coverFileObject,
 *   ["section123"],
 *   "5:55",
 *   "A Night at the Opera"
 * );
 * ```
 *
 * Upload steps:
 * 1. Normalize input (support both calling patterns)
 * 2. Validate all parameters
 * 3. Upload files to Cloudinary (parallel)
 * 4. Construct Firestore document
 * 5. Add document to collection
 * 6. Return DocumentReference
 *
 * Security considerations:
 * - All validation occurs client-side (defense in depth)
 * - Firestore security rules provide final enforcement
 * - Cloudinary uploads use unsigned preset (client-side upload)
 *
 * @param titleOrParams - Either song title (string) or full UploadSongParams object
 * @param artist - Artist name (required if using positional pattern)
 * @param audioFile - Audio file (required if using positional pattern)
 * @param coverFile - Cover image (required if using positional pattern)
 * @param sectionIds - Array of section IDs (required if using positional pattern)
 * @param duration - Track duration (optional)
 * @param album - Album name (optional)
 * @returns Promise resolving to Firestore DocumentReference
 * @throws {Error} If validation fails, upload fails, or Firestore write fails
 *
 * @example
 * ```tsx
 * // Object parameter pattern
 * const docRef = await uploadSong({
 *   title: "New Song",
 *   artist: "New Artist",
 *   audioFile: audio,
 *   coverFile: cover,
 *   sectionIds: ["section1", "section2"]
 * });
 * console.log("Song created with ID:", docRef.id);
 * ```
 */
export async function uploadSong(
  titleOrParams: string | UploadSongParams,
  artist?: string,
  audioFile?: File,
  coverFile?: File,
  sectionIds?: string[],
  duration: string = DEFAULT_DURATION,
  album: string = DEFAULT_ALBUM,
): Promise<DocumentReference> {
  try {
    // --- Normalize input (support both calling patterns) ---
    let uploadParams: UploadSongParams;

    if (typeof titleOrParams === "object" && titleOrParams !== null) {
      // Pattern 1: Object parameter
      uploadParams = titleOrParams;
    } else {
      // Pattern 2: Positional parameters
      if (!artist || !audioFile || !coverFile || !sectionIds) {
        throw new Error("Missing required parameters");
      }
      uploadParams = {
        title: titleOrParams as string,
        artist,
        audioFile,
        coverFile,
        sectionIds,
        duration,
        album,
      };
    }

    // --- Validate before network requests ---
    validateUploadParams(uploadParams);

    const {
      title,
      artist: artistName,
      audioFile: audioFileData,
      coverFile: coverFileData,
      sectionIds: sectionIdsList,
      duration: dur,
      album: alb,
    } = uploadParams;

    // --- Upload media files to Cloudinary (parallel) ---
    const { audioUrl, coverUrl } = await uploadMediaFiles(
      audioFileData,
      coverFileData,
    );

    // --- Normalize optional fields ---
    const normalizedDuration = normalizeOptionalField(dur, DEFAULT_DURATION);
    const normalizedAlbum = normalizeOptionalField(alb, DEFAULT_ALBUM);

    // --- Construct Firestore document ---
    const songData: Song = {
      title: title.trim(),
      artist: artistName.trim(),
      audioUrl,
      coverUrl,
      sectionIds: sectionIdsList,
      likeCount: DEFAULT_LIKE_COUNT,
      duration: normalizedDuration,
      album: normalizedAlbum,
      createdAt: serverTimestamp(),
    };

    // --- Add to Firestore ---
    const docRef = await addDoc(
      collection(db, SONGS_COLLECTION_NAME),
      songData,
    );

    return docRef;
  } catch (error) {
    // --- Convert all errors to user-friendly format ---
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Song upload failed:", errorMessage);
    throw new Error(`Failed to upload song: ${errorMessage}`);
  }
}