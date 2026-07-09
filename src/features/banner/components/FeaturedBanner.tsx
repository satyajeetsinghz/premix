/**
 * @fileoverview FeaturedBanner — Apple Music Web "Updated Playlists" carousel.
 *
 * At-rest alignment guarantee: the track's paddingLeft is
 * `calc(var(--sidebar-inset) + 24px)`. Because HomePage's wrapper cancels
 * the SAME var as a negative margin before this component ever renders,
 * these two exactly offset each other — the first card's left edge always
 * lands at the same x-position as the page header above it, on every
 * screen size, with zero breakpoint-specific classes.
 *
 * Card sizing: cards are sized ~300-340px (not near-full-viewport) so the
 * next card always peeks in at rest — this is the "there's more to
 * scroll" affordance, matching Apple Music Web's actual carousel card
 * width instead of a full-bleed hero width. Height is a fixed 4:3 aspect
 * ratio tied to that width, rather than an independent clamp().
 *
 * Autoplay removed: this carousel now advances only on explicit user
 * input (arrows, keyboard, or clicking/dragging a card) — no
 * interval-based auto-advance.
 *
 * Nav button state: previously derived from `current` (a single "active
 * card" index), which broke once multiple cards became visible at once —
 * `current` reaching total-1 disabled the right arrow even when there was
 * still real scrollable distance left, and vice versa. Nav buttons are
 * now derived from the track's actual scrollLeft/scrollWidth/clientWidth
 * on every scroll event, so "can scroll further" is answered from real
 * pixel position, not an index that doesn't map 1:1 to scroll distance
 * once cards start peeking. Arrow clicks scroll by exactly one card-width
 * + gap, independent of `current`.
 */

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { useBanners } from "../hooks/useBanners";
import { useSongs } from "@/features/songs/hooks/useSongs";
import { usePlayer } from "@/features/player/hooks/usePlayer";
import { useNavigate } from "react-router-dom";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import { GUTTER_LEFT_PX } from "@/components/layout/hooks/layout.constants";

const EASE_APPLE = [0.16, 1, 0.3, 1] as const;
const CARD_GAP_PX = 20; // matches track's gap-5

const CARD_WIDTH_CLASSES =
  "w-[calc(100vw-100px)] sm:w-[clamp(340px,88vw,420px)] md:w-[clamp(380px,52vw,480px)] lg:w-[clamp(460px,38vw,560px)] 2xl:w-[clamp(560px,34vw,640px)]";

