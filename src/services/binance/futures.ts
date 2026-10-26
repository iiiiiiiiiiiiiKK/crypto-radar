import { z } from "zod";
import { fetchJson } from "./http";
import { decimalsFromTickSize } from "@/lib/format";
import { guessDecimals, splitSymbol } from "./spot";
import type { Candle, Interval, MarketAdapter, MarketTicker, SymbolMeta } from "@/types/market";

const exchangeInfoSchema = z.object({
  symbols: z.array(
    z.object({
      symbol: z.string(),
      pair: z.string().optional(),
      contractType: z.string().optional(),
      status: z.string().optional(),
      baseAsset: z.string(),
      quoteAsset: z.string(),
      pricePrecision: z.number().optional(),
      quantityPrecision: z.number().optional(),
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

const premiumIndexSchema = z.object({
  symbol: z.string(),
  markPrice: z.string(),
  indexPrice: z.string().optional(),
  lastFundingRate: z.string().optional(),
  nextFundingTime: z.number().optional(),
  time: z.number().optional(),
});

const openInterestSchema = z.object({
  symbol: z.string(),
  openInterest: z.string(),
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

function num(value: string | number | undefined | null): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export class FuturesMarketAdapter implements MarketAdapter {
  readonly id = "futures" as const;

  private metaCache: { at: number; symbols: SymbolMeta[] } | null = null;

  async listSymbols(): Promise<SymbolMeta[]> {
    if (this.metaCache && Date.now() - this.metaCache.at < 5 * 60_000) {
      return this.metaCache.symbols;
    }
    const raw = await fetchJson(
      { market: "futures", path: "/fapi/v1/exchangeInfo" },
      { timeoutMs: 45_000 },
    );
    const parsed = exchangeInfoSchema.safeParse(raw);
    if (!parsed.success) throw new Error("Unexpected futures exchangeInfo payload");

    const symbols = parsed.data.symbols
      .filter((s) => s.status === "TRADING" && (s.contractType ?? "PERPETUAL") === "PERPETUAL")
      .map<SymbolMeta>((s) => {
        const tickFilter = s.filters?.find((f) => f.filterType === "PRICE_FILTER");
        const tickSize = num(tickFilter?.tickSize) ?? 0.01;
        return {
          market: "futures",
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
    return symbols;
  }

  async listTickers(): Promise<MarketTicker[]> {
    const raw = await fetchJson(
      { market: "futures", path: "/fapi/v1/ticker/24hr" },
      { timeoutMs: 30_000 },
    );
    const parsed = ticker24hSchema.safeParse(raw);
    if (!parsed.success) throw new Error("Unexpected futures ticker/24hr payload");

    return parsed.data.map((row) => {
      const price = num(row.lastPrice) ?? 0;
      return {
        market: "futures",
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
      };
    });
  }

  async listKlines(id: string, interval: Interval, limit = 500): Promise<Candle[]> {
    const raw = await fetchJson({
      market: "futures",
      path: "/fapi/v1/klines",
      params: { symbol: id, interval, limit: Math.min(1500, Math.max(1, limit)) },
    });
    const parsed = klineSchema.safeParse(raw);
    if (!parsed.success) throw new Error("Unexpected futures klines payload");
    return parsed.data.map((k) => ({
      time: k[0],
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
      volume: Number(k[5]),
    }));
  }

  /** Funding rate + mark price + open interest live on dedicated endpoints. */
  async fetchExtras(id: string): Promise<Partial<MarketTicker>> {
    const result: Partial<MarketTicker> = {};
    try {
      const premium = await fetchJson({
        market: "futures",
        path: "/fapi/v1/premiumIndex",
        params: { symbol: id },
      });
      const parsed = premiumIndexSchema.safeParse(
        Array.isArray(premium) ? premium[0] : premium,
      );
      if (parsed.success) {
        result.markPrice = num(parsed.data.markPrice);
        result.indexPrice = num(parsed.data.indexPrice);
        result.fundingRate = num(parsed.data.lastFundingRate);
        result.nextFundingTime = parsed.data.nextFundingTime ?? null;
      }
    } catch {
      // Funding data is optional — the ticker keeps working without it.
    }
    try {
      const oi = await fetchJson({
        market: "futures",
        path: "/fapi/v1/openInterest",
        params: { symbol: id },
      });
      const parsed = openInterestSchema.safeParse(oi);
      if (parsed.success) result.openInterest = num(parsed.data.openInterest);
    } catch {
      // Open interest is optional.
    }
    return result;
  }
}

