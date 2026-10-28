import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { StarButton } from "@/components/ui/Controls";
import { useRow } from "@/hooks/useEngine";
import { MARKET_TAG, type TickerRow } from "@/types/market";
import type { ColumnDef } from "./columns";

interface MarketGridProps {
  rows: TickerRow[];
  columns: ColumnDef[];
  rowHeight: number;
  sortId: string;
  sortDir: "asc" | "desc";
  onSort: (id: string) => void;
  onOpen: (row: TickerRow) => void;
  activeKey?: string;
  /** Narrow layout: fewer, tighter columns for phones. */
  compact?: boolean;
}

function MarketGridRow({
  row,
  columns,
  template,
  height,
  onOpen,
  active,
}: {
  row: TickerRow;
  columns: ColumnDef[];
  template: string;
  height: number;
  onOpen: (row: TickerRow) => void;
  active: boolean;
}) {
  // Subscribing per row means a price tick only repaints this one row.
  const live = useRow(row.key) ?? row;

  return (
    <div
      className="mkt__row"
      role="row"
      tabIndex={0}
      data-testid="market-row"
      data-symbol={live.symbol}
      data-active={active}
      style={{ gridTemplateColumns: template, height }}
      onClick={() => onOpen(live)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(live);
        }
      }}
    >
      <div className="mkt__cell mkt__cell--left" style={{ padding: 0, display: "grid", placeItems: "center" }}>
        <StarButton market={live.market} symbol={live.symbol} />
      </div>
      <div className="mkt__cell mkt__cell--left">
        <span className="sym">
          <span className="sym__base">{live.base}</span>
          <span className="sym__quote">/{live.quote || "—"}</span>
        </span>
        <span className="tag" style={{ marginLeft: 6 }}>
          {MARKET_TAG[live.market]}
        </span>
      </div>
      {columns.map((column) => (
        <div className="mkt__cell" key={column.id} title={column.label}>
          {column.render(live)}
        </div>
      ))}
    </div>
  );
}

/**
 * Virtualised, per-row-subscribed market grid. The header is sticky and the
 * body only mounts the rows that are actually visible.
 */
export function MarketGrid({
  rows,
  columns,
  rowHeight,
  sortId,
  sortDir,
  onSort,
  onOpen,
  activeKey,
  compact = false,
}: MarketGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
  });

  // The star column must be as wide as the 40px touch target on phones,
  // otherwise the button overflows into the symbol column.
  const template = compact
    ? `40px minmax(96px, 1fr) ${columns
        .map((column) => `minmax(${Math.round(column.width * 0.82)}px, auto)`)
        .join(" ")}`
    : `34px minmax(112px, 1.3fr) ${columns.map((column) => `minmax(${column.width}px, 1fr)`).join(" ")}`;

  const items = virtualizer.getVirtualItems();

  return (
    <div className="mkt" ref={parentRef} data-testid="market-grid" style={{ ["--mkt-row-h" as string]: `${rowHeight}px` }}>
      <div className="mkt__head" style={{ gridTemplateColumns: template }} role="row">
        <div className="mkt__th mkt__th--left" />
        <div className="mkt__th mkt__th--left">交易对</div>
        {columns.map((column) => (
          <div
            className="mkt__th"
            key={column.id}
            data-sorted={sortId === column.id}
            aria-sort={sortId === column.id ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
          >
            <button type="button" onClick={() => onSort(column.id)} title={`按${column.label}排序`}>
              {column.label}
              <span aria-hidden="true" style={{ opacity: sortId === column.id ? 1 : 0.25 }}>
                {sortId === column.id ? (sortDir === "desc" ? "↓" : "↑") : "↕"}
              </span>
            </button>
          </div>
        ))}
      </div>

      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {items.map((item) => {
          const row = rows[item.index];
          if (!row) return null;
          return (
            <div
              key={row.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                transform: `translateY(${item.start}px)`,
              }}
            >
              <MarketGridRow
                row={row}
                columns={columns}
                template={template}
                height={rowHeight}
                onOpen={onOpen}
                active={activeKey === row.key}
              />
            </div>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <div className="markets__more">没有符合条件的交易对</div>
      ) : null}
    </div>
  );
}
