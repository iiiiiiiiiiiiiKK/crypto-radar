import { describe, expect, it } from "vitest";
import {
  countdown,
  decimalsFromTickSize,
  formatCompact,
  formatFunding,
  formatPercent,
  formatPrice,
  formatPriceAuto,
  guessDecimals,
  timeAgo,
} from "@/lib/format";

describe("decimalsFromTickSize", () => {
  it("reads padded tick sizes", () => {
    expect(decimalsFromTickSize("0.01000000")).toBe(2);
    expect(decimalsFromTickSize("0.00000001")).toBe(8);
    expect(decimalsFromTickSize("1.00000000")).toBe(0);
    expect(decimalsFromTickSize("0.00010000")).toBe(4);
  });

  it("falls back for missing or zero input", () => {
    expect(decimalsFromTickSize(null)).toBe(2);
    expect(decimalsFromTickSize("0")).toBe(2);
  });
});

describe("guessDecimals", () => {
  it("scales with magnitude", () => {
    expect(guessDecimals(64231.5)).toBe(2);
    expect(guessDecimals(2.5)).toBe(4);
    expect(guessDecimals(0.023)).toBe(5);
    expect(guessDecimals(0.0000012)).toBe(8);
  });
});

describe("formatPrice", () => {
  it("formats with the requested precision", () => {
    expect(formatPrice(64231.5, 2)).toBe("64,231.50");
    expect(formatPrice(0.00012345, 8)).toBe("0.00012345");
  });

  it("never renders a missing value as zero", () => {
    expect(formatPrice(null)).toBe("--");
    expect(formatPrice(undefined)).toBe("--");
    expect(formatPrice(Number.NaN)).toBe("--");
  });
});

describe("formatPriceAuto", () => {
  it("picks a readable precision", () => {
    expect(formatPriceAuto(64231.5)).toBe("64,231.50");
    expect(formatPriceAuto(2.5)).toBe("2.5000");
    expect(formatPriceAuto(0.00012345)).toBe("0.00012345");
  });
});

describe("formatPercent", () => {
  it("adds a sign for positive values only", () => {
    expect(formatPercent(1.234)).toBe("+1.23%");
    expect(formatPercent(-1.234)).toBe("-1.23%");
    expect(formatPercent(0)).toBe("0.00%");
    expect(formatPercent(null)).toBe("--");
  });
});

describe("formatCompact", () => {
  it("suffixes large numbers", () => {
    expect(formatCompact(1_500)).toBe("1.50K");
    expect(formatCompact(2_400_000)).toBe("2.40M");
    expect(formatCompact(3_100_000_000)).toBe("3.10B");
  });
});

describe("formatFunding", () => {
  it("converts the fraction to a percentage", () => {
    expect(formatFunding(0.0001)).toBe("+0.0100%");
    expect(formatFunding(-0.00025)).toBe("-0.0250%");
    expect(formatFunding(null)).toBe("--");
  });
});

describe("time helpers", () => {
  it("describes relative time", () => {
    const now = Date.UTC(2026, 0, 1, 12, 0, 0);
    expect(timeAgo(now - 1_000, now)).toBe("刚刚");
    expect(timeAgo(now - 20_000, now)).toBe("20 秒前");
    expect(timeAgo(now - 5 * 60_000, now)).toBe("5 分钟前");
    expect(timeAgo(null, now)).toBe("--");
  });

  it("counts down to the next funding", () => {
    const now = Date.UTC(2026, 0, 1, 12, 0, 0);
    expect(countdown(now + 3_600_000, now)).toBe("01:00:00");
    expect(countdown(now + 90_000, now)).toBe("01:30");
    expect(countdown(now - 1, now)).toBe("结算中");
  });
});
