import { EmptyState, ErrorState, Spinner } from "@/components/ui";
import { useI18n } from "@/hooks/useI18n";
import { formatCompact, formatTimeAgo } from "@/lib/format";
import type { ScreenerHit } from "@/features/screener/rules";
import type { MarketId } from "@/types/market";

export interface MobileScreenerListProps {
  hits: ScreenerHit[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpen: (hit: ScreenerHit) => void;
}

/**
 * The mobile presentation of the screener results.
 *
 * An eight column table does not fit a phone, so every anomaly becomes a
 * compact card: the pair and the trigger on the first line, the value and the
 * 24 h change on the second.
 */
export function MobileScreenerList({
  hits,
  loading,
  error,
  onRetry,
  onOpen,
}: MobileScreenerListProps) {
  const { t } = useI18n();

  if (error && hits.length === 0) {
    return (
      <ErrorState
        title={t("market.error")}
        detail={error}
        onRetry={onRetry}
        retryLabel={t("market.retry")}
      />
    );
  }

  if (loading && hits.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <Spinner label={t("market.loading")} />
      </div>
    );
  }

  if (hits.length === 0) {
    return <EmptyState title={t("screener.noMatches")} hint={t("screener.rules")} />;
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto" data-testid="screener-table">
      <ul className="flex flex-col">
        {hits.map((hit, index) => {
          const tone =
            hit.changePercent > 0 ? "cr-up" : hit.changePercent < 0 ? "cr-down" : "text-muted";
          return (
            <li key={hit.key} data-testid="screener-row">
              <button
                type="button"
                onClick={() => onOpen(hit)}
                className="w-full flex items-center gap-2.5 px-3 py-2 border-b border-line-soft
                  active:bg-panel-2 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="text-xs font-medium truncate">{hit.symbol}</span>
                    <span className="cr-chip shrink-0 text-faint">
                      {t(`market.${hit.market as MarketId}`)}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 mt-0.5">
                    <span className="cr-mono text-2xs text-accent">{hit.value}</span>
                    <span className={`cr-mono text-2xs ${tone}`}>
                      {hit.changePercent > 0 ? "+" : ""}
                      {hit.changePercent.toFixed(2)}%
                    </span>
                    {hit.quoteVolume === null ? null : (
                      <span className="cr-mono text-2xs text-faint">
                        {formatCompact(hit.quoteVolume)}
                      </span>
                    )}
                    <span className="cr-mono text-2xs text-faint">
                      {formatTimeAgo(hit.triggeredAt)}
                    </span>
                  </span>
                </span>
                <span className="text-2xs text-faint shrink-0">{index + 1}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
