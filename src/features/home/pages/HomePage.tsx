/**
 * @fileoverview HomePage — Apple Music Web Player dark glass aesthetic.
 *
 * Structural fix (this pass): RecentlyPlayed and every DynamicSection are
 * NO LONGER nested inside the max-w-[1400px] mx-auto wrapper. They're now
 * full-width siblings, exactly like FeaturedBanner — this is required for
 * SectionShell's var(--sidebar-inset) breakout to reach the TRUE viewport
 * edge; a %-based margin/width cancellation cannot escape a max-width
 * ancestor, only removing that ancestor can. Only EmptyState (which
 * doesn't scroll and benefits from a readable, centered width) remains
 * inside a max-w-[1400px] wrapper.
 *
 * Heading alignment fix: the greeting header's padding now uses the SAME
 * GUTTER_STATIC_CLASS every scrollable row's track composes its own
 * padding from — guaranteeing the header, FeaturedBanner's cards,
 * RecentlyPlayed's cards, and every DynamicSection's cards all start at
 * an identical x-position at rest, on every screen size.
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/services/firebase/config";
import { useNavigate } from "react-router-dom";

import FeaturedBanner from "@/features/banner/components/FeaturedBanner";
import RecentlyPlayed from "@/features/history/components/RecentlyPlayed";
import { DynamicSection } from "@/features/sections/components/DynamicSection";
import { useSections } from "@/features/sections/hooks/useSections";
import { useAuth } from "@/features/auth/hooks/useAuth";
import AnimatedSpinner from "@/components/ui/LoadingSpinner/AnimatedSpinner";

import MusicNoteIcon from "@mui/icons-material/MusicNote";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";

const PRIMARY = "#fc3c44";

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

const HomePage = () => {
  const { user } = useAuth();
  const { sections, loading: sectionsLoading } = useSections();
  const navigate = useNavigate();

  const [hasSongs, setHasSongs] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    if (sections.length > 0) return;
    const q = query(collection(db, "songs"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => setHasSongs(!snap.empty));
    return () => unsub();
  }, [sections.length]);

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const sectionElements = useMemo(
    () =>
      sections.map((section, i) => (
        <section
          key={section.id}
          style={{ animationDelay: `${i * 80}ms` }}
          className="animate-fadeIn mt-10"
        >
          <DynamicSection section={section} />
        </section>
      )),
    [sections],
  );

  if (sectionsLoading) {
    return (
      <div
        className="flex items-center justify-center min-h-screen"
        style={{ background: "transparent", paddingLeft: "var(--sidebar-inset)" }}
      >
        <div className="flex flex-col items-center gap-4">
          <AnimatedSpinner size={28} color={PRIMARY} />
          <p style={{ fontSize: 13, color: "#636366" }}>Loading your music…</p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "transparent",
        minHeight: "100%",
        paddingLeft: "var(--sidebar-inset)",
      }}
    >
      {/* ── greeting header — GUTTER_STATIC_CLASS is the exact same
             gutter every scrollable row's track composes into its own
             padding, so this heading aligns with every card row below. ── */}
      <header
        className={`flex items-end justify-between pt-5 pb-3 px-6`}
        style={{
          background: "transparent",
          backdropFilter: "saturate(180%) blur(20px)",
          WebkitBackdropFilter: "saturate(180%) blur(20px)",
          borderBottom: "0.5px solid rgba(255,255,255,0.06)",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "clamp(22px, 3vw, 28px)",
              fontWeight: 600,
              color: "#f5f5f7",
              letterSpacing: "-0.5px",
              lineHeight: 1.2,
            }}
          >
            {getGreeting()}
          </h1>
          <p style={{ fontSize: 13, color: "#636366", marginTop: 2 }}>
            Picked for you · Updated today
          </p>
        </div>

        <TabStrip
          tabs={["Browse", "Library", "Radio"]}
          onSelect={(tab) => {
            if (tab === "Library") navigate("/library");
            if (tab === "Radio") navigate("/radio");
          }}
        />
      </header>

      {/* ── FeaturedBanner — full-width sibling, cancels the page's
             sidebar inset for its own row only ── */}
      <section
        className="mt-6"
        style={{
          marginLeft: "calc(-1 * var(--sidebar-inset))",
          width: "calc(100% + var(--sidebar-inset))",
        }}
      >
        <FeaturedBanner />
      </section>

      {/* ── Recently played — now a full-width sibling too (moved OUT of
             the max-w-1400 wrapper), so SectionShell's own breakout can
             reach the true edge. authenticated users only. ── */}
      {user && (
        <section className="animate-fadeIn mt-10">
          <RecentlyPlayed />
        </section>
      )}

      {/* ── Admin-configured dynamic sections — same reasoning ── */}
      {sectionElements}

      {/* ── Empty state — the only remaining constrained/centered block,
             since it doesn't scroll and reads better at a bounded width ── */}
      {sections.length === 0 && !hasSongs && (
        <div className="px-4 md:px-8 lg:px-10 mt-10 max-w-[1400px] mx-auto">
          <EmptyState />
        </div>
      )}

      <div style={{ height: 32 }} />

      {showScrollTop && (
        <button
          onClick={scrollToTop}
          aria-label="Scroll to top"
          className="fixed right-5 md:right-8 z-50 flex items-center justify-center rounded-full text-white shadow-lg transition-all hover:scale-110"
          style={{
            bottom: 108,
            width: 36,
            height: 36,
            background: "rgba(44,44,46,0.9)",
            backdropFilter: "blur(12px)",
            border: "0.5px solid rgba(255,255,255,0.14)",
          }}
        >
          <KeyboardArrowUpIcon sx={{ fontSize: 20 }} />
        </button>
      )}
    </div>
  );
};

