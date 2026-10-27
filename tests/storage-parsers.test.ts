import { beforeEach, describe, expect, it } from "vitest";
import { clearAll, isStorageAvailable, readJson, removeKey, writeJson } from "@/lib/storage";
import { parseKline } from "@/services/ws/klineStream";
import { parseMarkPrice, parseMiniTicker } from "@/services/ws/marketFeed";

describe("storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("round-trips JSON under a namespace", () => {
    expect(isStorageAvailable()).toBe(true);
    expect(writeJson("unit", { a: 1 })).toBe(true);
    expect(window.localStorage.getItem("crypto-radar:v2:unit")).toBe('{"a":1}');
    expect(readJson("unit", null)).toEqual({ a: 1 });
  });

  it("returns the fallback for missing or broken data", () => {
    expect(readJson("missing", 42)).toBe(42);
    window.localStorage.setItem("crypto-radar:v2:broken", "{not json");
    expect(readJson("broken", "fallback")).toBe("fallback");
  });

  it("removes and clears only its own keys", () => {
    writeJson("a", 1);
    writeJson("b", 2);
    window.localStorage.setItem("other-app", "keep");
    removeKey("a");
    expect(readJson("a", null)).toBeNull();
    expect(readJson("b", null)).toBe(2);
    clearAll();
    expect(readJson("b", null)).toBeNull();
    expect(window.localStorage.getItem("other-app")).toBe("keep");
  });
});

describe("websocket payload parsers", () => {
  it("parses an all-market mini ticker frame", () => {
    const deltas = parseMiniTicker([
      { e: "24hrMiniTicker", E: 1000, s: "BTCUSDT", c: "100.5", o: "99", h: "101", l: "98", v: "10", q: "1000" },
      { e: "24hrMiniTicker", E: 1000, s: "BROKEN", c: "abc" },
    ]);
    expect(deltas).toHaveLength(1);
    expect(deltas[0]).toEqual({
      symbol: "BTCUSDT",
      price: 100.5,
      open24h: 99,
      high24h: 101,
      low24h: 98,
      volume24h: 10,
      quoteVolume24h: 1000,
      eventTime: 1000,
    });
  });

  it("ignores non-array frames", () => {
    expect(parseMiniTicker({ s: "BTCUSDT" })).toHaveLength(0);
    expect(parseMiniTicker(null)).toHaveLength(0);
  });

  it("parses the mark price / funding frame", () => {
    const [delta] = parseMarkPrice([
      { e: "markPriceUpdate", E: 2000, s: "BTCUSDT", p: "100.5", i: "100.4", r: "0.0001", T: 3000 },
    ]);
    expect(delta.markPrice).toBe(100.5);
    expect(delta.fundingRate).toBe(0.0001);
    expect(delta.nextFundingTime).toBe(3000);
  });

  it("parses a kline frame and its closed flag", () => {
    const open = parseKline({
      e: "kline",
      k: { t: 60_000, o: "1", h: "2", l: "0.5", c: "1.5", v: "10", x: false },
    });
    expect(open?.candle).toEqual({ time: 60_000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 });
    expect(open?.closed).toBe(false);

    const closed = parseKline({
      e: "kline",
      k: { t: 60_000, o: "1", h: "2", l: "0.5", c: "1.5", v: "10", x: true },
    });
    expect(closed?.closed).toBe(true);
    expect(parseKline({ e: "kline" })).toBeNull();
  });
});
