import { ErrorState, EmptyState, Spinner, StarButton } from "@/components/ui";
import { RangeBar } from "./RangeBar";
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
 * The phone presentation of the market table.
 *
 * A nine column grid does not fit a phone, so every pair becomes a compact
 * card: the pair on the left and the price on the right, then the change, the
 * 24 h range and the turnover on a second line. Nothing is left aligned into a
 * single blob.
 */
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

  const sortOptions: Array<{ key: SortState["key"]; label: string }> = [
    { key: "quoteVolume24h", label: t("market.quoteVolume") },
    { key: "changePercent", label: t("market.changePercent") },
    { key: "price", label: t("market.price") },
    { key: "updatedAt", label: t("market.updatedAt") },
  ];

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

  return (
    <div className="flex-1 min-h-0 overflow-y-auto" data-testid="market-table">
      <div className="sticky top-0 z-10 flex items-center gap-1 bg-panel border-b border-line px-2 h-8">
        <span className="text-2xs text-faint shrink-0">{t("market.sortBy")}</span>
        {sortOptions.map((option) => (
          <button
            key={option.key}
            type="button"
            className={`cr-tab shrink-0 ${sort.key === option.key ? "cr-tab-active" : ""}`}
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
      ) : rows.length === 0 ? (
        <EmptyState title={t("market.empty")} />
      ) : (
        <ul className="flex flex-col">
          {rows.map((row) => {
            const key = `${market}:${row.symbol}`;
            const change = row.priceChangePercent;
            const tone = change > 0 ? "cr-up" : change < 0 ? "cr-down" : "text-muted";
            return (
              <li key={row.symbol} data-testid="market-row" data-symbol={row.symbol}>
                <div className="flex items-start border-b border-line-soft">
                  <button
                    type="button"
                    onClick={() => onOpenChart(row)}
                    className="flex-1 min-w-0 px-3 py-2 text-left active:bg-panel-2"
                  >
                    {/* line 1: pair on the left, price on the right */}
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs font-semibold truncate">{row.symbol}</span>
                      {row.quote ? (
                        <span className="text-2xs text-faint shrink-0">{row.quote}</span>
                      ) : null}
                      <span className={`ml-auto cr-mono text-xs shrink-0 ${tone}`}>
                        {formatPrice(row.price, row.decimals)}
                      </span>
                    </div>

                    {/* line 2: change, 24 h range, turnover */}
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`cr-mono text-2xs w-[52px] shrink-0 ${tone}`}>
                        {change > 0 ? "+" : ""}
                        {change.toFixed(2)}%
                      </span>
                      <RangeBar
                        low={row.low24h}
                        high={row.high24h}
                        price={row.price}
                        className="flex-1 min-w-0"
                      />
                      <span className="cr-mono text-2xs text-faint w-[52px] text-right shrink-0">
                        {row.quoteVolume24h === null ? "--" : formatCompact(row.quoteVolume24h)}
                      </span>
                    </div>

                    {/* line 3: futures-only fields, when available */}
                    {row.fundingRate === null && row.markPrice === null ? null : (
                      <div className="flex items-center gap-3 mt-0.5">
                        {row.markPrice === null ? null : (
                          <span className="cr-mono text-2xs text-faint">
                            {t("market.markPrice")} {formatPrice(row.markPrice, row.decimals)}
                          </span>
                        )}
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
                            {t("market.fundingRate")} {(row.fundingRate * 100).toFixed(4)}%
                          </span>
                        )}
                        <span className="cr-mono text-2xs text-faint ml-auto">
                          {formatTimeAgo(row.updatedAt)}
                        </span>
                      </div>
                    )}
                  </button>

                  <div className="pt-1.5 pr-1 shrink-0">
                    <StarButton
                      active={watchedKeys.has(key)}
                      onClick={() => onToggleWatch(row)}
                      label={t("chart.addToWatchlist")}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
