import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/hooks/useI18n";
import { useMarketStore } from "@/stores/marketStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUiStore } from "@/stores/uiStore";
import { ConnectionBadge } from "@/components/ui";
import { MARKET_IDS } from "@/lib/constants/markets";
import type { MarketId } from "@/types/market";

const MARKET_ROUTES: Record<MarketId, string> = {
  spot: "/spot",
  futures: "/perp",
  alpha: "/alpha",
};

export function TopBar({ onSearchRef }: { onSearchRef?: (el: HTMLInputElement | null) => void }) {
  const { t, language, toggle } = useI18n();
  const navigate = useNavigate();
  const market = useMarketStore((state) => state.market);
  const state = useMarketStore((state) => state.state);
  const setMarket = useMarketStore((state) => state.setMarket);
  const lastUpdated = useMarketStore((state) => state.lastUpdated);
  const search = useUiStore((state) => state.search);
  const setSearch = useUiStore((state) => state.setSearch);
  const setLastMarket = useSettingsStore((state) => state.setLastMarket);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onSearchRef?.(inputRef.current);
  }, [onSearchRef]);

  const onPick = (id: MarketId) => {
    setMarket(id);
    setLastMarket(id);
    navigate(MARKET_ROUTES[id]);
  };

  return (
    <header className="h-[46px] shrink-0 border-b border-line bg-panel flex items-center gap-2 px-2 sm:px-3">
      <div className="md:hidden flex items-center gap-1.5 text-accent text-sm shrink-0">◎</div>

      <nav className="flex items-center gap-0.5 shrink-0" aria-label="Market">
        {MARKET_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onPick(id)}
            className={`cr-tab ${market === id ? "cr-tab-active" : ""}`}
            aria-current={market === id ? "page" : undefined}
          >
            {t(`market.${id}`)}
          </button>
        ))}
      </nav>

      <div className="flex-1 min-w-0 flex justify-center">
        <div className="relative w-full max-w-[420px]">
          <input
            ref={inputRef}
            id="global-search"
            data-testid="global-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("market.searchPlaceholder")}
            className="cr-input pl-7"
            autoComplete="off"
            spellCheck={false}
          />
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-2xs text-faint pointer-events-none">
            /
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className="hidden lg:inline text-2xs text-faint truncate max-w-[140px]">
          {lastUpdated ? new Date(lastUpdated).toLocaleTimeString("en-GB", { hour12: false }) : "--"}
        </span>
        <ConnectionBadge state={state} />
        <button
          type="button"
          className="cr-btn cr-btn-icon"
          onClick={toggle}
          aria-label={t("settings.language")}
          title={t("settings.language")}
          data-testid="language-toggle"
        >
          {language === "zh" ? "中" : "EN"}
        </button>
      </div>
    </header>
  );
}
