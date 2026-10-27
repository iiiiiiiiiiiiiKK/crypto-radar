import { engine } from "@/engine/engine";
import { useEngineStatus } from "@/hooks/useEngine";
import { useNow } from "@/hooks/useTimers";
import { MARKET_TAG } from "@/types/market";
import type { ConnectionState, MarketId } from "@/types/market";

const STATE_LABEL: Record<ConnectionState, string> = {
  idle: "待机",
  connecting: "连接中",
  live: "实时",
  stale: "数据延迟",
  reconnecting: "重连中",
  offline: "已断开",
  error: "连接异常",
};

const STATE_TONE: Record<ConnectionState, "live" | "warn" | "bad" | "idle"> = {
  idle: "idle",
  connecting: "warn",
  live: "live",
  stale: "warn",
  reconnecting: "warn",
  offline: "bad",
  error: "bad",
};

export function ConnectionPill({ market }: { market?: MarketId }) {
  const status = useEngineStatus();
  const now = useNow(1000);

  const states = market ? [market] : (["spot", "futures"] as MarketId[]);
  const state: ConnectionState = states
    .map((id) => status.states[id])
    .sort((a, b) => Number(priority(a)) - Number(priority(b)))[0] ?? "idle";

  const lastUpdate = market
    ? status.lastUpdate[market]
    : Math.max(status.lastUpdate.spot ?? 0, status.lastUpdate.futures ?? 0) || null;

  const tone = STATE_TONE[state];
  const age = lastUpdate ? Math.max(0, Math.round((now - lastUpdate) / 1000)) : null;

  return (
    <span
      className={`pill ${tone === "live" ? "pill--live" : tone === "warn" ? "pill--warn" : tone === "bad" ? "pill--bad" : ""}`}
      data-testid="connection-pill"
      data-state={state}
      title={
        lastUpdate
          ? `最后数据：${new Date(lastUpdate).toLocaleTimeString("en-GB", { hour12: false })}`
          : "尚未收到行情数据"
      }
    >
      <span className={`dot dot--${tone}`} />
      {market ? MARKET_TAG[market] : "FEED"} {STATE_LABEL[state]}
      {age !== null ? <span className="dim">{age}s</span> : null}
    </span>
  );
}

/** Lower number = more severe, so a degraded channel wins the summary pill. */
function priority(state: ConnectionState): number {
  switch (state) {
    case "error":
    case "offline":
      return 0;
    case "reconnecting":
    case "stale":
      return 1;
    case "connecting":
      return 2;
    case "live":
      return 3;
    default:
      return 1;
  }
}

export function SocketRow({ market }: { market: MarketId }) {
  const status = useEngineStatus();
  const state = status.states[market];
  const tone = STATE_TONE[state];
  return (
    <div className="rail__sock-row" title={`${MARKET_TAG[market]} · ${STATE_LABEL[state]}`}>
      <span className={`dot dot--${tone}`} />
      <span>{MARKET_TAG[market]}</span>
    </div>
  );
}

export function ConnectionBanner({ market }: { market: MarketId }) {
  const status = useEngineStatus();
  const state = status.states[market];
  const error = status.errors[market];
  const now = useNow(2000);
  const lastUpdate = status.lastUpdate[market];
  const age = lastUpdate ? Math.round((now - lastUpdate) / 1000) : null;

  if (state === "live" && !error) return null;

  return (
    <div className={`notice ${state === "error" || state === "offline" ? "notice--error" : "notice--warn"}`}>
      <span className="notice__icon">!</span>
      <div className="grow">
        <b>{STATE_LABEL[state]}</b>
        {age !== null ? ` · 最后更新 ${age} 秒前` : ""}
        {error ? ` · ${error}` : " · 正在自动重连，界面会保留最后一份有效数据并标注时间。"}
      </div>
      <button type="button" className="btn btn--sm" onClick={() => engine.refresh(market)}>
        立即重试
      </button>
    </div>
  );
}
