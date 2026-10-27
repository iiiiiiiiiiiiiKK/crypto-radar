import { getAdapter } from "@/services";
import { futuresAdapter } from "@/services";
import { MarketFeed } from "@/services/ws/marketFeed";
import type { ConnectionState, MarketId, TickerRow } from "@/types/market";
import { DEFAULT_EVENT_THRESHOLDS, EventLog, detectEvents, type EventThresholds } from "./events";
import { tickerStore } from "./tickerStore";

export interface EngineSnapshot {
  version: number;
  states: Record<MarketId, ConnectionState>;
  errors: Record<MarketId, string | null>;
  lastUpdate: Record<MarketId, number | null>;
  started: MarketId[];
  events: number;
  oiSymbols: number;
}

const EVENT_TICK_MS = 2_000;
const OI_POLL_MS = 15_000;
const OI_BATCH = 12;
const OI_UNIVERSE = 120;
const SEED_SYMBOLS = 60;
const SEED_CONCURRENCY = 6;

/**
 * Wires the exchange feeds into the ticker store and the event engine.
 *
 * One engine instance owns every websocket of the app: pages mount and unmount
 * freely, the feeds keep running (and pause when the tab is hidden), so
 * navigating between the radar and the chart never drops the connection.
 */
class MarketEngine {
  readonly store = tickerStore;
  readonly events = new EventLog();

  private feeds = new Map<MarketId, MarketFeed>();
  private states: Record<MarketId, ConnectionState> = {
    spot: "idle",
    futures: "idle",
    alpha: "idle",
  };
  private errors: Record<MarketId, string | null> = { spot: null, futures: null, alpha: null };
  private lastUpdate: Record<MarketId, number | null> = { spot: null, futures: null, alpha: null };
  private starting = new Set<MarketId>();

  private listeners = new Set<() => void>();
  /** Built lazily: class field initialisers run before the fields it reads. */
  private snapshot: EngineSnapshot | null = null;

  private eventTimer: ReturnType<typeof setInterval> | null = null;
  private oiTimer: ReturnType<typeof setInterval> | null = null;
  private oiCursor = 0;
  private oiSymbols = new Set<string>();
  private seeded = new Set<MarketId>();
  private seededSymbols = 0;
  private visible = true;
  private initialized = false;
  private version = 0;

