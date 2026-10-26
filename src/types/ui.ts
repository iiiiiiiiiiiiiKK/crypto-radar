import type { MarketTicker } from "@/types/market";

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

export interface SortState {
  key: keyof MarketTicker | "symbol";
  desc: boolean;
}
