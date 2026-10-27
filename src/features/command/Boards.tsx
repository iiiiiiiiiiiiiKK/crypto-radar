import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Delta } from "@/components/ui/Delta";
import { EmptyState, Panel } from "@/components/ui/Panel";
import { StarButton } from "@/components/ui/Controls";
import { useScanRows } from "@/hooks/useEngine";
import { useWatchKeys } from "@/stores/watchlist";
import { formatCompact, formatPrice } from "@/lib/format";
import { MARKET_TAG, type TickerRow } from "@/types/market";
import { BOARD_TABS, MIN_TURNOVER, moverValue, rankMovers, type BoardTab } from "./movers";

/** Top movers board: the right hand column of the command centre. */
export function MoversBoard({ limit = 7 }: { limit?: number }) {
  const rows = useScanRows();
  const navigate = useNavigate();
  const [tab, setTab] = useState<BoardTab>("gainers");
  const items = useMemo(() => rankMovers(rows, tab, limit), [rows, tab, limit]);

  return (
    <Panel
      id="04"
      title="TOP MOVERS · 榜单"
      hint={`${rows.length} 个交易对`}
      bodyClass="movers"
      tools={
        <Link to="/markets" className="feed__link">
          完整行情表 ↗
        </Link>
      }
    >
      <div className="movers__tabs">
        {BOARD_TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            className="movers__tab"
            data-active={tab === item.key}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon="markets"
          title="暂无数据"
          text={
            tab === "oi"
              ? "持仓量需要先采样几轮（约 5-10 分钟）后才能计算变化。"
              : tab === "surge"
                ? "量能放大需要至少 5 分钟的成交额基准。"
                : "行情源还没有返回可用的交易对。"
          }
        />
      ) : (
        <div className="movers__list" data-testid="movers-board">
          {items.map((row, index) => {
            const value = moverValue(row, tab);
            return (
              <button
                key={row.key}
                type="button"
                className="mover"
                onClick={() =>
                  navigate(`/charts?market=${row.market}&symbol=${encodeURIComponent(row.symbol)}`)
                }
              >
                <span className="mover__rank">{String(index + 1).padStart(2, "0")}</span>
                <span className="mover__sym">
                  <span className="mover__name">{row.base}</span>
                  <span className="mover__mkt">{MARKET_TAG[row.market]}</span>
                  {(row.quoteVolume24h ?? 0) < MIN_TURNOVER * 2 ? (
                    <span className="tag" title="成交额偏低，波动更容易被少量资金放大">
                      低流动性
                    </span>
                  ) : null}
                </span>
                <span className="mover__px">{formatPrice(row.price, row.decimals)}</span>
                <span className={`mover__chg ${value.tone}`}>{value.text}</span>
              </button>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

/** Watchlist quick strip for the command centre. */
export function WatchStrip() {
  const keys = useWatchKeys();
  const rows = useScanRows();
  const watched = useMemo(
    () => rows.filter((row) => keys.has(row.key)).slice(0, 6),
    [rows, keys],
  );

  return (
    <Panel id="05" title="WATCHLIST · 自选速览" hint={`${keys.size} 个`}>
      {watched.length === 0 ? (
        <EmptyState
          icon="star"
          title="自选列表还是空的"
          text="在行情表或搜索框里点击星标即可加入自选，之后会实时显示在这里。"
          action={
            <Link to="/watchlist" className="btn btn--sm">
              打开自选工作台
            </Link>
          }
        />
      ) : (
        <div className="movers__list">
          {watched.map((row) => (
            <div className="mover" key={row.key} style={{ cursor: "default" }}>
              <span className="mover__rank">
                <StarButton market={row.market} symbol={row.symbol} />
              </span>
              <span className="mover__sym">
                <span className="mover__name">{row.base}</span>
                <span className="mover__mkt">{MARKET_TAG[row.market]}</span>
              </span>
              <span className="mover__px">{formatPrice(row.price, row.decimals)}</span>
              <Delta value={row.changePercent} digits={2} fontSize={11} />
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/**
 * "今日最离谱" — the most extreme 24h move in the covered universe.
 * Data driven, with a share entry point.
 */
export function SpotlightMovers() {
  const rows = useScanRows();
  const top = useMemo(() => {
    const usable = rows.filter(
      (row) =>
        row.changePercent !== null && (row.quoteVolume24h ?? 0) > 100_000 && row.price !== null,
    );
    return [...usable].sort(
      (a, b) => Math.abs(b.changePercent ?? 0) - Math.abs(a.changePercent ?? 0),
    )[0] as TickerRow | undefined;
  }, [rows]);

  return (
    <Panel id="06" title="SPOTLIGHT · 今日最离谱" hint="24h 极值">
      {!top ? (
        <EmptyState
          icon="sparkles"
          title="数据不足"
          text="等行情源返回足够交易对后，这里会自动挑出 24h 波动最离谱的一个。"
        />
      ) : (
        <div className="panel__body--pad" style={{ padding: 12 }}>
          <div className="spread" style={{ alignItems: "flex-start", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div className="row gap-6">
                <span className="sym__base" style={{ fontSize: 18 }}>
                  {top.base}
                </span>
                <span className="tag">{MARKET_TAG[top.market]}</span>
              </div>
              <div className="num" style={{ fontSize: 22, marginTop: 2 }}>
                <Delta value={top.changePercent} digits={2} fontSize={22} />
              </div>
              <div className="mood__note" style={{ marginTop: 6 }}>
                {formatPrice(top.price, top.decimals)} USDT · 24h 成交额{" "}
                {formatCompact(top.quoteVolume24h)}
              </div>
            </div>
            <span
              className="stamp stamp--up"
              style={{ transform: "rotate(3deg)", alignSelf: "flex-start" }}
            >
              {top.changePercent !== null && top.changePercent >= 0 ? "PUMP?" : "OUCH"}
            </span>
          </div>
          <div className="row gap-6" style={{ marginTop: 12 }}>
            <Link
              to={`/studio?symbol=${encodeURIComponent(top.symbol)}&market=${top.market}`}
              className="btn btn--sm btn--primary"
            >
              做成 Meme 卡片
            </Link>
            <Link
              to={`/charts?market=${top.market}&symbol=${encodeURIComponent(top.symbol)}`}
              className="btn btn--sm"
            >
              K 线
            </Link>
          </div>
          <p className="dim" style={{ fontSize: 10.5, marginTop: 10, lineHeight: 1.5 }}>
            仅统计已接入市场中 24h 成交额 &gt; 100K USDT 的交易对。极端涨幅常见于低流动性标的，请自行核对盘口。
          </p>
        </div>
      )}
    </Panel>
  );
}
