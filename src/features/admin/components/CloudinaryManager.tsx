import { useState, useEffect, useCallback, useMemo } from "react";
import AnimatedSpinner from "@/components/ui/LoadingSpinner/AnimatedSpinner";
import {
  fetchAllCloudinaryAssets,
  clearFirestoreReference,
  deleteCloudinaryAsset,
  computeStats,
  type CloudinaryAsset,
  type AssetSource,
  type AssetStats,
} from "../services/cloudinaryManager.service";

import RefreshIcon          from "@mui/icons-material/Refresh";
import SearchIcon           from "@mui/icons-material/Search";
import DeleteOutlineIcon    from "@mui/icons-material/DeleteOutline";
import OpenInNewIcon        from "@mui/icons-material/OpenInNew";
import ContentCopyIcon      from "@mui/icons-material/ContentCopy";
import CheckIcon            from "@mui/icons-material/Check";
import MusicNoteIcon        from "@mui/icons-material/MusicNote";
import ImageOutlinedIcon    from "@mui/icons-material/ImageOutlined";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
import PersonOutlinedIcon   from "@mui/icons-material/PersonOutlined";
import ImageIcon            from "@mui/icons-material/Image";
import WarningAmberIcon     from "@mui/icons-material/WarningAmber";
import CloseIcon            from "@mui/icons-material/Close";

const P = "#fa243c";

// ── Source metadata ───────────────────────────────────────────────────────────
const SOURCE_META: Record<AssetSource, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  song_audio:    { label: "Song Audio",    color: P,         bg: "#fff0f3", icon: MusicNoteIcon        },
  song_cover:    { label: "Song Cover",    color: "#7c3aed", bg: "#f5f3ff", icon: ImageOutlinedIcon    },
  banner_image:  { label: "Banner Image",  color: "#0ea5e9", bg: "#f0f9ff", icon: ImageOutlinedIcon    },
  banner_media:  { label: "Banner Video",  color: "#f59e0b", bg: "#fffbeb", icon: VideocamOutlinedIcon },
  user_photo:    { label: "Profile Photo", color: "#10b981", bg: "#f0fdf4", icon: PersonOutlinedIcon   },
};

const ALL_SOURCES = Object.keys(SOURCE_META) as AssetSource[];

// ── Stat card ─────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) => (
  <div className="bg-white rounded-2xl border border-[#e5e5ea] p-4 flex flex-col gap-1">
    <p className="text-[11px] text-[#aeaeb2] font-medium">{label}</p>
    <p className="text-[24px] font-bold leading-tight" style={{ color }}>{value}</p>
    <div className="w-6 h-1 rounded-full mt-1" style={{ background: bg === "#fff0f3" ? color : bg }} />
  </div>
);

// ── Copy button ───────────────────────────────────────────────────────────────
const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button onClick={handleCopy}
      className="w-7 h-7 rounded-full flex items-center justify-center text-[#aeaeb2] hover:bg-[#f5f5f7] hover:text-[#3c3c43] transition-colors flex-shrink-0"
      title="Copy URL">
      {copied ? <CheckIcon sx={{ fontSize: 14 }} className="text-[#34c759]" /> : <ContentCopyIcon sx={{ fontSize: 14 }} />}
    </button>
  );
};

