import { useMemo, useState } from "react";
import { Modal } from "@/components/ui";
import { useI18n } from "@/hooks/useI18n";
import { topMovers, topVolume } from "@/features/spot/sorting";
import type { MarketTicker } from "@/types/market";
import type { TableDensity } from "@/types/ui";
import type { Watchlist } from "@/services/storage/watchlists";
import { COLUMNS } from "./columns";

export interface MarketToolbarProps {
  rows: MarketTicker[];
  total: number;
  visibleColumns: string[];
  onToggleColumn: (column: string) => void;
  columnOrder: string[];
  onColumnOrderChange: (order: string[]) => void;
  density: TableDensity;
  onDensityChange: (density: TableDensity) => void;
  quoteFilter: QuoteFilter;
  onQuoteFilterChange: (filter: QuoteFilter) => void;
  lastUpdated: number | null;
  onRefresh: () => void;
  watchlists: Watchlist[];
  activeListId: string | null;
  onActiveListChange: (id: string) => void;
}

type Board = "all" | "gainers" | "losers" | "volume";

export type QuoteFilter = "all" | "usdt" | "usd";

export function MarketToolbar({
  rows,
  total,
  visibleColumns,
  onToggleColumn,
  columnOrder,
  onColumnOrderChange,
  density,
  onDensityChange,
  quoteFilter,
  onQuoteFilterChange,
  lastUpdated,
  onRefresh,
  watchlists,
  activeListId,
  onActiveListChange,
}: MarketToolbarProps) {
  const { t } = useI18n();
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [board, setBoard] = useState<Board>("all");

  const preview = useMemo(() => {
    if (board === "gainers") return topMovers(rows, "gainers", 5);
    if (board === "losers") return topMovers(rows, "losers", 5);
    if (board === "volume") return topVolume(rows, 5);
    return [];
  }, [board, rows]);

  const densities: TableDensity[] = ["compact", "cozy", "roomy"];

  const orderedColumns = useMemo(() => {
    const map = new Map(COLUMNS.map((column) => [column.id, column]));
    const fromOrder = columnOrder
      .map((id) => map.get(id))
      .filter((column): column is (typeof COLUMNS)[number] => Boolean(column));
    const rest = COLUMNS.filter((column) => !columnOrder.includes(column.id));
    return [...fromOrder, ...rest];
  }, [columnOrder]);

  const moveColumn = (id: string, direction: -1 | 1) => {
    const order = orderedColumns.map((column) => column.id);
    const index = order.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= order.length) return;
    const [moved] = order.splice(index, 1);
    order.splice(target, 0, moved);
    onColumnOrderChange(order);
  };

  return (
    <div className="shrink-0 border-b border-line bg-panel px-2 py-1.5 flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-0.5">
        {(["all", "gainers", "losers", "volume"] as Board[]).map((item) => (
          <button
            key={item}
            type="button"
            className={`cr-tab ${board === item ? "cr-tab-active" : ""}`}
            onClick={() => setBoard(item)}
            data-testid={`board-${item}`}
          >
            {item === "all"
              ? t("market.all")
              : item === "gainers"
                ? t("market.topGainers")
                : item === "losers"
                  ? t("market.topLosers")
                  : t("market.topVolume")}
          </button>
        ))}
      </div>

      <div className="hidden lg:flex items-center gap-2 min-w-0 flex-1">
        {preview.map((row) => (
          <span key={row.symbol} className="cr-chip shrink-0">
            <span className="text-faint">{row.symbol}</span>
            <span className={`cr-mono ${row.priceChangePercent >= 0 ? "cr-up" : "cr-down"}`}>
              {row.priceChangePercent >= 0 ? "+" : ""}
              {row.priceChangePercent.toFixed(2)}%
            </span>
          </span>
        ))}
      </div>

      <div className="flex items-center gap-1.5 ml-auto">
        <span className="text-2xs text-faint hidden sm:inline" data-testid="row-count">
          {rows.length}/{total}
        </span>

        {watchlists.length > 0 ? (
          <select
            className="cr-select max-w-[150px]"
            value={activeListId ?? ""}
            onChange={(event) => onActiveListChange(event.target.value)}
            aria-label="Watchlist"
          >
            {watchlists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.name}
              </option>
            ))}
          </select>
        ) : null}

        <select
          className="cr-select"
          value={quoteFilter}
          onChange={(event) => onQuoteFilterChange(event.target.value as QuoteFilter)}
          aria-label={t("market.quoteFilter")}
          data-testid="quote-filter"
        >
          <option value="all">{t("market.quoteAll")}</option>
          <option value="usdt">{t("market.quoteUsdt")}</option>
          <option value="usd">{t("market.quoteUsd")}</option>
        </select>

        <select
          className="cr-select"
          value={density}
          onChange={(event) => onDensityChange(event.target.value as TableDensity)}
          aria-label={t("market.density")}
        >
          {densities.map((value) => (
            <option key={value} value={value}>
              {value === "compact"
                ? t("market.densityCompact")
                : value === "cozy"
                  ? t("market.densityCozy")
                  : t("market.densityRoomy")}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="cr-btn"
          onClick={() => setColumnsOpen(true)}
          data-testid="open-columns"
        >
          {t("market.columns")}
        </button>

        <button type="button" className="cr-btn" onClick={onRefresh} title={t("market.refresh")}>
          ⟳
        </button>
      </div>

      <Modal open={columnsOpen} title={t("market.columns")} onClose={() => setColumnsOpen(false)}>
        <div className="flex flex-col gap-1">
          {orderedColumns.map((column, index) => (
            <div
              key={column.id}
              className="flex items-center justify-between gap-2 py-1 text-xs"
            >
              <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                <input
                  type="checkbox"
                  checked={visibleColumns.includes(column.id)}
                  onChange={() => onToggleColumn(column.id)}
                  className="accent-[#B8F36B]"
                  data-testid={`column-${column.id}`}
                />
                <span className="truncate">{t(column.labelKey)}</span>
              </label>
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  className="cr-btn cr-btn-icon h-6 w-6"
                  disabled={index === 0}
                  onClick={() => moveColumn(column.id, -1)}
                  aria-label={`Move ${t(column.labelKey)} up`}
                  data-testid={`column-up-${column.id}`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="cr-btn cr-btn-icon h-6 w-6"
                  disabled={index === orderedColumns.length - 1}
                  onClick={() => moveColumn(column.id, 1)}
                  aria-label={`Move ${t(column.labelKey)} down`}
                  data-testid={`column-down-${column.id}`}
                >
                  ↓
                </button>
              </div>
            </div>
          ))}
          <div className="mt-3 pt-2 border-t border-line text-2xs text-faint">
            {t("market.source")}: Binance ·{" "}
            {lastUpdated ? new Date(lastUpdated).toLocaleTimeString("en-GB", { hour12: false }) : "--"}
          </div>
        </div>
      </Modal>
    </div>
  );
}