const NavArrow = ({
  direction,
  onClick,
  visible,
}: {
  direction: "left" | "right";
  onClick: (e: React.MouseEvent) => void;
  visible: boolean;
}) => (
  <button
    onClick={onClick}
    aria-label={direction === "left" ? "Scroll left" : "Scroll right"}
    disabled={!visible}
    className="flex items-center justify-center rounded-full text-white select-none transition-opacity duration-200 flex-shrink-0"
    style={{
      width: 32,
      height: 32,
      background: "rgba(0,0,0,0.45)",
      backdropFilter: "blur(10px)",
      WebkitBackdropFilter: "blur(10px)",
      opacity: visible ? 1 : 0.25,
      cursor: visible ? "pointer" : "default",
    }}
  >
    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d={direction === "left" ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"} />
    </svg>
  </button>
);

const FeaturedBanner = () => {
  const { banners, loading } = useBanners(false);
  const { songs } = useSongs();
  const { playTrack } = usePlayer();
  const navigate = useNavigate();

  const [current, setCurrent] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const total = banners.length;

  // ── Real scroll-position based nav state (not index-based) ──────────
  const updateScrollState = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const { scrollLeft, scrollWidth, clientWidth } = track;
    setCanScrollPrev(scrollLeft > 4);
    setCanScrollNext(scrollLeft < scrollWidth - clientWidth - 4);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    updateScrollState();
    track.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      track.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [updateScrollState, total]);

  useEffect(() => {
    if (total && current >= total) setCurrent(total - 1);
  }, [total, current]);

  useEffect(() => {
    if (!total) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setCurrent((p) => (p - 1 + total) % total);
      if (e.key === "ArrowRight") setCurrent((p) => (p + 1) % total);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [total]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.children[current] as HTMLElement | undefined;
    if (card) {
      track.scrollTo({ left: card.offsetLeft, behavior: "smooth" });
    }
  }, [current]);

  const mappedSongs = useMemo(
    () => songs.map((s) => ({
      id: s.id,
      title: s.title,
      artist: s.artist,
      audioUrl: s.audioUrl,
      coverUrl: s.coverUrl,
    })),
    [songs],
  );

  const goTo = useCallback((i: number) => setCurrent(i), []);

  // ── Arrow clicks scroll by exactly one card-width + gap ─────────────
  const scrollByCard = useCallback((dir: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.children[0] as HTMLElement | undefined;
    const cardWidth = card ? card.offsetWidth : track.clientWidth * 0.8;
    track.scrollBy({ left: dir * (cardWidth + CARD_GAP_PX), behavior: "smooth" });
  }, []);

  const goPrev = useCallback(
    (e: React.MouseEvent) => { e.stopPropagation(); scrollByCard(-1); },
    [scrollByCard],
  );

  const goNext = useCallback(
    (e: React.MouseEvent) => { e.stopPropagation(); scrollByCard(1); },
    [scrollByCard],
  );

  const playBanner = useCallback(
    (bannerItem: typeof banners[number], e: React.MouseEvent) => {
      e.stopPropagation();
      if (!bannerItem?.redirectType) return;

      if (bannerItem.redirectType === "song") {
        const track = mappedSongs.find((s) => s.id === bannerItem.redirectId);
        if (track) playTrack(track, mappedSongs);
      } else if (bannerItem.redirectType === "artist") {
        navigate(`/artist/${bannerItem.redirectId}`);
      } else if (bannerItem.redirectType === "section") {
        navigate(`/section/${bannerItem.redirectId}`);
      }
    },
    [mappedSongs, navigate, playTrack],
  );

  const trackGutter: React.CSSProperties = {
    paddingLeft: `calc(var(--sidebar-inset) + ${GUTTER_LEFT_PX})`,
    scrollPaddingLeft: `calc(var(--sidebar-inset) + ${GUTTER_LEFT_PX})`,
    scrollbarWidth: "none",
    msOverflowStyle: "none",
  };

  const arrowLeftStyle: React.CSSProperties = {
    left: `calc(var(--sidebar-inset) + 8px)`,
  };

  if (loading) {
    return (
      <div
        className="flex gap-5 overflow-hidden pr-6 md:pr-8 lg:pr-10"
        style={{ paddingLeft: `calc(var(--sidebar-inset) + ${GUTTER_LEFT_PX})` }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`flex-shrink-0 ${CARD_WIDTH_CLASSES}`}
          >
            <div style={{ width: 140, height: 12, borderRadius: 4, background: "rgba(255,255,255,0.08)", marginBottom: 10 }} />
            <div style={{ width: "80%", height: 18, borderRadius: 4, background: "rgba(255,255,255,0.1)", marginBottom: 8 }} />
            <div style={{ width: "60%", height: 14, borderRadius: 4, background: "rgba(255,255,255,0.06)", marginBottom: 14 }} />
            <div
              className="w-full animate-pulse"
              style={{
                aspectRatio: "4 / 3",
                borderRadius: 12,
                background: "rgba(255,255,255,0.04)",
                border: "0.5px solid rgba(255,255,255,0.07)",
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  if (!total) {
    return (
      <div
        className="w-full flex items-center justify-center mr-6 md:mr-8 lg:mr-10"
        style={{
          height: 220,
          borderRadius: 16,
          background: "transparent",
          border: "0.5px solid rgba(255,255,255,0.07)",
          marginLeft: `calc(var(--sidebar-inset) + ${GUTTER_LEFT_PX})`,
        }}
      >
        <p style={{ fontSize: 13, color: "rgba(235,235,245,0.35)" }}>No featured banners</p>
      </div>
    );
  }

  const multiSlide = total > 1;

  return (
    <div
      className="relative w-full group/row overflow-visible"
      role="region"
      aria-roledescription="carousel"
      aria-label="Updated playlists"
    >
      <style>{`
        .banner-track::-webkit-scrollbar { display: none; }
      `}</style>

      {multiSlide && (
        <>
          <div
            className="hidden sm:flex absolute top-[calc(60%+18px)] -translate-y-1/2 z-20 opacity-0 group-hover/row:opacity-100 transition-opacity duration-200"
            style={arrowLeftStyle}
          >
            <NavArrow direction="left" onClick={goPrev} visible={canScrollPrev} />
          </div>
          <div className="hidden sm:flex absolute right-2 md:right-4 lg:right-6 top-[calc(60%+18px)] -translate-y-1/2 z-20 opacity-0 group-hover/row:opacity-100 transition-opacity duration-200">
            <NavArrow direction="right" onClick={goNext} visible={canScrollNext} />
          </div>
        </>
      )}

      <div
        ref={trackRef}
        className="banner-track flex gap-5 overflow-x-auto pb-1 scroll-smooth snap-x snap-mandatory"
        style={trackGutter}
      >
        {banners.map((banner, i) => {
          const isActive = i === current;
          return (
            <motion.div
              key={banner.id}
              className={`flex-shrink-0 snap-start ${CARD_WIDTH_CLASSES}`}
              style={{ cursor: "pointer" }}
              onClick={() => goTo(i)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE_APPLE, delay: i * 0.04 }}
            >
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "rgba(235,235,245,0.45)",
                  marginBottom: 0,
                }}
              >
                {banner.eyebrow || "Updated playlist"}
              </p>

              <h3
                className="line-clamp-1"
                style={{
                  fontSize: 19,
                  fontWeight: 500,
                  letterSpacing: "-0.01em",
                  color: "#f5f5f7",
                  marginBottom: 0,
                }}
              >
                {banner.title}
              </h3>

              {banner.subtitle && (
                <p
                  className="line-clamp-1"
                  style={{
                    fontSize: 15,
                    color: "rgba(235,235,245,0.5)",
                    marginBottom: 12,
                  }}
                >
                  {banner.subtitle}
                </p>
              )}

              <div
                className="relative w-full overflow-hidden group/card"
                style={{
                  aspectRatio: "16 / 9",
                  borderRadius: 12,
                  outline: isActive ? "2px solid rgba(255,255,255,0.5)" : "none",
                  outlineOffset: 2,
                }}
              >
                {banner.mediaType === "video" && banner.mediaUrl ? (
                  <video
                    src={banner.mediaUrl}
                    autoPlay={isActive}
                    muted loop playsInline
                    className="w-full h-full object-cover pointer-events-none"
                  />
                ) : (
                  <img
                    src={banner.imageUrl}
                    alt={banner.title}
                    draggable={false}
                    className="w-full h-full object-cover pointer-events-none select-none transition-transform duration-500 group-hover/card:scale-[1.03]"
                  />
                )}

                {banner.caption && (
                  <p
                    className="absolute left-3.5 bottom-3.5 right-14 line-clamp-1 pointer-events-none"
                    style={{
                      fontSize: 12,
                      fontWeight: 400,
                      color: "rgba(255,255,255,0.92)",
                      textShadow: "0 1px 6px rgba(0,0,0,0.5)",
                    }}
                  >
                    {banner.caption || "Premix Ad"}
                  </p>
                )}

                <button
                  onClick={(e) => playBanner(banner, e)}
                  aria-label={`Play ${banner.title}`}
                  className="absolute right-3.5 bottom-3.5 flex items-center justify-center rounded-full transition-all duration-200"
                  style={{
                    width: 30,
                    height: 30,
                    background: "rgba(0,0,0,0.4)",
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#fa243c"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.4)"; }}
                >
                  <PlayArrowRoundedIcon sx={{ fontSize: 24, color: "#fff", marginLeft: "1px" }} />
                </button>
              </div>
            </motion.div>
          );
        })}

        <div className="flex-shrink-0 w-0 md:w-2 lg:w-4" aria-hidden="true" />
      </div>
    </div>
  );
};

export default FeaturedBanner;