/**
 * @fileoverview Account information card component for profile page.
 *
 * Responsibilities:
 * - Display user account details in a structured, readable format
 * - Show display name, email, account type (role), user ID, and member since date
 * - Format timestamps to readable date strings
 * - Provide responsive layout (mobile: label beside icon, desktop: stacked label above value)
 *
 * Related modules:
 * - ProfilePage (src/features/profile/ProfilePage.tsx) - Uses this component below the header
 * - useProfile (src/features/profile/hooks/useProfile.ts) - Provides profile data
 *
 * Architectural role:
 * - **Information display component** for user account metadata
 * - Read-only view (no edit functionality here - handled by EditProfileModal)
 * - Consistent styling with other profile sections (playlists, listening history)
 *
 * Security boundary:
 * - Shows user's own data only (profile data is user-specific)
 * - No sensitive information displayed (UID is shown but not sensitive)
 *
 * Displayed fields:
 * - Display Name: From profile.name or profile.displayName
 * - Email Address: From profile.email
 * - Account Type: User role ("user" or "admin") - capitalized for display
 * - User ID: Firebase UID (monospace font, subtle background)
 * - Member Since: Formatted creation date (if available)
 *
 * Responsive behavior:
 * - Mobile (< 640px): Icon + label inline, value on next line
 * - Desktop (≥ 640px): Label above value, icon left-aligned
 *
 * Date formatting:
 * - Uses toLocaleDateString with options: month "long", day "numeric", year "numeric"
 * - Example: "January 15, 2024"
 * - Falls back to "N/A" if timestamp not provided
 *
 * @module features/profile/components
 */

import PersonIcon from "@mui/icons-material/Person";
import EmailIcon from "@mui/icons-material/Email";
import BadgeIcon from "@mui/icons-material/Badge";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";

/**
 * Props for the ProfileInfo component.
 *
 * @property profile - User profile data from useProfile hook (can be any shape with expected fields)
 */
interface Props {
  profile: any;
}

/**
 * ProfileInfo - Account information card component.
 *
 * Layout structure:
 * ```
 * Card Container
 * ├── Header: "Account Information"
 * └── List of fields (divide-y separator)
 *     ├── Display Name
 *     ├── Email Address
 *     ├── Account Type
 *     ├── User ID (monospace, with background)
 *     └── Member Since (conditional, if createdAt exists)
 * ```
 *
 * @param props - Component props
 * @returns Account information card JSX
 */
const ProfileInfo = ({ profile }: Props) => {
  /**
   * Formats Firestore timestamp or date string to localized date.
   *
   * Handles multiple input types:
   * - Firestore Timestamp with toDate() method
   * - JavaScript Date object
   * - ISO string
   * - Null/undefined
   *
   * Format: "MMMM D, YYYY" (e.g., "January 15, 2024")
   *
   * @param timestamp - Firestore Timestamp, Date object, or date string
   * @returns Formatted date string or "N/A" if invalid/missing
   */
  const formatDate = (timestamp?: any) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="mt-6 sm:mt-8 space-y-4 sm:space-y-6">
      <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-200 overflow-hidden">
        {/* Card header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-sm sm:text-base font-semibold text-gray-900">
            Account Information
          </h3>
        </div>

        {/* Fields list with divider between rows */}
        <div className="divide-y divide-gray-100">
          {/* Display Name field */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 sm:p-5">
            <div className="flex items-center gap-3 sm:w-48">
              <div className="w-8 h-8 bg-gray-50 rounded-full flex items-center justify-center flex-shrink-0">
                <PersonIcon className="text-gray-500" fontSize="small" />
              </div>
              <p className="text-xs text-gray-500 sm:hidden">Display Name</p>
            </div>
            <div className="flex-1">
              <p className="hidden sm:block text-xs text-gray-500 mb-1">
                Display Name
              </p>
              <p className="text-sm font-medium text-gray-900 break-all">
                {profile?.name || profile?.displayName || "Not set"}
              </p>
            </div>
          </div>

          {/* Email Address field */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 sm:p-5">
            <div className="flex items-center gap-3 sm:w-48">
              <div className="w-8 h-8 bg-gray-50 rounded-full flex items-center justify-center flex-shrink-0">
                <EmailIcon className="text-gray-500" fontSize="small" />
              </div>
              <p className="text-xs text-gray-500 sm:hidden">Email Address</p>
            </div>
            <div className="flex-1">
              <p className="hidden sm:block text-xs text-gray-500 mb-1">
                Email Address
              </p>
              <p className="text-sm text-gray-900 break-all">
                {profile?.email || "Not provided"}
              </p>
            </div>
          </div>

          {/* Account Type (role) field */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 sm:p-5">
            <div className="flex items-center gap-3 sm:w-48">
              <div className="w-8 h-8 bg-gray-50 rounded-full flex items-center justify-center flex-shrink-0">
                <BadgeIcon className="text-gray-500" fontSize="small" />
              </div>
              <p className="text-xs text-gray-500 sm:hidden">Account Type</p>
            </div>
            <div className="flex-1">
              <p className="hidden sm:block text-xs text-gray-500 mb-1">
                Account Type
              </p>
              <p className="text-sm font-medium text-gray-900 capitalize">
                {profile?.role || "User"}
              </p>
            </div>
          </div>

          {/* User ID (UID) field - monospace for readability */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 sm:p-5">
            <div className="flex items-center gap-3 sm:w-48">
              <div className="w-8 h-8 bg-gray-50 rounded-full flex items-center justify-center flex-shrink-0">
                <VpnKeyIcon className="text-gray-500" fontSize="small" />
              </div>
              <p className="text-xs text-gray-500 sm:hidden">User ID</p>
            </div>
            <div className="flex-1">
              <p className="hidden sm:block text-xs text-gray-500 mb-1">
                User ID
              </p>
              <p className="text-xs font-mono text-gray-500 break-all bg-gray-50 p-2 sm:p-3 rounded-lg">
                {profile?.uid || "N/A"}
              </p>
            </div>
          </div>

          {/* Member Since date - only shown if createdAt exists */}
          {profile?.createdAt && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 sm:p-5">
              <div className="flex items-center gap-3 sm:w-48">
                <div className="w-8 h-8 bg-gray-50 rounded-full flex items-center justify-center flex-shrink-0">
                  <CalendarTodayIcon
                    className="text-gray-500"
                    fontSize="small"
                  />
                </div>
                <p className="text-xs text-gray-500 sm:hidden">Member Since</p>
              </div>
              <div className="flex-1">
                <p className="hidden sm:block text-xs text-gray-500 mb-1">
                  Member Since
                </p>
                <p className="text-sm text-gray-900">
                  {formatDate(profile?.createdAt)}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileInfo;