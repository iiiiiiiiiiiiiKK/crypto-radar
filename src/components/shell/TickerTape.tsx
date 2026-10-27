import { useMemo } from "react";
import { formatPrice, formatPercent } from "@/lib/format";
import { useMarketRows } from "@/hooks/useEngine";
import type { TickerRow } from "@/types/market";

/**
 * The trading floor tape: the most liquid USDT pairs scrolling across the top.
 * It is decoration with a purpose — every value is a live ticker.
 */
export function TickerTape() {
  const spot = useMarketRows("spot");

  const picks = useMemo(() => {
    const usdt = spot.filter((row) => row.quote === "USDT" && row.price !== null);
    const anchors = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT"]
      .map((symbol) => usdt.find((row) => row.symbol === symbol))
      .filter((row): row is TickerRow => Boolean(row));
    const rest = usdt
      .filter((row) => !anchors.includes(row))
      .sort((a, b) => (b.quoteVolume24h ?? 0) - (a.quoteVolume24h ?? 0))
      .slice(0, 20);
    return [...anchors, ...rest].slice(0, 24);
  }, [spot]);

  if (picks.length === 0) {
    return (
      <div className="tape">
        <span className="tape__flag">SYNC</span>
        <div className="tape__viewport">
          <div className="tape__track">
            <span className="tape__item">正在接入币安现货行情…</span>
          </div>
        </div>
      </div>
    );
  }

  const items = picks.map((row) => (
    <span className="tape__item" key={row.key}>
      <span className="tape__sym">{row.base}</span>
      <span className="tape__px">{formatPrice(row.price, row.decimals)}</span>
      <span className={row.changePercent !== null && row.changePercent < 0 ? "down" : "up"}>
        {formatPercent(row.changePercent)}
      </span>
    </span>
  ));

  return (
    <div className="tape" aria-hidden="true">
      <span className="tape__flag">
        <span className="dot dot--live" /> LIVE
      </span>
      <div className="tape__viewport">
        <div className="tape__track">
          {items}
          {items}
        </div>
      </div>
    </div>
  );
}
