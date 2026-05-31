/**
 * @fileoverview Custom hook for fetching and filtering banners from Firestore.
 *
 * Responsibilities:
 * - Subscribe to real-time banner updates from Firestore
 * - Support two modes: admin mode (all banners) and public mode (only active banners)
 * - Filter active banners based on date ranges (startDate/endDate)
 * - Sort banners by order field (ascending)
 * - Auto-refresh active banner list every 30 seconds to handle date-based expiration
 *
 * Related modules:
 * - bannerService (src/features/banner/services/bannerService.ts) - Contains Firestore subscription functions
 * - FeaturedBanner (src/features/banner/components/FeaturedBanner.tsx) - Uses hook in public mode
 * - BannerManager (src/features/banner/components/BannerManager.tsx) - Uses hook in admin mode
 *
 * Architectural role:
 * - **Data fetching abstraction** for banner management
 * - Centralizes banner filtering logic (active status + date range validation)
 * - Provides real-time updates via Firestore onSnapshot
 *
 * Mode behavior:
 * - adminMode = true: Returns all banners (for admin panel management)
 * - adminMode = false: Returns only active banners within date range (for homepage display)
 *
 * Active banner filtering rules (per Firestore security rules):
 * - isActive must be true
 * - startDate (if present) must be ≤ current time
 * - endDate (if present) must be ≥ current time
 * - Banners without dates are considered active (if isActive = true)
 *
 * Expiration handling:
 * - Firestore onSnapshot triggers on document changes, but not on time-based expiration
 * - To handle banners expiring at their endDate, hook polls every 30 seconds
 * - Re-filters banners on interval, removing expired ones from public view
 * - Admin mode does NOT poll (admins can see expired banners)
 *
 * Performance considerations:
 * - useCallback for getTime and filterBanners (prevents recreation on each render)
 * - JSON.stringify comparison in filterBanners prevents unnecessary state updates
 * - mountedRef prevents state updates after component unmount
 * - 30-second polling interval balances freshness vs performance (acceptable for banners)
 *
 * Real-time behavior:
 * - subscribeToActiveBanners / subscribeToAllBanners return unsubscribe functions
 * - useEffect cleanup calls unsubscribe on unmount
 *
 * @module features/banner/hooks
 */

import { useEffect, useState, useRef, useCallback } from "react";
import {
  subscribeToActiveBanners,
  subscribeToAllBanners,
} from "../services/bannerService";
import { IBanner } from "../types";

/**
 * useBanners - Hook for fetching and filtering banners.
 *
 * @param adminMode - When true, returns all banners (no filtering). When false, returns only active banners within date range.
 * @returns Object containing banners array and loading state
 *
 * @example
 * // Public mode (homepage)
 * const { banners, loading } = useBanners(false);
 *
 * // Admin mode (admin panel)
 * const { banners, loading } = useBanners(true);
 */
export const useBanners = (adminMode = false) => {
  /**
   * Raw banners from Firestore (used in public mode for re-filtering).
   * Only populated in public mode (adminMode = false).
   */
  const [allBanners, setAllBanners] = useState<IBanner[]>([]);

  /**
   * Final filtered banners:
   * - Admin mode: all banners (no filtering)
   * - Public mode: active banners filtered by date range
   */
  const [banners, setBanners] = useState<IBanner[]>([]);

  /** Loading state - true until first Firestore snapshot arrives */
  const [loading, setLoading] = useState(true);

  /** Ref to track component mount state (prevents updates after unmount) */
  const mountedRef = useRef(true);

  /** Interval ref for expiration polling (public mode only) */
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  );

  /**
   * Extracts timestamp in milliseconds from various date formats.
   *
   * Handles:
   * - Firestore Timestamp with .toDate() method
   * - JavaScript Date object
   * - ISO string
   * - Null/undefined values
   *
   * @param value - Date value in any supported format
   * @returns Timestamp in milliseconds, or null if invalid/missing
   */
  const getTime = useCallback((value: any): number | null => {
    if (!value) return null;
    try {
      if (typeof value?.toDate === "function") return value.toDate().getTime();
      if (value instanceof Date) return value.getTime();
      if (typeof value === "string" && value.length > 0) {
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date.getTime();
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  /**
   * Filters banners for public mode (active + date range validation).
   *
   * Steps:
   * 1. Check isActive = true
   * 2. Validate startDate (if present) ≤ now
   * 3. Validate endDate (if present) ≥ now
   * 4. Sort by order field (ascending, default 999 for missing order)
   *
   * Uses JSON.stringify comparison to prevent unnecessary state updates.
   *
   * @param data - Raw banners from Firestore
   */
  const filterBanners = useCallback(
    (data: IBanner[]) => {
      if (!mountedRef.current) return;

      const now = Date.now();
      const valid = data.filter((banner) => {
        if (!banner.isActive) return false;
        const start = getTime(banner.startDate);
        const end = getTime(banner.endDate);

        // No date constraints: always active (if isActive = true)
        if (!start && !end) return true;

        // Has start date but not yet reached: not active
        if (start && now < start) return false;

        // Has end date and expired: not active
        if (end && now > end) return false;

        return true;
      });

      // Sort by order field (1-indexed, ascending)
      valid.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

      // Only update if banners actually changed (prevents unnecessary re-renders)
      if (mountedRef.current) {
        setBanners((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(valid)) return prev;
          return valid;
        });
      }
    },
    [getTime],
  );

  /**
   * Effect 1: Firestore subscription.
   *
   * Subscribes to either:
   * - All banners (adminMode = true) - no filtering, sorting handled in component
   * - Active banners only (adminMode = false) - Firestore query filters isActive = true
   *
   * Real-time updates: onSnapshot triggers callback on any change.
   *
   * Cleanup: Unsubscribes on unmount or when adminMode changes.
   */
  useEffect(() => {
    mountedRef.current = true;

    const unsubscribe = adminMode
      ? subscribeToAllBanners((data) => {
        if (!mountedRef.current) return;
        setBanners(data);
        setLoading(false);
      })
      : subscribeToActiveBanners((data) => {
        if (!mountedRef.current) return;
        setAllBanners(data);
        filterBanners(data);
        setLoading(false);
      });

    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  }, [adminMode, filterBanners]);

  /**
   * Effect 2: Expiration polling (public mode only).
   *
   * Why polling?
   * - Firestore real-time updates only trigger on document changes
   * - Banners expiring due to endDate do NOT trigger onSnapshot
   * - Without polling, expired banners would remain visible until page refresh
   *
   * Polling strategy:
   * - Re-run filterBanners every 30 seconds
   * - Removes banners that have expired since last check
   * - Only active in public mode (adminMode = false)
   *
   * Cleanup: Clears interval on unmount or when adminMode changes.
   */
  useEffect(() => {
    if (adminMode) return;

    const checkExpiry = () => {
      if (mountedRef.current) filterBanners(allBanners);
    };

    // Initial check immediately after mount
    checkExpiry();

    // Set up polling interval
    intervalRef.current = setInterval(checkExpiry, 30_000);

    return () => {
      if (intervalRef.current !== undefined) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
    };
  }, [allBanners, adminMode, filterBanners]);

  return { banners, loading };
};