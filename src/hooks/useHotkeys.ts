import { useEffect } from "react";

export interface HotkeyHandlers {
  onSearch?: () => void;
  onEscape?: () => void;
  onDigit?: (digit: "1" | "2" | "3") => void;
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

/**
 * Global keyboard shortcuts. They are ignored while the user is typing in an
 * input, textarea, select or contenteditable element.
 */
export function useHotkeys(handlers: HotkeyHandlers, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handlers.onEscape?.();
        return;
      }
      if (isEditable(event.target)) return;
      if (event.key === "/") {
        event.preventDefault();
        handlers.onSearch?.();
        return;
      }
      if (event.key === "1" || event.key === "2" || event.key === "3") {
        handlers.onDigit?.(event.key);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handlers, enabled]);
}
