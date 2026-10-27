/** Number, price, percent and time formatting shared by every module. */

const EMPTY = "--";

export function isNum(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * "0.01000000" -> 2 decimals, "0.00000001" -> 8, "1.00000000" -> 0.
 * Binance pads tick sizes with trailing zeros, which carry no meaning.
 */
export function decimalsFromTickSize(tickSize: string | number | null | undefined): number {
  if (tickSize === null || tickSize === undefined) return 2;
  const raw = typeof tickSize === "number" ? tickSize.toString() : String(tickSize).trim();
  if (!raw || raw === "0") return 2;
  if (/e-/i.test(raw)) {
    return Math.max(0, Math.min(12, Number(raw.split(/e-/i)[1] ?? 0)));
  }
  const dot = raw.indexOf(".");
  if (dot < 0) return 0;
  const fraction = raw.slice(dot + 1).replace(/0+$/, "");
  return Math.max(0, Math.min(12, fraction.length));
}

/** A precision guess used until authoritative exchange metadata arrives. */
export function guessDecimals(price: number): number {
  const abs = Math.abs(price);
  if (!Number.isFinite(abs) || abs === 0) return 2;
  if (abs >= 1000) return 2;
  if (abs >= 1) return 4;
  if (abs >= 0.01) return 5;
  if (abs >= 0.0001) return 6;
  if (abs >= 0.00001) return 7;
  return 8;
}

export function formatPrice(
  value: number | null | undefined,
  decimals = 2,
  options: { group?: boolean } = {},
): string {
  if (!isNum(value)) return EMPTY;
  const safe = Math.max(0, Math.min(12, Math.round(decimals)));
  return value.toLocaleString("en-US", {
    minimumFractionDigits: safe,
    maximumFractionDigits: safe,
    useGrouping: options.group ?? true,
  });
}

export function formatPriceAuto(value: number | null | undefined): string {
  if (!isNum(value)) return EMPTY;
  const abs = Math.abs(value);
  if (abs === 0) return "0";
  if (abs >= 1000) return formatPrice(value, 2);
  if (abs >= 1) return formatPrice(value, 4);
  if (abs >= 0.01) return formatPrice(value, 5);
  return formatPrice(value, 8);
}

export function formatPercent(
  value: number | null | undefined,
  digits = 2,
  options: { sign?: boolean } = {},
): string {
  if (!isNum(value)) return EMPTY;
  const sign = options.sign ?? true;
  const prefix = sign && value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(digits)}%`;
}

export function formatCompact(value: number | null | undefined, digits = 2): string {
  if (!isNum(value)) return EMPTY;
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

export function formatInteger(value: number | null | undefined): string {
  if (!isNum(value)) return EMPTY;
  return Math.round(value).toLocaleString("en-US");
}

/** Funding rates arrive as a fraction: 0.0001 === 0.01%. */
export function formatFunding(value: number | null | undefined, digits = 4): string {
  if (!isNum(value)) return EMPTY;
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(digits)}%`;
}

export function formatSignedCompact(value: number | null | undefined): string {
  if (!isNum(value)) return EMPTY;
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}${formatCompact(Math.abs(value))}`;
}

export function formatDateTime(timestamp: number | null | undefined): string {
  if (!isNum(timestamp) || timestamp <= 0) return EMPTY;
  const d = new Date(timestamp);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(
    d.getMinutes(),
  )}:${p(d.getSeconds())}`;
}

export function timeAgo(timestamp: number | null | undefined, now = Date.now()): string {
  if (!isNum(timestamp) || timestamp <= 0) return EMPTY;
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 2) return "刚刚";
  if (seconds < 60) return `${seconds} 秒前`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

export function countdown(timestamp: number | null | undefined, now = Date.now()): string {
  if (!isNum(timestamp) || timestamp <= 0) return EMPTY;
  const diff = timestamp - now;
  if (diff <= 0) return "结算中";
  const total = Math.floor(diff / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return hours > 0 ? `${p(hours)}:${p(minutes)}:${p(seconds)}` : `${p(minutes)}:${p(seconds)}`;
}

