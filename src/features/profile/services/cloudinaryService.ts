/**
 * @fileoverview Cloudinary upload service for user profile images (avatars).
 *
 * Responsibilities:
 * - Upload user avatar images to Cloudinary
 * - Use dedicated image upload endpoint (not auto/upload)
 * - Return secure Cloudinary URL for Firestore storage
 *
 * Related modules:
 * - EditProfileModal (src/features/profile/components/EditProfileModal.tsx) - Uses this service for avatar uploads
 * - Cloudinary service (src/features/admin/services/cloudinary.service.ts) - Generic file upload (different endpoint)
 *
 * Architectural role:
 * - **Profile-specific file upload abstraction** for avatar images
 * - Separate from admin Cloudinary service to allow different upload presets/configurations
 * - Image-specific endpoint (not auto/upload) for optimal handling
 *
 * API endpoint:
 * - URL: https://api.cloudinary.com/v1_1/{cloud_name}/image/upload
 * - Method: POST
 * - Form data: file + upload_preset
 *
 * Configuration (required in .env):
 * - VITE_CLOUDINARY_CLOUD_NAME: Cloudinary cloud name
 * - VITE_CLOUDINARY_UPLOAD_PRESET: Upload preset with image-specific settings
 *
 * Security:
 * - Uses unsigned upload preset (no API key required in client)
 * - Preset should restrict to image files only
 * - File size limits configured in Cloudinary dashboard
 *
 * Error handling:
 * - Checks response.ok before parsing
 * - Extracts error message from Cloudinary response if available
 * - Throws user-friendly error message
 *
 * @module features/profile/services
 */

/**
 * Uploads a profile image to Cloudinary and returns the secure URL.
 *
 * This function is specifically for user avatar images.
 * It uses the image upload endpoint (not the auto/upload endpoint)
 * to ensure proper image optimization and transformation settings.
 *
 * Upload flow:
 * 1. Read Cloudinary configuration from environment variables
 * 2. Create FormData with file and upload preset
 * 3. POST to Cloudinary image upload endpoint
 * 4. Validate response status
 * 5. Return secure_url for Firestore storage
 *
 * Supported file types:
 * - JPEG, PNG, GIF, WebP (configured via upload preset)
 * - Max file size determined by upload preset settings
 *
 * Recommended image transformations (configure in Cloudinary preset):
 * - Automatic format selection (f_auto)
 * - Automatic quality optimization (q_auto)
 * - Crop to square (c_fill)
 * - Size: 400x400 pixels (standard avatar size)
 *
 * @param file - Image file to upload (JPEG, PNG, GIF, WebP)
 * @returns Promise resolving to secure Cloudinary URL
 * @throws {Error} If upload fails (network, invalid preset, or Cloudinary error)
 *
 * @example
 * ```tsx
 * const photoURL = await uploadProfileImage(selectedFile);
 * // Returns: "https://res.cloudinary.com/.../avatar.jpg"
 * ```
 */
export const uploadProfileImage = async (file: File): Promise<string> => {
  // Read configuration from environment variables
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  // Create multipart form data
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);

  // Execute upload request
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: "POST",
      body: formData,
    },
  );

  // Parse response
  const data = await response.json();

  // Handle HTTP errors
  if (!response.ok) {
    throw new Error(data.error?.message || "Upload failed");
  }

  // Return secure URL for Firestore storage
  return data.secure_url;
};