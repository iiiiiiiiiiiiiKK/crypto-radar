import type { MarketId, SymbolMeta, TickerRow } from "@/types/market";
import type { MarkDelta, SnapshotRow, TickerDelta } from "@/services/types";
import { EMPTY_METRICS, type DerivedMetrics } from "@/types/market";
import { HistoryBuffer, OpenInterestHistory } from "./history";

interface Record {
  key: string;
  market: MarketId;
  row: SnapshotRow;
  snap: TickerRow;
  hist: HistoryBuffer;
  oi: OpenInterestHistory;
  surgeAt: number;
  turnoverPerMin: number | null;
  volumeSurge: number | null;
  oiChange: number | null;
  oiChangeAt: number | null;
}

export const keyOf = (market: MarketId, symbol: string): string => `${market}:${symbol}`;

/** How many pairs per market keep a rolling history (the liquid end of the book). */
const HISTORY_LIMIT = 420;
const HISTORY_MIN_TURNOVER = 120_000;
const DERIVED_CACHE_MS = 10_000;
const FLUSH_MS = 320;

/**
 * Holds every live row and hands out immutable snapshots.
 *
 * Rows are subscribed to individually (`useRow`) so a 1 s websocket batch does
 * not re-render a 700 row table: only the rows whose price actually changed get
 * a new snapshot object. List level consumers subscribe to the throttled global
 * version, which is where sorting and filtering are recomputed.
 */
export class TickerStore {
  private records = new Map<string, Record>();
  private rowSubs = new Map<string, Set<() => void>>();
  private globalSubs = new Set<() => void>();
  private marketRows = new Map<MarketId, TickerRow[]>();
  private dirtyMarkets = new Set<MarketId>();
  private tracked = new Set<string>();
  private trackedAt = 0;
  private watchKeys = new Set<string>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  version = 0;

  /* ------------------------------------------------------------------ rows */

  getRow(key: string): TickerRow | null {
    return this.records.get(key)?.snap ?? null;
  }

  getRows(market: MarketId): TickerRow[] {
    if (this.dirtyMarkets.has(market)) {
      this.rebuildMarket(market);
    }
    return this.marketRows.get(market) ?? [];
  }

  get size(): number {
    return this.records.size;
  }

  /** Rows of every market that has been started. */
  allRows(): TickerRow[] {
    const out: TickerRow[] = [];
    for (const market of ["spot", "futures", "alpha"] as MarketId[]) {
      const rows = this.marketRows.get(market);
      if (!rows) continue;
      if (this.dirtyMarkets.has(market)) this.rebuildMarket(market);
      out.push(...(this.marketRows.get(market) ?? []));
    }
    return out;
  }

  private rebuildMarket(market: MarketId): void {
    const rows: TickerRow[] = [];
    for (const record of this.records.values()) {
      if (record.market === market) rows.push(record.snap);
    }
    this.marketRows.set(market, rows);
    this.dirtyMarkets.delete(market);
  }

  /* ------------------------------------------------------------- mutations */

  applySnapshot(market: MarketId, rows: SnapshotRow[]): void {
    const seen = new Set<string>();
    const now = Date.now();

    for (const row of rows) {
      const key = keyOf(market, row.symbol);
      seen.add(key);
      const existing = this.records.get(key);
      if (existing) {
        existing.row = { ...existing.row, ...row, source: row.source };
        this.refreshSnapshot(existing, now);
      } else {
        const record: Record = {
          key,
          market,
          row: { ...row },
          snap: null as unknown as TickerRow,
          hist: new HistoryBuffer(),
          oi: new OpenInterestHistory(),
          surgeAt: 0,
          turnoverPerMin: null,
          volumeSurge: null,
          oiChange: null,
          oiChangeAt: null,
        };
        record.snap = this.buildSnapshot(record, now);
        this.records.set(key, record);
      }
    }

    // A REST snapshot is the complete universe of its market: prune the rest.
    for (const [key, record] of this.records) {
      if (record.market === market && !seen.has(key)) this.records.delete(key);
    }

    this.refreshTracked(now, true);
    this.markDirty(market);
    this.notifyAll();
  }

