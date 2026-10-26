import { z } from "zod";
import { fetchJson } from "./http";
import { readMetaCache, writeMetaCache } from "./metaCache";
import { decimalsFromTickSize } from "@/lib/format";
import type { Candle, Interval, MarketAdapter, MarketTicker, SymbolMeta } from "@/types/market";

const exchangeInfoSchema = z.object({
  serverTime: z.number().optional(),
  symbols: z.array(
    z.object({
      symbol: z.string(),
      status: z.string().optional(),
      baseAsset: z.string(),
      quoteAsset: z.string(),
      baseAssetPrecision: z.number().optional(),
      quotePrecision: z.number().optional(),
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
    openPrice: z.string(),
    highPrice: z.string(),
    lowPrice: z.string(),
    volume: z.string(),
    quoteVolume: z.string(),
    priceChangePercent: z.string(),
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

const META_CACHE_KEY = "crypto-radar:meta:spot:v1";

function num(value: string | number | undefined | null): number | null {
  if (value === undefined || value === null || value === "") return null;
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
  "IDRT",
  "BVND",
  "AEUR",
  "BKRW",
  "IDR",
  "DAI",
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
  "VAI",
  "BTC",
  "ETH",
  "BNB",
];

/**
 * Split a raw pair such as `BTCUSDT` into its base and quote asset.
 * The longest matching quote wins so that `USDTIDR` is read as
 * `USDT / IDR` and not as `USDTID / R`.
 */
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

/**
 * A rough precision guess used until the authoritative exchange metadata
 * arrives. It is replaced by the real tick size as soon as it is available.
 */
export function guessDecimals(price: number): number {
  const abs = Math.abs(price);
  if (!Number.isFinite(abs) || abs === 0) return 2;
  if (abs >= 1000) return 2;
  if (abs >= 1) return 4;
  if (abs >= 0.01) return 5;
  if (abs >= 0.0001) return 6;
  if (abs >= 0.00001) return 7;
  return 8;
}

export class SpotMarketAdapter implements MarketAdapter {
  readonly id = "spot" as const;

  private metaCache: { at: number; symbols: SymbolMeta[] } | null = null;

  async listSymbols(): Promise<SymbolMeta[]> {
    if (this.metaCache && Date.now() - this.metaCache.at < 6 * 60 * 60_000) {
      return this.metaCache.symbols;
    }
    const cached = readMetaCache<SymbolMeta[]>(META_CACHE_KEY);
    if (cached && cached.length > 0) {
      this.metaCache = { at: Date.now(), symbols: cached };
      return cached;
    }

    const raw = await fetchJson(
      { market: "spot", path: "/api/v3/exchangeInfo", params: { permissions: "SPOT" } },
      { timeoutMs: 45_000 },
    );
    const parsed = exchangeInfoSchema.safeParse(raw);
    if (!parsed.success) throw new Error("Unexpected exchangeInfo payload");
    const symbols = parsed.data.symbols
      .filter((s) => s.status === "TRADING" && s.isSpotTradingAllowed !== false)
      .map<SymbolMeta>((s) => {
        const tickFilter = s.filters?.find((f) => f.filterType === "PRICE_FILTER");
        const tickSize = num(tickFilter?.tickSize) ?? 0.01;
        return {
          market: "spot",
          id: s.symbol,
          symbol: s.symbol,
          base: s.baseAsset,
          quote: s.quoteAsset,
          decimals: decimalsFromTickSize(tickSize),
          tickSize,
          status: s.status,
          listingTime: null,
        };
      });
    this.metaCache = { at: Date.now(), symbols };
    writeMetaCache(META_CACHE_KEY, symbols);
    return symbols;
  }

  /**
   * Only the 24h ticker endpoint is awaited here, so the table paints within
   * a second. The authoritative per-pair precision is merged in afterwards
   * by `applyMetadata`.
   */
  async listTickers(): Promise<MarketTicker[]> {
    const raw = await fetchJson(
      { market: "spot", path: "/api/v3/ticker/24hr" },
      { timeoutMs: 30_000 },
    );
    const parsed = ticker24hSchema.safeParse(raw);
    if (!parsed.success) throw new Error("Unexpected ticker/24hr payload");

    return parsed.data.map((row) => {
      const price = num(row.lastPrice) ?? 0;
      return {
        market: "spot",
        symbol: row.symbol,
        id: row.symbol,
        base: splitSymbol(row.symbol).base,
        quote: splitSymbol(row.symbol).quote,
        price,
        priceChangePercent: num(row.priceChangePercent) ?? 0,
        openPrice: num(row.openPrice),
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
        decimals: guessDecimals(price),
        // The 24h `closeTime` is up to a day old — the snapshot itself is current.
        updatedAt: Date.now(),
        listingTime: null,
      } satisfies MarketTicker;
    });
  }

  /** Merge the real tick size, base asset and quote asset into the list. */
  async applyMetadata(tickers: MarketTicker[]): Promise<MarketTicker[]> {
    const meta = await this.listSymbols();
    const metaMap = new Map(meta.map((m) => [m.id, m]));
    return tickers.map((ticker) => {
      const m = metaMap.get(ticker.symbol);
      if (!m) return ticker;
      return {
        ...ticker,
        base: m.base,
        quote: m.quote,
        decimals: m.decimals,
        tickSize: m.tickSize,
        listingTime: m.listingTime,
      };
    });
  }

  async listKlines(id: string, interval: Interval, limit = 500): Promise<Candle[]> {
    const raw = await fetchJson({
      market: "spot",
      path: "/api/v3/klines",
      params: { symbol: id, interval, limit: Math.min(1500, Math.max(1, limit)) },
    });
    const parsed = klineSchema.safeParse(raw);
    if (!parsed.success) throw new Error("Unexpected klines payload");
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
