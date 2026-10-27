import { useMemo, useState } from "react";
import { Delta } from "@/components/ui/Delta";
import { useMarketRows } from "@/hooks/useEngine";
import { formatPrice } from "@/lib/format";
import type { MarketId, TickerRow } from "@/types/market";

interface Props {
  market: MarketId;
  activeSymbol: string;
  onSelect: (row: TickerRow) => void;
}

/** Left rail of the chart workspace: the liquid pairs of the active market. */
export function SymbolRail({ market, activeSymbol, onSelect }: Props) {
  const rows = useMarketRows(market);
  const [query, setQuery] = useState("");

  const list = useMemo(() => {
    const needle = query.trim().toUpperCase();
    const filtered = needle
      ? rows.filter(
          (row) =>
            row.symbol.toUpperCase().includes(needle) || row.base.toUpperCase().includes(needle),
        )
      : rows;
    return [...filtered]
      .sort((a, b) => (b.quoteVolume24h ?? 0) - (a.quoteVolume24h ?? 0))
      .slice(0, 80);
  }, [rows, query]);

  return (
    <aside className="panel symbolrail">
      <header className="panel__head">
        <span className="panel__idx">SR</span>
        <h2 className="panel__title">交易对</h2>
        <span className="panel__hint">{list.length}</span>
      </header>
      <div className="symbolrail__search">
        <input
          className="input"
          placeholder="搜索…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="搜索交易对"
        />
      </div>
      <div className="symbolrail__list">
        {list.map((row) => (
          <button
            key={row.key}
            type="button"
            className="symbolrail__item"
            data-active={row.symbol === activeSymbol}
            onClick={() => onSelect(row)}
          >
            <span className="symbolrail__sym">{row.symbol}</span>
            <span className="symbolrail__chg">
              {row.price !== null ? (
                <span className="dim" style={{ marginRight: 8, fontSize: 10 }}>
                  {formatPrice(row.price, row.decimals)}
                </span>
              ) : null}
              <Delta value={row.changePercent} digits={2} arrow={false} />
            </span>
          </button>
        ))}
        {list.length === 0 ? <div className="markets__more">没有匹配的交易对</div> : null}
      </div>
    </aside>
  );
}
