import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "@/components/Icons";
import { ConnectionBanner, ConnectionPill } from "@/components/shell/ConnectionPill";
import { PageHead, Panel, EmptyState, Notice } from "@/components/ui/Panel";
import { Field, Modal, Seg, Switch } from "@/components/ui/Controls";
import { MarketGrid } from "@/features/markets/MarketGrid";
import { COLUMNS, columnsFor, sortRows } from "@/features/markets/columns";
import { engine } from "@/engine/engine";
import { useEngineStatus, useMarketRows } from "@/hooks/useEngine";
import { useIsMobile } from "@/hooks/useTimers";
import { useNow } from "@/hooks/useTimers";
import { DENSITY_ROW, usePreferences } from "@/stores/preferences";
import { useWatchKeys } from "@/stores/watchlist";
import { timeAgo } from "@/lib/format";
import { MARKET_TAG, type MarketId, type TickerRow } from "@/types/market";

const CHANGE_PRESETS = [
  { value: "all", label: "全部" },
  { value: "up5", label: "涨 > 5%" },
  { value: "down5", label: "跌 > 5%" },
  { value: "hot", label: "|涨跌| > 10%" },
] as const;

const TURNOVER_FLOORS = [
  { value: 0, label: "不限成交额" },
  { value: 100_000, label: "≥ 10 万 U" },
  { value: 1_000_000, label: "≥ 100 万 U" },
  { value: 10_000_000, label: "≥ 1000 万 U" },
];

