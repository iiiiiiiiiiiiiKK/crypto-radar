# <div align="center">

# ◎ Crypto Radar

**A Meme-fuelled crypto war room.** Real Binance market data, a pixel-HUD terminal skin, a computed market mood, a game-style arena, an explainable event stream and a one-click meme card generator.

[English](README.md) · [中文](README.zh-CN.md) · [Live demo](https://iiiiiiiiiiiiiKK.github.io/crypto-radar/) · [X](https://x.com/0xkillcoin)

</div>

---

Crypto Radar 2.0 is a working market monitor with a personality, not a mock-up.
Every price, volume, funding rate and candle comes from the official public
Binance endpoints; every mood, ranking, event and card is computed from that
same live data — nothing is generated at random.

The redesign keeps the professional core (real feeds, real candles, real
indicators) and rebuilds the presentation around three ideas:

1. **The market has a mood** — a computed, explainable state (FOMO, greed,
   chop, fear, panic, dead liquidity) instead of a bare table.
2. **Rankings are a game** — a six-board arena built from live data.
3. **Data is content** — the event stream narrates what just happened, and
   Meme Studio turns a pair into a shareable PNG.

![Crypto Radar overview](docs/screenshots/overview.png)

## What it does

| Module | Highlights |
| --- | --- |
| **War-room home** | Mood dashboard, the arena and the event stream on the first screen, with the full table one switch away. |
| **Market overview** | One dense table for spot, perpetuals and Alpha tokens. Search, sort on every column, show/hide columns, reorder columns, switch the row density and filter by quote asset. |
| **Live prices** | One shared WebSocket per market (`!miniTicker@arr`) with batched 250 ms updates, price flash animations and an honest connection state. |
| **Candlestick charts** | Lightweight Charts with volume, 15 intervals, historical paging, a live-updating last candle, crosshair OHLC readout and a price line. |
| **Technical indicators** | MA, EMA, RSI and MACD — each toggleable, configurable and rendered on top of the chart without a page reload. |
| **Watchlists** | Multiple named lists, add/remove, rename, reorder, persisted in `localStorage` with corruption-safe reads. |
| **Market screener** | Scans spot, perpetual and Alpha at the same time and renders the anomalies in a virtualised table: strong gainers, strong losers, high volume, elevated funding, short-term moves and a custom rule set. |
| **Heatmap** | A turnover weighted treemap of the whole market: tile area is the 24 h turnover, colour is the 24 h change. One glance shows where the money is moving. |
| **Basis radar** | The same asset priced on spot and on the perpetual contract, with the premium between them and the funding rate annualised — a cross-market view neither a spot table nor a futures table can give. |
| **Price alerts** | Threshold rules evaluated against the live feed, delivered through a browser notification, persisted locally and re-armable. |
| **Market breadth** | Advancers versus decliners drawn as a single stacked bar next to the leaderboard tabs. |
| **24 h range bar** | Every row shows where the price sits between its 24 h low and high. |
| **Bilingual UI** | Complete Chinese and English interfaces driven by one dictionary, with the choice persisted. |

## Meme 2.0 surfaces

| Home — mood, arena, events | Arena |
| --- | --- |
| ![Home](docs/screenshots/home.png) | ![Arena](docs/screenshots/arena.png) |

| Event centre | Meme Studio |
| --- | --- |
| ![Events](docs/screenshots/events.png) | ![Studio](docs/screenshots/studio.png) |

| Trader base | Phone |
| --- | --- |
| ![Profile](docs/screenshots/profile.png) | ![Phone home](docs/screenshots/mobile-home.png) |

## Screenshots

| Spot | Perpetual futures |
| --- | --- |
| ![Spot market](docs/screenshots/spot.png) | ![Perpetual market](docs/screenshots/futures.png) |

| Alpha tokens | Candlestick chart |
| --- | --- |
| ![Alpha tokens](docs/screenshots/alpha.png) | ![Chart](docs/screenshots/chart.png) |

| Screener | Phone layout |
| --- | --- |
| ![Screener](docs/screenshots/screener.png) | ![Phone layout](docs/screenshots/mobile-spot.png) |

| Phone — spot | Phone — chart |
| --- | --- |
| ![Phone spot](docs/screenshots/mobile-spot.png) | ![Phone chart](docs/screenshots/mobile-chart.png) |

| Phone — Alpha | Phone — screener |
| --- | --- |
| ![Phone alpha](docs/screenshots/mobile-alpha.png) | ![Phone screener](docs/screenshots/mobile-screener.png) |

## The three features that set it apart

| Heatmap | Basis radar |
| --- | --- |
| ![Heatmap](docs/screenshots/heatmap.png) | ![Basis radar](docs/screenshots/basis.png) |

![Price alerts](docs/screenshots/alerts.png)

### 1. Turnover weighted heatmap

The table answers "what is moving"; the heatmap answers **where the money is**.
Every pair becomes a tile sized by its 24 h turnover and coloured by its 24 h
change, laid out with a squarified treemap so the tiles stay readable. One
click returns to the table and the leaderboard filters still apply.

### 2. Cross-market basis radar

Spot and perpetual are two books on the same asset. The radar joins them on the
base asset and shows the premium the contract trades at, plus the funding rate
annualised (three settlements a day). A pair trading at a premium while paying
positive funding is a carry cost; a discount paying negative funding is the
mirror image. No single-market table can show this.

### 3. Price alerts

Set a threshold (`above` / `below`) on any spot, perpetual or Alpha pair. The
engine watches the live feed while the terminal is open, fires a browser
notification on the crossing, disables the rule so it cannot spam, and keeps it
in `localStorage` so it survives a reload.

## Routes

| Route | What it is |
| --- | --- |
| `/` | War room: mood, arena, event stream, or the full table / heatmap |
| `/spot` `/perp` `/alpha` | Full market table for each venue |
| `/chart/:market/:symbol` | Candles, volume, MA/EMA on the price axis, RSI and MACD in their own panes |
| `/events` | Event centre with rule and severity filters and editable thresholds |
| `/studio` | Meme Studio — render a card from live data and export a PNG |
| `/basis` | Cross-market basis radar |
| `/screener` | Anomaly screener |
| `/alerts` | Price alerts |
| `/watchlists` | Watchlists |
| `/profile` | Trader base: theme, pixel avatar, default home view |
| `/settings` | Preferences |

## Data sources

All endpoints are public and need **no API key**:

| Market | REST | WebSocket |
| --- | --- | --- |
| Spot | `api.binance.com/api/v3` | `stream.binance.com:9443/ws` |
| Perpetual (USDⓈ-M) | `fapi.binance.com/fapi/v1` | `fstream.binance.com/ws` |
| Alpha tokens | `www.binance.com/bapi/defi/v1/.../alpha/all/token/list` | — (polled every 20 s) |

The Alpha module uses the public token-list endpoint that Binance itself calls
from the Alpha web app; it returns the price, 24 h change, volume, market cap,
liquidity and chain metadata of every Alpha token. **Binance does not publish
a public kline endpoint for Alpha tokens** — instead of inventing candles the
app states this explicitly on the chart page.

Perpetual-only fields (mark price, funding rate, next funding time, open
interest) are read from the dedicated futures endpoints, never from spot data.

## Tech stack

- **React 18** + **TypeScript 5** + **Vite 6**
- **Tailwind CSS 3** with a token-based dark theme
- **Zustand** for state
- **Lightweight Charts 4** (Apache-2.0) for the candlestick chart
- **TanStack Virtual** for the virtualised market table
- **Zod** for response validation
- **Vitest** for unit tests, **Playwright** for end-to-end tests

## Getting started

```bash
git clone https://github.com/iiiiiiiiiiiiiKK/crypto-radar.git
cd crypto-radar
npm install
npm run dev
```

The dev server runs on <http://localhost:5173>.

### Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type check and build the production bundle into `dist/` |
| `npm run preview` | Serve the production bundle locally |
| `npm run typecheck` | `tsc -b` without emitting |
| `npm run lint` | ESLint, zero warnings tolerated |
| `npm run test` | Vitest unit test suite |
| `npm run test:e2e` | Playwright end-to-end suite (uses live data) |
| `npm run audit:layout` | Check every page on five device profiles for overflow and clipping |
| `npm run verify:live` | Drive the deployed site against the live API |
| `npm run screenshots` | Capture the desktop and phone screenshots |
| `npm run verify` | typecheck → lint → test → build |

### Environment variables

Everything is optional — the app works out of the box against the official
Binance endpoints. See [`.env.example`](.env.example):

| Variable | Purpose |
| --- | --- |
| `VITE_PROXY_BASE` | Base URL of the bundled edge proxy. Leave empty to call Binance directly. |
| `VITE_SPOT_REST_BASE` / `VITE_FUTURES_REST_BASE` / `VITE_ALPHA_REST_BASE` | Override the upstream hosts. |
| `VITE_SPOT_WS_BASE` / `VITE_FUTURES_WS_BASE` | Override the websocket hosts. |
| `VITE_ALPHA_POLL_MS` | Alpha polling interval in milliseconds (default `20000`). |

## Deployment

### GitHub Pages (this repository)

The `.github/workflows/deploy.yml` workflow builds the app and publishes it to
GitHub Pages on every push to `main`:

1. **Settings → Pages → Build and deployment → Source**: choose **GitHub
   Actions**.
2. Push to `main` — the workflow runs type check, lint, unit tests and the
   production build, then deploys `dist/`.

Live URL: <https://iiiiiiiiiiiiiKK.github.io/crypto-radar/>

Because GitHub Pages has no SPA fallback, the repository ships a `404.html`
that restores deep links such as `/crypto-radar/spot`.

### Edge proxy (optional)

Some networks cannot reach the Binance futures endpoints directly — the exit IP
is rate limited (HTTP 418/429) or the WebSocket upgrade is blocked. The
repository bundles a **Cloudflare Worker** that forwards a fixed, market scoped
set of paths to Binance:

```bash
cd worker
npm install
npx wrangler deploy
```

Then point the front end at it:

```bash
VITE_PROXY_BASE=https://<your-worker>.workers.dev npm run build
```

The proxy is **not** an open relay: the upstream origin and the path prefix
come from a whitelist, unknown routes return `404` and paths outside the
documented Binance API are rejected with `400`.

### Anywhere else

```bash
npm run build
```

`dist/` is a static bundle — it can be hosted on Vercel, Cloudflare Pages,
Netlify or any static host. Set `VITE_BASE_PATH` at build time when the site
is served from a sub-path.

## How the live data works

- **One socket per market.** `WsManager` multiplexes every subscription over
  a single connection, so the app never opens one socket per table row.
- **Batched updates.** Incoming frames are buffered for 250 ms and merged into
  a ticker map, which keeps a busy market from re-rendering the whole table on
  every message.
- **Honest state.** The badge shows *Connecting*, *Live*, *Reconnecting*,
  *Disconnected*, *Delayed* or *Error*. When frames stop arriving for 30
  seconds the feed is marked **stale** instead of pretending the price is live.
- **Backoff with jitter.** Reconnects use exponential backoff plus a random
  jitter and restore every subscription afterwards.
- **Fast first paint.** The 24 h ticker list is fetched first; the heavy
  `exchangeInfo` payload (per-pair tick size, base and quote asset) is merged
  in afterwards and cached for six hours.

## Testing

```bash
npm run test        # 62 unit tests
npm run test:e2e    # 9 Playwright tests x desktop + mobile viewports
npm run verify:live # drives the deployed site against the live API
```

The unit suite covers price/percentage/precision formatting, indicator maths
(MA, EMA, RSI, MACD), API response parsing, screener rules, K-line ordering,
watchlist and settings persistence, the WebSocket subscription/reconnect
logic and the bilingual dictionary.

The end-to-end suite drives a real browser against the **live** Binance API and
checks that rows render, search filters, sorting works, the watchlist survives
a reload, the chart draws candles and indicators, the perpetual table shows
futures-only data (funding rate), the screener filters on real data, the
language toggle switches the interface and that the mobile layout does not
overflow horizontally.

## Security and privacy

- **No API keys, ever.** The project only uses public market data and never
  asks for an exchange key or secret.
- **No trading.** Crypto Radar is a monitoring tool; it cannot place orders.
- **No private data.** Watchlists and preferences stay in your own browser's
  `localStorage`. Nothing is uploaded anywhere.
- **No open proxy.** The optional edge proxy only forwards a fixed, market
  scoped set of paths to Binance — it cannot be used to fetch arbitrary URLs.
- **Validated responses.** Every API payload is parsed with Zod before it
  reaches the UI.
- **Defensive storage.** Corrupted `localStorage` values are discarded
  instead of crashing the app.

## Known limitations

- Binance does not publish Alpha klines, so Alpha tokens have no candlestick
  chart.
- Alpha prices are polled (every 20 s) because Binance exposes no Alpha
  websocket.
- Funding rate, mark price and open interest are only available for perpetual
  contracts.
- In regions where Binance blocks the API, direct calls fail with HTTP 418/429.
  The client rotates through Binance's official hostnames, and the bundled edge
  proxy repeats the rotation from a server-side IP.
- The screener uses the 24 h open price for the short-window calculation
  because Binance does not publish a free short-interval change field for
  every symbol.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Architecture notes are in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and common problems are listed in
[docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

## License

[MIT](LICENSE) © Crypto Radar contributors.

Data is provided by the public Binance API; TradingView Lightweight Charts is
licensed under Apache-2.0.

<div align="center">
  <a href="https://x.com/0xkillcoin">
    <img src="https://img.shields.io/badge/X-%40killcoin-0F1715?style=flat-square&logo=x&logoColor=white" alt="Follow on X" />
  </a>
</div>
