import { z } from "zod";
import { fetchJson } from "./http";
import { decimalsFromTickSize, guessDecimals } from "@/lib/format";
import { readJson, writeJson } from "@/lib/storage";
import type { Candle, Interval, SymbolMeta } from "@/types/market";
import { num, splitSymbol } from "./spot";
import type { MarketAdapter, SnapshotRow } from "./types";

const exchangeInfoSchema = z.object({
  symbols: z.array(
    z.object({
      symbol: z.string(),
      contractType: z.string().optional(),
      status: z.string().optional(),
      baseAsset: z.string(),
      quoteAsset: z.string(),
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

const premiumIndexSchema = z.object({
  symbol: z.string(),
  markPrice: z.string().optional(),
  indexPrice: z.string().optional(),
  lastFundingRate: z.string().optional(),
  nextFundingTime: z.number().optional(),
  time: z.number().optional(),
});

const openInterestSchema = z.object({
  symbol: z.string(),
  openInterest: z.string().optional(),
  time: z.number().optional(),
});

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

const META_CACHE_KEY = "meta:futures";
const META_TTL = 6 * 60 * 60_000;

export class FuturesAdapter implements MarketAdapter {
  readonly market = "futures" as const;
  readonly supportsKlines = true;

  private metaCache: { at: number; meta: SymbolMeta[] } | null = null;
  private metaPromise: Promise<SymbolMeta[]> | null = null;

  async loadTickers(signal?: AbortSignal): Promise<SnapshotRow[]> {
    const raw = await fetchJson<unknown>(
      { market: "futures", path: "/fapi/v1/ticker/24hr" },
      { timeoutMs: 30_000, signal },
    );
    const parsed = ticker24hSchema.safeParse(raw);
    if (!parsed.success) throw new Error("合约行情返回了无法识别的数据结构");
    const now = Date.now();

    return parsed.data
      .filter((row) => num(row.lastPrice) !== null)
      .map((row) => {
        const price = num(row.lastPrice);
        const { base, quote } = splitSymbol(row.symbol);
        return {
          market: "futures" as const,
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
        { market: "futures", path: "/fapi/v1/exchangeInfo" },
        { timeoutMs: 40_000, signal },
      );
      const parsed = exchangeInfoSchema.safeParse(raw);
      if (!parsed.success) throw new Error("合约交易规则返回了无法识别的数据结构");

      const meta: SymbolMeta[] = parsed.data.symbols
        .filter((s) => s.status === "TRADING" && (s.contractType ?? "PERPETUAL") === "PERPETUAL")
        .map((s) => {
          const tick = s.filters?.find((f) => f.filterType === "PRICE_FILTER")?.tickSize ?? "0.01";
          return {
            market: "futures" as const,
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

  /** Funding rate, mark price and index price for the whole market in one call. */
  async loadExtras(): Promise<Map<string, Partial<SnapshotRow>>> {
    const result = new Map<string, Partial<SnapshotRow>>();
    const raw = await fetchJson<unknown>({ market: "futures", path: "/fapi/v1/premiumIndex" });
    const rows = Array.isArray(raw) ? raw : [raw];
    for (const row of rows) {
      const parsed = premiumIndexSchema.safeParse(row);
      if (!parsed.success) continue;
      result.set(parsed.data.symbol, {
        markPrice: num(parsed.data.markPrice),
        indexPrice: num(parsed.data.indexPrice),
        fundingRate: num(parsed.data.lastFundingRate),
        nextFundingTime: parsed.data.nextFundingTime ?? null,
      });
    }
    return result;
  }

  /** Open interest for a single symbol (the only documented REST route). */
  async fetchOpenInterest(symbol: string): Promise<number | null> {
    const raw = await fetchJson<unknown>({
      market: "futures",
      path: "/fapi/v1/openInterest",
      params: { symbol },
    });
    const parsed = openInterestSchema.safeParse(raw);
    if (!parsed.success) return null;
    return num(parsed.data.openInterest);
  }

  async fetchKlines(symbol: string, interval: Interval, limit = 500): Promise<Candle[]> {
    const raw = await fetchJson<unknown>({
      market: "futures",
      path: "/fapi/v1/klines",
      params: { symbol, interval, limit: Math.min(1500, Math.max(1, limit)) },
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
