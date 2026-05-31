/**
 * @fileoverview Hook for fetching and updating user profile data.
 *
 * Responsibilities:
 * - Fetch user profile from Firestore on component mount or when user changes
 * - Provide updateProfile function to modify profile data
 * - Optimistically update local state after successful update
 * - Manage loading state during initial fetch
 *
 * Related modules:
 * - profileService (src/features/profile/services/profileService.ts) - Contains getUserProfile and updateUserProfile
 * - ProfilePage (src/features/profile/ProfilePage.tsx) - Consumes this hook
 * - EditProfileModal (src/features/profile/components/EditProfileModal.tsx) - Calls updateProfile
 *
 * Architectural role:
 * - **Profile data provider** for profile-related components
 * - Single source of truth for profile state across the app
 * - Optimistic updates for better UX (no loading state on update)
 *
 * Firestore data model (from HANDOFF_CORE.md):
 * - Collection: /users/{uid}
 * - Document fields: uid, name, email, photoURL, role, status, createdAt, lastLoginAt
 *
 * Data flow:
 * 1. Component mounts → fetch profile from Firestore
 * 2. Returns profile data + loading state
 * 3. User edits profile → updateProfile called
 * 4. Optimistically update local state (immediate UI feedback)
 * 5. Firestore update performed in background
 * 6. On error: would need manual rollback (not implemented - optimistic assumes success)
 *
 * Performance considerations:
 * - Single fetch on mount (no real-time subscription)
 * - For real-time profile updates, consider using onSnapshot in future
 * - Optimistic update reduces perceived latency
 *
 * Limitations:
 * - This hook uses getUserProfile (single fetch) not subscribeToUserProfile
 * - Changes made in other tabs/sessions won't automatically appear
 * - Page refresh required to see external profile changes
 *
 * @deprecated Consider adding real-time subscription for cross-tab consistency
 *
 * @module features/profile/hooks
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { getUserProfile, updateUserProfile } from "../services/profileService";

/**
 * Return type for useProfile hook.
 *
 * @property profile - User profile data (null if not loaded or no user)
 * @property loading - True while initial fetch is in progress
 * @property updateProfile - Function to update profile (optimistically updates local state)
 */
interface UseProfileReturn {
  profile: any;
  loading: boolean;
  updateProfile: (data: any) => Promise<void>;
}

/**
 * useProfile - Hook for fetching and updating user profile.
 *
 * @returns Object containing profile data, loading state, and update function
 *
 * @example
 * ```tsx
 * const { profile, loading, updateProfile } = useProfile();
 *
 * if (loading) return <Spinner />;
 * return (
 *   <div>
 *     <h1>{profile?.name}</h1>
 *     <button onClick={() => updateProfile({ name: "New Name" })}>Edit</button>
 *   </div>
 * );
 * ```
 */
export const useProfile = (): UseProfileReturn => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Effect: Fetch user profile on mount or when user ID changes.
   *
   * Fetches profile document from /users/{uid} Firestore collection.
   * Sets loading to false regardless of success/failure.
   *
   * Dependencies: user?.uid (re-fetches when user logs in/out)
   */
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.uid) return;

      const data = await getUserProfile(user.uid);
      setProfile(data);
      setLoading(false);
    };

    fetchProfile();
  }, [user?.uid]);

  /**
   * Updates user profile in Firestore and optimistically updates local state.
   *
   * Steps:
   * 1. Validate user exists
   * 2. Optimistically update local state (immediate UI feedback)
   * 3. Call updateUserProfile service (Firestore write)
   * 4. On error: no rollback (profile would be out of sync)
   *
   * Note: Does not handle loading or error states during update.
   * Parent component should manage its own loading indicator.
   *
   * @param data - Partial profile data to update (fields to change)
   */
  const updateProfile = async (data: any) => {
    if (!user?.uid) return;
    await updateUserProfile(user.uid, data);
    setProfile((prev: any) => ({ ...prev, ...data }));
  };

  return { profile, loading, updateProfile };
};