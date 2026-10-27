import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PriceChart, type ChartLine } from "@/components/chart/PriceChart";
import { ErrorState, PercentText, Spinner, StarButton } from "@/components/ui";
import { useI18n } from "@/hooks/useI18n";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { useMarketStore } from "@/stores/marketStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useWatchlistStore } from "@/stores/watchlistStore";
import { makeEntry } from "@/services/storage/watchlists";
import { useKlines } from "./useKlines";
import { ema, macd, rsi, sma, toLinePoints } from "@/features/indicators";
import { INTERVALS } from "@/lib/constants/markets";
import { formatPrice, formatTimeAgo } from "@/lib/format";
import type { Candle, Interval, MarketId } from "@/types/market";

const MARKET_FROM_ROUTE: Record<string, MarketId> = {
  spot: "spot",
  futures: "futures",
  alpha: "alpha",
};

export function ChartPage() {
  const params = useParams();
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const market = MARKET_FROM_ROUTE[params.market ?? ""] ?? "spot";
  const symbolId = decodeURIComponent(params.symbol ?? "");

  const tickers = useMarketStore((state) => state.tickers);
  const setMarket = useMarketStore((state) => state.setMarket);
  const interval = useSettingsStore((state) => state.interval) as Interval;
  const setIntervalSetting = useSettingsStore((state) => state.setInterval);
  const indicators = useSettingsStore((state) => state.indicators);
  const setIndicator = useSettingsStore((state) => state.setIndicator);
  const indicatorParams = useSettingsStore((state) => state.indicatorParams);

  const watchlists = useWatchlistStore((state) => state.lists);
  const addEntry = useWatchlistStore((state) => state.addEntry);
  const removeEntry = useWatchlistStore((state) => state.removeEntry);

  const [crosshair, setCrosshair] = useState<Candle | null>(null);

  const { candles, loading, loadingMore, error, hasMore, reload, loadMore } = useKlines(
    market,
    symbolId,
    interval,
  );

  useEffect(() => {
    setMarket(market);
  }, [market, setMarket]);

  const ticker = useMemo(
    () => tickers.find((item) => item.id === symbolId || item.symbol === symbolId),
    [tickers, symbolId],
  );

  const displaySymbol = ticker?.symbol ?? symbolId;
  const decimals = ticker?.decimals ?? 2;

  const chartLines = useMemo<ChartLine[]>(() => {
    if (candles.length === 0) return [];
    const times = candles.map((candle) => candle.time);
    const closes = candles.map((candle) => candle.close);
    const lines: ChartLine[] = [];

    if (indicators.ma) {
      lines.push({
        id: "ma",
        label: `MA${indicatorParams.ma}`,
        color: "#B8F36B",
        lineWidth: 1,
        points: toLinePoints(times, sma(closes, indicatorParams.ma)),
      });
    }
    if (indicators.ema) {
      lines.push({
        id: "ema",
        label: `EMA${indicatorParams.ema}`,
        color: "#5CCFC0",
        lineWidth: 1,
        points: toLinePoints(times, ema(closes, indicatorParams.ema)),
      });
    }
    if (indicators.rsi) {
      lines.push({
        id: "rsi",
        label: `RSI${indicatorParams.rsi}`,
        color: "#F0B65E",
        lineWidth: 1,
        points: toLinePoints(times, rsi(closes, indicatorParams.rsi)),
      });
    }
    if (indicators.macd) {
      const macdResult = macd(closes);
      lines.push({
        id: "macd",
        label: "MACD",
        color: "#E7EFEB",
        lineWidth: 1,
        points: toLinePoints(times, macdResult.macd),
      });
      lines.push({
        id: "macd-signal",
        label: "Signal",
        color: "#F05260",
        lineWidth: 1,
        points: toLinePoints(times, macdResult.signal),
      });
    }
    return lines;
  }, [candles, indicatorParams, indicators]);

  const rsiPoints = useMemo(() => {
    if (!indicators.rsi || candles.length === 0) return [];
    const times = candles.map((candle) => candle.time);
    const closes = candles.map((candle) => candle.close);
    return toLinePoints(times, rsi(closes, indicatorParams.rsi));
  }, [candles, indicatorParams.rsi, indicators.rsi]);

  const isWatched = watchlists.some((list) =>
    list.entries.some((entry) => entry.key === `${market}:${displaySymbol}`),
  );

  const toggleWatch = () => {
    const list = watchlists[0];
    if (!list) return;
    const key = `${market}:${displaySymbol}`;
    if (isWatched) {
      removeEntry(list.id, key);
    } else {
      addEntry(list.id, makeEntry(market, displaySymbol, { name: ticker?.name }));
    }
  };

  const alphaUnavailable = market === "alpha" && error?.includes("ALPHA_KLINES_UNAVAILABLE");

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div
        className={`shrink-0 border-b border-line bg-panel px-2 sm:px-3 py-2 ${
          isMobile ? "flex flex-col gap-2" : "flex flex-wrap items-center gap-3"
        }`}
      >
        <div className={`flex items-center gap-2 ${isMobile ? "" : "gap-3"}`}>
        <Link
          to={market === "futures" ? "/perp" : market === "alpha" ? "/alpha" : "/spot"}
          className="cr-btn cr-btn-icon shrink-0"
          aria-label={t("common.back")}
        >
          ←
        </Link>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold truncate" data-testid="chart-symbol">
              {displaySymbol}
            </h1>
            <span className="cr-chip text-faint">{t(`market.${market}`)}</span>
            {ticker?.name ? (
              <span className="text-2xs text-faint truncate">{ticker.name}</span>
            ) : null}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="cr-mono text-sm" data-testid="chart-price">
              {formatPrice(ticker?.price ?? candles[candles.length - 1]?.close ?? null, decimals)}
            </span>
            <PercentText value={ticker?.priceChangePercent ?? null} />
            {ticker ? (
              <span className="text-2xs text-faint">{formatTimeAgo(ticker.updatedAt)}</span>
            ) : null}
          </div>
        </div>

        <StarButton
          active={isWatched}
          onClick={toggleWatch}
          label={isWatched ? t("chart.inWatchlist") : t("chart.addToWatchlist")}
        />
        </div>

        <div className={`flex items-center gap-2 ${isMobile ? "w-full" : "ml-auto flex-wrap"}`}>
          <div
            className={`flex items-center gap-0.5 ${
              isMobile ? "overflow-x-auto cr-scroll flex-1 min-w-0" : ""
            }`}
            role="group"
            aria-label={t("chart.period")}
          >
            {INTERVALS.map((value) => (
              <button
                key={value}
                type="button"
                className={`cr-tab shrink-0 ${interval === value ? "cr-tab-active" : ""}`}
                onClick={() => setIntervalSetting(value)}
                data-testid={`interval-${value}`}
              >
                {value}
              </button>
            ))}
          </div>

          <div className={`flex items-center gap-1 ${isMobile ? "shrink-0" : ""}`} role="group" aria-label={t("chart.indicators")}>
            {(["ma", "ema", "rsi", "macd"] as const).map((key) => (
              <button
                key={key}
                type="button"
                className={`cr-chip shrink-0 ${
                  indicators[key] ? "border-accent text-accent" : "text-muted"
                }`}
                onClick={() => setIndicator(key, !indicators[key])}
                data-testid={`indicator-${key}`}
              >
                {t(`chart.${key}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto cr-scroll">
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner label={t("chart.loading")} />
          </div>
        ) : alphaUnavailable ? (
          <ErrorState title={t("chart.unavailable")} retryLabel={t("market.retry")} />
        ) : error ? (
          <ErrorState title={t("chart.error")} detail={error} onRetry={reload} retryLabel={t("market.retry")} />
        ) : (
          <div className="p-2 sm:p-3 flex flex-col gap-2">
            <div className="cr-panel overflow-hidden">
              <PriceChart
                candles={candles}
                lines={chartLines}
                height={isMobile ? 300 : 420}
                onCrosshair={setCrosshair}
              />
            </div>

            {indicators.rsi && rsiPoints.length > 0 ? (
              <div className="cr-panel overflow-hidden">
                <div className="px-2 py-1 text-2xs text-faint border-b border-line-soft">
                  RSI {indicatorParams.rsi}
                </div>
                <div className="px-2 py-1.5 text-2xs text-muted cr-mono">
                  {rsiPoints[rsiPoints.length - 1]?.value.toFixed(2)}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-2xs text-muted px-1">
              <span className="cr-mono">
                {t("chart.ohlc")}:{" "}
                {crosshair
                  ? `${crosshair.open.toFixed(decimals)} / ${crosshair.high.toFixed(decimals)} / ${crosshair.low.toFixed(decimals)} / ${crosshair.close.toFixed(decimals)}`
                  : "--"}
              </span>
              <span className="cr-mono">
                {t("chart.volume")}: {crosshair ? crosshair.volume.toLocaleString("en-US") : "--"}
              </span>
              <span className="cr-mono">{t("market.source")}: Binance</span>
            </div>

            <div className="flex items-center justify-center py-2">
              {hasMore ? (
                <button
                  type="button"
                  className="cr-btn"
                  onClick={loadMore}
                  disabled={loadingMore}
                  data-testid="load-more"
                >
                  {loadingMore ? t("market.loading") : t("chart.loadMore")}
                </button>
              ) : (
                <span className="text-2xs text-faint">— {t("chart.history")} —</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
