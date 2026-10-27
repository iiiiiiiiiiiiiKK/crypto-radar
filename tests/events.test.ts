import { describe, expect, it } from "vitest";
import {
  DEFAULT_EVENT_THRESHOLDS,
  EventLog,
  RULE_GLYPH,
  RULE_TITLES,
  detectEvents,
} from "@/engine/events";
import { makeRow } from "./helpers";

const now = 1_700_000_000_000;
const ctx = (overrides: Partial<Parameters<typeof detectEvents>[1]> = {}) => ({
  thresholds: DEFAULT_EVENT_THRESHOLDS,
  now,
  isCoolingDown: () => false,
  ...overrides,
});

describe("detectEvents", () => {
  it("fires a 5 minute pump above the threshold", () => {
    const row = makeRow({
      d: { ...makeRow().d, m5: 4.2, turnoverPerMin: 50_000, volumeSurge: 2.4 },
    });
    const events = detectEvents([row], ctx());
    const pump = events.find((event) => event.ruleId === "pump-5m");
    expect(pump).toBeDefined();
    expect(pump?.why).toContain("4.20%");
    expect(pump?.tone).toBe("up");
  });

  it("does not fire below the threshold", () => {
    const row = makeRow({ d: { ...makeRow().d, m5: 1.1, m1: 0.2 } });
    expect(detectEvents([row], ctx())).toHaveLength(0);
  });

  it("ignores rows that are not fresh", () => {
    const row = makeRow({
      receivedAt: now - 120_000,
      d: { ...makeRow().d, m5: 9 },
    });
    expect(detectEvents([row], ctx())).toHaveLength(0);
  });

  it("ignores illiquid pairs", () => {
    const row = makeRow({
      quoteVolume24h: 1_000,
      d: { ...makeRow().d, m5: 9 },
    });
    expect(detectEvents([row], ctx())).toHaveLength(0);
  });

  it("respects the cooldown callback", () => {
    const row = makeRow({ d: { ...makeRow().d, m5: 9 } });
    const events = detectEvents([row], ctx({ isCoolingDown: () => true }));
    expect(events).toHaveLength(0);
  });

  it("fires a volume burst with the measured ratio", () => {
    const row = makeRow({
      d: { ...makeRow().d, volumeSurge: 4.5, turnoverPerMin: 80_000 },
    });
    const burst = detectEvents([row], ctx()).find((event) => event.ruleId === "volume-burst");
    expect(burst?.why).toContain("4.50×");
  });

  it("fires a funding extreme only for perpetuals with a rate", () => {
    const perp = makeRow({
      market: "futures",
      symbol: "BTCUSDT",
      fundingRate: 0.0008,
      markPrice: 100.2,
      d: { ...makeRow().d },
    });
    const events = detectEvents([perp], ctx());
    const funding = events.find((event) => event.ruleId === "funding-extreme");
    expect(funding).toBeDefined();
    expect(funding?.chips.length).toBeGreaterThan(0);
    expect(funding?.why).toContain("多头付费");
  });

  it("fires open interest changes once the delta exists", () => {
    const perp = makeRow({
      market: "futures",
      openInterest: 1_200_000,
      d: { ...makeRow().d, oiChange: -7.5 },
    });
    const oi = detectEvents([perp], ctx()).find((event) => event.ruleId === "oi-jump");
    expect(oi?.tone).toBe("down");
    expect(oi?.why).toContain("7.50%");
  });

  it("detects price up with shrinking volume", () => {
    const row = makeRow({ d: { ...makeRow().d, m15: 3, volumeSurge: 0.4 } });
    const divergence = detectEvents([row], ctx()).find(
      (event) => event.ruleId === "divergence-up",
    );
    expect(divergence?.severity).toBe("warn");
  });

  it("caps the number of events per pass", () => {
    const rows = Array.from({ length: 60 }, (_, index) =>
      makeRow({
        symbol: `T${index}USDT`,
        key: `spot:T${index}USDT`,
        d: { ...makeRow().d, m5: 8, volumeSurge: 6, turnoverPerMin: 90_000 },
      }),
    );
    expect(detectEvents(rows, ctx()).length).toBeLessThanOrEqual(
      DEFAULT_EVENT_THRESHOLDS.maxPerTick,
    );
  });

  it("ships a title and glyph for every rule", () => {
    expect(Object.keys(RULE_TITLES)).toHaveLength(Object.keys(RULE_GLYPH).length);
  });
});

describe("EventLog", () => {
  it("de-duplicates identical event ids", () => {
    const log = new EventLog();
    const row = makeRow({ d: { ...makeRow().d, m5: 9 } });
    const events = detectEvents([row], ctx());
    log.push(events);
    const firstCount = log.all.length;
    expect(firstCount).toBeGreaterThan(0);
    log.push(events);
    expect(log.all.length).toBe(firstCount);
  });

  it("starts cooling down after a push", () => {
    const log = new EventLog();
    const row = makeRow({ d: { ...makeRow().d, m5: 9 } });
    log.push(detectEvents([row], ctx()));
    expect(log.isCoolingDown("pump-5m", row.key, now + 1_000)).toBe(true);
    expect(log.isCoolingDown("pump-5m", row.key, now + DEFAULT_EVENT_THRESHOLDS.cooldownMs + 1)).toBe(
      false,
    );
  });

  it("clears everything", () => {
    const log = new EventLog();
    log.push(detectEvents([makeRow({ d: { ...makeRow().d, m5: 9 } })], ctx()));
    log.clear();
    expect(log.all).toHaveLength(0);
  });
});
