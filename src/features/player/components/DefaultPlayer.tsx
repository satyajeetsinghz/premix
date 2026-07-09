import ShuffleRoundedIcon from "@mui/icons-material/ShuffleRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import RepeatRoundedIcon from "@mui/icons-material/RepeatRounded";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import QueueMusicRoundedIcon from "@mui/icons-material/QueueMusicRounded";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";
import { FastForwardRounded, FastRewindRounded } from "@mui/icons-material";

interface Props {
     mobileLogoSrc?: string;
    logoSrc?: string;
}

const IconBtn = ({
    children,
    style = {},
}: {
    children: React.ReactNode;
    style?: React.CSSProperties;
}) => (
    <button
        disabled
        className="flex items-center justify-center rounded-full"
        style={{
            color: "#ffffffeb",
            padding: "6px",
            ...style,
        }}
    >
        {children}
    </button>
);

const DefaultPlayerBar = ({
    mobileLogoSrc = "/premix_rounded_logo.png",
    logoSrc = "/premix-logo.png",
}: Props) => {
    return (
        <div
            className="
        absolute
        inset-x-0
        bottom-20
        sm:bottom-0
        z-50
        flex
        justify-center
        px-3
      "
            style={{
                paddingBottom: "max(12px, env(safe-area-inset-bottom))",
                pointerEvents: "none",
            }}
        >
            {/* ───────────────── MOBILE ───────────────── */}
            <div className="block md:hidden">
                <div
                    className="relative w-[min(420px,calc(100vw-24px))] overflow-hidden"
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
                    <div
                        className="flex items-center justify-between px-4"
                        style={{ height: 56 }}
                    >
                        {/* Left */}
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div
                                className="rounded-md overflow-hidden flex-shrink-0"
                                style={{
                                    width: 36,
                                    height: 36,
                                    boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                                }}
                            >
                                <picture>
                                    <source media="(min-width: 640px)" srcSet={logoSrc} />
                                    <img
                                        src={mobileLogoSrc}
                                        alt="Premix"
                                        className="w-full h-full object-cover"
                                    />
                                </picture>
                            </div>

                            <div>
                                <p
                                    style={{
                                        fontSize: 13,
                                        color: "#f5f5f7",
                                        fontWeight: 500,
                                    }}
                                >
                                    Premix
                                </p>

                                <p
                                    style={{
                                        fontSize: 11,
                                        color: "rgba(235,235,245,0.45)",
                                    }}
                                >
                                    Start listening
                                </p>
                            </div>
                        </div>

                        {/* Right */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                                disabled
                                className="flex items-center justify-center rounded-full"
                                style={{
                                    width: 36,
                                    height: 36,
                                    color: "#ffffffeb",
                                }}
                            >
                                <PlayArrowRoundedIcon sx={{ fontSize: 36, marginLeft: "1px" }} />
                            </button>

                            <button
                                disabled
                                className="flex items-center justify-center"
                                style={{
                                    width: 36,
                                    height: 36,
                                    color: "#ffffffeb",
                                }}
                            >
                                 <FastForwardRounded sx={{ fontSize: 34 }} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ───────────────── DESKTOP ───────────────── */}
            <div className="hidden md:block">
                <div
                    className="relative w-[min(660px,calc(100vw-32px))] overflow-hidden"
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
                    <div
                        className="flex items-center px-3"
                        style={{ height: 48 }}
                    >
                        {/* LEFT */}
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                            <IconBtn>
                                <ShuffleRoundedIcon sx={{ fontSize: 16 }} />
                            </IconBtn>

                            <IconBtn style={{ padding: 0 }}>
                                <FastRewindRounded sx={{ fontSize: 28 }} />
                            </IconBtn>

                            <button
                                disabled
                                className="flex items-center justify-center rounded-full flex-shrink-0"
                                style={{
                                    width: 34,
                                    height: 34,
                                    background: "transparent",
                                }}
                            >
                                <PlayArrowRoundedIcon sx={{ fontSize: 38, marginLeft: "" }} />
                            </button>

                            <IconBtn style={{ padding: 0 }}>
                               <FastForwardRounded sx={{ fontSize: 28 }} />
                            </IconBtn>

                            <IconBtn>
                                <RepeatRoundedIcon sx={{ fontSize: 16 }} />
                            </IconBtn>
                        </div>

                        {/* CENTER */}
                        <div
                            className="
    flex
    items-center
    gap-2.5
    flex-1
    min-w-0
    px-2.5
    mx-1
    justify-center
  "
                        >
                            <img
                                src={logoSrc}
                                alt="Premix"
                                className="h-20 w-20 object-contain"
                                style={{ filter: "drop-shadow(0 2px 12px rgba(0,0,0,0.4))" }}
                            />
                        </div>

                        {/* RIGHT */}
                        <div className="flex items-center gap-0.5">
                            <IconBtn>
                                <MoreHorizIcon sx={{ fontSize: 18 }} />
                            </IconBtn>

                            <IconBtn>
                                <QueueMusicRoundedIcon sx={{ fontSize: 16 }} />
                            </IconBtn>

                            <IconBtn>
                                <VolumeUpRoundedIcon sx={{ fontSize: 17 }} />
                            </IconBtn>

                            <div
                                style={{
                                    width: 64,
                                    height: 3,
                                    borderRadius: 999,
                                    background: "rgba(255,255,255,0.10)",
                                }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
};

export default DefaultPlayerBar;