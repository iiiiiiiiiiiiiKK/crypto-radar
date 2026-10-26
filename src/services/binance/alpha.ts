import { z } from "zod";
import { fetchJson } from "./http";
import type { Candle, MarketAdapter, MarketTicker, SymbolMeta } from "@/types/market";

/**
 * Binance Alpha exposes its token universe through the public web endpoint
 * `/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha/all/token/list`.
 * The payload already contains price, 24h change, volume, market cap, liquidity
 * and chain metadata — no trading API key is required.
 *
 * The endpoint returns `null` for the fields a token does not provide, so the
 * schema accepts nulls and the adapter maps them to "unavailable".
 */
const alphaListSchema = z.object({
  code: z.string().optional(),
  data: z.array(
    z.object({
      tokenId: z.string(),
      chainId: z.string().nullable().optional(),
      chainName: z.string().nullable().optional(),
      contractAddress: z.string().nullable().optional(),
      name: z.string().nullable().optional(),
      symbol: z.string().nullable().optional(),
      iconUrl: z.string().nullable().optional(),
      price: z.string().nullable().optional(),
      percentChange24h: z.string().nullable().optional(),
      volume24h: z.string().nullable().optional(),
      marketCap: z.string().nullable().optional(),
      liquidity: z.string().nullable().optional(),
      priceHigh24h: z.string().nullable().optional(),
      priceLow24h: z.string().nullable().optional(),
      count24h: z.string().nullable().optional(),
      holders: z.string().nullable().optional(),
      decimals: z.number().nullable().optional(),
      tradeDecimal: z.number().nullable().optional(),
      listingTime: z.number().nullable().optional(),
      alphaId: z.string().nullable().optional(),
      fullyDelisted: z.boolean().nullable().optional(),
      offline: z.boolean().nullable().optional(),
    }),
  ),
});

function num(value: string | number | undefined | null): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export class AlphaMarketAdapter implements MarketAdapter {
  readonly id = "alpha" as const;

  private cache: { at: number; tickers: MarketTicker[]; symbols: SymbolMeta[] } | null = null;

  async fetchUniverse(): Promise<{ tickers: MarketTicker[]; symbols: SymbolMeta[] }> {
    if (this.cache && Date.now() - this.cache.at < 10_000) return this.cache;
    const raw = await fetchJson({
      market: "alpha",
      path: "/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha/all/token/list",
    });
    const parsed = alphaListSchema.safeParse(raw);
    if (!parsed.success) throw new Error("Unexpected Alpha token list payload");

    const tickers: MarketTicker[] = [];
    const symbols: SymbolMeta[] = [];
    const now = Date.now();

    for (const token of parsed.data.data) {
      if (token.fullyDelisted || token.offline) continue;
      const symbol = (token.symbol ?? "").toUpperCase();
      if (!symbol) continue;
      const decimals = token.tradeDecimal ?? token.decimals ?? 8;
      const id = token.alphaId ?? token.tokenId;

      symbols.push({
        market: "alpha",
        id,
        symbol: `${symbol}/USDT`,
        base: symbol,
        quote: "USDT",
        decimals,
        tickSize: null,
        listingTime: token.listingTime ?? null,
        chainName: token.chainName ?? undefined,
        contractAddress: token.contractAddress ?? undefined,
        iconUrl: token.iconUrl ?? undefined,
        alphaId: token.alphaId ?? undefined,
        name: token.name ?? undefined,
      });

      tickers.push({
        market: "alpha",
        symbol: `${symbol}/USDT`,
        id,
        base: symbol,
        quote: "USDT",
        price: num(token.price) ?? 0,
        priceChangePercent: num(token.percentChange24h) ?? 0,
        openPrice: null,
        high24h: num(token.priceHigh24h),
        low24h: num(token.priceLow24h),
        volume24h: null,
        quoteVolume24h: num(token.volume24h),
        trades24h: num(token.count24h),
        bidPrice: null,
        askPrice: null,
        markPrice: null,
        indexPrice: null,
        fundingRate: null,
        nextFundingTime: null,
        openInterest: null,
        decimals,
        updatedAt: now,
        listingTime: token.listingTime ?? null,
        chainName: token.chainName ?? undefined,
        iconUrl: token.iconUrl ?? undefined,
        name: token.name ?? undefined,
        alphaId: token.alphaId ?? undefined,
      });
    }

    this.cache = { at: Date.now(), tickers, symbols };
    return this.cache;
  }

  async listSymbols(): Promise<SymbolMeta[]> {
    return (await this.fetchUniverse()).symbols;
  }

  async listTickers(): Promise<MarketTicker[]> {
    return (await this.fetchUniverse()).tickers;
  }

  /**
   * Binance does not publish a public kline endpoint for Alpha tokens, so
   * historical candles are genuinely unavailable. The adapter reports this
   * instead of fabricating data.
   */
  async listKlines(): Promise<Candle[]> {
    throw new Error("ALPHA_KLINES_UNAVAILABLE");
  }
}
