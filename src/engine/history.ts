/**
 * Rolling in-memory history for one pair.
 *
 * The websocket gives a price every second; we keep a 5 second sampled window
 * of one hour (720 samples) in typed arrays, which is enough for 1m/5m/15m/1h
 * changes, a turnover baseline and a realised volatility estimate — without
 * allocating an object per tick.
 */

const SAMPLE_MS = 5_000;
const CAPACITY = 720; // 60 minutes at one sample every 5 s

function ringIndex(start: number, k: number): number {
  return (start + k) % CAPACITY;
}

export class HistoryBuffer {
  private readonly times = new Float64Array(CAPACITY);
  private readonly prices = new Float64Array(CAPACITY);
  private readonly quotes = new Float64Array(CAPACITY);
  private start = 0;
  private size = 0;

  get count(): number {
    return this.size;
  }

  get lastSampleAt(): number {
    return this.size === 0 ? 0 : this.times[ringIndex(this.start, this.size - 1)];
  }

  get lastPrice(): number | null {
    return this.size === 0 ? null : this.prices[ringIndex(this.start, this.size - 1)];
  }

  get lastQuote(): number | null {
    return this.size === 0 ? null : this.quotes[ringIndex(this.start, this.size - 1)];
  }

  push(at: number, price: number, quote: number | null): void {
    if (!Number.isFinite(at) || !Number.isFinite(price) || price <= 0) return;
    const q = quote !== null && Number.isFinite(quote) ? quote : 0;

    if (this.size > 0) {
      const lastIdx = ringIndex(this.start, this.size - 1);
      if (at - this.times[lastIdx] < SAMPLE_MS) {
        // Same bucket: overwrite so the newest value inside the window wins.
        this.times[lastIdx] = Math.max(this.times[lastIdx], at);
        this.prices[lastIdx] = price;
        if (q > 0) this.quotes[lastIdx] = q;
        return;
      }
    }

    if (this.size < CAPACITY) {
      const idx = ringIndex(this.start, this.size);
      this.times[idx] = at;
      this.prices[idx] = price;
      this.quotes[idx] = q;
      this.size += 1;
      return;
    }

    // Full ring: drop the oldest sample.
    this.times[this.start] = at;
    this.prices[this.start] = price;
    this.quotes[this.start] = q;
    this.start = ringIndex(this.start, 1);
  }

