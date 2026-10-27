import { formatCompact, formatFunding, formatPercent } from "@/lib/format";
import type { TickerRow } from "@/types/market";

export type BoardTab = "gainers" | "losers" | "turnover" | "surge" | "funding" | "oi";

export const BOARD_TABS: Array<{ key: BoardTab; label: string }> = [
  { key: "gainers", label: "涨幅" },
  { key: "losers", label: "跌幅" },
  { key: "turnover", label: "成交额" },
  { key: "surge", label: "量能" },
  { key: "funding", label: "资金费率" },
  { key: "oi", label: "持仓量" },
];

const MIN_TURNOVER = 50_000;

/** Ranks the live rows for one board tab. */
export function rankMovers(rows: TickerRow[], tab: BoardTab, limit = 8): TickerRow[] {
  const usable = rows.filter((row) => {
    if (row.price === null) return false;
    switch (tab) {
      case "surge":
        return row.d.volumeSurge !== null && (row.quoteVolume24h ?? 0) >= MIN_TURNOVER;
      case "funding":
        return row.market === "futures" && row.fundingRate !== null;
      case "oi":
        return row.d.oiChange !== null;
      case "turnover":
        return row.quoteVolume24h !== null;
      default:
        return row.changePercent !== null && (row.quoteVolume24h ?? 0) >= MIN_TURNOVER;
    }
  });

  const sorted = [...usable].sort((a, b) => {
    switch (tab) {
      case "gainers":
        return (b.changePercent ?? 0) - (a.changePercent ?? 0);
      case "losers":
        return (a.changePercent ?? 0) - (b.changePercent ?? 0);
      case "turnover":
        return (b.quoteVolume24h ?? 0) - (a.quoteVolume24h ?? 0);
      case "surge":
        return (b.d.volumeSurge ?? 0) - (a.d.volumeSurge ?? 0);
      case "funding":
        return Math.abs(b.fundingRate ?? 0) - Math.abs(a.fundingRate ?? 0);
      case "oi":
        return Math.abs(b.d.oiChange ?? 0) - Math.abs(a.d.oiChange ?? 0);
      default:
        return 0;
    }
  });

  return sorted.slice(0, limit);
}

export function moverValue(row: TickerRow, tab: BoardTab): { text: string; tone: string } {
  switch (tab) {
    case "turnover":
      return { text: formatCompact(row.quoteVolume24h), tone: "flat" };
    case "surge":
      return {
        text: row.d.volumeSurge === null ? "--" : `${row.d.volumeSurge.toFixed(2)}×`,
        tone: "up",
      };
    case "funding":
      return {
        text: formatFunding(row.fundingRate),
        tone: (row.fundingRate ?? 0) >= 0 ? "up" : "down",
      };
    case "oi": {
      const value = row.d.oiChange;
      return {
        text: value === null ? "--" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`,
        tone: (value ?? 0) >= 0 ? "up" : "down",
      };
    }
    default:
      return {
        text: formatPercent(row.changePercent),
        tone: (row.changePercent ?? 0) >= 0 ? "up" : "down",
      };
  }
}

export { MIN_TURNOVER };
