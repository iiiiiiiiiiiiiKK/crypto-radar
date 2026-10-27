import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { IChartApi } from "lightweight-charts";
import { PriceChart, type ChartLine } from "@/components/chart/PriceChart";
import { SubChart, type SubSeries } from "@/components/chart/SubChart";
import { ErrorState, Sticker, Spinner } from "@/components/ui";
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
  const [mainChart, setMainChart] = useState<IChartApi | null>(null);

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

  // Only MA and EMA belong on the price axis: they share the price unit.
  const priceLines = useMemo<ChartLine[]>(() => {
    if (candles.length === 0) return [];
    const times = candles.map((candle) => candle.time);
    const closes = candles.map((candle) => candle.close);
    const lines: ChartLine[] = [];
    if (indicators.ma) {
      lines.push({
        id: "ma",
        label: `MA${indicatorParams.ma}`,
        color: "#39ff88",
        lineWidth: 1,
        points: toLinePoints(times, sma(closes, indicatorParams.ma)),
      });
    }
    if (indicators.ema) {
      lines.push({
        id: "ema",
        label: `EMA${indicatorParams.ema}`,
        color: "#33e1ff",
        lineWidth: 1,
        points: toLinePoints(times, ema(closes, indicatorParams.ema)),
      });
    }
    return lines;
  }, [candles, indicatorParams, indicators]);

  const rsiSeries = useMemo<SubSeries[]>(() => {
    if (!indicators.rsi || candles.length === 0) return [];
    const times = candles.map((candle) => candle.time);
    const closes = candles.map((candle) => candle.close);
    return [
      {
        id: "rsi",
        type: "line",
        color: "#ffe94a",
        points: toLinePoints(times, rsi(closes, indicatorParams.rsi)),
      },
    ];
  }, [candles, indicatorParams.rsi, indicators.rsi]);

  const macdSeries = useMemo<SubSeries[]>(() => {
    if (!indicators.macd || candles.length === 0) return [];
    const times = candles.map((candle) => candle.time);
    const closes = candles.map((candle) => candle.close);
    const result = macd(closes);
    return [
      {
        id: "hist",
        type: "histogram",
        color: "#7d879e",
        points: toLinePoints(times, result.histogram),
      },
      {
        id: "macd",
        type: "line",
        color: "#e8eefc",
        points: toLinePoints(times, result.macd),
      },
      {
        id: "signal",
        type: "line",
        color: "#b14cff",
        points: toLinePoints(times, result.signal),
      },
    ];
  }, [candles, indicators.macd]);

  const lastRsi = rsiSeries[0]?.points.at(-1)?.value;

  const watchedKey = `${market}:${displaySymbol}`;
  const isWatched = watchlists.some((list) =>
    list.entries.some((entry) => entry.key === watchedKey),
  );

  const toggleWatch = () => {
    const list = watchlists[0];
    if (!list) return;
    if (isWatched) removeEntry(list.id, watchedKey);
    else addEntry(list.id, makeEntry(market, displaySymbol, { name: ticker?.name }));
  };

  const alphaUnavailable = market === "alpha" && error?.includes("ALPHA_KLINES_UNAVAILABLE");
  const mainHeight = isMobile ? 300 : 460;
  const subHeight = isMobile ? 96 : 120;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="shrink-0 border-b border-line bg-panel">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <Link
            to={market === "futures" ? "/perp" : market === "alpha" ? "/alpha" : "/spot"}
            className="cr-btn cr-btn-icon shrink-0"
            aria-label={t("common.back")}
          >
            ←
          </Link>
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <h1 className="pixel-title text-sm" data-testid="chart-symbol">
                {displaySymbol}
              </h1>
              <Sticker tone="voltage" flat>
                {t(`market.${market}`)}
              </Sticker>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="cr-mono text-sm" data-testid="chart-price">
                {formatPrice(ticker?.price ?? candles[candles.length - 1]?.close ?? null, decimals)}
              </span>
              <span
                className={`cr-mono text-2xs ${
                  (ticker?.priceChangePercent ?? 0) >= 0 ? "cr-up" : "cr-down"
                }`}
              >
                {(ticker?.priceChangePercent ?? 0) > 0 ? "+" : ""}
                {(ticker?.priceChangePercent ?? 0).toFixed(2)}%
              </span>
              {ticker ? (
                <span className="text-2xs text-faint">{formatTimeAgo(ticker.updatedAt)}</span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            className={`ml-auto shrink-0 text-base ${isWatched ? "text-accent" : "text-faint hover:text-accent"}`}
            onClick={toggleWatch}
            aria-label={isWatched ? t("chart.inWatchlist") : t("chart.addToWatchlist")}
            data-testid="chart-star"
          >
            {isWatched ? "★" : "☆"}
          </button>
        </div>

        <div className="flex items-center gap-1 px-2 pb-1.5 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-0.5 shrink-0" role="group" aria-label={t("chart.period")}>
            {INTERVALS.map((value) => (
              <button
                key={value}
                type="button"
                className={`cr-tab ${interval === value ? "cr-tab-active" : ""}`}
                onClick={() => setIntervalSetting(value)}
                data-testid={`interval-${value}`}
              >
                {value}
              </button>
            ))}
          </div>
          <div className="w-px h-4 bg-line shrink-0" />
          <div className="flex items-center gap-1 shrink-0" role="group" aria-label={t("chart.indicators")}>
            {(["ma", "ema", "rsi", "macd"] as const).map((key) => (
              <button
                key={key}
                type="button"
                className={`cr-chip ${indicators[key] ? "border-accent text-accent" : "text-muted"}`}
                onClick={() => setIndicator(key, !indicators[key])}
                data-testid={`indicator-${key}`}
              >
                {t(`chart.${key}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto cr-scroll p-1.5 sm:p-2 flex flex-col gap-1.5">
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner label={t("chart.loading")} />
          </div>
        ) : alphaUnavailable ? (
          <ErrorState title={t("chart.unavailable")} retryLabel={t("market.retry")} />
        ) : error ? (
          <ErrorState title={t("chart.error")} detail={error} onRetry={reload} retryLabel={t("market.retry")} />
        ) : (
          <>
            <div className="cr-panel overflow-hidden">
              <PriceChart
                candles={candles}
                lines={priceLines}
                height={mainHeight}
                onCrosshair={setCrosshair}
                onReady={setMainChart}
              />
            </div>

            {indicators.rsi ? (
              <SubChart
                title={`RSI${indicatorParams.rsi}`}
                series={rsiSeries}
                height={subHeight}
                main={mainChart}
                guides={[30, 70]}
                valueLabel={lastRsi === undefined ? undefined : lastRsi.toFixed(2)}
              />
            ) : null}

            {indicators.macd ? (
              <SubChart
                title="MACD 12·26·9"
                series={macdSeries}
                height={subHeight}
                main={mainChart}
                guides={[0]}
              />
            ) : null}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 pb-1 text-2xs text-muted">
              <span className="cr-mono">
                <span className="pixel-label mr-1">O/H/L/C</span>
                {crosshair
                  ? `${crosshair.open.toFixed(decimals)} / ${crosshair.high.toFixed(decimals)} / ${crosshair.low.toFixed(decimals)} / ${crosshair.close.toFixed(decimals)}`
                  : "--"}
              </span>
              <span className="cr-mono">
                <span className="pixel-label mr-1">VOL</span>
                {crosshair ? crosshair.volume.toLocaleString("en-US") : "--"}
              </span>
              {hasMore ? (
                <button
                  type="button"
                  className="cr-btn h-6 px-2 text-2xs ml-auto"
                  onClick={loadMore}
                  disabled={loadingMore}
                  data-testid="load-more"
                >
                  {loadingMore ? t("market.loading") : t("chart.loadMore")}
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
