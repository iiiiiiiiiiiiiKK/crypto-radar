# Architecture

```
src/
  app/            routing (React Router, basename = BASE_URL)
  components/
    layout/       app shell: top bar, sidebar, mobile nav
    market/       market table, column definitions, toolbar
    chart/        Lightweight Charts wrapper
    ui/           reusable primitives (badge, modal, spinner, states)
  features/
    spot/         overview + spot page, sorting/filtering rules
    futures/      perpetual futures page
    alpha/        Binance Alpha token page
    chart/        candlestick page, kline loading hook
    screener/     anomaly screener rules and page
    watchlist/    watchlist management page
    settings/     preferences page
  services/
    binance/      one adapter per market + shared HTTP client
    websocket/    shared WebSocket manager + market feed
    storage/      safe localStorage wrappers
  stores/         Zustand stores (market, settings, watchlists, ui)
  lib/            formatting, endpoints, constants
  i18n/           zh / en dictionary
  types/          shared domain types
```

## Data flow

1. `MarketFeed` asks the matching `MarketAdapter` for a REST snapshot.
2. The snapshot is pushed into the Zustand market store and rendered by
   `MarketTable`.
3. `WsManager` opens **one** socket per market and subscribes to
   `!miniTicker@arr`, which delivers every symbol of that market in a
   single frame.
4. Incoming deltas are buffered for 250 ms and then merged into the store,
   so a burst of updates causes one render instead of hundreds.
5. Heavy metadata (per-pair tick size, base/quote assets) is merged in
   afterwards through `applyMetadata`, so the first paint is not blocked by
   the multi-megabyte `exchangeInfo` payload.

## Adapter contract

```ts
interface MarketAdapter {
  readonly id: MarketId;
  listSymbols(): Promise<SymbolMeta[]>;
  listTickers(): Promise<MarketTicker[]>;
  listKlines(id, interval, limit?): Promise<Candle[]>;
  fetchExtras?(id): Promise<Partial<MarketTicker>>;
  applyMetadata?(tickers): Promise<MarketTicker[]>;
}
```

Each market keeps its own field set. The perpetual adapter adds
`markPrice`, `fundingRate`, `nextFundingTime` and `openInterest`; the
Alpha adapter adds `chainName`, `contractAddress` and `iconUrl`. Nothing is
invented to make the three markets look alike.

## WebSocket lifecycle

| State | Meaning |
| --- | --- |
| `connecting` | first connection attempt |
| `connected` | socket is open and frames are arriving |
| `reconnecting` | the socket dropped, exponential backoff is running |
| `disconnected` | closed on purpose (no subscribers left) |
| `stale` | open, but no frame for 30 s |
| `error` | the socket reported an error |

Reconnects use exponential backoff with a random jitter and restore every
subscription. A stream that stops delivering data is marked `stale` instead
of silently showing outdated prices.

## Performance

- Virtualised table (only the visible rows are in the DOM).
- 250 ms batching of websocket updates.
- Ticker map kept outside React state to avoid unnecessary re-renders.
- `exchangeInfo` cached in localStorage for six hours.
- Chart instances are created once and updated in place; toggling an
  indicator never remounts the page.
