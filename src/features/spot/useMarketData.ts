import { useEffect, useMemo } from "react";
import { useMarketStore } from "@/stores/marketStore";
import type { MarketId } from "@/types/market";

/** Ensures the shared feed is running for the requested market. */
export function useMarketData(market: MarketId) {
  const setMarket = useMarketStore((state) => state.setMarket);
  const tickers = useMarketStore((state) => state.tickers);
  const state = useMarketStore((state) => state.state);
  const loading = useMarketStore((state) => state.loading);
  const error = useMarketStore((state) => state.error);
  const lastUpdated = useMarketStore((state) => state.lastUpdated);
  const refresh = useMarketStore((state) => state.refresh);

  useEffect(() => {
    setMarket(market);
  }, [market, setMarket]);

  return useMemo(
    () => ({ tickers, state, loading, error, lastUpdated, refresh }),
    [tickers, state, loading, error, lastUpdated, refresh],
  );
}
