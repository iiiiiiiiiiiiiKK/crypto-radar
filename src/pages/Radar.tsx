import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "@/components/Icons";
import { ConnectionPill } from "@/components/shell/ConnectionPill";
import { Delta } from "@/components/ui/Delta";
import { Field, Seg, Switch } from "@/components/ui/Controls";
import { Notice, PageHead, Panel } from "@/components/ui/Panel";
import { StarButton } from "@/components/ui/Controls";
import { describeRule, runScan, SCAN_PRESETS, type ScanCondition, type ScanResult, type ScanRule } from "@/engine/scanner";
import { engine } from "@/engine/engine";
import { formatMetric, metricAvailable } from "@/engine/metrics";
import { useEngineStatus, useScanRows } from "@/hooks/useEngine";
import { useNow } from "@/hooks/useTimers";
import { usePreferences } from "@/stores/preferences";
import { useWatchKeys } from "@/stores/watchlist";
import { formatCompact, formatPrice, timeAgo } from "@/lib/format";
import {
  COMPARATOR_LABEL,
  MARKET_LABEL,
  METRIC_LABEL,
  WINDOW_LABEL,
  type Comparator,
  type MarketId,
  type MetricId,
  type MetricWindow,
} from "@/types/market";

const METRICS: MetricId[] = ["change", "volumeSurge", "turnover", "funding", "oiChange", "volatility"];
const WINDOWS: MetricWindow[] = ["1m", "5m", "15m", "1h", "24h"];
const COMPARATORS: Comparator[] = ["gte", "lte", "absGte"];

function ConditionRow({
  condition,
  onChange,
  onRemove,
}: {
  condition: ScanCondition;
  onChange: (next: ScanCondition) => void;
  onRemove: () => void;
}) {
  return (
    <div className="cond">
      <select
        className="select"
        value={condition.metric}
        onChange={(event) => onChange({ ...condition, metric: event.target.value as MetricId })}
        aria-label="指标"
      >
        {METRICS.map((metric) => (
          <option key={metric} value={metric}>
            {METRIC_LABEL[metric]}
          </option>
        ))}
      </select>
      <select
        className="select"
        value={condition.window}
        onChange={(event) => onChange({ ...condition, window: event.target.value as MetricWindow })}
        aria-label="周期"
      >
        {WINDOWS.map((window) => (
          <option key={window} value={window}>
            {WINDOW_LABEL[window]}
          </option>
        ))}
      </select>
      <select
        className="select"
        value={condition.comparator}
        onChange={(event) => onChange({ ...condition, comparator: event.target.value as Comparator })}
        aria-label="比较方式"
      >
        {COMPARATORS.map((comparator) => (
          <option key={comparator} value={comparator}>
            {COMPARATOR_LABEL[comparator]}
          </option>
        ))}
      </select>
      <input
        className="input"
        type="number"
        step="0.1"
        value={condition.value}
        onChange={(event) => onChange({ ...condition, value: Number(event.target.value) })}
        aria-label="阈值"
      />
      <button type="button" className="cond__del" onClick={onRemove} aria-label="删除条件">
        <Icon name="close" size={12} />
      </button>
    </div>
  );
}

