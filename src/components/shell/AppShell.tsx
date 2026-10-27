import { useEffect, useMemo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { engine } from "@/engine/engine";
import { useAlertsRunner } from "@/hooks/useAlertsRunner";
import { useHotkeys } from "@/hooks/useHotkeys";
import { usePreferences } from "@/stores/preferences";
import { useUi } from "@/stores/ui";
import { useWatchlist } from "@/stores/watchlist";
import { HotkeySheet, Toaster } from "./Chrome";
import { MobileBar } from "./MobileBar";
import { RailNav } from "./RailNav";
import { TickerTape } from "./TickerTape";
import { TopBar } from "./TopBar";

/**
 * Application shell: rail navigation, top bar, trading tape, page outlet and
 * the global chrome (toasts, hotkey sheet, mobile bar).
 */
export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const focusSearch = useUi((state) => state.focusSearch);
  const setHotkeysOpen = useUi((state) => state.setHotkeysOpen);
  const setMarket = usePreferences((state) => state.setMarket);
  const market = usePreferences((state) => state.market);
  const motion = usePreferences((state) => state.motion);
  const eventThresholds = usePreferences((state) => state.eventThresholds);

  useEffect(() => {
    engine.init();
  }, []);

  useEffect(() => {
    engine.setEventThresholds(eventThresholds);
  }, [eventThresholds]);

  useEffect(() => {
    document.documentElement.dataset.motion = motion;
  }, [motion]);

  useEffect(() => {
    // New route: scroll the content back to the top.
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [location.pathname]);

  useAlertsRunner();

  const hotkeys = useMemo(
    () => ({
      "/": () => focusSearch(),
      "?": () => setHotkeysOpen(true),
      escape: () => setHotkeysOpen(false),
      m: () => navigate("/markets"),
      r: () => navigate("/radar"),
      c: () => navigate("/charts"),
      w: () => navigate("/watchlist"),
      s: () => navigate("/studio"),
      "1": () => {
        setMarket("spot");
        if (!location.pathname.startsWith("/markets")) navigate("/markets");
      },
      "2": () => {
        setMarket("futures");
        if (!location.pathname.startsWith("/markets")) navigate("/markets");
      },
      "3": () => {
        setMarket("alpha");
        engine.ensureMarkets(["alpha"]);
        if (!location.pathname.startsWith("/markets")) navigate("/markets");
      },
      f: () => {
        const symbol = usePreferences.getState().lastSymbol[market];
        if (!symbol) return;
        useWatchlist.getState().toggle({ key: `${market}:${symbol}`, market, symbol });
      },
    }),
    [focusSearch, setHotkeysOpen, navigate, location.pathname, setMarket, market],
  );

  useHotkeys(hotkeys);

  return (
    <div className="shell">
      <RailNav />
      <div className="shell__main">
        <TopBar />
        <TickerTape />
        <Outlet />
      </div>
      <MobileBar />
      <Toaster />
      <HotkeySheet />
    </div>
  );
}