  /* --------------------------------------------------------------- lifecycle */

  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.ensureMarkets(["spot", "futures"]);
    this.startTimers();
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        this.setVisible(document.visibilityState === "visible");
      });
    }
  }

  ensureMarkets(markets: MarketId[]): void {
    for (const market of markets) this.startMarket(market);
  }

  private startMarket(market: MarketId): void {
    if (this.feeds.has(market) || this.starting.has(market)) return;
    this.starting.add(market);

    const feed = new MarketFeed(market, {
      onSnapshot: (rows) => {
        this.store.applySnapshot(market, rows);
        this.lastUpdate[market] = Date.now();
        this.bump();
        void this.seedHistory(market);
      },
      onMeta: (meta) => {
        this.store.applyMeta(market, meta);
      },
      onTicker: (deltas) => {
        this.store.applyTicker(deltas);
        this.lastUpdate[market] = Date.now();
      },
      onMark: (deltas) => {
        this.store.applyMark(deltas);
      },
      onState: (state) => {
        // A gap in the feed must not create fake 1 minute moves.
        if (this.states[market] === "reconnecting" && state === "live") {
          for (const row of this.store.getRows(market)) this.store.resetHistory(row.key);
        }
        this.states[market] = state;
        if (state === "live") this.errors[market] = null;
        this.bump();
      },
      onError: (message) => {
        this.errors[market] = message;
        this.bump();
      },
    });

    this.feeds.set(market, feed);
    void feed.start().finally(() => this.starting.delete(market));
  }

  private startTimers(): void {
    if (this.eventTimer === null) {
      this.eventTimer = setInterval(() => this.tickEvents(), EVENT_TICK_MS);
    }
    if (this.oiTimer === null) {
      this.oiTimer = setInterval(() => void this.pollOpenInterest(), OI_POLL_MS);
      void this.pollOpenInterest();
    }
  }

  private stopTimers(): void {
    if (this.eventTimer !== null) {
      clearInterval(this.eventTimer);
      this.eventTimer = null;
    }
    if (this.oiTimer !== null) {
      clearInterval(this.oiTimer);
      this.oiTimer = null;
    }
  }

  setVisible(visible: boolean): void {
    if (this.visible === visible) return;
    this.visible = visible;
    if (visible) {
      for (const feed of this.feeds.values()) feed.resume();
      this.startTimers();
    } else {
      for (const feed of this.feeds.values()) feed.pause();
      this.stopTimers();
    }
    this.bump();
  }

  /* ------------------------------------------------------------------- events */

  setEventThresholds(thresholds: EventThresholds): void {
    this.events.setThresholds(thresholds);
  }

  private tickEvents(): void {
    if (!this.visible) return;
    const now = Date.now();
    const rows = this.scanUniverse();
    if (rows.length === 0) return;
    const fresh = detectEvents(rows, {
      thresholds: DEFAULT_EVENT_THRESHOLDS,
      now,
      isCoolingDown: this.events.isCoolingDown,
    });
    if (fresh.length > 0) {
      this.events.push(fresh);
      this.bump();
    }
  }

  /**
   * Rows that participate in the live radar: spot and perpetual only, because
   * Alpha publishes a polled snapshot with no short-window history.
   */
  scanUniverse(): TickerRow[] {
    const rows: TickerRow[] = [];
    rows.push(...this.store.getRows("spot"));
    rows.push(...this.store.getRows("futures"));
    return rows;
  }

  /* --------------------------------------------------------- open interest */

  private async pollOpenInterest(): Promise<void> {
    if (!this.visible) return;
    if (this.states.futures !== "live" && this.states.futures !== "stale") return;

    const universe = this.store
      .getRows("futures")
      .filter((row) => (row.quoteVolume24h ?? 0) > 500_000)
      .sort((a, b) => (b.quoteVolume24h ?? 0) - (a.quoteVolume24h ?? 0))
      .slice(0, OI_UNIVERSE);
    if (universe.length === 0) return;

    const picks: TickerRow[] = [];
    for (let i = 0; i < Math.min(OI_BATCH, universe.length); i += 1) {
      picks.push(universe[this.oiCursor % universe.length]);
      this.oiCursor += 1;
    }

    let changed = false;
    // Small concurrency cap: the futures REST weight budget is generous, but a
    // burst of 12 parallel requests every 15 s is still polite.
    for (let i = 0; i < picks.length; i += 4) {
      await Promise.all(
        picks.slice(i, i + 4).map(async (row) => {
          try {
            const value = await futuresAdapter.fetchOpenInterest(row.symbol);
            if (value === null) return;
            this.store.applyOpenInterest(row.symbol, value);
            this.oiSymbols.add(row.symbol);
            changed = true;
          } catch {
            /* open interest is optional data; a failure must stay silent */
          }
        }),
      );
    }

    if (changed) this.bump();
  }

  get openInterestCoverage(): number {
    return this.oiSymbols.size;
  }

  /** How many pairs were pre-seeded with 1 minute closes (short window metrics). */
  get seededCoverage(): number {
    return this.seededSymbols;
  }

  /**
   * Seeds the price window of the most liquid pairs with real 1 minute closes.
   *
   * Without this, every short-window metric (1m/5m/15m/1h) would stay empty for
   * the first five minutes after opening the page. The seeded samples are
   * genuine exchange candles, fetched once per market, 60 requests in total.
   */
  private async seedHistory(market: MarketId): Promise<void> {
    if (market === "alpha" || this.seeded.has(market)) return;
    this.seeded.add(market);

    const targets = this.store
      .getRows(market)
      .filter((row) => (row.quoteVolume24h ?? 0) > 1_000_000)
      .sort((a, b) => (b.quoteVolume24h ?? 0) - (a.quoteVolume24h ?? 0))
      .slice(0, SEED_SYMBOLS);
    if (targets.length === 0) {
      this.seeded.delete(market);
      return;
    }

    const adapter = getAdapter(market);
    for (let index = 0; index < targets.length; index += SEED_CONCURRENCY) {
      if (!this.visible) return;
      const batch = targets.slice(index, index + SEED_CONCURRENCY);
      // Six requests at a time keeps the REST weight budget untouched.
      await Promise.all(
        batch.map(async (row) => {
          try {
            const candles = await adapter.fetchKlines(row.symbol, "1m", 70);
            if (candles.length === 0) return;
            this.store.seedPrices(
              row.key,
              candles.map((candle) => ({ t: candle.time, p: candle.close })),
            );
            this.seededSymbols += 1;
          } catch {
            /* seeding is an optimisation, never a requirement */
          }
        }),
      );
    }
    this.bump();
  }

  /* --------------------------------------------------------------- utilities */

  refresh(market?: MarketId): void {
    const markets = market ? [market] : (["spot", "futures", "alpha"] as MarketId[]);
    for (const id of markets) {
      const feed = this.feeds.get(id);
      if (feed) void feed.refresh();
      else this.startMarket(id);
    }
  }

  getState(market: MarketId): ConnectionState {
    return this.states[market];
  }

  getError(market: MarketId): string | null {
    return this.errors[market];
  }

  /* ------------------------------------------------------------ subscription */

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): EngineSnapshot => this.snapshot ?? this.buildSnapshot(this.version);

  private bump(): void {
    this.version += 1;
    this.snapshot = this.buildSnapshot(this.version);
    for (const listener of this.listeners) listener();
  }

  private buildSnapshot(version: number): EngineSnapshot {
    return {
      version,
      states: { ...this.states },
      errors: { ...this.errors },
      lastUpdate: { ...this.lastUpdate },
      started: [...this.feeds.keys()],
      events: this.events.all.length,
      oiSymbols: this.oiSymbols.size,
    };
  }

  /** Ticker rows for the kline adapter without leaking the adapter registry. */
  adapterFor(market: MarketId) {
    return getAdapter(market);
  }
}

export const engine = new MarketEngine();
