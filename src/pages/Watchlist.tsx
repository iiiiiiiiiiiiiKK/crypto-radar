import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "@/components/Icons";
import { Field, Seg } from "@/components/ui/Controls";
import { Delta } from "@/components/ui/Delta";
import { EmptyState, Notice, PageHead, Panel } from "@/components/ui/Panel";
import { useRow, useScanRows } from "@/hooks/useEngine";
import { useNow } from "@/hooks/useTimers";
import { describeAlert, useAlerts, type AlertDirection } from "@/stores/alerts";
import { useWatchlist } from "@/stores/watchlist";
import { useToasts } from "@/stores/ui";
import { formatFunding, formatPrice, timeAgo } from "@/lib/format";
import { MARKET_LABEL, MARKET_TAG, type MarketId } from "@/types/market";

function WatchedRow({
  market,
  symbol,
  index,
  groupId,
  onDragStart,
  onDrop,
  onDragOver,
}: {
  market: MarketId;
  symbol: string;
  index: number;
  groupId: string;
  onDragStart: (index: number) => void;
  onDrop: (index: number) => void;
  onDragOver: () => void;
}) {
  const row = useRow(`${market}:${symbol}`);
  const remove = useWatchlist((state) => state.remove);
  const navigate = useNavigate();
  const now = useNow(5000);
  const [dragging, setDragging] = useState(false);
  const [over, setOver] = useState(false);

  return (
    <div
      className="wrow"
      draggable
      data-dragging={dragging}
      data-over={over}
      onDragStart={() => {
        setDragging(true);
        onDragStart(index);
      }}
      onDragEnd={() => setDragging(false)}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
        onDragOver();
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        onDrop(index);
      }}
      data-testid="watch-row"
      data-symbol={symbol}
    >
      <button type="button" className="wrow__drag" aria-label="拖动排序" title="拖动排序">
        <Icon name="grip" size={12} />
      </button>
      <span className="wrow__sym">
        <span className="sym__base">{row?.base ?? symbol.split("/")[0]}</span>
        <span className="sym__quote">/{row?.quote ?? "USDT"}</span>
        <span className="tag">{MARKET_TAG[market]}</span>
        <span className="wrow__meta">{row ? timeAgo(row.receivedAt, now) : "无数据"}</span>
      </span>
      <span className="num w-hide-sm">{formatPrice(row?.price ?? null, row?.decimals ?? 2)}</span>
      <Delta value={row?.changePercent ?? null} digits={2} fontSize={11} />
      <span className="num dim w-hide-sm">{formatFunding(row?.fundingRate ?? null)}</span>
      <span className="row gap-4" style={{ justifyContent: "flex-end" }}>
        <button
          type="button"
          className="btn btn--sm"
          onClick={() => navigate(`/charts?market=${market}&symbol=${encodeURIComponent(symbol)}`)}
        >
          K 线
        </button>
        <button
          type="button"
          className="btn btn--sm btn--ghost"
          aria-label={`移除 ${symbol}`}
          onClick={() => remove(`${market}:${symbol}`)}
        >
          <Icon name="trash" size={11} />
        </button>
      </span>
      <span className="sr-only">{groupId}</span>
    </div>
  );
}

