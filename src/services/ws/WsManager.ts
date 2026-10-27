import type { ConnectionState } from "@/types/market";

export type StreamHandler = (payload: unknown) => void;

interface Subscription {
  handler: StreamHandler;
}

export interface WsManagerOptions {
  url: string;
  label?: string;
  /** Silence longer than this marks the feed as stale. */
  staleAfterMs?: number;
  /** Exponential backoff base / ceiling. */
  reconnectBaseMs?: number;
  reconnectMaxMs?: number;
  /** How often the health check runs. */
  heartbeatMs?: number;
  /** Proactively reconnect before Binance closes the socket (24 h). */
  maxAgeMs?: number;
  onStateChange?: (state: ConnectionState) => void;
}

const DEFAULTS = {
  staleAfterMs: 30_000,
  reconnectBaseMs: 1_000,
  reconnectMaxMs: 20_000,
  heartbeatMs: 5_000,
  maxAgeMs: 20 * 60 * 60_000,
};

/**
 * One shared websocket with stream multiplexing.
 *
 * Binance allows ~1024 streams and 5 inbound messages per second per
 * connection, so every consumer of the same market shares a single socket
 * instead of opening one per component.
 */
export class WsManager {
  private socket: WebSocket | null = null;
  private state: ConnectionState = "idle";
  private subscriptions = new Map<string, Set<Subscription>>();
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private messageId = 0;
  private lastMessageAt = 0;
  private openedAt = 0;
  private manualClose = false;

  /** Diagnostics surfaced in the status panel. */
  frames = 0;

  constructor(private readonly options: WsManagerOptions) {}

  getState(): ConnectionState {
    return this.state;
  }

  get lastFrameAt(): number {
    return this.lastMessageAt;
  }

  get streamCount(): number {
    return this.subscriptions.size;
  }

  subscribe(streams: string[], handler: StreamHandler): () => void {
    const added: string[] = [];
    for (const stream of streams) {
      let set = this.subscriptions.get(stream);
      if (!set) {
        set = new Set();
        this.subscriptions.set(stream, set);
        added.push(stream);
      }
      set.add({ handler });
    }

    if (this.state === "live") {
      if (added.length > 0) this.send({ method: "SUBSCRIBE", params: added });
    } else {
      this.connect();
    }

    return () => this.unsubscribe(streams, handler);
  }

  private unsubscribe(streams: string[], handler: StreamHandler): void {
    const removed: string[] = [];
    for (const stream of streams) {
      const set = this.subscriptions.get(stream);
      if (!set) continue;
      for (const sub of set) {
        if (sub.handler === handler) set.delete(sub);
      }
      if (set.size === 0) {
        this.subscriptions.delete(stream);
        removed.push(stream);
      }
    }
    if (this.state === "live" && removed.length > 0) {
      this.send({ method: "UNSUBSCRIBE", params: removed });
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
      this.openedAt = Date.now();
      this.setState("live");
      const streams = [...this.subscriptions.keys()];
      if (streams.length > 0) this.send({ method: "SUBSCRIBE", params: streams });
      this.startHeartbeat();
    };

    socket.onmessage = (event: MessageEvent) => {
      this.lastMessageAt = Date.now();
      this.frames += 1;
      if (this.state === "stale") this.setState("live");
      this.dispatch(event.data);
    };

    socket.onerror = () => {
      // The browser hides the reason; `onclose` always follows.
      if (this.state === "live") this.setState("reconnecting");
    };

    socket.onclose = () => {
      this.stopHeartbeat();
      this.socket = null;
      if (this.manualClose) {
        this.setState("offline");
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
      return;
    }
    if (!parsed || typeof parsed !== "object") return;
    const message = parsed as Record<string, unknown>;

    // Control frames: SUBSCRIBE / UNSUBSCRIBE acknowledgements.
    if ("result" in message && message.id !== undefined) {
      if (message.error) this.setState("error");
      return;
    }

    const stream = typeof message.stream === "string" ? message.stream : null;
    const payload = stream && "data" in message ? message.data : message;

    if (stream) {
      const set = this.subscriptions.get(stream);
      if (set) this.deliver(set, payload);
      return;
    }

    // All-market streams arrive without a `stream` wrapper; route by event name.
    const eventName = typeof (payload as { e?: unknown }).e === "string"
      ? (payload as { e: string }).e
      : null;
    for (const [name, set] of this.subscriptions) {
      if (name === eventName && eventName !== null) this.deliver(set, payload);
    }
  }

  private deliver(set: Set<Subscription>, payload: unknown): void {
    for (const sub of set) {
      try {
        sub.handler(payload);
      } catch {
        // A faulty subscriber must never break the shared socket.
      }
    }
  }

  private send(message: Record<string, unknown>): void {
    if (!this.socket || this.socket.readyState !== 1) return;
    try {
      this.socket.send(JSON.stringify({ ...message, id: ++this.messageId }));
    } catch {
      /* the close handler takes over */
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    const staleAfter = this.options.staleAfterMs ?? DEFAULTS.staleAfterMs;
    const maxAge = this.options.maxAgeMs ?? DEFAULTS.maxAgeMs;
    this.heartbeatTimer = setInterval(() => {
      if (this.state !== "live" && this.state !== "stale") return;
      const idle = Date.now() - this.lastMessageAt;
      if (idle > staleAfter) this.setState("stale");
      if (idle > staleAfter * 4) {
        this.attempt = 1;
        this.socket?.close();
        return;
      }
      if (Date.now() - this.openedAt > maxAge) {
        // Binance closes connections after 24 h; rotate before that happens.
        this.attempt = 0;
        this.socket?.close();
      }
    }, this.options.heartbeatMs ?? DEFAULTS.heartbeatMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.manualClose) return;
    if (this.subscriptions.size === 0) {
      this.setState("offline");
      return;
    }
    this.setState("reconnecting");
    this.attempt += 1;
    const base = this.options.reconnectBaseMs ?? DEFAULTS.reconnectBaseMs;
    const max = this.options.reconnectMaxMs ?? DEFAULTS.reconnectMaxMs;
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

  /** Pause the socket but keep the subscription registry. */
  close(): void {
    this.manualClose = true;
    this.clearReconnect();
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.setState("offline");
  }

  /** Resume after a pause, restoring every subscription. */
  reopen(): void {
    if (this.subscriptions.size === 0) return;
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
