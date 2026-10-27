import type { MarketId, MarketTicker } from "@/types/market";

export type EventRuleId =
  | "surge"
  | "dump"
  | "volume-burst"
  | "funding-extreme"
  | "new-high"
  | "new-low";

export type EventSeverity = "info" | "warn" | "critical";

export type EventMarket = MarketId;

export interface MarketEvent {
  id: string;
  ruleId: EventRuleId;
  market: EventMarket;
  symbol: string;
  severity: EventSeverity;
  /** The measured value, in the unit described by `unit`. */
  value: number;
  unit: "percent" | "ratio";
  /** Extra real numbers shown next to the event. */
  price: number;
  changePercent: number;
  createdAt: number;
}

export interface EventThresholds {
  /** Absolute 24 h change that is already noteworthy, in percent. */
  movePercent: number;
  /** Short-window move since the previous sample, in percent. */
  burstPercent: number;
  /** Turnover multiplier against the 24 h average pace. */
  volumeRatio: number;
  /** Absolute funding rate in percent per 8 h. */
  fundingPercent: number;
  /** How close to the 24 h extreme counts as a new high/low (fraction). */
  extremeTolerance: number;
  /** Minimum milliseconds between two events for the same rule and symbol. */
  cooldownMs: number;
}

export const DEFAULT_THRESHOLDS: EventThresholds = {
  movePercent: 8,
  burstPercent: 1.2,
  volumeRatio: 3,
  fundingPercent: 0.075,
  extremeTolerance: 0.0015,
  cooldownMs: 180_000,
};

export interface PreviousSample {
  price: number;
  at: number;
}

export interface DetectContext {
  market: EventMarket;
  thresholds: EventThresholds;
  previous: Map<string, PreviousSample>;
  /** Optional turnover multiplier per symbol. */
  spike?: (symbol: string) => number | null;
  /** Suppress duplicates that fired recently. */
  isCoolingDown: (ruleId: EventRuleId, symbol: string, now: number) => boolean;
  now: number;
}

function severityFor(ratio: number, thresholds: { warn: number; critical: number }): EventSeverity {
  if (ratio >= thresholds.critical) return "critical";
  if (ratio >= thresholds.warn) return "warn";
  return "info";
}

/**
 * Derives market events from two consecutive snapshots of the live feed.
 *
 * Every branch is a plain comparison against a real number that the event
 * carries with it, so the UI can always show *why* something fired. Nothing is
 * generated at random and nothing fires unless the condition actually holds.
 */
