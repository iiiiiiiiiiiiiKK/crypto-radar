import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@/components/Icons";
import { Delta } from "@/components/ui/Delta";
import { EmptyState, Panel } from "@/components/ui/Panel";
import { StarButton } from "@/components/ui/Controls";
import { RULE_GLYPH, type MarketEvent, type EventTone } from "@/engine/events";
import { useEvents, useEngineStatus } from "@/hooks/useEngine";
import { useNow } from "@/hooks/useTimers";
import { usePreferences } from "@/stores/preferences";
import { formatPrice, timeAgo } from "@/lib/format";
import { MARKET_TAG } from "@/types/market";

type FilterKey = "all" | EventTone;

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "全部" },
  { key: "up", label: "拉升" },
  { key: "down", label: "下跌" },
  { key: "vol", label: "量能" },
  { key: "funding", label: "资金费率" },
];

function EventRow({ event, now, fresh }: { event: MarketEvent; now: number; fresh: boolean }) {
  const showMeme = usePreferences((state) => state.showMemeCopy);

  return (
    <article className="feed__item" data-tone={event.tone} data-testid="event-row">
      <span className="feed__glyph" aria-hidden="true">
        {RULE_GLYPH[event.ruleId]}
      </span>
      <div className="feed__body">
        <div className="feed__top">
          <span className="feed__sym">{event.symbol}</span>
          <span className="tag">{MARKET_TAG[event.market]}</span>
          <span className="feed__rule">{event.title}</span>
          {fresh ? <span className="feed__new">NEW</span> : null}
        </div>
        <p className="feed__why">{showMeme ? event.why : event.why.replace(/。$/, "")}</p>
        <div className="feed__meta">
          <span>{timeAgo(event.createdAt, now)}</span>
          {event.chips.map((chip) => (
            <span className="tag" key={chip.label}>
              {chip.label} <b className="num" style={{ fontWeight: 500 }}>{chip.value}</b>
            </span>
          ))}
          <Link
            className="feed__link"
            to={`/charts?market=${event.market}&symbol=${encodeURIComponent(event.symbol)}`}
          >
            看图表 ↗
          </Link>
          <StarButton market={event.market} symbol={event.symbol} />
        </div>
      </div>
      <div className="feed__val">
        <span className="feed__px">{formatPrice(event.price, priceDecimals(event.price))}</span>
        <Delta value={event.changePercent} digits={2} fontSize={11} />
      </div>
    </article>
  );
}

function priceDecimals(price: number | null): number {
  if (price === null) return 2;
  const abs = Math.abs(price);
  if (abs >= 1000) return 2;
  if (abs >= 1) return 4;
  if (abs >= 0.01) return 5;
  return 8;
}

/**
 * The live event feed: the visual centre of the command centre.
 * Events are produced by the rule engine from real measured values.
 */
export function EventFeed() {
  const events = useEvents();
  const status = useEngineStatus();
  const now = useNow(5000);
  const [filter, setFilter] = useState<FilterKey>("all");

  const filtered = useMemo(
    () => (filter === "all" ? events : events.filter((event) => event.tone === filter)),
    [events, filter],
  );

  const live = status.states.spot === "live" || status.states.futures === "live";
  const counts = useMemo(() => {
    const map = { up: 0, down: 0, vol: 0, funding: 0 };
    for (const event of events) map[event.tone] += 1;
    return map;
  }, [events]);

  return (
    <Panel
      id="03"
      title="RADAR FEED · 异动播报"
      hint={live ? "规则触发 · 实时" : "等待行情源"}
      className="grow"
      bodyClass="feed"
      tools={
        <div className="row gap-4">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              className="movers__tab"
              data-active={filter === item.key}
              onClick={() => setFilter(item.key)}
            >
              {item.label}
              {item.key !== "all" ? (
                <span className="dim" style={{ marginLeft: 3 }}>
                  {counts[item.key as EventTone]}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      }
      footer={
        <>
          <Icon name="waves" size={12} />
          <span>扫描 {status.started.length} 个市场 · 去重冷却 120s</span>
          <span className="toolbar__spacer" />
          <Link to="/radar" className="feed__link">
            打开完整雷达 ↗
          </Link>
        </>
      }
    >
      {filtered.length === 0 ? (
        <EmptyState
          icon="waves"
          title={live ? "暂无异动触发" : "行情源尚未就绪"}
          text={
            live
              ? "当前规则（1m 急拉 ±1.2%、5m ±3%、量能 3× 基准、资金费率 ±0.05%、持仓量 ±5%）都没有被触发。去雷达页可以自定义阈值和条件。"
              : "正在连接币安公开行情接口。连接成功后，异动会根据真实成交数据自动生成。"
          }
          action={
            <Link to="/radar" className="btn btn--sm">
              配置扫描规则
            </Link>
          }
        />
      ) : (
        <div className="feed__scroll" data-testid="event-feed">
          {filtered.slice(0, 40).map((event) => (
            <EventRow
              key={event.id}
              event={event}
              now={now}
              fresh={now - event.createdAt < 20_000}
            />
          ))}
        </div>
      )}
    </Panel>
  );
}
