# Troubleshooting

## The table stays empty

1. Check the connection badge in the top bar.
   - **连接中 / Connecting** – the REST request is still in flight.
   - **重连中 / Reconnecting** – the websocket dropped and is retrying.
   - **已断开 / Disconnected** – no subscription is left.
2. Open the browser network tab and look for
   `api.binance.com/api/v3/ticker/24hr`.
   - **HTTP 418/429** – your IP is rate limited by Binance. Wait a few
     minutes; the app keeps retrying with backoff.
   - **Network error** – the endpoint is unreachable. In restricted networks
     set `VITE_PROXY_BASE` to the bundled edge proxy.

## Prices do not move

- The websocket needs to reach `stream.binance.com:9443` (spot) or
  `fstream.binance.com` (perpetual). Corporate firewalls and some proxies
  block WebSocket upgrades.
- The badge shows **数据延迟 / Stale** when frames stop arriving. Click
  `⟳` to force a fresh REST snapshot.

## The chart is empty for an Alpha token

Binance does not publish a public kline endpoint for Alpha tokens. The page
states this explicitly instead of drawing synthetic candles.

## The build fails on `@apply`

Design tokens are plain CSS custom properties in `src/styles/tokens.css`.
Do not use Tailwind opacity modifiers such as `bg-accent/12` with them —
use the ready-made component classes instead.

## Deep links return 404 on GitHub Pages

GitHub Pages has no SPA fallback. The bundled `public/404.html` stores the
requested URL and redirects back to the app, and the router then restores the
route.

## Local development shows no data

Binance blocks some regions. The app works through any standard HTTP proxy:

```bash
HTTP_PROXY=http://127.0.0.1:7897 HTTPS_PROXY=http://127.0.0.1:7897 npm run dev
```

For the browser, configure the proxy in the system settings or use the
bundled edge proxy through `VITE_PROXY_BASE`.
