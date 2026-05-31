/**
 * @fileoverview Admin user management page with search, filtering, and real-time user data.
 *
 * Responsibilities:
 * - Display all users in a sortable, searchable, filterable table
 * - Provide statistics cards for quick filtering (All, Active, Suspended, Banned, Admins)
 * - Support search by name, email, or UID
 * - Support role filtering (All, User, Admin)
 * - Support status filtering (All, Active, Suspended, Banned)
 * - Debounce search/filter inputs with useTransition for UI responsiveness
 * - Show real-time user data via useUsers hook (Firestore onSnapshot)
 *
 * Related modules:
 * - useUsers (src/features/users/hooks/useUsers.ts) - Provides real-time user data
 * - UserTable (src/features/users/components/UserTable.tsx) - Displays sortable user table
 *
 * Architectural role:
 * - **Admin user management dashboard** (mounted in AdminPage under "Users" tab)
 * - Requires isActiveAdmin() per Firestore security rules
 * - Real-time updates ensure multiple admins see changes immediately
 *
 * Security boundary (from Firestore security rules):
 * - Only active admin users (isActiveAdmin()) can access user management features
 * - Read access to users collection granted to admins only
 * - Role/status updates require isActiveAdmin()
 *
 * Filtering strategy:
 * - Immediate UI state (search, filterRole, filterStatus) updates input values
 * - Deferred state (deferredSearch, deferredRole, deferredStatus) triggers filtering
 * - useTransition prevents UI blocking during filter recalculation
 * - During transition, table shows opacity overlay (isPending)
 *
 * Statistics cards:
 * - Clicking a card sets the corresponding filter
 * - Active card highlighted with border and glow in brand color
 * - Counts update in real-time as users are added/modified
 *
 * Search behavior:
 * - Searches across name (case-insensitive), email (case-insensitive), and UID
 * - Debounced via useTransition (avoids filtering on every keystroke)
 * - Clear button resets search
 *
 * Filter chips:
 * - Role dropdown: All Roles / Users / Admins
 * - Status dropdown: All Status / Active / Suspended / Banned
 * - "Clear" button appears when any filter is active (resets all)
 *
 * Performance:
 * - useMemo for summary statistics (recalculates only when users change)
 * - useMemo for filtered users (recalculates when deferred filters change)
 * - useCallback for event handlers (stable references)
 *
 * @module features/users/pages
 */

import { useMemo, useState, useCallback, useTransition } from "react";
import { useUsers } from "../hooks/useUsers";
import { IUser } from "../types";
import UserTable from "../components/UserTable";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";

/**
 * Filter options for user role.
 *
 * - all: No role filter (show all roles)
 * - user: Show only regular users
 * - admin: Show only admin users
 */
type FilterRole = "all" | "user" | "admin";

/**
 * Filter options for user status.
 *
 * - all: No status filter (show all statuses)
 * - active: Show only active users (full access)
 * - suspended: Show only suspended users (read-only)
 * - banned: Show only banned users (no access)
 */
type FilterStatus = "all" | "active" | "suspended" | "banned";

/**
 * UserManagementPage - Admin dashboard for user management.
 *
 * Features:
 * - Real-time user list with Firestore subscription
 * - Statistics cards with quick filters
 * - Search by name, email, UID
 * - Role and status dropdown filters
 * - Sortable table with row selection
 * - User details modal with admin actions
 *
 * @returns User management page JSX
 */
