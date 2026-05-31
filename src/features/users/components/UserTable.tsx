/**
 * @fileoverview Sortable table component for displaying users with admin management capabilities.
 *
 * Responsibilities:
 * - Display users in a sortable table (name, role, status, joined date)
 * - Provide sort indicators and toggle between asc/desc
 * - Handle row selection to open UserDetailsModal
 * - Show loading and empty states
 *
 * Related modules:
 * - UserRow (src/features/users/components/UserRow.tsx) - Individual user row component
 * - UserDetailsModal (src/features/users/components/UserDetailsModal.tsx) - Detail view for selected user
 * - UserManagementPage (src/features/users/pages/UserManagementPage.tsx) - Provides users data via props
 *
 * Architectural role:
 * - **User list display component** for admin user management
 * - Renders sortable table with filtering/sorting applied from parent
 * - Manages selected user state for detail modal
 *
 * Sortable columns:
 * - User (name): Alphabetical sort
 * - Role: "admin" / "user" sort
 * - Status: "active" / "suspended" / "banned" sort
 * - Joined (createdAt): Chronological sort by timestamp
 *
 * Sorting logic:
 * - Default sort: createdAt descending (newest first)
 * - Click column header: set sortKey to that column, default to asc
 * - Click same column again: toggle sort direction (asc ↔ desc)
 * - SortIcon shows up/down arrow when active, neutral icon when inactive
 *
 * Date sorting:
 * - Converts Firestore Timestamp to milliseconds using .toDate().getTime()
 * - Falls back to 0 for null/undefined timestamps
 *
 * Selection behavior:
 * - Clicking any row calls onSelect with that user
 * - Selected user stored in local state (selectedUser)
 * - isSelected prop passed to UserRow for highlighting
 * - UserDetailsModal opened when selectedUser !== null
 *
 * Empty states:
 * - loading=true: Shows centered spinner
 * - users.length === 0: Shows empty state illustration with message
 *
 * @module features/users/components
 */

import { useState } from "react";
import { IUser } from "../types";
import UserRow from "./UserRow";
import UserDetailsModal from "./UserDetailsModal";
import PersonIcon from "@mui/icons-material/Person";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";

/**
 * Props for the UserTable component.
 *
 * @property users - Array of users to display (pre-filtered and sorted from parent)
 * @property loading - Whether users are currently being fetched
 */
interface Props {
  users: IUser[];
  loading: boolean;
}

/**
 * Sortable column keys.
 *
 * - name: User's display name (alphabetical)
 * - role: User role ("admin" or "user")
 * - status: User status ("active", "suspended", "banned")
 * - createdAt: Join date (chronological)
 */
type SortKey = "name" | "role" | "status" | "createdAt";

/**
 * Sort direction.
 *
 * - asc: Ascending (A-Z, 0-9, oldest first)
 * - desc: Descending (Z-A, 9-0, newest first)
 */
type SortDir = "asc" | "desc";

/**
 * UserTable - Sortable table for displaying users.
 *
 * @param props - Component props
 * @returns User table JSX
 */
