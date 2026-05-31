/**
 * @fileoverview Admin panel component for managing home page sections.
 *
 * Responsibilities:
 * - Display all sections with status indicators (Active/Inactive)
 * - Create new sections with title input
 * - Edit existing section titles
 * - Toggle section active status (show/hide on homepage)
 * - Delete sections with confirmation flow
 *
 * Related modules:
 * - useSections (src/features/sections/hooks/useSections.ts) - Fetches sections with real-time updates
 * - section.service (src/features/sections/services/section.service.ts) - Contains CRUD operations
 * - DynamicSection (src/features/sections/components/DynamicSection.tsx) - Renders section on homepage
 *
 * Architectural role:
 * - **Admin-only section management interface** (mounted in AdminPage under "Sections" tab)
 * - Requires isActiveAdmin() per Firestore security rules
 * - Real-time updates ensure multiple admins see changes immediately
 *
 * Firestore data model (from HANDOFF_CORE.md):
 * - Collection: /sections/{sectionId}
 * - Document fields:
 *   - title: string (required)
 *   - isActive: boolean (controls visibility on homepage)
 *   - createdAt: serverTimestamp
 *
 * Security boundary (from Firestore security rules):
 * - Only active admin users (isActiveAdmin()) can create/update/delete sections
 * - Read access granted to all authenticated users (isReadable())
 *
 * Section behavior:
 * - Active sections appear on homepage (DynamicSection renders them)
 * - Inactive sections are hidden from homepage (admin can re-activate)
 * - Deleting a section does NOT delete associated songs (only removes section categorization)
 *
 * Features:
 * - Statistics cards (Total, Active, Inactive)
 * - Create section with enter key support
 * - Inline editing with focus and auto-select
 * - Status toggle with visual feedback
 * - Delete with two-step confirmation
 *
 * @module features/sections/components
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useSections } from "../hooks/useSections";
import {
  createSection,
  deleteSection,
  toggleSectionStatus,
  updateSection,
} from "../services/section.service";
import AddIcon from "@mui/icons-material/Add";

type ToastType = "success" | "error";

/**
 * SectionManager - Admin panel component for managing home page sections.
 *
 * Features:
 * - Create sections with unique titles
 * - Edit section titles inline
 * - Toggle active/inactive status
 * - Delete sections with confirmation
 *
 * @returns Section management interface JSX
 */
