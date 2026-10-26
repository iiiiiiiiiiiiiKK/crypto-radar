import type { Interval, MarketId } from "@/types/market";

export const MARKET_IDS: MarketId[] = ["spot", "futures", "alpha"];

export const INTERVALS: Interval[] = [
  "1m",
  "3m",
  "5m",
  "15m",
  "30m",
  "1h",
  "2h",
  "4h",
  "6h",
  "8h",
  "12h",
  "1d",
  "3d",
  "1w",
  "1M",
];

/** Binance returns at most 1500 klines per request. */
export const KLINE_MAX_LIMIT = 1500;
export const KLINE_PAGE_SIZE = 500;

/** How long without any WS message before the feed is considered stale. */
export const STALE_AFTER_MS = 30_000;

/** Batch window used to coalesce high-frequency price updates. */
export const FLUSH_INTERVAL_MS = 250;

export const ALPHA_POLL_MS = Number(import.meta.env.VITE_ALPHA_POLL_MS ?? 20_000);
