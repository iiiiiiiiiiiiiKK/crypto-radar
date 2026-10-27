import type { MarketId } from "@/types/market";
import { AlphaAdapter } from "./alpha";
import { FuturesAdapter } from "./futures";
import { SpotAdapter } from "./spot";
import type { MarketAdapter } from "./types";

export const spotAdapter = new SpotAdapter();
export const futuresAdapter = new FuturesAdapter();
export const alphaAdapter = new AlphaAdapter();

const adapters: Record<MarketId, MarketAdapter> = {
  spot: spotAdapter,
  futures: futuresAdapter,
  alpha: alphaAdapter,
};

export function getAdapter(market: MarketId): MarketAdapter {
  return adapters[market];
}

export { describeError, fetchJson, HttpError, RateLimitError, BlockedError } from "./http";
export type { MarketAdapter, MarkDelta, SnapshotRow, TickerDelta } from "./types";
