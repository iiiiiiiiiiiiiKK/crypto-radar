import type { Comparator, MarketId, MetricId, MetricWindow, TickerRow } from "@/types/market";
import { METRIC_LABEL, WINDOW_LABEL } from "@/types/market";
import { compare, readMetric } from "./metrics";

export interface ScanCondition {
  metric: MetricId;
  window: MetricWindow;
  comparator: Comparator;
  value: number;
}

export type ScanSort = "trigger" | "changeDesc" | "turnoverDesc";

export interface ScanRule {
  id: string;
  name: string;
  markets: MarketId[];
  logic: "and" | "or";
  conditions: ScanCondition[];
  /** 24 h quote turnover floor in USDT (0 disables the filter). */
  minTurnover: number;
  onlyWatchlist: boolean;
  limit: number;
  sortBy: ScanSort;
  /** Milliseconds a row may be older than "now" and still be scanned. */
  maxAgeMs: number;
}

export interface ScanHit {
  row: TickerRow;
  triggers: Array<{ label: string; value: string }>;
  score: number;
  age: number;
}

export interface ScanResult {
  hits: ScanHit[];
  evaluated: number;
  /** Rows skipped because a required metric was not yet measurable. */
  missing: number;
  scannedAt: number;
}

export const SCAN_PRESETS: ScanRule[] = [
  {
    id: "pump-5m",
    name: "5 分钟急拉",
    markets: ["spot", "futures"],
    logic: "and",
    conditions: [{ metric: "change", window: "5m", comparator: "gte", value: 3 }],
    minTurnover: 200_000,
    onlyWatchlist: false,
    limit: 40,
    sortBy: "trigger",
    maxAgeMs: 60_000,
  },
  {
    id: "dump-5m",
    name: "5 分钟跳水",
    markets: ["spot", "futures"],
    logic: "and",
    conditions: [{ metric: "change", window: "5m", comparator: "lte", value: -3 }],
    minTurnover: 200_000,
    onlyWatchlist: false,
    limit: 40,
    sortBy: "trigger",
    maxAgeMs: 60_000,
  },
  {
    id: "volume-burst",
    name: "成交额爆量",
    markets: ["spot", "futures"],
    logic: "and",
    conditions: [{ metric: "volumeSurge", window: "5m", comparator: "gte", value: 3 }],
    minTurnover: 300_000,
    onlyWatchlist: false,
    limit: 40,
    sortBy: "trigger",
    maxAgeMs: 60_000,
  },
  {
    id: "funding-extreme",
    name: "资金费率极端",
    markets: ["futures"],
    logic: "and",
    conditions: [{ metric: "funding", window: "24h", comparator: "absGte", value: 0.05 }],
    minTurnover: 500_000,
    onlyWatchlist: false,
    limit: 40,
    sortBy: "trigger",
    maxAgeMs: 120_000,
  },
  {
    id: "oi-jump",
    name: "持仓量异动",
    markets: ["futures"],
    logic: "and",
    conditions: [{ metric: "oiChange", window: "15m", comparator: "absGte", value: 5 }],
    minTurnover: 500_000,
    onlyWatchlist: false,
    limit: 40,
    sortBy: "trigger",
    maxAgeMs: 180_000,
  },
  {
    id: "price-volume",
    name: "多指标共振",
    markets: ["spot", "futures"],
    logic: "and",
    conditions: [
      { metric: "change", window: "5m", comparator: "gte", value: 2 },
      { metric: "volumeSurge", window: "5m", comparator: "gte", value: 2 },
    ],
    minTurnover: 300_000,
    onlyWatchlist: false,
    limit: 40,
    sortBy: "trigger",
    maxAgeMs: 60_000,
  },
  {
    id: "divergence",
    name: "量价背离",
    markets: ["spot", "futures"],
    logic: "and",
    conditions: [
      { metric: "change", window: "15m", comparator: "gte", value: 2 },
      { metric: "volumeSurge", window: "15m", comparator: "lte", value: 0.6 },
    ],
    minTurnover: 300_000,
    onlyWatchlist: false,
    limit: 40,
    sortBy: "trigger",
    maxAgeMs: 60_000,
  },
];

