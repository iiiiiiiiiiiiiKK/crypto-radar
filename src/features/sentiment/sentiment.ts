import type { MarketTicker } from "@/types/market";

export type SentimentKey = "fomo" | "greed" | "chop" | "fear" | "panic" | "illiquid";

export interface SentimentInput {
  tickers: MarketTicker[];
  /** Include the funding signal (perpetual markets only). */
  withFunding?: boolean;
}

export interface SentimentFactor {
  /** i18n key suffix, e.g. `breadth`. */
  key: string;
  value: number;
  /** Human readable formatting hint: percent, ratio, usd or score. */
  format: "percent" | "ratio" | "usd" | "score";
}

export interface SentimentResult {
  key: SentimentKey;
  /** 0 (extreme fear) … 100 (extreme greed). */
  score: number;
  breadth: number;
  avgChange: number;
  medianAbsChange: number;
  turnover: number;
  fundingExtremeShare: number;
  factors: SentimentFactor[];
}

const ILLIQUID_TURNOVER = 50_000_000; // 50M USDT across the scanned market
const ILLIQUID_MOVE = 0.6; // median absolute 24h change in percent
const FUNDING_EXTREME = 0.0005; // 0.05% per 8h

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Turns the live ticker list into a single market mood.
 *
 * The rules are fixed and every state is derived from numbers the UI can also
 * show, so the mood can always be explained:
 *
 *  1. **illiquid** — the scanned market trades under 50M USDT and the median
 *     absolute 24 h move is under 0.6%. Nothing is happening.
 *  2. **fomo** — average change >= +3% *and* at least 70% of pairs are up.
 *  3. **panic** — average change <= -3% *and* at least 70% of pairs are down.
 *  4. Otherwise the 0-100 score decides: >=60 greed, 40-60 chop, 25-40 fear,
 *     <25 panic.
 *
 * The score is 50 plus three capped terms: the average change (weight 4, max
 * ±20), the breadth deviation from 50% (weight 60, max ±25) and the funding
 * extreme share (weight 30, max ±10). Every term is reported as a factor.
 */
export function computeSentiment({ tickers, withFunding = false }: SentimentInput): SentimentResult {
  const usable = tickers.filter(
    (ticker) => Number.isFinite(ticker.priceChangePercent) && ticker.price > 0,
  );

  if (usable.length === 0) {
    return {
      key: "illiquid",
      score: 50,
      breadth: 0,
      avgChange: 0,
      medianAbsChange: 0,
      turnover: 0,
      fundingExtremeShare: 0,
      factors: [],
    };
  }

  const up = usable.filter((ticker) => ticker.priceChangePercent > 0).length;
  const down = usable.filter((ticker) => ticker.priceChangePercent < 0).length;
  const breadth = up / Math.max(1, up + down);
  const avgChange =
    usable.reduce((sum, ticker) => sum + ticker.priceChangePercent, 0) / usable.length;
  const medianAbsChange = median(usable.map((ticker) => Math.abs(ticker.priceChangePercent)));
  const turnover = usable.reduce((sum, ticker) => sum + (ticker.quoteVolume24h ?? 0), 0);

  const fundingRows = withFunding
    ? usable.filter((ticker) => ticker.fundingRate !== null)
    : [];
  const fundingExtremeShare =
    fundingRows.length === 0
      ? 0
      : fundingRows.filter((ticker) => Math.abs(ticker.fundingRate ?? 0) >= FUNDING_EXTREME).length /
        fundingRows.length;

  const changeTerm = clamp(avgChange * 4, -20, 20);
  const breadthTerm = clamp((breadth - 0.5) * 60, -25, 25);
  const fundingTerm = clamp((fundingExtremeShare - 0.15) * 30, -10, 10);
  const score = Math.round(clamp(50 + changeTerm + breadthTerm + fundingTerm, 0, 100));

  const factors: SentimentFactor[] = [
    { key: "breadth", value: breadth * 100, format: "ratio" },
    { key: "avgChange", value: avgChange, format: "percent" },
    { key: "medianMove", value: medianAbsChange, format: "percent" },
    { key: "turnover", value: turnover, format: "usd" },
    { key: "score", value: score, format: "score" },
  ];
  if (withFunding && fundingRows.length > 0) {
    factors.push({ key: "fundingExtreme", value: fundingExtremeShare * 100, format: "ratio" });
  }

  let key: SentimentKey;
  if (turnover < ILLIQUID_TURNOVER && medianAbsChange < ILLIQUID_MOVE) {
    key = "illiquid";
  } else if (avgChange >= 3 && breadth >= 0.7) {
    key = "fomo";
  } else if (avgChange <= -3 && breadth <= 0.3) {
    key = "panic";
  } else if (score >= 60) {
    key = "greed";
  } else if (score >= 40) {
    key = "chop";
  } else if (score >= 25) {
    key = "fear";
  } else {
    key = "panic";
  }

  return {
    key,
    score,
    breadth: breadth * 100,
    avgChange,
    medianAbsChange,
    turnover,
    fundingExtremeShare: fundingExtremeShare * 100,
    factors,
  };
}
