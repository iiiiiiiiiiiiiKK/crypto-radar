const EMPTY = "--";

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Derive the number of decimals a market uses from its tick size.
 * "0.01000000" -> 2, "0.00000001" -> 8, "1.00000000" -> 0
 */
export function decimalsFromTickSize(tickSize: string | number | null | undefined): number {
  if (tickSize == null) return 2;
  const raw = typeof tickSize === "number" ? tickSize.toString() : String(tickSize).trim();
  if (!raw || raw === "0") return 2;
  if (/e/i.test(raw)) {
    const exponent = Number(raw.split(/e/i)[1] ?? "0");
    return Math.max(0, Math.min(12, -exponent));
  }
  // Binance pads tick sizes ("0.01000000") — trailing zeros carry no meaning.
  const dot = raw.indexOf(".");
  if (dot < 0) return 0;
  const fraction = raw.slice(dot + 1).replace(/0+$/, "");
  return Math.max(0, Math.min(12, fraction.length));
}

/** Format a price with the precision of the market it belongs to. */
export function formatPrice(
  value: number | null | undefined,
  decimals = 2,
  options: { group?: boolean } = {},
): string {
  if (!isFiniteNumber(value)) return EMPTY;
  const safe = Math.max(0, Math.min(12, Math.round(decimals)));
  return value.toLocaleString("en-US", {
    minimumFractionDigits: safe,
    maximumFractionDigits: safe,
    useGrouping: options.group ?? true,
  });
}

export function formatPriceAuto(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) return EMPTY;
  const abs = Math.abs(value);
  if (abs >= 1000) return formatPrice(value, 2);
  if (abs >= 1) return formatPrice(value, 4);
  if (abs >= 0.01) return formatPrice(value, 5);
  if (abs === 0) return "0";
  return formatPrice(value, 8);
}

export function formatPercent(
  value: number | null | undefined,
  digits = 2,
  options: { sign?: boolean } = {},
): string {
  if (!isFiniteNumber(value)) return EMPTY;
  const sign = options.sign ?? true;
  const prefix = sign && value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(digits)}%`;
}

export function formatCompact(value: number | null | undefined, digits = 2): string {
  if (!isFiniteNumber(value)) return EMPTY;
  const abs = Math.abs(value);
  const units: Array<[number, string]> = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ];
  for (const [size, suffix] of units) {
    if (abs >= size) return `${(value / size).toFixed(digits)}${suffix}`;
  }
  if (abs >= 1) return value.toFixed(digits);
  return value.toFixed(Math.min(8, digits + 4));
}

export function formatQuantity(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) return EMPTY;
  return formatCompact(value, 2);
}

export function formatUsd(value: number | null | undefined, digits = 2): string {
  if (!isFiniteNumber(value)) return EMPTY;
  return `$${formatPrice(value, digits)}`;
}

/** Funding rates arrive as a fraction (0.0001 === 0.01%). */
export function formatFundingRate(value: number | null | undefined, digits = 4): string {
  if (!isFiniteNumber(value)) return EMPTY;
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(digits)}%`;
}

export function formatNumber(value: number | null | undefined, digits = 2): string {
  if (!isFiniteNumber(value)) return EMPTY;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
