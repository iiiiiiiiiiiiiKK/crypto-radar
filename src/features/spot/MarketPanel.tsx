import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMarketStore } from "@/stores/marketStore";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUiStore } from "@/stores/uiStore";
import { useWatchlistStore } from "@/stores/watchlistStore";
import { MarketTable } from "@/components/market/MarketTable";
import { MobileMarketList } from "@/components/market/MobileMarketList";
import { MarketHeatmap } from "@/components/market/MarketHeatmap";
import { MarketToolbar } from "@/components/market/MarketToolbar";
import { filterByQuote, filterTickers, sortTickers, type QuoteFilter } from "./sorting";
import { applyBoard, marketBreadth, type Board, type MarketView } from "./board";
import { makeEntry } from "@/services/storage/watchlists";
import type { MarketId, MarketTicker } from "@/types/market";
import type { SortState } from "@/types/ui";
import type { ColumnVisibility } from "@/types/ui";

const ROUTE_BY_MARKET: Record<MarketId, string> = {
  spot: "spot",
  futures: "futures",
  alpha: "alpha",
};

export function MarketPanel({ market }: { market: MarketId }) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const tickers = useMarketStore((state) => state.tickers);
  const loading = useMarketStore((state) => state.loading);
  const error = useMarketStore((state) => state.error);
  const lastUpdated = useMarketStore((state) => state.lastUpdated);
  const refresh = useMarketStore((state) => state.refresh);

  const search = useUiStore((state) => state.search);
  const density = useSettingsStore((state) => state.density);
  const setDensity = useSettingsStore((state) => state.setDensity);
  const visibleColumns = useSettingsStore((state) => state.visibleColumns);
  const columnOrder = useSettingsStore((state) => state.columnOrder);
  const toggleColumn = useSettingsStore((state) => state.toggleColumn);
  const setColumnOrder = useSettingsStore((state) => state.setColumnOrder);

  const watchlists = useWatchlistStore((state) => state.lists);
  const activeListId = useWatchlistStore((state) => state.activeListId);
  const setActiveList = useWatchlistStore((state) => state.setActiveList);
  const addEntry = useWatchlistStore((state) => state.addEntry);
  const removeEntry = useWatchlistStore((state) => state.removeEntry);

  const [sort, setSort] = useState<SortState>({ key: "quoteVolume24h", desc: true });
  const [quoteFilter, setQuoteFilter] = useState<QuoteFilter>("usdt");
  const [board, setBoard] = useState<Board>("all");
  const [view, setView] = useState<MarketView>("list");

  const { rows, sort: effectiveSort } = useMemo(() => {
    const filtered = filterTickers(tickers, search);
    const quoted = filterByQuote(filtered, quoteFilter);
    const boardApplied = applyBoard(quoted, board, sort);
    return {
      rows: sortTickers(boardApplied.rows, boardApplied.sort),
      sort: boardApplied.sort,
    };
  }, [tickers, search, sort, quoteFilter, board]);

  const breadth = useMemo(() => marketBreadth(rows), [rows]);

  const watchedKeys = useMemo(() => {
    const set = new Set<string>();
    for (const list of watchlists) {
      for (const entry of list.entries) set.add(entry.key);
    }
    return set;
  }, [watchlists]);

  const activeList = watchlists.find((list) => list.id === activeListId) ?? watchlists[0];

  const toggleWatch = (ticker: MarketTicker) => {
    if (!activeList) return;
    const key = `${market}:${ticker.symbol}`;
    const entry = makeEntry(market, ticker.symbol, {
      name: ticker.name,
      iconUrl: ticker.iconUrl,
    });
    if (activeList.entries.some((item) => item.key === key)) {
      removeEntry(activeList.id, key);
    } else {
      addEntry(activeList.id, entry);
    }
  };

  const openChart = (ticker: MarketTicker) => {
    const slug = ROUTE_BY_MARKET[market];
    navigate(`/chart/${slug}/${encodeURIComponent(ticker.id)}`);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <MarketToolbar
        rows={rows}
        total={tickers.length}
        board={board}
        onBoardChange={setBoard}
        breadth={breadth}
        view={view}
        onViewChange={setView}
        visibleColumns={visibleColumns}
        onToggleColumn={(column) => toggleColumn(column as keyof ColumnVisibility)}
        columnOrder={columnOrder}
        onColumnOrderChange={setColumnOrder}
        density={density}
        onDensityChange={setDensity}
        quoteFilter={quoteFilter}
        onQuoteFilterChange={setQuoteFilter}
        lastUpdated={lastUpdated}
        onRefresh={() => void refresh()}
        watchlists={watchlists}
        activeListId={activeList?.id ?? null}
        onActiveListChange={setActiveList}
      />
      {view === "heatmap" ? (
        <MarketHeatmap rows={rows} loading={loading} onOpenChart={openChart} />
      ) : isMobile ? (
        <MobileMarketList
          rows={rows}
          market={market}
          sort={effectiveSort}
          onSortChange={setSort}
          watchedKeys={watchedKeys}
          onToggleWatch={toggleWatch}
          onOpenChart={openChart}
          loading={loading}
          error={error}
          onRetry={() => void refresh()}
        />
      ) : (
        <MarketTable
          rows={rows}
          market={market}
          density={density}
          visibleColumns={visibleColumns}
          columnOrder={columnOrder}
          sort={effectiveSort}
          onSortChange={setSort}
          watchedKeys={watchedKeys}
          onToggleWatch={toggleWatch}
          onOpenChart={openChart}
          loading={loading}
          error={error}
          onRetry={() => void refresh()}
        />
      )}
    </div>
  );
}
