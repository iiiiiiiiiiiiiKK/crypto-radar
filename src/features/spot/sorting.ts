import type { MarketTicker } from "@/types/market";
import type { SortKey, SortState } from "@/types/ui";

export type { SortKey };

function valueOf(ticker: MarketTicker, key: SortKey): number | string {
  switch (key) {
    case "symbol":
      return ticker.symbol;
    case "price":
      return ticker.price;
    case "changePercent":
      return ticker.priceChangePercent;
    case "high24h":
      return ticker.high24h ?? -Infinity;
    case "low24h":
      return ticker.low24h ?? -Infinity;
    case "volume24h":
      return ticker.volume24h ?? -Infinity;
    case "quoteVolume24h":
      return ticker.quoteVolume24h ?? -Infinity;
    case "bidPrice":
      return ticker.bidPrice ?? -Infinity;
    case "markPrice":
      return ticker.markPrice ?? -Infinity;
    case "fundingRate":
      return ticker.fundingRate ?? -Infinity;
    case "openInterest":
      return ticker.openInterest ?? -Infinity;
    case "updatedAt":
      return ticker.updatedAt;
    default:
      return 0;
  }
}

export function sortTickers(tickers: MarketTicker[], sort: SortState): MarketTicker[] {
  const key = sort.key as SortKey;
  const direction = sort.desc ? -1 : 1;
  return [...tickers].sort((a, b) => {
    const av = valueOf(a, key);
    const bv = valueOf(b, key);
    if (typeof av === "string" || typeof bv === "string") {
      return String(av).localeCompare(String(bv)) * direction;
    }
    if (av === bv) return a.symbol.localeCompare(b.symbol);
    return (av - bv) * direction;
  });
}

export function filterTickers(tickers: MarketTicker[], query: string): MarketTicker[] {
  const q = query.trim().toUpperCase();
  if (!q) return tickers;
  return tickers.filter((ticker) => {
    if (ticker.symbol.toUpperCase().includes(q)) return true;
    if (ticker.base.toUpperCase().includes(q)) return true;
    if (ticker.quote.toUpperCase().includes(q)) return true;
    if (ticker.name?.toUpperCase().includes(q)) return true;
    return false;
  });
}

export function topLosers(tickers: MarketTicker[], limit = 10): MarketTicker[] {
  return topMovers(tickers, "losers", limit);
}

export type QuoteFilter = "all" | "usdt" | "usd";

/**
 * Filters by the quote asset. The quote is derived from the real pair name
 * (`BTCUSDT` -> USDT, `BTCUSDC` -> USDC) so no extra metadata is needed.
 */
export function filterByQuote(tickers: MarketTicker[], filter: QuoteFilter): MarketTicker[] {
  if (filter === "all") return tickers;
  const wanted =
    filter === "usdt"
      ? ["USDT"]
      : ["USD", "USDT", "FDUSD", "USDC", "BUSD", "TUSD", "USDP", "DAI", "AEUR"];
  return tickers.filter((ticker) => wanted.includes(ticker.quote.toUpperCase()));
}

export function topMovers(
  tickers: MarketTicker[],
  kind: "gainers" | "losers",
  limit = 10,
): MarketTicker[] {
  const sorted = [...tickers].sort((a, b) =>
    kind === "gainers"
      ? b.priceChangePercent - a.priceChangePercent
      : a.priceChangePercent - b.priceChangePercent,
  );
  return sorted.slice(0, limit);
}

export function topVolume(tickers: MarketTicker[], limit = 10): MarketTicker[] {
  return [...tickers]
    .sort((a, b) => (b.quoteVolume24h ?? 0) - (a.quoteVolume24h ?? 0))
    .slice(0, limit);
}
