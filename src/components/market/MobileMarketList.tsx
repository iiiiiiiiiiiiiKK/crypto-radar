import { useMemo } from "react";
import { ErrorState, EmptyState, Spinner, StarButton } from "@/components/ui";
import { useI18n } from "@/hooks/useI18n";
import { formatCompact, formatPrice, formatTimeAgo } from "@/lib/format";
import type { MarketId, MarketTicker } from "@/types/market";
import type { SortState } from "@/types/ui";

export interface MobileMarketListProps {
  rows: MarketTicker[];
  market: MarketId;
  sort: SortState;
  onSortChange: (sort: SortState) => void;
  watchedKeys: Set<string>;
  onToggleWatch: (ticker: MarketTicker) => void;
  onOpenChart: (ticker: MarketTicker) => void;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

/**
 * The mobile presentation of the market table.
 *
 * A nine column grid does not fit a phone, so the rows become compact cards:
 * the pair and its price on the first line, the 24 h change and the volume on
 * the second. Everything stays readable without horizontal scrolling.
 */
/** The numeric value a ticker contributes for a given sort key. */
function numericValue(ticker: MarketTicker, key: SortState["key"]): number {
  switch (key) {
    case "price":
      return ticker.price;
    case "changePercent":
      return ticker.priceChangePercent;
    case "quoteVolume24h":
      return ticker.quoteVolume24h ?? -Infinity;
    case "high24h":
      return ticker.high24h ?? -Infinity;
    case "low24h":
      return ticker.low24h ?? -Infinity;
    case "volume24h":
      return ticker.volume24h ?? -Infinity;
    case "updatedAt":
      return ticker.updatedAt;
    default:
      return 0;
  }
}

export function MobileMarketList({
  rows,
  market,
  sort,
  onSortChange,
  watchedKeys,
  onToggleWatch,
  onOpenChart,
  loading,
  error,
  onRetry,
}: MobileMarketListProps) {
  const { t } = useI18n();

  const sorted = useMemo(() => {
    const direction = sort.desc ? -1 : 1;
    return [...rows].sort((a, b) => {
      if (sort.key === "symbol") return a.symbol.localeCompare(b.symbol) * direction;
      return (numericValue(a, sort.key) - numericValue(b, sort.key)) * direction;
    });
  }, [rows, sort]);

  if (error && rows.length === 0) {
    return (
      <ErrorState
        title={t("market.error")}
        detail={error}
        onRetry={onRetry}
        retryLabel={t("market.retry")}
      />
    );
  }

  const sortOptions: Array<{ key: SortState["key"]; label: string }> = [
    { key: "symbol", label: t("market.symbol") },
    { key: "price", label: t("market.price") },
    { key: "changePercent", label: t("market.changePercent") },
    { key: "quoteVolume24h", label: t("market.quoteVolume") },
    { key: "updatedAt", label: t("market.updatedAt") },
  ];

  return (
    <div className="flex-1 min-h-0 overflow-y-auto" data-testid="market-table">
      <div className="sticky top-0 z-10 flex items-center gap-1.5 bg-panel border-b border-line px-2 h-8 overflow-x-auto cr-scroll">
        <span className="text-2xs text-faint shrink-0">{t("market.sortBy")}</span>
        {sortOptions.map((option) => (
          <button
            key={option.key}
            type="button"
            className={`cr-tab shrink-0 ${
              sort.key === option.key ? "cr-tab-active" : ""
            }`}
            onClick={() =>
              onSortChange({
                key: option.key,
                desc: sort.key === option.key ? !sort.desc : true,
              })
            }
            data-testid={`mobile-sort-${option.key}`}
          >
            {option.label}
            {sort.key === option.key ? (
              <span className="ml-0.5">{sort.desc ? "▾" : "▴"}</span>
            ) : null}
          </button>
        ))}
      </div>
      {loading && rows.length === 0 ? (
        <div className="flex justify-center py-12">
          <Spinner label={t("market.loading")} />
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState title={t("market.empty")} />
      ) : (
        <ul className="flex flex-col">
          {sorted.map((row) => {
            const key = `${market}:${row.symbol}`;
            const change = row.priceChangePercent;
            const tone = change > 0 ? "cr-up" : change < 0 ? "cr-down" : "text-muted";
            return (
              <li key={row.symbol} data-testid="market-row" data-symbol={row.symbol}>
                <button
                  type="button"
                  onClick={() => onOpenChart(row)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 border-b border-line-soft
                    active:bg-panel-2 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="text-xs font-medium truncate">{row.symbol}</span>
                      <span className="cr-mono text-xs shrink-0">
                        {formatPrice(row.price, row.decimals)}
                      </span>
                    </span>
                    <span className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={`cr-mono text-2xs ${tone}`}>
                        {change > 0 ? "+" : ""}
                        {change.toFixed(2)}%
                      </span>
                      {row.fundingRate === null ? null : (
                        <span
                          className={`cr-mono text-2xs ${
                            row.fundingRate > 0
                              ? "cr-up"
                              : row.fundingRate < 0
                                ? "cr-down"
                                : "text-muted"
                          }`}
                        >
                          {t("market.fundingRate")}{" "}
                          {(row.fundingRate * 100).toFixed(4)}%
                        </span>
                      )}
                      {row.markPrice === null ? null : (
                        <span className="cr-mono text-2xs text-faint">
                          {t("market.markPrice")} {formatPrice(row.markPrice, row.decimals)}
                        </span>
                      )}
                      <span className="cr-mono text-2xs text-faint">
                        {formatCompact(row.quoteVolume24h)}
                      </span>
                      <span className="cr-mono text-2xs text-faint">
                        {formatTimeAgo(row.updatedAt)}
                      </span>
                    </span>
                  </span>
                  <StarButton
                    active={watchedKeys.has(key)}
                    onClick={() => onToggleWatch(row)}
                    label={t("chart.addToWatchlist")}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
