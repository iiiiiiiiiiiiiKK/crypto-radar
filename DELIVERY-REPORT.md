# Crypto Radar 2.0 — 交付报告

> 本文件记录：重做前的审查结论、架构决策、实际验证结果（含失败与修复）、
> 尚未完成或受接口限制的部分，以及下一阶段建议。
> 所有测试/审计数据来自本机真实运行，不是预估。

---

## 1. 阶段 1：旧版本审查（重建依据）

审查对象：仓库中的 v1（`src/` 下 60+ 文件，React 18 + Vite + Tailwind，已部署到 GitHub Pages）。

**值得保留**

* `services/binance/*` 的 REST 适配器骨架：域名轮换、Zod 校验、tickSize → 精度换算是对的。
* `lib/format` 的数值/时间格式化（保留其语义，重写为单一模块）。
* `features/indicators` 的 SMA/EMA/RSI/MACD 实现正确（已用单元测试复核）。
* `WsManager` 的重连/退避/多路复用思路正确。
* 部署链路（GitHub Pages workflow、`404.html` SPA 回退、`VITE_BASE_PATH`）。

**必须重写的部分**

| 问题 | 后果 | v2 的做法 |
| --- | --- | --- |
| `marketStore` 同一时刻只保留一个市场，切换时 `tickerMap.clear()` | 无法同时看现货+永续；Radar 与页面切换互相踩状态 | 单一 `MarketEngine` 常驻，三个市场并存，页面切换不重连 |
| 每次 flush 复制整个数组 | 771 行的表格每 250ms 全量重绘 | 行级 `useSyncExternalStore` 订阅 + 虚拟化，只重绘变化的行 |
| 只有 24h 涨跌幅，没有 1m/5m/15m/1h | 无法做短周期异动 | 60 分钟 5 秒采样环形缓冲 + 启动时用 1m K 线补种 |
| 没有成交额基准 | “放量”无法判断 | 每分钟成交额 + 最近 15 分钟中位数基准 → 量能倍数 |
| 没有持仓量变化 | 合约异动缺一半 | `/fapi/v1/openInterest` 轮询 + 10 分钟变化 |
| 事件规则固定、无冷却去重细节 | 重连会重复推送 | 规则携带真实数值 + 冷却 + id 去重 + 冷却窗口内幂等 |
| UI 是「黑底 + 卡片 + 荧光字」的通用 Dashboard | 无辨识度 | 重新做设计系统：编号控制台面板、SITREP 战情带、异动播报流、跑马灯、像素吉祥物 |
| K 线只有主图 | 指标不可用 | 三图联动（主图 + RSI + MACD）、叠加指标、全屏 |
| Meme 只是贴纸 | 与行情无关 | 5 个模板由真实行情快照渲染 Canvas，导出 PNG |

**技术栈结论**：React 18 + TS + Vite + zustand + lightweight-charts + zod 已经完全够用，
不需要换框架；因此**保留技术栈、重写架构与全部 UI**，只复用经过验证的纯逻辑。

---

## 2. 阶段 2–3：设计与骨架

* 设计系统：`src/styles/tokens.css`（颜色/字体/间距/动效令牌）、`app.css`（外壳、面板、表格、控件）、
  `pages.css`（页面级布局）。全部手写 CSS，无 UI 框架、无外部字体。
* 品牌：雷达靶标 + 扫描扇区 logo、`CRYPTO RADAR` 字标、V2.0 徽标、`Meme-Powered Market Command Center` 副标题。
* 导航：桌面左侧 76px 导轨（6 个页面 + 设置 + 三条通道状态灯），≤900px 切底部 5 项导航。
* 骨架：`AppShell`（Rail + TopBar + TickerTape + Outlet + MobileBar + Toaster + HotkeySheet）。

## 3. 阶段 4：真实行情接入

* 现货 `/api/v3/ticker/24hr`（全市场，一次请求）+ `!miniTicker@arr` 流；
* 永续 `/fapi/v1/ticker/24hr` + `!miniTicker@arr` + `!markPrice@arr@1s`（资金费率/标记价/下次结算）+ `/fapi/v1/openInterest` 轮询；
* Alpha 公开 web 接口轮询（约 30s），只提供价格/涨跌幅/成交额等已有字段；
* 统一行模型 `TickerRow`：交易所字段与本地派生字段（`d.*`）严格分离，缺失一律 `null`。

