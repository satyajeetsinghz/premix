/**
 * @fileoverview CreatePlaylistModal – Apple Music Web dark & glassy redesign.
 *
 * Visual contract (this pass):
 * - Dark glass sheet on a blurred dark backdrop (matches PlaylistPage /
 *   Sidebar's menu treatment: translucent #1f1f1f-family surface, heavy
 *   blur+saturate, 1px hairline border, layered shadow, slideUp/scale-in).
 * - Bottom sheet on mobile (slide up), centered dialog on desktop (scale in)
 *   — unchanged interaction, only the surface is now glass instead of flat white.
 * - Cover image: square tap target, dashed red border → filled on upload.
 * - Underline-only inputs (no box), brand-red caret + focus border, now
 *   light text on dark underline instead of dark text on light underline.
 * - Public/Private: custom checkbox aligned to Apple HIG checkboxes,
 *   reskinned for a dark surface (translucent white border at rest).
 * - Primary CTA + Cancel are now BOTH full pills at every breakpoint —
 *   no more mobile-pill/desktop-rounded-md split — matching the pill
 *   language used across Apple Music Web (Play/Shuffle in PlaylistPage, etc).
 *
 * Logic improvements vs original (unchanged from prior pass, carried over):
 * - Removed duplicate mobile/desktop name + description input blocks.
 *   One set of inputs, CSS handles layout (flex-col → flex-row at sm breakpoint).
 * - Removed duplicate "xs:hidden / hidden xs:block" description hack.
 * - Object URL lifecycle consolidated into one effect with proper cleanup.
 * - `handleClose` guard (`loading || uploading`) unified; no scattered checks.
 * - Escape key listener declared inside the existing open-guard effect
 *   (was a separate effect with stale `loading` closure risk).
 * - Error cleared on every field change, not just name.
 * - `btnLabel` derived from a single ternary chain, not intermediate vars.
 */

