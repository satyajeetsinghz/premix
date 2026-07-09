import {
  useState,
  useRef,
  useCallback,
  useMemo,
  useLayoutEffect,
  RefObject,
} from "react";

interface UseHorizontalScrollResult {
  ref: RefObject<HTMLDivElement | null>;
  showLeft: boolean;
  showRight: boolean;
  isScrollable: boolean;
  onScroll: () => void;
  scrollLeft: () => void;
  scrollRight: () => void;
}

const SCROLL_THRESHOLD = 10;

const calculateState = (el: HTMLDivElement) => {
  const { scrollLeft, scrollWidth, clientWidth } = el;

  const isScrollable = scrollWidth > clientWidth + SCROLL_THRESHOLD;

  if (!isScrollable) {
    return {
      isScrollable: false,
      showLeft: false,
      showRight: false,
    };
  }

  const atLeft = scrollLeft <= SCROLL_THRESHOLD;

  const atRight =
    scrollLeft >=
    scrollWidth - clientWidth - SCROLL_THRESHOLD;

  return {
    isScrollable: true,
    showLeft: !atLeft,
    showRight: !atRight,
  };
};

export const useHorizontalScroll = (
  scrollAmount = 320,
): UseHorizontalScrollResult => {
  const ref = useRef<HTMLDivElement>(null);

  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);
  const [isScrollable, setIsScrollable] = useState(false);

  const updateState = useCallback(() => {
    const el = ref.current;

    if (!el) return;

    const next = calculateState(el);

    setShowLeft(next.showLeft);
    setShowRight(next.showRight);
    setIsScrollable(next.isScrollable);
  }, []);

  const onScroll = useCallback(() => {
    updateState();
  }, [updateState]);

  useLayoutEffect(() => {
    const el = ref.current;

    if (!el) return;

    updateState();

    const resizeObserver = new ResizeObserver(() => {
      updateState();
    });

    resizeObserver.observe(el);

    window.addEventListener("resize", updateState);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateState);
    };
  }, [updateState]);

  const scrollLeft = useCallback(() => {
    const el = ref.current;

    if (!el) return;

    try {
      el.scrollBy({
        left: -scrollAmount,
        behavior: "smooth",
      });
    } catch (err) {
      console.warn(
        "useHorizontalScroll: failed to scroll left",
        err,
      );
    }
  }, [scrollAmount]);

  const scrollRight = useCallback(() => {
    const el = ref.current;

    if (!el) return;

    try {
      el.scrollBy({
        left: scrollAmount,
        behavior: "smooth",
      });
    } catch (err) {
      console.warn(
        "useHorizontalScroll: failed to scroll right",
        err,
      );
    }
  }, [scrollAmount]);

  return useMemo(
    () => ({
      ref,
      showLeft,
      showRight,
      isScrollable,
      onScroll,
      scrollLeft,
      scrollRight,
    }),
    [
      showLeft,
      showRight,
      isScrollable,
      onScroll,
      scrollLeft,
      scrollRight,
    ],
  );
};