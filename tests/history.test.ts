import { describe, expect, it } from "vitest";
import { HistoryBuffer, OpenInterestHistory } from "@/engine/history";

function feed(history: HistoryBuffer, start: number, count: number, stepMs: number, priceAt: (i: number) => number, quoteAt: (i: number) => number) {
  for (let i = 0; i < count; i += 1) {
    history.push(start + i * stepMs, priceAt(i), quoteAt(i));
  }
}

describe("HistoryBuffer", () => {
  it("keeps the newest value inside a sample bucket", () => {
    const history = new HistoryBuffer();
    history.push(1_000, 10, 100);
    history.push(2_000, 11, 110);
    expect(history.count).toBe(1);
    expect(history.lastPrice).toBe(11);
    expect(history.lastQuote).toBe(110);
  });

  it("computes windowed changes from sampled prices", () => {
    const history = new HistoryBuffer();
    const start = 0;
    const now = 10 * 60_000;
    feed(history, start, 121, 5_000, (i) => 100 + i, (i) => 1000 + i * 10);
    expect(history.change(60_000, now)).toBeCloseTo(((220 - 208) / 208) * 100, 3);
  });

  it("returns null when the window predates the buffer", () => {
    const history = new HistoryBuffer();
    feed(history, 10_000_000, 10, 5_000, (i) => 1 + i, () => 100);
    expect(history.change(3_600_000, 10_000_000 + 45_000)).toBeNull();
  });

  it("derives turnover per minute and its baseline", () => {
    const history = new HistoryBuffer();
    const start = 0;
    const now = 20 * 60_000;
    // 60 quote units per minute for 20 minutes, then a burst to 600/min.
    feed(
      history,
      start,
      241,
      5_000,
      () => 10,
      (i) => {
        const minutes = (i * 5_000) / 60_000;
        return minutes <= 19 ? minutes * 60 : 19 * 60 + (minutes - 19) * 600;
      },
    );
    const rate = history.turnoverPerMin(now);
    expect(rate).not.toBeNull();
    expect(rate as number).toBeGreaterThan(500);
    const baseline = history.baselineTurnover(now);
    expect(baseline).not.toBeNull();
    expect(baseline as number).toBeCloseTo(60, 0);
    const surge = history.volumeSurge(now);
    expect(surge as number).toBeGreaterThan(5);
  });

  it("computes the mean absolute 1 minute move", () => {
    const history = new HistoryBuffer();
    feed(history, 0, 121, 5_000, (i) => 100 + i * 0.5, () => 100);
    const move = history.absMoveMean(10 * 60_000, 10);
    expect(move).not.toBeNull();
    expect(move as number).toBeGreaterThan(0);
  });

  it("caps at the ring capacity without throwing", () => {
    const history = new HistoryBuffer();
    feed(history, 0, 900, 5_000, (i) => 1 + i, (i) => i);
    expect(history.count).toBe(720);
    expect(history.lastPrice).toBe(900);
  });

  it("exposes a bounded series for sparklines", () => {
    const history = new HistoryBuffer();
    feed(history, 0, 200, 5_000, (i) => 1 + i, () => 10);
    const series = history.series(20);
    expect(series.length).toBeLessThanOrEqual(21);
    expect(series[series.length - 1].p).toBe(200);
  });
});

describe("OpenInterestHistory", () => {
  it("needs enough age before it reports a change", () => {
    const history = new OpenInterestHistory();
    history.push(0, 1000);
    expect(history.changePercent(10 * 60_000, 60_000)).toBeNull();
  });

  it("reports the change against an older sample", () => {
    const history = new OpenInterestHistory();
    history.push(0, 1000);
    history.push(6 * 60_000, 1200);
    const change = history.changePercent(5 * 60_000, 6 * 60_000);
    expect(change).not.toBeNull();
    expect(change as number).toBeCloseTo(20);
  });

  it("ignores unusable values", () => {
    const history = new OpenInterestHistory();
    history.push(0, 0);
    history.push(1, Number.NaN);
    expect(history.latest).toBeNull();
  });
});
