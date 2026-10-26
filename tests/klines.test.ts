import { describe, expect, it } from "vitest";
import { sortAndDedupe } from "@/features/chart/useKlines";
import type { Candle } from "@/types/market";

function candle(time: number, close = 1): Candle {
  return { time, open: 1, high: 1, low: 1, close, volume: 1 };
}

describe("sortAndDedupe", () => {
  it("sorts candles by open time", () => {
    const result = sortAndDedupe([candle(3), candle(1), candle(2)]);
    expect(result.map((item) => item.time)).toEqual([1, 2, 3]);
  });

  it("keeps the newest version of a duplicated candle", () => {
    const result = sortAndDedupe([candle(1, 5), candle(1, 9)]);
    expect(result).toHaveLength(1);
    expect(result[0].close).toBe(9);
  });

  it("drops candles with an invalid timestamp", () => {
    const result = sortAndDedupe([candle(Number.NaN), candle(1)]);
    expect(result).toHaveLength(1);
  });
});