const TabStrip = ({
  tabs,
  onSelect,
}: {
  tabs: string[];
  onSelect: (tab: string) => void;
}) => {
  const [active, setActive] = useState(0);

  return (
    <div
      className="hidden sm:flex items-center gap-0.5 rounded-full p-[4px]"
      style={{ background: "rgba(255,255,255,0.06)" }}
      role="tablist"
    >
      {tabs.map((tab, i) => (
        <button
          key={tab}
          role="tab"
          aria-selected={active === i}
          onClick={() => {
            setActive(i);
            onSelect(tab);
          }}
          className="px-3 py-1.5 rounded-full transition-all duration-100"
          style={{
            fontSize: 12,
            fontWeight: active === i ? 500 : 400,
            color: active === i ? "#f5f5f7" : "#636366",
            background: active === i ? "rgba(255,255,255,0.12)" : "transparent",
            letterSpacing: "-0.1px",
          }}
        >
          {tab}
        </button>
      ))}
    </div>
  );
};

const EmptyState = () => {
  const navigate = useNavigate();
  return (
    <div
      className="flex flex-col items-center justify-center py-20 px-6 text-center rounded-2xl"
      style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.07)" }}
    >
      <div
        className="flex items-center justify-center rounded-full mb-5"
        style={{
          width: 64,
          height: 64,
          background: `
    linear-gradient(
      180deg,
      rgba(42,42,44,0.92) 0%,
      rgba(31,31,31,0.88) 45%,
      rgba(22,22,24,0.92) 100%
    )
  `,
        }}
      >
        <MusicNoteIcon sx={{ fontSize: 28 }} style={{ color: "#48484a" }} />
      </div>

      <p style={{ fontSize: 17, fontWeight: 600, color: "#f5f5f7", letterSpacing: "-0.3px" }}>
        Welcome to Premix
      </p>
      <p className="mt-2 mb-7 max-w-xs leading-relaxed" style={{ fontSize: 13, color: "#636366" }}>
        Add your favourite tracks to get personalised recommendations.
      </p>

      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/search")}
          className="px-5 py-2.5 rounded-full font-semibold text-white transition-colors"
          style={{ fontSize: 13, background: PRIMARY }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#e0333b"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = PRIMARY; }}
        >
          Browse Music
        </button>
        <button
          onClick={() => navigate("/library")}
          className="px-5 py-2.5 rounded-full font-semibold transition-colors"
          style={{
            fontSize: 13,
            color: "#f5f5f7",
            background: "rgba(255,255,255,0.08)",
            border: "0.5px solid rgba(255,255,255,0.12)",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.13)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
        >
          Your Library
        </button>
      </div>
    </div>
  );
};

export default HomePage;