const UserManagementPage = () => {
  const { users, loading } = useUsers();

  // --- Immediate UI state (updates instantly) ---
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<FilterRole>("all");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");

  // --- Deferred state for filtering (updates via startTransition) ---
  const [isPending, startTransition] = useTransition();
  const [deferredSearch, setDeferredSearch] = useState("");
  const [deferredRole, setDeferredRole] = useState<FilterRole>("all");
  const [deferredStatus, setDeferredStatus] = useState<FilterStatus>("all");

  /**
   * Handles search input with transition debouncing.
   *
   * Updates immediate search state (input value) immediately.
   * Defers filtering via startTransition to keep UI responsive.
   *
   * @param value - Search query string
   */
  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    startTransition(() => setDeferredSearch(value));
  }, []);

  /**
   * Handles role filter change with transition debouncing.
   *
   * @param value - Role filter value
   */
  const handleRoleChange = useCallback((value: FilterRole) => {
    setFilterRole(value);
    startTransition(() => setDeferredRole(value));
  }, []);

  /**
   * Handles status filter change with transition debouncing.
   *
   * @param value - Status filter value
   */
  const handleStatusChange = useCallback((value: FilterStatus) => {
    setFilterStatus(value);
    startTransition(() => setDeferredStatus(value));
  }, []);

  /**
   * Clears all active filters (search, role, status).
   * Resets both immediate and deferred state.
   */
  const clearFilters = useCallback(() => {
    setSearch("");
    setFilterRole("all");
    setFilterStatus("all");
    startTransition(() => {
      setDeferredSearch("");
      setDeferredRole("all");
      setDeferredStatus("all");
    });
  }, []);

  /**
   * Memoized summary statistics derived from users array.
   *
   * Computations:
   * - total: Number of users in the system
   * - active: Users with status "active" (default if missing)
   * - suspended: Users with status "suspended"
   * - banned: Users with status "banned"
   * - admins: Users with role "admin"
   *
   * Performance: Recalculates only when users array changes.
   */
  const summary = useMemo(
    () => ({
      total: users.length,
      active: users.filter((u) => (u.status ?? "active") === "active").length,
      suspended: users.filter((u) => u.status === "suspended").length,
      banned: users.filter((u) => u.status === "banned").length,
      admins: users.filter((u) => u.role === "admin").length,
    }),
    [users],
  );

  /**
   * Memoized filtered users based on deferred search and filters.
   *
   * Filtering steps:
   * 1. If no search term and role=all and status=all: return all users (skip iteration)
   * 2. Otherwise, iterate through users and apply filters:
   *    - Search: match name, email, or UID (case-insensitive)
   *    - Role: match if role !== "all"
   *    - Status: match if status !== "all" (defaults to "active" if missing)
   *
   * Performance: Recalculates when users, deferredSearch, deferredRole, or deferredStatus changes.
   */
  const filtered = useMemo<IUser[]>(() => {
    // Fast path: no filters active
    if (
      !deferredSearch.trim() &&
      deferredRole === "all" &&
      deferredStatus === "all"
    ) {
      return users;
    }

    const q = deferredSearch.trim().toLowerCase();
    return users.filter((u) => {
      // Search filter (name, email, or UID)
      if (q) {
        const hit =
          (u.name?.toLowerCase().includes(q) ?? false) ||
          (u.email?.toLowerCase().includes(q) ?? false) ||
          u.uid.toLowerCase().includes(q);
        if (!hit) return false;
      }

      // Role filter
      if (deferredRole !== "all" && u.role !== deferredRole) return false;

      // Status filter (default to "active" if status field missing)
      if (deferredStatus !== "all" && (u.status ?? "active") !== deferredStatus)
        return false;

      return true;
    });
  }, [users, deferredSearch, deferredRole, deferredStatus]);

  /**
   * Whether any filters are currently active (for showing "Clear" button).
   */
  const hasActiveFilters =
    search.trim() !== "" || filterRole !== "all" || filterStatus !== "all";

  /**
   * Statistics cards configuration.
   *
   * Each card displays a count and allows quick filtering:
   * - All Users: No filter (shows all)
   * - Active: Filters by status="active"
   * - Suspended: Filters by status="suspended"
   * - Banned: Filters by status="banned"
   * - Admins: Filters by role="admin" (isRole=true)
   */
  const statCards = [
    {
      key: "all",
      label: "All Users",
      value: summary.total,
      accent: "#1d1d1f",
      isRole: false,
    },
    {
      key: "active",
      label: "Active",
      value: summary.active,
      accent: "#34c759",
      isRole: false,
    },
    {
      key: "suspended",
      label: "Suspended",
      value: summary.suspended,
      accent: "#ff9f0a",
      isRole: false,
    },
    {
      key: "banned",
      label: "Banned",
      value: summary.banned,
      accent: "#fa243c",
      isRole: false,
    },
    {
      key: "admin",
      label: "Admins",
      value: summary.admins,
      accent: "#af52de",
      isRole: true,
    },
  ];

  return (
    <div className="flex flex-col gap-7">
      {/* Header section with title and total count */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[clamp(24px,2.8vw,34px)] font-bold text-[#1d1d1f] tracking-[-0.7px] leading-[1.08] mb-1.5">
            User Management
          </h1>
          <p className="text-[15px] text-[#6e6e73] m-0">
            Monitor and control accounts in real‑time
          </p>
        </div>
        <span className="text-[15px] font-medium text-[#6e6e73] whitespace-nowrap pb-[3px]">
          {summary.total} users
        </span>
      </div>

      {/* Statistics cards - click to filter */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
        {statCards.map((card) => {
          // Determine if this card's filter is currently active
          const isActive = card.isRole
            ? filterRole === "admin"
            : filterStatus === card.key;

          return (
            <button
              key={card.key}
              className="bg-white border border-[#e5e5ea] rounded-[18px] p-[20px_18px_18px] flex flex-col items-start gap-1 cursor-pointer font-inherit shadow-[0_1px_4px_rgba(0,0,0,0.04)] transition-all duration-200 hover:shadow-[0_6px_20px_rgba(0,0,0,0.08)] hover:-translate-y-[2px]"
              style={
                isActive
                  ? {
                    borderColor: card.accent,
                    boxShadow: `0 0 0 3px ${card.accent}1e, 0 1px 4px rgba(0,0,0,0.04)`,
                  }
                  : undefined
              }
              onClick={() =>
                card.isRole
                  ? handleRoleChange(filterRole === "admin" ? "all" : "admin")
                  : handleStatusChange(card.key as FilterStatus)
              }
            >
              <span
                className="text-[28px] font-bold tracking-[-1px] leading-none"
                style={{ color: card.accent }}
              >
                {card.value}
              </span>
              <span className="text-[12px] font-medium text-[#6e6e73]">
                {card.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main container - search + filters + table */}
      <div className="bg-white rounded-[18px] border border-[#e5e5ea] shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden">
        {/* Filter bar */}
        <div className="px-5 py-4 border-b border-[#f5f5f7] flex items-center gap-2 flex-wrap">
          {/* Search input */}
          <div className="flex-1 min-w-[200px] relative flex items-center">
            <SearchIcon
              className="absolute left-3 text-[#aeaeb2] pointer-events-none"
              sx={{ fontSize: 14 }}
            />
            <input
              className="w-full py-2.5 pl-9 pr-9 bg-white border border-[#e5e5ea] rounded-lg text-[13px] text-[#1d1d1f] outline-none shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all duration-150 focus:border-[#fa243c] focus:shadow-[0_0_0_3px_rgba(255,55,95,0.1)] placeholder:text-[#aeaeb2]"
              type="text"
              placeholder="Search by name, email or UID…"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
            {/* Clear search button - appears when search has content */}
            {search && (
              <button
                className="absolute right-2 w-5 h-5 bg-[#f5f5f7] rounded-full flex items-center justify-center text-[#aeaeb2] hover:bg-[#e5e5ea] hover:text-[#6e6e73] transition-all"
                onClick={() => handleSearch("")}
                aria-label="Clear search"
              >
                <CloseIcon sx={{ fontSize: 14 }} />
              </button>
            )}
          </div>

          {/* Role filter dropdown */}
          <select
            className="py-2.5 px-3 bg-white border border-[#e5e5ea] rounded-lg text-[13px] text-[#1d1d1f] outline-none cursor-pointer shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all duration-150 focus:border-[#fa243c] focus:shadow-[0_0_0_3px_rgba(255,55,95,0.1)]"
            value={filterRole}
            onChange={(e) => handleRoleChange(e.target.value as FilterRole)}
          >
            <option value="all">All Roles</option>
            <option value="user">Users</option>
            <option value="admin">Admins</option>
          </select>

          {/* Status filter dropdown */}
          <select
            className="py-2.5 px-3 bg-white border border-[#e5e5ea] rounded-lg text-[13px] text-[#1d1d1f] outline-none cursor-pointer shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all duration-150 focus:border-[#fa243c] focus:shadow-[0_0_0_3px_rgba(255,55,95,0.1)]"
            value={filterStatus}
            onChange={(e) => handleStatusChange(e.target.value as FilterStatus)}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="banned">Banned</option>
          </select>

          {/* Clear all filters button - appears only when filters are active */}
          {hasActiveFilters && (
            <button
              className="py-2.5 px-5 rounded-full bg-white border border-[#ffd1d9] text-[#fa243c] text-[13px] font-semibold cursor-pointer whitespace-nowrap transition-all duration-150 hover:bg-[#fff0f3] hover:border-[#fa243c]"
              onClick={clearFilters}
            >
              Clear
            </button>
          )}

          {/* Result count with opacity transition during search/filter */}
          <span
            className="text-[13px] text-[#aeaeb2] ml-auto whitespace-nowrap tabular-nums transition-opacity duration-150"
            style={{ opacity: isPending ? 0.4 : 1 }}
          >
            {filtered.length} of {summary.total}
          </span>
        </div>

        {/* User table with opacity transition during filtering */}
        <div
          className="transition-opacity duration-150"
          style={{ opacity: isPending ? 0.65 : 1 }}
        >
          <UserTable users={filtered} loading={loading} />
        </div>

        {/* Footer summary - only visible when users exist */}
        {!loading && users.length > 0 && (
          <div className="px-5 py-3.5 border-t border-[#f5f5f7] bg-[#fafafa] flex items-center justify-between">
            <p className="text-[12px] text-[#aeaeb2]">
              {filtered.length} {filtered.length === 1 ? "user" : "users"}
              {hasActiveFilters && filtered.length !== summary.total && (
                <span> · filtered from {summary.total} total</span>
              )}
            </p>
            <p className="text-[12px] text-[#aeaeb2]">
              {summary.active} active · {summary.suspended} suspended ·{" "}
              {summary.banned} banned
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagementPage;