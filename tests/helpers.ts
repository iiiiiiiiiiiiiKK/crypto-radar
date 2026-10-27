import { EMPTY_METRICS, type TickerRow } from "@/types/market";

/** Minimal valid row for tests; every field can be overridden. */
export function makeRow(overrides: Partial<TickerRow> = {}): TickerRow {
  const market = overrides.market ?? "spot";
  const symbol = overrides.symbol ?? "TESTUSDT";
  return {
    key: overrides.key ?? `${market}:${symbol}`,
    market,
    symbol,
    id: overrides.id ?? symbol,
    base: overrides.base ?? "TEST",
    quote: overrides.quote ?? "USDT",
    price: 1,
    open24h: 1,
    changePercent: 0,
    high24h: 1.2,
    low24h: 0.8,
    volume24h: 1000,
    quoteVolume24h: 5_000_000,
    trades24h: 100,
    bidPrice: null,
    askPrice: null,
    markPrice: null,
    indexPrice: null,
    fundingRate: null,
    nextFundingTime: null,
    openInterest: null,
    decimals: 4,
    updatedAt: Date.now(),
    receivedAt: Date.now(),
    source: "stream",
    d: { ...EMPTY_METRICS },
    ...overrides,
  };
}