export function detectEvents(tickers: MarketTicker[], context: DetectContext): MarketEvent[] {
  const { market, thresholds, previous, spike, isCoolingDown, now } = context;
  const events: MarketEvent[] = [];

  for (const ticker of tickers) {
    if (!Number.isFinite(ticker.price) || ticker.price <= 0) continue;
    const before = previous.get(ticker.symbol);

    // --- short-window burst: compare with the sample we saw a moment ago ---
    if (before && now - before.at >= 3_000) {
      const move = ((ticker.price - before.price) / before.price) * 100;
      if (Math.abs(move) >= thresholds.burstPercent) {
        const ruleId: EventRuleId = move > 0 ? "surge" : "dump";
        if (!isCoolingDown(ruleId, ticker.symbol, now)) {
          events.push({
            id: `${ruleId}:${market}:${ticker.symbol}:${now}`,
            ruleId,
            market,
            symbol: ticker.symbol,
            severity: severityFor(Math.abs(move) / thresholds.burstPercent, {
              warn: 1.8,
              critical: 3,
            }),
            value: Math.abs(move),
            unit: "percent",
            price: ticker.price,
            changePercent: ticker.priceChangePercent,
            createdAt: now,
          });
        }
      }
    }

    // --- 24 h move beyond the configured threshold ---
    if (Math.abs(ticker.priceChangePercent) >= thresholds.movePercent) {
      const ruleId: EventRuleId = ticker.priceChangePercent > 0 ? "surge" : "dump";
      if (!isCoolingDown(ruleId, ticker.symbol, now)) {
        events.push({
          id: `${ruleId}-24h:${market}:${ticker.symbol}:${now}`,
          ruleId,
          market,
          symbol: ticker.symbol,
          severity: severityFor(Math.abs(ticker.priceChangePercent) / thresholds.movePercent, {
            warn: 1.5,
            critical: 2.5,
          }),
          value: Math.abs(ticker.priceChangePercent),
          unit: "percent",
          price: ticker.price,
          changePercent: ticker.priceChangePercent,
          createdAt: now,
        });
      }
    }

    // --- turnover burst ---
    const ratio = spike ? spike(ticker.symbol) : null;
    if (ratio !== null && ratio >= thresholds.volumeRatio) {
      if (!isCoolingDown("volume-burst", ticker.symbol, now)) {
        events.push({
          id: `volume-burst:${market}:${ticker.symbol}:${now}`,
          ruleId: "volume-burst",
          market,
          symbol: ticker.symbol,
          severity: severityFor(ratio / thresholds.volumeRatio, { warn: 1.5, critical: 2.5 }),
          value: ratio,
          unit: "ratio",
          price: ticker.price,
          changePercent: ticker.priceChangePercent,
          createdAt: now,
        });
      }
    }

    // --- funding rate at an extreme ---
    if (ticker.fundingRate !== null) {
      const fundingPercent = Math.abs(ticker.fundingRate * 100);
      if (fundingPercent >= thresholds.fundingPercent) {
        if (!isCoolingDown("funding-extreme", ticker.symbol, now)) {
          events.push({
            id: `funding:${market}:${ticker.symbol}:${now}`,
            ruleId: "funding-extreme",
            market,
            symbol: ticker.symbol,
            severity: severityFor(fundingPercent / thresholds.fundingPercent, {
              warn: 1.4,
              critical: 2.2,
            }),
            value: ticker.fundingRate * 100,
            unit: "percent",
            price: ticker.price,
            changePercent: ticker.priceChangePercent,
            createdAt: now,
          });
        }
      }
    }

    // --- new 24 h high / low ---
    if (ticker.high24h && ticker.high24h > 0) {
      const gapToHigh = (ticker.high24h - ticker.price) / ticker.high24h;
      if (gapToHigh <= thresholds.extremeTolerance && !isCoolingDown("new-high", ticker.symbol, now)) {
        events.push({
          id: `high:${market}:${ticker.symbol}:${now}`,
          ruleId: "new-high",
          market,
          symbol: ticker.symbol,
          severity: "info",
          value: ticker.price,
          unit: "percent",
          price: ticker.price,
          changePercent: ticker.priceChangePercent,
          createdAt: now,
        });
      }
    }
    if (ticker.low24h && ticker.low24h > 0) {
      const gapToLow = (ticker.price - ticker.low24h) / ticker.low24h;
      if (gapToLow <= thresholds.extremeTolerance && !isCoolingDown("new-low", ticker.symbol, now)) {
        events.push({
          id: `low:${market}:${ticker.symbol}:${now}`,
          ruleId: "new-low",
          market,
          symbol: ticker.symbol,
          severity: "info",
          value: ticker.price,
          unit: "percent",
          price: ticker.price,
          changePercent: ticker.priceChangePercent,
          createdAt: now,
        });
      }
    }
  }

  return events.sort((a, b) => b.createdAt - a.createdAt);
}

/** Keeps the recent events bounded and tracks the per-rule cooldowns. */
export class EventStore {
  private events: MarketEvent[] = [];
  private cooldowns = new Map<string, number>();

  constructor(
    private readonly limit = 200,
    private readonly thresholds: EventThresholds = DEFAULT_THRESHOLDS,
  ) {}

  get all(): MarketEvent[] {
    return this.events;
  }

  isCoolingDown(ruleId: EventRuleId, symbol: string, now: number): boolean {
    const key = `${ruleId}:${symbol}`;
    const last = this.cooldowns.get(key);
    if (last === undefined) return false;
    return now - last < this.thresholds.cooldownMs;
  }

  push(events: MarketEvent[]): void {
    if (events.length === 0) return;
    for (const event of events) {
      this.cooldowns.set(`${event.ruleId}:${event.symbol}`, event.createdAt);
    }
    this.events = [...events, ...this.events].slice(0, this.limit);
  }

  clear(): void {
    this.events = [];
    this.cooldowns.clear();
  }
}
