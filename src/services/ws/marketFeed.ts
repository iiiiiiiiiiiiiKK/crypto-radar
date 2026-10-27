import { getAdapter } from "@/services";
import { wsEndpoint } from "@/services/endpoints";
import { describeError } from "@/services/http";
import type { SnapshotRow } from "@/services/types";
import type { ConnectionState, MarketId, SymbolMeta } from "@/types/market";
import { WsManager } from "./WsManager";
import type { MarkDelta, TickerDelta } from "@/services/types";

export interface MarketFeedEvents {
  onSnapshot: (rows: SnapshotRow[]) => void;
  onMeta: (meta: SymbolMeta[]) => void;
  onTicker: (deltas: TickerDelta[]) => void;
  onMark: (deltas: MarkDelta[]) => void;
  onState: (state: ConnectionState) => void;
  onError: (message: string) => void;
}

const ALPHA_POLL_MS = 30_000;
const STALE_AFTER_MS = 35_000;

function toNum(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * REST snapshot + shared websocket deltas for exactly one market.
 *
 * Spot / futures use the exchange's own all-market streams so a single socket
 * carries the entire market. Alpha has no public websocket, so its universe is
 * polled and flagged as polled (`source: "poll"`).
 */
export class MarketFeed {
  private manager: WsManager | null = null;
  private unsubscribe: (() => void) | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private disposed = false;
  private state: ConnectionState = "idle";
  private lastSnapshotAt = 0;

  constructor(
    readonly market: MarketId,
    private readonly events: MarketFeedEvents,
  ) {}

  get currentState(): ConnectionState {
    return this.state;
  }

  async start(): Promise<void> {
    if (this.disposed) return;
    this.setState("connecting");

    const adapter = getAdapter(this.market);
    try {
      const rows = await adapter.loadTickers();
      if (this.disposed) return;
      this.lastSnapshotAt = Date.now();
      this.events.onSnapshot(rows);
      if (this.market !== "alpha") this.setState("connecting");
      else this.setState("live");
    } catch (error) {
      this.events.onError(describeError(error));
      this.setState("error");
    }

    if (this.disposed) return;

    // Metadata is fetched in the background so the first paint is not blocked.
    void adapter
      .loadMeta()
      .then((meta) => {
        if (!this.disposed) this.events.onMeta(meta);
      })
      .catch(() => {
        /* precision falls back to the value derived from the price */
      });

    if (this.market === "alpha") {
      this.startAlphaPolling();
      return;
    }

    if (adapter.loadExtras) {
      void adapter
        .loadExtras()
        .then((extras) => {
          if (this.disposed || extras.size === 0) return;
          const deltas: MarkDelta[] = [];
          for (const [symbol, extra] of extras) {
            deltas.push({
              symbol,
              markPrice: extra.markPrice ?? null,
              indexPrice: extra.indexPrice ?? null,
              fundingRate: extra.fundingRate ?? null,
              nextFundingTime: extra.nextFundingTime ?? null,
              eventTime: Date.now(),
            });
          }
          this.events.onMark(deltas);
        })
        .catch(() => {
          /* funding columns stay unavailable instead of showing zeros */
        });
    }

    this.startSocket();
  }

  private startSocket(): void {
    this.manager = new WsManager({
      url: wsEndpoint(this.market === "futures" ? "futures" : "spot"),
      label: this.market,
      staleAfterMs: STALE_AFTER_MS,
      onStateChange: (state) => {
        // A reconnected socket must re-sync 24h stats, which may have moved.
        if (state === "live" && Date.now() - this.lastSnapshotAt > 120_000) {
          void this.refresh();
        }
        this.setState(state);
      },
    });

    this.unsubscribe = this.manager.subscribe(["!miniTicker@arr"], (payload) => {
      const deltas = parseMiniTicker(payload);
      if (deltas.length > 0) this.events.onTicker(deltas);
    });

    if (this.market === "futures") {
      this.manager.subscribe(["!markPrice@arr@1s"], (payload) => {
        const deltas = parseMarkPrice(payload);
        if (deltas.length > 0) this.events.onMark(deltas);
      });
    }

    this.manager.connect();
  }

  private startAlphaPolling(): void {
    this.pollTimer = setInterval(() => {
      void (async () => {
        if (this.disposed) return;
        try {
          const rows = await getAdapter("alpha").loadTickers();
          if (this.disposed) return;
          this.lastSnapshotAt = Date.now();
          this.events.onSnapshot(rows);
          this.setState("live");
        } catch (error) {
          this.events.onError(describeError(error));
          this.setState(Date.now() - this.lastSnapshotAt > ALPHA_POLL_MS * 2 ? "stale" : "live");
        }
      })();
    }, ALPHA_POLL_MS);
  }

  /** Manual re-sync (used by the refresh button and after reconnects). */
  async refresh(): Promise<void> {
    try {
      const rows = await getAdapter(this.market).loadTickers();
      if (this.disposed) return;
      this.lastSnapshotAt = Date.now();
      this.events.onSnapshot(rows);
    } catch (error) {
      this.events.onError(describeError(error));
    }
  }

  private setState(state: ConnectionState): void {
    if (this.state === state) return;
    this.state = state;
    this.events.onState(state);
  }

  /** Free the socket on a hidden tab; everything reconnects on demand. */
  pause(): void {
    this.manager?.close();
  }

  resume(): void {
    this.manager?.reopen();
    if (Date.now() - this.lastSnapshotAt > 90_000) void this.refresh();
  }

  stop(): void {
    this.disposed = true;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.manager?.dispose();
    this.manager = null;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}

export function parseMiniTicker(payload: unknown): TickerDelta[] {
  if (!Array.isArray(payload)) return [];
  const out: TickerDelta[] = [];
  for (const entry of payload) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const symbol = typeof row.s === "string" ? row.s : null;
    const price = toNum(row.c);
    if (!symbol || price === null) continue;
    out.push({
      symbol,
      price,
      open24h: toNum(row.o),
      high24h: toNum(row.h),
      low24h: toNum(row.l),
      volume24h: toNum(row.v),
      quoteVolume24h: toNum(row.q),
      eventTime: toNum(row.E) ?? Date.now(),
    });
  }
  return out;
}

export function parseMarkPrice(payload: unknown): MarkDelta[] {
  if (!Array.isArray(payload)) return [];
  const out: MarkDelta[] = [];
  for (const entry of payload) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const symbol = typeof row.s === "string" ? row.s : null;
    if (!symbol) continue;
    out.push({
      symbol,
      markPrice: toNum(row.p),
      indexPrice: toNum(row.i),
      fundingRate: toNum(row.r),
      nextFundingTime: toNum(row.T),
      eventTime: toNum(row.E) ?? Date.now(),
    });
  }
  return out;
}
