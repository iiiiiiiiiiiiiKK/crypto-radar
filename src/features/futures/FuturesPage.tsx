import { MarketPanel } from "@/features/spot/MarketPanel";
import { useMarketData } from "@/features/spot/useMarketData";

export function FuturesPage() {
  useMarketData("futures");
  return <MarketPanel market="futures" />;
}
