import { readJson, writeJson } from "@/lib/storage";
import type { TickerRow } from "@/types/market";

export interface SearchHit {
  key: string;
  market: TickerRow["market"];
  symbol: string;
  base: string;
  quote: string;
  price: number | null;
  changePercent: number | null;
  decimals: number;
  quoteVolume24h: number | null;
}

/** Preferred quote currencies get a small ranking bonus. */
export function quoteBonus(quote: string): number {
  switch (quote) {
    case "USDT":
      return 6;
    case "USDC":
      return 5;
    case "FDUSD":
      return 4;
    case "BTC":
    case "ETH":
      return 3;
    default:
      return 0;
  }
}

/** Spot is the default mental model, so it wins ties against the same pair on perpetuals. */
export function marketBonus(market: TickerRow["market"]): number {
  if (market === "spot") return 1.5;
  if (market === "futures") return 1;
  return 0;
}

/** Cheap fuzzy matcher: exact > prefix > substring > subsequence. */
export function scoreSymbol(query: string, row: TickerRow): number | null {
  const q = query.trim().toUpperCase();
  if (!q) return null;
  const symbol = row.symbol.toUpperCase();
  const base = row.base.toUpperCase();

  if (symbol === q || base === q) return 100;
  if (symbol.startsWith(q)) return 90 - symbol.length * 0.1;
  if (base.startsWith(q)) return 80 - base.length * 0.1;
  if (symbol.includes(q)) return 60 - symbol.length * 0.05;
  if (base.includes(q)) return 50;

  // Subsequence match (e.g. "ethu" -> ETHUSDT).
  let index = 0;
  for (const char of symbol) {
    if (char === q[index]) index += 1;
    if (index === q.length) return 30;
  }
  return null;
}

export function searchRows(rows: TickerRow[], query: string, limit = 12): SearchHit[] {
  const scored: Array<{ row: TickerRow; score: number }> = [];
  for (const row of rows) {
    const score = scoreSymbol(query, row);
    if (score === null) continue;
    // USDⓈ pairs are what people actually trade; a same-named IDR or BTC pair
    // wins on raw turnover only because of its quote currency.
    scored.push({ row, score: score + quoteBonus(row.quote) + marketBonus(row.market) });
  }
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.row.quoteVolume24h ?? 0) - (a.row.quoteVolume24h ?? 0);
  });

  return scored.slice(0, limit).map(({ row }) => ({
    key: row.key,
    market: row.market,
    symbol: row.symbol,
    base: row.base,
    quote: row.quote,
    price: row.price,
    changePercent: row.changePercent,
    decimals: row.decimals,
    quoteVolume24h: row.quoteVolume24h,
  }));
}

const RECENT_KEY = "recent";

export function readRecent(): string[] {
  const raw = readJson<string[]>(RECENT_KEY, []);
  return Array.isArray(raw) ? raw.filter((item) => typeof item === "string").slice(0, 8) : [];
}

export function pushRecent(key: string): void {
  const current = readRecent().filter((item) => item !== key);
  writeJson(RECENT_KEY, [key, ...current].slice(0, 8));
}
