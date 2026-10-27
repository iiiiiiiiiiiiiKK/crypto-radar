import { useCallback, useRef } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { TopBar } from "./TopBar";
import { useHotkeys } from "@/hooks/useHotkeys";
import { useMarketStore } from "@/stores/marketStore";
import { useAlertEngine } from "@/features/alerts/useAlertEngine";
import { useSettingsStore } from "@/stores/settingsStore";
import { MARKET_IDS } from "@/lib/constants/markets";
import type { MarketId } from "@/types/market";

const MARKET_ROUTES: Record<MarketId, string> = {
  spot: "/spot",
  futures: "/perp",
  alpha: "/alpha",
};

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchRef = useRef<HTMLInputElement | null>(null);
  const setMarket = useMarketStore((state) => state.setMarket);
  const setLastMarket = useSettingsStore((state) => state.setLastMarket);

  const onSearch = useCallback(() => {
    searchRef.current?.focus();
    searchRef.current?.select();
  }, []);

  const onDigit = useCallback(
    (digit: "1" | "2" | "3") => {
      const index = Number(digit) - 1;
      const id = MARKET_IDS[index];
      if (!id) return;
      setMarket(id);
      setLastMarket(id);
      navigate(MARKET_ROUTES[id]);
    },
    [navigate, setMarket, setLastMarket],
  );

  const onEscape = useCallback(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.tagName === "INPUT") {
      active.blur();
    }
  }, []);

  useHotkeys({ onSearch, onDigit, onEscape });
  // Alerts run while the terminal is open, on every page.
  useAlertEngine();

  const isDetail = location.pathname.startsWith("/chart");

  return (
    <div className="h-full flex flex-col bg-bg">
      <TopBar onSearchRef={(el) => (searchRef.current = el)} />
      <div className="flex-1 min-h-0 flex">
        <Sidebar />
        <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
          <Outlet />
        </main>
      </div>
      {!isDetail ? <MobileNav /> : null}
    </div>
  );
}
