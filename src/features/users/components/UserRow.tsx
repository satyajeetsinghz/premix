/**
 * @fileoverview Table row component for displaying a single user in the user management table.
 *
 * Responsibilities:
 * - Display user avatar, name, email, role badge, status badge, join date, last login date
 * - Show visual indicator when row is selected (background highlight + rotated chevron)
 * - Handle row click to select user (opens UserDetailsModal in parent)
 * - Format dates for consistent display across rows
 *
 * Related modules:
 * - UserTable (src/features/users/components/UserTable.tsx) - Renders multiple UserRow components
 * - UserManagementPage (src/features/users/pages/UserManagementPage.tsx) - Manages selected user state
 *
 * Architectural role:
 * - **User list row component** for admin user management table
 * - Rendered within UserTable component
 * - Clicking row triggers onSelect callback, opening UserDetailsModal
 *
 * Visual design:
 * - Avatar: 36x36px circle with photoURL or colored fallback with initial
 * - Status dot: Colored dot overlaying bottom-right of avatar (green/orange/red)
 * - Role badge: Colored rounded pill (purple for Admin, gray for User)
 * - Status badge: Colored rounded pill with dot indicator
 * - Chevron icon: Rotates 90deg when selected (transitions smoothly)
 *
 * Status configurations (from HANDOFF_CORE.md):
 * - active: Green badge with green dot
 * - suspended: Orange badge with orange dot
 * - banned: Red badge with red dot
 *
 * Role configurations:
 * - admin: Purple badge
 * - user: Gray badge
 *
 * Date formatting:
 * - Uses formatDate with "MMM DD, YYYY" format (e.g., "Jan 15, 2024")
 * - Handles Firestore Timestamp, Date object, or ISO string
 * - Falls back to "—" if invalid
 *
 * Selection behavior:
 * - isSelected = true → row background becomes light pink (#fff0f3)
 * - Chevron rotates 90deg and becomes brand red
 * - Clicking row calls onSelect with user object
 *
 * @module features/users/components
 */

import { IUser } from "../types";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

/**
 * Props for the UserRow component.
 *
 * @property user - User object to display
 * @property onSelect - Callback when row is clicked (opens user details modal)
 * @property isSelected - Whether this user is currently selected (highlights row)
 */
interface Props {
  user: IUser;
  onSelect: (user: IUser) => void;
  isSelected: boolean;
}

/**
 * Status badge styling configuration.
 * Matches user.status values from HANDOFF_CORE.md.
 *
 * - active: Full access (read + write) - green
 * - suspended: Read-only access - orange
 * - banned: No access - red
 */
const statusConfig = {
  active: {
    label: "Active",
    color: "#34c759",
    bg: "#f0fdf4",
    border: "#bbf7d0",
  },
  suspended: {
    label: "Suspended",
    color: "#ff9f0a",
    bg: "#fffbeb",
    border: "#fed7aa",
  },
  banned: {
    label: "Banned",
    color: "#fa243c",
    bg: "#fff0f3",
    border: "#ffd1d9",
  },
};

/**
 * Role badge styling configuration.
 *
 * - admin: Purple (matches admin panel theme)
 * - user: Gray (neutral)
 */
const roleConfig = {
  admin: { label: "Admin", color: "#af52de", bg: "#faf5ff", border: "#e9d5ff" },
  user: { label: "User", color: "#6e6e73", bg: "#f5f5f7", border: "#e5e5ea" },
};

/**
 * Formats Firestore timestamp or date string to localized short date.
 *
 * Handles multiple input types:
 * - Firestore Timestamp with .toDate() method
 * - JavaScript Date object
 * - ISO string
 * - Null/undefined
 *
 * Format: "MMM DD, YYYY" (e.g., "Jan 15, 2024")
 *
 * @param ts - Timestamp, Date, or date string
 * @returns Formatted date string or "—" if invalid
 */
const formatDate = (ts: any): string => {
  if (!ts) return "—";
  try {
    const date = ts?.toDate?.() ?? new Date(ts);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  } catch {
    return "—";
  }
};

/**
 * UserRow - Table row component for displaying a single user.
 *
 * @param props - Component props
 * @returns Table row JSX
 */
const UserRow = ({ user, onSelect, isSelected }: Props) => {
  const status = statusConfig[user.status ?? "active"];
  const role = roleConfig[user.role ?? "user"];

  return (
    <tr
      className={`border-b border-[#f5f5f7] last:border-none cursor-pointer transition-colors duration-100 hover:bg-[#fafafa] ${isSelected ? "bg-[#fff0f3]" : ""
        }`}
      onClick={() => onSelect(user)}
    >
      {/* Column 1: User info (avatar + name + email) */}
      <td className="py-3 px-4 align-middle whitespace-nowrap">
        <div className="flex items-center gap-3">
          {/* Avatar with status dot overlay */}
          <div className="relative shrink-0">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.name}
                className="w-9 h-9 rounded-full object-cover block"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-[#fff0f3] border border-[#ffd1d9] flex items-center justify-center text-sm font-bold text-[#fa243c]">
                {(user.name || user.email || "?")[0].toUpperCase()}
              </div>
            )}
            {/* Status indicator dot (bottom-right of avatar) */}
            <span
              className="absolute bottom-0 right-0 w-2 h-2 rounded-full border-2 border-white"
              style={{ background: status.color }}
            />
          </div>
          {/* Name and email */}
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[13px] font-semibold text-[#1d1d1f] tracking-[-0.1px] truncate max-w-[180px]">
              {user.name || "Unnamed User"}
            </span>
            <span className="text-[11.5px] text-[#aeaeb2] truncate max-w-[180px]">
              {user.email}
            </span>
          </div>
        </div>
      </td>

      {/* Column 2: Role badge */}
      <td className="py-3 px-4 align-middle whitespace-nowrap">
        <span
          className="inline-flex items-center px-2.5 py-1 rounded-full text-[11.5px] font-semibold border whitespace-nowrap"
          style={{
            color: role.color,
            background: role.bg,
            borderColor: role.border,
          }}
        >
          {role.label}
        </span>
      </td>

      {/* Column 3: Status badge with dot indicator */}
      <td className="py-3 px-4 align-middle whitespace-nowrap">
        <span
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11.5px] font-semibold border whitespace-nowrap"
          style={{
            color: status.color,
            background: status.bg,
            borderColor: status.border,
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: status.color }}
          />
          {status.label}
        </span>
      </td>

      {/* Column 4: Join date (createdAt) */}
      <td className="py-3 px-4 align-middle whitespace-nowrap text-[13px] text-[#6e6e73] tabular-nums">
        {formatDate(user.createdAt)}
      </td>

      {/* Column 5: Last login date (lastLoginAt) */}
      <td className="py-3 px-4 align-middle whitespace-nowrap text-[13px] text-[#aeaeb2] tabular-nums">
        {formatDate(user.lastLoginAt)}
      </td>

      {/* Column 6: Chevron indicator (rotates when selected) */}
      <td className="py-3 px-4 align-middle whitespace-nowrap w-8">
        <ChevronRightIcon
          sx={{
            fontSize: 18,
            color: isSelected ? "#fa243c" : "#d1d1d6",
            transform: isSelected ? "rotate(90deg)" : "rotate(0)",
            transition: "transform 0.2s, color 0.15s",
          }}
          className="group-hover:text-[#aeaeb2]"
        />
      </td>
    </tr>
  );
};

export default UserRow;