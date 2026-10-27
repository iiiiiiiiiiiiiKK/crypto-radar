import { z } from "zod";
import { fetchJson } from "./http";
import type { Candle, Interval, SymbolMeta } from "@/types/market";
import { num } from "./spot";
import type { MarketAdapter, SnapshotRow } from "./types";

/**
 * Binance Alpha exposes its token universe through the public web endpoint
 * `/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha/all/token/list`.
 * It is **not** part of the documented spot/futures API surface: it is the same
 * public endpoint the Alpha page on binance.com uses. It returns price, 24h
 * change, volume, market cap and chain metadata without any API key.
 *
 * Because it is undocumented, everything is optional in the schema and any
 * field that is missing stays `null` — the UI shows "不可用" instead of a
 * made-up number. There is no public Alpha kline or websocket endpoint, so
 * Alpha candles are genuinely unavailable (see `supportsKlines`).
 */
const alphaListSchema = z.object({
  code: z.string().optional(),
  data: z.array(
    z.object({
      tokenId: z.string().optional(),
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
      listings: z.number().nullable().optional(),
      decimals: z.number().nullable().optional(),
      tradeDecimal: z.number().nullable().optional(),
      listingTime: z.number().nullable().optional(),
      alphaId: z.string().nullable().optional(),
      fullyDelisted: z.boolean().nullable().optional(),
      offline: z.boolean().nullable().optional(),
    }),
  ),
});

export class AlphaAdapter implements MarketAdapter {
  readonly market = "alpha" as const;
  /** No public kline endpoint exists for Alpha tokens. */
  readonly supportsKlines = false;

  private cache: {
    at: number;
    rows: SnapshotRow[];
    meta: SymbolMeta[];
  } | null = null;

  private async fetchUniverse(): Promise<{ rows: SnapshotRow[]; meta: SymbolMeta[] }> {
    if (this.cache && Date.now() - this.cache.at < 8_000) {
      return { rows: this.cache.rows, meta: this.cache.meta };
    }
    const raw = await fetchJson<unknown>({
      market: "alpha",
      path: "/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha/all/token/list",
    });
    const parsed = alphaListSchema.safeParse(raw);
    if (!parsed.success) throw new Error("Alpha 代币列表返回了无法识别的数据结构");

    const rows: SnapshotRow[] = [];
    const meta: SymbolMeta[] = [];
    const now = Date.now();

    for (const token of parsed.data.data) {
      if (token.fullyDelisted || token.offline) continue;
      const base = (token.symbol ?? "").trim().toUpperCase();
      if (!base) continue;
      const decimals = token.tradeDecimal ?? token.decimals ?? 8;
      const id = token.alphaId ?? token.tokenId ?? base;

      meta.push({
        market: "alpha",
        id,
        symbol: `${base}/USDT`,
        base,
        quote: "USDT",
        decimals,
        tickSize: null,
        listingTime: token.listingTime ?? null,
        name: token.name ?? undefined,
        chainName: token.chainName ?? undefined,
        iconUrl: token.iconUrl ?? undefined,
      });

      rows.push({
        market: "alpha",
        symbol: `${base}/USDT`,
        id,
        base,
        quote: "USDT",
        price: num(token.price),
        open24h: null,
        changePercent: num(token.percentChange24h),
        high24h: num(token.priceHigh24h),
        low24h: num(token.priceLow24h),
        // Alpha only publishes quote-denominated turnover, not base volume.
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
        receivedAt: now,
        source: "poll",
        meta: {
          name: token.name ?? undefined,
          chainName: token.chainName ?? undefined,
          iconUrl: token.iconUrl ?? undefined,
          listingTime: token.listingTime ?? undefined,
        },
      });
    }

    this.cache = { at: Date.now(), rows, meta };
    return { rows, meta };
  }

  async loadTickers(): Promise<SnapshotRow[]> {
    return (await this.fetchUniverse()).rows;
  }

  async loadMeta(): Promise<SymbolMeta[]> {
    return (await this.fetchUniverse()).meta;
  }

  async fetchKlines(_symbol: string, _interval: Interval): Promise<Candle[]> {
    throw new Error("ALPHA_KLINES_UNAVAILABLE");
  }
}
