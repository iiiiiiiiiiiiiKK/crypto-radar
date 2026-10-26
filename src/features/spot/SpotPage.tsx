import { MarketPanel } from "./MarketPanel";
import { useMarketData } from "./useMarketData";

export function SpotPage() {
  useMarketData("spot");
  return <MarketPanel market="spot" />;
}
