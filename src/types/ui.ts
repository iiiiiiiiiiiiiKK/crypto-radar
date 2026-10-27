export type TableDensity = "compact" | "cozy" | "roomy";

export interface ColumnVisibility {
  price: boolean;
  change: boolean;
  changePercent: boolean;
  high: boolean;
  low: boolean;
  volume: boolean;
  quoteVolume: boolean;
  bidAsk: boolean;
  markPrice: boolean;
  fundingRate: boolean;
  openInterest: boolean;
  updatedAt: boolean;
}

/**
 * The columns the market table can be sorted by. The identifiers match the
 * column ids, so the header, the desktop table and the mobile sort bar all
 * share one vocabulary.
 */
export type SortKey =
  | "symbol"
  | "price"
  | "changePercent"
  | "high24h"
  | "low24h"
  | "volume24h"
  | "quoteVolume24h"
  | "bidPrice"
  | "markPrice"
  | "fundingRate"
  | "openInterest"
  | "updatedAt";

export interface SortState {
  key: SortKey;
  desc: boolean;
}
