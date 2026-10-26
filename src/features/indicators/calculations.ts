export interface LinePoint {
  time: number;
  value: number;
}

export interface MacdPoint {
  time: number;
  macd: number;
  signal: number;
  histogram: number;
}

/** Simple moving average. */
export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (period <= 0) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/** Exponential moving average (standard alpha = 2 / (period + 1)). */
export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (period <= 0 || values.length === 0) return out;
  const multiplier = 2 / (period + 1);
  let previous: number | null = null;
  for (let i = 0; i < values.length; i += 1) {
    if (i < period - 1) continue;
    if (previous === null) {
      let sum = 0;
      for (let j = 0; j < period; j += 1) sum += values[j];
      previous = sum / period;
    } else {
      previous = values[i] * multiplier + previous * (1 - multiplier);
    }
    out[i] = previous;
  }
  return out;
}

/** Relative Strength Index using Wilder's smoothing. */
export function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
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
  out[period] = rsiValue(avgGain, avgLoss);

  for (let i = period + 1; i < values.length; i += 1) {
    const change = values[i] - values[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = rsiValue(avgGain, avgLoss);
  }
  return out;
}

function rsiValue(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** MACD (12, 26, 9). */
export function macd(
  values: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] } {
  const fast = ema(values, fastPeriod);
  const slow = ema(values, slowPeriod);
  const macdLine: (number | null)[] = values.map((_, i) =>
    fast[i] !== null && slow[i] !== null ? (fast[i] as number) - (slow[i] as number) : null,
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
  const signal: (number | null)[] = new Array(values.length).fill(null);
  signalCompact.forEach((value, i) => {
    if (value !== null) signal[indexMap[i]] = value;
  });

  const histogram: (number | null)[] = values.map((_, i) => {
    const m = macdLine[i];
    const s = signal[i];
    if (m === null || s === null) return null;
    return m - s;
  });

  return { macd: macdLine, signal, histogram };
}

export function toLinePoints(
  times: number[],
  values: (number | null)[],
): LinePoint[] {
  const points: LinePoint[] = [];
  for (let i = 0; i < times.length; i += 1) {
    const value = values[i];
    if (value === null || value === undefined || !Number.isFinite(value)) continue;
    points.push({ time: times[i], value });
  }
  return points;
}
