import { useEffect, useState } from "react";

/**
 * Tracks a CSS media query. The mobile layout is a dedicated design, not a
 * squeezed desktop layout, so several components branch on this hook.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const list = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(list.matches);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** True on phones and small tablets — the breakpoint of the mobile design. */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)");
}
