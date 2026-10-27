import { useMemo, useState } from "react";
import { Modal } from "@/components/ui";
import { useI18n } from "@/hooks/useI18n";
import { useIsMobile } from "@/hooks/useMediaQuery";
import type { Breadth, Board, MarketView } from "@/features/spot/board";
import type { MarketTicker } from "@/types/market";
import type { TableDensity } from "@/types/ui";
import type { Watchlist } from "@/services/storage/watchlists";
import { COLUMNS } from "./columns";

export type QuoteFilter = "all" | "usdt" | "usd";

export interface MarketToolbarProps {
  rows: MarketTicker[];
  total: number;
  board: Board;
  onBoardChange: (board: Board) => void;
  breadth: Breadth;
  view: MarketView;
  onViewChange: (view: MarketView) => void;
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

const BOARDS: Board[] = ["all", "gainers", "losers", "volume"];

/** Advancers versus decliners, drawn as a single stacked bar. */
function BreadthBar({ breadth }: { breadth: Breadth }) {
  const { t } = useI18n();
  if (breadth.total === 0) return null;
  return (
    <div className="flex items-center gap-2 min-w-0" data-testid="breadth">
      <div className="flex h-1.5 w-16 overflow-hidden rounded-sm bg-line" aria-hidden>
        <span className="bg-up" style={{ width: `${breadth.upPercent}%` }} />
        <span className="bg-down" style={{ width: `${breadth.downPercent}%` }} />
      </div>
      <span className="text-2xs cr-up cr-mono">{breadth.up}</span>
      <span className="text-2xs text-faint">/</span>
      <span className="text-2xs cr-down cr-mono">{breadth.down}</span>
      <span className="text-2xs text-faint hidden sm:inline">
        {t("market.breadth")}
      </span>
    </div>
  );
}

export function MarketToolbar({
  rows,
  total,
  board,
  onBoardChange,
  breadth,
  view,
  onViewChange,
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
  const isMobile = useIsMobile();
  const [columnsOpen, setColumnsOpen] = useState(false);

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

  const boardLabel = (item: Board) =>
    item === "all"
      ? t("market.all")
      : item === "gainers"
        ? t("market.topGainers")
        : item === "losers"
          ? t("market.topLosers")
          : t("market.topVolume");

  const boardButtons = (scrollable: boolean) => (
    <div className={`flex items-center gap-0.5 ${scrollable ? "shrink-0" : ""}`} role="group">
      {BOARDS.map((item) => (
        <button
          key={item}
          type="button"
          className={`cr-tab ${scrollable ? "shrink-0" : ""} ${board === item ? "cr-tab-active" : ""}`}
          onClick={() => onBoardChange(item)}
          aria-pressed={board === item}
          data-testid={`board-${item}`}
        >
          {boardLabel(item)}
        </button>
      ))}
    </div>
  );

  const viewSwitch = (
    <div className="flex items-center gap-0.5 shrink-0" role="group" aria-label={t("market.view")}>
      {(["list", "heatmap"] as MarketView[]).map((item) => (
        <button
          key={item}
          type="button"
          className={`cr-btn cr-btn-icon ${view === item ? "cr-btn-primary" : ""}`}
          onClick={() => onViewChange(item)}
          aria-pressed={view === item}
          title={item === "list" ? t("market.viewList") : t("market.viewHeatmap")}
          data-testid={`view-${item}`}
        >
          {item === "list" ? "☰" : "▦"}
        </button>
      ))}
    </div>
  );

  const columnsModal = (
    <Modal open={columnsOpen} title={t("market.columns")} onClose={() => setColumnsOpen(false)}>
      <div className="flex flex-col gap-1">
        {orderedColumns.map((column, index) => (
          <div key={column.id} className="flex items-center justify-between gap-2 py-1 text-xs">
            <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
              <input
                type="checkbox"
                checked={visibleColumns.includes(column.id)}
                onChange={() => onToggleColumn(column.id)}
                className="accent-[#B8F36B] w-4 h-4"
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
  );

  if (isMobile) {
    return (
      <div className="shrink-0 border-b border-line bg-panel">
        <div className="flex items-center gap-1.5 px-2 h-9 overflow-x-auto cr-scroll">
          {boardButtons(true)}
          <div className="w-px h-4 bg-line shrink-0" />
          <select
            className="cr-select shrink-0 max-w-[112px]"
            value={quoteFilter}
            onChange={(event) => onQuoteFilterChange(event.target.value as QuoteFilter)}
            aria-label={t("market.quoteFilter")}
            data-testid="quote-filter"
          >
            <option value="all">{t("market.quoteAll")}</option>
            <option value="usdt">{t("market.quoteUsdt")}</option>
            <option value="usd">{t("market.quoteUsd")}</option>
          </select>
          <button
            type="button"
            className="cr-btn cr-btn-icon shrink-0"
            onClick={() => setColumnsOpen(true)}
            aria-label={t("market.columns")}
            data-testid="open-columns"
          >
            ⋮
          </button>
          {viewSwitch}
          <button
            type="button"
            className="cr-btn cr-btn-icon shrink-0 ml-auto"
            onClick={onRefresh}
            aria-label={t("market.refresh")}
          >
            ⟳
          </button>
        </div>
        <div className="flex items-center gap-2 px-2 pb-1.5">
          <BreadthBar breadth={breadth} />
          <span className="ml-auto text-2xs text-faint cr-mono" data-testid="row-count">
            {rows.length}/{total}
          </span>
        </div>
        {columnsModal}
      </div>
    );
  }

  return (
    <div className="shrink-0 border-b border-line bg-panel px-2 py-1.5 flex items-center gap-2">
      {boardButtons(false)}

      <div className="hidden xl:block w-px h-4 bg-line" />
      <div className="hidden xl:block">
        <BreadthBar breadth={breadth} />
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <span className="text-2xs text-faint" data-testid="row-count">
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
        {viewSwitch}
        <button type="button" className="cr-btn" onClick={onRefresh} title={t("market.refresh")}>
          ⟳
        </button>
      </div>

      {columnsModal}
    </div>
  );
}
