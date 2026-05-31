/**
 * @fileoverview Firestore subscription functions for banner real-time updates.
 *
 * Responsibilities:
 * - Provide real-time subscriptions to banners collection with appropriate filters
 * - Return unsubscribe functions for cleanup
 * - Transform Firestore documents to typed IBanner objects
 *
 * Related modules:
 * - useBanners (src/features/banner/hooks/useBanners.ts) - Consumes these subscription functions
 * - Firestore banners collection - Source of truth for banner data
 *
 * Architectural role:
 * - **Data layer abstraction** between Firestore and React hooks
 * - Encapsulates query logic (filters, sorting, ordering)
 * - Provides type-safe callbacks for real-time updates
 *
 * Security boundary (from Firestore security rules):
 * - Read access requires isAuthenticated() AND isReadable() (not banned)
 * - Banners collection has read access for all authenticated users
 * - Write/update/delete operations require isActiveAdmin()
 *
 * Query strategies:
 *
 * 1. subscribeToActiveBanners (public homepage use case):
 *    - Filters: isActive == true
 *    - Sorts: order ascending
 *    - Used by FeaturedBanner component
 *    - Hook adds additional date range filtering on client side
 *
 * 2. subscribeToAllBanners (admin panel use case):
 *    - No filter (returns all banners)
 *    - Sorts: order ascending
 *    - Used by BannerManager component
 *    - Admins need to see inactive and scheduled/expired banners
 *
 * Why not filter by date in the query?
 * - Firestore cannot query on computed values (current time)
 * - Date range filtering must be done client-side
 * - Active banners query uses isActive flag for initial filter
 * - useBanners hook adds date range filtering on subscription results
 *
 * Real-time behavior:
 * - onSnapshot triggers callback on initial load AND on any document change
 * - Automatically handles adds, updates, deletes, reorders
 * - Unsubscribe function stops listening and cleans up resources
 *
 * Performance considerations:
 * - orderBy("order", "asc") requires composite index (isActive + order)
 * - Firestore automatically creates this index when first query runs
 * - Small collection size (banners typically 3-10 documents) - no pagination needed
 *
 * @module features/banner/services
 */

import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "@/services/firebase/config";
import { IBanner } from "../types";

/**
 * Subscribes to real-time updates for active banners (public homepage).
 *
 * Query:
 * - Collection: banners
 * - Filter: isActive == true
 * - Sort: order ascending (1, 2, 3, ...)
 *
 * Use case: Homepage carousel needs to show only banners available to regular users.
 * Additional filtering (date ranges) is applied in useBanners hook.
 *
 * Real-time updates trigger when:
 * - Banner is created (if isActive = true)
 * - Banner is updated (isActive toggled, order changed, dates modified)
 * - Banner is deleted
 *
 * @param callback - Function called with updated banners array on every change
 * @returns Unsubscribe function to stop listening
 *
 * @example
 * ```tsx
 * useEffect(() => {
 *   const unsubscribe = subscribeToActiveBanners((banners) => {
 *     console.log('Active banners updated:', banners);
 *   });
 *   return unsubscribe;
 * }, []);
 * ```
 */
export const subscribeToActiveBanners = (
  callback: (banners: IBanner[]) => void,
): Unsubscribe => {
  /**
   * Query construction:
   * - where("isActive", "==", true) - Only fetch active banners
   * - orderBy("order", "asc") - Sort by display order (1-indexed)
   *
   * Composite index required: isActive (asc) + order (asc)
   * Firestore creates this automatically when query runs.
   */
  const q = query(
    collection(db, "banners"),
    where("isActive", "==", true),
    orderBy("order", "asc"),
  );

  /**
   * onSnapshot establishes real-time listener.
   * First callback fires immediately with current data.
   * Subsequent callbacks fire on any document change.
   */
  return onSnapshot(q, (snapshot) => {
    /**
     * Transform Firestore documents to IBanner objects.
     *
     * Each document includes:
     * - id: Document ID (added manually)
     * - ...doc.data(): All banner fields (title, subtitle, imageUrl, etc.)
     */
    const banners = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as IBanner[];

    callback(banners);
  });
};

/**
 * Subscribes to real-time updates for all banners (admin panel).
 *
 * Query:
 * - Collection: banners
 * - No filters (returns all banners)
 * - Sort: order ascending (1, 2, 3, ...)
 *
 * Use case: Admin panel needs to manage all banners regardless of isActive status.
 * Admins need to see:
 * - Active banners (currently visible)
 * - Disabled banners (isActive = false)
 * - Scheduled banners (future startDate)
 * - Expired banners (past endDate)
 *
 * Real-time updates trigger when ANY banner changes (add, update, delete, reorder).
 * Ensures multiple admins see the same data simultaneously.
 *
 * @param callback - Function called with updated banners array on every change
 * @returns Unsubscribe function to stop listening
 *
 * @example
 * ```tsx
 * useEffect(() => {
 *   const unsubscribe = subscribeToAllBanners((banners) => {
 *     setBanners(banners);
 *   });
 *   return unsubscribe;
 * }, []);
 * ```
 */
export const subscribeToAllBanners = (
  callback: (banners: IBanner[]) => void,
): Unsubscribe => {
  /**
   * Query construction:
   * - No where clause (returns all documents)
   * - orderBy("order", "asc") - Consistent ordering for admin UI
   *
   * Index required: order (asc) - Firestore auto-creates this.
   */
  const q = query(collection(db, "banners"), orderBy("order", "asc"));

  /**
   * onSnapshot establishes real-time listener for all banners.
   * Admin panel can use this to show create/edit/delete updates instantly.
   */
  return onSnapshot(q, (snapshot) => {
    /**
     * Transform Firestore documents to IBanner objects.
     *
     * Note: All fields are included (including isActive, startDate, endDate, etc.)
     * BannerManager component handles additional filtering for display purposes.
     */
    const banners = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as IBanner[];

    callback(banners);
  });
};