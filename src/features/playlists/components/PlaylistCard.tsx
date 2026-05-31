/**
 * @fileoverview Reusable playlist card component with two visual variants.
 *
 * Responsibilities:
 * - Display playlist cover image or gradient fallback
 * - Navigate to playlist detail page on click
 * - Show play overlay on hover (default variant only)
 * - Support compact variant for list views (Sidebar, profile page)
 *
 * Related modules:
 * - PlaylistList (src/features/playlists/components/PlaylistList.tsx) - Uses this component
 * - LibraryPage (src/features/library/pages/LibraryPage.tsx) - Uses default variant in grid/list views
 * - ProfilePage (src/features/profile/ProfilePage.tsx) - Uses compact variant for user's playlists
 *
 * Architectural role:
 * - **Visual abstraction** for playlist display across the app
 * - Provides consistent styling for playlist cards in grid and list layouts
 * - Two variants: default (grid cards) and compact (sidebar/profile lists)
 *
 * Variant differences:
 *
 * Default variant (grid):
 * - Aspect ratio square cover art
 * - Hover: overlay + scale animation + play icon
 * - Full metadata (title + owner/description)
 * - Used in LibraryPage grid view
 *
 * Compact variant (list):
 * - Horizontal layout (cover art left, text right)
 * - Smaller size (40x40 cover, 10px text)
 * - No play overlay (just hover fade)
 * - Used in Sidebar playlist list and ProfilePage
 *
 * Gradient fallback:
 * - When no cover image, shows gradient + music icon
 * - Gradient selection based on playlist name length (deterministic)
 * - Ensures visual variety without random elements
 *
 * Performance:
 * - useState for hover state (local to each card)
 * - Navigation on click (react-router navigate)
 * - Event propagation stopped on more button
 *
 * @module features/playlists/components
 */

import { useNavigate } from "react-router-dom";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import LibraryMusicIcon from "@mui/icons-material/LibraryMusic";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import { useState } from "react";

/**
 * Props for the PlaylistCard component.
 *
 * @property playlist - Playlist object (shape matches Firestore document + resolved fields)
 * @property variant - Visual style: "default" (grid) or "compact" (list)
 */
interface Props {
  playlist: any; // TODO: Replace with IPlaylist type when available
  variant?: "default" | "compact";
}

/**
 * PlaylistCard - Displays a playlist with cover art and metadata.
 *
 * Usage examples:
 *
 * Default variant (grid layout):
 * ```tsx
 * <PlaylistCard playlist={playlist} variant="default" />
 * ```
 *
 * Compact variant (list layout):
 * ```tsx
 * <PlaylistCard playlist={playlist} variant="compact" />
 * ```
 *
 * @param props - Component props
 * @returns Playlist card JSX
 */
const PlaylistCard = ({ playlist, variant = "default" }: Props) => {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);

  /**
   * Returns a deterministic gradient based on playlist name.
   *
   * Uses playlist name length modulo gradient array length.
   * Ensures same playlist always gets same gradient (no randomness).
   *
   * Gradient array includes:
   * - Brand red to purple (primary)
   * - Blue to cyan
   * - Green to emerald
   * - Orange to pink
   * - Indigo to purple
   * - Yellow to orange
   *
   * @param name - Playlist name
   * @returns Tailwind gradient classes (e.g., "from-[#fa243c] to-purple-500")
   */
  const getGradient = (name: string) => {
    const gradients = [
      "from-[#fa243c] to-purple-500",
      "from-blue-400 to-cyan-400",
      "from-green-400 to-emerald-500",
      "from-orange-400 to-pink-500",
      "from-indigo-400 to-purple-400",
      "from-yellow-400 to-orange-400",
    ];

    const index = name?.length % gradients.length || 0;
    return gradients[index];
  };

  // --- Compact variant (horizontal list item) ---
  if (variant === "compact") {
    return (
      <div
        onClick={() => navigate(`/playlist/${playlist.id}`)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="group flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
      >
        {/* Cover art - fixed size 40x40 */}
        <div className="relative w-10 h-10 rounded-md overflow-hidden flex-shrink-0">
          {playlist.coverUrl ? (
            <img
              src={playlist.coverUrl}
              alt={playlist.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className={`w-full h-full bg-gradient-to-br ${getGradient(playlist.name)} flex items-center justify-center`}
            >
              <LibraryMusicIcon
                className="text-white opacity-70"
                fontSize="small"
              />
            </div>
          )}

          {/* Hover overlay - subtle play icon */}
          <div
            className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity duration-200 ${isHovered ? "opacity-100" : "opacity-0"
              }`}
          >
            <PlayCircleIcon
              className="text-white"
              sx={{ fontSize: "1.5rem" }}
            />
          </div>
        </div>

        {/* Playlist info */}
        <div className="flex-1 min-w-0">
          <h4 className="text-xs sm:text-sm font-medium text-gray-900 truncate">
            {playlist.name}
          </h4>
          {playlist.songCount > 0 && (
            <p className="text-[10px] sm:text-xs text-gray-400">
              {playlist.songCount} {playlist.songCount === 1 ? "song" : "songs"}
            </p>
          )}
        </div>

        {/* More options button (placeholder) */}
        <button
          onClick={(e) => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <MoreHorizIcon fontSize="small" className="text-gray-400" />
        </button>
      </div>
    );
  }

  // --- Default variant (grid card) ---
  return (
    <div
      onClick={() => navigate(`/playlist/${playlist.id}`)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative bg-white rounded-md overflow-hidden border border-gray-200 hover:shadow-lg transition-all duration-300 cursor-pointer w-full max-w-[180px] xs:max-w-[200px] sm:max-w-full mx-auto"
    >
      {/* Cover art container - square aspect ratio */}
      <div className="relative aspect-square overflow-hidden bg-gray-100">
        {playlist.coverUrl ? (
          <img
            src={playlist.coverUrl}
            alt={playlist.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div
            className={`w-full h-full bg-gradient-to-br ${getGradient(playlist.name)} flex items-center justify-center`}
          >
            <LibraryMusicIcon
              className="text-white opacity-50"
              sx={{ fontSize: { xs: 36, sm: 48, md: 56 } }}
            />
          </div>
        )}

        {/* Hover overlay - dark overlay only (no play icon for default variant) */}
        <div
          className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${isHovered ? "opacity-100" : "opacity-0"
            }`}
        ></div>
      </div>

      {/* Playlist metadata */}
      <div className="p-2 sm:p-3">
        <h3 className="font-medium text-gray-900 text-xs sm:text-sm truncate group-hover:text-[#fa243c] transition-colors">
          {playlist.name}
        </h3>

        {/* Owner or description (secondary line) */}
        {(playlist.owner || playlist.description) && (
          <p className="text-[10px] sm:text-xs text-gray-400 truncate mt-0.5">
            {playlist.owner || playlist.description}
          </p>
        )}
      </div>
    </div>
  );
};

export default PlaylistCard;