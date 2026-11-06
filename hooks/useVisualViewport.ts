"use client";

import { useEffect, useCallback, useRef } from "react";

/**
 * Synchronizes the app container height and position with the physical
 * visual viewport via CSS variables on :root (--app-viewport-height and --app-viewport-top).
 * This prevents virtual keyboards on mobile/tablets from obscuring the chat bar.
 */
export function useVisualViewport() {
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearPendingTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  }, []);

  const updateViewport = useCallback(() => {
    if (typeof window !== "undefined") {
      const height = window.visualViewport
        ? window.visualViewport.height
        : window.innerHeight;
      const top = window.visualViewport
        ? window.visualViewport.offsetTop
        : 0;

      document.documentElement.style.setProperty(
        "--app-viewport-height",
        `${height}px`,
      );
      document.documentElement.style.setProperty(
        "--app-viewport-top",
        `${top}px`,
      );
    }
  }, []);

  useEffect(() => {
    updateViewport();

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", updateViewport);
      vv.addEventListener("scroll", updateViewport);
    }
    window.addEventListener("resize", updateViewport);

    return () => {
      clearPendingTimeouts();
      if (vv) {
        vv.removeEventListener("resize", updateViewport);
        vv.removeEventListener("scroll", updateViewport);
      }
      window.removeEventListener("resize", updateViewport);
    };
  }, [updateViewport, clearPendingTimeouts]);

  // Poll viewport during on-screen keyboard animation
  const handleFocus = useCallback(() => {
    clearPendingTimeouts();
    updateViewport();
    timeoutsRef.current = [
      setTimeout(updateViewport, 100),
      setTimeout(updateViewport, 300),
      setTimeout(updateViewport, 500),
    ];
  }, [updateViewport, clearPendingTimeouts]);

  const handleBlur = useCallback(() => {
    clearPendingTimeouts();
    updateViewport();
    timeoutsRef.current = [
      setTimeout(updateViewport, 100),
      setTimeout(updateViewport, 300),
    ];
  }, [updateViewport, clearPendingTimeouts]);

  return { handleFocus, handleBlur };
}
