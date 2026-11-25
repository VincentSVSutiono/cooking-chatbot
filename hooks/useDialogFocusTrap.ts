"use client";

import { useEffect, useRef, type RefObject } from "react";

interface UseDialogFocusTrapOptions {
  /** Whether the modal dialog is currently open (defaults to true for conditional mounts). */
  isOpen?: boolean;
  /** Disables Escape dismissal and Tab cycling while an async action is pending. */
  isLocked?: boolean;
  /** First interactive element in the dialog (focused on open). */
  firstFocusRef: RefObject<HTMLElement | null>;
  /** Last interactive element in the dialog for wrapping Tab / Shift+Tab. */
  lastFocusRef: RefObject<HTMLElement | null>;
  /** Called when the user presses Escape while unlocked. */
  onEscape: () => void;
}

/**
 * Manages modal accessibility while a dialog is open:
 * moves focus to `firstFocusRef` on open, restores the previously focused element on close,
 * handles Escape dismissal cleanly, and traps Tab / Shift+Tab between the two boundary refs.
 */
export function useDialogFocusTrap({
  isOpen = true,
  isLocked = false,
  firstFocusRef,
  lastFocusRef,
  onEscape,
}: UseDialogFocusTrapOptions) {
  const onEscapeRef = useRef(onEscape);

  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    firstFocusRef.current?.focus();

    return () => {
      if (previousFocus?.isConnected) {
        previousFocus.focus();
      }
    };
  }, [isOpen, firstFocusRef]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopImmediatePropagation();
        if (!isLocked) {
          onEscapeRef.current();
        }
        return;
      }

      if (event.key === "Tab") {
        event.preventDefault();
        if (isLocked) {
          return;
        }

        const firstEl = firstFocusRef.current;
        const lastEl = lastFocusRef.current;
        if (!firstEl || !lastEl) {
          return;
        }

        if (event.shiftKey) {
          if (document.activeElement === firstEl) {
            lastEl.focus();
          } else {
            firstEl.focus();
          }
        } else if (document.activeElement === lastEl) {
          firstEl.focus();
        } else {
          lastEl.focus();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, isLocked, firstFocusRef, lastFocusRef]);
}
