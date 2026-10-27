import type { MarketId, TickerRow } from "@/types/market";

export type EventRuleId =
  | "pump-1m"
  | "dump-1m"
  | "pump-5m"
  | "dump-5m"
  | "volume-burst"
  | "funding-extreme"
  | "oi-jump"
  | "divergence-up"
  | "divergence-down"
  | "combo"
  | "new-high"
  | "new-low";

export type EventTone = "up" | "down" | "vol" | "funding";
export type EventSeverity = "info" | "warn" | "critical";

export interface EventThresholds {
  /** 1 minute move that already looks violent, in percent. */
  flashPercent: number;
  /** 5 minute move worth broadcasting, in percent. */
  surgePercent: number;
  /** Turnover pace versus the 15 minute baseline. */
  volumeSurge: number;
  /** Absolute funding rate per settlement, in percent. */
  fundingPercent: number;
  /** Absolute open interest change over ~10 minutes, in percent. */
  oiPercent: number;
  /** 15 minute move used by the divergence rules, in percent. */
  divergencePercent: number;
  /** Below this turnover ratio a move counts as "volume is not following". */
  quietSurge: number;
  /** 24 hour quote turnover floor (USDT) — filters dust pairs out. */
  minTurnover: number;
  /** Per minute turnover floor (USDT). */
  minTurnoverRate: number;
  /** Milliseconds before the same rule may fire again on the same pair. */
  cooldownMs: number;
  /** Upper bound of events produced by a single scan pass. */
  maxPerTick: number;
}

export const DEFAULT_EVENT_THRESHOLDS: EventThresholds = {
  flashPercent: 1.2,
  surgePercent: 3,
  volumeSurge: 3,
  fundingPercent: 0.05,
  oiPercent: 5,
  divergencePercent: 2,
  quietSurge: 0.6,
  minTurnover: 300_000,
  minTurnoverRate: 2_000,
  cooldownMs: 120_000,
  maxPerTick: 10,
};

export interface MarketEvent {
  id: string;
  ruleId: EventRuleId;
  tone: EventTone;
  severity: EventSeverity;
  market: MarketId;
  key: string;
  symbol: string;
  base: string;
  quote: string;
  /** Short headline, e.g. "5 分钟拉升". */
  title: string;
  /** Sentence with the measured numbers that fired the rule. */
  why: string;
  chips: Array<{ label: string; value: string }>;
  /** Magnitude that triggered the rule, in the unit of the rule. */
  value: number;
  price: number | null;
  changePercent: number | null;
  createdAt: number;
}

export const RULE_TITLES: Record<EventRuleId, string> = {
  "pump-1m": "1 分钟急拉",
  "dump-1m": "1 分钟砸盘",
  "pump-5m": "5 分钟拉升",
  "dump-5m": "5 分钟跳水",
  "volume-burst": "成交额爆量",
  "funding-extreme": "资金费率极端",
  "oi-jump": "持仓量异动",
  "divergence-up": "量价背离（价涨量缩）",
  "divergence-down": "放量下跌",
  combo: "多指标共振",
  "new-high": "逼近 24h 新高",
  "new-low": "逼近 24h 新低",
};

export const RULE_GLYPH: Record<EventRuleId, string> = {
  "pump-1m": "▲",
  "dump-1m": "▼",
  "pump-5m": "△",
  "dump-5m": "▽",
  "volume-burst": "≋",
  "funding-extreme": "◷",
  "oi-jump": "◎",
  "divergence-up": "≢",
  "divergence-down": "≣",
  combo: "✦",
  "new-high": "↥",
  "new-low": "↧",
};

function compact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(0);
}

function severity(ratio: number): EventSeverity {
  if (ratio >= 2.2) return "critical";
  if (ratio >= 1.4) return "warn";
  return "info";
}

export interface DetectContext {
  thresholds: EventThresholds;
  now: number;
  /** Cooldown lookup, owned by the EventLog. */
  isCoolingDown: (ruleId: EventRuleId, key: string) => boolean;
}

