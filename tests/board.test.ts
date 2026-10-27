import { describe, expect, it } from "vitest";
import { applyBoard, marketBreadth, type Board } from "@/features/spot/board";
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
    quoteVolume24h: 1,
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
  ticker({ symbol: "UP", priceChangePercent: 12, quoteVolume24h: 10 }),
  ticker({ symbol: "DOWN", priceChangePercent: -8, quoteVolume24h: 50 }),
  ticker({ symbol: "FLAT", priceChangePercent: 0.01, quoteVolume24h: 30 }),
];

const defaultSort = { key: "symbol" as const, desc: false };

describe("applyBoard", () => {
  it("keeps every pair on the all board", () => {
    const { rows } = applyBoard(sample, "all", defaultSort);
    expect(rows).toHaveLength(3);
  });

  it("filters the gainers board to positive changes and ranks them", () => {
    const { rows, sort } = applyBoard(sample, "gainers" as Board, defaultSort);
    // FLAT is +0.01%, so it is still a gainer — the filter is strictly > 0.
    expect(rows.map((row) => row.symbol)).toEqual(["UP", "FLAT"]);
    expect(sort).toEqual({ key: "changePercent", desc: true });
  });

  it("filters the losers board to negative changes", () => {
    const { rows, sort } = applyBoard(sample, "losers" as Board, defaultSort);
    expect(rows.map((row) => row.symbol)).toEqual(["DOWN"]);
    expect(sort).toEqual({ key: "changePercent", desc: false });
  });

  it("orders the volume board by turnover", () => {
    const { rows, sort } = applyBoard(sample, "volume" as Board, defaultSort);
    expect(rows).toHaveLength(3);
    expect(sort).toEqual({ key: "quoteVolume24h", desc: true });
  });
});

describe("marketBreadth", () => {
  it("counts advancers, decliners and unchanged pairs", () => {
    const breadth = marketBreadth(sample);
    expect(breadth.up).toBe(1);
    expect(breadth.down).toBe(1);
    expect(breadth.flat).toBe(1);
    expect(breadth.total).toBe(3);
  });

  it("survives an empty market", () => {
    const breadth = marketBreadth([]);
    expect(breadth.total).toBe(0);
    expect(breadth.upPercent).toBe(0);
  });
});
