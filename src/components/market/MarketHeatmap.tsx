import { useEffect, useMemo, useRef, useState } from "react";
import { EmptyState, Spinner } from "@/components/ui";
import { useI18n } from "@/hooks/useI18n";
import { squarify } from "@/features/heatmap/treemap";
import { formatCompact, formatPrice } from "@/lib/format";
import type { MarketTicker } from "@/types/market";

export interface MarketHeatmapProps {
  rows: MarketTicker[];
  loading: boolean;
  onOpenChart: (ticker: MarketTicker) => void;
}

/** Colour scale that mirrors the table: green up, red down, muted flat. */
function tileColor(change: number): string {
  const clamped = Math.max(-12, Math.min(12, change));
  if (Math.abs(clamped) < 0.05) return "rgba(143,162,154,0.16)";
  const alpha = 0.16 + (Math.abs(clamped) / 12) * 0.62;
  return clamped > 0
    ? `rgba(34,201,131,${alpha.toFixed(3)})`
    : `rgba(240,82,96,${alpha.toFixed(3)})`;
}

/**
 * A turnover weighted heatmap of the market.
 *
 * Every tile is a pair; its area is the 24 h turnover and its colour is the
 * 24 h change. It answers "where is the money moving" at a glance, which a
 * sorted table cannot.
 */
export function MarketHeatmap({ rows, loading, onOpenChart }: MarketHeatmapProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      setSize({ width: element.clientWidth, height: element.clientHeight });
    });
    observer.observe(element);
    setSize({ width: element.clientWidth, height: element.clientHeight });
    return () => observer.disconnect();
  }, []);

  const tiles = useMemo(() => {
    if (size.width < 40 || size.height < 40) return [];
    const candidates = rows
      .filter((row) => (row.quoteVolume24h ?? 0) > 0)
      .slice(0, 120)
      .map((row) => ({ key: row.symbol, value: row.quoteVolume24h ?? 0 }));
    return squarify(candidates, size.width, size.height);
  }, [rows, size]);

  const bySymbol = useMemo(() => new Map(rows.map((row) => [row.symbol, row])), [rows]);

  if (loading && rows.length === 0) {
    return (
      <div className="flex-1 flex justify-center py-16">
        <Spinner label={t("market.loading")} />
      </div>
    );
  }
  if (rows.length === 0) {
    return <EmptyState title={t("market.empty")} />;
  }

  return (
    <div ref={containerRef} className="flex-1 min-h-0 relative overflow-hidden" data-testid="heatmap">
      {tiles.map((tile) => {
        const ticker = bySymbol.get(tile.key);
        if (!ticker) return null;
        const change = ticker.priceChangePercent;
        const showText = tile.w > 58 && tile.h > 30;
        const showPrice = tile.w > 76 && tile.h > 46;
        return (
          <button
            key={tile.key}
            type="button"
            onClick={() => onOpenChart(ticker)}
            title={`${ticker.symbol} ${formatPrice(ticker.price, ticker.decimals)} (${change > 0 ? "+" : ""}${change.toFixed(2)}%)`}
            className="absolute flex flex-col items-center justify-center overflow-hidden border border-bg
              text-center transition-[filter] duration-100 hover:brightness-125"
            style={{
              left: tile.x,
              top: tile.y,
              width: Math.max(0, tile.w - 1),
              height: Math.max(0, tile.h - 1),
              backgroundColor: tileColor(change),
            }}
            data-testid="heatmap-tile"
            data-symbol={ticker.symbol}
          >
            {showText ? (
              <>
                <span className="text-2xs font-medium leading-tight px-0.5 truncate max-w-full">
                  {ticker.base || ticker.symbol}
                </span>
                <span className="cr-mono text-2xs leading-tight">
                  {change > 0 ? "+" : ""}
                  {change.toFixed(2)}%
                </span>
              </>
            ) : null}
            {showPrice ? (
              <span className="cr-mono text-2xs leading-tight text-faint">
                {formatCompact(ticker.quoteVolume24h)}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