  /** Index (logical) of the newest sample at or before `at`, or -1. */
  private floorIndex(at: number): number {
    if (this.size === 0) return -1;
    if (at < this.times[this.start]) return -1;
    let low = 0;
    let high = this.size - 1;
    if (at >= this.times[ringIndex(this.start, high)]) return high;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (this.times[ringIndex(this.start, mid)] <= at) low = mid;
      else high = mid - 1;
    }
    return low;
  }

  priceAt(at: number): number | null {
    const idx = this.floorIndex(at);
    if (idx < 0) return null;
    return this.prices[ringIndex(this.start, idx)];
  }

  quoteAt(at: number): number | null {
    const idx = this.floorIndex(at);
    if (idx < 0) return null;
    const value = this.quotes[ringIndex(this.start, idx)];
    return value > 0 ? value : null;
  }

  /** Percent change over `windowMs`, against the trailing price. */
  change(windowMs: number, now = Date.now()): number | null {
    const before = this.priceAt(now - windowMs);
    const current = this.lastPrice;
    if (before === null || current === null || before === 0) return null;
    return ((current - before) / before) * 100;
  }

  /** Quote turnover per minute over the trailing minute. */
  turnoverPerMin(now = Date.now()): number | null {
    const qNow = this.lastQuote;
    const qBefore = this.quoteAt(now - 60_000);
    if (qNow === null || qBefore === null) return null;
    const delta = qNow - qBefore;
    // A rolling 24 h volume can technically decrease; that is not a real rate.
    if (!Number.isFinite(delta) || delta <= 0) return 0;
    return delta;
  }

  /**
   * Median per-minute turnover over the trailing `minutes`, computed from the
   * same cumulative 24 h volume series. Requires at least 5 one-minute windows.
   */
  baselineTurnover(now = Date.now(), minutes = 15): number | null {
    const rates: number[] = [];
    for (let k = 0; k < minutes; k += 1) {
      const end = now - k * 60_000;
      const start = end - 60_000;
      const a = this.quoteAt(start);
      const b = this.quoteAt(end);
      if (a === null || b === null) continue;
      const rate = b - a;
      if (Number.isFinite(rate) && rate > 0) rates.push(rate);
    }
    if (rates.length < 5) return null;
    rates.sort((x, y) => x - y);
    const mid = Math.floor(rates.length / 2);
    return rates.length % 2 === 0 ? (rates[mid - 1] + rates[mid]) / 2 : rates[mid];
  }

  /** Current turnover pace divided by the trailing baseline. */
  volumeSurge(now = Date.now()): number | null {
    const current = this.turnoverPerMin(now);
    const baseline = this.baselineTurnover(now);
    if (current === null || baseline === null || baseline <= 0) return null;
    return current / baseline;
  }

  /** Mean absolute 1 minute return over the trailing `minutes` (percent). */
  absMoveMean(now = Date.now(), minutes = 15): number | null {
    const moves: number[] = [];
    for (let k = 0; k < minutes; k += 1) {
      const end = now - k * 60_000;
      const a = this.priceAt(end - 60_000);
      const b = this.priceAt(end);
      if (a === null || b === null || a === 0) continue;
      moves.push(Math.abs((b - a) / a) * 100);
    }
    if (moves.length < 5) return null;
    let total = 0;
    for (const move of moves) total += move;
    return total / moves.length;
  }

  /** Sparkline values (oldest first, at most `max` points). */
  series(max = 40): Array<{ t: number; p: number }> {
    const step = Math.max(1, Math.ceil(this.size / max));
    const out: Array<{ t: number; p: number }> = [];
    for (let k = 0; k < this.size; k += step) {
      const idx = ringIndex(this.start, k);
      out.push({ t: this.times[idx], p: this.prices[idx] });
    }
    const lastIdx = ringIndex(this.start, this.size - 1);
    if (this.size > 0 && out[out.length - 1]?.t !== this.times[lastIdx]) {
      out.push({ t: this.times[lastIdx], p: this.prices[lastIdx] });
    }
    return out;
  }
}

/** Open interest samples (15 s cadence is enough for a 15 minute delta). */
export class OpenInterestHistory {
  private samples: Array<{ at: number; value: number }> = [];

  push(at: number, value: number): void {
    if (!Number.isFinite(value) || value <= 0) return;
    this.samples.push({ at, value });
    if (this.samples.length > 40) this.samples.shift();
  }

  get latest(): { at: number; value: number } | null {
    return this.samples.length === 0 ? null : this.samples[this.samples.length - 1];
  }

  /** Percent change against the oldest sample that is at least `windowMs` old. */
  changePercent(windowMs = 15 * 60_000, now = Date.now()): number | null {
    const latest = this.latest;
    if (!latest) return null;
    const target = now - windowMs;
    let reference: { at: number; value: number } | null = null;
    for (let i = this.samples.length - 1; i >= 0; i -= 1) {
      const sample = this.samples[i];
      if (sample.at <= target) {
        reference = sample;
        break;
      }
    }
    if (!reference) reference = this.samples[0];
    if (!reference || reference.value === 0) return null;
    // Require at least half the window (capped at 5 minutes) of real coverage,
    // otherwise a single fresh sample would be reported as a 0% change.
    if (now - reference.at < Math.min(windowMs * 0.5, 300_000)) return null;
    return ((latest.value - reference.value) / reference.value) * 100;
  }
}
