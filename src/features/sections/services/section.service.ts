/**
 * @fileoverview Firestore service for section CRUD operations.
 *
 * Responsibilities:
 * - Create new sections with title, isActive status, and createdAt timestamp
 * - Update section title
 * - Toggle section active status (show/hide on homepage)
 * - Delete sections from Firestore
 *
 * Related modules:
 * - SectionManager (src/features/sections/components/SectionManager.tsx) - Uses these functions for admin operations
 * - useSections (src/features/sections/hooks/useSections.ts) - Provides real-time subscription for reading
 *
 * Architectural role:
 * - **Data mutation layer** for section management
 * - Only accessible by admin users (security rules enforce isActiveAdmin())
 * - No return values needed (operations succeed or throw errors)
 *
 * Firestore data model (from HANDOFF_CORE.md):
 * - Collection: /sections/{sectionId}
 * - Document fields:
 *   - title: string (required, user-facing section name)
 *   - isActive: boolean (controls visibility on homepage)
 *   - createdAt: serverTimestamp (used for ordering)
 *
 * Security boundary (from Firestore security rules):
 * - Create: isActiveAdmin() AND fields: title, isActive, createdAt
 * - Update: isActiveAdmin() AND isUnchanged('createdAt')
 * - Delete: isActiveAdmin()
 *
 * Section behavior:
 * - Active sections appear on homepage (DynamicSection renders them)
 * - Inactive sections hidden from homepage but preserved for admin
 * - Deleting a section does NOT affect songs (only removes categorization)
 *
 * @module features/sections/services
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/services/firebase/config";

/**
 * Creates a new section in Firestore.
 *
 * New sections are created with:
 * - isActive: true (visible on homepage by default)
 * - createdAt: serverTimestamp (Firestore server time)
 *
 * @param title - Section title (e.g., "Top Hits", "New Releases")
 * @returns Promise that resolves when document is created
 *
 * @example
 * ```tsx
 * await createSection("Trending Now");
 * // Section appears on homepage (if active)
 * ```
 */
export const createSection = async (title: string): Promise<void> => {
  await addDoc(collection(db, "sections"), {
    title: title.trim(),
    isActive: true,
    createdAt: serverTimestamp(),
  });
};

/**
 * Updates a section's title.
 *
 * Only updates the title field (isActive and createdAt remain unchanged).
 *
 * @param id - Section document ID
 * @param newTitle - New section title (trimmed)
 * @returns Promise that resolves when update completes
 *
 * @example
 * ```tsx
 * await updateSection("section123", "Updated Section Name");
 * ```
 */
export const updateSection = async (id: string, newTitle: string): Promise<void> => {
  const ref = doc(db, "sections", id);
  await updateDoc(ref, {
    title: newTitle.trim(),
  });
};

/**
 * Toggles section active status.
 *
 * Active: Section appears on homepage (DynamicSection renders)
 * Inactive: Section hidden from homepage (admin can re-activate)
 *
 * @param id - Section document ID
 * @param currentStatus - Current isActive value (true = active, false = inactive)
 * @returns Promise that resolves when update completes
 *
 * @example
 * ```tsx
 * // Deactivate a section
 * await toggleSectionStatus("section123", true);
 * // Section no longer appears on homepage
 *
 * // Reactivate a section
 * await toggleSectionStatus("section123", false);
 * // Section appears on homepage again
 * ```
 */
export const toggleSectionStatus = async (
  id: string,
  currentStatus: boolean,
): Promise<void> => {
  const ref = doc(db, "sections", id);
  await updateDoc(ref, {
    isActive: !currentStatus,
  });
};

/**
 * Deletes a section from Firestore.
 *
 * IMPORTANT: This does NOT delete or modify any songs.
 * Songs that were in this section will have orphaned sectionIds references.
 * Admin should clean up song.sectionIds arrays separately if needed.
 *
 * @param id - Section document ID to delete
 * @returns Promise that resolves when deletion completes
 *
 * @example
 * ```tsx
 * await deleteSection("section123");
 * // Section removed from Firestore
 * // Songs referencing this section still exist (orphaned references)
 * ```
 */
export const deleteSection = async (id: string): Promise<void> => {
  const ref = doc(db, "sections", id);
  await deleteDoc(ref);
};