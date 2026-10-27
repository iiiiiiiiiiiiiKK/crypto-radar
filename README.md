# Crypto Radar 2.0

**The Meme-Powered Crypto Market Command Center**
**把整个加密市场变成一座可以实时作战、捕捉异动、围观行情、制造 Meme 的数字战场。**

Crypto Radar 是一个真实可用的加密市场作战室：币安现货与 USDⓈ-M 永续的实时行情、
可用的 K 线与技术指标、规则驱动的异动雷达、个人自选工作台，以及把真实行情变成分享图的 Meme Studio。

> 数据全部来自交易所官方公开接口，不需要 API Key。
> 缺失的数据会显示为“数据不足 / 不可用”，**永远不会被填成 0 或随机数**。

---

## 1. 快速开始

```bash
npm ci            # 安装依赖（Node >= 20）
npm run dev       # 开发服务器 http://localhost:5173/crypto-radar/
npm run build     # 生产构建 -> dist/
npm run preview   # 预览构建产物 http://localhost:4173/crypto-radar/
```

质量门禁：

```bash
npm run typecheck     # tsc -b --force
npm run lint          # eslint --max-warnings 0
npm run test          # vitest：指标 / 规则 / 引擎 / 解析 / 存储
npm run verify        # 上面三步 + 生产构建
npm run e2e           # 对真实行情的浏览器流程测试（需先 npm run preview）
npm run audit:layout  # 5 种视口 × 7 个页面的布局与对比度审计 + 截图
```

`npm run e2e` 与 `npm run audit:layout` 需要先启动预览服务，并且默认访问
`http://127.0.0.1:4174/crypto-radar`（可用 `BASE_URL` 覆盖）。

---

## 2. 六个页面

| 页面 | 路径 | 作用 |
| --- | --- | --- |
| Command Center 作战室 | `/` | 市场情绪 SITREP、实时异动播报、榜单、自选速览、今日最离谱 |
| Markets 行情 | `/markets` | 现货 / 永续 / Alpha 的虚拟化行情表，排序、筛选、自定义列 |
| Radar 异动雷达 | `/radar` | 自定义扫描规则（AND/OR）、实时命中结果、每条命中的触发依据 |
| Charts K 线 | `/charts` | Lightweight Charts 蜡烛图 + 成交量 + MA/EMA/BOLL/RSI/MACD |
| Meme Studio | `/studio` | 5 个原创模板，把真实行情渲染成 1200×675 / 1080×1080 PNG |
| Watchlist 自选 | `/watchlist` | 分组、拖拽排序、价格提醒（仅页面打开时生效） |
| Settings 设置 | `/settings` | 动效、密度、默认市场/周期、指标参数、雷达阈值、本地数据 |

---

## 3. 数据来源（全部为官方公开接口）

| 能力 | 接口 |
| --- | --- |
| 现货全市场 24h 快照 | `GET https://api.binance.com/api/v3/ticker/24hr` |
| 永续全市场 24h 快照 | `GET https://fapi.binance.com/fapi/v1/ticker/24hr` |
| 交易规则 / 精度 | `GET /api/v3/exchangeInfo`、`GET /fapi/v1/exchangeInfo` |
| 现货实时全市场 | `wss://stream.binance.com:9443/ws` → `!miniTicker@arr` |
| 永续实时全市场 | `wss://fstream.binance.com/ws` → `!miniTicker@arr` |
| 资金费率 / 标记价格 / 下次结算 | 流 `!markPrice@arr@1s` + REST `/fapi/v1/premiumIndex` |
| 持仓量 | REST `/fapi/v1/openInterest`（对高流动性合约轮询，逐个交易对） |
| K 线历史 | `GET /api/v3/klines`、`GET /fapi/v1/klines`（每次 500 根） |
| K 线实时 | `<symbol>@kline_<interval>` |
| Alpha | `GET https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha/all/token/list`（页面轮询，约 30s） |

### 本地计算 vs 交易所字段

界面会明确区分两者：

