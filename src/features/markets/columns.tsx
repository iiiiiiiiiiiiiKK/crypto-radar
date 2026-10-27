import type { ReactNode } from "react";
import { Delta } from "@/components/ui/Delta";
import {
  formatCompact,
  formatFunding,
  formatInteger,
  formatPrice,
  timeAgo,
} from "@/lib/format";
import type { MarketId, TickerRow } from "@/types/market";

export interface ColumnDef {
  id: string;
  label: string;
  align?: "left" | "right";
  width: number;
  /** Markets that actually publish this field. */
  markets: MarketId[];
  sortValue?: (row: TickerRow) => number | null;
  render: (row: TickerRow) => ReactNode;
}

const ALL: MarketId[] = ["spot", "futures", "alpha"];
const TRADED: MarketId[] = ["spot", "futures"];
const PERP: MarketId[] = ["futures"];

function dim(value: ReactNode) {
  return <span className="dim">{value}</span>;
}

/**
 * Every column declares which markets actually publish it, so funding or open
 * interest can never appear on a spot row, and Alpha never borrows perpetual
 * fields it does not have.
 */
export const COLUMNS: ColumnDef[] = [
  {
    id: "price",
    label: "最新价",
    width: 104,
    markets: ALL,
    sortValue: (row) => row.price,
    render: (row) => <span>{formatPrice(row.price, row.decimals)}</span>,
  },
  {
    id: "change",
    label: "24h%",
    width: 86,
    markets: ALL,
    sortValue: (row) => row.changePercent,
    render: (row) => <Delta value={row.changePercent} digits={2} />,
  },
  {
    id: "m1",
    label: "1m%",
    width: 76,
    markets: TRADED,
    sortValue: (row) => row.d.m1,
    render: (row) => <Delta value={row.d.m1} digits={2} arrow={false} />,
  },
  {
    id: "m5",
    label: "5m%",
    width: 76,
    markets: TRADED,
    sortValue: (row) => row.d.m5,
    render: (row) => <Delta value={row.d.m5} digits={2} arrow={false} />,
  },
  {
    id: "m15",
    label: "15m%",
    width: 78,
    markets: TRADED,
    sortValue: (row) => row.d.m15,
    render: (row) => <Delta value={row.d.m15} digits={2} arrow={false} />,
  },
  {
    id: "volumeSurge",
    label: "量能",
    width: 74,
    markets: TRADED,
    sortValue: (row) => row.d.volumeSurge,
    render: (row) =>
      row.d.volumeSurge === null ? (
        dim("--")
      ) : (
        <span className={row.d.volumeSurge >= 2 ? "up" : undefined}>
          {row.d.volumeSurge.toFixed(2)}×
        </span>
      ),
  },
  {
    id: "high",
    label: "24h 高",
    width: 96,
    markets: ALL,
    sortValue: (row) => row.high24h,
    render: (row) => <span className="dim">{formatPrice(row.high24h, row.decimals)}</span>,
  },
  {
    id: "low",
    label: "24h 低",
    width: 96,
    markets: ALL,
    sortValue: (row) => row.low24h,
    render: (row) => <span className="dim">{formatPrice(row.low24h, row.decimals)}</span>,
  },
  {
    id: "quoteVolume",
    label: "24h 成交额",
    width: 100,
    markets: ALL,
    sortValue: (row) => row.quoteVolume24h,
    render: (row) => <span>{formatCompact(row.quoteVolume24h)}</span>,
  },
  {
    id: "volume",
    label: "24h 成交量",
    width: 100,
    markets: TRADED,
    sortValue: (row) => row.volume24h,
    render: (row) => <span className="dim">{formatCompact(row.volume24h)}</span>,
  },
  {
    id: "trades",
    label: "24h 笔数",
    width: 92,
    markets: TRADED,
    sortValue: (row) => row.trades24h,
    render: (row) => <span className="dim">{formatInteger(row.trades24h)}</span>,
  },
  {
    id: "funding",
    label: "资金费率",
    width: 98,
    markets: PERP,
    sortValue: (row) => row.fundingRate,
    render: (row) =>
      row.fundingRate === null ? (
        dim("不可用")
      ) : (
        <span className={row.fundingRate >= 0 ? "up" : "down"}>
          {formatFunding(row.fundingRate)}
        </span>
      ),
  },
  {
    id: "openInterest",
    label: "持仓量",
    width: 96,
    markets: PERP,
    sortValue: (row) => row.openInterest,
    render: (row) =>
      row.openInterest === null ? dim("采集中") : <span>{formatCompact(row.openInterest)}</span>,
  },
  {
    id: "mark",
    label: "标记价",
    width: 98,
    markets: PERP,
    sortValue: (row) => row.markPrice,
    render: (row) => <span className="dim">{formatPrice(row.markPrice, row.decimals)}</span>,
  },
  {
    id: "updated",
    label: "更新",
    width: 78,
    markets: ALL,
    sortValue: (row) => row.receivedAt,
    render: (row) => <span className="dim">{timeAgo(row.receivedAt)}</span>,
  },
];

export function columnsFor(market: MarketId, visible: string[]): ColumnDef[] {
  return COLUMNS.filter((column) => column.markets.includes(market) && visible.includes(column.id));
}

export function sortRows(
  rows: TickerRow[],
  sortId: string,
  direction: "asc" | "desc",
): TickerRow[] {
  const column = COLUMNS.find((item) => item.id === sortId);
  if (!column?.sortValue) return rows;
  const pick = column.sortValue;
  const factor = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = pick(a);
    const right = pick(b);
    if (left === null && right === null) return 0;
    if (left === null) return 1; // missing values always sort last
    if (right === null) return -1;
    return (left - right) * factor;
  });
}
