import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ErrorState, EmptyState, Spinner, StarButton } from "@/components/ui";
import { COLUMNS, type ColumnDefinition } from "./columns";
import { useI18n } from "@/hooks/useI18n";
import type { MarketId, MarketTicker } from "@/types/market";
import type { SortState, TableDensity } from "@/types/ui";

const ROW_HEIGHT: Record<TableDensity, number> = {
  compact: 24,
  cozy: 30,
  roomy: 36,
};

export interface MarketTableProps {
  rows: MarketTicker[];
  market: MarketId;
  density: TableDensity;
  visibleColumns: string[];
  columnOrder: string[];
  sort: SortState;
  onSortChange: (sort: SortState) => void;
  watchedKeys: Set<string>;
  onToggleWatch: (ticker: MarketTicker) => void;
  onOpenChart: (ticker: MarketTicker) => void;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

export function MarketTable({
  rows,
  market,
  density,
  visibleColumns,
  columnOrder,
  sort,
  onSortChange,
  watchedKeys,
  onToggleWatch,
  onOpenChart,
  loading,
  error,
  onRetry,
}: MarketTableProps) {
  const { t } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [flash, setFlash] = useState<Record<string, "up" | "down">>({});

  const ordered = useMemo(() => {
    const map = new Map(COLUMNS.map((column) => [column.id, column]));
    const fromOrder = columnOrder
      .map((id) => map.get(id))
      .filter((column): column is ColumnDefinition => Boolean(column));
    const rest = COLUMNS.filter((column) => !columnOrder.includes(column.id));
    // The trading pair itself is always shown — it is the anchor of the table.
    // Columns that do not exist on this market are dropped instead of being
    // rendered as "--".
    return [...fromOrder, ...rest].filter(
      (column) =>
        (column.id === "symbol" || visibleColumns.includes(column.id)) &&
        (!column.markets || column.markets.includes(market)),
    );
  }, [columnOrder, visibleColumns, market]);

  useEffect(() => {
    const next: Record<string, "up" | "down"> = {};
    for (const row of rows) {
      const previous = priceCache.get(row.symbol);
      if (previous !== undefined && previous !== row.price) {
        next[row.symbol] = row.price > previous ? "up" : "down";
      }
      priceCache.set(row.symbol, row.price);
    }
    if (Object.keys(next).length === 0) return;
    setFlash((current) => ({ ...current, ...next }));
    const timer = setTimeout(() => {
      setFlash((current) => {
        const copy = { ...current };
        for (const key of Object.keys(next)) delete copy[key];
        return copy;
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [rows]);

  const rowHeight = ROW_HEIGHT[density];
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 14,
    getItemKey: (index) => rows[index]?.symbol ?? index,
  });

  const gridTemplate = useMemo(
    () =>
      [
        "minmax(0,1fr)",
        ...ordered.map((column) => `${column.width}px`),
        "34px",
      ].join(" "),
    [ordered],
  );

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
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="cr-table-head overflow-hidden" style={{ display: "grid", gridTemplateColumns: gridTemplate }}>
        <div className="cr-th text-left">#</div>
        {ordered.map((column) => (
          <button
            key={column.id}
            type="button"
            className={`cr-th ${column.align === "right" ? "text-right" : "text-left"} hover:text-text ${
              sort.key === column.id ? "text-accent" : ""
            }`}
            onClick={() =>
              onSortChange({
                key: column.id as SortState["key"],
                desc: sort.key === column.id ? !sort.desc : true,
              })
            }
          >
            {t(column.labelKey)}
            {sort.key === column.id ? <span className="ml-0.5">{sort.desc ? "▾" : "▴"}</span> : null}
          </button>
        ))}
        <div className="cr-th" />
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto" data-testid="market-table">
        {loading && rows.length === 0 ? (
          <div className="flex justify-center py-10">
            <Spinner label={t("market.loading")} />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title={t("market.empty")} />
        ) : (
          <div
            className="relative"
            style={{ height: `${virtualizer.getTotalSize()}px`, minWidth: "100%" }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              if (!row) return null;
              const key = `${market}:${row.symbol}`;
              const flashClass = flash[row.symbol];
              return (
                <div
                  key={virtualRow.key}
                  data-testid="market-row"
                  data-symbol={row.symbol}
                  onClick={() => onOpenChart(row)}
                  className={`absolute left-0 right-0 flex items-center cursor-pointer border-b border-line-soft
                    hover:bg-panel-2 transition-colors ${flashClass === "up" ? "animate-flash-up" : ""}
                    ${flashClass === "down" ? "animate-flash-down" : ""}`}
                  style={{
                    height: rowHeight,
                    transform: `translateY(${virtualRow.start}px)`,
                    display: "grid",
                    gridTemplateColumns: gridTemplate,
                  }}
                >
                  <div className="px-2 text-2xs text-faint cr-mono">{virtualRow.index + 1}</div>
                  {ordered.map((column) => (
                    <div
                      key={column.id}
                      className={`px-2 text-xs truncate ${
                        column.align === "right" ? "text-right" : "text-left"
                      }`}
                    >
                      {column.render(row, t)}
                    </div>
                  ))}
                  <div className="flex justify-center">
                    <StarButton
                      active={watchedKeys.has(key)}
                      onClick={() => onToggleWatch(row)}
                      label={t("chart.addToWatchlist")}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const priceCache = new Map<string, number>();
