/**
 * @fileoverview Type definitions for banner system data structures.
 *
 * Responsibilities:
 * - Define the shape of banner documents stored in Firestore
 * - Document all available fields with their types and optionality
 * - Provide type safety across banner-related components and services
 *
 * Related modules:
 * - bannerService (src/features/banner/services/bannerService.ts) - Returns IBanner arrays from Firestore
 * - useBanners (src/features/banner/hooks/useBanners.ts) - Manages IBanner data
 * - FeaturedBanner (src/features/banner/components/FeaturedBanner.tsx) - Displays IBanner objects
 * - BannerManager (src/features/banner/components/BannerManager.tsx) - Manages IBanner objects
 *
 * Architectural role:
 * - **Core data contract** for all banner-related features
 * - Ensures consistency between Firestore documents and TypeScript code
 * - Enables IntelliSense and compile-time type checking
 *
 * Firestore collection: /banners/{bannerId}
 *
 * Security rules (from HANDOFF_CORE.md):
 * - Read: isAuthenticated() AND isReadable() (not banned)
 * - Create: isActiveAdmin()
 * - Update: isActiveAdmin()
 * - Delete: isActiveAdmin()
 *
 * Field validation (enforced by security rules):
 * - title: required, string
 * - isActive: required, boolean
 * - createdAt: required on creation (serverTimestamp)
 * - order: number (1-indexed, determines display sequence)
 *
 * @module features/banner/types
 */

import { Timestamp } from "firebase/firestore";

/**
 * IBanner - Firestore document structure for hero banners.
 *
 * Banners are displayed on the homepage carousel (FeaturedBanner component).
 * Admin users can create, edit, delete, and reorder banners via BannerManager.
 *
 * Field categories:
 * 1. Identification: id, title, subtitle
 * 2. Media: mediaType, imageUrl, mediaUrl (optional video)
 * 3. Navigation: redirectType, redirectId, buttonText
 * 4. Scheduling: startDate, endDate
 * 5. Display: order, priority (deprecated), isActive
 *
 * @property id - Unique document ID (Firestore auto-generated)
 * @property title - Banner headline text (required, displayed prominently)
 * @property subtitle - Optional secondary text (smaller, less prominent)
 *
 * @property mediaType - Determines whether to render image or video background
 *                       - "image": Static image background (always required)
 *                       - "video": Video background with image fallback
 * @property imageUrl - Cloudinary URL for banner image (required for both media types)
 *                      Used as fallback when video fails or on slow connections
 * @property mediaUrl - Cloudinary URL for video file (required when mediaType = "video")
 *
 * @property redirectType - Type of destination when banner button is clicked
 *                          - "song": Navigate to song player (requires redirectId = song ID)
 *                          - "playlist": Navigate to playlist page (reserved for future)
 *                          - "artist": Navigate to artist profile (requires redirectId = artist ID)
 *                          - "section": Navigate to home page section (requires redirectId = section ID)
 * @property redirectId - Destination identifier (song ID, artist ID, section ID)
 *                        Required when redirectType is specified
 * @property buttonText - Custom text for call-to-action button (default: "Listen Now")
 *
 * @property startDate - Optional activation timestamp (Firestore Timestamp)
 *                       Banner becomes visible only after this date/time
 *                       Used for scheduled promotions
 * @property endDate - Optional expiration timestamp (Firestore Timestamp)
 *                     Banner becomes invisible after this date/time
 *                     Used for time-limited campaigns
 *
 * @property order - Display order in carousel (1-indexed, ascending)
 *                   Lower numbers appear first
 *                   Admins can reorder via drag-and-drop in BannerManager
 * @property priority - Deprecated field (legacy from earlier version)
 *                      Use order field instead for consistent sorting
 *                      Kept for backward compatibility
 *
 * @property isActive - Master visibility toggle (admin-controlled)
 *                      When false, banner never appears (regardless of dates)
 *                      When true, date range determines visibility
 *
 * Scheduling logic (implemented in useBanners hook):
 * - isActive = false → NEVER visible
 * - isActive = true AND no dates → ALWAYS visible
 * - isActive = true AND startDate only → visible AFTER startDate
 * - isActive = true AND endDate only → visible UNTIL endDate
 * - isActive = true AND both dates → visible BETWEEN dates
 *
 * @example
 * // Active banner with video and song redirect
 * {
 *   id: "banner123",
 *   title: "New Album Release",
 *   subtitle: "Listen to the latest hits",
 *   mediaType: "video",
 *   imageUrl: "https://cloudinary.com/.../fallback.jpg",
 *   mediaUrl: "https://cloudinary.com/.../banner.mp4",
 *   redirectType: "song",
 *   redirectId: "song_456",
 *   buttonText: "Play Now",
 *   order: 1,
 *   isActive: true,
 *   startDate: Timestamp.fromDate(new Date("2024-01-01")),
 *   endDate: Timestamp.fromDate(new Date("2024-01-31"))
 * }
 */
export interface IBanner {
  id: string;
  title: string;
  subtitle?: string;

  mediaType: "image" | "video";
  imageUrl: string;
  mediaUrl?: string;

  redirectType?: "song" | "playlist" | "artist" | "section";
  redirectId?: string;

  startDate?: Timestamp;
  endDate?: Timestamp;

  order?: number;
  priority?: number;

  isActive: boolean;
  buttonText?: string;
}