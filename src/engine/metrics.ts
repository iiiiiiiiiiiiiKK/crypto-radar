import type {
  Comparator,
  MetricId,
  MetricWindow,
  TickerRow,
} from "@/types/market";

/**
 * Reads one metric for one row. Every value is either a real measurement or
 * `null` — the UI shows "数据不足" instead of inventing a number.
 */
export function readMetric(
  row: TickerRow,
  metric: MetricId,
  window: MetricWindow,
): number | null {
  switch (metric) {
    case "change": {
      const change = windowChange(row, window);
      return change;
    }
    case "absChange": {
      const change = windowChange(row, window);
      return change === null ? null : Math.abs(change);
    }
    case "turnover":
      return row.d.turnoverPerMin;
    case "volumeSurge":
      return row.d.volumeSurge;
    case "funding":
      return row.fundingRate === null ? null : row.fundingRate * 100;
    case "oiChange":
      return row.d.oiChange;
    case "volatility":
      return row.d.vol15m;
    default:
      return null;
  }
}

export function windowChange(row: TickerRow, window: MetricWindow): number | null {
  switch (window) {
    case "1m":
      return row.d.m1;
    case "5m":
      return row.d.m5;
    case "15m":
      return row.d.m15;
    case "1h":
      return row.d.h1;
    case "24h":
      return row.changePercent;
    default:
      return null;
  }
}

export function compare(value: number, comparator: Comparator, threshold: number): boolean {
  switch (comparator) {
    case "gte":
      return value >= threshold;
    case "lte":
      return value <= threshold;
    case "absGte":
      return Math.abs(value) >= Math.abs(threshold);
    default:
      return false;
  }
}

/** Metrics that make sense for a market (funding/OI only exist on perpetuals). */
export function metricAvailable(market: string, metric: MetricId): boolean {
  if (metric === "funding" || metric === "oiChange") return market === "futures";
  if (metric === "volumeSurge" || metric === "turnover") return market !== "alpha";
  return true;
}

export function formatMetric(metric: MetricId, value: number | null): string {
  if (value === null) return "数据不足";
  switch (metric) {
    case "change":
    case "absChange":
    case "volatility":
      return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
    case "funding":
      return `${value >= 0 ? "+" : ""}${value.toFixed(4)}%`;
    case "oiChange":
      return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
    case "volumeSurge":
      return `${value.toFixed(2)}×`;
    case "turnover":
      return `${formatTurnover(value)}/min`;
    default:
      return value.toFixed(2);
  }
}

function formatTurnover(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(0);
}