export const DEFAULT_SCAN_RULE: ScanRule = SCAN_PRESETS[0];

/**
 * Runs one rule over the live rows.
 *
 * A condition whose metric cannot be measured yet (not enough history, a
 * missing funding value, ...) never passes, and the row is counted as `missing`
 * so the UI can explain why a scan looks empty.
 */
export function runScan(
  rows: TickerRow[],
  rule: ScanRule,
  options: { watchKeys?: Set<string>; now?: number } = {},
): ScanResult {
  const now = options.now ?? Date.now();
  const watchKeys = options.watchKeys;
  const hits: ScanHit[] = [];
  let evaluated = 0;
  let missing = 0;

  for (const row of rows) {
    if (!rule.markets.includes(row.market)) continue;
    if (now - row.receivedAt > rule.maxAgeMs) continue;
    if (rule.minTurnover > 0 && (row.quoteVolume24h ?? 0) < rule.minTurnover) continue;
    if (rule.onlyWatchlist && watchKeys && !watchKeys.has(row.key)) continue;

    evaluated += 1;

    const triggers: ScanHit["triggers"] = [];
    const scores: number[] = [];
    let matched = 0;
    let undecidable = 0;

    for (const condition of rule.conditions) {
      const value = readMetric(row, condition.metric, condition.window);
      if (value === null) {
        undecidable += 1;
        continue;
      }
      if (compare(value, condition.comparator, condition.value)) {
        matched += 1;
        scores.push(
          condition.value === 0 ? Math.abs(value) : Math.abs(value / condition.value),
        );
        triggers.push({
          label: `${METRIC_LABEL[condition.metric]}·${WINDOW_LABEL[condition.window]}`,
          value: formatTrigger(condition.metric, value),
        });
      }
    }

    if (undecidable > 0 && matched === 0) {
      missing += 1;
      continue;
    }

    const passes =
      rule.conditions.length === 0
        ? false
        : rule.logic === "and"
          ? matched === rule.conditions.length
          : matched > 0;
    if (!passes) continue;

    const score = scores.length > 0 ? Math.max(...scores) : 0;
    hits.push({ row, triggers, score, age: now - row.receivedAt });
  }

  hits.sort((a, b) => {
    if (rule.sortBy === "changeDesc") {
      return (b.row.changePercent ?? -1e9) - (a.row.changePercent ?? -1e9);
    }
    if (rule.sortBy === "turnoverDesc") {
      return (b.row.quoteVolume24h ?? 0) - (a.row.quoteVolume24h ?? 0);
    }
    return b.score - a.score;
  });

  return { hits: hits.slice(0, rule.limit), evaluated, missing, scannedAt: now };
}

function formatTrigger(metric: MetricId, value: number): string {
  switch (metric) {
    case "change":
    case "absChange":
    case "oiChange":
    case "volatility":
      return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
    case "funding":
      return `${value >= 0 ? "+" : ""}${value.toFixed(4)}%`;
    case "volumeSurge":
      return `${value.toFixed(2)}×`;
    case "turnover":
      return `${value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toFixed(0)}/min`;
    default:
      return value.toFixed(2);
  }
}

/** Human readable summary of a rule, used in the scanner panel and the results header. */
export function describeRule(rule: ScanRule): string {
  if (rule.conditions.length === 0) return "尚未添加任何条件";
  const joiner = rule.logic === "and" ? " 且 " : " 或 ";
  return rule.conditions
    .map((condition) => {
      const comparator =
        condition.comparator === "gte" ? "≥" : condition.comparator === "lte" ? "≤" : "|x| ≥";
      const unit =
        condition.metric === "volumeSurge"
          ? "×"
          : condition.metric === "turnover"
            ? " USDT/分"
            : "%";
      return `${METRIC_LABEL[condition.metric]}(${WINDOW_LABEL[condition.window]}) ${comparator} ${
        condition.value
      }${unit}`;
    })
    .join(joiner);
}
