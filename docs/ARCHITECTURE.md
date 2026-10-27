# 架构说明

## 1. 分层

```
浏览器
  ├─ services/            传输层（REST + WebSocket）
  │   ├─ http.ts          请求、域名轮换、限流/封锁错误分类
  │   ├─ spot.ts          现货适配器（ticker/24hr、exchangeInfo、klines）
  │   ├─ futures.ts       永续适配器（+ premiumIndex、openInterest）
  │   ├─ alpha.ts         Alpha 适配器（web 公开接口轮询）
  │   └─ ws/              WsManager（共享连接）、MarketFeed（整市场增量）、KlineStream（单合约 K 线）
  ├─ engine/              计算层（与 React 无关，可单测）
  │   ├─ tickerStore.ts   行情行存储、快照、按行订阅、派生指标
  │   ├─ history.ts       60 分钟 5 秒采样的环形缓冲；持仓量采样
  │   ├─ events.ts        异动规则 + 事件日志（去重、冷却）
  │   ├─ scanner.ts       Radar 规则引擎与预设
  │   ├─ metrics.ts       指标读取 / 比较 / 格式化
  │   └─ mood.ts          规则化市场情绪
  ├─ stores/              zustand（preferences / watchlist / alerts / ui）
  ├─ hooks/               useEngine 桥接（useSyncExternalStore）
  └─ pages, features, components, styles
```

`engine` 不依赖 React；`services` 不依赖 `engine`。这样核心逻辑全部可以单元测试，
UI 只负责渲染快照与派发动作。

## 2. 数据流

```
REST 快照 ─┐
           ├─> TickerStore.applySnapshot()   （完整交易对全集，diff 后保留其它市场）
WS 增量 ───┼─> TickerStore.applyTicker()     （价格/24h 统计 + 历史采样 + 派生指标）
WS 标记价 ─┼─> TickerStore.applyMark()       （标记价/指数价/资金费率/下次结算）
OI 轮询 ───┴─> TickerStore.applyOpenInterest()

TickerStore ──> 行级订阅（useRow）      → 只有价格变化的行重绘
            └─> 全局版本号（320ms 节流） → 表格排序/筛选、榜单、情绪重算
```

## 3. 渲染性能

* **行级订阅**：`useRow(key)` 通过 `useSyncExternalStore` 订阅单个 key，快照对象只在
  该行真正变化时替换，因此 1 秒一次的整市场推送不会让 771 行的表格全量重绘。
* **列表节流**：`TickerStore.scheduleFlush()` 最多每 320ms 提升一次全局版本号。
* **虚拟化**：`@tanstack/react-virtual` 只挂载视口内的行（桌面 771 行 → 28 个 DOM 节点）。
* **图表命令式更新**：WebSocket 的 K 线推送直接调用 `series.update()`，不触发 React 重渲染。
* **按需订阅**：切换到没有图表/没有扫描的页面时，K 线流会 `close()` 释放订阅。

## 4. 数据完整性

1. **永不补零**：所有交易所字段都是 `number | null`。缺失即 `null`，UI 显示“不可用 / 采集中 / 数据不足”。
2. **运行时校验**：每个 REST 响应都过 Zod schema，字段级 `optional()`，结构变化不会崩溃 UI。
3. **新鲜度闸门**：规则引擎不消费 45 秒以上的旧数据；Radar 的 `maxAgeMs` 可配置。
4. **断线重置**：WS 从断开恢复时清空该市场的采样窗口，避免“价格断层”被当成真实异动。
5. **口径标注**：情绪面板注明样本数与覆盖面，Alpha 面板注明字段缺失，成交量榜注明低流动性。

## 5. 连接管理

* 每个市场一条 WebSocket（现货、永续各一条，K 线另有一条独立连接）。
* `WsManager`：指数退避（1s → 20s + 抖动）、`SUBSCRIBE/UNSUBSCRIBE` 复用、
  心跳检测（35 秒无帧 → `stale`，140 秒 → 强制重连）、20 小时主动轮换（官方 24h 上限）。
* 页面隐藏时暂停全部连接与定时器，回到前台恢复并补一次快照。
* 全市场流使用 `!miniTicker@arr` / `!markPrice@arr@1s`，一条连接即可覆盖整个市场，
  远低于官方“单连接最多 1024 stream、5 条入站消息/秒”的限制。

## 6. REST 预算

| 用途 | 频率 | 说明 |
| --- | --- | --- |
| 24h 快照 | 首次 + 手动刷新 + 重连 2 分钟后 | 现货 `/ticker/24hr` 权重 80 |
| exchangeInfo | 首次（本地缓存 6 小时） | 权重 20 |
| 1m K 线补种 | 每个市场最多 60 个交易对（6 并发） | 权重 2/次 |
| 持仓量 | 每 15 秒 12 个，覆盖前 120 个合约 | 权重 1/次 |
| K 线历史 | 切换交易对/周期时 | 500 根 |

## 7. 错误处理

* `http.ts` 区分限流（418/429）、区域封锁（403/451）、超时、5xx、JSON 损坏，并给出可操作文案。
* 每个市场独立维护 `state` 与 `error`，一个市场失败不影响另一个市场。
* UI 层：`ConnectionBanner` 显示状态、最后更新时间与重试按钮；旧数据会保留但被标注。
* 空状态区分“正在加载”“连接失败”“规则无命中”“指标预热中”四种情形。
