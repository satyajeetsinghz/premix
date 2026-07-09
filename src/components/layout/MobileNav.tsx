import { Link, useLocation } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import HomeIcon from "@mui/icons-material/Home";
import LibraryMusicIcon from "@mui/icons-material/LibraryMusic";
import PersonIcon from "@mui/icons-material/Person";
import { useResponsive } from "./hooks/useResponsive";

const navItems = [
  { path: "/", icon: HomeIcon, label: "Home", accent: "#fa586a" },
  { path: "/library", icon: LibraryMusicIcon, label: "Library", accent: "#fa586a" },
  { path: "/profile", icon: PersonIcon, label: "Profile", accent: "#fa586a" },
];

export default function MobileNav() {
  const { pathname } = useLocation();
  const reduceMotion = useReducedMotion();

  const { isMobile } = useResponsive();
  // Hide on tablet and desktop
  if (!isMobile) return null;

  return (
    <nav
      className="
        fixed left-1/2 -translate-x-1/2 bottom-3 z-40
        w-[calc(100vw-24px)] max-w-[430px]
        rounded-full border border-white/[0.08]
        shadow-[0_8px_30px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)]
      "
      style={{
        borderRadius: 100,
        pointerEvents: "auto",
        background: "rgba(31, 31, 31, 0.55)", // #1f1f1f translucent glass tint

        backdropFilter: "blur(30px) saturate(180%) brightness(1.05)",
        WebkitBackdropFilter: "blur(30px) saturate(180%) brightness(1.05)",

        border: "1px solid rgba(255,255,255,0.06)",

        boxShadow: `
    inset 0 1px 0 rgba(255,255,255,0.08),
    inset 0 -1px 0 rgba(255,255,255,0.02),
    0 12px 40px rgba(0,0,0,0.35)
  `,
      }}
    >
      <div className="relative flex items-center justify-between px-1.5 py-1.5">
        {navItems.map(({ path, icon: Icon, label, accent }) => {
          const active = pathname === path;

          return (
            <Link
              key={path}
              to={path}
              className="relative flex flex-col items-center justify-center rounded-full px-8 py-1.5 z-10"
            >
              {/* shared liquid pill — same layoutId mechanism as light mode,
                  re-tinted to a dark glass capsule lifted off the bar */}
              {active && (
                <motion.span
                  layoutId="liquid-pill-dark"
                  className="absolute inset-0 rounded-full"
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 480, damping: 28, mass: 0.9 }
                  }
                  style={{
                    background: "rgba(60, 60, 60, 0.55)", // lifted glass tint, same family as #1f1f1f

                    backdropFilter: "blur(30px) saturate(180%) brightness(1.1)",
                    WebkitBackdropFilter: "blur(30px) saturate(180%) brightness(1.1)",

                    border: "1px solid rgba(255,255,255,0.08)",

                    boxShadow: `
        inset 0 1px 0 rgba(255,255,255,0.12),
        inset 0 -1px 0 rgba(255,255,255,0.03),
        0 4px 16px rgba(0,0,0,0.3)
      `,
                  }}
                />
              )}

              <motion.div
                animate={
                  active && !reduceMotion
                    ? { scale: [1, 1.22, 0.94, 1] }
                    : { scale: 1 }
                }
                transition={{ duration: 0.42, times: [0, 0.35, 0.7, 1], ease: "easeOut" }}
                className="relative flex flex-col items-center"
              >
                <Icon
                  sx={{
                    fontSize: 26,
                    color: active ? accent : "rgba(235,235,245,0.55)",
                    filter: active
                      ? `none`
                      : "none",
                    transition: "color 200ms ease, filter 200ms ease",
                  }}
                />
                <span
                  className={`text-[10px] mt-0.5 transition-colors duration-200 ${active ? "font-medium" : "font-normal"
                    }`}
                  style={{ color: active ? accent : "rgba(235,235,245,0.55)" }}
                >
                  {label}
                </span>
              </motion.div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}