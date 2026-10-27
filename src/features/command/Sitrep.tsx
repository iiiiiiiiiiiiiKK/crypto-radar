import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@/components/Icons";
import { Delta } from "@/components/ui/Delta";
import { Sparkline } from "@/components/ui/Sparkline";
import { useStoreVersion } from "@/hooks/useEngine";
import { useNow } from "@/hooks/useTimers";
import { engine } from "@/engine/engine";
import { useMood } from "@/hooks/useEngine";
import { moodScopeLabel } from "@/engine/mood";
import { formatCompact, formatPrice, timeAgo } from "@/lib/format";
import { usePreferences } from "@/stores/preferences";
import { useRow } from "@/hooks/useEngine";

function readSpark(key: string, points: number, _version: number): number[] {
  return engine.store.sparkline(key, points);
}

function useSpark(key: string, points = 34): number[] {
  const version = useStoreVersion();
  return useMemo(() => readSpark(key, points, version), [key, points, version]);
}

function PulseCard({ symbol, market }: { symbol: string; market: "spot" | "futures" }) {
  const row = useRow(`${market}:${symbol}`);
  const spark = useSpark(`${market}:${symbol}`);

  return (
    <Link
      to={`/charts?market=${market}&symbol=${symbol}`}
      className="stack gap-4"
      style={{ textDecoration: "none", color: "inherit", minWidth: 0 }}
    >
      <div className="pulse__row">
        <span className="pulse__sym">
          {row?.base ?? symbol.replace("USDT", "")}
          <span className="tag">USDT</span>
        </span>
        <Delta value={row?.changePercent ?? null} digits={2} fontSize={12} />
      </div>
      <div className="pulse__px">{formatPrice(row?.price ?? null, row?.decimals ?? 2)}</div>
      <Sparkline values={spark} height={30} />
    </Link>
  );
}

/**
 * SITREP — the war room status band.
 *
 * Three cells: the rule based market mood (with its own evidence), the two
 * benchmark pairs, and the coverage/breadth readout. The mood is explicitly
 * labelled as a rule-based description, never as a forecast.
 */
export function Sitrep() {
  const mood = useMood();
  const now = useNow(5000);
  const showMeme = usePreferences((state) => state.showMemeCopy);
  const scope = moodScopeLabel(["spot", "futures"]);

  const advancers = mood.breadth === null ? 0 : Math.round((mood.breadth / 100) * mood.sample);
  const decliners = Math.max(0, mood.sample - advancers);
  const breadth = mood.breadth ?? 0;

  const toneColor =
    mood.tone === "up"
      ? "var(--up)"
      : mood.tone === "down"
        ? "var(--down)"
        : mood.tone === "warn"
          ? "var(--amber)"
          : "var(--ink-2)";

  return (
    <section className="sitrep" data-testid="sitrep">
      <div className="sitrep__rings" aria-hidden="true" />
      <div className="sitrep__sweep" aria-hidden="true" />

      <div className="sitrep__cell sitrep__cell--mood">
        <div className="sitrep__eyebrow">
          <span className="dot dot--live" />
          MARKET MOOD · 规则化市场状态
        </div>
        <div className="mood">
          <div className="mood__verdict">
            <div className="mood__label" style={{ color: toneColor }} data-testid="mood-label">
              {mood.label}
            </div>
            <span className="stamp stamp--violet">NON-PREDICTIVE</span>
          </div>
          <div className="mood__sub">
            {showMeme ? mood.sub : "涨跌家数与短周期波动的规则化描述"}
          </div>
          <div className="mood__evid">
            {mood.evidence.length === 0 ? (
              <span className="tag">等待更多行情样本</span>
            ) : (
              mood.evidence.map((item) => (
                <span className="tag" key={item.label}>
                  {item.label} <b className="num">{item.value}</b>
                </span>
              ))
            )}
          </div>
          <div className="mood__note">
            样本 {mood.sample} 个交易对 · {scope} · 更新 {timeAgo(mood.updatedAt, now)}
            <br />
            由涨跌家数、中位涨跌与 15 分钟平均波动推导，不代表未来价格。
          </div>
        </div>
      </div>

      <div className="sitrep__cell sitrep__cell--bench">
        <div className="sitrep__eyebrow">
          <Icon name="waves" size={11} /> BENCHMARK · 实时价格
        </div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <PulseCard symbol="BTCUSDT" market="spot" />
          <PulseCard symbol="ETHUSDT" market="spot" />
        </div>
        <div className="mood__note" style={{ marginTop: "auto" }}>
          现货 24h 滚动统计 · 价格来自 <code className="mono">!miniTicker@arr</code>
        </div>
      </div>

      <div className="sitrep__cell sitrep__cell--third">
        <div className="sitrep__eyebrow">
          <Icon name="markets" size={11} /> COVERAGE · 当前覆盖范围
        </div>
        <div className="breadth">
          <div className="spread" style={{ alignItems: "baseline" }}>
            <span className="label">涨跌家数</span>
            <span className="num" style={{ fontSize: 13 }}>
              <span className="up">{advancers}</span>
              <span className="dim"> / </span>
              <span className="down">{decliners}</span>
            </span>
          </div>
          <div className="breadth__bar">
            <span
              className="breadth__seg"
              style={{ width: `${breadth}%`, background: "var(--up)" }}
            />
            <span
              className="breadth__seg"
              style={{ width: `${100 - breadth}%`, background: "var(--down)" }}
            />
          </div>
          <div className="breadth__legend">
            <span>上涨 {breadth.toFixed(1)}%</span>
            <span>下跌 {(100 - breadth).toFixed(1)}%</span>
          </div>
        </div>
        <div className="kv">
          <div className="kv__row">
            <span className="kv__k">24h 成交额</span>
            <span className="kv__v">{formatCompact(mood.turnover24h)}</span>
          </div>
          <div className="kv__row">
            <span className="kv__k">资金费率中位</span>
            <span className="kv__v">
              {mood.fundingMedian === null ? "不可用" : `${mood.fundingMedian.toFixed(4)}%`}
            </span>
          </div>
          <div className="kv__row">
            <span className="kv__k">历史采样</span>
            <span className="kv__v">{engine.store.trackedCount()} 个交易对</span>
          </div>
        </div>
        <div className="mood__note">
          仅为已接入市场的覆盖统计，不是全市场口径。
        </div>
      </div>
    </section>
  );
}
