# Contributing to Crypto Radar

Thanks for taking the time to improve Crypto Radar.

## Getting started

```bash
git clone https://github.com/iiiiiiiiiiiiiKK/crypto-radar.git
cd crypto-radar
npm install
npm run dev
```

The dev server listens on <http://localhost:5173>.

## Before you open a pull request

```bash
npm run typecheck   # tsc -b
npm run lint        # eslint, zero warnings allowed
npm run test        # vitest
npm run build       # production bundle
```

## Ground rules

- **Never fake market data.** Every number in the UI has to come from a real
  Binance endpoint. If a field cannot be fetched, render it as unavailable.
- **Keep the market adapters independent.** Spot, perpetual and Alpha have
  their own data shapes; do not merge them into one generic structure.
- **One websocket per market.** Use the shared `WsManager` so the app never
  opens more connections than necessary.
- **Add a test for new logic.** Pure functions (formatting, indicators, screener
  rules, storage) are covered by Vitest.
- **Respect the design tokens.** Colours live in `src/styles/tokens.css`; do
  not hard-code hex values inside components.

## Reporting bugs

Please include the market, the trading pair, the browser and what you expected
to happen.

## License

By contributing you agree that your work is released under the MIT License.