export const SectionManager = () => {
  const { sections, loading } = useSections();

  // --- Create section state ---
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  // --- Edit section state ---
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  // --- Action states ---
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // --- UI state ---
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
  } | null>(null);

  // --- Refs for focus management ---
  const newTitleRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  /**
   * Effect: Focus and select input when entering edit mode.
   * Provides better UX by allowing immediate typing without clicking.
   */
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  /**
   * Shows a toast notification that auto-dismisses after 4 seconds.
   */
  const showToast = (message: string, type: ToastType) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  /**
   * Creates a new section.
   * Validates non-empty title before creation.
   */
  const handleCreate = useCallback(async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      await createSection(newTitle.trim());
      setNewTitle("");
      newTitleRef.current?.focus();
    } catch {
      showToast("Failed to create section", "error");
    } finally {
      setCreating(false);
    }
  }, [newTitle]);

  /**
   * Updates section title.
   * Saves when Enter pressed or save button clicked.
   */
  const handleUpdate = useCallback(async () => {
    if (!editingId || !editingTitle.trim()) return;
    setSavingId(editingId);
    try {
      await updateSection(editingId, editingTitle.trim());
      setEditingId(null);
      setEditingTitle("");
    } catch (err) {
      console.error("Update error:", err);
      showToast("Failed to update section", "error");
    } finally {
      setSavingId(null);
    }
  }, [editingId, editingTitle]);

  /**
   * Cancels edit mode without saving changes.
   */
  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingTitle("");
  }, []);

  /**
   * Toggles section active status.
   * Active sections appear on homepage, inactive are hidden.
   */
  const handleToggle = useCallback(async (id: string, current: boolean) => {
    setTogglingId(id);
    try {
      await toggleSectionStatus(id, current);
    } catch (err) {
      console.error("Toggle error:", err);
      showToast("Failed to update status", "error");
    } finally {
      setTogglingId(null);
    }
  }, []);

  /**
   * Deletes a section after confirmation.
   * Does NOT delete associated songs - only removes section categorization.
   */
  const handleDeleteConfirm = useCallback(async (id: string) => {
    setDeletingId(id);
    setConfirmDeleteId(null);
    try {
      await deleteSection(id);
    } catch (err) {
      console.error("Delete error:", err);
      showToast("Failed to delete section", "error");
    } finally {
      setDeletingId(null);
    }
  }, []);

  const openEdit = (id: string, title: string) => {
    setConfirmDeleteId(null);
    setEditingId(id);
    setEditingTitle(title);
  };

  const openConfirm = (id: string) => {
    setEditingId(null);
    setConfirmDeleteId(id);
  };

  const activeCount = sections.filter((s) => s.isActive).length;
  const inactiveCount = sections.length - activeCount;

  // --- Loading state ---
  if (loading) {
    return (
      <div className="bg-white rounded-[18px] border border-[#e5e5ea] shadow-[0_1px_4px_rgba(0,0,0,0.04)] p-8">
        <div className="h-5 w-40 bg-[#f5f5f7] rounded-lg animate-pulse mb-6" />
        <div className="flex gap-2 mb-6">
          <div className="h-10 flex-1 bg-[#f5f5f7] rounded-lg animate-pulse" />
          <div className="h-10 w-20 bg-[#f5f5f7] rounded-lg animate-pulse" />
        </div>
        <div className="flex flex-col gap-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-[60px] bg-[#f5f5f7] rounded-[12px] animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      {/* Header section with count */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[clamp(24px,2.8vw,34px)] font-bold text-[#1d1d1f] tracking-[-0.7px] leading-[1.08] mb-1.5">
            Sections
          </h1>
          <p className="text-[15px] text-[#6e6e73] m-0">
            Organise your music library into sections
          </p>
        </div>
        <span className="text-[15px] font-medium text-[#6e6e73] whitespace-nowrap pb-[3px]">
          {sections.length} {sections.length === 1 ? "section" : "sections"}
        </span>
      </div>

      {/* Statistics cards */}
      <div className="grid grid-cols-3 gap-3.5">
        {[
          { label: "Total", value: sections.length, accent: "#1d1d1f" },
          { label: "Active", value: activeCount, accent: "#34c759" },
          { label: "Inactive", value: inactiveCount, accent: "#aeaeb2" },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-white border border-[#e5e5ea] rounded-[18px] p-[20px_18px_18px] flex flex-col gap-1 shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
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
          </div>
        ))}
      </div>

      {/* Main container */}
      <div className="bg-white rounded-[18px] border border-[#e5e5ea] shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden">
        {/* Toast notification */}
        {toast && (
          <div
            className={`mx-5 mt-5 flex items-center gap-3 px-4 py-3 rounded-[12px] border text-[13px] font-medium ${toast.type === "success"
                ? "bg-[#f0fdf4] border-[#bbf7d0] text-[#166534]"
                : "bg-[#fff0f3] border-[#ffd1d9] text-[#fa243c]"
              }`}
          >
            {toast.type === "error" && (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle
                  cx="7"
                  cy="7"
                  r="5.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
                <path
                  d="M7 4v3.5M7 9.5v.3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            )}
            {toast.message}
          </div>
        )}

        {/* Create section form */}
        <div className="px-5 pt-5 pb-4 border-b border-[#f5f5f7]">
          <label className="block text-[11px] font-semibold text-[#aeaeb2] uppercase tracking-[0.6px] mb-2">
            New Section
          </label>
          <div className="flex gap-2">
            <input
              ref={newTitleRef}
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="e.g. Top Hits, New Releases…"
              className="flex-1 px-4 py-2.5 bg-white border border-[#e5e5ea] rounded-[10px] text-[13px] text-[#1d1d1f] outline-none transition-all placeholder:text-[#aeaeb2] focus:border-[#fa243c] focus:shadow-[0_0_0_3px_rgba(255,55,95,0.1)]"
            />
            <button
              onClick={handleCreate}
              disabled={creating || !newTitle.trim()}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-[980px] bg-[#fa243c] text-white text-[13px] font-semibold border-none cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-[#fa243c] whitespace-nowrap"
            >
              {creating ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <AddIcon sx={{ fontSize: 15 }} />
                  Add
                </>
              )}
            </button>
          </div>
        </div>

        {/* Sections list */}
        <div className="p-5">
          {sections.length === 0 ? (
            // Empty state
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                <circle
                  cx="22"
                  cy="22"
                  r="20"
                  stroke="#e5e5ea"
                  strokeWidth="1.5"
                />
                <path
                  d="M12 28V20l10-3 10 3v8"
                  stroke="#d1d1d6"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <rect
                  x="15"
                  y="20"
                  width="14"
                  height="8"
                  rx="2"
                  stroke="#d1d1d6"
                  strokeWidth="1.4"
                />
              </svg>
              <div className="text-center">
                <p className="text-[14px] text-[#6e6e73]">No sections yet</p>
                <p className="text-[12px] text-[#aeaeb2] mt-1">
                  Create your first section above
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {sections.map((section) => (
                <div
                  key={section.id}
                  className="group bg-[#fafafa] border border-[#f5f5f7] rounded-[12px] overflow-hidden transition-all hover:border-[#e5e5ea]"
                >
                  {editingId === section.id ? (
                    // Edit mode
                    <div className="px-4 py-3 flex items-center gap-2">
                      <input
                        ref={editInputRef}
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleUpdate();
                          if (e.key === "Escape") cancelEdit();
                        }}
                        className="flex-1 px-3 py-2 bg-white border border-[#e5e5ea] rounded-[8px] text-[13px] text-[#1d1d1f] outline-none transition-all focus:border-[#fa243c] focus:shadow-[0_0_0_3px_rgba(255,55,95,0.1)]"
                      />
                      <button
                        onClick={handleUpdate}
                        disabled={
                          savingId === section.id || !editingTitle.trim()
                        }
                        className="w-8 h-8 rounded-full bg-[#fa243c] flex items-center justify-center text-white border-none cursor-pointer transition-all disabled:opacity-40 hover:enabled:bg-[#fa243c]"
                        title="Save"
                      >
                        {savingId === section.id ? (
                          <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <svg
                            width="11"
                            height="11"
                            viewBox="0 0 11 11"
                            fill="none"
                          >
                            <path
                              d="M2 5.5l2.5 2.5L9 3"
                              stroke="currentColor"
                              strokeWidth="1.6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="w-8 h-8 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] flex items-center justify-center text-[#aeaeb2] cursor-pointer transition-all hover:bg-[#e5e5ea] hover:text-[#6e6e73]"
                        title="Cancel"
                      >
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 11 11"
                          fill="none"
                        >
                          <path
                            d="M2 2l7 7M9 2L2 9"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    // Normal display mode
                    <div className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Status indicator dot */}
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0 transition-colors"
                          style={{
                            background: section.isActive
                              ? "#34c759"
                              : "#d1d1d6",
                          }}
                        />
                        <span className="text-[13px] font-semibold text-[#1d1d1f] truncate">
                          {section.title}
                        </span>

                        {/* Status badge */}
                        <span
                          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-[980px] border flex-shrink-0 ${section.isActive
                              ? "bg-[#f0fdf4] border-[#bbf7d0] text-[#166534]"
                              : "bg-[#f5f5f7] border-[#e5e5ea] text-[#aeaeb2]"
                            }`}
                        >
                          {section.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>

                      {/* Action buttons (visible on hover) */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        {/* Edit button */}
                        <button
                          onClick={() => openEdit(section.id, section.title)}
                          className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[#aeaeb2] hover:text-[#1d1d1f] hover:bg-white border border-transparent hover:border-[#e5e5ea] transition-all"
                          title="Edit"
                        >
                          <svg
                            width="13"
                            height="13"
                            viewBox="0 0 13 13"
                            fill="none"
                          >
                            <path
                              d="M9.5 1.5l2 2-8 8H1.5v-2l8-8z"
                              stroke="currentColor"
                              strokeWidth="1.3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>

                        {/* Toggle active/inactive button */}
                        <button
                          onClick={() =>
                            handleToggle(section.id, section.isActive)
                          }
                          disabled={togglingId === section.id}
                          className={`w-[30px] h-[30px] rounded-full flex items-center justify-center border border-transparent transition-all disabled:cursor-not-allowed ${section.isActive
                              ? "text-[#34c759] hover:bg-[#f0fdf4] hover:border-[#bbf7d0]"
                              : "text-[#aeaeb2] hover:bg-white hover:border-[#e5e5ea]"
                            }`}
                          title={section.isActive ? "Deactivate" : "Activate"}
                        >
                          {togglingId === section.id ? (
                            <span className="w-3.5 h-3.5 border-2 border-[#d1d1d6] border-t-[#6e6e73] rounded-full animate-spin" />
                          ) : section.isActive ? (
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 14 14"
                              fill="none"
                            >
                              <path
                                d="M7 2a5 5 0 1 0 0 10A5 5 0 0 0 7 2z"
                                stroke="currentColor"
                                strokeWidth="1.3"
                              />
                              <path
                                d="M5 7l1.5 1.5L9 5"
                                stroke="currentColor"
                                strokeWidth="1.3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          ) : (
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 14 14"
                              fill="none"
                            >
                              <path
                                d="M7 2a5 5 0 1 0 0 10A5 5 0 0 0 7 2z"
                                stroke="currentColor"
                                strokeWidth="1.3"
                              />
                              <path
                                d="M5 5l4 4M9 5l-4 4"
                                stroke="currentColor"
                                strokeWidth="1.3"
                                strokeLinecap="round"
                              />
                            </svg>
                          )}
                        </button>

                        {/* Delete button with confirmation */}
                        {confirmDeleteId === section.id ? (
                          <div className="flex items-center gap-1.5 bg-[#fff0f3] border border-[#ffd1d9] rounded-[980px] px-2 py-1 ml-1">
                            <span className="text-[11px] font-medium text-[#fa243c] whitespace-nowrap">
                              Delete?
                            </span>
                            <button
                              onClick={() => handleDeleteConfirm(section.id)}
                              disabled={deletingId === section.id}
                              className="text-[11px] font-semibold text-white bg-[#fa243c] rounded-[980px] px-2 py-0.5 hover:bg-[#fa243c] transition-all disabled:opacity-50 border-none cursor-pointer"
                            >
                              {deletingId === section.id ? "…" : "Yes"}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-[11px] font-semibold text-[#6e6e73] hover:text-[#1d1d1f] transition-colors bg-none border-none cursor-pointer"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => openConfirm(section.id)}
                            disabled={deletingId === section.id}
                            className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[#aeaeb2] hover:text-[#fa243c] hover:bg-[#fff0f3] border border-transparent hover:border-[#ffd1d9] transition-all disabled:cursor-not-allowed"
                            title="Delete"
                          >
                            {deletingId === section.id ? (
                              <span className="w-3.5 h-3.5 border-2 border-[#ffd1d9] border-t-[#fa243c] rounded-full animate-spin" />
                            ) : (
                              <svg
                                width="13"
                                height="13"
                                viewBox="0 0 13 13"
                                fill="none"
                              >
                                <path
                                  d="M2 3.5h9M5 3.5V2h3v1.5M4.5 3.5v7h4v-7"
                                  stroke="currentColor"
                                  strokeWidth="1.3"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer with summary stats */}
        {sections.length > 0 && (
          <div className="px-5 py-3.5 border-t border-[#f5f5f7] bg-[#fafafa] flex items-center justify-between">
            <p className="text-[12px] text-[#aeaeb2]">
              {sections.length} {sections.length === 1 ? "section" : "sections"}
            </p>
            <p className="text-[12px] text-[#aeaeb2]">
              {activeCount} active · {inactiveCount} inactive
            </p>
          </div>
        )}
      </div>
    </div>
  );
};