import type { MarketTicker } from "@/types/market";
import type { SortState } from "@/types/ui";

export type Board = "all" | "gainers" | "losers" | "volume";

/** The two ways the market can be presented. */
export type MarketView = "list" | "heatmap";

/**
 * The leaderboard tabs are not decoration: each one filters and orders the
 * live table, so clicking 涨幅榜 actually shows the strongest gainers first.
 */
export function applyBoard(
  tickers: MarketTicker[],
  board: Board,
  sort: SortState,
): { rows: MarketTicker[]; sort: SortState } {
  switch (board) {
    case "gainers":
      return {
        rows: tickers.filter((ticker) => ticker.priceChangePercent > 0),
        sort: { key: "changePercent", desc: true },
      };
    case "losers":
      return {
        rows: tickers.filter((ticker) => ticker.priceChangePercent < 0),
        sort: { key: "changePercent", desc: false },
      };
    case "volume":
      return { rows: tickers, sort: { key: "quoteVolume24h", desc: true } };
    default:
      return { rows: tickers, sort };
  }
}

export interface Breadth {
  up: number;
  down: number;
  flat: number;
  total: number;
  upPercent: number;
  downPercent: number;
}

/** Advancers versus decliners across the current market. */
export function marketBreadth(tickers: MarketTicker[]): Breadth {
  let up = 0;
  let down = 0;
  let flat = 0;
  for (const ticker of tickers) {
    if (ticker.priceChangePercent > 0.05) up += 1;
    else if (ticker.priceChangePercent < -0.05) down += 1;
    else flat += 1;
  }
  const total = tickers.length || 1;
  return {
    up,
    down,
    flat,
    total: tickers.length,
    upPercent: (up / total) * 100,
    downPercent: (down / total) * 100,
  };
}