export function RadarPage() {
  const navigate = useNavigate();
  const rule = usePreferences((state) => state.radarRule);
  const setRule = usePreferences((state) => state.setRadarRule);
  const rows = useScanRows();
  const watchKeys = useWatchKeys();
  const status = useEngineStatus();
  const now = useNow(2000);

  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const [active, setActive] = useState(true);
  const [result, setResult] = useState<ScanResult | null>(null);

  const marketsLive =
    (status.states.spot === "live" || status.states.spot === "stale") ||
    (status.states.futures === "live" || status.states.futures === "stale");

  useEffect(() => {
    if (!active) return;
    const run = () =>
      setResult(runScan(rowsRef.current, rule, { watchKeys, now: Date.now() }));
    run();
    const timer = setInterval(run, 2500);
    return () => clearInterval(timer);
  }, [active, rule, watchKeys]);

  const hits = result?.hits ?? [];
  const updateRule = (patch: Partial<ScanRule>) => setRule({ ...rule, ...patch });

  const windowReady = useMemo(
    () => rows.filter((row) => row.d.m5 !== null).length,
    [rows],
  );
  const warmup = rows.length > 0 && windowReady / rows.length < 0.5;

  const presetId = useMemo(
    () => SCAN_PRESETS.find((preset) => preset.name === rule.name)?.id ?? "custom",
    [rule.name],
  );

  const applyPreset = (id: string) => {
    const preset = SCAN_PRESETS.find((item) => item.id === id);
    if (!preset) return;
    setRule({ ...preset, limit: rule.limit, onlyWatchlist: rule.onlyWatchlist });
  };

  return (
    <main className="page" data-testid="radar-page">
      <PageHead
        eyebrow="RADAR / 异动扫描引擎"
        title={
          <>
            按你的规则，<em>捕捉市场异动</em>
          </>
        }
        desc="扫描全部基于本地对实时行情的计算：涨跌幅窗口、成交额相对基准倍数、资金费率与持仓量变化。规则可以任意组合，阈值随时可改。"
        actions={
          <>
            <ConnectionPill />
            <button type="button" className="btn" aria-pressed={active} onClick={() => setActive((v) => !v)}>
              <Icon name={active ? "pause" : "play"} size={13} />
              {active ? "暂停扫描" : "继续扫描"}
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => setResult(null)}
              title="清空当前结果"
            >
              <Icon name="trash" size={13} /> 清空
            </button>
          </>
        }
      />

      <div className={`radar__banner`} data-active={active && marketsLive}>
        <span className="radar__beam" aria-hidden="true" />
        <div>
          <div className="radar__banner-title">
            {active ? (marketsLive ? "SCANNING · 扫描中" : "WAITING · 等待行情源") : "PAUSED · 已暂停"}
          </div>
          <div className="dim" style={{ fontSize: 11 }}>
            规则：{describeRule(rule)}
          </div>
        </div>
        <div className="radar__banner-stats">
          <div className="scanstat">
            <span className="scanstat__v">{result?.evaluated ?? 0}</span>
            <span className="scanstat__k">参与评估</span>
          </div>
          <div className="scanstat">
            <span className="scanstat__v">{hits.length}</span>
            <span className="scanstat__k">命中</span>
          </div>
          <div className="scanstat">
            <span className="scanstat__v">
              {windowReady}/{rows.length}
            </span>
            <span className="scanstat__k">5m 窗口可用</span>
          </div>
          <div className="scanstat">
            <span className="scanstat__v">{result?.missing ?? 0}</span>
            <span className="scanstat__k">数据不足</span>
          </div>
          <div className="scanstat">
            <span className="scanstat__v">{result ? `${Math.round((now - result.scannedAt) / 1000)}s` : "--"}</span>
            <span className="scanstat__k">上次扫描</span>
          </div>
        </div>
      </div>

      {!marketsLive ? (
        <Notice tone="warn">
          行情源尚未进入实时状态，扫描结果可能为空或停留在上一轮。请检查右上角的连接状态。
        </Notice>
      ) : null}

      {warmup ? (
        <Notice tone="warn">
          短周期指标正在预热：已用 1 分钟 K 线补种 {engine.seededCoverage} 个高流动性交易对，
          其余交易对的 5m/15m 窗口需要本地累计约 5 分钟采样后才会出现。当前可用{" "}
          {windowReady} / {rows.length} 个，期间这些交易对会被标记为“数据不足”而不是误判。
        </Notice>
      ) : null}

      <div className="radar">
        <Panel id="01" title="SCAN CONFIG · 扫描规则" hint={presetId === "custom" ? "自定义" : "预设"}>
          <div className="rulebox">
            <div className="rulebox__presets">
              {SCAN_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="rulebox__preset"
                  data-active={presetId === preset.id}
                  onClick={() => applyPreset(preset.id)}
                >
                  {preset.name}
                </button>
              ))}
              <button
                type="button"
                className="rulebox__preset"
                data-active={presetId === "custom"}
                onClick={() => updateRule({ name: "自定义规则" })}
              >
                自定义
              </button>
            </div>

            <Field label="目标市场">
              <div className="row gap-8" style={{ flexWrap: "wrap" }}>
                {(["spot", "futures", "alpha"] as MarketId[]).map((market) => {
                  const checked = rule.markets.includes(market);
                  return (
                    <button
                      key={market}
                      type="button"
                      className="btn btn--sm"
                      aria-pressed={checked}
                      onClick={() =>
                        updateRule({
                          markets: checked
                            ? rule.markets.filter((item) => item !== market)
                            : [...rule.markets, market],
                          name: "自定义规则",
                        })
                      }
                    >
                      {MARKET_LABEL[market]}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label={`条件（${rule.logic === "and" ? "全部满足" : "任一满足"}）`}>
              <div className="stack gap-6">
                {rule.conditions.map((condition, index) => (
                  <ConditionRow
                    key={index}
                    condition={condition}
                    onChange={(next) => {
                      const conditions = [...rule.conditions];
                      conditions[index] = next;
                      updateRule({ conditions, name: "自定义规则" });
                    }}
                    onRemove={() =>
                      updateRule({
                        conditions: rule.conditions.filter((_, i) => i !== index),
                        name: "自定义规则",
                      })
                    }
                  />
                ))}
                <div className="row gap-8">
                  <button
                    type="button"
                    className="btn btn--sm"
                    onClick={() =>
                      updateRule({
                        conditions: [
                          ...rule.conditions,
                          { metric: "change", window: "5m", comparator: "gte", value: 3 },
                        ],
                        name: "自定义规则",
                      })
                    }
                  >
                    <Icon name="plus" size={11} /> 添加条件
                  </button>
                  <Seg
                    value={rule.logic}
                    onChange={(logic) => updateRule({ logic, name: "自定义规则" })}
                    options={[
                      { value: "and", label: "AND" },
                      { value: "or", label: "OR" },
                    ]}
                  />
                </div>
              </div>
            </Field>

            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Field label="成交额下限 (USDT)">
                <input
                  className="input"
                  type="number"
                  min={0}
                  step={50000}
                  value={rule.minTurnover}
                  onChange={(event) => updateRule({ minTurnover: Number(event.target.value), name: "自定义规则" })}
                />
              </Field>
              <Field label="最多结果">
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={200}
                  value={rule.limit}
                  onChange={(event) => updateRule({ limit: Number(event.target.value) })}
                />
              </Field>
              <Field label="排序">
                <select
                  className="select"
                  value={rule.sortBy}
                  onChange={(event) => updateRule({ sortBy: event.target.value as ScanRule["sortBy"] })}
                >
                  <option value="trigger">触发强度</option>
                  <option value="changeDesc">24h 涨幅</option>
                  <option value="turnoverDesc">成交额</option>
                </select>
              </Field>
              <Field label="数据新鲜度">
                <select
                  className="select"
                  value={rule.maxAgeMs}
                  onChange={(event) => updateRule({ maxAgeMs: Number(event.target.value) })}
                >
                  <option value={30000}>30 秒内</option>
                  <option value={60000}>60 秒内</option>
                  <option value={180000}>3 分钟内</option>
                </select>
              </Field>
            </div>

            <Switch
              checked={rule.onlyWatchlist}
              onChange={(value) => updateRule({ onlyWatchlist: value })}
              label="只扫描自选交易对"
            />

            <div className="mood__note">
              条件里的成交额、量能倍数与持仓量变化都需要先积累本地采样：量能约 5 分钟，持仓量约 5-10 分钟。
              在此之前符合条件的交易对会显示“数据不足”，不会被误判为命中。
            </div>
          </div>
        </Panel>

        <Panel
          id="02"
          title="SCAN RESULTS · 扫描结果"
          hint={`${hits.length} 条`}
          bodyClass="grow"
          footer={
            <>
              <Icon name="info" size={12} />
              <span>规则触发结果 ≠ 交易信号 · 数据来自币安官方公开接口</span>
              <span className="toolbar__spacer" />
              <Link to="/markets" className="feed__link">
                在行情表查看 ↗
              </Link>
            </>
          }
        >
          <div className="results__head">
            <span>交易对</span>
            <span>最新价</span>
            <span>24h%</span>
            <span>成交额</span>
            <span>触发条件</span>
            <span>操作</span>
          </div>
          <div className="results__scroll">
            {hits.length === 0 ? (
              <div className="empty">
                <div className="empty__glyph">
                  <Icon name="waves" size={26} />
                </div>
                <div className="empty__title">{active ? "当前没有符合条件的交易对" : "扫描已暂停"}</div>
                <p className="empty__text">
                  {active
                    ? `已评估 ${result?.evaluated ?? 0} 个交易对。可以放宽阈值、增加条件或切换预设。`
                    : "点击右上角“继续扫描”恢复实时扫描。"}
                </p>
              </div>
            ) : (
              hits.map((hit) => {
                const row = hit.row;
                return (
                  <div
                    className="results__row"
                    key={row.key}
                    data-tone={(row.changePercent ?? 0) >= 0 ? "up" : "down"}
                  >
                    <span className="row gap-6" style={{ minWidth: 0 }}>
                      <button
                        type="button"
                        className="feed__link"
                        onClick={() =>
                          navigate(
                            `/charts?market=${row.market}&symbol=${encodeURIComponent(row.symbol)}`,
                          )
                        }
                        style={{ color: "var(--ink)" }}
                      >
                        {row.symbol}
                      </button>
                      <span className="tag">{MARKET_LABEL[row.market]}</span>
                      <span className="dim" style={{ fontSize: 9.5 }}>
                        {timeAgo(hit.age === 0 ? Date.now() : Date.now() - hit.age)}
                      </span>
                    </span>
                    <span>{formatPrice(row.price, row.decimals)}</span>
                    <span>
                      <Delta value={row.changePercent} digits={2} arrow={false} />
                    </span>
                    <span className="dim">{formatCompact(row.quoteVolume24h)}</span>
                    <span className="results__trigger">
                      {hit.triggers.map((trigger, index) => (
                        <span className="tag" key={`${trigger.label}-${index}`}>
                          {trigger.label} <b style={{ marginLeft: 3 }}>{trigger.value}</b>
                        </span>
                      ))}
                    </span>
                    <span className="row gap-4" style={{ justifyContent: "flex-end" }}>
                      <StarButton market={row.market} symbol={row.symbol} />
                      <button
                        type="button"
                        className="btn btn--sm"
                        onClick={() =>
                          navigate(
                            `/charts?market=${row.market}&symbol=${encodeURIComponent(row.symbol)}`,
                          )
                        }
                      >
                        K 线
                      </button>
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </Panel>
      </div>

      <Notice>
        Radar 是市场数据筛选工具：它把满足你条件的交易对挑出来，并说明每条结果是哪个指标越过了哪个阈值。
        它<strong>不预测价格</strong>，也不构成任何投资建议。Meme 文案只解释数据，不改变数据的含义。
      </Notice>

      <Panel id="03" title="指标可用性" hint="按市场">
        <div style={{ padding: 12, display: "grid", gap: 8 }}>
          {(["spot", "futures", "alpha"] as MarketId[]).map((market) => (
            <div key={market} className="row gap-8" style={{ flexWrap: "wrap" }}>
              <span className="tag" style={{ minWidth: 62 }}>
                {MARKET_LABEL[market]}
              </span>
              {METRICS.map((metric) => {
                const available = metricAvailable(market, metric);
                return (
                  <span
                    className="tag"
                    key={metric}
                    style={{
                      opacity: available ? 1 : 0.4,
                      borderColor: available ? "var(--line-2)" : "var(--line)",
                    }}
                    title={available ? "可用" : "该市场没有这个数据源"}
                  >
                    {METRIC_LABEL[metric]}
                    {available ? "" : " · 不可用"}
                  </span>
                );
              })}
            </div>
          ))}
          <div className="dim" style={{ fontSize: 10.5 }}>
            举例：{formatMetric("change", 3.42)} · {formatMetric("volumeSurge", 2.6)} ·{" "}
            {formatMetric("funding", 0.0123)} · {formatMetric("oiChange", null)}
          </div>
        </div>
      </Panel>
    </main>
  );
}
