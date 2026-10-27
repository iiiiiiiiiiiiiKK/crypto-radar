import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useI18n } from "@/hooks/useI18n";
import { useIsMobile } from "@/hooks/useMediaQuery";
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

const QUICK = [
  { to: "/events", key: "nav.events", icon: "⚡" },
  { to: "/studio", key: "nav.studio", icon: "✎" },
  { to: "/profile", key: "nav.profile", icon: "☗" },
];

export function TopBar({ onSearchRef }: { onSearchRef?: (el: HTMLInputElement | null) => void }) {
  const { t, language, toggle } = useI18n();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const market = useMarketStore((state) => state.market);
  const state = useMarketStore((state) => state.state);
  const setMarket = useMarketStore((state) => state.setMarket);
  const lastUpdated = useMarketStore((state) => state.lastUpdated);
  const search = useUiStore((state) => state.search);
  const setSearch = useUiStore((state) => state.setSearch);
  const setLastMarket = useSettingsStore((state) => state.setLastMarket);
  const inputRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    onSearchRef?.(inputRef.current);
  }, [onSearchRef]);

  const onPick = (id: MarketId) => {
    setMarket(id);
    setLastMarket(id);
    navigate(MARKET_ROUTES[id]);
  };

  const clock = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString("en-GB", { hour12: false })
    : "--:--:--";

  const xLink = (
    <a
      href="https://x.com/0xkillcoin"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center w-7 h-7 shrink-0 border border-line bg-panel-2 text-muted hover:border-accent hover:text-accent"
      aria-label={t("common.authorX")}
      title={t("common.authorX")}
      data-testid="author-x-link"
    >
      <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    </a>
  );

  const marketTabs = (scroll: boolean) => (
    <nav
      className={`flex items-center gap-0.5 ${scroll ? "overflow-x-auto no-scrollbar" : "shrink-0"}`}
      aria-label="Market"
    >
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
  );

  const searchBox = (
    <div className="relative w-full">
      <input
        ref={inputRef}
        id="global-search"
        data-testid="global-search"
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t("market.searchPlaceholder")}
        className="cr-input pl-6"
        autoComplete="off"
        spellCheck={false}
      />
      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-2xs text-faint pointer-events-none">
        ⌕
      </span>
    </div>
  );

  if (isMobile) {
    return (
      <header className="shrink-0 border-b border-line bg-panel">
        <div className="h-11 flex items-center gap-1.5 px-2">
          <span className="text-accent text-sm leading-none shrink-0 glitch">◎</span>
          <span className="pixel-title text-2xs shrink-0">RADAR</span>
          <div className="flex-1 min-w-0">{searchBox}</div>
          {xLink}
          <ConnectionBadge state={state} compact />
          <button
            type="button"
            className="cr-btn cr-btn-icon shrink-0"
            onClick={toggle}
            aria-label={t("settings.language")}
            data-testid="language-toggle"
          >
            {language === "zh" ? "中" : "EN"}
          </button>
        </div>
        <div className="flex items-center gap-1 px-1.5 h-8 border-t border-line-soft">
          {marketTabs(true)}
          <span className="ml-auto cr-mono text-2xs text-faint shrink-0 pr-1">{clock}</span>
        </div>
      </header>
    );
  }

  return (
    <header className="h-12 shrink-0 border-b border-line bg-panel flex items-center gap-2 px-3">
      <span className="text-accent text-base leading-none shrink-0 glitch">◎</span>
      <div className="shrink-0 hidden lg:block">
        <div className="pixel-title text-2xs leading-none">CRYPTO RADAR</div>
        <div className="text-2xs text-faint mt-0.5">{t("appTagline")}</div>
      </div>

      <div className="w-px h-5 bg-line shrink-0" />
      {marketTabs(false)}

      <div className="flex-1 min-w-0 flex justify-center">
        <div className="w-full max-w-[380px]">{searchBox}</div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {QUICK.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `cr-btn cr-btn-icon ${isActive ? "cr-btn-primary" : ""}`
            }
            title={t(item.key)}
          >
            {item.icon}
          </NavLink>
        ))}
        <span className="cr-mono text-2xs text-faint hidden xl:inline w-[58px] text-right">
          {clock}
        </span>
        {xLink}
        <ConnectionBadge state={state} />
        <button
          type="button"
          className="cr-btn cr-btn-icon"
          onClick={toggle}
          aria-label={t("settings.language")}
          data-testid="language-toggle"
        >
          {language === "zh" ? "中" : "EN"}
        </button>
        <button
          type="button"
          className="cr-btn cr-btn-icon"
          onClick={() => setMenuOpen((value) => !value)}
          aria-label={t("nav.more")}
          data-testid="topbar-more"
        >
          ⋯
        </button>
      </div>

      {menuOpen ? (
        <div className="absolute right-2 top-12 z-40 w-[190px] cr-panel bg-panel shadow-2xl p-1.5">
          {[
            { to: "/screener", key: "nav.screener" },
            { to: "/alerts", key: "nav.alerts" },
            { to: "/watchlists", key: "nav.watchlists" },
            { to: "/settings", key: "nav.settings" },
          ].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMenuOpen(false)}
              className="block px-2 py-1.5 text-xs text-muted hover:text-accent hover:bg-panel-2"
            >
              {t(item.key)}
            </NavLink>
          ))}
        </div>
      ) : null}
    </header>
  );
}
