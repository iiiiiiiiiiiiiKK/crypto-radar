import { describe, expect, it } from "vitest";
import {
  decimalsFromTickSize,
  formatCompact,
  formatCountdown,
  formatFundingRate,
  formatPercent,
  formatPrice,
  formatPriceAuto,
  formatTimeAgo,
} from "@/lib/format";

describe("decimalsFromTickSize", () => {
  it("derives the precision from the exchange tick size", () => {
    expect(decimalsFromTickSize("0.01000000")).toBe(2);
    expect(decimalsFromTickSize("0.00000001")).toBe(8);
    expect(decimalsFromTickSize("1.00000000")).toBe(0);
    expect(decimalsFromTickSize("0.1")).toBe(1);
  });

  it("falls back to 2 for unusable input", () => {
    expect(decimalsFromTickSize(null)).toBe(2);
    expect(decimalsFromTickSize("0")).toBe(2);
    expect(decimalsFromTickSize(undefined)).toBe(2);
  });

  it("supports exponential notation", () => {
    expect(decimalsFromTickSize("1e-8")).toBe(8);
  });
});

describe("formatPrice", () => {
  it("keeps the requested precision", () => {
    expect(formatPrice(1234.5, 2)).toBe("1,234.50");
    expect(formatPrice(0.00001234, 8)).toBe("0.00001234");
    expect(formatPrice(1, 0)).toBe("1");
  });

  it("returns a placeholder for missing values", () => {
    expect(formatPrice(null)).toBe("--");
    expect(formatPrice(undefined)).toBe("--");
    expect(formatPrice(Number.NaN)).toBe("--");
  });
});

describe("formatPriceAuto", () => {
  it("scales the precision with the magnitude", () => {
    expect(formatPriceAuto(79698.77)).toBe("79,698.77");
    expect(formatPriceAuto(1.23456)).toBe("1.2346");
    expect(formatPriceAuto(0.000123456)).toBe("0.00012346");
  });
});

describe("formatPercent", () => {
  it("signs positive values", () => {
    expect(formatPercent(1.234)).toBe("+1.23%");
    expect(formatPercent(-1.235)).toBe("-1.24%");
    expect(formatPercent(0)).toBe("0.00%");
  });

  it("handles missing values", () => {
    expect(formatPercent(null)).toBe("--");
  });
});

describe("formatFundingRate", () => {
  it("converts the fraction into a percentage", () => {
    expect(formatFundingRate(0.0001)).toBe("+0.0100%");
    expect(formatFundingRate(-0.00025)).toBe("-0.0250%");
  });
});

describe("formatCompact", () => {
  it("abbreviates large numbers", () => {
    expect(formatCompact(1_500_000)).toBe("1.50M");
    expect(formatCompact(2_300_000_000)).toBe("2.30B");
    expect(formatCompact(950)).toBe("950.00");
  });
});

describe("time helpers", () => {
  it("formats a relative timestamp", () => {
    const now = 1_700_000_000_000;
    expect(formatTimeAgo(now - 3_000, now)).toBe("now");
    expect(formatTimeAgo(now - 30_000, now)).toBe("30s");
    expect(formatTimeAgo(now - 120_000, now)).toBe("2m");
    expect(formatTimeAgo(now - 7_200_000, now)).toBe("2h");
  });

  it("formats a countdown", () => {
    const now = 1_700_000_000_000;
    expect(formatCountdown(now + 3_725_000, now)).toBe("01:02:05");
    expect(formatCountdown(now - 1, now)).toBe("00:00:00");
  });
});
