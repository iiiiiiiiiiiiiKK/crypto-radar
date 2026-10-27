# Crypto Radar — Delivery Report

**Date:** 2026-10-27
**Repository:** https://github.com/iiiiiiiiiiiiiKK/crypto-radar
**Live site:** https://iiiiiiiiiiiiiKK.github.io/crypto-radar/

## 0. Crypto Radar 2.0 — Meme 改版

### 已完成改版的页面

| 页面 | 改版内容 |
| --- | --- |
| `/` 首页 | 全新作战室：可解释的市场情绪仪表盘、Meme 竞技场、事件流，表格/热力图一键切换 |
| 顶栏 / 侧栏 / 底部导航 | 像素 HUD 视觉；手机端两行顶栏 + 4 主项 + 「更多」弹层底部导航 + 安全区 |
| `/spot` `/perp` `/alpha` | 新皮肤；按市场隐藏不适用列（现货不再显示资金费率/标记价格）；24h 区间条 |
| `/chart/:market/:symbol` | RSI/MACD 改为独立副图（修复价格轴被压扁的根因）；留白收紧；手机主图 300px |
| `/events` | 由异动扫描升级为事件中心：规则、严重度、实测值、阈值编辑、冷却 |
| `/studio` | 全新 Meme Studio：Canvas 出图 + PNG 导出 + 三种主题 + 两种比例 |
| `/profile` | 全新交易员基地：像素头像、主题、默认首页视图，全部本地持久化 |
| `/basis` `/screener` `/alerts` `/watchlists` `/settings` | 统一新设计系统 |

### 真正实现的新功能

1. **市场情绪仪表盘** — `computeSentiment()` 用涨跌家数、平均涨跌幅、中位波动、成交额、极端资金费率占比算出 0-100 分与六种状态；判定规则固定且可在 UI 展开查看每一项输入值。
2. **Meme 竞技场** — 六个榜单（涨幅/跌幅/成交额/成交量异动/资金费率/自选），全部由真实行情排序；成交量异动 = 当前成交速度 ÷ 24 小时平均速度。
3. **异动事件中心** — 六类事件（拉升/下挫/放量/资金费率极端/新高/新低），每条带真实数值、严重度、时间、K 线入口；按规则与严重度筛选、阈值可改、有冷却防刷屏。
4. **Meme Studio** — Canvas 2D 真实绘制，三种主题（像素街机/漫画分镜/极简终端）、两种比例（1200×675、1080×1080）、可自定义标题配文、显示数据时间、导出 PNG（实测 81 KB）。
5. **交易员基地** — 6 个 CSS 像素头像、3 套主题（只换强调色、语义色不变）、默认首页视图，写入 localStorage。
6. **24h 区间条 + 涨跌家数** — 每行显示价格在 24h 高低之间的位置；榜单旁一条堆叠柱显示涨跌家数。

### 已验证的数据接口

现货 REST/WS、永续 REST（含 premiumIndex 批量资金费率）、Alpha 列表、K 线、盘口价——全部来自 Binance 官方公开接口，无 mock。线上实测：首页情绪「极度恐慌」（平均 −5.64%、上涨占比 28.9%）、竞技场 16 条、热力图 120 块、事件 200 条、Studio 1200×675、K 线价格实时。

### 本轮修复的根因

| 问题 | 根因 | 修复 |
| --- | --- | --- |
| 指标显示异常、图表留白 | RSI(0-100)/MACD 被画在主图价格轴上，把价格轴撑到 0~80000 | 拆成独立副图，仅同步时间轴 |
| 字段显示 `--` | 现货也渲染了永续专属列 | 列定义增加 `markets` 约束 |
| 榜单点击无反应 | `board` 只是工具栏局部状态 | 提升到页面状态并真正筛表重排 |
| 独立路由页面空白 | 直接访问时共享行情 store 未启动 | `useOwnMarketData()` 兜底取数 |
| 手机卡片全挤左边 | 整行是单个 span | 左标的名/右对齐价格 + 区间条 + 右对齐成交额 |
| 底部导航遮挡末行 | 未留安全区高度 | 导航独立占位 + `safe-bottom` |

## 1. Project

| Item | Value |
| --- | --- |
| Name | Crypto Radar |
| Repository | https://github.com/iiiiiiiiiiiiiKK/crypto-radar |
| Live URL | https://iiiiiiiiiiiiiKK.github.io/crypto-radar/ |
| Deployment | GitHub Pages (Actions build, branch `main`) |
| License | MIT |
| Stack | React 18 · TypeScript 5 · Vite 6 · Tailwind CSS 3 · Zustand 5 · Lightweight Charts 4 · TanStack Virtual · Zod · Vitest · Playwright |
| Edge proxy | Cloudflare Worker — https://crypto-radar-proxy.changyuansex.workers.dev (optional) |

## 2. Feature status

### Completed and verified against the live API

