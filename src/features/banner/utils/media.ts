/**
 * @fileoverview Shared media-type detection for banners.
 *
 * Cloudinary uploads video assets under a `/video/upload/` URL path and
 * image assets under `/image/upload/` — this is a reliable, upload-agnostic
 * signal independent of whatever `mediaType` field ended up in Firestore.
 * Used as defensive fallback wherever `mediaType` is read or written.
 */

/**
 * Returns true if the given URL is almost certainly a video asset,
 * based on Cloudinary's resource-type path segment or file extension.
 */
export const isVideoUrl = (url?: string | null): boolean => {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.includes("/video/") ||
    /\.(mp4|webm|mov|m4v)(\?|#|$)/.test(lower)
  );
};

/**
 * Resolves the correct mediaType for a banner, preferring an explicit
 * "video" value but falling back to URL-based detection when mediaType
 * is missing, wrong, or was hardcoded to "image" by a UI bug.
 *
 * Note: an explicit mediaType of "image" is NOT trusted blindly — if the
 * mediaUrl clearly points at a video asset, video wins. This is what lets
 * already-corrupted Firestore documents render correctly without a
 * migration, and stops the same corruption from being re-saved on edit.
 */
export const resolveMediaType = (
  mediaType: "image" | "video" | undefined | null,
  mediaUrl?: string | null,
): "image" | "video" => {
  if (isVideoUrl(mediaUrl)) return "video";
  if (mediaType === "video") return "video";
  return "image";
};