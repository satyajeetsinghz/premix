/**
 * @fileoverview Sortable wrapper component for dnd-kit drag-and-drop functionality.
 *
 * Responsibilities:
 * - Make banner items draggable and sortable in the BannerManager list
 * - Provide accessibility attributes and event handlers for drag operations
 * - Apply CSS transforms and transitions during drag for visual feedback
 *
 * Related modules:
 * - BannerManager (src/features/banner/components/BannerManager.tsx) - Parent component that uses this wrapper
 * - @dnd-kit/sortable library - Provides useSortable hook for drag-and-drop functionality
 *
 * Architectural role:
 * - **Drag-and-drop adapter** between dnd-kit and the banner list UI
 * - Each banner item in the sortable list is wrapped with this component
 * - Receives children (the actual banner UI) and injects drag handlers via clone
 *
 * Drag-and-drop flow:
 * 1. User clicks and holds drag handle (DragIndicatorIcon in BannerManager)
 * 2. useSortable hook tracks drag state and position
 * 3. Component applies CSS transform during drag (smooth visual movement)
 * 4. On drop, dnd-kit fires dragEnd event with new position
 * 5. BannerManager updates order field in Firestore for all affected banners
 *
 * Props structure (currently typed as any - should be improved):
 * - banner: IBanner object with id field (required for sorting)
 * - children: React node containing the actual banner UI
 *
 * Performance considerations:
 * - CSS transform is GPU-accelerated (smooth drag animations)
 * - transition property ensures smooth return to original position on drop
 * - No unnecessary re-renders (dnd-kit manages drag state internally)
 *
 * Accessibility:
 * - attributes contain role="button" and tabIndex for keyboard sorting
 * - listeners include keyboard event handlers (Space/Enter to start drag)
 *
 * @module features/banner/components
 */

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/**
 * SortableBannerItem - Wrapper component for draggable banner items.
 *
 * Usage in BannerManager:
 * ```tsx
 * <SortableBannerItem key={banner.id} id={banner.id} banner={banner}>
 *   <div className="group ...">
 *     {/* Banner UI content * /}
 *   </div>
 * </SortableBannerItem>
 * ```
 *
 * Note: The component accepts an `id` prop but doesn't use it directly.
 * The useSortable hook uses banner.id as the unique identifier for sorting.
 * The component should receive `id={banner.id}` from the parent, but the current
 * implementation uses `banner.id` directly. This is acceptable but creates a
 * dependency on the banner object structure.
 *
 * @param props - Component props
 * @param props.banner - Banner object containing id field
 * @param props.children - Child elements to be wrapped (the banner UI)
 * @returns Sortable container div with drag handlers
 */
const SortableBannerItem = ({ banner, children }: any) => {
  /**
   * useSortable hook provides drag-and-drop functionality.
   *
   * Parameters:
   * - id: Unique identifier for the sortable item (must match the key used in SortableContext)
   *
   * Return values:
   * - attributes: Accessibility attributes (role, tabIndex, aria-describedby)
   * - listeners: Event handlers for drag start (mouse/touch/keyboard)
   * - setNodeRef: Ref callback to attach to the DOM element
   * - transform: CSS transform during drag (position offset)
   * - transition: CSS transition for smooth animation on drag end
   */
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: banner.id });

  /**
   * CSS transform style for smooth dragging.
   *
   * CSS.Transform.toString(transform) converts the transform object
   * to a CSS string like "translate3d(10px, 20px, 0)".
   * Using translate3d enables GPU acceleration for smoother animations.
   */
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
};

export default SortableBannerItem;