import { useCallback, useEffect, useRef, useState, type FocusEvent, type PointerEvent } from "react";

/** Playback chrome yields to the first caption, then hides after idle activity. */
export function useImmersiveControls(playing: boolean, pinned: boolean, hasCaptions = false) {
  const [visible, setVisible] = useState(true);
  const hovered = useRef(false);
  const focused = useRef(false);
  const previousCaptions = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const reveal = useCallback(() => {
    clearTimer();
    setVisible(true);
    if (playing && !pinned && !hovered.current && !focused.current) {
      timer.current = setTimeout(() => {
        timer.current = null;
        setVisible(false);
      }, 2000);
    }
  }, [clearTimer, playing, pinned]);

  useEffect(() => {
    const firstCaption = hasCaptions && !previousCaptions.current;
    previousCaptions.current = hasCaptions;
    if (firstCaption && playing && !pinned && !focused.current) {
      // A pointer parked over Send is not active interaction with the answer.
      // Clear hover without rerunning this effect and revealing the bar again.
      hovered.current = false;
      clearTimer();
      setVisible(false);
    } else {
      reveal();
    }
    return clearTimer;
  }, [hasCaptions, playing, pinned, reveal, clearTimer]);

  const onPointerEnter = useCallback((event?: PointerEvent<HTMLElement>) => {
    if (event?.pointerType === "touch") return;
    hovered.current = true;
    reveal();
  }, [reveal]);
  const onPointerLeave = useCallback(() => {
    // Hiding the bar may itself emit pointerleave; that must not reveal it.
    if (!hovered.current) return;
    hovered.current = false;
    reveal();
  }, [reveal]);
  const onFocusCapture = useCallback((event: FocusEvent<HTMLElement>) => {
    // Clicking Play also focuses it; only keyboard focus should pin the chrome.
    focused.current = event.target.matches(":focus-visible");
    reveal();
  }, [reveal]);
  const onBlurCapture = useCallback((event: FocusEvent<HTMLElement>) => {
    // Tabbing between controls must not start the hide countdown.
    if (focused.current && !event.currentTarget.contains(event.relatedTarget as Node | null)) {
      focused.current = false;
      reveal();
    }
  }, [reveal]);

  return { visible, reveal, onPointerEnter, onPointerLeave, onFocusCapture, onBlurCapture };
}
