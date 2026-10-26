import { dictionary, type Dictionary } from "./dictionary";
import type { Language } from "@/types/market";

export { dictionary };
export type { Dictionary };

export function translate(
  language: Language,
  path: string,
): string {
  const keys = path.split(".");
  let current: unknown = dictionary[language];
  for (const key of keys) {
    if (current && typeof current === "object" && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return path;
    }
  }
  return typeof current === "string" ? current : path;
}

export function buildTranslator(language: Language) {
  return (path: string) => translate(language, path);
}
