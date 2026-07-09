/**
 * @fileoverview HeroInfoPanel — Apple Music Web 2026 hero layout.
 *
 * Layout matches the Apple Music Web album/playlist header precisely:
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │  [Cover art]   │  Title (bold, white, ~28px)                │
 * │  Square,       │  Subtitle (red, ~20px, artist/owner name)  │
 * │  no radius,    │  Meta (muted, "Genre · Year" or stats)     │
 * │  full height   │                                             │
 * │                │  Description (italic, 2-line clamp, gray)  │
 * │                │  ... MORE (right-aligned)                  │
 * │                │                                             │
 * │                │  [▶ Action button]  (white pill)           │
 * └─────────────────────────────────────────────────────────────┘
 *
 * Key design decisions from reference:
 * - Cover art: no border-radius (or 4px max), no drop shadow
 * - Title: white, ~28–32px, font-weight 700, tight tracking
 * - Subtitle (artist/owner): #fa243c red, ~20–22px, font-weight 600
 * - Meta: muted gray rgba(235,235,245,0.5), 13px, "Pop · 2026" dot-separated
 * - Description: italic, rgba(235,235,245,0.65), 2-line clamp
 *   "MORE" appears right-aligned on the same last line (via float trick)
 * - Primary CTA: white pill button with play icon (not red)
 * - All content top-aligned, no fixed height constraint on info column
 * - Generous gap between cover and info: ~32–40px
 * - No glass card wrapping the hero — sits directly on page bg
 *
 * @module components/shared
 */

import {
  useState,
  useCallback,
} from "react";
import { ReactNode } from "react";
import { DescriptionModal } from "./DescriptionModal";
import InlineClampedDescription from "./InlineClampedDescription";

interface HeroInfoPanelProps {
  title: string;
  subtitle: string;
  description: string;
  meta: ReactNode;
  actions: ReactNode;
}

export const HeroInfoPanel = ({
  title,
  subtitle,
  description,
  meta,
  actions,
}: HeroInfoPanelProps) => {
  const [modalOpen, setModalOpen] = useState(false);


  const openModal = useCallback(() => {
    if (!description) return;
    setModalOpen(true);
  }, [description]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
  }, []);


  return (
    <>
      {/* ── Desktop layout (≥ 640px) ── */}
      {/* Info column: top-aligned, no fixed height, natural flow */}
      <div
        className="
    hidden
    sm:flex
    flex-col
    h-full
    min-h-[270px]
    text-left
  "
      >
        {/* ───────────── TOP CONTENT ───────────── */}
        <div className="shrink-0 mt-10">
          <h1
            className="
        font-semibold
        leading-none
        text-[26px]
      "
            style={{
              color: "#f5f5f7",
            }}
          >
            {title}
          </h1>

          <p
            className="mt-1 text-[24px] font-normal leading-none"
            style={{
              color: "#fa243c",
            }}
          >
            {subtitle}
          </p>

          <div
            className="
        mt-2
        flex
        flex-wrap
        items-center
        gap-x-1.5
        gap-y-0.5
        leading-none
      "
            style={{
              fontSize: 13,
              color: "rgba(235,235,245,.55)",
            }}
          >
            {meta}
          </div>
        </div>

        {/* ───────────── BOTTOM CONTENT ───────────── */}
        <div className="mt-auto">
          {description && (
            <InlineClampedDescription
              text={description}
              lines={4}
              onMore={openModal}
              className="max-w-[520px]"
            />
          )}

          <div className="mt-6 flex items-center gap-3">
            {actions}
          </div>
        </div>
      </div>

      {/* ── Mobile layout (< 640px) ── */}
      <div className="flex sm:hidden flex-col items-center text-center w-full gap-[6px]">

        {/* Title */}
        <h1
          className="font-bold leading-tight tracking-[-0.4px]"
          style={{ fontSize: "26px", color: "#f5f5f7" }}
        >
          {title}
        </h1>

        {/* Subtitle */}
        <p
          className="font-semibold leading-tight"
          style={{ fontSize: "17px", color: "#fa243c" }}
        >
          {subtitle}
        </p>

        {/* Meta */}
        <div
          className="text-[12px] flex flex-wrap justify-center items-center gap-x-1.5 gap-y-0.5"
          style={{ color: "rgba(235,235,245,0.5)" }}
        >
          {meta}
        </div>

        {/* Description — tappable, opens modal */}
        {description && (
          <InlineClampedDescription
            text={description}
            lines={3}
            onMore={openModal}
            className="w-full px-4 text-center"
          />
        )}

        {/* Actions */}
        <div className="w-full px-4 flex flex-col gap-2">
          {actions}
        </div>
      </div>

      {/* Description modal */}
      {modalOpen && (
        <DescriptionModal
          title={title}
          subtitle={subtitle}
          description={description}
          onClose={closeModal}
        />
      )}
    </>
  );
};