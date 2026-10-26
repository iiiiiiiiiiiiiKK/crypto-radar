import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  loadWatchlists,
  safeStorage,
  saveSettings,
  saveWatchlists,
} from "@/services/storage";

describe("safeStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("round-trips a value", () => {
    expect(safeStorage.set("probe", { a: 1 })).toBe(true);
    expect(safeStorage.get("probe", null)).toEqual({ a: 1 });
  });

  it("returns the fallback for a missing key", () => {
    expect(safeStorage.get("missing", "fallback")).toBe("fallback");
  });

  it("recovers from corrupted payloads", () => {
    window.localStorage.setItem("broken", "{not json");
    expect(safeStorage.get("broken", { ok: true })).toEqual({ ok: true });
    expect(window.localStorage.getItem("broken")).toBeNull();
  });
});

describe("watchlists", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("creates the default lists on a first run", () => {
    const lists = loadWatchlists();
    expect(lists.length).toBeGreaterThan(0);
    expect(lists.every((list) => list.entries.length === 0)).toBe(true);
  });

  it("persists and restores the lists", () => {
    const lists = loadWatchlists();
    lists[0].entries.push({
      key: "spot:BTCUSDT",
      market: "spot",
      symbol: "BTCUSDT",
      addedAt: 1,
    });
    expect(saveWatchlists(lists)).toBe(true);
    const restored = loadWatchlists();
    expect(restored[0].entries[0].symbol).toBe("BTCUSDT");
  });

  it("drops corrupted entries instead of crashing", () => {
    window.localStorage.setItem(
      "crypto-radar:watchlists:v1",
      JSON.stringify([{ id: "a", name: "A", createdAt: 1, entries: [{ broken: true }] }]),
    );
    const lists = loadWatchlists();
    expect(lists[0].entries).toHaveLength(0);
  });
});

describe("settings", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("falls back to the defaults", () => {
    const settings = loadSettings();
    expect(settings.language).toBe(DEFAULT_SETTINGS.language);
    expect(settings.density).toBe(DEFAULT_SETTINGS.density);
  });

  it("persists the language and density", () => {
    const settings = loadSettings();
    settings.language = "en";
    settings.density = "roomy";
    saveSettings(settings);
    const restored = loadSettings();
    expect(restored.language).toBe("en");
    expect(restored.density).toBe("roomy");
  });
});
