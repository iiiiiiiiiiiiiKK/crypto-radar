import { beforeEach, describe, expect, it } from "vitest";
import { TickerStore } from "@/engine/tickerStore";
import type { SnapshotRow } from "@/services/types";

const snapshot = (overrides: Partial<SnapshotRow> = {}): SnapshotRow => ({
  market: "spot",
  symbol: "BTCUSDT",
  id: "BTCUSDT",
  base: "BTC",
  quote: "USDT",
  price: 100,
  open24h: 98,
  changePercent: 2.04,
  high24h: 101,
  low24h: 96,
  volume24h: 1000,
  quoteVolume24h: 2_000_000,
  trades24h: 100,
  bidPrice: 99.9,
  askPrice: 100.1,
  markPrice: null,
  indexPrice: null,
  fundingRate: null,
  nextFundingTime: null,
  openInterest: null,
  decimals: 2,
  updatedAt: Date.now(),
  receivedAt: Date.now(),
  source: "rest" as const,
  ...overrides,
});

describe("TickerStore", () => {
  let store: TickerStore;

  beforeEach(() => {
    store = new TickerStore();
  });

  it("indexes snapshots by market and symbol", () => {
    store.applySnapshot("spot", [snapshot(), snapshot({ symbol: "ETHUSDT", base: "ETH" })]);
    expect(store.getRows("spot")).toHaveLength(2);
    expect(store.getRow("spot:BTCUSDT")?.price).toBe(100);
    expect(store.getRow("spot:ETHUSDT")?.base).toBe("ETH");
  });

  it("prunes pairs that disappear from the universe", () => {
    store.applySnapshot("spot", [snapshot()]);
    store.applySnapshot("spot", [snapshot({ symbol: "ETHUSDT", base: "ETH" })]);
    expect(store.getRow("spot:BTCUSDT")).toBeNull();
    expect(store.getRows("spot")).toHaveLength(1);
  });

  it("applies stream deltas and recomputes the change percent", () => {
    store.applySnapshot("spot", [snapshot()]);
    store.applyTicker([
      {
        symbol: "BTCUSDT",
        price: 105,
        open24h: 98,
        high24h: 106,
        low24h: 96,
        volume24h: 1100,
        quoteVolume24h: 2_100_000,
        eventTime: Date.now(),
      },
    ]);
    const row = store.getRow("spot:BTCUSDT");
    expect(row?.price).toBe(105);
    expect(row?.changePercent).toBeCloseTo(((105 - 98) / 98) * 100, 6);
    expect(row?.source).toBe("stream");
  });

  it("merges perpetual metadata without inventing values", () => {
    store.applySnapshot("futures", [snapshot({ market: "futures" })]);
    expect(store.getRow("futures:BTCUSDT")?.fundingRate).toBeNull();
    store.applyMark([
      {
        symbol: "BTCUSDT",
        markPrice: 100.5,
        indexPrice: 100.4,
        fundingRate: 0.0001,
        nextFundingTime: 123,
        eventTime: Date.now(),
      },
    ]);
    const row = store.getRow("futures:BTCUSDT");
    expect(row?.markPrice).toBe(100.5);
    expect(row?.fundingRate).toBe(0.0001);
    expect(row?.nextFundingTime).toBe(123);
    // Spot data must never receive perpetual fields.
    expect(store.getRow("spot:BTCUSDT")).toBeNull();
  });

  it("notifies only the rows that changed", () => {
    store.applySnapshot("spot", [snapshot(), snapshot({ symbol: "ETHUSDT", base: "ETH" })]);
    let btc = 0;
    let eth = 0;
    const offBtc = store.subscribeRow("spot:BTCUSDT", () => {
      btc += 1;
    });
    const offEth = store.subscribeRow("spot:ETHUSDT", () => {
      eth += 1;
    });
    store.applyTicker([
      {
        symbol: "BTCUSDT",
        price: 101,
        open24h: 98,
        high24h: 101,
        low24h: 96,
        volume24h: 1000,
        quoteVolume24h: 2_000_000,
        eventTime: Date.now(),
      },
    ]);
    expect(btc).toBe(1);
    expect(eth).toBe(0);
    offBtc();
    offEth();
  });

  it("seeds short-window history from real candles", () => {
    store.applySnapshot("spot", [snapshot()]);
    const now = Date.now();
    store.seedPrices(
      "spot:BTCUSDT",
      Array.from({ length: 10 }, (_, index) => ({
        t: now - (10 - index) * 60_000,
        p: 100 + index,
      })),
    );
    const row = store.getRow("spot:BTCUSDT");
    expect(row?.d.m5).not.toBeNull();
    expect(row?.d.m5 as number).toBeGreaterThan(0);
  });

  it("tracks open interest history", () => {
    store.applySnapshot("futures", [snapshot({ market: "futures" })]);
    store.applyOpenInterest("BTCUSDT", 1_000);
    expect(store.getRow("futures:BTCUSDT")?.openInterest).toBe(1_000);
    // A single sample is not a change.
    expect(store.getRow("futures:BTCUSDT")?.d.oiChange).toBeNull();
  });

  it("applies authoritative precision from exchange metadata", () => {
    store.applySnapshot("spot", [snapshot()]);
    store.applyMeta("spot", [
      {
        market: "spot",
        id: "BTCUSDT",
        symbol: "BTCUSDT",
        base: "BTC",
        quote: "USDT",
        decimals: 6,
        tickSize: 0.000001,
        listingTime: null,
      },
    ]);
    expect(store.getRow("spot:BTCUSDT")?.decimals).toBe(6);
  });

  it("resets history after a websocket gap", () => {
    store.applySnapshot("spot", [snapshot()]);
    const now = Date.now();
    store.seedPrices(
      "spot:BTCUSDT",
      Array.from({ length: 10 }, (_, index) => ({ t: now - (10 - index) * 60_000, p: 100 + index })),
    );
    expect(store.getRow("spot:BTCUSDT")?.d.m5).not.toBeNull();
    store.resetHistory("spot:BTCUSDT");
    expect(store.getRow("spot:BTCUSDT")?.d.m5).toBeNull();
  });
});
