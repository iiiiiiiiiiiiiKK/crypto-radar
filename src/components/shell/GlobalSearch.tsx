import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/components/Icons";
import { engine } from "@/engine/engine";
import { readRecent, pushRecent, searchRows } from "@/features/search/search";
import { usePreferences } from "@/stores/preferences";
import { useUi } from "@/stores/ui";
import { formatPrice, formatPercent, timeAgo } from "@/lib/format";
import { MARKET_TAG, type TickerRow } from "@/types/market";

/**
 * Global symbol search.
 *
 * Results come from the live universe that is already loaded (spot, perpetual
 * and — once visited — Alpha), never from a hard-coded coin list.
 */
export function GlobalSearch() {
  const navigate = useNavigate();
  const focusToken = useUi((state) => state.searchFocusToken);
  const setMarket = usePreferences((state) => state.setMarket);
  const setSymbol = usePreferences((state) => state.setSymbol);

  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [rows, setRows] = useState<TickerRow[]>([]);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    if (focusToken === 0) return;
    inputRef.current?.focus();
    setOpen(true);
  }, [focusToken]);

  // The search index is refreshed while the dropdown is open, not on every tick.
  useEffect(() => {
    if (!open) return;
    const refresh = () => {
      setRows([...engine.store.allRows()]);
      setRecent(readRecent());
    };
    refresh();
    const timer = setInterval(refresh, 2500);
    return () => clearInterval(timer);
  }, [open]);

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  const hits = useMemo(() => (query.trim() ? searchRows(rows, query, 10) : []), [rows, query]);
  const recentRows = useMemo(
    () => recent.map((key) => engine.store.getRow(key)).filter((row): row is TickerRow => row !== null),
    [recent],
  );

  const choose = (row: TickerRow) => {
    setMarket(row.market);
    setSymbol(row.market, row.symbol);
    pushRecent(row.key);
    setOpen(false);
    setQuery("");
    if (row.market === "alpha") {
      navigate(`/markets?market=alpha&symbol=${encodeURIComponent(row.symbol)}`);
    } else {
      navigate(`/charts?market=${row.market}&symbol=${encodeURIComponent(row.symbol)}`);
    }
  };

  const list = query.trim() ? hits : recentRows.slice(0, 6);

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      setQuery("");
      inputRef.current?.blur();
      return;
    }
    if (!list.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => (index + 1) % list.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => (index - 1 + list.length) % list.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const target = list[Math.min(active, list.length - 1)];
      if (!target) return;
      if ("market" in target && "symbol" in target && "id" in target) choose(target as TickerRow);
      else {
        const row = engine.store.getRow((target as { key: string }).key);
        if (row) choose(row);
      }
    }
  };

  return (
    <div className="search" ref={wrapRef}>
      <div className="search__box">
        <Icon name="search" size={14} className="dim" />
        <input
          ref={inputRef}
          className="search__input"
          data-testid="global-search"
          placeholder="搜索交易对：BTC、ETHUSDT、SOL…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActive(0);
            engine.ensureMarkets(["spot", "futures"]);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          aria-label="搜索交易对"
          autoComplete="off"
          spellCheck={false}
        />
        <span className="search__key">/</span>
      </div>

      {open ? (
        <div className="search__pop" role="listbox">
          {query.trim() === "" ? (
            recentRows.length > 0 ? (
              <div className="search__group">最近查看</div>
            ) : (
              <div className="search__empty">输入 BTC、ETHUSDT 或任意币种名称开始搜索。</div>
            )
          ) : hits.length === 0 ? (
            <div className="search__empty">没有匹配的交易对。已加载 {rows.length} 个交易对。</div>
          ) : (
            <div className="search__group">匹配 {hits.length} 个交易对</div>
          )}

          {list.map((item, index) => {
            const row =
              "id" in item && "market" in item
                ? (item as TickerRow)
                : engine.store.getRow((item as { key: string }).key);
            if (!row) return null;
            return (
              <button
                key={row.key}
                type="button"
                className="search__row"
                data-active={index === active}
                role="option"
                aria-selected={index === active}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(row)}
              >
                <span className="search__sym">{row.symbol}</span>
                <span className="search__mkt">{MARKET_TAG[row.market]}</span>
                <span className="grow" />
                <span className="num dim" style={{ fontSize: 11 }}>
                  {formatPrice(row.price, row.decimals)}
                </span>
                <span
                  className={`num ${(row.changePercent ?? 0) >= 0 ? "up" : "down"}`}
                  style={{ fontSize: 11, minWidth: 56, textAlign: "right" }}
                >
                  {formatPercent(row.changePercent)}
                </span>
              </button>
            );
          })}

          {query.trim() && hits.length > 0 ? (
            <div className="search__empty" style={{ paddingTop: 6 }}>
              ↑ ↓ 选择 · Enter 打开 K 线 · Esc 关闭 · 数据更新 {timeAgo(engine.store.getRow(hits[0].key)?.receivedAt ?? null)}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
