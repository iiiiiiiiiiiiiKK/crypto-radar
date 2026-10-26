import { useCallback, useEffect, useRef, useState } from "react";
import { getAdapter } from "@/services/binance";
import { KLINE_PAGE_SIZE } from "@/lib/constants/markets";
import type { Candle, Interval, MarketId } from "@/types/market";

export interface KlineState {
  candles: Candle[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  reload: () => void;
  loadMore: () => void;
}

/** Loads historical candles and keeps them sorted and free of duplicates. */
export function useKlines(market: MarketId, symbolId: string, interval: Interval): KlineState {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [nonce, setNonce] = useState(0);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    if (!symbolId) return;
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const adapter = getAdapter(market);
      const data = await adapter.listKlines(symbolId, interval, KLINE_PAGE_SIZE);
      if (id !== requestId.current) return;
      const sorted = sortAndDedupe(data);
      setCandles(sorted);
      setHasMore(sorted.length >= KLINE_PAGE_SIZE);
    } catch (err) {
      if (id !== requestId.current) return;
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setCandles([]);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [market, symbolId, interval]);

  useEffect(() => {
    void load();
  }, [load, nonce]);

  const loadMore = useCallback(async () => {
    if (!symbolId || loadingMore || !hasMore || candles.length === 0) return;
    const id = requestId.current;
    setLoadingMore(true);
    try {
      const adapter = getAdapter(market);
      const oldest = candles[0];
      const data = await adapter.listKlines(symbolId, interval, KLINE_PAGE_SIZE);
      if (id !== requestId.current) return;
      const older = data.filter((candle) => candle.time < oldest.time);
      const merged = sortAndDedupe([...older, ...candles]);
      setCandles(merged);
      setHasMore(older.length >= KLINE_PAGE_SIZE);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (id === requestId.current) setLoadingMore(false);
    }
  }, [candles, hasMore, interval, loadingMore, market, symbolId]);

  return {
    candles,
    loading,
    loadingMore,
    error,
    hasMore,
    reload: () => setNonce((n) => n + 1),
    loadMore: () => void loadMore(),
  };
}

/** Sorts candles ascending by open time and removes duplicated open times. */
export function sortAndDedupe(candles: Candle[]): Candle[] {
  const map = new Map<number, Candle>();
  for (const candle of candles) {
    if (!Number.isFinite(candle.time)) continue;
    const existing = map.get(candle.time);
    if (!existing || candle.close > existing.close) map.set(candle.time, candle);
  }
  return [...map.values()].sort((a, b) => a.time - b.time);
}