// ── Delete confirmation modal ─────────────────────────────────────────────────
const DeleteModal = ({
  asset,
  onConfirm,
  onCancel,
  busy,
  warning,
}: {
  asset:     CloudinaryAsset;
  onConfirm: (removeFirestore: boolean) => void;
  onCancel:  () => void;
  busy:      boolean;
  warning:   string | null;
}) => {
  const [removeFirestore, setRemoveFirestore] = useState(true);
  const meta = SOURCE_META[asset.source];

  return (
    <div className="fixed inset-0 z-[500] bg-black/30 backdrop-blur-[3px] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-[#e5e5ea] shadow-2xl w-full max-w-md">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#f5f5f7]">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#fff0f3]">
            <DeleteOutlineIcon sx={{ fontSize: 18 }} style={{ color: P }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold text-[#1d1d1f]">Remove Asset</p>
            <p className="text-[11px] text-[#6e6e73] truncate">{asset.label}</p>
          </div>
          <button onClick={onCancel} className="w-8 h-8 rounded-full bg-[#f5f5f7] flex items-center justify-center text-[#8e8e93]">
            <CloseIcon sx={{ fontSize: 14 }} />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3">
          {/* Asset preview */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#fafafa] border border-[#e5e5ea]">
            {asset.thumbUrl ? (
              <img src={asset.thumbUrl} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: meta.bg }}>
                <meta.icon sx={{ fontSize: 20 }} style={{ color: meta.color }} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-[#1d1d1f] truncate">{asset.publicId}</p>
              <p className="text-[11px] text-[#6e6e73] uppercase">{asset.format} · {meta.label}</p>
            </div>
          </div>

          {/* Cloudinary deletion warning */}
          {warning && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#fffbeb] border border-[#fde68a]">
              <WarningAmberIcon sx={{ fontSize: 16 }} className="text-[#f59e0b] flex-shrink-0 mt-0.5" />
              <p className="text-[12px] text-[#92400e] leading-relaxed">{warning}</p>
            </div>
          )}

          {/* Firestore option */}
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input type="checkbox" checked={removeFirestore}
              onChange={(e) => setRemoveFirestore(e.target.checked)}
              className="w-4 h-4 accent-[#fa243c] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] font-medium text-[#1d1d1f]">Clear Firestore reference</p>
              <p className="text-[11px] text-[#6e6e73]">
                Removes the URL from the <strong>{asset.collection}</strong> document.
                The asset will no longer appear in the app.
              </p>
            </div>
          </label>

          <p className="text-[11px] text-[#aeaeb2]">
            Note: To permanently delete the file from Cloudinary storage, use the
            Cloudinary dashboard. This action only manages the app's reference.
          </p>
        </div>

        <div className="px-5 py-4 border-t border-[#f5f5f7] flex gap-2 justify-end">
          <button onClick={onCancel} disabled={busy}
            className="px-4 py-2 rounded-full text-[12px] font-semibold border border-[#e5e5ea] text-[#6e6e73] hover:bg-[#f5f5f7] disabled:opacity-50">
            Cancel
          </button>
          <button onClick={() => onConfirm(removeFirestore)} disabled={busy}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-semibold text-white disabled:opacity-50"
            style={{ background: P }}>
            {busy ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
            {busy ? "Removing…" : "Remove"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Asset card ────────────────────────────────────────────────────────────────
const AssetCard = ({
  asset,
  onDelete,
}: {
  asset:    CloudinaryAsset;
  onDelete: (a: CloudinaryAsset) => void;
}) => {
  const meta = SOURCE_META[asset.source];
  const Icon = meta.icon;

  return (
    <div className="bg-white rounded-2xl border border-[#e5e5ea] overflow-hidden hover:shadow-md transition-shadow group">
      {/* Thumbnail / placeholder */}
      <div className="relative w-full h-32 overflow-hidden bg-[#f5f5f7]">
        {asset.thumbUrl ? (
          <img src={asset.thumbUrl} alt={asset.label}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: meta.bg }}>
            <Icon sx={{ fontSize: 36 }} style={{ color: meta.color + "60" }} />
          </div>
        )}
        {/* Source badge */}
        <div className="absolute top-2 left-2">
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full text-white shadow-sm"
            style={{ background: meta.color }}>
            {meta.label}
          </span>
        </div>
        {/* Format badge */}
        <div className="absolute top-2 right-2">
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-black/50 text-white uppercase">
            {asset.format || "—"}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-[12px] font-semibold text-[#1d1d1f] truncate leading-tight mb-0.5">
          {asset.label}
        </p>
        <p className="text-[10px] text-[#aeaeb2] truncate font-mono">{asset.publicId}</p>

        {/* Actions row */}
        <div className="flex items-center gap-1 mt-2.5">
          <CopyButton text={asset.url} />
          <a href={asset.url} target="_blank" rel="noopener noreferrer"
            className="w-7 h-7 rounded-full flex items-center justify-center text-[#aeaeb2] hover:bg-[#f5f5f7] hover:text-[#3c3c43] transition-colors flex-shrink-0"
            title="Open in Cloudinary">
            <OpenInNewIcon sx={{ fontSize: 14 }} />
          </a>
          <div className="ml-auto">
            <button onClick={() => onDelete(asset)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-[#aeaeb2] hover:bg-[#fff0f3] hover:text-[#fa243c] transition-colors"
              title="Remove asset">
              <DeleteOutlineIcon sx={{ fontSize: 15 }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
const CloudinaryManager = () => {
  const [assets,      setAssets]      = useState<CloudinaryAsset[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [search,      setSearch]      = useState("");
  const [sourceFilter, setSourceFilter] = useState<AssetSource | "all">("all");
  const [typeFilter,  setTypeFilter]  = useState<"all" | "image" | "video">("all");
  const [deleteTarget, setDeleteTarget] = useState<CloudinaryAsset | null>(null);
  const [deleteBusy,  setDeleteBusy]  = useState(false);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllCloudinaryAssets();
      setAssets(data);
    } catch (e) {
      console.error(e);
      setError("Failed to load assets. Check Firestore permissions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAssets(); }, [loadAssets]);

  const stats: AssetStats = useMemo(() => computeStats(assets), [assets]);

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      if (sourceFilter !== "all" && a.source !== sourceFilter) return false;
      if (typeFilter   !== "all" && a.resourceType !== typeFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          a.label.toLowerCase().includes(q) ||
          a.publicId.toLowerCase().includes(q) ||
          a.format.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [assets, sourceFilter, typeFilter, search]);

  const handleDeleteConfirm = useCallback(async (removeFirestore: boolean) => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      // 1. Attempt Cloudinary deletion (currently returns not_implemented)
      await deleteCloudinaryAsset(deleteTarget.publicId, deleteTarget.resourceType);

      // 2. Clear Firestore reference if requested
      if (removeFirestore) {
        await clearFirestoreReference(deleteTarget);
      }

      // 3. Remove from local state
      setAssets((prev) => prev.filter((a) => a.key !== deleteTarget.key));
      setDeleteTarget(null);
    } catch (e) {
      console.error(e);
    } finally {
      setDeleteBusy(false);
    }
  }, [deleteTarget]);

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-[20px] font-bold text-[#1d1d1f] tracking-tight">Media Manager</h2>
          <p className="text-[13px] text-[#6e6e73] mt-0.5">
            All Cloudinary assets referenced across songs, banners, and user profiles
          </p>
        </div>
        <button onClick={loadAssets} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-semibold border border-[#e5e5ea] text-[#3c3c43] hover:bg-[#f5f5f7] disabled:opacity-50 transition-colors flex-shrink-0">
          <RefreshIcon sx={{ fontSize: 15 }} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        <StatCard label="Total Assets"   value={stats.total}        color="#3b82f6" bg="#eff6ff" />
        <StatCard label="Images"         value={stats.images}       color="#7c3aed" bg="#f5f3ff" />
        <StatCard label="Videos/Audio"   value={stats.videos}       color="#f59e0b" bg="#fffbeb" />
        <StatCard label="Song Covers"    value={stats.songCovers}   color="#7c3aed" bg="#f5f3ff" />
        <StatCard label="Song Audio"     value={stats.songAudios}   color={P}       bg="#fff0f3" />
        <StatCard label="Banner Assets"  value={stats.bannerImages + stats.bannerMedias} color="#0ea5e9" bg="#f0f9ff" />
        <StatCard label="Profile Photos" value={stats.userPhotos}   color="#10b981" bg="#f0fdf4" />
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        {/* Source filter pills */}
        <div className="flex gap-1.5 overflow-x-auto flex-wrap" style={{ scrollbarWidth: "none" }}>
          <button onClick={() => setSourceFilter("all")}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all"
            style={{ background: sourceFilter === "all" ? P : "white", color: sourceFilter === "all" ? "white" : "#6e6e73", border: `1.5px solid ${sourceFilter === "all" ? P : "#e5e5ea"}` }}>
            All Sources
          </button>
          {ALL_SOURCES.map((s) => {
            const m       = SOURCE_META[s];
            const isActive = sourceFilter === s;
            return (
              <button key={s} onClick={() => setSourceFilter(s)}
                className="flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all"
                style={{ background: isActive ? m.color : "white", color: isActive ? "white" : "#6e6e73", border: `1.5px solid ${isActive ? m.color : "#e5e5ea"}` }}>
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Type + search row */}
        <div className="flex gap-2 ml-auto flex-shrink-0">
          <div className="flex gap-1">
            {(["all","image","video"] as const).map((t) => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className="px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all capitalize"
                style={{ background: typeFilter === t ? "#1d1d1f" : "white", color: typeFilter === t ? "white" : "#6e6e73", borderColor: typeFilter === t ? "#1d1d1f" : "#e5e5ea" }}>
                {t === "all" ? "All Types" : t}
              </button>
            ))}
          </div>
          <div className="relative">
            <SearchIcon sx={{ fontSize: 14 }} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aeaeb2]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search assets…"
              className="pl-8 pr-3 py-1.5 rounded-full border border-[#e5e5ea] text-[12px] text-[#1d1d1f] outline-none bg-white focus:border-[#fa243c] w-44 transition-all placeholder:text-[#aeaeb2]" />
          </div>
        </div>
      </div>

      {/* ── Results count ── */}
      {!loading && (
        <p className="text-[12px] text-[#aeaeb2] mb-4">
          {filtered.length} asset{filtered.length !== 1 ? "s" : ""}
          {filtered.length !== assets.length ? ` of ${assets.length}` : ""}
        </p>
      )}

      {/* ── Content ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <AnimatedSpinner size={24} color={P} />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center py-16 text-center bg-white rounded-2xl border border-[#e5e5ea]">
          <WarningAmberIcon sx={{ fontSize: 36 }} className="text-[#f59e0b] mb-3" />
          <p className="text-[14px] font-semibold text-[#1d1d1f] mb-1">Failed to load</p>
          <p className="text-[12px] text-[#aeaeb2] mb-4">{error}</p>
          <button onClick={loadAssets} className="px-4 py-2 rounded-full text-[12px] font-semibold text-white" style={{ background: P }}>
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center bg-white rounded-2xl border border-[#e5e5ea]">
          <ImageIcon sx={{ fontSize: 40 }} className="text-[#c7c7cc] mb-3" />
          <p className="text-[14px] font-semibold text-[#1d1d1f] mb-1">No assets found</p>
          <p className="text-[12px] text-[#aeaeb2]">
            {search || sourceFilter !== "all" || typeFilter !== "all"
              ? "Try clearing the filters"
              : "No Cloudinary assets are referenced in Firestore yet"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filtered.map((asset) => (
            <AssetCard key={asset.key} asset={asset} onDelete={setDeleteTarget} />
          ))}
        </div>
      )}

      {/* ── Delete modal ── */}
      {deleteTarget && (
        <DeleteModal
          asset={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
          busy={deleteBusy}
          warning={
            "Permanent file deletion from Cloudinary requires a server-side Cloud Function " +
            "(API secret cannot be exposed in the browser). This action will clear the reference " +
            "in Firestore. To fully remove the file, delete it manually from your Cloudinary dashboard."
          }
        />
      )}
    </div>
  );
};

export default CloudinaryManager;