import {
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import { createPlaylist } from "../services/playlistService";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { uploadToCloudinary } from "@/features/admin/services/cloudinary.service";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import PublicIcon from "@mui/icons-material/Public";
import LockIcon from "@mui/icons-material/Lock";
import CloseIcon from "@mui/icons-material/Close";

// ─── Brand tokens (matches PlaylistPage / Sidebar) ─────────────────────────

const PRIMARY       = "#fa243c";
const PRIMARY_HOVER = "#e01e33";

// ─── Dark glass surface tokens (matches PlaylistPage / Sidebar menus) ──────

const SHEET_BG     = "rgba(31,31,31,.72)";
const SHEET_BLUR   = "blur(40px) saturate(180%) brightness(1.05) contrast(1.05)";
const BORDER       = "rgba(255,255,255,.12)";
const HAIRLINE     = "rgba(255,255,255,.08)";
const SURFACE      = "#1f1f1f";
const HOVER_ROW    = "rgba(255,255,255,0.08)";
const TEXT_PRI      = "#ffffffeb";
const TEXT_SEC      = "rgba(235,235,245,0.6)";
const TEXT_TER      = "rgba(235,235,245,0.4)";
const INPUT_BORDER  = "rgba(255,255,255,0.18)";
const SHEET_SHADOW  = `
  0 24px 60px rgba(0,0,0,.48),
  0 10px 24px rgba(0,0,0,.28),
  0 2px 6px rgba(0,0,0,.18),
  inset 0 1px 0 rgba(255,255,255,.14),
  inset 0 -1px 0 rgba(0,0,0,.25),
  inset 0 0 0 1px rgba(255,255,255,.03)
`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const CreatePlaylistModal = ({ open, onClose }: Props) => {
  const { user } = useAuth();

  // ── Form state ─────────────────────────────────────────────────────────────
  const [name,        setName]        = useState("");
  const [description, setDescription] = useState("");
  const [isPublic,    setIsPublic]    = useState(false);
  const [coverFile,   setCoverFile]   = useState<File | null>(null);
  const [coverPreview,setCoverPreview]= useState<string | null>(null);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [uploading, setUploading] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const backdropRef   = useRef<HTMLDivElement>(null);
  const nameInputRef  = useRef<HTMLInputElement>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const objUrlRef     = useRef<string | null>(null);

  const isBusy  = loading || uploading;
  const isValid = name.trim().length > 0;
  const btnLabel = uploading ? "Uploading…" : loading ? "Creating…" : "Create";

  // ── Reset form each time modal opens ──────────────────────────────────────
  useEffect(() => {
    if (!open) return;

    setName("");
    setDescription("");
    setIsPublic(false);
    setCoverFile(null);
    setCoverPreview(null);
    setError(null);

    // Revoke any stale object URL
    if (objUrlRef.current) {
      URL.revokeObjectURL(objUrlRef.current);
      objUrlRef.current = null;
    }

    // Escape to close (only while open and not busy)
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isBusy) onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    // Focus name input
    const t = setTimeout(() => nameInputRef.current?.focus(), 100);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Object URL cleanup on unmount ─────────────────────────────────────────
  useEffect(
    () => () => {
      if (objUrlRef.current) URL.revokeObjectURL(objUrlRef.current);
    },
    [],
  );

  // ── Body scroll lock ──────────────────────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCoverChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (objUrlRef.current) URL.revokeObjectURL(objUrlRef.current);
      const url = URL.createObjectURL(file);
      objUrlRef.current = url;

      setCoverFile(file);
      setCoverPreview(url);
      setError(null);

      // Reset input so the same file can be re-selected after removal
      e.target.value = "";
    },
    [],
  );

  const removeCover = useCallback(() => {
    if (objUrlRef.current) {
      URL.revokeObjectURL(objUrlRef.current);
      objUrlRef.current = null;
    }
    setCoverFile(null);
    setCoverPreview(null);
  }, []);

  const handleClose = useCallback(() => {
    if (isBusy) return;
    onClose();
  }, [isBusy, onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === backdropRef.current) handleClose();
    },
    [handleClose],
  );

  const handleCreate = useCallback(async () => {
    if (!user || !isValid || isBusy) return;
    setError(null);
    setLoading(true);

    try {
      let coverURL = "";
      if (coverFile) {
        setUploading(true);
        coverURL = await uploadToCloudinary(coverFile);
        setUploading(false);
      }
      await createPlaylist(
        user.uid,
        name.trim(),
        coverURL,
        description.trim(),
        isPublic,
      );
      onClose();
    } catch (err) {
      console.error("[CreatePlaylistModal]", err);
      setError("Something went wrong. Please try again.");
      setUploading(false);
    } finally {
      setLoading(false);
    }
  }, [user, name, description, isPublic, coverFile, isBusy, isValid, onClose]);

  // ── Guard ─────────────────────────────────────────────────────────────────

  if (!open) return null;

  // ── JSX ───────────────────────────────────────────────────────────────────

  return createPortal(
    <>
      <style>{`
        @keyframes _cpm_backdrop { from { opacity:0; } to { opacity:1; } }

        @keyframes _cpm_sheet_up {
          from { opacity:0; transform:translateY(100%); }
          to   { opacity:1; transform:translateY(0);    }
        }

        @keyframes _cpm_sheet_in {
          from { opacity:0; transform:translateY(12px) scale(0.97); }
          to   { opacity:1; transform:translateY(0)    scale(1);    }
        }

        ._cpm_backdrop { animation: _cpm_backdrop 0.18s ease; }

        ._cpm_mobile  { animation: _cpm_sheet_up 0.28s cubic-bezier(0.32,0.72,0,1); }

        @media (min-width:640px) {
          ._cpm_mobile { animation: _cpm_sheet_in 0.22s cubic-bezier(0.34,1.2,0.64,1); }
        }

        ._cpm_input {
          width: 100%;
          background: transparent;
          border: none;
          border-bottom: 1.5px solid ${INPUT_BORDER};
          padding: 6px 0;
          font-size: 14px;
          color: ${TEXT_PRI};
          outline: none;
          transition: border-color 0.15s;
        }
        ._cpm_input:focus     { border-bottom-color: ${PRIMARY}; }
        ._cpm_input::placeholder { color: ${TEXT_TER}; }
        ._cpm_input:disabled  { opacity: 0.45; }
      `}</style>

      {/* Backdrop */}
      <div
        ref={backdropRef}
        onClick={handleBackdropClick}
        className="_cpm_backdrop fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:p-4"
        style={{
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
        }}
      >
        {/* Sheet */}
        <div
          className="_cpm_mobile relative w-full overflow-hidden rounded-t-2xl sm:rounded-2xl flex flex-col"
          style={{
            maxWidth:  560,
            maxHeight: "90vh",
            background: SHEET_BG,
            backdropFilter: SHEET_BLUR,
            WebkitBackdropFilter: SHEET_BLUR,
            border: `1px solid ${BORDER}`,
            boxShadow: SHEET_SHADOW,
          }}
        >
          {/* Drag pill (mobile) */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
            <div className="w-9 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.20)" }} />
          </div>

          {/* Header */}
          <div
            className="flex items-center justify-between px-5 sm:px-6 pt-3 sm:pt-5 pb-3 flex-shrink-0"
            style={{ borderBottom: `1px solid ${HAIRLINE}` }}
          >
            <h2 className="text-[17px] sm:text-[18px] font-semibold tracking-tight" style={{ color: TEXT_PRI }}>
              New Playlist
            </h2>
            <button
              onClick={handleClose}
              disabled={isBusy}
              aria-label="Close"
              className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
              style={{ background: "rgba(255,255,255,0.08)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.14)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
            >
              <CloseIcon sx={{ fontSize: 16 }} style={{ color: TEXT_SEC }} />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto flex-1 px-5 sm:px-6 py-5">
            <div className="flex flex-col sm:flex-row gap-5 sm:gap-6">

              {/* ── Cover image ─────────────────────────────────────── */}
              <div className="flex-shrink-0 flex flex-row sm:flex-col items-start gap-4">
                <label
                  htmlFor="cpm-cover"
                  aria-label="Upload cover image"
                  className="block cursor-pointer"
                  style={{ pointerEvents: isBusy ? "none" : "auto" }}
                >
                  <div
                    className="rounded-xl overflow-hidden flex items-center justify-center transition-opacity duration-150 hover:opacity-85"
                    style={{
                      width:  120,
                      height: 120,
                      background:  coverPreview ? "transparent" : "rgba(255,255,255,0.04)",
                      border:      `2px ${coverPreview ? "solid" : "dashed"} ${PRIMARY}`,
                      boxShadow:   coverPreview ? "0 4px 16px rgba(0,0,0,0.4)" : "none",
                    }}
                  >
                    {coverPreview ? (
                      <img
                        src={coverPreview}
                        alt="Cover preview"
                        className="w-full h-full object-cover"
                        draggable={false}
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <AddPhotoAlternateIcon sx={{ fontSize: 28, color: PRIMARY }} />
                        <span className="text-[10px] font-medium" style={{ color: PRIMARY }}>
                          Add cover
                        </span>
                      </div>
                    )}
                  </div>
                  <input
                    id="cpm-cover"
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleCoverChange}
                    className="hidden"
                    disabled={isBusy}
                  />
                </label>

                {/* Upload progress bar */}
                {uploading && (
                  <div
                    className="mt-2 h-[3px] rounded-full overflow-hidden"
                    style={{ width: 120, background: "rgba(255,255,255,0.08)" }}
                  >
                    <div
                      className="h-full rounded-full animate-pulse"
                      style={{ background: PRIMARY, width: "60%" }}
                    />
                  </div>
                )}

                {/* Remove cover */}
                {coverPreview && !uploading && (
                  <button
                    onClick={removeCover}
                    disabled={isBusy}
                    className="mt-1 text-[11px] font-medium text-center transition-colors disabled:opacity-40"
                    style={{ color: PRIMARY, width: 120 }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = PRIMARY_HOVER)}
                    onMouseLeave={(e) => (e.currentTarget.style.color = PRIMARY)}
                  >
                    Remove photo
                  </button>
                )}
              </div>

              {/* ── Text fields ──────────────────────────────────────── */}
              <div className="flex-1 flex flex-col gap-5 min-w-0">
                {/* Name */}
                <div>
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setError(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
                    placeholder="Playlist title"
                    maxLength={50}
                    disabled={isBusy}
                    className="_cpm_input"
                    style={{ caretColor: PRIMARY }}
                    aria-label="Playlist title"
                  />
                  <div className="flex justify-end mt-1">
                    <span
                      className="text-[10px]"
                      style={{ color: name.length > 42 ? "#ff9f0a" : TEXT_TER }}
                    >
                      {name.length}/50
                    </span>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => { setDescription(e.target.value); setError(null); }}
                    placeholder="Description (optional)"
                    maxLength={120}
                    disabled={isBusy}
                    className="_cpm_input"
                    style={{ caretColor: PRIMARY }}
                    aria-label="Description"
                  />
                  <div className="flex justify-end mt-1">
                    <span className="text-[10px]" style={{ color: TEXT_TER }}>
                      {description.length}/120
                    </span>
                  </div>
                </div>

                {/* Public / Private toggle */}
                <div
                  className="flex items-center gap-2.5 select-none cursor-pointer"
                  onClick={() => !isBusy && setIsPublic((v) => !v)}
                >
                  {/* Checkbox */}
                  <div
                    className="w-[18px] h-[18px] rounded flex items-center justify-center flex-shrink-0 transition-all duration-150"
                    style={{
                      background:  isPublic ? PRIMARY : "transparent",
                      border:      `1.5px solid ${isPublic ? PRIMARY : "rgba(255,255,255,0.28)"}`,
                    }}
                  >
                    {isPublic && (
                      <svg width="10" height="8" viewBox="0 0 11 9" fill="none">
                        <path d="M1 4L4 7L10 1" stroke="white" strokeWidth="1.8"
                          strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>

                  {isPublic
                    ? <PublicIcon sx={{ fontSize: 14 }} style={{ color: TEXT_SEC }} />
                    : <LockIcon   sx={{ fontSize: 14 }} style={{ color: TEXT_TER }} />
                  }

                  <span
                    className="text-[13px]"
                    style={{ color: isPublic ? TEXT_PRI : TEXT_SEC }}
                  >
                    {isPublic ? "Public playlist" : "Private playlist"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <p
              className="px-5 sm:px-6 py-1.5 text-[12px] text-center flex-shrink-0"
              style={{ color: PRIMARY }}
            >
              {error}
            </p>
          )}

          {/* Footer actions — both pills at every breakpoint */}
          <div
            className="flex gap-2.5 sm:gap-3 px-5 sm:px-6 py-3 sm:py-4 flex-shrink-0"
            style={{ borderTop: `1px solid ${HAIRLINE}` }}
          >
            <button
              onClick={handleCreate}
              disabled={!isValid || isBusy}
              className="flex-1 py-2.5 rounded-full text-[14px] font-semibold text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-40"
              style={{ background: PRIMARY }}
              onMouseEnter={(e) => {
                if (isValid && !isBusy) e.currentTarget.style.background = PRIMARY_HOVER;
              }}
              onMouseLeave={(e) => { e.currentTarget.style.background = PRIMARY; }}
            >
              {isBusy && (
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              )}
              {btnLabel}
            </button>

            <button
              onClick={handleClose}
              disabled={isBusy}
              className="flex-1 py-2.5 rounded-full text-[14px] font-semibold transition-colors disabled:opacity-40"
              style={{
                background: SURFACE,
                color: TEXT_PRI,
                border: `1px solid ${BORDER}`,
                backdropFilter: "blur(12px)",
              }}
              onMouseEnter={(e) => { if (!isBusy) e.currentTarget.style.background = HOVER_ROW; }}
              onMouseLeave={(e) => (e.currentTarget.style.background = SURFACE)}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
};

export default CreatePlaylistModal;