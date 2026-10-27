import type { MarketId } from "@/types/market";

export interface RestRoute {
  market: Exclude<MarketId, "alpha"> | "alpha";
  path: string;
  params?: Record<string, string | number | boolean | undefined>;
}

/**
 * Official Binance hosts. The list is ordered: the first entry is the
 * documented production host, the rest are the exchange's own mirrors that are
 * used automatically when the primary host rate-limits or refuses the client.
 *
 * `data-api.binance.vision` only serves *market data* (it is Binance's public
 * data mirror) and is therefore only listed for the spot market.
 */
export const UPSTREAM = {
  spot: {
    rest: [
      import.meta.env.VITE_SPOT_REST_BASE ?? "https://api.binance.com",
      "https://api1.binance.com",
      "https://api2.binance.com",
      "https://api3.binance.com",
      "https://data-api.binance.vision",
    ],
    ws: import.meta.env.VITE_SPOT_WS_BASE ?? "wss://stream.binance.com:9443",
    prefix: "/api/v3",
  },
  futures: {
    rest: [
      import.meta.env.VITE_FUTURES_REST_BASE ?? "https://fapi.binance.com",
      "https://fapi.binance.com",
    ],
    ws: import.meta.env.VITE_FUTURES_WS_BASE ?? "wss://fstream.binance.com",
    prefix: "/fapi/v1",
  },
  alpha: {
    rest: [import.meta.env.VITE_ALPHA_REST_BASE ?? "https://www.binance.com"],
    ws: "",
    prefix: "/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha",
  },
} as const;

export const PROXY_BASE = (import.meta.env.VITE_PROXY_BASE ?? "").replace(/\/$/, "");

/**
 * Build a request URL. With a proxy configured the client addresses a fixed,
 * market-scoped path — the proxy never receives an arbitrary upstream URL, so
 * it cannot be turned into an open relay.
 */
export function buildUrl(route: RestRoute, hostIndex = 0): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(route.params ?? {})) {
    if (value === undefined || value === "") continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  const upstream = UPSTREAM[route.market];

  if (!PROXY_BASE) {
    const host = upstream.rest[hostIndex] ?? upstream.rest[0];
    return `${host}${route.path}${query ? `?${query}` : ""}`;
  }

  const scoped = route.path.startsWith(upstream.prefix)
    ? route.path.slice(upstream.prefix.length)
    : route.path;
  return `${PROXY_BASE}/api/${route.market}${scoped}${query ? `?${query}` : ""}`;
}

export function restHosts(market: RestRoute["market"]): readonly string[] {
  return UPSTREAM[market].rest;
}

export function wsEndpoint(market: "spot" | "futures"): string {
  return `${UPSTREAM[market].ws}/ws`;
}
