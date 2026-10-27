/**
 * The single source of truth for every market data type in Crypto Radar.
 *
 * Design rule: an exchange field is either a real value or `null`. Nothing is
 * ever defaulted to 0, because 0 is a meaningful price/volume and would let the
 * UI present invented data as real.
 */

export type MarketId = "spot" | "futures" | "alpha";

export const MARKET_IDS: readonly MarketId[] = ["spot", "futures", "alpha"] as const;

export const MARKET_LABEL: Record<MarketId, string> = {
  spot: "现货",
  futures: "U 本位永续",
  alpha: "Alpha",
};

export const MARKET_TAG: Record<MarketId, string> = {
  spot: "SPOT",
  futures: "PERP",
  alpha: "ALPHA",
};

/** Connection lifecycle of one data channel. */
export type ConnectionState =
  | "idle"
  | "connecting"
  | "live"
  | "stale"
  | "reconnecting"
  | "offline"
  | "error";

/** Freshness of the data currently rendered. */
export type DataStatus = "live" | "snapshot" | "stale" | "unavailable";

export type Interval =
  | "1m"
  | "3m"
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "2h"
  | "4h"
  | "6h"
  | "12h"
  | "1d"
  | "3d"
  | "1w"
  | "1M";

export const INTERVALS: readonly Interval[] = [
  "1m",
  "3m",
  "5m",
  "15m",
  "30m",
  "1h",
  "2h",
  "4h",
  "6h",
  "12h",
  "1d",
  "3d",
  "1w",
  "1M",
] as const;

/** Milliseconds covered by one candle of each interval (approximate for 1M). */
export const INTERVAL_MS: Record<Interval, number> = {
  "1m": 60_000,
  "3m": 180_000,
  "5m": 300_000,
  "15m": 900_000,
  "30m": 1_800_000,
  "1h": 3_600_000,
  "2h": 7_200_000,
  "4h": 14_400_000,
  "6h": 21_600_000,
  "12h": 43_200_000,
  "1d": 86_400_000,
  "3d": 259_200_000,
  "1w": 604_800_000,
  "1M": 2_592_000_000,
};

export interface Candle {
  /** Open time, milliseconds since epoch (exchange timestamp). */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Derived local metrics. These are computed from the live feed, never sent by the exchange. */
export interface DerivedMetrics {
  /** Percent change over the trailing window, computed from locally sampled prices. */
  m1: number | null;
  m5: number | null;
  m15: number | null;
  h1: number | null;
  /** Realised absolute move over the trailing 15 minutes (percent). */
  vol15m: number | null;
  /** Quote turnover per minute over the trailing minute. */
  turnoverPerMin: number | null;
  /** Current turnover pace divided by the trailing 15 minute baseline. */
  volumeSurge: number | null;
  /** Open interest change against the previous sample (percent). */
  oiChange: number | null;
  /** When the open interest sample behind `oiChange` was taken. */
  oiChangeAt: number | null;
}

export const EMPTY_METRICS: DerivedMetrics = {
  m1: null,
  m5: null,
  m15: null,
  h1: null,
  vol15m: null,
  turnoverPerMin: null,
  volumeSurge: null,
  oiChange: null,
  oiChangeAt: null,
};

/** Immutable snapshot of one trading pair, as rendered by the UI. */
export interface TickerRow {
  /** `${market}:${symbol}` — unique across markets. */
  key: string;
  market: MarketId;
  /** Display symbol: `BTCUSDT` for spot/futures, `AXIS/USDT` for Alpha. */
  symbol: string;
  /** Identifier used by the exchange API (identical to `symbol` except for Alpha). */
  id: string;
  base: string;
  quote: string;
  price: number | null;
  open24h: number | null;
  changePercent: number | null;
  high24h: number | null;
  low24h: number | null;
  volume24h: number | null;
  quoteVolume24h: number | null;
  trades24h: number | null;
  bidPrice: number | null;
  askPrice: number | null;
  markPrice: number | null;
  indexPrice: number | null;
  fundingRate: number | null;
  nextFundingTime: number | null;
  openInterest: number | null;
  decimals: number;
  /** Exchange event time of the last update (ms). */
  updatedAt: number;
  /** Local receive time of the last update (ms). */
  receivedAt: number;
  source: "stream" | "rest" | "poll";
  d: DerivedMetrics;
  meta?: {
    name?: string;
    chainName?: string;
    iconUrl?: string;
    listingTime?: number;
  };
}

export interface SymbolMeta {
  market: MarketId;
  id: string;
  symbol: string;
  base: string;
  quote: string;
  decimals: number;
  tickSize: number | null;
  listingTime: number | null;
  name?: string;
  chainName?: string;
  iconUrl?: string;
}

/** A rule that is evaluated against live rows. */
export type MetricId =
  | "change"
  | "absChange"
  | "turnover"
  | "volumeSurge"
  | "funding"
  | "oiChange"
  | "volatility";

export type MetricWindow = "1m" | "5m" | "15m" | "1h" | "24h";

export const METRIC_LABEL: Record<MetricId, string> = {
  change: "涨跌幅",
  absChange: "绝对波动",
  turnover: "成交额/分钟",
  volumeSurge: "成交量放大",
  funding: "资金费率",
  oiChange: "持仓量变化",
  volatility: "波动率",
};

export const WINDOW_LABEL: Record<MetricWindow, string> = {
  "1m": "1 分钟",
  "5m": "5 分钟",
  "15m": "15 分钟",
  "1h": "1 小时",
  "24h": "24 小时",
};

export type Comparator = "gte" | "lte" | "absGte";

export const COMPARATOR_LABEL: Record<Comparator, string> = {
  gte: "≥",
  lte: "≤",
  absGte: "|x| ≥",
};
