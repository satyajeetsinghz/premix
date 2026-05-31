/**
 * cloudinaryManager.service.ts
 *
 * Builds a complete index of every Cloudinary asset referenced by the app
 * by querying Firestore across three collections:
 *
 *   /songs       → audioUrl (video/upload) + coverUrl (image/upload)
 *   /banners     → imageUrl (image/upload) + mediaUrl (video/upload)
 *   /users       → photoURL (image/upload)
 *
 * No Cloudinary Admin API is needed — all URLs are already stored in
 * Firestore. We parse the URL to extract resource_type, public_id,
 * format, and transformations.
 *
 * The service also provides:
 *  - deleteCloudinaryAsset()  — calls your Firebase Cloud Function proxy
 *                               (needed because the Cloudinary Delete API
 *                               requires the API secret which must never
 *                               be exposed in the frontend bundle)
 *  - deleteFirestoreReference() — removes or nulls the field in Firestore
 *                               after the asset is deleted from Cloudinary
 *  - formatBytes()            — human-readable file size
 *  - getCloudinaryThumb()     — generates a small preview URL
 */

import {
  collection, getDocs, doc,
  updateDoc, deleteDoc, query, orderBy,
} from "firebase/firestore";
import { db } from "@/services/firebase/config";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AssetResourceType = "image" | "video" | "raw";

export type AssetSource =
  | "song_audio"
  | "song_cover"
  | "banner_image"
  | "banner_media"
  | "user_photo";

export interface CloudinaryAsset {
  /** Unique key within this session: `${source}__${publicId}` */
  key:          string;
  /** Parsed public_id from the Cloudinary URL (path after /upload/) */
  publicId:     string;
  /** Full Cloudinary delivery URL as stored in Firestore */
  url:          string;
  /** image | video | raw */
  resourceType: AssetResourceType;
  /** Where this URL came from in Firestore */
  source:       AssetSource;
  /** Firestore document ID that references this URL */
  firestoreId:  string;
  /** Human-readable collection path (songs / banners / users) */
  collection:   string;
  /** Firestore field name that holds this URL */
  field:        string;
  /** Friendly label for the owner doc (song title, banner title, user name) */
  label:        string;
  /** File format parsed from the URL (mp3, jpg, png, webp, mp4, …) */
  format:       string;
  /** Small preview URL generated from the Cloudinary delivery URL */
  thumbUrl:     string | null;
}

export interface AssetStats {
  total:       number;
  images:      number;
  videos:      number;
  songCovers:  number;
  songAudios:  number;
  bannerImages: number;
  bannerMedias: number;
  userPhotos:  number;
}

// ── URL parsing ───────────────────────────────────────────────────────────────

/**
 * Parses a Cloudinary delivery URL into its components.
 * URL pattern:
 *   https://res.cloudinary.com/{cloud_name}/{resource_type}/upload/[transformations/]{public_id}.{format}
 */
export const parseCloudinaryUrl = (
  url: string,
): { publicId: string; resourceType: AssetResourceType; format: string } | null => {
  if (!url || !url.includes("res.cloudinary.com")) return null;
  try {
    const match = url.match(
      /res\.cloudinary\.com\/[^/]+\/(image|video|raw)\/upload\/(?:[^/]+\/)*([^.]+(?:\.[^.]+)*)$/,
    );
    if (!match) return null;
    const resourceType = match[1] as AssetResourceType;
    const rest         = match[2]; // "public_id.format" or just "public_id"
    const lastDot      = rest.lastIndexOf(".");
    const publicId     = lastDot !== -1 ? rest.slice(0, lastDot) : rest;
    const format       = lastDot !== -1 ? rest.slice(lastDot + 1) : "";
    return { publicId, resourceType, format };
  } catch {
    return null;
  }
};

/**
 * Generates a small Cloudinary thumbnail URL for preview.
 * Only works for images — returns null for audio/raw assets.
 */
export const getCloudinaryThumb = (
  url: string,
  size = 120,
): string | null => {
  if (!url?.includes("res.cloudinary.com")) return null;
  const parsed = parseCloudinaryUrl(url);
  if (!parsed || parsed.resourceType !== "image") return null;
  return url.replace(/\/upload\//, `/upload/w_${size},h_${size},c_fill,q_auto,f_auto/`);
};

/** Converts bytes to a human-readable string. */
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k     = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i     = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
};

// ── Main fetch ────────────────────────────────────────────────────────────────

