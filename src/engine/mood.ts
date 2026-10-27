import type { MarketId, TickerRow } from "@/types/market";

/** Which market state the mood is describing. */
export interface MoodEvidence {
  label: string;
  value: string;
}

export type MoodLevel =
  | "insufficient"
  | "flat"
  | "bull"
  | "fomo"
  | "chaos"
  | "bear"
  | "capitulation";

export interface MoodReading {
  level: MoodLevel;
  label: string;
  sub: string;
  tone: "up" | "down" | "flat" | "warn";
  evidence: MoodEvidence[];
  sample: number;
  breadth: number | null;
  medianChange: number | null;
  avgAbsMove: number | null;
  turnover24h: number | null;
  fundingMedian: number | null;
  updatedAt: number;
}

const LABELS: Record<MoodLevel, { label: string; sub: string; tone: MoodReading["tone"] }> = {
  insufficient: {
    label: "数据不足",
    sub: "行情源正在接入，先别急着下结论",
    tone: "flat",
  },
  flat: {
    label: "全场装死",
    sub: "涨跌家数接近，成交量在打哈欠",
    tone: "flat",
  },
  bull: {
    label: "多头开始发疯",
    sub: "多数交易对翻红，但还没到失控",
    tone: "up",
  },
  fomo: {
    label: "FOMO 全场点火",
    sub: "上涨家数占绝对多数，追高注意风险",
    tone: "up",
  },
  chaos: {
    label: "高波动战区",
    sub: "短周期波动放大，滑点与插针风险上升",
    tone: "warn",
  },
  bear: {
    label: "空头正在打人",
    sub: "下跌家数占多数，反弹容易被砸",
    tone: "down",
  },
  capitulation: {
    label: "多头被抬走",
    sub: "大面积下跌，注意连锁清算",
    tone: "down",
  },
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function compact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(0);
}

/**
 * Rule based market mood.
 *
 * Every branch is driven by measurable breadth and volatility numbers that are
 * shown next to the verdict, so a funny label can never hide the fact that it
 * is a heuristic description of the current market — not a forecast.
 */
export function computeMood(rows: TickerRow[], now = Date.now()): MoodReading {
  const priced = rows.filter(
    (row) => row.price !== null && row.changePercent !== null && now - row.receivedAt < 120_000,
  );

  const changes = priced
    .map((row) => row.changePercent)
    .filter((value): value is number => value !== null);
  const advancers = changes.filter((value) => value > 0).length;
  const decliners = changes.filter((value) => value < 0).length;
  const breadth =
    advancers + decliners === 0 ? null : (advancers / (advancers + decliners)) * 100;

  const moves = priced
    .map((row) => row.d.vol15m)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const avgAbsMove = moves.length >= 20 ? median(moves) : null;

  const turnoverValues = priced
    .map((row) => row.quoteVolume24h)
    .filter((value): value is number => value !== null && value > 0);
  const turnover24h =
    turnoverValues.length > 0 ? turnoverValues.reduce((a, b) => a + b, 0) : null;

  const funding = priced
    .filter((row) => row.market === "futures" && row.fundingRate !== null)
    .map((row) => (row.fundingRate as number) * 100);
  const fundingMedian = funding.length >= 5 ? median(funding) : null;

  const evidence: MoodEvidence[] = [];
  if (breadth !== null) {
    evidence.push({ label: "上涨占比", value: `${breadth.toFixed(1)}%` });
    evidence.push({ label: "涨/跌", value: `${advancers}/${decliners}` });
  }
  const medianChange = median(changes);
  if (medianChange !== null) {
    evidence.push({ label: "中位涨跌", value: `${medianChange >= 0 ? "+" : ""}${medianChange.toFixed(2)}%` });
  }
  if (avgAbsMove !== null) {
    evidence.push({ label: "15m 平均波动", value: `${avgAbsMove.toFixed(2)}%` });
  }
  if (turnover24h !== null) {
    evidence.push({ label: "24h 成交额", value: compact(turnover24h) });
  }
  if (fundingMedian !== null) {
    evidence.push({ label: "资金费率中位", value: `${fundingMedian >= 0 ? "+" : ""}${fundingMedian.toFixed(4)}%` });
  }

  let level: MoodLevel = "insufficient";
  if (changes.length >= 40 && breadth !== null) {
    const extremeShare =
      changes.filter((value) => Math.abs(value) >= 8).length / Math.max(1, changes.length);
    const hot = (avgAbsMove ?? 0) >= 0.8 || extremeShare >= 0.2;

    if (hot && (avgAbsMove ?? 0) >= 1.2) level = "chaos";
    else if (breadth >= 68) level = "fomo";
    else if (breadth >= 56) level = "bull";
    else if (hot) level = "chaos";
    else if (breadth <= 32) level = "capitulation";
    else if (breadth <= 44) level = "bear";
    else level = "flat";
  }

  const meta = LABELS[level];
  return {
    level,
    label: meta.label,
    sub: meta.sub,
    tone: meta.tone,
    evidence,
    sample: changes.length,
    breadth,
    medianChange,
    avgAbsMove,
    turnover24h,
    fundingMedian,
    updatedAt: now,
  };
}

export function moodScopeLabel(markets: MarketId[]): string {
  if (markets.length === 0) return "未接入市场";
  if (markets.every((market) => market === "spot" || market === "futures")) {
    return "币安现货 + U 本位永续";
  }
  return "已接入的币安市场";
}
