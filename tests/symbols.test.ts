import { describe, expect, it } from "vitest";
import { guessDecimals, splitSymbol } from "@/services/binance/spot";
import { filterByQuote } from "@/features/spot/sorting";
import type { MarketTicker } from "@/types/market";

describe("splitSymbol", () => {
  it("splits the common USDT pairs", () => {
    expect(splitSymbol("BTCUSDT")).toEqual({ base: "BTC", quote: "USDT" });
    expect(splitSymbol("ETHUSDC")).toEqual({ base: "ETH", quote: "USDC" });
  });

  it("prefers the longest matching quote asset", () => {
    expect(splitSymbol("USDTIDR")).toEqual({ base: "USDT", quote: "IDR" });
    expect(splitSymbol("BTCBIDR")).toEqual({ base: "BTC", quote: "BIDR" });
  });

  it("falls back to the full symbol when nothing matches", () => {
    expect(splitSymbol("WEIRD")).toEqual({ base: "WEIRD", quote: "" });
  });
});

describe("guessDecimals", () => {
  it("scales the precision with the price magnitude", () => {
    expect(guessDecimals(80000)).toBe(2);
    expect(guessDecimals(1.5)).toBe(4);
    expect(guessDecimals(0.05)).toBe(5);
    expect(guessDecimals(0.0005)).toBe(6);
    expect(guessDecimals(0.00005)).toBe(7);
    expect(guessDecimals(0.000005)).toBe(8);
  });
});

describe("filterByQuote", () => {
  const base: MarketTicker = {
    market: "spot",
    symbol: "BTCUSDT",
    id: "BTCUSDT",
    base: "BTC",
    quote: "USDT",
    price: 1,
    priceChangePercent: 0,
    openPrice: 1,
    high24h: 1,
    low24h: 1,
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
  };

  it("keeps everything with the all filter", () => {
    expect(filterByQuote([base], "all")).toHaveLength(1);
  });

  it("keeps only USDT quoted pairs", () => {
    const usdc = { ...base, symbol: "BTCUSDC", quote: "USDC" };
    expect(filterByQuote([base, usdc], "usdt").map((t) => t.symbol)).toEqual(["BTCUSDT"]);
  });

  it("keeps the stable-coin quotes for the usd filter", () => {
    const usdc = { ...base, symbol: "BTCUSDC", quote: "USDC" };
    const idr = { ...base, symbol: "BTCIDR", quote: "IDR" };
    expect(filterByQuote([base, usdc, idr], "usd").map((t) => t.symbol)).toEqual([
      "BTCUSDT",
      "BTCUSDC",
    ]);
  });
});
