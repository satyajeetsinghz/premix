import { Share, Link2, Code2 } from "lucide-react";
import { useRef, type ReactNode } from "react";

interface ContextMenuItem {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  destructive?: boolean;
}

const PRIMARY = "#fa243c";

function AppleContextMenu({
  items,
  header,
  className = "",
  style,
}: {
  items: ContextMenuItem[];
  header?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  return (
    <>
      <style>{`
        @keyframes appleMenu {
          from {
            opacity: 0;
            transform: translateY(6px) scale(.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .apple-context-scroll::-webkit-scrollbar {
          width: 4px;
        }

        .apple-context-scroll::-webkit-scrollbar-track {
          background: transparent;
        }

        .apple-context-scroll::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,.14);
          border-radius: 999px;
        }

        .apple-context-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,.14) transparent;
        }
      `}</style>

      <div
        role="menu"
        className={`rounded-[14px] overflow-hidden ${className}`}
        style={{
          minWidth: 220,
          maxWidth: 270,

          // Apple Music Web dark translucent glass
          background: `
            linear-gradient(
              180deg,
              rgba(24,24,26,.82) 0%,
              rgba(18,18,20,.88) 100%
            )
          `,

          backdropFilter: "blur(34px) saturate(165%)",
          WebkitBackdropFilter: "blur(34px) saturate(165%)",

          border: "0.5px solid rgba(255,255,255,.07)",

          boxShadow: `
            0 24px 64px rgba(0,0,0,.72),
            0 10px 24px rgba(0,0,0,.45),
            inset 0 1px rgba(255,255,255,.04)
          `,

          animation: "appleMenu .18s cubic-bezier(.22,1,.36,1)",

          overflow: "hidden",

          ...style,
        }}
      >
        {header && (
          <div
            style={{
              padding: "10px 16px 12px",
              borderBottom: "0.5px solid rgba(255,255,255,.055)",
            }}
          >
            {header}
          </div>
        )}

        <div
          ref={scrollRef}
          className="apple-context-scroll"
          style={{
            maxHeight: 260,
            overflowY: "auto",
          }}
        >
          {items.map((item, index) => (
            <div key={item.label}>
              <button
                role="menuitem"
                onClick={item.onClick}
                className="w-full flex items-center justify-between px-4 py-[13px] text-left transition-colors duration-150"
                style={{
                  color: item.destructive
                    ? PRIMARY
                    : "rgba(255,255,255,.92)",

                  fontSize: 14.5,
                  fontWeight: 400,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    "rgba(255,255,255,.055)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <span>{item.label}</span>

                <span
                  className="flex items-center justify-center ml-6 flex-shrink-0"
                  style={{
                    color: item.destructive
                      ? PRIMARY
                      : "rgba(255,255,255,.62)",
                  }}
                >
                  {item.icon}
                </span>
              </button>

              {index !== items.length - 1 && (
                <div
                  style={{
                    height: 0.5,
                    background: "rgba(255,255,255,.055)",
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Example                                                                     */
/* -------------------------------------------------------------------------- */

function ShareMenuExample({ onClose }: { onClose: () => void }) {
  return (
    <AppleContextMenu
      className="absolute"
      style={{
        top: "100%",
        right: 0,
        marginTop: 8,
        zIndex: 100,
      }}
      items={[
        {
          label: "Share",
          icon: <Share size={16} strokeWidth={1.75} />,
          onClick: () => {
            // Share
            onClose();
          },
        },
        {
          label: "Copy Link",
          icon: <Link2 size={16} strokeWidth={1.75} />,
          onClick: () => {
            // Copy Link
            onClose();
          },
        },
        {
          label: "Copy Embed Code",
          icon: <Code2 size={16} strokeWidth={1.75} />,
          onClick: () => {
            // Copy Embed Code
            onClose();
          },
        },
      ]}
    />
  );
}

export default AppleContextMenu;
export { ShareMenuExample };