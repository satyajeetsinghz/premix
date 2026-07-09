import {
    useLayoutEffect,
    useRef,
    useState,
} from "react";

interface InlineClampedDescriptionProps {
    text: string;
    lines?: number;
    className?: string;
    onMore: () => void;
}

export default function InlineClampedDescription({
    text,
    lines = 2,
    className = "",
    onMore,
}: InlineClampedDescriptionProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    const [displayText, setDisplayText] = useState(text);
    const [truncated, setTruncated] = useState(false);

    useLayoutEffect(() => {
        const container = containerRef.current;

        if (!container) return;

        const calculate = () => {
            const width = container.clientWidth;

            const measure = document.createElement("span");

            measure.style.visibility = "hidden";
            measure.style.position = "fixed";
            measure.style.left = "-9999px";

            measure.style.fontSize = "13px";
            measure.style.lineHeight = "1.6";
            measure.style.fontFamily = "inherit";
            measure.style.width = `${width}px`;
            measure.style.whiteSpace = "normal";

            document.body.appendChild(measure);

            const fullText = text;

            measure.innerText = fullText;

            const lineHeight = 13 * 1.6;
            const maxHeight = lineHeight * lines;

            if (measure.offsetHeight <= maxHeight) {
                setDisplayText(fullText);
                setTruncated(false);

                document.body.removeChild(measure);
                return;
            }

            let low = 0;
            let high = fullText.length;
            let best = "";

            while (low <= high) {
                const mid = Math.floor((low + high) / 2);

                const candidate =
                    fullText.slice(0, mid) + "... MORE";

                measure.innerText = candidate;

                if (measure.offsetHeight <= maxHeight) {
                    best = fullText.slice(0, mid);
                    low = mid + 1;
                } else {
                    high = mid - 1;
                }
            }

            document.body.removeChild(measure);

            setDisplayText(best);
            setTruncated(true);
        };

        calculate();

        const observer = new ResizeObserver(calculate);

        observer.observe(container);

        return () => observer.disconnect();
    }, [text, lines]);

    return (
        <div
            ref={containerRef}
            className={className}
        >
            <p
                style={{
                    color: "rgba(235,235,245,.6)",
                    fontSize: 13,
                    lineHeight: 1.5,
                }}
            >
                {displayText}

                {truncated && (
                    <>
                        {"... "}
                        <button
                            onClick={onMore}
                            className="
                inline
                font-semibold
                text-white
                hover:opacity-70
              "
                        >
                            MORE
                        </button>
                    </>
                )}
            </p>
        </div>
    );
}