import type { MarketTicker } from "@/types/market";
import { formatCompact, formatPrice, formatTimeAgo } from "@/lib/format";
import { PercentValue } from "./PercentValue";

export interface ColumnDefinition {
  id: string;
  labelKey: string;
  align?: "left" | "right";
  width: number;
  minWidth?: number;
  render: (ticker: MarketTicker, t: (path: string) => string) => React.ReactNode;
}

/**
 * The columns of the market table. Every renderer works on the real ticker
 * payload — no placeholder or synthetic values are ever rendered.
 */
export const COLUMNS: ColumnDefinition[] = [
  {
    id: "symbol",
    labelKey: "market.symbol",
    align: "left",
    width: 168,
    minWidth: 132,
    render: (ticker) => (
      <div className="flex items-center gap-1.5 min-w-0">
        {ticker.iconUrl ? (
          <img
            src={ticker.iconUrl}
            alt=""
            className="w-4 h-4 rounded-full shrink-0"
            loading="lazy"
            onError={(event) => {
              (event.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : null}
        <span className="truncate font-medium">{ticker.symbol}</span>
      </div>
    ),
  },
  {
    id: "price",
    labelKey: "market.price",
    align: "right",
    width: 96,
    render: (ticker) => <span className="cr-mono">{formatPrice(ticker.price, ticker.decimals)}</span>,
  },
  {
    id: "changePercent",
    labelKey: "market.changePercent",
    align: "right",
    width: 84,
    render: (ticker) => <PercentValue value={ticker.priceChangePercent} />,
  },
  {
    id: "high",
    labelKey: "market.high",
    align: "right",
    width: 88,
    render: (ticker) => <span className="cr-mono">{formatPrice(ticker.high24h, ticker.decimals)}</span>,
  },
  {
    id: "low",
    labelKey: "market.low",
    align: "right",
    width: 88,
    render: (ticker) => <span className="cr-mono">{formatPrice(ticker.low24h, ticker.decimals)}</span>,
  },
  {
    id: "volume",
    labelKey: "market.volume",
    align: "right",
    width: 92,
    render: (ticker) => <span className="cr-mono">{formatCompact(ticker.volume24h)}</span>,
  },
  {
    id: "quoteVolume",
    labelKey: "market.quoteVolume",
    align: "right",
    width: 104,
    render: (ticker) => <span className="cr-mono">{formatCompact(ticker.quoteVolume24h)}</span>,
  },
  {
    id: "bidAsk",
    labelKey: "market.bidAsk",
    align: "right",
    width: 132,
    render: (ticker) => (
      <span className="cr-mono text-2xs">
        <span className="cr-up">{formatPrice(ticker.bidPrice, ticker.decimals)}</span>
        <span className="text-faint"> / </span>
        <span className="cr-down">{formatPrice(ticker.askPrice, ticker.decimals)}</span>
      </span>
    ),
  },
  {
    id: "markPrice",
    labelKey: "market.markPrice",
    align: "right",
    width: 96,
    render: (ticker) =>
      ticker.markPrice === null ? (
        <span className="cr-mono text-faint">--</span>
      ) : (
        <span className="cr-mono">{formatPrice(ticker.markPrice, ticker.decimals)}</span>
      ),
  },
  {
    id: "fundingRate",
    labelKey: "market.fundingRate",
    align: "right",
    width: 96,
    render: (ticker) => {
      if (ticker.fundingRate === null) {
        return <span className="cr-mono text-faint">--</span>
      }
      const tone =
        ticker.fundingRate > 0 ? "cr-up" : ticker.fundingRate < 0 ? "cr-down" : "text-muted";
      return (
        <span className={`cr-mono ${tone}`}>{(ticker.fundingRate * 100).toFixed(4)}%</span>
      );
    },
  },
  {
    id: "openInterest",
    labelKey: "market.openInterest",
    align: "right",
    width: 96,
    render: (ticker) => (
      <span className="cr-mono">
        {ticker.openInterest === null ? "--" : formatCompact(ticker.openInterest)}
      </span>
    ),
  },
  {
    id: "updatedAt",
    labelKey: "market.updatedAt",
    align: "right",
    width: 76,
    render: (ticker) => <span className="cr-mono text-faint">{formatTimeAgo(ticker.updatedAt)}</span>,
  },
];