- **Market overview** — one virtualised table for spot, perpetuals and Alpha.
  Search, column sorting, column show/hide, column reordering, three row
  densities and a quote-asset filter. Price changes flash green/red.
- **Live prices** — one shared WebSocket per market (`!miniTicker@arr`), 250 ms
  batched updates, exponential backoff with jitter, automatic resubscribe,
  honest connection state (Connecting / Live / Reconnecting / Delayed / Error).
- **Perpetual data** — mark price, funding rate, index price and the next
  funding time are read from the dedicated futures endpoints for **all**
  contracts in one request. Never substituted with spot data.
- **Alpha tokens** — the public token-list endpoint returns 685 tokens with
  price, 24 h change, volume, market cap, liquidity and chain metadata.
- **Candlestick chart** — Lightweight Charts with volume, 15 intervals, paged
  history, crosshair OHLC readout, price line and the last candle updating
  live.
- **Indicators** — MA, EMA, RSI and MACD, each toggleable, rendered on the
  chart without a page reload.
- **Watchlists** — multiple named lists, add/remove/rename/reorder, persisted
  in `localStorage`, corrupted values discarded instead of crashing.
- **Screener** — scans all three markets at once, virtualised result table,
  six rule templates plus a custom rule set, market and watchlist filters.
- **Bilingual UI** — complete Chinese and English dictionaries, persisted.
- **Keyboard shortcuts** — `/`, `Esc`, `1`/`2`/`3`, ignored while typing.
- **Responsive layout** — a dedicated phone design, not a squeezed desktop
  page: card rows instead of the nine-column grid, a two-row header (logo,
  search, author link, connection state, language) plus a scrollable market
  tab strip, a bottom navigation bar, a compact mobile toolbar, a phone chart
  layout with a scrollable interval strip, and phone card lists for the market
  table and the screener. Verified on iPhone SE (375), iPhone 13 (390),
  iPhone 15 Pro Max (430), iPad mini (744) and desktop (1440): 35 page /
  device combinations, zero horizontal overflow, zero clipped labels.
- **Leaderboard tabs** — 涨幅榜 / 跌幅榜 / 成交额榜 filter and reorder the
  live table (verified: the gainers board leads with a positive pair, the
  losers board with a negative one).
- **Turnover weighted heatmap** — a squarified treemap of up to 120 pairs;
  tile area is the 24 h turnover, colour is the 24 h change.
- **Basis radar** (/basis) — spot and perpetual joined on the base asset:
  premium in percent, funding rate annualised, next settlement and turnover.
  355 comparable pairs on the live market.
- **Price alerts** (/alerts) — threshold rules evaluated against the live
  feed, browser notification, persisted in localStorage, re-armable.
- **Market breadth** — advancers versus decliners as a stacked bar next to
  the leaderboard tabs.
- **24 h range bar** — every row shows the position of the price between the
  24 h low and high, on the desktop grid and on the phone card.
- **Author link** — the author's X profile (https://x.com/0xkillcoin) is
  reachable from the header on both layouts and opens in a new tab with
  `rel="noopener noreferrer"`.
- **GitHub Pages SPA fallback** — `public/404.html` restores deep links.

### Partially completed

- **Alpha candlestick chart** — Binance publishes no public kline endpoint for
  Alpha tokens. The page states this explicitly instead of drawing synthetic
  candles. The Alpha market itself (list, prices, 24 h statistics, search,
  sorting, watchlists, screener) is complete.
- **Live perpetual WebSocket** — the futures stream (`fstream.binance.com`)
  is blocked on the networks tested. The feed therefore falls back to a light
  REST poll (`/fapi/v1/ticker/price`) after 20 s without a frame, so the
  prices keep moving and the badge reports the state honestly.

### Not implemented (deliberately)

- **Trading** — out of scope by design. The project never asks for an API key
  and cannot place an order.
- **Push notifications** — the screener is structured so a notification
  service can be added, but no Telegram/email/web-push integration ships.
- **Account system** — watchlists and preferences stay in the browser. The
  storage layer is an interface so a server-side store can replace it.

## 3. Test results

All results below come from actual runs in this environment.

| Check | Command | Result |
| --- | --- | --- |
| Type check | `npm run typecheck` | pass (0 errors) |
| Lint | `npm run lint` | pass (0 errors, 0 warnings) |
| Unit tests | `npm run test` | **75 passed / 75** (12 files) |
| Production build | `npm run build` | pass — `index.js` 163 kB, `charts` 163 kB, `table` 177 kB (gzip 46/52/56 kB) |
| E2E desktop | `npm run test:e2e -- --project=desktop-chrome` | **18 passed / 18** |
| E2E mobile | `npm run test:e2e -- --project=mobile-chrome` | **18 passed / 18** |
| Layout audit | `npm run audit:layout` | **35 / 35 page-device combinations clean** |
| Live site check | `npm run verify:live` | all pages return live rows, screener 42 hits, chart renders, 0 console errors |
| GitHub Actions CI | push to `main` | success |
| GitHub Pages deploy | push to `main` | success |

