import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "@/components/Icons";
import { ConnectionBanner, ConnectionPill } from "@/components/shell/ConnectionPill";
import { CandleChart, type ChartStatus } from "@/features/charts/CandleChart";
import { SymbolRail } from "@/features/charts/SymbolRail";
import { StarButton } from "@/components/ui/Controls";
import { Delta } from "@/components/ui/Delta";
import { Notice, PageHead, Panel } from "@/components/ui/Panel";
import { engine } from "@/engine/engine";
import { useEngineStatus, useRow } from "@/hooks/useEngine";
import { useNow } from "@/hooks/useTimers";
import { usePreferences } from "@/stores/preferences";
import { countdown, formatCompact, formatDateTime, formatFunding, formatPrice, timeAgo } from "@/lib/format";
import { INTERVALS, MARKET_LABEL, MARKET_TAG, type Interval, type MarketId, type TickerRow } from "@/types/market";

const INDICATOR_TOGGLES: Array<{ key: "ma" | "ema" | "boll" | "rsi" | "macd" | "volume"; label: string }> = [
  { key: "ma", label: "MA" },
  { key: "ema", label: "EMA" },
  { key: "boll", label: "BOLL" },
  { key: "rsi", label: "RSI" },
  { key: "macd", label: "MACD" },
];

function InfoRail({
  market,
  symbol,
  row,
  status,
}: {
  market: MarketId;
  symbol: string;
  row: TickerRow | null;
  status: ChartStatus;
}) {
  const now = useNow(1000);
  const isPerp = market === "futures";

  return (
    <div className="chartside">
      <Panel id="02" title="合约 / 行情" hint={MARKET_LABEL[market]}>
        <div style={{ padding: 12 }}>
          <div className="chartside__price">
            <span className="label">最新成交价</span>
            <span className="chartside__big">{formatPrice(row?.price ?? null, row?.decimals ?? 2)}</span>
            <Delta value={row?.changePercent ?? null} digits={2} fontSize={13} />
          </div>

          <div className="kv" style={{ marginTop: 10 }}>
            {isPerp ? (
              <>
                <div className="kv__row">
                  <span className="kv__k">标记价格</span>
                  <span className="kv__v">{formatPrice(row?.markPrice ?? null, row?.decimals ?? 2)}</span>
                </div>
                <div className="kv__row">
                  <span className="kv__k">指数价格</span>
                  <span className="kv__v">{formatPrice(row?.indexPrice ?? null, row?.decimals ?? 2)}</span>
                </div>
                <div className="kv__row">
                  <span className="kv__k">当前资金费率</span>
                  <span className="kv__v">{formatFunding(row?.fundingRate ?? null)}</span>
                </div>
                <div className="kv__row">
                  <span className="kv__k">下次结算</span>
                  <span className="kv__v">
                    {row?.nextFundingTime ? countdown(row.nextFundingTime, now) : "不可用"}
                  </span>
                </div>
                <div className="kv__row">
                  <span className="kv__k">持仓量</span>
                  <span className="kv__v">
                    {row?.openInterest === null || row?.openInterest === undefined
                      ? "采集中"
                      : formatCompact(row.openInterest)}
                  </span>
                </div>
                <div className="kv__row">
                  <span className="kv__k">持仓量变化</span>
                  <span className="kv__v">
                    {row?.d.oiChange === null || row?.d.oiChange === undefined
                      ? "数据不足"
                      : `${row.d.oiChange >= 0 ? "+" : ""}${row.d.oiChange.toFixed(2)}%`}
                  </span>
                </div>
              </>
            ) : null}
            <div className="kv__row">
              <span className="kv__k">24h 高 / 低</span>
              <span className="kv__v">
                {formatPrice(row?.high24h ?? null, row?.decimals ?? 2)} /{" "}
                {formatPrice(row?.low24h ?? null, row?.decimals ?? 2)}
              </span>
            </div>
            <div className="kv__row">
              <span className="kv__k">24h 成交额</span>
              <span className="kv__v">{formatCompact(row?.quoteVolume24h ?? null)}</span>
            </div>
            <div className="kv__row">
              <span className="kv__k">5m / 15m</span>
              <span className="kv__v">
                <Delta value={row?.d.m5 ?? null} digits={2} arrow={false} /> /{" "}
                <Delta value={row?.d.m15 ?? null} digits={2} arrow={false} />
              </span>
            </div>
            <div className="kv__row">
              <span className="kv__k">量能倍数</span>
              <span className="kv__v">
                {row?.d.volumeSurge === null || row?.d.volumeSurge === undefined
                  ? "采集中"
                  : `${row.d.volumeSurge.toFixed(2)}× 基准`}
              </span>
            </div>
          </div>

          <div className="mood__note" style={{ marginTop: 10 }}>
            {isPerp
              ? "标记价格与最新成交价来自不同频道，二者不能混用。资金费率单位为每个结算周期。"
              : "现货没有资金费率与持仓量，因此这些字段不会显示。"}
          </div>
        </div>
      </Panel>

      <Panel id="03" title="数据状态" hint={phaseLabel(status.phase)}>
        <div style={{ padding: 12 }}>
          <div className="kv">
            <div className="kv__row">
              <span className="kv__k">K 线来源</span>
              <span className="kv__v">{status.bars} 根 · REST</span>
            </div>
            <div className="kv__row">
              <span className="kv__k">实时推送</span>
              <span className="kv__v">
                {status.live === "live" ? "已连接" : status.live === "connecting" ? "连接中" : "离线"}
              </span>
            </div>
            <div className="kv__row">
              <span className="kv__k">最后一根</span>
              <span className="kv__v">{status.lastCandleAt ? timeAgo(status.lastCandleAt, now) : "--"}</span>
            </div>
            <div className="kv__row">
              <span className="kv__k">行情更新</span>
              <span className="kv__v">{row ? timeAgo(row.receivedAt, now) : "--"}</span>
            </div>
          </div>
          {status.phase === "error" && status.error ? (
            <div style={{ marginTop: 10 }}>
              <Notice tone="error">{status.error}</Notice>
            </div>
          ) : null}
        </div>
      </Panel>

      <Panel id="04" title="快捷操作">
        <div style={{ padding: 10, display: "grid", gap: 6 }}>
          <div className="row gap-8">
            <StarButton market={market} symbol={symbol} />
            <span className="dim" style={{ fontSize: 11 }}>
              收藏 / 取消收藏
            </span>
          </div>
          <Link className="btn btn--sm" to={`/studio?market=${market}&symbol=${encodeURIComponent(symbol)}`}>
            <Icon name="sparkles" size={12} /> 生成 Meme 卡片
          </Link>
          <Link className="btn btn--sm" to={`/markets?market=${market}`}>
            <Icon name="markets" size={12} /> 打开行情表
          </Link>
          <Link className="btn btn--sm" to="/watchlist">
            <Icon name="star" size={12} /> 价格提醒
          </Link>
        </div>
      </Panel>
    </div>
  );
}

