import { Link } from "react-router-dom";
import { EventFeed } from "@/features/command/EventFeed";
import { MoversBoard, SpotlightMovers, WatchStrip } from "@/features/command/Boards";
import { Sitrep } from "@/features/command/Sitrep";
import { ConnectionPill } from "@/components/shell/ConnectionPill";
import { Icon } from "@/components/Icons";
import { PageHead, Panel } from "@/components/ui/Panel";
import { engine } from "@/engine/engine";
import { useEngineStatus, useMarketRows } from "@/hooks/useEngine";
import { useNow } from "@/hooks/useTimers";
import { timeAgo } from "@/lib/format";
import { MARKET_LABEL, type MarketId } from "@/types/market";

function SourceRow({ market }: { market: MarketId }) {
  const status = useEngineStatus();
  const rows = useMarketRows(market === "alpha" && !status.started.includes("alpha") ? "spot" : market);
  const now = useNow(5000);
  const state = status.states[market];
  const tone =
    state === "live" ? "live" : state === "error" || state === "offline" ? "bad" : "warn";

  return (
    <div className="kv__row">
      <span className="kv__k">{MARKET_LABEL[market]}</span>
      <span className="kv__v" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span className={`dot dot--${tone}`} />
        <span style={{ color: "var(--ink-2)" }}>
          {market === "spot" || market === "futures" ? `${rows.length} 对` : `${rows.length} tokens`}
        </span>
        <span className="dim">{status.lastUpdate[market] ? timeAgo(status.lastUpdate[market], now) : "--"}</span>
      </span>
    </div>
  );
}

function SourcesPanel() {
  return (
    <Panel id="07" title="DATA SOURCES · 数据源" hint="官方公开接口">
      <div style={{ padding: 12 }}>
        <SourceRow market="spot" />
        <SourceRow market="futures" />
        <SourceRow market="alpha" />
        <div className="mood__note" style={{ marginTop: 10 }}>
          现货与永续通过<strong>共享 WebSocket</strong>（各 1 条连接）推送全市场行情；Alpha 没有公开 WebSocket，以轮询方式更新，因此不参与分钟级异动扫描。
        </div>
      </div>
    </Panel>
  );
}

function QuickActions() {
  const actions = [
    { to: "/radar", icon: "waves" as const, title: "异动雷达", desc: "自定义阈值扫描" },
    { to: "/charts", icon: "chart" as const, title: "K 线工作区", desc: "多周期 + 指标" },
    { to: "/studio", icon: "sparkles" as const, title: "Meme Studio", desc: "行情卡片导出" },
    { to: "/watchlist", icon: "star" as const, title: "自选工作台", desc: "分组与价格提醒" },
  ];

  return (
    <Panel id="08" title="QUICK ACCESS · 快速入口">
      <div style={{ padding: 10, display: "grid", gap: 6 }}>
        {actions.map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className="search__row"
            style={{ border: "1px solid var(--line)", background: "#0a0f14" }}
          >
            <Icon name={action.icon} size={15} style={{ color: "var(--up)" }} />
            <span style={{ minWidth: 0 }}>
              <span className="search__sym" style={{ display: "block" }}>
                {action.title}
              </span>
              <span className="dim" style={{ fontSize: 10.5 }}>
                {action.desc}
              </span>
            </span>
            <span className="toolbar__spacer" />
            <Icon name="chevron-right" size={13} className="dim" />
          </Link>
        ))}
        <p className="dim" style={{ fontSize: 10.5, marginTop: 4 }}>
          快捷键 <kbd>/</kbd> 搜索 · <kbd>R</kbd> 雷达 · <kbd>C</kbd> K 线 · <kbd>F</kbd> 收藏
        </p>
      </div>
    </Panel>
  );
}

export function CommandCenter() {
  return (
    <main className="page" data-testid="command-center">
      <PageHead
        eyebrow="COMMAND CENTER / 作战室"
        title={
          <>
            市场正在<em>发生什么</em>
          </>
        }
        desc="真实行情打底，异动当主角。左侧是规则驱动的实时播报，右侧是榜单和你的自选。所有数字都来自币安官方公开接口。"
        actions={
          <>
            <ConnectionPill />
            <button type="button" className="btn" onClick={() => engine.refresh()}>
              <Icon name="refresh" size={13} /> 同步行情
            </button>
            <Link to="/markets" className="btn btn--primary">
              打开行情表
            </Link>
          </>
        }
      />

      <Sitrep />

      <div className="grid">
        <div className="col-7">
          <EventFeed />
        </div>
        <div className="col-5 stack gap-16" style={{ gap: "var(--gap)" }}>
          <MoversBoard />
          <WatchStrip />
        </div>
      </div>

      <div className="grid">
        <div className="col-4">
          <SpotlightMovers />
        </div>
        <div className="col-4">
          <SourcesPanel />
        </div>
        <div className="col-4 hide-sm">
          <QuickActions />
        </div>
      </div>
    </main>
  );
}