  applyTicker(deltas: TickerDelta[]): void {
    const now = Date.now();
    let touched = false;
    for (const delta of deltas) {
      const record = this.records.get(keyOf("spot", delta.symbol)) ?? this.records.get(keyOf("futures", delta.symbol));
      if (!record) continue;
      const row = record.row;
      row.price = delta.price;
      if (delta.open24h !== null) row.open24h = delta.open24h;
      if (delta.high24h !== null) row.high24h = delta.high24h;
      if (delta.low24h !== null) row.low24h = delta.low24h;
      if (delta.volume24h !== null) row.volume24h = delta.volume24h;
      if (delta.quoteVolume24h !== null) row.quoteVolume24h = delta.quoteVolume24h;
      row.updatedAt = delta.eventTime;
      row.receivedAt = now;
      row.source = "stream";
      row.changePercent =
        row.open24h !== null && row.open24h !== 0
          ? ((delta.price - row.open24h) / row.open24h) * 100
          : row.changePercent;

      if (this.tracked.has(record.key)) {
        record.hist.push(now, delta.price, row.quoteVolume24h);
      }
      this.refreshSnapshot(record, now);
      this.notifyRow(record.key);
      touched = true;
    }
    if (touched) {
      this.markDirty("spot");
      this.markDirty("futures");
      this.scheduleFlush();
    }
  }

  applyMark(deltas: MarkDelta[]): void {
    const now = Date.now();
    let touched = false;
    for (const delta of deltas) {
      const record = this.records.get(keyOf("futures", delta.symbol));
      if (!record) continue;
      const row = record.row;
      if (delta.markPrice !== null) row.markPrice = delta.markPrice;
      if (delta.indexPrice !== null) row.indexPrice = delta.indexPrice;
      if (delta.fundingRate !== null) row.fundingRate = delta.fundingRate;
      if (delta.nextFundingTime !== null) row.nextFundingTime = delta.nextFundingTime;
      row.receivedAt = now;
      this.refreshSnapshot(record, now);
      this.notifyRow(record.key);
      touched = true;
    }
    if (touched) {
      this.markDirty("futures");
      this.scheduleFlush();
    }
  }

  applyOpenInterest(symbol: string, value: number, at = Date.now()): void {
    const record = this.records.get(keyOf("futures", symbol));
    if (!record) return;
    record.row.openInterest = value;
    record.oi.push(at, value);
    record.oiChange = record.oi.changePercent(10 * 60_000, at);
    record.oiChangeAt = record.oi.latest?.at ?? null;
    this.refreshSnapshot(record, at);
    this.notifyRow(record.key);
    this.markDirty("futures");
    this.scheduleFlush();
  }

  applyMeta(market: MarketId, meta: SymbolMeta[]): void {
    let touched = false;
    for (const entry of meta) {
      const record = this.records.get(keyOf(market, entry.symbol));
      if (!record) continue;
      record.row.base = entry.base;
      record.row.quote = entry.quote;
      record.row.decimals = entry.decimals;
      record.row.id = entry.id;
      if (entry.name || entry.chainName || entry.iconUrl || entry.listingTime) {
        record.row.meta = {
          name: entry.name ?? record.row.meta?.name,
          chainName: entry.chainName ?? record.row.meta?.chainName,
          iconUrl: entry.iconUrl ?? record.row.meta?.iconUrl,
          listingTime: entry.listingTime ?? record.row.meta?.listingTime,
        };
      }
      record.snap = this.buildSnapshot(record, Date.now());
      this.notifyRow(record.key);
      touched = true;
    }
    if (touched) {
      this.markDirty(market);
      this.scheduleFlush();
    }
  }

  /**
   * Only liquid pairs (and watchlist entries) keep a rolling history, which
   * keeps memory flat and makes the radar's "liquidity floor" explicit.
   */
  refreshTracked(now = Date.now(), force = false): void {
    if (!force && now - this.trackedAt < 45_000) return;
    this.trackedAt = now;
    const next = new Set<string>(this.watchKeys);

    for (const market of ["spot", "futures", "alpha"] as MarketId[]) {
      const rows: TickerRow[] = [];
      for (const record of this.records.values()) {
        if (record.market === market) rows.push(record.snap);
      }
      rows.sort((a, b) => (b.quoteVolume24h ?? 0) - (a.quoteVolume24h ?? 0));
      let taken = 0;
      for (const row of rows) {
        if (taken >= HISTORY_LIMIT) break;
        const turnover = row.quoteVolume24h ?? 0;
        if (turnover < HISTORY_MIN_TURNOVER && !this.watchKeys.has(row.key)) continue;
        next.add(row.key);
        taken += 1;
      }
    }

    this.tracked = next;
  }

  setWatchKeys(keys: Iterable<string>): void {
    this.watchKeys = new Set(keys);
    this.refreshTracked(Date.now(), true);
  }

  /** Drop the rolling window of one pair (used after a websocket gap). */
  resetHistory(key: string): void {
    const record = this.records.get(key);
    if (!record) return;
    record.hist = new HistoryBuffer();
    record.surgeAt = 0;
    record.turnoverPerMin = null;
    record.volumeSurge = null;
    record.snap = this.buildSnapshot(record, Date.now());
    this.notifyRow(key);
  }