export function WatchlistPage() {
  const groups = useWatchlist((state) => state.groups);
  const activeGroupId = useWatchlist((state) => state.activeGroupId);
  const setActiveGroup = useWatchlist((state) => state.setActiveGroup);
  const createGroup = useWatchlist((state) => state.createGroup);
  const renameGroup = useWatchlist((state) => state.renameGroup);
  const deleteGroup = useWatchlist((state) => state.deleteGroup);
  const reorder = useWatchlist((state) => state.reorder);
  const rows = useScanRows();
  const alerts = useAlerts((state) => state.alerts);
  const addAlert = useAlerts((state) => state.add);
  const removeAlert = useAlerts((state) => state.remove);
  const toggleAlert = useAlerts((state) => state.toggle);
  const pushToast = useToasts((state) => state.push);

  const dragFromRef = useRef<number | null>(null);  const [alertSymbol, setAlertSymbol] = useState("");
  const [direction, setDirection] = useState<AlertDirection>("above");
  const [price, setPrice] = useState("");

  const group = groups.find((item) => item.id === activeGroupId) ?? groups[0];
  const items = useMemo(() => group?.items ?? [], [group]);

  const alertCandidates = items;
  const selected = items.find((item) => item.key === alertSymbol) ?? items[0];

  return (
    <main className="page" data-testid="watchlist-page">
      <PageHead
        eyebrow="WATCHLIST / 自选工作台"
        title={
          <>
            只盯你<em>真正关心</em>的币
          </>
        }
        desc="自选、分组与价格提醒都保存在浏览器本地（localStorage），不需要登录，也不会上传到任何服务器。"
        actions={
          <>
            <Link className="btn" to={`/studio?template=board`}>
              <Icon name="sparkles" size={13} /> 生成自选卡片
            </Link>
            <Link className="btn btn--primary" to="/markets">
              <Icon name="plus" size={13} /> 去添加交易对
            </Link>
          </>
        }
      />

      <div className="watch">
        <Panel id="01" title="GROUPS · 分组" hint={`${groups.length} 组`}>
          <div className="watch__groups">
            {groups.map((item) => (
              <button
                key={item.id}
                type="button"
                className="watch__group"
                data-active={item.id === activeGroupId}
                onClick={() => setActiveGroup(item.id)}
              >
                <Icon name="star" size={12} />
                <span className="watch__group-name">{item.name}</span>
                <span className="watch__group-count">{item.items.length}</span>
              </button>
            ))}
          </div>
          <div style={{ padding: 10, display: "grid", gap: 6 }}>
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => {
                const name = window.prompt("新分组名称", "重点观察");
                if (name) createGroup(name.slice(0, 16));
              }}
            >
              <Icon name="plus" size={11} /> 新建分组
            </button>
            {group ? (
              <>
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={() => {
                    const name = window.prompt("重命名分组", group.name);
                    if (name) renameGroup(group.id, name.slice(0, 16));
                  }}
                >
                  重命名当前分组
                </button>
                <button
                  type="button"
                  className="btn btn--sm btn--danger"
                  disabled={groups.length <= 1}
                  onClick={() => deleteGroup(group.id)}
                >
                  删除当前分组
                </button>
              </>
            ) : null}
          </div>
        </Panel>

        <div className="stack" style={{ gap: "var(--gap)" }}>
          <Panel
            id="02"
            title={`${group?.name ?? "自选"} · 实时行情`}
            hint={`${items.length} 个`}
            footer={
              <>
                <Icon name="grip" size={12} />
                <span>拖动左侧手柄可调整顺序 · 数据来自实时行情</span>
              </>
            }
          >
            {items.length === 0 ? (
              <EmptyState
                icon="star"
                title="这个分组还是空的"
                text="在行情表或搜索结果里点星标即可加入自选；也可以直接用下面的按钮从行情表添加。"
                action={
                  <Link className="btn btn--sm" to="/markets">
                    打开行情表
                  </Link>
                }
              />
            ) : (
              <div>
                {items.map((item, index) => (
                  <WatchedRow
                    key={item.key}
                    market={item.market}
                    symbol={item.symbol}
                    index={index}
                    groupId={group?.id ?? "default"}
                    onDragStart={(from) => {
                      // A ref, not state: the drop event can arrive in the same
                      // task as dragstart, before React has re-rendered.
                      dragFromRef.current = from;
                    }}
                    onDragOver={() => {}}
                    onDrop={(to) => {
                      const from = dragFromRef.current;
                      dragFromRef.current = null;
                      if (from !== null && group) reorder(group.id, from, to);
                    }}
                  />
                ))}
              </div>
            )}
          </Panel>

          <Panel
            id="03"
            title="PRICE ALERTS · 价格提醒"
            hint={`${alerts.length} 条`}
            tools={<span className="tag">仅页面打开时生效</span>}
          >
            <div style={{ padding: 12, display: "grid", gap: 10 }}>
              <Notice tone="warn">
                提醒由浏览器内的实时行情监听触发，只在 Crypto Radar 页面打开时工作；关闭标签页不会收到通知，也不会发送短信或邮件。
              </Notice>

              <div className="grid" style={{ gridTemplateColumns: "1.4fr 0.8fr 1fr auto", gap: 8, alignItems: "end" }}>
                <Field label="交易对">
                  <select
                    className="select"
                    value={selected?.key ?? ""}
                    onChange={(event) => setAlertSymbol(event.target.value)}
                  >
                    {alertCandidates.length === 0 ? <option value="">先添加自选</option> : null}
                    {alertCandidates.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.symbol}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="方向">
                  <Seg
                    value={direction}
                    onChange={setDirection}
                    options={[
                      { value: "above", label: "≥" },
                      { value: "below", label: "≤" },
                    ]}
                  />
                </Field>
                <Field label="触发价格">
                  <input
                    className="input"
                    inputMode="decimal"
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    placeholder="0.00"
                  />
                </Field>
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={!selected || !price || Number.isNaN(Number(price))}
                  onClick={() => {
                    if (!selected) return;
                    const value = Number(price);
                    if (!Number.isFinite(value) || value <= 0) {
                      pushToast({ tone: "bad", title: "价格无效", text: "请输入大于 0 的数字。" });
                      return;
                    }
                    addAlert({
                      key: selected.key,
                      market: selected.market,
                      symbol: selected.symbol,
                      direction,
                      price: value,
                    });
                    setPrice("");
                  }}
                >
                  添加
                </button>
              </div>

              {alerts.length === 0 ? (
                <div className="dim" style={{ fontSize: 11.5 }}>
                  还没有价格提醒。添加后，当价格越过阈值时会在右下角弹出提示（同一提醒 5 分钟内不重复）。
                </div>
              ) : (
                <div>
                  {alerts.map((alert) => (
                    <div className="alertrow" key={alert.id} data-fired={Boolean(alert.lastFiredAt)}>
                      <span className="row gap-6">
                        <button
                          type="button"
                          className="feed__link"
                          onClick={() => toggleAlert(alert.id)}
                          title="启用 / 停用"
                        >
                          {alert.enabled ? "ON" : "OFF"}
                        </button>
                        <span className="sym__base">{alert.symbol}</span>
                        <span className="alertrow__cond">{describeAlert(alert)}</span>
                      </span>
                      <span className="dim" style={{ fontSize: 10 }}>
                        {alert.lastFiredAt ? `上次触发 ${timeAgo(alert.lastFiredAt)}` : "等待触发"}
                      </span>
                      <button
                        type="button"
                        className="btn btn--sm btn--ghost"
                        onClick={() => removeAlert(alert.id)}
                        aria-label="删除提醒"
                      >
                        <Icon name="trash" size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>

      <Panel id="04" title="本地数据说明" plain>
        <div style={{ padding: 12, fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.7 }}>
          当前浏览器保存了 {groups.reduce((total, item) => total + item.items.length, 0)} 个自选交易对与{" "}
          {alerts.length} 条价格提醒，数据键前缀为 <code className="mono">crypto-radar:v2:</code>。
          这些数据只存在于本机浏览器，不是云端同步；换设备或清理浏览器数据后会丢失。
          页面示例：{rows.length} 个交易对正在推送，市场覆盖 {MARKET_LABEL.spot} 与 {MARKET_LABEL.futures}。
        </div>
      </Panel>
    </main>
  );
}
