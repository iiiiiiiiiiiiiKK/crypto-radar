import { useCallback, useEffect, useMemo, useState } from "react";
import { getAdapter } from "@/services/binance";
import type { MarketTicker } from "@/types/market";

export interface BasisRow {
  base: string;
  spotSymbol: string;
  perpSymbol: string;
  spotPrice: number;
  perpPrice: number;
  /** (perp - spot) / spot, in percent. */
  basisPercent: number;
  fundingRate: number | null;
  /** Funding normalised to a year: three settlements a day. */
  fundingAnnualPercent: number | null;
  nextFundingTime: number | null;
  currency: "quote";
  quoteVolume: number;
  perpQuoteVolume: number;
  openInterest: number | null;
}

export interface BasisData {
  rows: BasisRow[];
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
  refresh: () => void;
}

function annualise(fundingRate: number | null): number | null {
  if (fundingRate === null || !Number.isFinite(fundingRate)) return null;
  // Binance settles the funding rate every eight hours, so three times a day.
  return fundingRate * 3 * 365 * 100;
}

/**
 * Joins the spot and the perpetual market on the base asset.
 *
 * The result is the cross-market picture a single-market table cannot show:
 * the premium the perpetual contract trades at over spot, and how much that
 * premium costs (or pays) per year through the funding rate.
 */
export function useBasisData(intervalMs = 20_000): BasisData {
  const [spot, setSpot] = useState<MarketTicker[]>([]);
  const [perp, setPerp] = useState<MarketTicker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const load = useCallback(async () => {
    const failures: string[] = [];
    const spotAdapter = getAdapter("spot");
    const perpAdapter = getAdapter("futures");

    const [spotResult, perpResult] = await Promise.allSettled([
      spotAdapter.listTickers(),
      perpAdapter.listTickers(),
    ]);

    if (spotResult.status === "fulfilled") setSpot(spotResult.value);
    else failures.push(spotResult.reason instanceof Error ? spotResult.reason.message : "spot");

    if (perpResult.status === "fulfilled") {
      let tickers = perpResult.value;
      if (perpAdapter.listExtras) {
        try {
          const extras = await perpAdapter.listExtras();
          tickers = tickers.map((ticker) => {
            const extra = extras.get(ticker.symbol);
            return extra ? { ...ticker, ...extra } : ticker;
          });
        } catch {
          /* funding stays unavailable */
        }
      }
      setPerp(tickers);
    } else {
      failures.push(perpResult.reason instanceof Error ? perpResult.reason.message : "futures");
    }

    setError(failures.length > 0 ? failures.join(" · ") : null);
    setLastUpdated(Date.now());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), intervalMs);
    return () => clearInterval(timer);
  }, [load, intervalMs]);

  const rows = useMemo<BasisRow[]>(() => {
    const spotByBase = new Map<string, MarketTicker>();
    for (const ticker of spot) {
      if (ticker.quote !== "USDT") continue;
      if (!ticker.base) continue;
      const existing = spotByBase.get(ticker.base);
      if (!existing || (ticker.quoteVolume24h ?? 0) > (existing.quoteVolume24h ?? 0)) {
        spotByBase.set(ticker.base, ticker);
      }
    }

    const result: BasisRow[] = [];
    for (const contract of perp) {
      if (contract.quote !== "USDT") continue;
      const spotTicker = spotByBase.get(contract.base);
      if (!spotTicker || spotTicker.price <= 0) continue;
      const basisPercent = ((contract.price - spotTicker.price) / spotTicker.price) * 100;
      if (!Number.isFinite(basisPercent) || Math.abs(basisPercent) > 30) continue;
      result.push({
        base: contract.base || contract.symbol,
        spotSymbol: spotTicker.symbol,
        perpSymbol: contract.symbol,
        spotPrice: spotTicker.price,
        perpPrice: contract.price,
        basisPercent,
        fundingRate: contract.fundingRate,
        fundingAnnualPercent: annualise(contract.fundingRate),
        nextFundingTime: contract.nextFundingTime,
        quoteVolume: spotTicker.quoteVolume24h ?? 0,
        perpQuoteVolume: contract.quoteVolume24h ?? 0,
        openInterest: contract.openInterest,
        currency: "quote",
      });
    }

    return result.sort((a, b) => Math.abs(b.basisPercent) - Math.abs(a.basisPercent));
  }, [spot, perp]);

  return { rows, loading, error, lastUpdated, refresh: () => void load() };
}
