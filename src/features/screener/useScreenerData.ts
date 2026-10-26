import { useCallback, useEffect, useRef, useState } from "react";
import { getAdapter } from "@/services/binance";
import type { MarketId, MarketTicker } from "@/types/market";

export interface ScreenerData {
  tickers: MarketTicker[];
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
  refresh: () => void;
}

/**
 * Loads the tickers of every market the screener can filter on.
 *
 * The shared market store keeps a single market alive, but the screener
 * scans spot, perpetuals and Alpha at the same time, so it fetches the
 * snapshots itself and refreshes them on a timer.
 */
export function useScreenerData(markets: MarketId[], intervalMs = 20_000): ScreenerData {
  const [tickers, setTickers] = useState<MarketTicker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const requestId = useRef(0);
  const key = markets.join(",");

  const load = useCallback(async () => {
    const id = ++requestId.current;
    const wanted = key.split(",").filter(Boolean) as MarketId[];
    try {
      const results = await Promise.allSettled(
        wanted.map(async (market) => {
          const adapter = getAdapter(market);
          const list = await adapter.listTickers();
          return list.map((ticker) => ({ ...ticker, market }));
        }),
      );
      if (id !== requestId.current) return;
      const merged: MarketTicker[] = [];
      const failures: string[] = [];
      for (const result of results) {
        if (result.status === "fulfilled") merged.push(...result.value);
        else failures.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
      }
      setTickers(merged);
      setLastUpdated(Date.now());
      setError(failures.length > 0 ? failures.join(" · ") : null);
      setLoading(false);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), intervalMs);
    return () => clearInterval(timer);
  }, [load, intervalMs]);

  return {
    tickers,
    loading,
    error,
    lastUpdated,
    refresh: () => void load(),
  };
}
