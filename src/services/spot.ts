import { z } from "zod";
import { fetchJson } from "./http";
import { decimalsFromTickSize, guessDecimals } from "@/lib/format";
import { readJson, writeJson } from "@/lib/storage";
import type { Candle, Interval, SymbolMeta } from "@/types/market";
import type { MarketAdapter, SnapshotRow } from "./types";

const exchangeInfoSchema = z.object({
  serverTime: z.number().optional(),
  symbols: z.array(
    z.object({
      symbol: z.string(),
      status: z.string().optional(),
      baseAsset: z.string(),
      quoteAsset: z.string(),
      isSpotTradingAllowed: z.boolean().optional(),
      filters: z
        .array(z.object({ filterType: z.string(), tickSize: z.string().optional() }))
        .optional(),
    }),
  ),
});

const ticker24hSchema = z.array(
  z.object({
    symbol: z.string(),
    lastPrice: z.string(),
    openPrice: z.string().optional(),
    highPrice: z.string().optional(),
    lowPrice: z.string().optional(),
    volume: z.string().optional(),
    quoteVolume: z.string().optional(),
    priceChangePercent: z.string().optional(),
    count: z.number().optional(),
    bidPrice: z.string().optional(),
    askPrice: z.string().optional(),
    closeTime: z.number().optional(),
  }),
);

const klineSchema = z.array(
  z.tuple([
    z.number(),
    z.string(),
    z.string(),
    z.string(),
    z.string(),
    z.string(),
    z.number(),
    z.string(),
    z.number(),
    z.string(),
    z.string(),
    z.string(),
  ]),
);

export function num(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const KNOWN_QUOTES = [
  "FDUSD",
  "USDT",
  "TUSD",
  "USDC",
  "BUSD",
  "USDP",
  "BIDR",
  "AEUR",
  "DAI",
  "IDRT",
  "BVND",
  "EUR",
  "TRY",
  "BRL",
  "ARS",
  "JPY",
  "MXN",
  "RUB",
  "ZAR",
  "NGN",
  "UAH",
  "PLN",
  "RON",
  "CZK",
  "BTC",
  "ETH",
  "BNB",
];

/** Longest known quote suffix wins, so `USDTIDR` reads as USDT/IDR. */
export function splitSymbol(symbol: string): { base: string; quote: string } {
  let best = "";
  for (const quote of KNOWN_QUOTES) {
    if (symbol.length > quote.length && symbol.endsWith(quote) && quote.length > best.length) {
      best = quote;
    }
  }
  if (!best) return { base: symbol, quote: "" };
  return { base: symbol.slice(0, -best.length), quote: best };
}

const META_CACHE_KEY = "meta:spot";
const META_TTL = 6 * 60 * 60_000;

export class SpotAdapter implements MarketAdapter {
  readonly market = "spot" as const;
  readonly supportsKlines = true;

  private metaCache: { at: number; meta: SymbolMeta[] } | null = null;
  private metaPromise: Promise<SymbolMeta[]> | null = null;

  async loadTickers(signal?: AbortSignal): Promise<SnapshotRow[]> {
    const raw = await fetchJson<unknown>(
      { market: "spot", path: "/api/v3/ticker/24hr" },
      { timeoutMs: 30_000, signal },
    );
    const parsed = ticker24hSchema.safeParse(raw);
    if (!parsed.success) throw new Error("现货行情返回了无法识别的数据结构");
    const now = Date.now();

    return parsed.data
      .filter((row) => num(row.lastPrice) !== null)
      .map((row) => {
        const price = num(row.lastPrice);
        const { base, quote } = splitSymbol(row.symbol);
        return {
          market: "spot" as const,
          symbol: row.symbol,
          id: row.symbol,
          base,
          quote,
          price,
          open24h: num(row.openPrice),
          changePercent: num(row.priceChangePercent),
          high24h: num(row.highPrice),
          low24h: num(row.lowPrice),
          volume24h: num(row.volume),
          quoteVolume24h: num(row.quoteVolume),
          trades24h: row.count ?? null,
          bidPrice: num(row.bidPrice),
          askPrice: num(row.askPrice),
          markPrice: null,
          indexPrice: null,
          fundingRate: null,
          nextFundingTime: null,
          openInterest: null,
          decimals: price === null ? 2 : guessDecimals(price),
          // The 24h window's `closeTime` is up to a day old; the snapshot is current.
          updatedAt: now,
          receivedAt: now,
          source: "rest" as const,
        } satisfies SnapshotRow;
      });
  }

  async loadMeta(signal?: AbortSignal): Promise<SymbolMeta[]> {
    if (this.metaCache && Date.now() - this.metaCache.at < META_TTL) return this.metaCache.meta;
    if (this.metaPromise) return this.metaPromise;

    this.metaPromise = (async () => {
      const cached = readJson<{ at: number; meta: SymbolMeta[] } | null>(META_CACHE_KEY, null);
      if (cached && Date.now() - cached.at < META_TTL && cached.meta.length > 0) {
        this.metaCache = cached;
        return cached.meta;
      }
      const raw = await fetchJson<unknown>(
        { market: "spot", path: "/api/v3/exchangeInfo", params: { permissions: "SPOT" } },
        { timeoutMs: 40_000, signal },
      );
      const parsed = exchangeInfoSchema.safeParse(raw);
      if (!parsed.success) throw new Error("现货交易规则返回了无法识别的数据结构");

      const meta: SymbolMeta[] = parsed.data.symbols
        .filter((s) => s.status === "TRADING" && s.isSpotTradingAllowed !== false)
        .map((s) => {
          const tick = s.filters?.find((f) => f.filterType === "PRICE_FILTER")?.tickSize ?? "0.01";
          return {
            market: "spot" as const,
            id: s.symbol,
            symbol: s.symbol,
            base: s.baseAsset,
            quote: s.quoteAsset,
            decimals: decimalsFromTickSize(tick),
            tickSize: num(tick),
            listingTime: null,
          };
        });
      this.metaCache = { at: Date.now(), meta };
      writeJson(META_CACHE_KEY, this.metaCache);
      return meta;
    })();

    try {
      return await this.metaPromise;
    } finally {
      this.metaPromise = null;
    }
  }

  async fetchKlines(symbol: string, interval: Interval, limit = 500): Promise<Candle[]> {
    const raw = await fetchJson<unknown>({
      market: "spot",
      path: "/api/v3/klines",
      params: { symbol, interval, limit: Math.min(1000, Math.max(1, limit)) },
    });
    const parsed = klineSchema.safeParse(raw);
    if (!parsed.success) throw new Error("K 线数据格式无法识别");
    return parsed.data.map((k) => ({
      time: k[0],
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
      volume: Number(k[5]),
    }));
  }
}
