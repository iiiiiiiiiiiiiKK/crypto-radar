import { Link } from "react-router-dom";
import { Field, Seg, Switch } from "@/components/ui/Controls";
import { Notice, PageHead, Panel } from "@/components/ui/Panel";
import { engine } from "@/engine/engine";
import { DEFAULT_EVENT_THRESHOLDS } from "@/engine/events";
import { useEngineStatus } from "@/hooks/useEngine";
import { usePreferences } from "@/stores/preferences";
import { clearAll, isStorageAvailable } from "@/lib/storage";
import { useWatchlist } from "@/stores/watchlist";
import { useAlerts } from "@/stores/alerts";
import { useToasts } from "@/stores/ui";
import { INTERVALS, type Interval, type MarketId } from "@/types/market";

function Row({ name, hint, children }: { name: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="set__row">
      <div className="set__label">
        <span className="set__name">{name}</span>
        {hint ? <span className="set__hint">{hint}</span> : null}
      </div>
      <div className="set__control">{children}</div>
    </div>
  );
}

export function SettingsPage() {
  const prefs = usePreferences();
  const status = useEngineStatus();
  const pushToast = useToasts((state) => state.push);
  const thresholds = prefs.eventThresholds;
  const storageOk = isStorageAvailable();

  const setThreshold = (key: keyof typeof thresholds, value: number) => {
    const next = { ...thresholds, [key]: value };
    prefs.setEventThresholds(next);
    engine.setEventThresholds(next);
  };

  return (
    <main className="page" data-testid="settings-page">
      <PageHead
        eyebrow="SETTINGS / 偏好设置"
        title={
          <>
            把作战室<em>调成你的样子</em>
          </>
        }
        desc="所有偏好都保存在本机浏览器。行情本身永远来自币安官方公开接口，不需要 API Key。"
      />

      <div className="settings">
        <div className="col-6">
          <Panel id="01" title="界面与动效">
            <div style={{ padding: "4px 12px 12px" }}>
              <Row name="动效" hint="减弱动效会关闭扫描线与跑马灯动画">
                <Seg
                  value={prefs.motion}
                  onChange={prefs.setMotion}
                  options={[
                    { value: "full", label: "完整" },
                    { value: "calm", label: "减弱" },
                  ]}
                />
              </Row>
              <Row name="Meme 文案" hint="关闭后只保留数据说明，不带调侃语气">
                <Switch checked={prefs.showMemeCopy} onChange={prefs.setShowMemeCopy} label="显示" />
              </Row>
              <Row name="表格行高">
                <Seg
                  value={prefs.density}
                  onChange={prefs.setDensity}
                  options={[
                    { value: "compact", label: "紧凑" },
                    { value: "normal", label: "标准" },
                    { value: "comfy", label: "宽松" },
                  ]}
                />
              </Row>
              <Row name="图表布局" hint="控制 K 线页左右侧栏的显示">
                <Seg
                  value={prefs.chartRails}
                  onChange={prefs.setChartRails}
                  options={[
                    { value: "both", label: "双侧" },
                    { value: "left", label: "左侧" },
                    { value: "right", label: "右侧" },
                    { value: "none", label: "全宽" },
                  ]}
                />
              </Row>
              <Row name="默认市场">
                <select
                  className="select"
                  value={prefs.market}
                  onChange={(event) => prefs.setMarket(event.target.value as MarketId)}
                >
                  <option value="spot">现货</option>
                  <option value="futures">U 本位永续</option>
                  <option value="alpha">Alpha</option>
                </select>
              </Row>
              <Row name="默认周期">
                <select
                  className="select"
                  value={prefs.interval}
                  onChange={(event) => prefs.setInterval(event.target.value as Interval)}
                >
                  {INTERVALS.map((interval) => (
                    <option key={interval} value={interval}>
                      {interval}
                    </option>
                  ))}
                </select>
              </Row>
            </div>
          </Panel>
        </div>

        <div className="col-6">
          <Panel id="02" title="K 线指标参数">
            <div style={{ padding: "4px 12px 12px" }}>
              <Row name="MA 1" hint="主图叠加的第一条均线">
                <input
                  className="input"
                  type="number"
                  min={2}
                  max={200}
                  value={prefs.maPeriods.ma1}
                  onChange={(event) => prefs.setMaPeriod("ma1", Number(event.target.value))}
                />
              </Row>
              <Row name="MA 2">
                <input
                  className="input"
                  type="number"
                  min={2}
                  max={300}
                  value={prefs.maPeriods.ma2}
                  onChange={(event) => prefs.setMaPeriod("ma2", Number(event.target.value))}
                />
              </Row>
              <Row name="EMA">
                <input
                  className="input"
                  type="number"
                  min={2}
                  max={200}
                  value={prefs.maPeriods.ema}
                  onChange={(event) => prefs.setMaPeriod("ema", Number(event.target.value))}
                />
              </Row>
              <Row name="BOLL 周期">
                <input
                  className="input"
                  type="number"
                  min={5}
                  max={100}
                  value={prefs.maPeriods.boll}
                  onChange={(event) => prefs.setMaPeriod("boll", Number(event.target.value))}
                />
              </Row>
              <Row name="RSI 周期">
                <input
                  className="input"
                  type="number"
                  min={2}
                  max={50}
                  value={prefs.maPeriods.rsi}
                  onChange={(event) => prefs.setMaPeriod("rsi", Number(event.target.value))}
                />
              </Row>
              <Row name="默认显示的指标">
                <div className="row gap-4" style={{ flexWrap: "wrap" }}>
                  {(["ma", "ema", "boll", "rsi", "macd"] as const).map((key) => (
                    <button
                      key={key}
                      type="button"
                      className="btn btn--sm"
                      aria-pressed={prefs.indicators[key]}
                      onClick={() => prefs.toggleIndicator(key)}
                    >
                      {key.toUpperCase()}
                    </button>
                  ))}
                </div>
              </Row>
            </div>
          </Panel>
        </div>

        <div className="col-6">
          <Panel id="03" title="异动雷达阈值" hint="默认规则">
            <div style={{ padding: "4px 12px 12px" }}>
              <Row name="1 分钟急拉/急跌" hint="单位 %，配合成交额下限判断">
                <input
                  className="input"
                  type="number"
                  step="0.1"
                  value={thresholds.flashPercent}
                  onChange={(event) => setThreshold("flashPercent", Number(event.target.value))}
                />
              </Row>
              <Row name="5 分钟涨跌幅">
                <input
                  className="input"
                  type="number"
                  step="0.1"
                  value={thresholds.surgePercent}
                  onChange={(event) => setThreshold("surgePercent", Number(event.target.value))}
                />
              </Row>
              <Row name="成交额放大倍数" hint="相对最近 15 分钟的每分钟成交额基准">
                <input
                  className="input"
                  type="number"
                  step="0.1"
                  value={thresholds.volumeSurge}
                  onChange={(event) => setThreshold("volumeSurge", Number(event.target.value))}
                />
              </Row>
              <Row name="资金费率阈值" hint="单位 %，每个结算周期">
                <input
                  className="input"
                  type="number"
                  step="0.005"
                  value={thresholds.fundingPercent}
                  onChange={(event) => setThreshold("fundingPercent", Number(event.target.value))}
                />
              </Row>
              <Row name="持仓量变化">
                <input
                  className="input"
                  type="number"
                  step="0.5"
                  value={thresholds.oiPercent}
                  onChange={(event) => setThreshold("oiPercent", Number(event.target.value))}
                />
              </Row>
              <Row name="同一规则冷却" hint="毫秒，避免持续满足条件时刷屏">
                <input
                  className="input"
                  type="number"
                  step="10000"
                  value={thresholds.cooldownMs}
                  onChange={(event) => setThreshold("cooldownMs", Number(event.target.value))}
                />
              </Row>
              <div className="row gap-6" style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={() => {
                    prefs.setEventThresholds(DEFAULT_EVENT_THRESHOLDS);
                    engine.setEventThresholds(DEFAULT_EVENT_THRESHOLDS);
                    pushToast({ tone: "info", title: "已恢复默认阈值" });
                  }}
                >
                  恢复默认
                </button>
                <Link className="btn btn--sm" to="/radar">
                  打开雷达
                </Link>
              </div>
            </div>
          </Panel>
        </div>

        <div className="col-6">
          <Panel id="04" title="数据与本地存储">
            <div style={{ padding: "4px 12px 12px" }}>
              <Row name="本地存储" hint="自选、提醒、偏好、扫描规则">
                <span className={`pill ${storageOk ? "pill--live" : "pill--bad"}`}>
                  {storageOk ? "可用" : "不可用"}
                </span>
              </Row>
              <Row name="行情通道" hint="现货 + 永续各一条共享 WebSocket">
                <span className="pill pill--blue">
                  {status.states.spot === "live" ? "现货已连接" : "现货异常"} /{" "}
                  {status.states.futures === "live" ? "永续已连接" : "永续异常"}
                </span>
              </Row>
              <Row name="历史采样覆盖">
                <span className="num">{engine.store.trackedCount()} 个交易对</span>
              </Row>
              <Row name="持仓量采样">
                <span className="num">{engine.openInterestCoverage} 个合约</span>
              </Row>
              <Row name="清空本地数据" hint="自选、提醒、偏好与扫描规则都会重置">
                <button
                  type="button"
                  className="btn btn--sm btn--danger"
                  onClick={() => {
                    clearAll();
                    useWatchlist.getState().clear();
                    useAlerts.getState().clear();
                    prefs.resetPreferences();
                    pushToast({ tone: "warn", title: "本地数据已清空", text: "刷新页面后恢复默认设置。" });
                  }}
                >
                  清空
                </button>
              </Row>
            </div>
          </Panel>
        </div>

        <div className="col-12">
          <Panel id="05" title="关于数据源">
            <div style={{ padding: 12, display: "grid", gap: 10 }}>
              <Notice>
                行情通过浏览器直连币安官方公开接口：现货 <code className="mono">api.binance.com</code>，
                永续 <code className="mono">fapi.binance.com</code>，实时推送使用
                <code className="mono"> stream.binance.com</code> 与 <code className="mono">fstream.binance.com</code>。
                不需要 API Key，也不会把任何密钥放进浏览器。
              </Notice>
              <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
                <Field label="现货全市场 24h">
                  <span className="dim" style={{ fontSize: 11 }}>
                    REST /api/v3/ticker/24hr + 流 !miniTicker@arr
                  </span>
                </Field>
                <Field label="永续全市场 24h">
                  <span className="dim" style={{ fontSize: 11 }}>
                    REST /fapi/v1/ticker/24hr + 流 !miniTicker@arr
                  </span>
                </Field>
                <Field label="资金费率 / 标记价格">
                  <span className="dim" style={{ fontSize: 11 }}>
                    流 !markPrice@arr@1s + REST /fapi/v1/premiumIndex
                  </span>
                </Field>
                <Field label="持仓量">
                  <span className="dim" style={{ fontSize: 11 }}>
                    REST /fapi/v1/openInterest（逐交易对轮询）
                  </span>
                </Field>
                <Field label="K 线">
                  <span className="dim" style={{ fontSize: 11 }}>
                    REST /api/v3/klines、/fapi/v1/klines + 流 kline_&lt;interval&gt;
                  </span>
                </Field>
                <Field label="Alpha">
                  <span className="dim" style={{ fontSize: 11 }}>
                    公开 web 接口轮询（非官方文档接口，无 K 线/WS）
                  </span>
                </Field>
              </div>
              <div className="dim" style={{ fontSize: 11, lineHeight: 1.7 }}>
                Crypto Radar 2.0 · 本地指标（MA / EMA / BOLL / RSI / MACD、量能倍数、持仓量变化、涨跌幅窗口）
                全部由前端基于交易所原始数据计算，界面上不会把它们标注为交易所字段。
                <Link to="/radar">在雷达页</Link>可以查看每条规则的触发依据。
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </main>
  );
}
