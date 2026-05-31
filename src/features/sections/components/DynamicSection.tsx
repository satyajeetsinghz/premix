/**
 * @fileoverview Dynamic section component for homepage that displays songs belonging to a specific section.
 *
 * Responsibilities:
 * - Filter songs that belong to the given section ID
 * - Display up to MAX_VISIBLE songs in a horizontal scrollable carousel
 * - Show "View All" button when section has > 8 songs (future feature placeholder)
 * - Show "+X more" card when section has > MAX_VISIBLE songs
 * - Handle loading state with skeleton cards
 * - Skip rendering if section is inactive or has no songs
 *
 * Related modules:
 * - useSongs (src/features/songs/hooks/useSongs.ts) - Provides all songs with real-time updates
 * - SectionShell (src/components/shared/SectionShell.tsx) - Provides horizontal scroll container
 * - SongCard (src/features/songs/components/SongCard.tsx) - Displays individual song
 *
 * Architectural role:
 * - **Homepage section renderer** for dynamically configured sections
 * - Each section corresponds to a Firestore document in /sections collection
 * - Sections are created/managed by admin via SectionManager
 *
 * Firestore data model (from HANDOFF_CORE.md):
 * - Sections collection: /sections/{sectionId}
 *   - Fields: title (string), isActive (boolean), createdAt (timestamp)
 * - Songs collection: /songs/{songId}
 *   - Fields: sectionIds (string[]) - array of section IDs this song belongs to
 *
 * Data flow:
 * 1. useSongs subscribes to all songs (real-time)
 * 2. DynamicSection filters songs where song.sectionIds includes section.id
 * 3. Sorted by order field? No explicit sort - uses natural order from Firestore query
 * 4. Renders in horizontal scrollable carousel
 *
 * Display limits:
 * - MAX_VISIBLE = 12 songs shown in carousel
 * - Hidden songs indicated by "+X more" card at end
 * - "View All" button placeholder (future: navigate to section page)
 *
 * Performance:
 * - useMemo for sectionSongs (recalculates only when songs or section.id changes)
 * - SectionShell handles scroll detection and arrow visibility
 *
 * Empty state handling:
 * - Section inactive (isActive = false): returns null
 * - No songs in section: returns null
 * - Loading: shows skeleton cards
 *
 * @module features/sections/components
 */

import { useMemo } from "react";
import { useSongs } from "@/features/songs/hooks/useSongs";
import { ISection } from "../types";
import SongCard from "@/features/songs/components/SongCard";
import { SectionShell } from "@/components/shared/SectionShell";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

// Maximum number of songs to display in the carousel
const MAX_VISIBLE = 12;

/**
 * Props for the DynamicSection component.
 *
 * @property section - Section configuration from Firestore (title, isActive, id)
 */
interface Props {
  section: ISection;
}

/**
 * DynamicSection - Renders a homepage section with songs belonging to that section.
 *
 * Usage in HomePage:
 * ```tsx
 * {sections.map(section => <DynamicSection key={section.id} section={section} />)}
 * ```
 *
 * Visual layout:
 * ```
 * SectionShell (horizontal scroll container)
 * ├── Header: Section title + optional "View All" button
 * └── Song cards (up to MAX_VISIBLE)
 *     └── "+X more" card (if hiddenCount > 0)
 * ```
 *
 * @param props - Component props
 * @returns Dynamic section JSX or null if should not render
 */
export const DynamicSection = ({ section }: Props) => {
  const { songs, loading } = useSongs();

  /**
   * Memoized list of songs that belong to this section.
   *
   * Filters songs where section.id is present in song.sectionIds array.
   * Recalculates only when songs array or section.id changes.
   */
  const sectionSongs = useMemo(
    () => songs.filter((s) => s.sectionIds?.includes(section.id)),
    [songs, section.id],
  );

  // Don't render inactive sections (admin can disable sections without deleting)
  if (!section.isActive) return null;

  // Loading state: show skeleton cards matching SongCard aspect ratio
  if (loading) {
    return (
      <div className="w-full animate-pulse mb-10">
        <div className="flex items-center justify-between mb-4 px-0.5">
          <div className="flex items-center gap-2">
            <div className="w-[3px] h-5 bg-gray-200 rounded-full" />
            <div className="h-5 w-32 bg-gray-200 rounded-md" />
          </div>
        </div>
        <div className="flex gap-3 sm:gap-4 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="w-[140px] sm:w-[172px] flex-shrink-0">
              <div className="aspect-square bg-gray-100 rounded-xl mb-2" />
              <div className="h-3.5 bg-gray-100 rounded w-3/4 mb-1.5" />
              <div className="h-3   bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Don't render empty sections
  if (!sectionSongs.length) return null;

  // Limit visible songs to MAX_VISIBLE
  const visible = sectionSongs.slice(0, MAX_VISIBLE);
  const hiddenCount = sectionSongs.length - MAX_VISIBLE;

  /**
   * "View All" button appears when section has more than 8 songs.
   * Currently a placeholder - future implementation should navigate
   * to a dedicated section page or expand the carousel.
   */
  const action =
    sectionSongs.length > 8 ? (
      <button
        className="flex items-center gap-0.5 text-xs font-medium text-gray-400 hover:text-[#fa243c] transition-colors group/viewall"
        onClick={() => { }} // TODO: Implement "View All" navigation
      >
        <span>View All</span>
        <ChevronRightIcon
          fontSize="small"
          className="text-gray-400 group-hover/viewall:text-[#fa243c] transition-colors"
        />
      </button>
    ) : undefined;

  return (
    <div className="w-full mb-10">
      <SectionShell
        title={section.title}
        action={action}
        groupName={`section-${section.id}`}
      >
        {/* Visible song cards */}
        {visible.map((song, index) => (
          <div key={song.id} className="w-[140px] sm:w-[172px] flex-shrink-0">
            <SongCard
              track={song}
              songs={sectionSongs}
              variant="default"
              index={index}
            />
          </div>
        ))}

        {/* "+X more" card for hidden songs */}
        {hiddenCount > 0 && (
          <div className="w-[140px] sm:w-[172px] flex-shrink-0 flex items-center justify-center">
            <button
              className="aspect-square w-full rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1.5 text-gray-400 hover:border-[#fa243c] hover:text-[#fa243c] transition-all group/more"
              onClick={() => { }} // TODO: Implement "show more" - expand carousel or navigate
            >
              <ChevronRightIcon className="text-gray-300 group-hover/more:text-[#fa243c] transition-colors" />
              <span className="text-xs font-semibold">+{hiddenCount} more</span>
            </button>
          </div>
        )}
      </SectionShell>
    </div>
  );
};