import { useMarketData } from "./useMarketData";
import { MarketPanel } from "./MarketPanel";
import { useSettingsStore } from "@/stores/settingsStore";
import { useMarketStore } from "@/stores/marketStore";
import type { MarketId } from "@/types/market";

/**
 * The overview shows the market the user was last looking at, so the tab bar
 * and the table always agree with each other.
 */
export function OverviewPage() {
  const lastMarket = useSettingsStore((state) => state.lastMarket);
  const market = useMarketStore((state) => state.market);
  const resolved: MarketId =
    lastMarket === "futures" || lastMarket === "alpha" || lastMarket === "spot"
      ? lastMarket
      : market;
  useMarketData(resolved);
  return <MarketPanel market={resolved} />;
}
