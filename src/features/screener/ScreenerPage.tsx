import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ErrorState, EmptyState, PercentText, Spinner } from "@/components/ui";
import { useI18n } from "@/hooks/useI18n";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { MobileScreenerList } from "@/components/screener/MobileScreenerList";
import { useWatchlistStore } from "@/stores/watchlistStore";
import { useScreenerData } from "./useScreenerData";
import { DEFAULT_RULES, runScreener, type ScreenerRules, type ScreenerTemplate } from "./rules";
import { formatCompact, formatTimeAgo } from "@/lib/format";
import type { MarketId } from "@/types/market";

const TEMPLATES: ScreenerTemplate[] = ["gainers", "losers", "volume", "funding", "spike", "custom"];

const ROUTE_BY_MARKET: Record<MarketId, string> = {
  spot: "spot",
  futures: "futures",
  alpha: "alpha",
};

export function ScreenerPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const watchlists = useWatchlistStore((state) => state.lists);

  const [rules, setRules] = useState<ScreenerRules>(DEFAULT_RULES);
  const markets = useMemo(() => rules.markets, [rules.markets]);
  const { tickers, loading, error, lastUpdated, refresh } = useScreenerData(markets);
  const scrollRef = useRef<HTMLDivElement>(null);

  const watchedKeys = useMemo(() => {
    const set = new Set<string>();
    for (const list of watchlists) {
      for (const entry of list.entries) set.add(entry.key);
    }
    return set;
  }, [watchlists]);

  const hits = useMemo(
    () =>
      runScreener(tickers, rules, watchedKeys, {
        gainers: t("screener.gainers"),
        losers: t("screener.losers"),
        volume: t("screener.volume"),
        funding: t("screener.funding"),
        spike: t("screener.spike"),
        change: t("screener.minChange"),
        fundingRate: t("screener.minFundingRate"),
        quoteVolume: t("screener.minQuoteVolume"),
        spikeValue: t("screener.minSpike"),
      }),
    [rules, tickers, watchedKeys, t],
  );

  const virtualizer = useVirtualizer({
    count: hits.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 24,
    overscan: 12,
    getItemKey: (index) => hits[index]?.key ?? index,
  });

  const update = <K extends keyof ScreenerRules>(key: K, value: ScreenerRules[K]) =>
    setRules((current) => ({ ...current, [key]: value }));

  const toggleMarket = (market: MarketId) => {
    const markets = rules.markets.includes(market)
      ? rules.markets.filter((item) => item !== market)
      : [...rules.markets, market];
    update("markets", markets.length > 0 ? markets : rules.markets);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="shrink-0 border-b border-line bg-panel px-2 sm:px-3 py-2 flex flex-wrap items-center gap-2">
        <h1 className="text-sm font-semibold">{t("screener.title")}</h1>
        <span className="text-2xs text-faint hidden sm:inline">{t("screener.subtitle")}</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-2xs text-faint">
            {t("screener.scanTime")}:{" "}
            {lastUpdated ? new Date(lastUpdated).toLocaleTimeString("en-GB", { hour12: false }) : "--"}
          </span>
          <button type="button" className="cr-btn" onClick={refresh} title={t("market.refresh")}>
            ⟳
          </button>
        </div>
      </div>

      <div className="shrink-0 border-b border-line bg-panel px-2 sm:px-3 py-2 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {TEMPLATES.map((template) => (
            <button
              key={template}
              type="button"
              className={`cr-tab ${rules.template === template ? "cr-tab-active" : ""}`}
              onClick={() => update("template", template)}
              data-testid={`template-${template}`}
            >
              {t(`screener.${template}`)}
            </button>
          ))}
        </div>

        <div
          className={`grid gap-2 ${
            isMobile ? "grid-cols-2" : "grid-cols-2 md:grid-cols-3 xl:grid-cols-6"
          }`}
        >
          {rules.template !== "volume" && rules.template !== "funding" ? (
            <label className="flex flex-col gap-1">
              <span className="cr-label">{t("screener.minChange")}</span>
              <input
                className="cr-input cr-mono"
                type="number"
                step="0.1"
                value={rules.minChange}
                onChange={(event) => update("minChange", Number(event.target.value))}
                data-testid="rule-min-change"
              />
            </label>
          ) : null}

          {rules.template === "losers" || rules.template === "custom" ? (
            <label className="flex flex-col gap-1">
              <span className="cr-label">{t("screener.maxChange")}</span>
              <input
                className="cr-input cr-mono"
                type="number"
                step="0.1"
                value={rules.maxChange}
                onChange={(event) => update("maxChange", Number(event.target.value))}
              />
            </label>
          ) : null}

          {rules.template === "volume" || rules.template === "custom" ? (
            <label className="flex flex-col gap-1">
              <span className="cr-label">{t("screener.minQuoteVolume")}</span>
              <input
                className="cr-input cr-mono"
                type="number"
                step="1000"
                value={rules.minQuoteVolume}
                onChange={(event) => update("minQuoteVolume", Number(event.target.value))}
                data-testid="rule-min-quote-volume"
              />
            </label>
          ) : null}

          {rules.template === "funding" ? (
            <label className="flex flex-col gap-1">
              <span className="cr-label">{t("screener.minFundingRate")}</span>
              <input
                className="cr-input cr-mono"
                type="number"
                step="0.001"
                value={rules.minFundingRate}
                onChange={(event) => update("minFundingRate", Number(event.target.value))}
                data-testid="rule-min-funding"
              />
            </label>
          ) : null}

          {rules.template === "spike" ? (
            <label className="flex flex-col gap-1">
              <span className="cr-label">{t("screener.minSpike")}</span>
              <input
                className="cr-input cr-mono"
                type="number"
                step="0.1"
                value={rules.minSpike}
                onChange={(event) => update("minSpike", Number(event.target.value))}
                data-testid="rule-min-spike"
              />
            </label>
          ) : null}

          <label className="flex flex-col gap-1">
            <span className="cr-label">{t("screener.markets")}</span>
            <div className="flex items-center gap-1 h-7">
              {(["spot", "futures", "alpha"] as MarketId[]).map((market) => (
                <button
                  key={market}
                  type="button"
                  className={`cr-chip ${
                    rules.markets.includes(market)
                      ? "border-accent/50 text-accent"
                      : "text-muted"
                  }`}
                  onClick={() => toggleMarket(market)}
                >
                  {t(`market.${market}`)}
                </button>
              ))}
            </div>
          </label>

          <label className="flex flex-col gap-1 justify-end">
            <span className="cr-label">{t("screener.onlyWatchlist")}</span>
            <div className="flex items-center h-7">
              <input
                type="checkbox"
                className="accent-[#B8F36B]"
                checked={rules.onlyWatchlist}
                onChange={(event) => update("onlyWatchlist", event.target.checked)}
                data-testid="rule-only-watchlist"
              />
            </div>
          </label>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto cr-scroll">
        {error && tickers.length === 0 ? (
          <ErrorState
            title={t("market.error")}
            detail={error}
            onRetry={refresh}
            retryLabel={t("market.retry")}
          />
        ) : loading && tickers.length === 0 ? (
          <div className="flex justify-center py-10">
            <Spinner label={t("market.loading")} />
          </div>
        ) : hits.length === 0 ? (
          <EmptyState title={t("screener.noMatches")} hint={t("screener.rules")} />
        ) : isMobile ? (
          <MobileScreenerList
            hits={hits}
            loading={loading}
            error={error}
            onRetry={refresh}
            onOpen={(hit) =>
              navigate(
                `/chart/${ROUTE_BY_MARKET[hit.market]}/${encodeURIComponent(hit.symbol)}`,
              )
            }
          />
        ) : (
          <div ref={scrollRef} className="h-full overflow-auto" data-testid="screener-table">
            <div className="sticky top-0 z-10 bg-panel">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="cr-th text-left">#</th>
                    <th className="cr-th text-left">{t("market.symbol")}</th>
                    <th className="cr-th text-left">{t("market.spot")}</th>
                    <th className="cr-th text-left">{t("screener.triggers")}</th>
                    <th className="cr-th text-right">{t("screener.value")}</th>
                    <th className="cr-th text-right">{t("market.changePercent")}</th>
                    <th className="cr-th text-right">{t("market.quoteVolume")}</th>
                    <th className="cr-th text-right">{t("screener.triggeredAt")}</th>
                  </tr>
                </thead>
              </table>
            </div>
            <div className="relative" style={{ height: `${virtualizer.getTotalSize()}px` }}>
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const hit = hits[virtualRow.index];
                if (!hit) return null;
                return (
                  <table
                    key={hit.key}
                    className="w-full absolute left-0"
                    style={{ top: virtualRow.start }}
                  >
                    <tbody>
                      <tr
                        className="hover:bg-panel-2 cursor-pointer"
                        onClick={() =>
                          navigate(`/chart/${ROUTE_BY_MARKET[hit.market]}/${encodeURIComponent(hit.symbol)}`)
                        }
                        data-testid="screener-row"
                      >
                        <td className="cr-td text-faint cr-mono">{virtualRow.index + 1}</td>
                        <td className="cr-td font-medium">{hit.symbol}</td>
                        <td className="cr-td text-muted">{t(`market.${hit.market}`)}</td>
                        <td className="cr-td text-muted">{hit.triggers.join(" · ")}</td>
                        <td className="cr-td text-right cr-mono text-accent">{hit.value}</td>
                        <td className="cr-td text-right">
                          <PercentText value={hit.changePercent} />
                        </td>
                        <td className="cr-td text-right cr-mono">
                          {hit.quoteVolume === null ? "--" : formatCompact(hit.quoteVolume)}
                        </td>
                        <td className="cr-td text-right cr-mono text-faint">
                          {formatTimeAgo(hit.triggeredAt)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
