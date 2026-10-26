import { MarketPanel } from "@/features/spot/MarketPanel";
import { useMarketData } from "@/features/spot/useMarketData";

export function AlphaPage() {
  useMarketData("alpha");
  return <MarketPanel market="alpha" />;
}