function baseEvent(row: TickerRow, ctx: DetectContext, ruleId: EventRuleId, tone: EventTone) {
  return {
    id: `${ruleId}:${row.key}:${Math.floor(ctx.now / ctx.thresholds.cooldownMs)}`,
    ruleId,
    tone,
    market: row.market,
    key: row.key,
    symbol: row.symbol,
    base: row.base,
    quote: row.quote,
    price: row.price,
    changePercent: row.changePercent,
    createdAt: ctx.now,
  };
}

/**
 * Turns the live rows into market events.
 *
 * Every rule compares two real numbers and carries those numbers into the event
 * payload, so the UI can always answer "why did this fire?". Rows without a
 * fresh measurement simply cannot fire.
 */
export function detectEvents(rows: TickerRow[], ctx: DetectContext): MarketEvent[] {
  const out: MarketEvent[] = [];
  const t = ctx.thresholds;

  for (const row of rows) {
    if (row.price === null || row.price <= 0) continue;
    if (ctx.now - row.receivedAt > 45_000) continue; // stale rows never fire
    const turnover = row.quoteVolume24h;
    if (turnover !== null && turnover < t.minTurnover) continue;

    const { m1, m5, m15, volumeSurge, turnoverPerMin, oiChange } = row.d;
    const rateOk = turnoverPerMin !== null && turnoverPerMin >= t.minTurnoverRate;

    // ---- 1 minute flash -------------------------------------------------
    if (m1 !== null && Math.abs(m1) >= t.flashPercent && rateOk) {
      const ruleId: EventRuleId = m1 > 0 ? "pump-1m" : "dump-1m";
      if (!ctx.isCoolingDown(ruleId, row.key)) {
        out.push({
          ...baseEvent(row, ctx, ruleId, m1 > 0 ? "up" : "down"),
          severity: severity(Math.abs(m1) / t.flashPercent),
          title: RULE_TITLES[ruleId],
          why: `1 分钟${m1 > 0 ? "拉升" : "下跌"} ${Math.abs(m1).toFixed(2)}%，近 1 分钟成交额 ${compact(
            turnoverPerMin ?? 0,
          )} USDT。`,
          chips: [
            { label: "1m", value: `${m1 >= 0 ? "+" : ""}${m1.toFixed(2)}%` },
            { label: "成交额/分", value: compact(turnoverPerMin ?? 0) },
          ],
          value: Math.abs(m1),
        });
      }
    }

    // ---- 5 minute surge -------------------------------------------------
    if (m5 !== null && Math.abs(m5) >= t.surgePercent) {
      const ruleId: EventRuleId = m5 > 0 ? "pump-5m" : "dump-5m";
      if (!ctx.isCoolingDown(ruleId, row.key)) {
        out.push({
          ...baseEvent(row, ctx, ruleId, m5 > 0 ? "up" : "down"),
          severity: severity(Math.abs(m5) / t.surgePercent),
          title: RULE_TITLES[ruleId],
          why: `5 分钟${m5 > 0 ? "上涨" : "下跌"} ${Math.abs(m5).toFixed(2)}%${
            volumeSurge !== null
              ? `，成交额 ${volumeSurge.toFixed(2)}× 基准${volumeSurge >= 2 ? "（同步放大）" : ""}`
              : ""
          }。`,
          chips: [
            { label: "5m", value: `${m5 >= 0 ? "+" : ""}${m5.toFixed(2)}%` },
            ...(volumeSurge !== null
              ? [{ label: "量能", value: `${volumeSurge.toFixed(2)}×` }]
              : []),
          ],
          value: Math.abs(m5),
        });
      }
    }

    // ---- turnover burst -------------------------------------------------
    if (volumeSurge !== null && volumeSurge >= t.volumeSurge && turnoverPerMin !== null) {
      if (!ctx.isCoolingDown("volume-burst", row.key)) {
        out.push({
          ...baseEvent(row, ctx, "volume-burst", "vol"),
          severity: severity(volumeSurge / t.volumeSurge),
          title: RULE_TITLES["volume-burst"],
          why: `成交额达到 15 分钟基准的 ${volumeSurge.toFixed(2)}×（当前 ${compact(
            turnoverPerMin,
          )} USDT/分钟）。`,
          chips: [
            { label: "量能", value: `${volumeSurge.toFixed(2)}×` },
            { label: "成交额/分", value: compact(turnoverPerMin) },
          ],
          value: volumeSurge,
        });
      }
    }

    // ---- funding rate ---------------------------------------------------
    if (row.fundingRate !== null) {
      const fundingPercent = Math.abs(row.fundingRate * 100);
      if (fundingPercent >= t.fundingPercent && !ctx.isCoolingDown("funding-extreme", row.key)) {
        out.push({
          ...baseEvent(row, ctx, "funding-extreme", "funding"),
          severity: severity(fundingPercent / t.fundingPercent),
          title: RULE_TITLES["funding-extreme"],
          why: `当前资金费率 ${fundingPercent.toFixed(4)}%${
            row.fundingRate > 0 ? "（多头付费）" : "（空头付费）"
          }，超过 ${t.fundingPercent}% 阈值。`,
          chips: [
            { label: "资金费率", value: `${row.fundingRate > 0 ? "+" : ""}${fundingPercent.toFixed(4)}%` },
            ...(row.markPrice !== null && row.price !== null
              ? [
                  {
                    label: "标记/最新",
                    value: `${((row.markPrice / row.price - 1) * 100).toFixed(3)}%`,
                  },
                ]
              : []),
          ],
          value: fundingPercent,
        });
      }
    }

    // ---- open interest --------------------------------------------------
    if (oiChange !== null && Math.abs(oiChange) >= t.oiPercent) {
      if (!ctx.isCoolingDown("oi-jump", row.key) && row.openInterest !== null) {
        out.push({
          ...baseEvent(row, ctx, "oi-jump", oiChange > 0 ? "up" : "down"),
          severity: severity(Math.abs(oiChange) / t.oiPercent),
          title: RULE_TITLES["oi-jump"],
          why: `持仓量 ${oiChange > 0 ? "增加" : "减少"} ${Math.abs(oiChange).toFixed(2)}%（当前 ${compact(
            row.openInterest,
          )}）。`,
          chips: [
            { label: "OI 变化", value: `${oiChange >= 0 ? "+" : ""}${oiChange.toFixed(2)}%` },
            { label: "OI", value: compact(row.openInterest) },
          ],
          value: Math.abs(oiChange),
        });
      }
    }

    // ---- divergence: price up, volume shrinking -------------------------
    if (
      m15 !== null &&
      m15 >= t.divergencePercent &&
      volumeSurge !== null &&
      volumeSurge <= t.quietSurge
    ) {
      if (!ctx.isCoolingDown("divergence-up", row.key)) {
        out.push({
          ...baseEvent(row, ctx, "divergence-up", "vol"),
          severity: "warn",
          title: RULE_TITLES["divergence-up"],
          why: `15 分钟上涨 ${m15.toFixed(2)}%，但成交额只有基准的 ${volumeSurge.toFixed(2)}×，量能没有跟上。`,
          chips: [
            { label: "15m", value: `+${m15.toFixed(2)}%` },
            { label: "量能", value: `${volumeSurge.toFixed(2)}×` },
          ],
          value: m15,
        });
      }
    }

    // ---- divergence: price down, volume exploding -----------------------
    if (
      m15 !== null &&
      m15 <= -t.divergencePercent &&
      volumeSurge !== null &&
      volumeSurge >= 2
    ) {
      if (!ctx.isCoolingDown("divergence-down", row.key)) {
        out.push({
          ...baseEvent(row, ctx, "divergence-down", "down"),
          severity: severity(volumeSurge / 2),
          title: RULE_TITLES["divergence-down"],
          why: `15 分钟下跌 ${Math.abs(m15).toFixed(2)}%，成交额放大到 ${volumeSurge.toFixed(2)}×，抛压在加速。`,
          chips: [
            { label: "15m", value: `${m15.toFixed(2)}%` },
            { label: "量能", value: `${volumeSurge.toFixed(2)}×` },
          ],
          value: Math.abs(m15),
        });
      }
    }

    // ---- combination: move + volume together ----------------------------
    if (
      m5 !== null &&
      m5 >= t.surgePercent * 0.6 &&
      volumeSurge !== null &&
      volumeSurge >= 2
    ) {
      if (!ctx.isCoolingDown("combo", row.key)) {
        out.push({
          ...baseEvent(row, ctx, "combo", "up"),
          severity: severity((m5 / t.surgePercent + volumeSurge / 2) / 2),
          title: RULE_TITLES.combo,
          why: `5 分钟上涨 ${m5.toFixed(2)}% 且成交额 ${volumeSurge.toFixed(2)}× 基准，价格与量能同时异动。`,
          chips: [
            { label: "5m", value: `+${m5.toFixed(2)}%` },
            { label: "量能", value: `${volumeSurge.toFixed(2)}×` },
          ],
          value: m5,
        });
      }
    }

    // ---- 24h extreme ----------------------------------------------------
    if (
      row.high24h !== null &&
      row.high24h > 0 &&
      row.changePercent !== null &&
      row.changePercent >= 3 &&
      (row.high24h - row.price) / row.high24h <= 0.0015 &&
      !ctx.isCoolingDown("new-high", row.key)
    ) {
      out.push({
        ...baseEvent(row, ctx, "new-high", "up"),
        severity: "info",
        title: RULE_TITLES["new-high"],
        why: `价格距 24h 最高价仅 ${(((row.high24h - row.price) / row.high24h) * 100).toFixed(
          2,
        )}%，24h 涨幅 ${row.changePercent.toFixed(2)}%。`,
        chips: [{ label: "24h", value: `+${row.changePercent.toFixed(2)}%` }],
        value: row.changePercent,
      });
    }

    if (
      row.low24h !== null &&
      row.low24h > 0 &&
      row.changePercent !== null &&
      row.changePercent <= -3 &&
      (row.price - row.low24h) / row.low24h <= 0.0015 &&
      !ctx.isCoolingDown("new-low", row.key)
    ) {
      out.push({
        ...baseEvent(row, ctx, "new-low", "down"),
        severity: "info",
        title: RULE_TITLES["new-low"],
        why: `价格距 24h 最低价仅 ${(((row.price - row.low24h) / row.low24h) * 100).toFixed(
          2,
        )}%，24h 跌幅 ${row.changePercent.toFixed(2)}%。`,
        chips: [{ label: "24h", value: `${row.changePercent.toFixed(2)}%` }],
        value: Math.abs(row.changePercent),
      });
    }
  }

  const rank = { critical: 3, warn: 2, info: 1 } as const;
  return out
    .sort((a, b) => rank[b.severity] - rank[a.severity] || b.value - a.value)
    .slice(0, t.maxPerTick);
}

