import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, runScreener } from "@/features/screener/rules";
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

const labels = {
  gainers: "大幅上涨",
  losers: "大幅下跌",
  volume: "高成交额",
  funding: "资金费率偏高",
  spike: "成交量异动",
  change: "涨跌幅",
  fundingRate: "资金费率",
  quoteVolume: "成交额",
  spikeValue: "短时涨跌",
};

describe("runScreener", () => {
  it("returns only pairs above the gain threshold", () => {
    const hits = runScreener(
      [ticker({ symbol: "A", priceChangePercent: 8 }), ticker({ symbol: "B", priceChangePercent: 1 })],
      { ...DEFAULT_RULES, template: "gainers", minChange: 5 },
      new Set(),
      labels,
    );
    expect(hits).toHaveLength(1);
    expect(hits[0].symbol).toBe("A");
  });

  it("returns only pairs below the loss threshold", () => {
    const hits = runScreener(
      [ticker({ symbol: "A", priceChangePercent: -8 }), ticker({ symbol: "B", priceChangePercent: -1 })],
      { ...DEFAULT_RULES, template: "losers", maxChange: -5 },
      new Set(),
      labels,
    );
    expect(hits).toHaveLength(1);
    expect(hits[0].symbol).toBe("A");
  });

  it("filters by quote volume", () => {
    const hits = runScreener(
      [
        ticker({ symbol: "A", quoteVolume24h: 5_000_000 }),
        ticker({ symbol: "B", quoteVolume24h: 100 }),
      ],
      { ...DEFAULT_RULES, template: "volume", minQuoteVolume: 1_000_000 },
      new Set(),
      labels,
    );
    expect(hits.map((hit) => hit.symbol)).toEqual(["A"]);
  });

  it("filters by funding rate and skips pairs without funding data", () => {
    const hits = runScreener(
      [
        ticker({ symbol: "A", fundingRate: 0.001 }),
        ticker({ symbol: "B", fundingRate: null }),
        ticker({ symbol: "C", fundingRate: 0.00001 }),
      ],
      { ...DEFAULT_RULES, template: "funding", minFundingRate: 0.05 },
      new Set(),
      labels,
    );
    expect(hits.map((hit) => hit.symbol)).toEqual(["A"]);
  });

  it("computes the short-term spike from the real open price", () => {
    const hits = runScreener(
      [ticker({ symbol: "A", price: 110, openPrice: 100 }), ticker({ symbol: "B", price: 100, openPrice: 100 })],
      { ...DEFAULT_RULES, template: "spike", minSpike: 5 },
      new Set(),
      labels,
    );
    expect(hits).toHaveLength(1);
    expect(hits[0].value).toBe("10.00%");
  });

  it("restricts the result to the selected markets", () => {
    const hits = runScreener(
      [
        ticker({ market: "spot", symbol: "A", priceChangePercent: 9 }),
        ticker({ market: "futures", symbol: "B", priceChangePercent: 9 }),
      ],
      { ...DEFAULT_RULES, template: "gainers", minChange: 5, markets: ["futures"] },
      new Set(),
      labels,
    );
    expect(hits.map((hit) => hit.symbol)).toEqual(["B"]);
  });

  it("can restrict the result to the watchlist", () => {
    const hits = runScreener(
      [
        ticker({ symbol: "A", priceChangePercent: 9 }),
        ticker({ symbol: "B", priceChangePercent: 9 }),
      ],
      { ...DEFAULT_RULES, template: "gainers", minChange: 5, onlyWatchlist: true },
      new Set(["spot:A"]),
      labels,
    );
    expect(hits.map((hit) => hit.symbol)).toEqual(["A"]);
  });
});
