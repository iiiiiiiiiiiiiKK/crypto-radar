import { beforeEach, describe, expect, it } from "vitest";
import { createRule, isRule, isTriggered, loadAlerts, saveAlerts } from "@/services/storage/alerts";

describe("alert storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("creates a valid rule", () => {
    const rule = createRule("spot", "BTCUSDT", "above", 80000);
    expect(isRule(rule)).toBe(true);
    expect(rule.enabled).toBe(true);
    expect(rule.triggeredAt).toBeNull();
  });

  it("round-trips through storage", () => {
    const rule = createRule("futures", "ETHUSDT", "below", 2000);
    saveAlerts([rule]);
    const restored = loadAlerts();
    expect(restored).toHaveLength(1);
    expect(restored[0].symbol).toBe("ETHUSDT");
    expect(restored[0].direction).toBe("below");
  });

  it("triggers only when the price crosses the threshold", () => {
    const above = createRule("spot", "BTCUSDT", "above", 80000);
    expect(isTriggered(above, 79999)).toBe(false);
    expect(isTriggered(above, 80000)).toBe(true);
    expect(isTriggered(above, 81000)).toBe(true);

    const below = createRule("spot", "BTCUSDT", "below", 70000);
    expect(isTriggered(below, 70001)).toBe(false);
    expect(isTriggered(below, 70000)).toBe(true);
    expect(isTriggered(below, 69000)).toBe(true);

    expect(isTriggered(above, Number.NaN)).toBe(false);
  });

  it("drops corrupted entries instead of throwing", () => {
    window.localStorage.setItem(
      "crypto-radar:alerts:v1",
      JSON.stringify([{ broken: true }, { id: "x" }]),
    );
    expect(loadAlerts()).toEqual([]);
  });
});