* **交易所字段**：最新价、24h 涨跌幅、24h 高低、成交量、成交额、标记价格、指数价格、资金费率、下次结算时间、持仓量。
* **本地计算**：1m/5m/15m/1h 涨跌幅（本地采样窗口）、成交额/分钟与量能倍数（相对最近 15 分钟基准）、
  持仓量变化、MA / EMA / BOLL / RSI / MACD、市场情绪、异动事件、扫描命中。
* 页面启动时会用 **1 分钟 K 线的真实收盘价**为高流动性交易对补种窗口（每个市场最多 60 个），
  所以 1m/5m/15m 指标不必等五分钟才出现；成交额基准仍需本地累计。

---

## 4. 技术栈

* **React 18 + TypeScript + Vite 6**（纯静态站点，浏览器直连交易所）
* **Zustand**（偏好 / 自选 / 提醒，localStorage 持久化）
* **Lightweight Charts 4**（K 线与副图，多图表时间轴联动）
* **@tanstack/react-virtual**（行情表虚拟化，771 行只渲染 28 行 DOM）
* **Zod**（所有上游响应都做运行时校验）
* 手写设计系统（CSS 变量 + 语义类），无 UI 框架、无外部字体依赖

---

## 5. 架构要点

```
src/
├─ engine/          # 行情引擎：tickerStore、history、events、scanner、mood
├─ services/        # REST 适配器（spot/futures/alpha）、WebSocket 管理、K 线流
├─ stores/          # zustand：preferences / watchlist / alerts / ui
├─ hooks/           # useRow / useMarketRows / useEvents / useHotkeys …
├─ features/        # 页面级业务模块（command、markets、charts、studio、search）
├─ components/      # shell（导航、搜索、状态）与 ui（面板、Delta、Sparkline …）
├─ pages/           # 七个页面
├─ styles/          # tokens.css / app.css / pages.css
└─ types/           # 统一行情数据模型
```

* **一个引擎实例持有全部 WebSocket**：页面切换不会重连；标签页隐藏时暂停，回到前台恢复。
* **每行独立订阅**：价格变化只重绘变化的行（`useSyncExternalStore` + 行级快照对象）。
* **列表级节流**：排序/筛选/re-render 最多每 320ms 一次。
* **断线自愈**：指数退避重连、订阅恢复、心跳检测、重连后重置历史窗口避免“假跳变”。

更多细节见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)、[`docs/DESIGN-SYSTEM.md`](docs/DESIGN-SYSTEM.md)。

---

## 6. 已知限制（不隐藏）

1. **Alpha 没有官方文档接口**，也没有 K 线 / WebSocket。它使用 Alpha 页面自身使用的公开 web 接口轮询，
   随时可能变更；因此 Alpha 不提供资金费率、持仓量、分钟级指标，也不参与异动扫描。
2. **持仓量为逐交易对轮询**，覆盖前 120 个高流动性合约，变化需要 5–10 分钟采样才可计算。
3. **价格提醒只在页面打开时生效**，没有后台推送（界面已明确标注）。
4. **自选/偏好存储在浏览器本地**，不是云端同步。
5. 若部署网络无法访问币安，仓库内的 `worker/`（Cloudflare Worker，固定白名单路径）可作为可选代理；
   在浏览器中设置 `VITE_PROXY_BASE` 即可启用，不会暴露任何密钥。
6. 亚秒级委托簿、逐笔成交、下单能力不在本版本范围内。

---

## 7. 部署

* 默认发布到 GitHub Pages 子路径 `/crypto-radar/`（`.github/workflows/deploy.yml`）。
* 也可以部署到任意静态托管：`VITE_BASE_PATH=/ npm run build` 后上传 `dist/`。
* `public/404.html` 处理 GitHub Pages 的 SPA 回退。

## 8. 许可

MIT。行情数据版权归 Binance 所有，本项目与 Binance 无隶属关系。
Meme 卡片中的像素图形与版式均为本项目原创绘制。