**修复过的真实缺陷（实测发现）**

1. 类字段初始化顺序 bug：`MarketEngine.snapshot` 在其它字段之前初始化，导致首屏白屏（`buildSnapshot` 读到 undefined）。
2. `useSyncExternalStore(engine.store.subscribeAll)` 丢 `this` → 全部订阅抛异常；改成箭头属性。
3. 搜索 `SOL` 时 IDR 计价交易对因成交额数值巨大排第一 → 增加计价货币与市场权重。
4. 行情表 `docHeight` 达 26,641px（虚拟化容器没有高度约束）→ 面板高度 `clamp(420px,64vh,880px)`。
5. ≤900px 时表格被 `display:none` 隐藏（残留规则）→ 改为紧凑列（价格 + 涨跌幅）。
6. 390px 视口横向溢出 6–19px：根因是面板头部（5 个筛选 tab + 标题）无法换行 → 头部允许换行、工具区可横向滚动；同时给栅格子项补 `min-width: 0`。
7. Radar 默认规则在打开后数分钟内 0 命中（5m 窗口无历史）→ 启动时用 1 分钟 K 线补种 60 个高流动性交易对，并在雷达页显示预热进度与说明。

## 4. 阶段 5–7：图表、雷达、工作台、Studio

* **图表**：Lightweight Charts 4；500 根历史 + `<symbol>@kline_<interval>` 实时；MA7/25、EMA、BOLL、RSI、MACD；
  三图时间轴联动；每 5 个周期一组的快捷栏（1m…1M）；全屏；右侧合约信息（标记价/指数价/资金费率/结算倒计时/持仓量）。
* **雷达**：7 个预设 + 自定义条件（指标 × 周期 × 比较符 × 阈值，AND/OR）、成交额下限、仅自选、
  数据新鲜度、结果排序；每条命中显示触发的指标与真实数值；暂停/清空；预热提示。
* **工作台**：自选分组、拖拽排序、价格提醒（明确标注“仅页面打开时生效”）、
  表格列自定义、密度、图表布局、筛选条件与排序全部落 localStorage。
* **Meme Studio**：5 个原创模板（冲了 / 崩了 / FOMO / 装死 / 今日最离谱），
  Canvas 渲染时对标题、价格、副标题做测量与逐字换行，页脚固定打印数据时间与来源；导出 PNG 实测 1.2–1.7MB。

## 5. 验证结果（真实执行）

### 5.1 类型 / Lint / 构建

```
npm run typecheck   -> 通过（tsc -b --force，0 error）
npm run lint        -> 通过（eslint . --max-warnings 0，0 warning）
npm run test        -> 10 个测试文件 / 106 个用例全部通过
npm run build       -> 通过，产物 index 256.8kB(gzip 76.4) + charts 162.6kB + table 177.1kB
```

### 5.2 单元测试覆盖

| 文件 | 覆盖内容 |
| --- | --- |
| `format.test.ts` | 精度推导、价格/百分比/紧凑数/资金费率、`--` 兜底 |
| `math.test.ts` | 中位数/分位/百分比变化/最近索引 |
| `indicators.test.ts` | SMA、EMA 种子值、RSI 极值、MACD 对齐、BOLL 带宽、缺口跳过 |
| `history.test.ts` | 环形缓冲窗口涨跌、成交额基准与倍数、波动均值、容量、持仓量变化门槛 |
| `tickerStore.test.ts` | 快照合并/清理、增量、逐行通知隔离、补种、OI、精度合并、断线重置 |
| `events.test.ts` | 12 条规则触发/不触发、陈旧与低流动性过滤、冷却、去重、每轮上限 |
| `scanner.test.ts` | AND/OR、市场/成交额/新鲜度过滤、数据不足计数、排序、预设一致性 |
| `mood.test.ts` | 六档情绪判定、样本不足、陈旧数据、证据字段 |
| `movers-search.test.ts` | 榜单排序与过滤、搜索打分与计价货币偏好 |
| `storage-parsers.test.ts` | 本地存储命名空间/容错、WS 帧解析（miniTicker/markPrice/kline） |

