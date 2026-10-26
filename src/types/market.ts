export type MarketId = "spot" | "futures" | "alpha";

export type ConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "stale"
  | "error";

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
  | "8h"
  | "12h"
  | "1d"
  | "3d"
  | "1w"
  | "1M";

export interface Candle {
  /** Open time in milliseconds. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SymbolMeta {
  market: MarketId;
  /** Exchange-native identifier, e.g. `BTCUSDT` or `ALPHA_1248`. */
  id: string;
  /** Human readable pair, e.g. `BTCUSDT` or `AXIS/USDT`. */
  symbol: string;
  base: string;
  quote: string;
  /** Display precision (decimals) derived from exchange filters. */
  decimals: number;
  tickSize: number | null;
  status?: string;
  listingTime: number | null;
  /** Alpha-only metadata. */
  chainName?: string;
  contractAddress?: string;
  iconUrl?: string;
  alphaId?: string;
  name?: string;
}

export interface MarketTicker {
  market: MarketId;
  symbol: string;
  id: string;
  base: string;
  quote: string;
  price: number;
  priceChangePercent: number;
  openPrice: number | null;
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
  tickSize?: number | null;
  updatedAt: number;
  listingTime: number | null;
  chainName?: string;
  iconUrl?: string;
  name?: string;
  alphaId?: string;
}

export interface MarketAdapter {
  readonly id: MarketId;
  /** Human readable label key used by the i18n dictionary. */
  listSymbols(): Promise<SymbolMeta[]>;
  listTickers(): Promise<MarketTicker[]>;
  listKlines(id: string, interval: Interval, limit?: number): Promise<Candle[]>;
  /** Query the adapter for market wide metadata (funding rates, open interest…). */
  fetchExtras?(id: string): Promise<Partial<MarketTicker>>;
  /**
   * Merge the authoritative market metadata (per-pair precision, base and
   * quote assets) into an already rendered ticker list. The heavy
   * `exchangeInfo` payload is fetched in the background so the table can
   * paint immediately.
   */
  applyMetadata?(tickers: MarketTicker[]): Promise<MarketTicker[]>;
}

export type Language = "zh" | "en";
