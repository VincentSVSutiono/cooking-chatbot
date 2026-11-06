"use client";

import { useEffect, type RefObject } from "react";

/**
 * Automatically adjusts a textarea's height based on content and viewport dimensions,
 * capping appropriately across mobile, tablet, landscape, and desktop viewports.
 */
export function useAutogrowTextarea(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  value: string,
) {
  useEffect(() => {
    function adjustHeight() {
      const textarea = textareaRef.current;
      if (!textarea) return;

      textarea.style.height = "auto";
      const vh = window.visualViewport
        ? window.visualViewport.height
        : window.innerHeight;
      const vw = window.innerWidth;

      // Keep 5 lines (~128-144px) comfortably visible without feeling cramped
      let maxHeight = 160;
      if (vh < 350) {
        maxHeight = 112; // Extremely short landscape viewports (e.g. phones in horizontal)
      } else if (vw >= 768) {
        maxHeight = 160; // Tablet & desktop: 5-6 full lines
      } else {
        maxHeight = 128; // Mobile portrait: 5 full lines
      }

      textarea.style.height = `${Math.max(
        28,
        Math.min(textarea.scrollHeight, maxHeight),
      )}px`;
    }

    adjustHeight();
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", adjustHeight);
    }
    window.addEventListener("resize", adjustHeight);

    return () => {
      if (vv) {
        vv.removeEventListener("resize", adjustHeight);
      }
      window.removeEventListener("resize", adjustHeight);
    };
  }, [textareaRef, value]);
}
