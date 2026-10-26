import { useCallback } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import { translate } from "@/i18n";

export type Translate = (path: string) => string;

export function useI18n(): { t: Translate; language: "zh" | "en"; toggle: () => void } {
  const language = useSettingsStore((state) => state.language);
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  const t = useCallback<Translate>((path) => translate(language, path), [language]);
  const toggle = useCallback(
    () => setLanguage(language === "zh" ? "en" : "zh"),
    [language, setLanguage],
  );
  return { t, language, toggle };
}
