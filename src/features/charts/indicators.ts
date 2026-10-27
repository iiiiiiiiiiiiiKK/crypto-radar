/**
 * Technical indicators, computed locally from the candles the exchange returns.
 *
 * These are our own calculations — the UI labels them as such and never implies
 * that Binance publishes them.
 */

export type Series = Array<number | null>;

export function sma(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null);
  if (period <= 0) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null);
  if (period <= 0 || values.length === 0) return out;
  const k = 2 / (period + 1);
  let previous: number | null = null;
  for (let i = 0; i < values.length; i += 1) {
    if (i < period - 1) continue;
    if (previous === null) {
      let sum = 0;
      for (let j = 0; j < period; j += 1) sum += values[j];
      previous = sum / period;
    } else {
      previous = values[i] * k + previous * (1 - k);
    }
    out[i] = previous;
  }
  return out;
}

/** Relative Strength Index with Wilder smoothing. */
export function rsi(values: number[], period = 14): Series {
  const out: Series = new Array(values.length).fill(null);
  if (values.length <= period) return out;

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i += 1) {
    const change = values[i] - values[i - 1];
    if (change >= 0) gainSum += change;
    else lossSum -= change;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  out[period] = rsiFrom(avgGain, avgLoss);

  for (let i = period + 1; i < values.length; i += 1) {
    const change = values[i] - values[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = rsiFrom(avgGain, avgLoss);
  }
  return out;
}

function rsiFrom(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function macd(
  values: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): { macd: Series; signal: Series; histogram: Series } {
  const fast = ema(values, fastPeriod);
  const slow = ema(values, slowPeriod);
  const macdLine: Series = values.map((_, index) =>
    fast[index] !== null && slow[index] !== null ? (fast[index] as number) - (slow[index] as number) : null,
  );

  const compact: number[] = [];
  const indexMap: number[] = [];
  macdLine.forEach((value, index) => {
    if (value !== null) {
      compact.push(value);
      indexMap.push(index);
    }
  });

  const signalCompact = ema(compact, signalPeriod);
  const signal: Series = new Array(values.length).fill(null);
  signalCompact.forEach((value, index) => {
    if (value !== null) signal[indexMap[index]] = value;
  });

  const histogram: Series = values.map((_, index) => {
    const m = macdLine[index];
    const s = signal[index];
    if (m === null || s === null) return null;
    return m - s;
  });

  return { macd: macdLine, signal, histogram };
}

export function bollinger(
  values: number[],
  period = 20,
  multiplier = 2,
): { upper: Series; middle: Series; lower: Series } {
  const middle = sma(values, period);
  const upper: Series = new Array(values.length).fill(null);
  const lower: Series = new Array(values.length).fill(null);

  for (let i = 0; i < values.length; i += 1) {
    const mid = middle[i];
    if (mid === null) continue;
    let variance = 0;
    for (let j = i - period + 1; j <= i; j += 1) variance += (values[j] - mid) ** 2;
    const deviation = Math.sqrt(variance / period);
    upper[i] = mid + deviation * multiplier;
    lower[i] = mid - deviation * multiplier;
  }

  return { upper, middle, lower };
}

export interface LinePoint {
  time: number;
  value: number;
}

/** Converts a candle-aligned series into chart points, skipping gaps. */
export function toLinePoints(times: number[], values: Series): LinePoint[] {
  const points: LinePoint[] = [];
  for (let i = 0; i < times.length; i += 1) {
    const value = values[i];
    if (value === null || !Number.isFinite(value)) continue;
    points.push({ time: times[i], value });
  }
  return points;
}
