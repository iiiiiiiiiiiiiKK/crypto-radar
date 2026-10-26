import { describe, expect, it } from "vitest";
import { ema, macd, rsi, sma, toLinePoints } from "@/features/indicators";

describe("sma", () => {
  it("returns null until the window is complete", () => {
    const result = sma([1, 2, 3, 4, 5], 3);
    expect(result[0]).toBeNull();
    expect(result[1]).toBeNull();
    expect(result[2]).toBe(2);
    expect(result[3]).toBe(3);
    expect(result[4]).toBe(4);
  });
});

describe("ema", () => {
  it("seeds with the simple average of the first period", () => {
    const result = ema([2, 4, 6, 8], 3);
    expect(result[0]).toBeNull();
    expect(result[1]).toBeNull();
    expect(result[2]).toBe(4);
    expect(result[3]).toBeCloseTo(6, 6);
  });
});

describe("rsi", () => {
  it("is 100 when every move is a gain", () => {
    const values = Array.from({ length: 20 }, (_, index) => index + 1);
    const result = rsi(values, 14);
    expect(result[13]).toBeNull();
    expect(result[14]).toBe(100);
  });

  it("is 0 when every move is a loss", () => {
    const values = Array.from({ length: 20 }, (_, index) => 20 - index);
    const result = rsi(values, 14);
    expect(result[14]).toBe(0);
  });

  it("stays inside 0..100", () => {
    const values = [10, 11, 10.5, 12, 11.7, 13, 12.4, 14, 13.3, 15, 14.8, 16, 15.4, 17, 16.5, 18];
    for (const value of rsi(values, 14)) {
      if (value === null) continue;
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });
});

describe("macd", () => {
  it("produces aligned macd, signal and histogram series", () => {
    const values = Array.from({ length: 80 }, (_, index) => 100 + index + Math.sin(index / 3) * 5);
    const result = macd(values);
    expect(result.macd.length).toBe(values.length);
    expect(result.signal.length).toBe(values.length);
    expect(result.histogram.length).toBe(values.length);
    const lastMacd = result.macd[result.macd.length - 1];
    const lastSignal = result.signal[result.signal.length - 1];
    const lastHistogram = result.histogram[result.histogram.length - 1];
    expect(lastMacd).not.toBeNull();
    expect(lastSignal).not.toBeNull();
    expect(lastHistogram).toBeCloseTo((lastMacd as number) - (lastSignal as number), 8);
  });
});

describe("toLinePoints", () => {
  it("drops null values and keeps the time alignment", () => {
    const points = toLinePoints([1, 2, 3], [null, 5, null]);
    expect(points).toEqual([{ time: 2, value: 5 }]);
  });
});
