import type { Candle, Interval, MarketId, SymbolMeta, TickerRow } from "@/types/market";

/** A row exactly as an adapter returns it: no local key, no derived metrics. */
export type SnapshotRow = Omit<TickerRow, "key" | "d">;

/** One `!miniTicker@arr` entry, already parsed. */
export interface TickerDelta {
  symbol: string;
  price: number;
  open24h: number | null;
  high24h: number | null;
  low24h: number | null;
  volume24h: number | null;
  quoteVolume24h: number | null;
  eventTime: number;
}

/** One `!markPrice@arr@1s` entry (funding rate + mark/index price). */
export interface MarkDelta {
  symbol: string;
  markPrice: number | null;
  indexPrice: number | null;
  fundingRate: number | null;
  nextFundingTime: number | null;
  eventTime: number;
}

export interface KlineUpdate {
  symbol: string;
  interval: Interval;
  candle: Candle;
  closed: boolean;
}

export interface MarketAdapter {
  readonly market: MarketId;
  readonly supportsKlines: boolean;
  /** Full universe: 24h stats for every tradable pair. */
  loadTickers(signal?: AbortSignal): Promise<SnapshotRow[]>;
  /** Authoritative per-pair metadata (precision, base/quote). */
  loadMeta(signal?: AbortSignal): Promise<SymbolMeta[]>;
  /** Market-wide extras fetched in one request (funding, mark price). */
  loadExtras?(): Promise<Map<string, Partial<SnapshotRow>>>;
  fetchKlines(symbol: string, interval: Interval, limit?: number): Promise<Candle[]>;
}