export function MarketsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const market = usePreferences((state) => state.market);
  const setMarket = usePreferences((state) => state.setMarket);
  const setSymbol = usePreferences((state) => state.setSymbol);
  const quoteFilter = usePreferences((state) => state.quoteFilter);
  const setQuoteFilter = usePreferences((state) => state.setQuoteFilter);
  const lastSymbol = usePreferences((state) => state.lastSymbol);
  const visibleColumns = usePreferences((state) => state.columns);
  const setColumns = usePreferences((state) => state.setColumns);
  const density = usePreferences((state) => state.density);
  const setDensity = usePreferences((state) => state.setDensity);
  const status = useEngineStatus();
  const watchKeys = useWatchKeys();
  const isMobile = useIsMobile();
  const now = useNow(5000);

  const [query, setQuery] = useState("");
  const savedFilter = usePreferences((state) => state.marketsFilter);
  const setMarketsFilter = usePreferences((state) => state.setMarketsFilter);
  const changePreset = savedFilter.changePreset;
  const minTurnover = savedFilter.minTurnover;
  const onlyWatch = savedFilter.onlyWatch;
  const sort = useMemo(
    () => ({ id: savedFilter.sortId, dir: savedFilter.sortDir }),
    [savedFilter.sortId, savedFilter.sortDir],
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const rows = useMarketRows(market);

  // The URL is the source of truth for deep links, the store for the default.
  useEffect(() => {
    const fromQuery = params.get("market") as MarketId | null;
    if (fromQuery && fromQuery !== market && ["spot", "futures", "alpha"].includes(fromQuery)) {
      setMarket(fromQuery);
    }
  }, [params, market, setMarket]);

  useEffect(() => {
    engine.ensureMarkets([market]);
  }, [market]);

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setPickerOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toUpperCase();
    const result = rows.filter((row) => {
      if (quoteFilter !== "all" && row.quote !== quoteFilter) return false;
      if (needle && !row.symbol.toUpperCase().includes(needle) && !row.base.toUpperCase().includes(needle)) {
        return false;
      }
      if (minTurnover > 0 && (row.quoteVolume24h ?? 0) < minTurnover) return false;
      if (onlyWatch && !watchKeys.has(row.key)) return false;
      const change = row.changePercent;
      if (changePreset === "up5" && (change === null || change < 5)) return false;
      if (changePreset === "down5" && (change === null || change > -5)) return false;
      if (changePreset === "hot" && (change === null || Math.abs(change) < 10)) return false;
      return true;
    });
    return sortRows(result, sort.id, sort.dir);
  }, [rows, query, quoteFilter, minTurnover, onlyWatch, watchKeys, changePreset, sort]);

  const columns = useMemo(() => {
    const list = columnsFor(market, visibleColumns);
    if (!isMobile) return list;
    return list.filter((column) => ["price", "change"].includes(column.id));
  }, [market, visibleColumns, isMobile]);

  // 48px is the comfortable iOS tap target for a table row.
  const rowHeight = isMobile ? 48 : DENSITY_ROW[density];

  const activeFilterCount =
    (quoteFilter !== "USDT" ? 1 : 0) +
    (changePreset !== "all" ? 1 : 0) +
    (minTurnover > 0 ? 1 : 0) +
    (onlyWatch ? 1 : 0);

  const openRow = (row: TickerRow) => {
    setSymbol(row.market, row.symbol);
    if (row.market === "alpha") {
      navigate(`/charts?market=alpha&symbol=${encodeURIComponent(row.symbol)}`);
      return;
    }
    navigate(`/charts?market=${row.market}&symbol=${encodeURIComponent(row.symbol)}`);
  };

  const switchMarket = (next: MarketId) => {
    setMarket(next);
    setParams(next === "spot" ? {} : { market: next }, { replace: true });
    engine.ensureMarkets([next]);
  };

  const counts: Record<MarketId, number> = {
    spot: status.states.spot === "idle" ? 0 : engine.store.getRows("spot").length,
    futures: status.states.futures === "idle" ? 0 : engine.store.getRows("futures").length,
    alpha: status.states.alpha === "idle" ? 0 : engine.store.getRows("alpha").length,
  };

  return (
    <main className="page" data-testid="markets-page">
      <PageHead
        eyebrow="MARKETS / 行情终端"
        title={
          <>
            所有交易对，<em>一张表看完</em>
          </>
        }
        desc="现货、U 本位永续与 Alpha 三套市场数据分开展示，字段按市场实际能力显示。每分钟级指标全部由本地实时采样计算。"
        actions={
          <>
            <ConnectionPill market={market} />
            <button type="button" className="btn" onClick={() => engine.refresh(market)}>
              <Icon name="refresh" size={13} /> 重新同步
            </button>
          </>
        }
      />

      <ConnectionBanner market={market} />

      <Panel
        id="01"
        title={`${MARKET_TAG[market]} · 行情表`}
        hint={`${filtered.length} / ${rows.length} 个交易对`}
        bodyClass="markets__table"
        footer={
          <>
            <Icon name="wifi" size={12} />
            <span>
              币安官方公开接口 · 最后更新{" "}
              {status.lastUpdate[market] ? timeAgo(status.lastUpdate[market], now) : "等待中"}
            </span>
            <span className="toolbar__spacer" />
            <span className="markets__count">点击任意一行打开 K 线</span>
          </>
        }
      >
        <div className="toolbar">
          <Seg
            value={market}
            onChange={(next) => switchMarket(next)}
            ariaLabel="选择市场"
            options={[
              { value: "spot", label: `现货 ${counts.spot || ""}`.trim() },
              { value: "futures", label: `永续 ${counts.futures || ""}`.trim() },
              { value: "alpha", label: `Alpha ${counts.alpha || ""}`.trim() },
            ]}
          />

          <input
            className="input"
            style={{ width: 150, height: 26 }}
            placeholder="筛选交易对…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="筛选交易对"
          />

          {/* Phone only: everything else lives in a bottom sheet, so the
              toolbar stays one row instead of stacking five filters. */}
          <button
            type="button"
            className="btn btn--sm toolbar__filters"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen(true)}
          >
            <Icon name="filter" size={12} /> 筛选
            {activeFilterCount > 0 ? <span className="toolbar__badge">{activeFilterCount}</span> : null}
          </button>

          <div className="toolbar__desktop">
            <div className="toolbar__sep" />

            <select
              className="select"
              style={{ width: 96, height: 26 }}
              value={quoteFilter}
              onChange={(event) => setQuoteFilter(event.target.value as typeof quoteFilter)}
              aria-label="计价货币"
            >
              <option value="USDT">/USDT</option>
              <option value="USDC">/USDC</option>
              <option value="FDUSD">/FDUSD</option>
              <option value="BTC">/BTC</option>
              <option value="all">全部计价</option>
            </select>

            <select
              className="select"
              style={{ width: 124, height: 26 }}
              value={changePreset}
              onChange={(event) =>
                setMarketsFilter({ changePreset: event.target.value as typeof changePreset })
              }
              aria-label="涨跌幅筛选"
            >
              {CHANGE_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
            </select>

            <select
              className="select"
              style={{ width: 118, height: 26 }}
              value={minTurnover}
              onChange={(event) => setMarketsFilter({ minTurnover: Number(event.target.value) })}
              aria-label="成交额下限"
            >
              {TURNOVER_FLOORS.map((floor) => (
                <option key={floor.value} value={floor.value}>
                  {floor.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="btn btn--sm"
              aria-pressed={onlyWatch}
              onClick={() => setMarketsFilter({ onlyWatch: !onlyWatch })}
            >
              <Icon name="star" size={12} /> 仅自选
            </button>

            <div className="toolbar__spacer" />

            <div style={{ position: "relative" }} ref={pickerRef}>
              <button
                type="button"
                className="btn btn--sm"
                aria-expanded={pickerOpen}
                onClick={() => setPickerOpen((value) => !value)}
              >
                <Icon name="columns" size={12} /> 列
              </button>
              {pickerOpen ? (
                <div className="pop" style={{ width: 220, maxHeight: 320, overflow: "auto" }}>
                  <div className="pop__title">显示列</div>
                  {COLUMNS.filter((column) => column.markets.includes(market)).map((column) => (
                    <label className="pop__item" key={column.id} style={{ cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={visibleColumns.includes(column.id)}
                        onChange={(event) => {
                          setColumns(
                            event.target.checked
                              ? [...visibleColumns, column.id]
                              : visibleColumns.filter((id) => id !== column.id),
                          );
                        }}
                      />
                      {column.label}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="seg" role="group" aria-label="行高">
              {(["compact", "normal", "comfy"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  className="seg__btn"
                  data-active={density === item}
                  onClick={() => setDensity(item)}
                  title={`行高：${item}`}
                >
                  {item === "compact" ? "紧凑" : item === "normal" ? "标准" : "宽松"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {market === "alpha" ? (
          <div style={{ padding: 10 }}>
            <Notice tone="warn">
              Alpha 数据来自币安 Alpha 公开接口（轮询，约 30 秒一次），只提供价格、24h 涨跌幅、成交额等基础字段；
              <b>没有公开 K 线或 WebSocket 接口</b>，因此资金费率、持仓量等永续字段不会显示，分钟级指标也不可用。
            </Notice>
          </div>
        ) : null}

        {/* Phone filter sheet: same controls as the desktop toolbar, but
            stacked in a bottom sheet so the table keeps the screen. */}
        <Modal
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          title="筛选行情"
          footer={
            <>
              <button
                type="button"
                className="btn btn--sm"
                onClick={() => {
                  setQuoteFilter("USDT");
                  setMarketsFilter({ changePreset: "all", minTurnover: 0, onlyWatch: false });
                }}
              >
                重置
              </button>
              <button type="button" className="btn btn--sm btn--primary" onClick={() => setFiltersOpen(false)}>
                完成
              </button>
            </>
          }
        >
          <div className="filterform">
            <Field label="计价货币">
              <select
                className="select"
                value={quoteFilter}
                onChange={(event) => setQuoteFilter(event.target.value as typeof quoteFilter)}
              >
                <option value="USDT">/USDT</option>
                <option value="USDC">/USDC</option>
                <option value="FDUSD">/FDUSD</option>
                <option value="BTC">/BTC</option>
                <option value="all">全部计价</option>
              </select>
            </Field>

            <Field label="涨跌幅">
              <select
                className="select"
                value={changePreset}
                onChange={(event) =>
                  setMarketsFilter({ changePreset: event.target.value as typeof changePreset })
                }
              >
                {CHANGE_PRESETS.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="24h 成交额下限">
              <select
                className="select"
                value={minTurnover}
                onChange={(event) => setMarketsFilter({ minTurnover: Number(event.target.value) })}
              >
                {TURNOVER_FLOORS.map((floor) => (
                  <option key={floor.value} value={floor.value}>
                    {floor.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="显示">
              <div className="row gap-8" style={{ flexWrap: "wrap" }}>
                <Switch
                  checked={onlyWatch}
                  onChange={(value) => setMarketsFilter({ onlyWatch: value })}
                  label="仅自选"
                />
              </div>
            </Field>

            <Field label="行高">
              <Seg
                value={density}
                onChange={setDensity}
                options={[
                  { value: "compact", label: "紧凑" },
                  { value: "normal", label: "标准" },
                  { value: "comfy", label: "宽松" },
                ]}
              />
            </Field>

            <Field label="显示列">
              <div className="colpick">
                {COLUMNS.filter((column) => column.markets.includes(market)).map((column) => (
                  <label className="colpick__item" key={column.id}>
                    <input
                      type="checkbox"
                      checked={visibleColumns.includes(column.id)}
                      onChange={(event) => {
                        setColumns(
                          event.target.checked
                            ? [...visibleColumns, column.id]
                            : visibleColumns.filter((id) => id !== column.id),
                        );
                      }}
                    />
                    {column.label}
                  </label>
                ))}
              </div>
            </Field>
          </div>
        </Modal>

        {rows.length === 0 ? (
          status.states[market] === "error" ? (
            <EmptyState
              icon="alert"
              title="行情加载失败"
              text={status.errors[market] ?? "接口没有返回数据。"}
              action={
                <button type="button" className="btn btn--sm" onClick={() => engine.refresh(market)}>
                  重试
                </button>
              }
            />
          ) : (
            <EmptyState icon="markets" title="正在载入行情" text="首次加载会拉取全市场 24h 快照，通常需要 1-3 秒。" />
          )
        ) : (
          <MarketGrid
            rows={filtered}
            columns={columns}
            rowHeight={rowHeight}
            compact={isMobile}
            sortId={sort.id}
            sortDir={sort.dir}
            activeKey={`${market}:${lastSymbol[market] ?? ""}`}
            onSort={(id) => {
              setMarketsFilter(
                sort.id === id
                  ? { sortId: id, sortDir: sort.dir === "desc" ? "asc" : "desc" }
                  : { sortId: id, sortDir: "desc" },
              );
            }}
            onOpen={openRow}
          />
        )}
      </Panel>
    </main>
  );
}
