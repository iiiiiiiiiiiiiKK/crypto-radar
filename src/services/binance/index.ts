import type { MarketAdapter, MarketId } from "@/types/market";
import { AlphaMarketAdapter } from "./alpha";
import { FuturesMarketAdapter } from "./futures";
import { SpotMarketAdapter } from "./spot";

export { AlphaMarketAdapter } from "./alpha";
export { FuturesMarketAdapter } from "./futures";
export { SpotMarketAdapter } from "./spot";
export { fetchJson, BinanceHttpError } from "./http";

const adapters = new Map<MarketId, MarketAdapter>([
  ["spot", new SpotMarketAdapter()],
  ["futures", new FuturesMarketAdapter()],
  ["alpha", new AlphaMarketAdapter()],
]);

export function getAdapter(market: MarketId): MarketAdapter {
  const adapter = adapters.get(market);
  if (!adapter) throw new Error(`Unknown market: ${market}`);
  return adapter;
}
