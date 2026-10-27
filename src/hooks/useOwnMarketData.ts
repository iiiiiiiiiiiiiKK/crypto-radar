import { useEffect, useState } from "react";
import { getAdapter } from "@/services/binance";
import { useMarketStore } from "@/stores/marketStore";
import type { MarketTicker } from "@/types/market";

/**
 * Loads tickers for a page that is not the market page.
 *
 * Pages such as Meme Studio, the event centre or the trader base are opened
 * directly by URL, so they cannot rely on the shared market store having been
 * started by the market table. This hook starts the shared feed when it is
 * empty and returns its tickers, or fetches its own snapshot as a fallback.
 */
export function useOwnMarketData(): { tickers: MarketTicker[]; loading: boolean } {
  const shared = useMarketStore((state) => state.tickers);
  const sharedMarket = useMarketStore((state) => state.market);
  const setMarket = useMarketStore((state) => state.setMarket);
  const [own, setOwn] = useState<MarketTicker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (shared.length > 0) {
      setLoading(false);
      return;
    }
    // Kick the shared feed so the rest of the app benefits too.
    setMarket(sharedMarket);
    let cancelled = false;
    getAdapter(sharedMarket)
      .listTickers()
      .then((tickers) => {
        if (!cancelled) {
          setOwn(tickers);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shared.length, sharedMarket]);

  return { tickers: shared.length > 0 ? shared : own, loading };
}