  /**
   * Seed the price window with real 1 minute closes so short-window metrics
   * exist right after page load instead of only after five minutes of sampling.
   * Only prices are seeded — the turnover baseline still needs live samples.
   */
  seedPrices(key: string, samples: Array<{ t: number; p: number }>): void {
    const record = this.records.get(key);
    if (!record || samples.length === 0) return;
    for (const sample of samples) record.hist.push(sample.t, sample.p, null);
    record.snap = this.buildSnapshot(record, Date.now());
    this.notifyRow(key);
    this.markDirty(record.market);
    this.scheduleFlush();
  }

  isTracked(key: string): boolean {
    return this.tracked.has(key);
  }

  /** Sampled price series for sparklines (oldest first). */
  sparkline(key: string, points = 40): number[] {
    const record = this.records.get(key);
    if (!record) return [];
    return record.hist.series(points).map((sample) => sample.p);
  }


  trackedCount(): number {
    return this.tracked.size;
  }

  /* ------------------------------------------------------------ snapshots */

  private refreshSnapshot(record: Record, now: number): void {
    record.snap = this.buildSnapshot(record, now);
  }

  private buildSnapshot(record: Record, now: number): TickerRow {
    const row = record.row;
    const h = record.hist;

    let metrics: DerivedMetrics = EMPTY_METRICS;
    if (record.hist.count > 2) {
      if (now - record.surgeAt >= DERIVED_CACHE_MS) {
        record.surgeAt = now;
        record.turnoverPerMin = h.turnoverPerMin(now);
        record.volumeSurge = h.volumeSurge(now);
      }
      metrics = {
        m1: h.change(60_000, now),
        m5: h.change(300_000, now),
        m15: h.change(900_000, now),
        h1: h.change(3_600_000, now),
        vol15m: h.absMoveMean(now, 15),
        turnoverPerMin: record.turnoverPerMin,
        volumeSurge: record.volumeSurge,
        oiChange: record.oiChange,
        oiChangeAt: record.oiChangeAt,
      };
    } else {
      metrics = {
        ...EMPTY_METRICS,
        turnoverPerMin: record.turnoverPerMin,
        volumeSurge: record.volumeSurge,
        oiChange: record.oiChange,
        oiChangeAt: record.oiChangeAt,
      };
    }

    return {
      key: record.key,
      market: record.market,
      symbol: row.symbol,
      id: row.id,
      base: row.base,
      quote: row.quote,
      price: row.price,
      open24h: row.open24h,
      changePercent: row.changePercent,
      high24h: row.high24h,
      low24h: row.low24h,
      volume24h: row.volume24h,
      quoteVolume24h: row.quoteVolume24h,
      trades24h: row.trades24h,
      bidPrice: row.bidPrice,
      askPrice: row.askPrice,
      markPrice: row.markPrice,
      indexPrice: row.indexPrice,
      fundingRate: row.fundingRate,
      nextFundingTime: row.nextFundingTime,
      openInterest: row.openInterest,
      decimals: row.decimals,
      updatedAt: row.updatedAt,
      receivedAt: row.receivedAt,
      source: row.source,
      d: metrics,
      meta: row.meta,
    };
  }

  /* ---------------------------------------------------------- subscription */

  subscribeRow(key: string, listener: () => void): () => void {
    let set = this.rowSubs.get(key);
    if (!set) {
      set = new Set();
      this.rowSubs.set(key, set);
    }
    set.add(listener);
    return () => {
      const current = this.rowSubs.get(key);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) this.rowSubs.delete(key);
    };
  }

  private notifyRow(key: string): void {
    const set = this.rowSubs.get(key);
    if (!set) return;
    for (const listener of set) listener();
  }

  /** Arrow property: it is passed to React as a bare reference. */
  subscribeAll = (listener: () => void): (() => void) => {
    this.globalSubs.add(listener);
    return () => {
      this.globalSubs.delete(listener);
    };
  };

  private markDirty(market: MarketId): void {
    this.dirtyMarkets.add(market);
  }

  /** Coalesce list level updates so the table/sort recompute at most every 320 ms. */
  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.version += 1;
      for (const listener of this.globalSubs) listener();
    }, FLUSH_MS);
  }

  private notifyAll(): void {
    this.version += 1;
    for (const listener of this.globalSubs) listener();
    for (const key of this.rowSubs.keys()) this.notifyRow(key);
  }
}

export const tickerStore = new TickerStore();
