/**
 * @fileoverview Type definitions for section data structures.
 *
 * Responsibilities:
 * - Define the shape of section documents stored in Firestore
 * - Document all available fields with their types and optionality
 * - Provide type safety across section-related components and services
 *
 * Related modules:
 * - section.service (src/features/sections/services/section.service.ts) - Creates/updates ISection objects
 * - useSections (src/features/sections/hooks/useSections.ts) - Returns ISection arrays from Firestore
 * - SectionManager (src/features/sections/components/SectionManager.tsx) - Manages ISection objects
 * - DynamicSection (src/features/sections/components/DynamicSection.tsx) - Uses ISection for rendering
 *
 * Architectural role:
 * - **Core data contract** for all section-related features
 * - Ensures consistency between Firestore documents and TypeScript code
 * - Enables IntelliSense and compile-time type checking
 *
 * Firestore collection: /sections/{sectionId}
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
 *
 * @module features/sections/types
 */

/**
 * ISection - Firestore document structure for home page sections.
 *
 * Sections are used to organize songs into categories on the home page.
 * Admin users can create, edit, delete, and toggle sections via SectionManager.
 *
 * Field categories:
 * - Identification: id, title
 * - State: isActive
 * - Metadata: createdAt, itemCount (calculated, not stored)
 *
 * @property id - Unique document ID (Firestore auto-generated)
 * @property title - Section display name (e.g., "Trending Now", "New Releases")
 * @property isActive - Controls whether section appears on homepage
 *                       - true: Section visible in DynamicSection carousel
 *                       - false: Section hidden (preserved for admin)
 * @property createdAt - Optional Firestore server timestamp (used for ordering)
 *                       Sections ordered by createdAt ascending (oldest first)
 * @property itemCount - Optional calculated field (not stored in Firestore)
 *                       Represents number of songs in section (client-side derived)
 *                       Used for UI display (e.g., "12 songs")
 *
 * @example
 * // Active section with songs
 * {
 *   id: "section_trending",
 *   title: "Trending Now",
 *   isActive: true,
 *   createdAt: Timestamp { seconds: 1704067200 }
 * }
 *
 * @example
 * // Inactive section (admin disabled)
 * {
 *   id: "section_old_releases",
 *   title: "Old Releases",
 *   isActive: false,
 *   createdAt: Timestamp { seconds: 1704153600 }
 * }
 */
export interface ISection {
  id: string;
  title: string;
  isActive: boolean;
  createdAt?: any;
  itemCount?: number;
}