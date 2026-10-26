import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ErrorState, EmptyState, PercentText, Spinner } from "@/components/ui";
import { useI18n } from "@/hooks/useI18n";
import { useMarketStore } from "@/stores/marketStore";
import { useWatchlistStore } from "@/stores/watchlistStore";
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
  const tickers = useMarketStore((state) => state.tickers);
  const loading = useMarketStore((state) => state.loading);
  const error = useMarketStore((state) => state.error);
  const refresh = useMarketStore((state) => state.refresh);
  const lastUpdated = useMarketStore((state) => state.lastUpdated);
  const watchlists = useWatchlistStore((state) => state.lists);

  const [rules, setRules] = useState<ScreenerRules>(DEFAULT_RULES);

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
          <button type="button" className="cr-btn" onClick={() => void refresh()}>
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

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
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
            onRetry={() => void refresh()}
            retryLabel={t("market.retry")}
          />
        ) : loading && tickers.length === 0 ? (
          <div className="flex justify-center py-10">
            <Spinner label={t("market.loading")} />
          </div>
        ) : hits.length === 0 ? (
          <EmptyState title={t("screener.noMatches")} hint={t("screener.rules")} />
        ) : (
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
            <tbody>
              {hits.map((hit, index) => (
                <tr
                  key={hit.key}
                  className="hover:bg-panel-2 cursor-pointer"
                  onClick={() => navigate(`/chart/${ROUTE_BY_MARKET[hit.market]}/${encodeURIComponent(hit.symbol)}`)}
                  data-testid="screener-row"
                >
                  <td className="cr-td text-faint cr-mono">{index + 1}</td>
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
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
