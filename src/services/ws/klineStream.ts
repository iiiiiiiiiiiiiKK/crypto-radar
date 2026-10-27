import { wsEndpoint } from "@/services/endpoints";
import type { Candle, Interval } from "@/types/market";
import { WsManager } from "./WsManager";

export interface KlineStreamEvent {
  candle: Candle;
  closed: boolean;
}

/**
 * Live kline updates for exactly one symbol+interval at a time.
 *
 * The stream name is rebuilt whenever the user changes the pair or the
 * interval, and the previous subscription is always released first, so the
 * socket never accumulates orphan streams.
 */
export class KlineStream {
  private manager: WsManager;
  private release: (() => void) | null = null;
  private handler: ((event: KlineStreamEvent) => void) | null = null;

  constructor(
    market: "spot" | "futures",
    private readonly onState?: (state: "live" | "reconnecting" | "offline") => void,
  ) {
    this.manager = new WsManager({
      url: wsEndpoint(market),
      label: `${market}:kline`,
      staleAfterMs: 45_000,
      onStateChange: (state) => {
        if (state === "live") this.onState?.("live");
        else if (state === "reconnecting" || state === "connecting") this.onState?.("reconnecting");
        else if (state === "offline" || state === "error") this.onState?.("offline");
      },
    });
  }

  /** Point the stream at a new symbol/interval. */
  open(symbol: string, interval: Interval, handler: (event: KlineStreamEvent) => void): void {
    this.handler = handler;
    this.release?.();
    const stream = `${symbol.toLowerCase()}@kline_${interval}`;
    this.release = this.manager.subscribe([stream], (payload) => {
      const parsed = parseKline(payload);
      if (parsed) this.handler?.(parsed);
    });
    this.manager.connect();
  }

  close(): void {
    this.release?.();
    this.release = null;
    this.handler = null;
    this.manager.dispose();
  }
}

export function parseKline(payload: unknown): KlineStreamEvent | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const k = record.k as Record<string, unknown> | undefined;
  if (!k) return null;
  const time = Number(k.t);
  const open = Number(k.o);
  const high = Number(k.h);
  const low = Number(k.l);
  const close = Number(k.c);
  const volume = Number(k.v);
  if (![time, open, high, low, close, volume].every(Number.isFinite)) return null;
  return {
    candle: { time, open, high, low, close, volume },
    closed: k.x === true,
  };
}
