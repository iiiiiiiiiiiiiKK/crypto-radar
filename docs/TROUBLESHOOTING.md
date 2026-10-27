# 故障排查

## 行情一直显示“连接中 / 已断开”

1. 打开浏览器控制台，看是否有 `net::ERR_NAME_NOT_RESOLVED`、`certificate` 或 `403/451`。
2. 直接访问 `https://api.binance.com/api/v3/ping` 与 `https://fapi.binance.com/fapi/v1/ping`：
   * 都返回 `{}` → 网络正常，问题在浏览器（扩展、代理、企业策略）。
   * 404/451/超时 → 当前网络无法直连币安，需要代理。
3. 部署环境（公司内网、部分云主机区域）常被封：此时请使用 `worker/` 中的 Cloudflare Worker 代理，
   构建时设置 `VITE_PROXY_BASE=https://<your-worker>.workers.dev`。
4. 现货可用但永续不可用是常见情况（两个域名独立），此时永续页面会显示错误横幅，现货与 Alpha 仍可用。

## 页面能打开但没有数据

* 首屏需要 `/api/v3/ticker/24hr`（约 1.5MB）。慢网络下 2–4 秒属正常，期间表格显示加载态。
* 若一直为空且连接状态是 `error`，请看 `ConnectionBanner` 里的具体文案（限流 / 拒绝 / 超时）。
* 打开 DevTools → Network，确认请求是否返回 `[{"symbol":"BTCUSDT",...}]`。

## 1m / 5m / 15m 涨跌幅一直是“--”

* 这些是**本地采样**指标。启动时会用 1 分钟 K 线为每个市场 60 个高流动性交易对补种，
  其余交易对需要本地累计约 5 分钟（15m 需要 15 分钟）才会出现。
* 若整页都是 `--`，说明补种请求失败（通常是 K 线接口被限流），刷新页面即可重试。

## 量能倍数（volumeSurge）为空

需要至少 5 个“每分钟成交额”历史窗口（约 5 分钟本地运行）才能算基准。页面隐藏时计时暂停。

## 持仓量显示“采集中”

* 只有永续合约有持仓量，且为逐交易对轮询（每 15 秒 12 个，覆盖前 120 个合约）。
* “持仓量变化”需要 5–10 分钟采样；在此之前显示“数据不足”是预期行为。

## Alpha 空白或报错

Alpha 使用币安 Alpha 页面自身的公开 web 接口，**不在官方文档范围内**，可能随时变更或加签名。
若失效：Alpha 页会显示错误文案，其余市场不受影响。此时不要在代码里猜测接口，等待新端点或改用代理。

## K 线不更新 / 切换交易对后还是旧图

* 图表使用独立 WebSocket（`<symbol>@kline_<interval>`）。切换时会先释放旧订阅再建立新订阅。
* 若状态显示“离线”，检查 `wss://stream.binance.com:9443` 是否被网络阻断（部分网络只封 ws）。
* 断线重连后会自动补一次 REST 历史，避免出现断层。

## 搜索里出现 IDR / TRY 之类的交易对

它们是真实存在的币安交易对。搜索会优先展示 USDT/USDC 计价的交易对；
表格右上角可以切换计价货币过滤。

## 本地数据想重置

设置页 → “清空本地数据”，或手动删除 `localStorage` 中以 `crypto-radar:v2:` 开头的键。

## GitHub Pages 刷新 404

`public/404.html` 会把路径存进 `sessionStorage` 并跳回应用入口；
如果用了自定义域名或不同 base，请同步修改 `VITE_BASE_PATH` 与 `404.html` 中的跳转地址。

## 构建/测试失败

```bash
npm run typecheck   # 类型
npm run lint        # 风格（0 warning 上限）
npm run test        # 单元测试
npm run build       # 产物
```

CI（`.github/workflows/ci.yml`）跑的就是这四步；部署工作流在 `deploy.yml`。
