import type { ConnectionState } from "@/types/market";

export type StreamHandler = (payload: unknown) => void;

interface Subscription {
  stream: string;
  handler: StreamHandler;
}

export interface WsManagerOptions {
  /** Full websocket endpoint, e.g. `wss://stream.binance.com:9443/ws`. */
  url: string;
  /** Milliseconds without any frame before the feed is considered stale. */
  staleAfterMs?: number;
  /** Base delay for the exponential backoff. */
  reconnectBaseMs?: number;
  /** Upper bound of the reconnect delay. */
  reconnectMaxMs?: number;
  /** How often the health check runs. */
  heartbeatMs?: number;
  onStateChange?: (state: ConnectionState) => void;
}

const DEFAULT_STALE_MS = 30_000;
const DEFAULT_BASE_MS = 1_000;
const DEFAULT_MAX_MS = 30_000;
const DEFAULT_HEARTBEAT_MS = 5_000;

/**
 * A single, shared websocket connection with subscription multiplexing.
 *
 * Binance allows up to 1024 streams per connection and 5 incoming messages
 * per second, so every component in the app shares one socket per market
 * instead of opening its own.
 */
export class WsManager {
  private socket: WebSocket | null = null;
  private state: ConnectionState = "idle";
  private subscriptions = new Map<string, Subscription[]>();
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lastMessageAt = 0;
  private manualClose = false;
  private messageId = 0;

  constructor(private readonly options: WsManagerOptions) {}

  getState(): ConnectionState {
    return this.state;
  }

  get activeStreams(): string[] {
    return [...this.subscriptions.keys()];
  }

  /** Subscribe to one or more raw Binance stream names. */
  subscribe(streams: string[], handler: StreamHandler): () => void {
    const fresh: string[] = [];
    for (const stream of streams) {
      const list = this.subscriptions.get(stream) ?? [];
      list.push({ stream, handler });
      this.subscriptions.set(stream, list);
      fresh.push(stream);
    }
    if (fresh.length > 0 && this.state === "connected") {
      this.send({ method: "SUBSCRIBE", params: fresh, id: ++this.messageId });
    } else if (fresh.length > 0 && this.state === "idle") {
      this.connect();
    }
    return () => this.unsubscribe(fresh, handler);
  }

  private unsubscribe(streams: string[], handler: StreamHandler): void {
    const emptied: string[] = [];
    for (const stream of streams) {
      const list = this.subscriptions.get(stream);
      if (!list) continue;
      const index = list.findIndex((s) => s.handler === handler);
      if (index >= 0) list.splice(index, 1);
      if (list.length === 0) {
        this.subscriptions.delete(stream);
        emptied.push(stream);
      }
    }
    if (emptied.length > 0 && this.state === "connected") {
      this.send({ method: "UNSUBSCRIBE", params: emptied, id: ++this.messageId });
    }
    if (this.subscriptions.size === 0) this.close();
  }

  connect(): void {
    if (this.socket && (this.socket.readyState === 0 || this.socket.readyState === 1)) return;
    if (this.subscriptions.size === 0) return;
    this.clearReconnect();
    this.manualClose = false;
    this.setState(this.attempt === 0 ? "connecting" : "reconnecting");

    let socket: WebSocket;
    try {
      socket = new WebSocket(this.options.url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;

    socket.onopen = () => {
      this.attempt = 0;
      this.lastMessageAt = Date.now();
      this.setState("connected");
      const streams = [...this.subscriptions.keys()];
      if (streams.length > 0) {
        this.send({ method: "SUBSCRIBE", params: streams, id: ++this.messageId });
      }
      this.startHeartbeat();
    };

    socket.onmessage = (event: MessageEvent) => {
      this.lastMessageAt = Date.now();
      if (this.state === "stale") this.setState("connected");
      this.dispatch(event.data);
    };

    socket.onerror = () => {
      // The browser does not expose useful error details; `onclose` follows up.
      this.setState("error");
    };

    socket.onclose = () => {
      this.stopHeartbeat();
      this.socket = null;
      if (this.manualClose) {
        this.setState("disconnected");
        return;
      }
      this.scheduleReconnect();
    };
  }

  private dispatch(raw: unknown): void {
    if (typeof raw !== "string") return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return; // Ignore malformed frames instead of breaking the feed.
    }
    if (!parsed || typeof parsed !== "object") return;
    const message = parsed as Record<string, unknown>;

    // Control replies (SUBSCRIBE/UNSUBSCRIBE acknowledgements).
    if (typeof message.result === "string" || message.id !== undefined) {
      if (message.result === null && typeof message.error === "object") {
        this.setState("error");
      }
      return;
    }

    const stream = typeof message.stream === "string" ? message.stream : null;
    const payload = stream && "data" in message ? message.data : message;
    const eventName = typeof (payload as { e?: unknown }).e === "string" ? (payload as { e: string }).e : null;

    const targets = stream
      ? this.subscriptions.get(stream) ?? []
      : eventName
        ? this.subscriptions.get(eventName) ?? []
        : [];

    for (const subscription of targets) {
      try {
        subscription.handler(payload);
      } catch {
        // A faulty subscriber must not break the whole feed.
      }
    }

    // All-market streams are addressed by their event name.
    if (!stream && eventName) {
      for (const [name, list] of this.subscriptions) {
        if (name === eventName) continue;
        if (!name.startsWith("!")) continue;
        for (const subscription of list) {
          try {
            subscription.handler(payload);
          } catch {
            /* ignore */
          }
        }
      }
    }
  }

  private send(message: Record<string, unknown>): void {
    if (!this.socket || this.socket.readyState !== 1) return;
    try {
      this.socket.send(JSON.stringify(message));
    } catch {
      /* the close handler will take over */
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    const staleAfter = this.options.staleAfterMs ?? DEFAULT_STALE_MS;
    this.heartbeatTimer = setInterval(() => {
      if (this.state !== "connected" && this.state !== "stale") return;
      const idle = Date.now() - this.lastMessageAt;
      if (idle > staleAfter) {
        this.setState("stale");
      }
      if (idle > staleAfter * 3) {
        // No data at all for a long time — force a fresh connection.
        this.attempt = 1;
        this.socket?.close();
      }
    }, this.options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.manualClose) return;
    if (this.subscriptions.size === 0) return;
    this.setState("reconnecting");
    this.attempt += 1;
    const base = this.options.reconnectBaseMs ?? DEFAULT_BASE_MS;
    const max = this.options.reconnectMaxMs ?? DEFAULT_MAX_MS;
    const delay = Math.min(max, base * 2 ** (this.attempt - 1)) + Math.random() * base;
    this.clearReconnect();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private setState(state: ConnectionState): void {
    if (this.state === state) return;
    this.state = state;
    this.options.onStateChange?.(state);
  }

  /** Close the socket but keep the subscription registry intact. */
  close(): void {
    this.manualClose = true;
    this.clearReconnect();
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.setState("disconnected");
  }

  /** Reopen the socket and restore every active subscription. */
  reopen(): void {
    this.manualClose = false;
    this.attempt = 0;
    this.clearReconnect();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.connect();
  }

  dispose(): void {
    this.subscriptions.clear();
    this.close();
  }
}
