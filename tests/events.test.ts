import { describe, expect, it } from "vitest";
import { EventStore, DEFAULT_THRESHOLDS, detectEvents } from "@/features/events/rules";
import type { MarketTicker } from "@/types/market";

function ticker(partial: Partial<MarketTicker>): MarketTicker {
  return {
    market: "spot",
    symbol: "BTCUSDT",
    id: "BTCUSDT",
    base: "BTC",
    quote: "USDT",
    price: 100,
    priceChangePercent: 0,
    openPrice: 100,
    high24h: 110,
    low24h: 90,
    volume24h: 1,
    quoteVolume24h: 1000,
    trades24h: 1,
    bidPrice: null,
    askPrice: null,
    markPrice: null,
    indexPrice: null,
    fundingRate: null,
    nextFundingTime: null,
    openInterest: null,
    decimals: 2,
    updatedAt: 1,
    listingTime: null,
    ...partial,
  };
}

function baseContext(now: number) {
  return {
    market: "spot" as const,
    thresholds: DEFAULT_THRESHOLDS,
    previous: new Map<string, { price: number; at: number }>(),
    isCoolingDown: () => false,
    now,
  };
}

describe("detectEvents", () => {
  it("fires a 24 h surge past the threshold", () => {
    const now = 1_000_000;
    const events = detectEvents([ticker({ priceChangePercent: 12 })], baseContext(now));
    expect(events.some((event) => event.ruleId === "surge")).toBe(true);
    expect(events[0].value).toBeGreaterThanOrEqual(8);
  });

  it("fires a dump for a negative move", () => {
    const events = detectEvents([ticker({ priceChangePercent: -12 })], baseContext(2_000_000));
    expect(events.some((event) => event.ruleId === "dump")).toBe(true);
  });

  it("detects a short burst between two samples", () => {
    const context = baseContext(1_100_000);
    context.previous.set("BTCUSDT", { price: 100, at: 1_090_000 });
    const events = detectEvents([ticker({ price: 103 })], context);
    const burst = events.find((event) => event.ruleId === "surge" && event.value < 5);
    expect(burst).toBeDefined();
  });

  it("stays silent when nothing crosses a threshold", () => {
    const events = detectEvents(
      [ticker({ priceChangePercent: 0.4, high24h: 200, low24h: 50 })],
      baseContext(3_000_000),
    );
    expect(events).toHaveLength(0);
  });

  it("fires on an extreme funding rate", () => {
    const events = detectEvents(
      [ticker({ fundingRate: 0.002, high24h: 200, low24h: 50 })],
      baseContext(4_000_000),
    );
    expect(events.some((event) => event.ruleId === "funding-extreme")).toBe(true);
  });

  it("respects the cooldown", () => {
    const context = baseContext(5_000_000);
    context.isCoolingDown = () => true;
    const events = detectEvents([ticker({ priceChangePercent: 20 })], context);
    expect(events).toHaveLength(0);
  });

  it("assigns a higher severity to a bigger move", () => {
    const small = detectEvents([ticker({ priceChangePercent: 9 })], baseContext(6_000_000));
    const large = detectEvents([ticker({ priceChangePercent: 30 })], baseContext(7_000_000));
    expect(small[0].severity).toBe("info");
    expect(large[0].severity).toBe("critical");
  });
});

describe("EventStore", () => {
  it("caps the feed and tracks cooldowns", () => {
    const store = new EventStore(2);
    const now = 10_000_000;
    store.push(
      detectEvents([ticker({ priceChangePercent: 20 })], {
        ...baseContext(now),
        isCoolingDown: (rule, symbol, at) => store.isCoolingDown(rule, symbol, at),
      }),
    );
    expect(store.all.length).toBeGreaterThan(0);
    expect(store.isCoolingDown("surge", "BTCUSDT", now + 1000)).toBe(true);
    expect(store.isCoolingDown("surge", "BTCUSDT", now + DEFAULT_THRESHOLDS.cooldownMs + 1)).toBe(false);
    store.clear();
    expect(store.all).toHaveLength(0);
  });
});
