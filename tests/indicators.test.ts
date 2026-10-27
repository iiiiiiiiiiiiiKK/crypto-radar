import { describe, expect, it } from "vitest";
import { bollinger, ema, macd, rsi, sma, toLinePoints } from "@/features/charts/indicators";

describe("sma", () => {
  it("warms up with nulls and then averages", () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });

  it("returns all nulls for an invalid period", () => {
    expect(sma([1, 2, 3], 0)).toEqual([null, null, null]);
  });
});

describe("ema", () => {
  it("seeds with the SMA of the first window", () => {
    const values = [1, 2, 3, 4, 5];
    const result = ema(values, 3);
    expect(result[0]).toBeNull();
    expect(result[1]).toBeNull();
    expect(result[2]).toBeCloseTo(2);
    // alpha = 2 / (3 + 1) = 0.5 -> 4 * 0.5 + 2 * 0.5 = 3
    expect(result[3]).toBeCloseTo(3);
    expect(result[4]).toBeCloseTo(4);
  });
});

describe("rsi", () => {
  it("is 100 for a monotonically rising series", () => {
    const values = Array.from({ length: 20 }, (_, index) => index + 1);
    const result = rsi(values, 14);
    expect(result[13]).toBeNull();
    expect(result[14]).toBe(100);
  });

  it("is 50 when there is no movement", () => {
    const values = new Array(20).fill(5);
    expect(rsi(values, 14)[19]).toBe(50);
  });
});

describe("macd", () => {
  it("aligns to the input length", () => {
    const values = Array.from({ length: 60 }, (_, index) => 100 + Math.sin(index / 3) * 5);
    const result = macd(values);
    expect(result.macd).toHaveLength(60);
    expect(result.signal).toHaveLength(60);
    expect(result.histogram).toHaveLength(60);
    // Before the slow EMA warms up there is no MACD value.
    expect(result.macd[10]).toBeNull();
    expect(result.histogram[59]).not.toBeNull();
  });

  it("makes the histogram the difference between MACD and signal", () => {
    const values = Array.from({ length: 40 }, (_, index) => 50 + index);
    const result = macd(values);
    const last = 39;
    expect(result.histogram[last]).toBeCloseTo(
      (result.macd[last] as number) - (result.signal[last] as number),
    );
  });
});

describe("bollinger", () => {
  it("wraps the middle band by two deviations", () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const bands = bollinger(values, 5, 2);
    expect(bands.middle[4]).toBeCloseTo(3);
    expect(bands.upper[4]).toBeGreaterThan(bands.middle[4] as number);
    expect(bands.lower[4]).toBeLessThan(bands.middle[4] as number);
    expect(bands.upper[9]).toBeCloseTo(8 + Math.sqrt(2) * 2);
  });
});

describe("toLinePoints", () => {
  it("skips gaps so the chart never plots a missing value", () => {
    const points = toLinePoints([1, 2, 3], [null, 5, 6]);
    expect(points).toEqual([
      { time: 2, value: 5 },
      { time: 3, value: 6 },
    ]);
  });
});
