import type { MarketTicker } from "@/types/market";

export type ArenaBoardId = "gainers" | "losers" | "volume" | "spike" | "funding" | "watchlist";

export interface ArenaEntry {
  ticker: MarketTicker;
  /** The number the board ranks by, already in display units. */
  metric: number;
  /** Board specific extra text, e.g. "5.2×". */
  badge?: string;
}

export interface VolumeSample {
  quoteVolume: number;
  at: number;
}

/**
 * Rolling per-symbol turnover samples used to detect a volume spike.
 *
 * A "spike" compares the current turnover velocity with the average velocity
 * of the whole 24 h window: the quote volume of a pair grows at
 * `volume / 86400` per second on average, so trading much faster than that
 * means the pair is unusually active right now. That is a real, explainable
 * metric — no random numbers.
 */
export class VolumeTracker {
  private samples = new Map<string, VolumeSample>();
  /** Most recent cumulative turnover per symbol. */
  private latest = new Map<string, number>();

  update(tickers: MarketTicker[], now = Date.now()): void {
    for (const ticker of tickers) {
      const volume = ticker.quoteVolume24h;
      if (volume === null || !Number.isFinite(volume)) continue;
      // The baseline is the first volume we ever saw; later samples are kept
      // aside so the spike calculation can measure the delta from it.
      if (!this.samples.has(ticker.symbol)) {
        this.samples.set(ticker.symbol, { quoteVolume: volume, at: now });
      }
      this.latest.set(ticker.symbol, volume);
    }
  }

  /**
   * The spike multiplier for one symbol given its latest cumulative volume.
   * `1` means "trading exactly at its 24 h average pace".
   */
  spike(symbol: string, currentVolume?: number, now = Date.now()): number | null {
    const sample = this.samples.get(symbol);
    if (!sample) return null;
    const elapsed = (now - sample.at) / 1000;
    if (elapsed < 15) return null;
    const volume = currentVolume ?? this.latest.get(symbol) ?? sample.quoteVolume;
    const delta = volume - sample.quoteVolume;
    if (delta <= 0) return 0;
    const recentVelocity = delta / elapsed; // quote per second right now
    const averageVelocity = sample.quoteVolume / 86_400; // quote per second over 24 h
    if (averageVelocity <= 0) return null;
    return recentVelocity / averageVelocity;
  }

  get size(): number {
    return this.samples.size;
  }

  /** Drops every baseline; used when the market changes. */
  reset(): void {
    this.samples.clear();
    this.latest.clear();
  }
}

export const ARENA_BOARD_IDS: ArenaBoardId[] = [
  "gainers",
  "losers",
  "volume",
  "spike",
  "funding",
  "watchlist",
];

export interface BuildBoardOptions {
  tickers: MarketTicker[];
  board: ArenaBoardId;
  limit?: number;
  watchedKeys?: Set<string>;
  tracker?: VolumeTracker;
  market?: string;
}

/**
 * Builds one arena board from the live ticker list. Every board is a pure
 * function of real market data, so the ranking is reproducible and auditable.
 */
export function buildBoard({
  tickers,
  board,
  limit = 24,
  watchedKeys,
  tracker,
  market = "spot",
}: BuildBoardOptions): ArenaEntry[] {
  switch (board) {
    case "gainers":
      return tickers
        .filter((ticker) => ticker.priceChangePercent > 0)
        .sort((a, b) => b.priceChangePercent - a.priceChangePercent)
        .slice(0, limit)
        .map((ticker) => ({ ticker, metric: ticker.priceChangePercent }));

    case "losers":
      return tickers
        .filter((ticker) => ticker.priceChangePercent < 0)
        .sort((a, b) => a.priceChangePercent - b.priceChangePercent)
        .slice(0, limit)
        .map((ticker) => ({ ticker, metric: ticker.priceChangePercent }));

    case "volume":
      return tickers
        .filter((ticker) => (ticker.quoteVolume24h ?? 0) > 0)
        .sort((a, b) => (b.quoteVolume24h ?? 0) - (a.quoteVolume24h ?? 0))
        .slice(0, limit)
        .map((ticker) => ({ ticker, metric: ticker.quoteVolume24h ?? 0 }));

    case "spike": {
      if (!tracker) return [];
      const now = Date.now();
      const entries: ArenaEntry[] = [];
      for (const ticker of tickers) {
        const volume = ticker.quoteVolume24h;
        if (volume === null || volume <= 0) continue;
        const spike = tracker.spike(ticker.symbol, volume, now);
        if (spike === null || spike < 1.5) continue;
        entries.push({ ticker, metric: spike, badge: `${spike.toFixed(1)}×` });
      }
      return entries.sort((a, b) => b.metric - a.metric).slice(0, limit);
    }

    case "funding":
      return tickers
        .filter((ticker) => ticker.fundingRate !== null)
        .sort((a, b) => Math.abs(b.fundingRate ?? 0) - Math.abs(a.fundingRate ?? 0))
        .slice(0, limit)
        .map((ticker) => ({
          ticker,
          metric: (ticker.fundingRate ?? 0) * 100,
          badge: `${((ticker.fundingRate ?? 0) * 100).toFixed(4)}%`,
        }));

    case "watchlist": {
      if (!watchedKeys || watchedKeys.size === 0) return [];
      return tickers
        .filter((ticker) => watchedKeys.has(`${market}:${ticker.symbol}`))
        .sort((a, b) => Math.abs(b.priceChangePercent) - Math.abs(a.priceChangePercent))
        .slice(0, limit)
        .map((ticker) => ({ ticker, metric: ticker.priceChangePercent }));
    }

    default:
      return [];
  }
}
