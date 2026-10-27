import { describe, expect, it } from "vitest";
import { clamp, mean, median, nearestIndex, pctChange, percentile, roundTo } from "@/lib/math";

describe("median", () => {
  it("handles odd and even lengths", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  it("does not mutate the input", () => {
    const values = [3, 1, 2];
    median(values);
    expect(values).toEqual([3, 1, 2]);
  });
});

describe("percentile", () => {
  it("interpolates", () => {
    expect(percentile([1, 2, 3, 4], 0)).toBe(1);
    expect(percentile([1, 2, 3, 4], 1)).toBe(4);
    expect(percentile([0, 10], 0.5)).toBe(5);
  });
});

describe("pctChange", () => {
  it("returns null for unusable inputs", () => {
    expect(pctChange(100, 110)).toBeCloseTo(10);
    expect(pctChange(100, 90)).toBeCloseTo(-10);
    expect(pctChange(0, 10)).toBeNull();
    expect(pctChange(null, 10)).toBeNull();
    expect(pctChange(10, null)).toBeNull();
  });
});

describe("mean and clamp", () => {
  it("computes the arithmetic mean", () => {
    expect(mean([1, 2, 3])).toBe(2);
    expect(mean([])).toBeNull();
  });

  it("clamps into range", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-5, 0, 3)).toBe(0);
  });
});

describe("nearestIndex", () => {
  it("finds the closest sorted value", () => {
    const sorted = [10, 20, 30, 40];
    expect(nearestIndex(sorted, 21)).toBe(1);
    expect(nearestIndex(sorted, 26)).toBe(2);
    expect(nearestIndex([], 1)).toBe(-1);
  });
});

describe("roundTo", () => {
  it("rounds to digits", () => {
    expect(roundTo(1.23456, 2)).toBe(1.23);
    expect(roundTo(1.23556, 3)).toBe(1.236);
  });
});