const UserTable = ({ users, loading }: Props) => {
  /**
   * Currently selected user (opens details modal)
   * null when modal is closed
   */
  const [selectedUser, setSelectedUser] = useState<IUser | null>(null);

  /**
   * Current sort column.
   * Default: "createdAt" (join date)
   */
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");

  /**
   * Current sort direction.
   * Default: "desc" (newest first)
   */
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  /**
   * Handles column header click to update sort.
   *
   * Logic:
   * - If same column clicked: toggle direction (asc ↔ desc)
   * - If different column: set new column, default to asc
   *
   * @param key - Column key to sort by
   */
  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  /**
   * Sorted users array based on current sortKey and sortDir.
   *
   * Sorting logic by column type:
   * - createdAt: Compares milliseconds from Firestore Timestamp
   * - Others: String comparison (case-insensitive)
   *
   * Note: This sorts a copy of the users array (does not mutate original props)
   */
  const sorted = [...users].sort((a, b) => {
    let av: any, bv: any;

    // Timestamp comparison for createdAt column
    if (sortKey === "createdAt") {
      av = a.createdAt?.toDate?.()?.getTime() ?? 0;
      bv = b.createdAt?.toDate?.()?.getTime() ?? 0;
    } else {
      // String comparison for name, role, status
      av = (a[sortKey] ?? "").toString().toLowerCase();
      bv = (b[sortKey] ?? "").toString().toLowerCase();
    }

    // Compare values based on sort direction
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  /**
   * SortIcon component - Visual indicator for sortable column headers.
   *
   * States:
   * - Inactive (not current sort column): Neutral gray icon
   * - Active + asc: Up arrow (brand red)
   * - Active + desc: Down arrow (brand red)
   *
   * @param col - Column key this icon belongs to
   * @returns MUI icon component
   */
  const SortIcon = ({ col }: { col: SortKey }) => {
    const active = sortKey === col;
    if (!active) return <PersonIcon sx={{ fontSize: 11, color: "#d1d1d6" }} />;

    return sortDir === "asc" ? (
      <ArrowUpwardIcon sx={{ fontSize: 11, color: "#fa243c" }} />
    ) : (
      <ArrowDownwardIcon sx={{ fontSize: 11, color: "#fa243c" }} />
    );
  };

  return (
    <>
      <div className="bg-white border border-[#e5e5ea] rounded-2xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)] font-[-apple-system,'DM_Sans',sans-serif]">
        {/* Loading state */}
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3.5 py-[72px] px-6">
            <div className="w-6 h-6 border-2 border-[#f5f5f7] border-t-[#fa243c] rounded-full animate-spin" />
            <span className="text-sm text-[#aeaeb2]">Loading users…</span>
          </div>
        ) : users.length === 0 ? (
          /* Empty state - no users match current filters */
          <div className="flex flex-col items-center justify-center gap-3.5 py-[72px] px-6">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <circle
                cx="20"
                cy="20"
                r="18"
                stroke="#e5e5ea"
                strokeWidth="1.5"
              />
              <circle
                cx="20"
                cy="15"
                r="5.5"
                stroke="#d1d1d6"
                strokeWidth="1.3"
              />
              <path
                d="M7 34c0-7.18 5.82-10 13-10s13 2.82 13 10"
                stroke="#d1d1d6"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
            <span className="text-sm text-[#aeaeb2]">No users found</span>
          </div>
        ) : (
          /* Table with horizontal scroll on small screens */
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[620px]">
              <thead>
                <tr className="border-b border-[#f5f5f7] bg-[#fafafa]">
                  {/* Column 1: User (name) - sortable */}
                  <th className="py-3 px-4 text-[11px] font-semibold text-[#aeaeb2] uppercase tracking-[0.6px] text-left whitespace-nowrap min-w-[220px]">
                    <button
                      className="inline-flex items-center gap-1 bg-none border-none text-inherit font-inherit text-[11px] font-semibold uppercase tracking-[0.6px] cursor-pointer p-0 whitespace-nowrap transition-colors duration-150 hover:text-[#6e6e73]"
                      onClick={() => handleSort("name")}
                    >
                      User <SortIcon col="name" />
                    </button>
                  </th>

                  {/* Column 2: Role - sortable */}
                  <th className="py-3 px-4 text-[11px] font-semibold text-[#aeaeb2] uppercase tracking-[0.6px] text-left whitespace-nowrap">
                    <button
                      className="inline-flex items-center gap-1 bg-none border-none text-inherit font-inherit text-[11px] font-semibold uppercase tracking-[0.6px] cursor-pointer p-0 whitespace-nowrap transition-colors duration-150 hover:text-[#6e6e73]"
                      onClick={() => handleSort("role")}
                    >
                      Role <SortIcon col="role" />
                    </button>
                  </th>

                  {/* Column 3: Status - sortable */}
                  <th className="py-3 px-4 text-[11px] font-semibold text-[#aeaeb2] uppercase tracking-[0.6px] text-left whitespace-nowrap">
                    <button
                      className="inline-flex items-center gap-1 bg-none border-none text-inherit font-inherit text-[11px] font-semibold uppercase tracking-[0.6px] cursor-pointer p-0 whitespace-nowrap transition-colors duration-150 hover:text-[#6e6e73]"
                      onClick={() => handleSort("status")}
                    >
                      Status <SortIcon col="status" />
                    </button>
                  </th>

                  {/* Column 4: Joined (createdAt) - sortable */}
                  <th className="py-3 px-4 text-[11px] font-semibold text-[#aeaeb2] uppercase tracking-[0.6px] text-left whitespace-nowrap">
                    <button
                      className="inline-flex items-center gap-1 bg-none border-none text-inherit font-inherit text-[11px] font-semibold uppercase tracking-[0.6px] cursor-pointer p-0 whitespace-nowrap transition-colors duration-150 hover:text-[#6e6e73]"
                      onClick={() => handleSort("createdAt")}
                    >
                      Joined <SortIcon col="createdAt" />
                    </button>
                  </th>

                  {/* Column 5: Last Login - not sortable (visual only) */}
                  <th className="py-3 px-4 text-[11px] font-semibold text-[#c7c7cc] uppercase tracking-[0.6px] text-left whitespace-nowrap">
                    Last Login
                  </th>

                  {/* Column 6: Actions spacer column */}
                  <th className="py-3 px-4 w-8" />
                </tr>
              </thead>
              <tbody>
                {/* Render sorted user rows */}
                {sorted.map((user) => (
                  <UserRow
                    key={user.uid}
                    user={user}
                    onSelect={setSelectedUser}
                    isSelected={selectedUser?.uid === user.uid}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* User details modal - slides in from right when selectedUser is not null */}
      <UserDetailsModal
        user={selectedUser}
        onClose={() => setSelectedUser(null)}
      />
    </>
  );
};

export default UserTable;