### What the E2E suite covers (live Binance API, no mocks)

1. The overview renders live market rows and the connection badge reports a
   sane state.
2. Search filters the table down to the matching pairs.
3. Sorting by 24 h change reorders the table.
4. The watchlist star survives a page reload.
5. The chart page draws candles and the indicators can be toggled.
6. The perpetual table shows contracts and a real funding rate.
7. The screener filters on real data across all markets.
8. The language toggle switches the interface and persists.
9. The mobile layout has no horizontal overflow.
10. The phone renders the card list, not the desktop grid.
11. The phone bottom navigation is visible and the sidebar is hidden.
12. The phone chart keeps the interval and indicator controls reachable.
13. The author X link points to https://x.com/0xkillcoin.

### What the unit suite covers

Price/percentage/precision formatting, tick-size → decimal derivation,
symbol splitting, quote-asset filtering, MA/EMA/RSI/MACD maths, MACD alignment,
K-line sorting and de-duplication, screener rules (gainers, losers, volume,
funding, spike, market and watchlist filters), watchlist and settings
persistence, corrupted-storage recovery, WebSocket subscribe/unsubscribe/
dispatch/reconnect, the bilingual dictionary and its structural parity.

## 4. Infrastructure

| Item | Status |
| --- | --- |
| GitHub repository | public, `main` branch, CI + deploy workflows |
| GitHub Pages | live at https://iiiiiiiiiiiiiKK.github.io/crypto-radar/ |
| Edge proxy (Cloudflare Worker) | deployed, optional, `VITE_PROXY_BASE` |
| Database | none — all data is public market data |
| Cron jobs | none required |
| R2 bucket | not used by this project |

### Environment variables (names only — no values)

`VITE_PROXY_BASE`, `VITE_SPOT_REST_BASE`, `VITE_SPOT_WS_BASE`,
`VITE_FUTURES_REST_BASE`, `VITE_FUTURES_WS_BASE`, `VITE_ALPHA_REST_BASE`,
`VITE_ALPHA_POLL_MS`, `VITE_BASE_PATH` (build time).

### Quotas and cost

- GitHub Pages: free for public repositories, bandwidth included.
- Cloudflare Workers free tier: 100 000 requests/day — far above the usage of
  a monitoring terminal.
- Binance public API: no key, no quota purchase; the documented rate limits
  (6000 request weight/min for spot, 2400/min for futures) apply. The client
  rotates hosts and backs off on HTTP 418/429.

## 5. Security review

| Area | Result |
| --- | --- |
| Secrets in the repository | none — the tree was scanned for token patterns before the first push |
| API keys / private keys | none — the project never asks for one |
| Open proxy | the edge proxy only forwards whitelisted market paths; unknown routes return 404, non-Binance paths return 400 |
| SSRF | impossible by construction — the upstream origin comes from a fixed list |
| Input validation | every API response is parsed with Zod before it reaches the UI |
| XSS | React escapes by default; no `dangerouslySetInnerHTML` anywhere |
| Local storage | all reads are wrapped so corrupted data cannot crash the app |
| Secrets in logs | the worker logs nothing |
| Destructive actions | none — the app is read-only |

**Credential hygiene note:** the GitHub, Cloudflare, Vercel and R2 credentials
supplied for this task were used through the environment only. None of them
were written into the repository, the build output or the deployed site. They
should still be rotated by the owner as a precaution, since they were shared
in plain text.

## 6. Known limitations and risks

1. **Alpha has no candlestick chart** — a Binance API limitation, stated in
   the UI.
2. **The futures WebSocket is blocked on some networks** — the app falls
   back to polling and says so.
3. **Binance rate limits aggressive clients** — HTTP 418/429 is common on
   shared IPs; the client rotates hosts and the edge proxy can be used.
4. **The screener's short-window rule uses the 24 h open price** — Binance
   does not publish a free short-interval change field for every symbol, so
   the rule is computed from `(last − open) / open` and labelled as such.
5. **The app is read-only** — it cannot place orders and must never be
   extended to do so without a separate security review.

## 7. Final status

**The project meets the release criteria.**

- Core features are implemented and verified against the live Binance API.
- The production build succeeds.
- 62 unit tests and 18 end-to-end runs (9 desktop + 9 mobile) pass.
- The important failure paths are handled and were exercised (HTTP 418,
  malformed payloads, corrupted storage, missing WebSocket).
- The security measures above are in place.
- The GitHub repository is public and the code is pushed.
- README (English + Chinese), LICENSE, `.env.example`, CI and deploy
  workflows are committed.
- The site is deployed and the production build was verified in a browser.

**Not complete / blocked:**

- Alpha candlestick charts — blocked by Binance (no public kline endpoint).
- Perpetual live WebSocket on networks that block `fstream.binance.com` —
  mitigated with a REST poll.

Both limitations are disclosed in the UI and in the README.
