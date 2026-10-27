import { describe, expect, it } from "vitest";
import { DEFAULT_SCAN_RULE, SCAN_PRESETS, describeRule, runScan, type ScanRule } from "@/engine/scanner";
import { compare, formatMetric, metricAvailable, readMetric } from "@/engine/metrics";
import { makeRow } from "./helpers";

const baseRule: ScanRule = {
  ...DEFAULT_SCAN_RULE,
  markets: ["spot", "futures"],
  conditions: [{ metric: "change", window: "5m", comparator: "gte", value: 3 }],
  minTurnover: 100_000,
  limit: 50,
  onlyWatchlist: false,
  maxAgeMs: 60_000,
  sortBy: "trigger",
};

describe("runScan", () => {
  it("returns rows that pass an AND rule", () => {
    const rows = [
      makeRow({ symbol: "AUSDT", key: "spot:AUSDT", d: { ...makeRow().d, m5: 4 } }),
      makeRow({ symbol: "BUSDT", key: "spot:BUSDT", d: { ...makeRow().d, m5: 1 } }),
    ];
    const result = runScan(rows, baseRule);
    expect(result.hits.map((hit) => hit.row.symbol)).toEqual(["AUSDT"]);
    expect(result.evaluated).toBe(2);
  });

  it("ignores rows outside the selected markets", () => {
    const rows = [
      makeRow({ market: "alpha", d: { ...makeRow().d, m5: 9 } }),
      makeRow({ market: "spot", key: "spot:XUSDT", d: { ...makeRow().d, m5: 9 } }),
    ];
    const result = runScan(rows, { ...baseRule, markets: ["futures"] });
    expect(result.hits).toHaveLength(0);
    expect(result.evaluated).toBe(0);
  });

  it("applies the turnover floor", () => {
    const rows = [makeRow({ quoteVolume24h: 10, d: { ...makeRow().d, m5: 9 } })];
    expect(runScan(rows, baseRule).hits).toHaveLength(0);
  });

  it("skips stale rows", () => {
    const rows = [
      makeRow({ receivedAt: Date.now() - 200_000, d: { ...makeRow().d, m5: 9 } }),
    ];
    expect(runScan(rows, baseRule).hits).toHaveLength(0);
  });

  it("counts rows whose metric is not measurable yet", () => {
    const rule: ScanRule = {
      ...baseRule,
      conditions: [{ metric: "volumeSurge", window: "5m", comparator: "gte", value: 2 }],
    };
    const rows = [makeRow()];
    const result = runScan(rows, rule);
    expect(result.hits).toHaveLength(0);
    expect(result.missing).toBe(1);
  });

  it("supports OR logic", () => {
    const rule: ScanRule = {
      ...baseRule,
      logic: "or",
      conditions: [
        { metric: "change", window: "5m", comparator: "gte", value: 5 },
        { metric: "volumeSurge", window: "5m", comparator: "gte", value: 3 },
      ],
    };
    const rows = [
      makeRow({ symbol: "AUSDT", key: "spot:AUSDT", d: { ...makeRow().d, m5: 0.1, volumeSurge: 4 } }),
      makeRow({ symbol: "BUSDT", key: "spot:BUSDT", d: { ...makeRow().d, m5: 0.1, volumeSurge: 0.4 } }),
    ];
    const result = runScan(rows, rule);
    expect(result.hits.map((hit) => hit.row.symbol)).toEqual(["AUSDT"]);
  });

  it("filters by watchlist when asked", () => {
    const rows = [
      makeRow({ symbol: "AUSDT", key: "spot:AUSDT", d: { ...makeRow().d, m5: 9 } }),
      makeRow({ symbol: "BUSDT", key: "spot:BUSDT", d: { ...makeRow().d, m5: 9 } }),
    ];
    const result = runScan(rows, { ...baseRule, onlyWatchlist: true }, {
      watchKeys: new Set(["spot:BUSDT"]),
    });
    expect(result.hits.map((hit) => hit.row.symbol)).toEqual(["BUSDT"]);
  });

  it("sorts by turnover when requested", () => {
    const rows = [
      makeRow({ symbol: "AUSDT", key: "spot:AUSDT", quoteVolume24h: 1_000_000, d: { ...makeRow().d, m5: 9 } }),
      makeRow({ symbol: "BUSDT", key: "spot:BUSDT", quoteVolume24h: 9_000_000, d: { ...makeRow().d, m5: 4 } }),
    ];
    const result = runScan(rows, { ...baseRule, sortBy: "turnoverDesc" });
    expect(result.hits[0].row.symbol).toBe("BUSDT");
  });

  it("exposes presets that are internally consistent", () => {
    expect(SCAN_PRESETS.length).toBeGreaterThanOrEqual(6);
    for (const preset of SCAN_PRESETS) {
      expect(preset.conditions.length).toBeGreaterThan(0);
      expect(describeRule(preset).length).toBeGreaterThan(4);
      for (const condition of preset.conditions) {
        expect(metricAvailable(preset.markets[0], condition.metric)).toBe(true);
      }
    }
  });
});

describe("metrics helpers", () => {
  it("reads windowed change", () => {
    const row = makeRow({ changePercent: 12, d: { ...makeRow().d, m1: 1, m5: 2, m15: 3, h1: 4 } });
    expect(readMetric(row, "change", "1m")).toBe(1);
    expect(readMetric(row, "change", "5m")).toBe(2);
    expect(readMetric(row, "change", "15m")).toBe(3);
    expect(readMetric(row, "change", "1h")).toBe(4);
    expect(readMetric(row, "change", "24h")).toBe(12);
    expect(readMetric(row, "absChange", "24h")).toBe(12);
  });

  it("keeps missing metrics null instead of zero", () => {
    const row = makeRow();
    expect(readMetric(row, "funding", "24h")).toBeNull();
    expect(readMetric(row, "oiChange", "15m")).toBeNull();
    expect(readMetric(row, "volumeSurge", "5m")).toBeNull();
  });

  it("converts funding to percent", () => {
    const row = makeRow({ market: "futures", fundingRate: 0.0005 });
    expect(readMetric(row, "funding", "24h")).toBeCloseTo(0.05);
  });

  it("implements the comparators", () => {
    expect(compare(3, "gte", 3)).toBe(true);
    expect(compare(2.9, "gte", 3)).toBe(false);
    expect(compare(-3.1, "lte", -3)).toBe(true);
    expect(compare(-0.06, "absGte", 0.05)).toBe(true);
  });

  it("knows which markets publish which metric", () => {
    expect(metricAvailable("spot", "funding")).toBe(false);
    expect(metricAvailable("futures", "funding")).toBe(true);
    expect(metricAvailable("alpha", "volumeSurge")).toBe(false);
    expect(metricAvailable("alpha", "change")).toBe(true);
  });

  it("formats metrics for humans", () => {
    expect(formatMetric("change", 2.345)).toBe("+2.35%");
    expect(formatMetric("funding", 0.0123)).toBe("+0.0123%");
    expect(formatMetric("volumeSurge", 3.2)).toBe("3.20×");
    expect(formatMetric("oiChange", null)).toBe("数据不足");
  });
});
