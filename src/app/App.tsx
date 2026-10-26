import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/layout";
import { OverviewPage } from "@/features/spot/OverviewPage";
import { SpotPage } from "@/features/spot/SpotPage";
import { FuturesPage } from "@/features/futures/FuturesPage";
import { AlphaPage } from "@/features/alpha/AlphaPage";
import { ChartPage } from "@/features/chart/ChartPage";
import { ScreenerPage } from "@/features/screener/ScreenerPage";
import { WatchlistsPage } from "@/features/watchlist/WatchlistsPage";
import { SettingsPage } from "@/features/settings/SettingsPage";

export function App() {
  // Every page owns its market through `useMarketData`. The shared feed is
  // started and stopped by the store, so switching routes never leaves a
  // dangling subscription behind.
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/spot" element={<SpotPage />} />
        <Route path="/perp" element={<FuturesPage />} />
        <Route path="/alpha" element={<AlphaPage />} />
        <Route path="/chart/:market/:symbol" element={<ChartPage />} />
        <Route path="/screener" element={<ScreenerPage />} />
        <Route path="/watchlists" element={<WatchlistsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
