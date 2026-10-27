import { describe, expect, it } from "vitest";
import { computeMood, moodScopeLabel } from "@/engine/mood";
import { makeRow } from "./helpers";

const build = (count: number, upShare: number, moveAbs = 0.2) => {
  const rows = [];
  const up = Math.round(count * upShare);
  for (let index = 0; index < count; index += 1) {
    const isUp = index < up;
    rows.push(
      makeRow({
        symbol: `S${index}USDT`,
        key: `spot:S${index}USDT`,
        changePercent: isUp ? moveAbs : -moveAbs,
        quoteVolume24h: 1_000_000,
        d: { ...makeRow().d, vol15m: moveAbs },
      }),
    );
  }
  return rows;
};

describe("computeMood", () => {
  it("refuses to judge a market with too few samples", () => {
    const mood = computeMood(build(10, 0.8));
    expect(mood.level).toBe("insufficient");
    expect(mood.label).toBe("数据不足");
    // The numbers are still shown, only the verdict is withheld.
    expect(mood.evidence.length).toBeGreaterThan(0);
    expect(mood.sample).toBe(10);
  });

  it("reports FOMO when almost everything is green", () => {
    const mood = computeMood(build(120, 0.82));
    expect(mood.level).toBe("fomo");
    expect(mood.breadth).toBeGreaterThan(68);
  });

  it("reports a bull tape when the breadth is high but not euphoric", () => {
    const mood = computeMood(build(120, 0.6));
    expect(mood.level).toBe("bull");
  });

  it("reports capitulation when almost everything is red", () => {
    const mood = computeMood(build(120, 0.2));
    expect(mood.level).toBe("capitulation");
  });

  it("reports a bear tape for a moderate decline", () => {
    const mood = computeMood(build(120, 0.4));
    expect(mood.level).toBe("bear");
  });

  it("reports a flat tape when breadth is balanced", () => {
    const mood = computeMood(build(120, 0.51));
    expect(mood.level).toBe("flat");
  });

  it("flags chaos when short-term volatility explodes", () => {
    const rows = build(120, 0.55, 1.6);
    const mood = computeMood(rows);
    expect(mood.level).toBe("chaos");
    expect(mood.tone).toBe("warn");
  });

  it("keeps evidence numbers available for the UI", () => {
    const mood = computeMood(build(120, 0.7));
    const labels = mood.evidence.map((item) => item.label);
    expect(labels).toContain("上涨占比");
    expect(labels).toContain("中位涨跌");
    expect(mood.sample).toBe(120);
  });

  it("ignores stale rows", () => {
    const stale = build(120, 0.9).map((row) => ({
      ...row,
      receivedAt: Date.now() - 600_000,
    }));
    expect(computeMood(stale).level).toBe("insufficient");
  });

  it("labels the coverage honestly", () => {
    expect(moodScopeLabel(["spot", "futures"])).toContain("币安");
    expect(moodScopeLabel([])).toBe("未接入市场");
  });
});
