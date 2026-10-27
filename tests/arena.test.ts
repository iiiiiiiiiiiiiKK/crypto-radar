import { describe, expect, it } from "vitest";
import { VolumeTracker, buildBoard } from "@/features/arena/boards";
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

const sample = [
  ticker({ symbol: "UP", priceChangePercent: 12, quoteVolume24h: 500 }),
  ticker({ symbol: "DOWN", priceChangePercent: -9, quoteVolume24h: 900 }),
  ticker({ symbol: "BIG", priceChangePercent: 1, quoteVolume24h: 5000 }),
  ticker({ symbol: "FUND", priceChangePercent: 0.5, fundingRate: -0.002 }),
];

describe("buildBoard", () => {
  it("ranks gainers by change", () => {
    const rows = buildBoard({ tickers: sample, board: "gainers" });
    expect(rows[0].ticker.symbol).toBe("UP");
    expect(rows.every((row) => row.ticker.priceChangePercent > 0)).toBe(true);
  });

  it("ranks losers by change", () => {
    const rows = buildBoard({ tickers: sample, board: "losers" });
    expect(rows[0].ticker.symbol).toBe("DOWN");
  });

  it("ranks by turnover", () => {
    const rows = buildBoard({ tickers: sample, board: "volume" });
    expect(rows[0].ticker.symbol).toBe("BIG");
  });

  it("orders funding by absolute rate", () => {
    const rows = buildBoard({ tickers: sample, board: "funding" });
    expect(rows[0].ticker.symbol).toBe("FUND");
    expect(rows[0].badge).toBe("-0.2000%");
  });

  it("returns nothing for an empty watchlist", () => {
    expect(buildBoard({ tickers: sample, board: "watchlist", watchedKeys: new Set() })).toEqual([]);
  });

  it("keeps only watched pairs on the watchlist board", () => {
    const rows = buildBoard({
      tickers: sample,
      board: "watchlist",
      watchedKeys: new Set(["spot:UP", "spot:BIG"]),
      market: "spot",
    });
    expect(rows.map((row) => row.ticker.symbol).sort()).toEqual(["BIG", "UP"]);
  });

  it("returns nothing for the spike board without a tracker", () => {
    expect(buildBoard({ tickers: sample, board: "spike" })).toEqual([]);
  });
});

describe("VolumeTracker", () => {
  it("computes a spike multiplier above 1 when turnover accelerates", () => {
    const tracker = new VolumeTracker();
    const start = 1_000_000;
    tracker.update([ticker({ quoteVolume24h: start })], 0);

    // 60 s later the pair traded 10× its 24 h average pace.
    const averagePerSecond = start / 86_400;
    const current = start + averagePerSecond * 60 * 10;
    tracker.update([ticker({ quoteVolume24h: current })], 60_000);
    // the baseline must stay at t=0, so the delta measures the acceleration

    const spike = tracker.spike("BTCUSDT", current, 60_000);
    expect(spike).not.toBeNull();
    expect(spike as number).toBeGreaterThan(5);
    expect(spike as number).toBeLessThan(20);
  });

  it("returns null before it has a usable baseline", () => {
    const tracker = new VolumeTracker();
    tracker.update([ticker({ quoteVolume24h: 1000 })], 0);
    expect(tracker.spike("BTCUSDT", 2000, 5_000)).toBeNull();
  });
});
