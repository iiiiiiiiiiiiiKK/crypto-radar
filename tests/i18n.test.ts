import { describe, expect, it } from "vitest";
import { dictionary, translate } from "@/i18n";

describe("i18n", () => {
  it("returns the Chinese string for a known key", () => {
    expect(translate("zh", "nav.spot")).toBe(dictionary.zh.nav.spot);
  });

  it("returns the English string for a known key", () => {
    expect(translate("en", "nav.spot")).toBe(dictionary.en.nav.spot);
  });

  it("falls back to the key path when the entry is missing", () => {
    expect(translate("en", "does.not.exist")).toBe("does.not.exist");
  });

  it("keeps both dictionaries structurally aligned", () => {
    const zhKeys = Object.keys(dictionary.zh).sort();
    const enKeys = Object.keys(dictionary.en).sort();
    expect(enKeys).toEqual(zhKeys);
    for (const key of zhKeys) {
      if (typeof dictionary.zh[key as keyof typeof dictionary.zh] === "object") {
        const zhNested = Object.keys(
          dictionary.zh[key as keyof typeof dictionary.zh] as Record<string, unknown>,
        ).sort();
        const enNested = Object.keys(
          dictionary.en[key as keyof typeof dictionary.en] as Record<string, unknown>,
        ).sort();
        expect(enNested).toEqual(zhNested);
      }
    }
  });
});
