import { describe, expect, it } from "vitest";
import { filterTickers, sortTickers, topMovers, topVolume } from "@/features/spot/sorting";
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
    volume24h: 1000,
    quoteVolume24h: 100000,
    trades24h: 10,
    bidPrice: 99,
    askPrice: 101,
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

const sample = [
  ticker({ symbol: "ETHUSDT", price: 50, priceChangePercent: -3, quoteVolume24h: 90000 }),
  ticker({ symbol: "BTCUSDT", price: 100, priceChangePercent: 5, quoteVolume24h: 500000 }),
  ticker({ symbol: "SOLUSDT", price: 20, priceChangePercent: 12, quoteVolume24h: 10000 }),
];

describe("sortTickers", () => {
  it("sorts by a numeric column", () => {
    const sorted = sortTickers(sample, { key: "price", desc: false });
    expect(sorted.map((t) => t.symbol)).toEqual(["SOLUSDT", "ETHUSDT", "BTCUSDT"]);
  });

  it("sorts descending when requested", () => {
    const sorted = sortTickers(sample, { key: "quoteVolume24h", desc: true });
    expect(sorted[0].symbol).toBe("BTCUSDT");
  });

  it("sorts by symbol alphabetically", () => {
    const sorted = sortTickers(sample, { key: "symbol", desc: false });
    expect(sorted.map((t) => t.symbol)).toEqual(["BTCUSDT", "ETHUSDT", "SOLUSDT"]);
  });
});

describe("filterTickers", () => {
  it("matches the base asset", () => {
    expect(filterTickers(sample, "eth")).toHaveLength(1);
  });

  it("returns everything for an empty query", () => {
    expect(filterTickers(sample, "  ")).toHaveLength(3);
  });

  it("returns nothing when there is no match", () => {
    expect(filterTickers(sample, "zzz")).toHaveLength(0);
  });
});

describe("leaderboards", () => {
  it("ranks gainers", () => {
    expect(topMovers(sample, "gainers")[0].symbol).toBe("SOLUSDT");
  });

  it("ranks losers", () => {
    expect(topMovers(sample, "losers")[0].symbol).toBe("ETHUSDT");
  });

  it("ranks volume", () => {
    expect(topVolume(sample)[0].symbol).toBe("BTCUSDT");
  });
});
