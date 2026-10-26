import type { MarketId, MarketTicker } from "@/types/market";

export type ScreenerTemplate =
  | "gainers"
  | "losers"
  | "volume"
  | "funding"
  | "spike"
  | "custom";

export interface ScreenerRules {
  template: ScreenerTemplate;
  minChange: number;
  maxChange: number;
  minQuoteVolume: number;
  minFundingRate: number;
  minSpike: number;
  volumeRatio: number;
  onlyWatchlist: boolean;
  markets: MarketId[];
}

export const DEFAULT_RULES: ScreenerRules = {
  template: "gainers",
  minChange: 5,
  maxChange: 1000,
  minQuoteVolume: 0,
  minFundingRate: 0.01,
  minSpike: 2,
  volumeRatio: 3,
  onlyWatchlist: false,
  markets: ["spot", "futures", "alpha"],
};

export interface ScreenerHit {
  key: string;
  market: MarketId;
  symbol: string;
  triggers: string[];
  value: string;
  valueNumber: number;
  changePercent: number;
  quoteVolume: number | null;
  triggeredAt: number;
}

/**
 * Applies the active rule set to the live ticker list.
 *
 * The short-term move is derived from the real 24h open price that Binance
 * publishes, not from random values: `(last - open) / open`.
 */
export function runScreener(
  tickers: MarketTicker[],
  rules: ScreenerRules,
  watchedKeys: Set<string>,
  labels: {
    gainers: string;
    losers: string;
    volume: string;
    funding: string;
    spike: string;
    change: string;
    fundingRate: string;
    quoteVolume: string;
    spikeValue: string;
  },
): ScreenerHit[] {
  const hits: ScreenerHit[] = [];

  for (const ticker of tickers) {
    if (!rules.markets.includes(ticker.market)) continue;
    if (rules.onlyWatchlist && !watchedKeys.has(`${ticker.market}:${ticker.symbol}`)) continue;

    const triggers: string[] = [];
    let valueNumber = ticker.priceChangePercent;
    let value = `${ticker.priceChangePercent.toFixed(2)}%`;

    const change = ticker.priceChangePercent;
    const quoteVolume = ticker.quoteVolume24h ?? 0;

    switch (rules.template) {
      case "gainers":
        if (change < rules.minChange) continue;
        triggers.push(labels.gainers);
        break;
      case "losers":
        if (change > rules.maxChange) continue;
        triggers.push(labels.losers);
        break;
      case "volume":
        if (quoteVolume < rules.minQuoteVolume) continue;
        triggers.push(labels.volume);
        value = formatVolume(quoteVolume);
        valueNumber = quoteVolume;
        break;
      case "funding": {
        const funding = ticker.fundingRate;
        if (funding === null || funding * 100 < rules.minFundingRate) continue;
        triggers.push(labels.funding);
        value = `${(funding * 100).toFixed(4)}%`;
        valueNumber = funding * 100;
        break;
      }
      case "spike": {
        // Short-window move: the distance between the live price and the
        // 24h open, expressed as a percentage.
        const open = ticker.openPrice;
        if (open === null || open === 0) continue;
        const spike = Math.abs((ticker.price - open) / open) * 100;
        if (spike < rules.minSpike) continue;
        triggers.push(labels.spike);
        value = `${spike.toFixed(2)}%`;
        valueNumber = spike;
        break;
      }
      case "custom": {
        if (change < rules.minChange || change > rules.maxChange) continue;
        if (quoteVolume < rules.minQuoteVolume) continue;
        triggers.push(labels.change);
        value = `${change.toFixed(2)}%`;
        valueNumber = change;
        break;
      }
      default:
        break;
    }

    hits.push({
      key: `${ticker.market}:${ticker.symbol}`,
      market: ticker.market,
      symbol: ticker.symbol,
      triggers,
      value,
      valueNumber,
      changePercent: change,
      quoteVolume: ticker.quoteVolume24h,
      triggeredAt: ticker.updatedAt,
    });
  }

  return hits.sort((a, b) => b.valueNumber - a.valueNumber);
}

function formatVolume(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toFixed(2);
}