/** Queries all three Firestore collections and returns a unified asset list. */
export const fetchAllCloudinaryAssets = async (): Promise<CloudinaryAsset[]> => {
  const assets: CloudinaryAsset[] = [];

  const push = (
    url:        string,
    source:     AssetSource,
    col:        string,
    field:      string,
    docId:      string,
    label:      string,
  ) => {
    if (!url) return;
    const parsed = parseCloudinaryUrl(url);
    if (!parsed) return;
    assets.push({
      key:          `${source}__${parsed.publicId}`,
      publicId:     parsed.publicId,
      url,
      resourceType: parsed.resourceType,
      source,
      firestoreId:  docId,
      collection:   col,
      field,
      label,
      format:       parsed.format,
      thumbUrl:     getCloudinaryThumb(url),
    });
  };

  // ── /songs ─────────────────────────────────────────────────────────────
  const songsSnap = await getDocs(
    query(collection(db, "songs"), orderBy("createdAt", "desc")),
  );
  songsSnap.forEach((d) => {
    const data  = d.data();
    const label = `${data.title ?? "Unknown"} — ${data.artist ?? ""}`;
    push(data.audioUrl, "song_audio", "songs", "audioUrl", d.id, label);
    push(data.coverUrl, "song_cover", "songs", "coverUrl", d.id, label);
  });

  // ── /banners ───────────────────────────────────────────────────────────
  const bannersSnap = await getDocs(
    query(collection(db, "banners"), orderBy("order", "asc")),
  );
  bannersSnap.forEach((d) => {
    const data  = d.data();
    const label = data.title ?? "Banner";
    push(data.imageUrl, "banner_image", "banners", "imageUrl", d.id, label);
    push(data.mediaUrl, "banner_media", "banners", "mediaUrl", d.id, label);
  });

  // ── /users ─────────────────────────────────────────────────────────────
  const usersSnap = await getDocs(
    query(collection(db, "users"), orderBy("createdAt", "desc")),
  );
  usersSnap.forEach((d) => {
    const data  = d.data();
    // Only index Cloudinary-hosted photos, not external OAuth avatars
    if (data.photoURL?.includes("res.cloudinary.com")) {
      push(data.photoURL, "user_photo", "users", "photoURL", d.id, data.name ?? data.email ?? d.id);
    }
  });

  return assets;
};

// ── Stats ─────────────────────────────────────────────────────────────────────

export const computeStats = (assets: CloudinaryAsset[]): AssetStats => ({
  total:        assets.length,
  images:       assets.filter((a) => a.resourceType === "image").length,
  videos:       assets.filter((a) => a.resourceType === "video").length,
  songCovers:   assets.filter((a) => a.source === "song_cover").length,
  songAudios:   assets.filter((a) => a.source === "song_audio").length,
  bannerImages: assets.filter((a) => a.source === "banner_image").length,
  bannerMedias: assets.filter((a) => a.source === "banner_media").length,
  userPhotos:   assets.filter((a) => a.source === "user_photo").length,
});

// ── Firestore reference removal ───────────────────────────────────────────────

/**
 * Nulls out the Firestore field that referenced a deleted asset.
 * Does NOT delete the parent document — only clears the URL field.
 *
 * Exception: if the song document's last remaining URL is being cleared,
 * the caller should decide whether to delete the whole song doc instead.
 */
export const clearFirestoreReference = async (
  asset: CloudinaryAsset,
): Promise<void> => {
  const ref = doc(db, asset.collection, asset.firestoreId);
  await updateDoc(ref, { [asset.field]: "" });
};

/**
 * Deletes the parent Firestore document entirely.
 * Use for song docs only when both audioUrl and coverUrl are being removed.
 */
export const deleteFirestoreDocument = async (
  col:   string,
  docId: string,
): Promise<void> => {
  await deleteDoc(doc(db, col, docId));
};

// ── Cloudinary deletion proxy ─────────────────────────────────────────────────
//
// The Cloudinary Destroy API requires the API Secret which must NEVER be
// bundled in frontend code. Two patterns to handle this:
//
// Option A (recommended): Firebase Cloud Function proxy
//   Deploy a callable Cloud Function that receives { publicId, resourceType }
//   and calls the Cloudinary Admin API server-side.
//   Call it here with httpsCallable(functions, 'deleteCloudinaryAsset').
//
// Option B: Unsigned deletion with delete_token
//   Only works within 10 minutes of upload and requires delete_token
//   from the upload response. Not practical for a media manager.
//
// The function below is Option A. Replace the TODO body with your
// Cloud Function call once you've deployed it.
//
// Until then, calling this function will throw a "not implemented" error
// so the UI can handle it gracefully (show a warning to manually delete
// from the Cloudinary dashboard).

export const deleteCloudinaryAsset = async (
  _publicId:     string,
  _resourceType: AssetResourceType,
): Promise<{ result: "ok" } | { result: "not_implemented" }> => {
  // TODO: replace with your Cloud Function call, e.g.:
  //
  //   import { getFunctions, httpsCallable } from "firebase/functions";
  //   const functions = getFunctions();
  //   const deleteFn  = httpsCallable(functions, "deleteCloudinaryAsset");
  //   await deleteFn({ publicId, resourceType });
  //   return { result: "ok" };
  //
  // For now, return not_implemented so the UI shows the correct warning.
  return { result: "not_implemented" };
};