### 5.3 浏览器端真实流程（`npm run e2e`，18/18 通过）

对真实币安行情执行：首页数据（情绪 + 榜单 + 跑马灯）、搜索 SOL→键盘 Enter→打开 K 线、
周期切换 1h 重载、RSI 开关注入副图、行情表排序（降序/升序）、切换永续（出现资金费率/持仓量列）、
切换 Alpha（无永续列 + 轮询提示）、星标→自选页出现、雷达阈值改为 0.01 后命中 19 条、
雷达暂停/继续、Studio 导出 PNG（1200×675，171,032 字节）、模板切换、快捷键 R、输入框内不触发快捷键、
`?` 打开快捷键表 + Esc 关闭、设置页动效持久化（刷新后仍为 calm）、390px 六条路由 0 横向溢出、控制台 0 错误。

### 5.4 布局审计（5 视口 × 7 页面，`npm run audit:layout`）

* 1440×900 / 1280×800 / 768×1024 / 430×932 / 390×844 共 35 次页面加载：
  **全部 0 横向溢出**，无 `NaN/undefined` 文本，无控制台错误。
* 关键容器尺寸（桌面）：SITREP 全宽、异动流 470px 滚动区、行情表 529px 内滚（771 行 / 28 个 DOM 节点）、
  图表 648px；手机（390px）：行情表 378px、图表 460px。
* 首行行情到达时间实测 1.55s（冷启动，含 1.5MB 24h 快照解析）。

### 5.5 数据真实性抽查

* 首页 BTC/ETH 价格、24h 涨跌与 Binance 现货一致；跑马灯与表格同源。
* 永续页出现资金费率/持仓量列且数值来自 `!markPrice@arr@1s` 与 `/fapi/v1/openInterest`。
* Alpha 页显示 376 个代币，且**没有**资金费率/持仓量列（诚实隐藏）。
* 无数据时显示“不可用 / 采集中 / 数据不足”，未发现任何 0 值伪装。

## 6. 仍未实现 / 受接口限制

1. **Alpha 无官方文档接口**：轮询来源为 Alpha 页面使用的公开 web 接口，可能变更；
   无 K 线、无 WebSocket，因此不参与异动扫描与图表。健康时可用，失效时 UI 会显示错误而不是假数据。
2. **持仓量覆盖 120 个高流动性合约**，每 15 秒取 12 个；变化需要 5–10 分钟采样。
3. **价格提醒仅页面打开时生效**（无 Service Worker / 服务端推送）。
4. **自选与偏好仅本地**，无账号与跨设备同步。
5. 未实现：逐笔成交、盘口深度、下单、历史回放、多图表并排。
6. `tailwindcss` / `autoprefixer` / `postcss` / 部分 `@testing-library/*` 已不再使用，
   但移除它们需要刷新 `package-lock.json`（本机无 npm registry 访问），因此保留在 devDependencies，
   不影响 CI 与构建产物。

## 7. 复现命令

```bash
npm ci
npm run verify              # typecheck + lint + test + build
npm run preview             # 另一个终端
BASE_URL=http://127.0.0.1:4173/crypto-radar npm run e2e
BASE_URL=http://127.0.0.1:4173/crypto-radar npm run audit:layout
```

## 8. 下一阶段建议

1. **提醒升级**：Service Worker + Notification API，或最小后端（Web Push）实现关页提醒。
2. **持仓量全量**：用 WebSocket `!markPrice` 同源思路，评估批量 OI 方案或改为按需订阅（图表页只拉当前合约）。
3. **Alpha 正式化**：若官方开放接口，替换适配器即可；否则加服务端代理 + 结构变化告警。
4. **Radar 2.0**：支持多规则集同时运行（多个 tab 各自阈值与冷却）、命中历史时间轴、导出 CSV。
5. **图表增强**：多图并排、指标模板保存、画线工具、图表内下单入口（只读跳转）。
6. **分享增长**：卡片分享链接回放（带数据快照 URL）、OG 图动态生成、周榜卡片。
7. **CI 增加**：Playwright e2e 在预览服务上跑（现在是本地脚本），以及 Lighthouse 性能基线与 bundle 体积上限。
