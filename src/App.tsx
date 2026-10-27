import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/shell/AppShell";
import { CommandCenter } from "@/pages/CommandCenter";
import { MarketsPage } from "@/pages/Markets";
import { RadarPage } from "@/pages/Radar";
import { ChartsPage } from "@/pages/Charts";
import { StudioPage } from "@/pages/Studio";
import { WatchlistPage } from "@/pages/Watchlist";
import { SettingsPage } from "@/pages/Settings";
import { NotFoundPage } from "@/pages/NotFound";

/** GitHub Pages serves the app from a sub-path; strip the trailing slash. */
const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

export function App() {
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<CommandCenter />} />
          <Route path="markets" element={<MarketsPage />} />
          <Route path="radar" element={<RadarPage />} />
          <Route path="charts" element={<ChartsPage />} />
          <Route path="studio" element={<StudioPage />} />
          <Route path="watchlist" element={<WatchlistPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="spot" element={<Navigate to="/markets?market=spot" replace />} />
          <Route path="futures" element={<Navigate to="/markets?market=futures" replace />} />
          <Route path="alpha" element={<Navigate to="/markets?market=alpha" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
