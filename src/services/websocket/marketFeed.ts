import { getAdapter } from "@/services/binance";
import { UPSTREAM } from "@/lib/constants/endpoints";
import { FLUSH_INTERVAL_MS, STALE_AFTER_MS } from "@/lib/constants/markets";
import type { ConnectionState, MarketId, MarketTicker } from "@/types/market";
import { WsManager } from "./WsManager";

export interface FeedEvents {
  onTickers: (tickers: MarketTicker[]) => void;
  onState: (state: ConnectionState) => void;
  onError: (error: Error) => void;
}

/**
 * Combines a REST snapshot with a live WebSocket delta stream.
 *
 * Binance publishes a `!miniTicker@arr` stream that pushes every symbol of a
 * market inside a single frame. One shared socket and one stream therefore
 * keep the connection count and the message rate far below the exchange
 * limits, while the REST snapshot fills in the 24h statistics.
 */
export class MarketFeed {
  private manager: WsManager | null = null;
  private unsubscribe: (() => void) | null = null;
  private pending = new Map<string, MarketTicker>();
  private snapshot: MarketTicker[] = [];
  private snapshotMap = new Map<string, MarketTicker>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private alphaTimer: ReturnType<typeof setInterval> | null = null;
  private disposed = false;

  constructor(
    readonly market: MarketId,
    private readonly events: FeedEvents,
  ) {}

  get snapshotTickers(): MarketTicker[] {
    return this.snapshot;
  }

  async start(): Promise<void> {
    if (this.disposed) return;
    const adapter = getAdapter(this.market);
    try {
      this.applySnapshot(await adapter.listTickers());
    } catch (error) {
      this.events.onError(toError(error));
    }

    if (this.disposed) return;

    if (this.market === "alpha") {
      // Alpha publishes no public websocket — the token list is polled.
      this.startAlphaPolling();
      return;
    }
    this.startSocket();

    // The heavy exchange metadata is merged in afterwards so the first paint
    // is not blocked by a multi-megabyte payload.
    if (adapter.applyMetadata) {
      void adapter
        .applyMetadata(this.snapshot)
        .then((enriched) => {
          if (this.disposed || enriched.length === 0) return;
          this.applySnapshot(enriched);
        })
        .catch(() => {
          /* the table keeps the estimated precision */
        });
    }
  }

  private applySnapshot(tickers: MarketTicker[]): void {
    this.snapshot = tickers;
    this.snapshotMap = new Map(tickers.map((ticker) => [ticker.symbol, ticker]));
    if (!this.disposed) this.events.onTickers(tickers);
  }

  private startSocket(): void {
    const base = this.market === "futures" ? UPSTREAM.futures.ws : UPSTREAM.spot.ws;
    this.manager = new WsManager({
      url: `${base}/ws`,
      staleAfterMs: STALE_AFTER_MS,
      onStateChange: (state) => this.events.onState(state),
    });

    this.unsubscribe = this.manager.subscribe(["!miniTicker@arr"], (payload) => {
      this.handleMiniTicker(payload);
    });
    this.manager.connect();
  }

  private handleMiniTicker(payload: unknown): void {
    if (!Array.isArray(payload)) return;
    const now = Date.now();
    for (const entry of payload) {
      if (!entry || typeof entry !== "object") continue;
      const row = entry as Record<string, unknown>;
      const symbol = typeof row.s === "string" ? row.s : null;
      if (!symbol) continue;
      const price = toNumber(row.c);
      if (price === null) continue;

      const current = this.pending.get(symbol) ?? this.snapshotMap.get(symbol);
      if (!current) continue;

      const openPrice = toNumber(row.o);
      const changePercent =
        openPrice !== null && openPrice !== 0
          ? ((price - openPrice) / openPrice) * 100
          : current.priceChangePercent;

      this.pending.set(symbol, {
        ...current,
        price,
        openPrice,
        high24h: toNumber(row.h) ?? current.high24h,
        low24h: toNumber(row.l) ?? current.low24h,
        volume24h: toNumber(row.v) ?? current.volume24h,
        quoteVolume24h: toNumber(row.q) ?? current.quoteVolume24h,
        priceChangePercent: changePercent,
        updatedAt: toNumber(row.E) ?? now,
      });
    }
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.flushTimer || this.pending.size === 0) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      if (this.pending.size === 0) return;
      const updates = [...this.pending.values()];
      this.pending.clear();
      this.events.onTickers(updates);
    }, FLUSH_INTERVAL_MS);
  }

  private startAlphaPolling(): void {
    const poll = async () => {
      if (this.disposed) return;
      try {
        const adapter = getAdapter("alpha");
        this.applySnapshot(await adapter.listTickers());
      } catch (error) {
        this.events.onError(toError(error));
      }
    };
    const interval = Number(import.meta.env.VITE_ALPHA_POLL_MS ?? 20_000);
    this.alphaTimer = setInterval(() => void poll(), interval);
  }

  /** Force a fresh REST snapshot (manual refresh button). */
  async refresh(): Promise<void> {
    try {
      const adapter = getAdapter(this.market);
      this.applySnapshot(await adapter.listTickers());
    } catch (error) {
      this.events.onError(toError(error));
    }
  }

  stop(): void {
    this.disposed = true;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.manager?.dispose();
    this.manager = null;
    this.pending.clear();
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.alphaTimer) {
      clearInterval(this.alphaTimer);
      this.alphaTimer = null;
    }
  }
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