function phaseLabel(phase: ChartStatus["phase"]): string {
  return phase === "ready" ? "已就绪" : phase === "loading" ? "加载中" : phase === "error" ? "加载失败" : "不可用";
}

export function ChartsPage() {
  const [params, setParams] = useSearchParams();
  const preferences = usePreferences();
  const status = useEngineStatus();
  const now = useNow(1000);

  const marketParam = params.get("market") as MarketId | null;
  const market: MarketId =
    marketParam && ["spot", "futures", "alpha"].includes(marketParam) ? marketParam : preferences.market;
  const symbol =
    params.get("symbol") ?? preferences.lastSymbol[market] ?? (market === "alpha" ? "" : "BTCUSDT");

  const row = useRow(symbol ? `${market}:${symbol}` : null);
  const [chartStatus, setChartStatus] = useState<ChartStatus>({
    phase: "loading",
    error: null,
    live: "connecting",
    lastCandleAt: null,
    bars: 0,
  });
  const [fullscreen, setFullscreen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    engine.ensureMarkets([market]);
  }, [market]);

  useEffect(() => {
    if (!symbol) return;
    preferences.setSymbol(market, symbol);
    // Only the symbol identity is persisted; the effect intentionally ignores
    // the rest of the preferences object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market, symbol]);

  const select = (next: TickerRow) => {
    setParams({ market: next.market, symbol: next.symbol }, { replace: true });
  };

  const rails = preferences.chartRails;
  const showLeft = rails === "both" || rails === "left";
  const showRight = rails === "both" || rails === "right";

  const intervals = useMemo(() => INTERVALS.filter((item) => item !== "1M" || true), []);

  const toggleFullscreen = async () => {
    const element = panelRef.current;
    try {
      if (!document.fullscreenElement && element?.requestFullscreen) {
        await element.requestFullscreen();
        setFullscreen(true);
        return;
      }
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setFullscreen(false);
        return;
      }
    } catch {
      /* fall back to the CSS expansion below */
    }
    setFullscreen((value) => !value);
  };

  return (
    <main className="page" data-testid="charts-page">
      <PageHead
        eyebrow="CHARTS / K 线工作区"
        title={
          <>
            {(row?.base ?? symbol) || "选择交易对"}
            <em> / {MARKET_TAG[market]}</em>
          </>
        }
        desc="历史 K 线来自官方 REST，最后一根由 WebSocket 实时更新；MA / EMA / BOLL / RSI / MACD 全部在本地计算。"
        actions={
          <>
            <ConnectionPill market={market} />
            <div className="seg" role="group" aria-label="布局">
              {(["both", "left", "right", "none"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className="seg__btn"
                  data-active={rails === value}
                  onClick={() => preferences.setChartRails(value)}
                >
                  {value === "both" ? "双侧" : value === "left" ? "左侧" : value === "right" ? "右侧" : "全宽"}
                </button>
              ))}
            </div>
          </>
        }
      />

      <ConnectionBanner market={market} />

      <div className="chartpage" data-rail={rails}>
        {showLeft ? (
          <SymbolRail market={market} activeSymbol={symbol} onSelect={select} />
        ) : null}

        <div className="chartmain">
          <div
            ref={panelRef}
            className="panel"
            style={
              fullscreen
                ? { position: "fixed", inset: 10, zIndex: 80, background: "var(--panel)" }
                : undefined
            }
          >
            <header className="panel__head">
              <span className="panel__idx">01</span>
              <h2 className="panel__title">
                {(row?.symbol ?? symbol) || "—"} · {MARKET_LABEL[market]}
              </h2>
              <span className="panel__hint">
                本地指标 · {chartStatus.phase === "ready" ? `${chartStatus.bars} 根` : phaseLabel(chartStatus.phase)}
              </span>
              <div className="panel__tools">
                <span className={`pill ${chartStatus.live === "live" ? "pill--live" : "pill--warn"}`}>
                  <span className={`dot ${chartStatus.live === "live" ? "dot--live" : "dot--warn"}`} />
                  {chartStatus.live === "live" ? "K 线实时" : chartStatus.live === "connecting" ? "连接中" : "离线"}
                </span>
                <button
                  type="button"
                  className="btn btn--icon btn--ghost"
                  onClick={toggleFullscreen}
                  title="全屏"
                  aria-label="全屏"
                >
                  <Icon name="expand" size={15} />
                </button>
              </div>
            </header>

            <div className="chartbar">
              <span className="chartbar__sym">{row?.symbol ?? symbol}</span>
              <span className="chartbar__px">{formatPrice(row?.price ?? null, row?.decimals ?? 2)}</span>
              <Delta value={row?.changePercent ?? null} digits={2} fontSize={13} />
              <span className="toolbar__sep" />
              <div className="ivbar" role="group" aria-label="K 线周期">
                {intervals.map((item: Interval) => (
                  <button
                    key={item}
                    type="button"
                    className="ivbar__btn"
                    data-active={preferences.interval === item}
                    onClick={() => preferences.setInterval(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <span className="toolbar__sep" />
              <div className="row gap-4">
                {INDICATOR_TOGGLES.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className="btn btn--sm"
                    aria-pressed={preferences.indicators[item.key]}
                    onClick={() => preferences.toggleIndicator(item.key)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <span className="toolbar__spacer" />
              <span className="chart-hint">
                最后更新 {row ? timeAgo(row.receivedAt, now) : "--"}
              </span>
            </div>

            {!symbol ? (
              <div className="empty">
                <div className="empty__title">还没有选择交易对</div>
                <p className="empty__text">
                  {market === "alpha"
                    ? "Alpha 交易对不支持 K 线，请在行情表中查看 Alpha 价格与成交额。"
                    : "用左上角搜索选择交易对，或直接打开行情表点击任意一行。"}
                </p>
                <Link className="btn btn--sm" to={`/markets?market=${market}`}>
                  打开行情表
                </Link>
              </div>
            ) : market === "alpha" ? (
              <div style={{ padding: 14 }}>
                <Notice tone="warn">
                  Alpha 市场没有公开的 K 线接口，Crypto Radar 不会伪造蜡烛图。你可以在
                  <Link to="/markets?market=alpha"> Alpha 行情表 </Link>
                  查看价格、24h 涨跌幅与成交额。
                </Notice>
              </div>
            ) : (
              <CandleChart
                market={market}
                symbol={symbol}
                interval={preferences.interval}
                decimals={row?.decimals ?? 2}
                indicators={preferences.indicators}
                periods={preferences.maPeriods}
                onStatus={setChartStatus}
              />
            )}
          </div>

          <Panel id="05" title="指标说明" plain>
            <div style={{ padding: 12, fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.7 }}>
              MA / EMA / BOLL 叠加在主图；RSI 与 MACD 使用独立副图，三个图表的时间轴联动。
              指标由本地对收盘价计算，参数在<Link to="/settings"> 设置 </Link>中可调。
              最后一根未收盘 K 线会随推送实时更新；切换交易对或周期时会重新拉取历史数据并重建推送订阅。
              <span className="dim"> · 服务器时间 {formatDateTime(now)}</span>
            </div>
          </Panel>
        </div>

        {showRight ? <InfoRail market={market} symbol={symbol} row={row} status={chartStatus} /> : null}
      </div>

      {status.errors[market] ? null : null}
    </main>
  );
}
