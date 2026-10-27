import { useEffect } from "react";
import { useSettingsStore } from "@/stores/settingsStore";

/** Mirrors the chosen theme onto <html data-theme>. */
export function ThemeSync() {
  const theme = useSettingsStore((state) => state.theme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return null;
}
