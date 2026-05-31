/**
 * @fileoverview Hook for real-time subscription to sections collection.
 *
 * Responsibilities:
 * - Subscribe to Firestore sections collection with real-time updates
 * - Order sections by createdAt ascending (oldest first)
 * - Provide loading state during initial subscription
 * - Clean up subscription on unmount
 *
 * Related modules:
 * - SectionManager (src/features/sections/components/SectionManager.tsx) - Uses this hook for admin management
 * - DynamicSection (src/features/sections/components/DynamicSection.tsx) - Uses this hook via parent
 * - HomePage (src/features/home/pages/HomePage.tsx) - Uses this hook to render sections
 *
 * Architectural role:
 * - **Real-time data provider** for home page sections
 * - Centralizes Firestore query logic for sections collection
 * - Used by both admin panel (CRUD) and homepage (display)
 *
 * Firestore data model (from HANDOFF_CORE.md):
 * - Collection: /sections/{sectionId}
 * - Document fields:
 *   - title: string (required)
 *   - isActive: boolean (controls homepage visibility)
 *   - createdAt: serverTimestamp (used for ordering)
 *
 * Query details:
 * - orderBy("createdAt", "asc"): Sections ordered chronologically
 * - No where clause: Returns ALL sections (admin needs inactive ones too)
 * - HomePage filters isActive = true via useSections + client-side filter
 *
 * Real-time behavior:
 * - onSnapshot triggers on initial load and on any document change
 * - Sections added/updated/deleted reflect instantly in UI
 * - Unsubscribe cleanup prevents memory leaks
 *
 * Performance:
 * - Single Firestore subscription shared across components
 * - Sections collection typically small (< 50 documents)
 *
 * Security boundary (from Firestore security rules):
 * - Read: isAuthenticated() AND isReadable() (suspended users can read)
 * - Write: isActiveAdmin() (create/update/delete)
 *
 * @module features/sections/hooks
 */

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/services/firebase/config";
import { ISection } from "../types";

/**
 * Return type for useSections hook.
 *
 * @property sections - Array of sections from Firestore (all sections, including inactive)
 * @property loading - True while initial subscription is establishing
 */
interface UseSectionsReturn {
  sections: ISection[];
  loading: boolean;
}

/**
 * useSections - Hook for real-time subscription to sections collection.
 *
 * @returns Object containing sections array and loading state
 *
 * @example
 * ```tsx
 * const { sections, loading } = useSections();
 *
 * if (loading) return <Spinner />;
 * const activeSections = sections.filter(s => s.isActive);
 * return activeSections.map(s => <DynamicSection key={s.id} section={s} />);
 * ```
 */
export const useSections = (): UseSectionsReturn => {
  const [sections, setSections] = useState<ISection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    /**
     * Query configuration:
     * - Collection: "sections"
     * - Order: createdAt ascending (oldest first)
     *
     * Why createdAt ascending?
     * - Sections appear on homepage in order they were created
     * - Admins can reorder by toggling active status or recreating
     */
    const q = query(collection(db, "sections"), orderBy("createdAt", "asc"));

    /**
     * Real-time subscription to sections collection.
     * onSnapshot provides three key benefits:
     * 1. Initial data load
     * 2. Real-time updates on any document change
     * 3. Automatic cleanup via returned unsubscribe function
     */
    const unsubscribe = onSnapshot(q, (snapshot) => {
      /**
       * Transform Firestore documents to ISection objects.
       * Each document includes: id, title, isActive, createdAt
       */
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ISection[];

      setSections(data);
      setLoading(false);
    });

    // Cleanup subscription on component unmount
    return () => unsubscribe();
  }, []); // Empty dependency array: subscribe once on mount

  return { sections, loading };
};