# 参与开发

## 本地环境

```bash
npm ci
npm run dev      # http://localhost:5173/crypto-radar/
```

Node >= 20。项目不依赖任何私有服务或密钥。

## 提交前必须通过

```bash
npm run verify   # typecheck + lint + unit tests + production build
```

浏览器相关改动请额外跑：

```bash
npm run preview                                   # 端口 4173
BASE_URL=http://127.0.0.1:4173/crypto-radar npm run e2e
BASE_URL=http://127.0.0.1:4173/crypto-radar npm run audit:layout
```

`e2e` 需要真实网络访问币安公开接口；`audit:layout` 会在 `docs/screenshots/` 生成 5 种视口的截图。

## 代码约定

* **数据永远不用 0 兜底**：缺失就是 `null`，UI 负责显示“不可用 / 采集中 / 数据不足”。
* 交易所字段与本地计算字段分开存放：交易所字段在 `TickerRow` 顶层，本地派生在 `TickerRow.d`。
* 新指标必须同时提供：实现 + 单元测试 + 界面上的口径说明。
* 新页面必须提供加载、空、错误三种状态。
* 组件不直接 `fetch`：所有网络请求走 `src/services/`，所有派生计算走 `src/engine/`。
* 不要给行情表加“每次 tick 全量重渲染”的逻辑；用 `useRow(key)` 行级订阅。
* CSS 使用设计令牌（`src/styles/tokens.css`），不要写死颜色。
* 动效必须能被 `prefers-reduced-motion` 与设置页的“减弱动效”降级。

## 新增一个数据源

1. 在 `src/services/` 实现适配器，实现 `MarketAdapter`（`loadTickers` / `loadMeta` / `fetchKlines`）。
2. 在 `src/services/index.ts` 注册。
3. 在 `src/engine/marketFeed` 中决定用 WebSocket 还是轮询，并在 `ConnectionState` 上如实反映。
4. 字段缺失时保持 `null`，并在界面标注口径。

## 提交信息

```
feat(radar): add divergence rule with volume baseline
fix(charts): release kline subscription on symbol switch
docs: record the 2.0 architecture
```
