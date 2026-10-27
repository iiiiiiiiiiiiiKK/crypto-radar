import { HudPanel, RankBadge, Sticker } from "@/components/ui";
import { useI18n } from "@/hooks/useI18n";
import { formatCompact, formatPrice } from "@/lib/format";
import { ARENA_TABS } from "@/features/arena/tabs";
import type { ArenaBoardId, ArenaEntry } from "@/features/arena/boards";
import type { MarketTicker } from "@/types/market";

export function ArenaBoard({
  board,
  onBoardChange,
  entries,
  loading,
  onOpen,
  onStar,
  watchedKeys,
  market,
}: {
  board: ArenaBoardId;
  onBoardChange: (board: ArenaBoardId) => void;
  entries: ArenaEntry[];
  loading: boolean;
  onOpen: (ticker: MarketTicker) => void;
  onStar: (ticker: MarketTicker) => void;
  watchedKeys: Set<string>;
  market: string;
}) {
  const { t } = useI18n();
  const isSpike = board === "spike";
  const isFunding = board === "funding";

  return (
    <HudPanel
      title={t("arena.title")}
      hint={t("arena.subtitle")}
      bodyClassName="flex flex-col min-h-0"
      className="min-h-0 flex flex-col"
    >
      <div className="flex items-center gap-1 px-2 py-1.5 overflow-x-auto no-scrollbar border-b border-line-soft">
        {ARENA_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`cr-tab ${board === tab ? "cr-tab-active" : ""}`}
            onClick={() => onBoardChange(tab)}
            data-testid={`arena-tab-${tab}`}
          >
            {t(`arena.${tab}`)}
          </button>
        ))}
        <span className="ml-auto text-2xs text-faint shrink-0 hidden sm:inline">
          {isSpike ? t("arena.spikeHint") : isFunding ? t("arena.fundingHint") : ""}
        </span>
      </div>

      {loading && entries.length === 0 ? (
        <div className="py-8 text-center text-2xs text-faint">{t("market.loading")}</div>
      ) : entries.length === 0 ? (
        <div className="py-8 text-center text-2xs text-faint" data-testid="arena-empty">
          {board === "watchlist" ? t("arena.emptyWatchlist") : t("arena.empty")}
        </div>
      ) : (
        <ul className="grid grid-cols-1 xl:grid-cols-2 gap-x-2 py-1" data-testid="arena-list">
          {entries.map((entry, index) => {
            const ticker = entry.ticker;
            const change = ticker.priceChangePercent;
            const tone = change > 0 ? "cr-up" : change < 0 ? "cr-down" : "text-muted";
            const pinned = watchedKeys.has(`${market}:${ticker.symbol}`);
            return (
              <li key={`${board}-${ticker.symbol}`}>
                <div className="flex items-center gap-2 px-2 py-1 hover:bg-panel-2 group">
                  <RankBadge rank={index + 1} />
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => onOpen(ticker)}
                    data-testid="arena-row"
                    data-symbol={ticker.symbol}
                  >
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs font-semibold truncate">{ticker.symbol}</span>
                      {entry.badge ? (
                        <Sticker tone={isSpike ? "voltage" : "warn"} flat>
                          {entry.badge}
                        </Sticker>
                      ) : null}
                      <span className={`ml-auto cr-mono text-xs shrink-0 ${tone}`}>
                        {change > 0 ? "+" : ""}
                        {change.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-2xs text-faint cr-mono">
                      <span>{formatPrice(ticker.price, ticker.decimals)}</span>
                      <span className="ml-auto">{formatCompact(ticker.quoteVolume24h)}</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    className={`w-5 text-center text-xs shrink-0 ${pinned ? "text-accent" : "text-faint hover:text-accent"}`}
                    onClick={() => onStar(ticker)}
                    aria-label={t("chart.addToWatchlist")}
                  >
                    {pinned ? "★" : "☆"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </HudPanel>
  );
}
