import { describe, expect, it } from "vitest";
import { computeSentiment } from "@/features/sentiment/sentiment";
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
    quoteVolume24h: 10_000_000,
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

function many(change: number, count = 20, quoteVolume = 30_000_000): MarketTicker[] {
  return Array.from({ length: count }, (_, index) =>
    ticker({ symbol: `T${index}USDT`, priceChangePercent: change, quoteVolume24h: quoteVolume }),
  );
}

describe("computeSentiment", () => {
  it("reports illiquid when turnover and volatility are both low", () => {
    const result = computeSentiment({ tickers: many(0.2, 20, 1_000_000) });
    expect(result.key).toBe("illiquid");
  });

  it("reports fomo when almost everything is up strongly", () => {
    const result = computeSentiment({ tickers: many(6, 20) });
    expect(result.key).toBe("fomo");
    expect(result.breadth).toBe(100);
    expect(result.score).toBeGreaterThan(70);
  });

  it("reports panic when almost everything is down strongly", () => {
    const result = computeSentiment({ tickers: many(-6, 20) });
    expect(result.key).toBe("panic");
    expect(result.breadth).toBe(0);
    expect(result.score).toBeLessThan(30);
  });

  it("reports chop for a balanced market", () => {
    const mixed = [
      ...many(0.8, 10, 40_000_000),
      ...many(-0.8, 10, 40_000_000).map((item, index) => ({ ...item, symbol: `D${index}USDT` })),
    ];
    const result = computeSentiment({ tickers: mixed });
    expect(result.key).toBe("chop");
    expect(result.breadth).toBeCloseTo(50, 0);
  });

  it("is deterministic and exposes its factors", () => {
    const first = computeSentiment({ tickers: many(2, 10) });
    const second = computeSentiment({ tickers: many(2, 10) });
    expect(first).toEqual(second);
    expect(first.factors.map((factor) => factor.key)).toContain("breadth");
  });

  it("handles an empty market without throwing", () => {
    const result = computeSentiment({ tickers: [] });
    expect(result.key).toBe("illiquid");
    expect(result.score).toBe(50);
  });
});