/**
 * Bounded event log with per-rule cooldowns and id based de-duplication, so a
 * websocket reconnect cannot replay the same event dozens of times.
 */
export class EventLog {
  private events: MarketEvent[] = [];
  private cooldowns = new Map<string, number>();
  private seen = new Set<string>();
  private listeners = new Set<() => void>();
  private version = 0;

  constructor(
    private thresholds: EventThresholds = DEFAULT_EVENT_THRESHOLDS,
    private limit = 160,
  ) {}

  get all(): MarketEvent[] {
    return this.events;
  }

  get currentVersion(): number {
    return this.version;
  }

  setThresholds(thresholds: EventThresholds): void {
    this.thresholds = thresholds;
  }

  isCoolingDown = (ruleId: EventRuleId, key: string, at = Date.now()): boolean => {
    const last = this.cooldowns.get(`${ruleId}:${key}`);
    if (last === undefined) return false;
    return at - last < this.thresholds.cooldownMs;
  };

  push(events: MarketEvent[]): void {
    const fresh: MarketEvent[] = [];
    for (const event of events) {
      if (this.seen.has(event.id)) continue;
      this.seen.add(event.id);
      this.cooldowns.set(`${event.ruleId}:${event.key}`, event.createdAt);
      fresh.push(event);
    }
    if (fresh.length === 0) return;
    if (this.seen.size > 1200) {
      // Keep the dedupe set bounded without losing the recent window.
      const keep = new Set<string>();
      for (const event of [...fresh, ...this.events].slice(0, 400)) keep.add(event.id);
      this.seen = keep;
    }
    this.events = [...fresh, ...this.events].slice(0, this.limit);
    this.version += 1;
    for (const listener of this.listeners) listener();
  }

  clear(): void {
    this.events = [];
    this.cooldowns.clear();
    this.seen.clear();
    this.version += 1;
    for (const listener of this.listeners) listener();
  }

  /** Arrow property: it is handed to React as a bare reference. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
}
