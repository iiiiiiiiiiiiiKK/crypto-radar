import type { MarketId } from "@/types/market";

export interface ApiRoute {
  market: MarketId;
  /** Upstream path (without host), e.g. `/api/v3/ticker/24hr`. */
  path: string;
  params?: Record<string, string | number | boolean | undefined>;
}

/**
 * Binance serves the same REST API from several hostnames. When one of them
 * rate-limits the current IP (HTTP 418/429) the client automatically moves on
 * to the next candidate instead of failing the whole screen.
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
      "https://fapi1.binance.com",
      "https://fapi2.binance.com",
      "https://fapi3.binance.com",
      "https://fapi4.binance.com",
      "https://dstream.binance.com",
      "https://www.binance.com",
      // The data mirror serves the same v1 API from a separate edge.
      "https://data-api.binance.vision",
    ],
    ws: import.meta.env.VITE_FUTURES_WS_BASE ?? "wss://fstream.binance.com",
    prefix: "/fapi/v1",
  },
  alpha: {
    rest: [
      import.meta.env.VITE_ALPHA_REST_BASE ?? "https://www.binance.com",
      "https://www.binance.com",
    ],
    ws: "",
    prefix: "/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha",
  },
} as const;

export const PROXY_BASE = (import.meta.env.VITE_PROXY_BASE ?? "").replace(/\/$/, "");

/**
 * Build the URL for a route. When an edge proxy is configured we address the
 * proxy with a fixed, market scoped path — the proxy never accepts arbitrary
 * upstream URLs, so it cannot be abused as an open relay.
 */
export function buildUrl(route: ApiRoute, hostIndex = 0): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(route.params ?? {})) {
    if (value === undefined || value === "") continue;
    params.set(key, String(value));
  }
  const query = params.toString();

  if (!PROXY_BASE) {
    const upstream = UPSTREAM[route.market];
    const host = upstream.rest[hostIndex] ?? upstream.rest[0];
    return `${host}${route.path}${query ? `?${query}` : ""}`;
  }

  const upstream = UPSTREAM[route.market];
  const scoped = route.path.startsWith(upstream.prefix)
    ? route.path.slice(upstream.prefix.length)
    : route.path;
  return `${PROXY_BASE}/api/${route.market}${scoped}${query ? `?${query}` : ""}`;
}

/** All candidate hosts for a market, in the order they should be tried. */
export function restHosts(market: MarketId): readonly string[] {
  return UPSTREAM[market].rest;
}

/** Binance raw stream endpoint used for SUBSCRIBE / UNSUBSCRIBE multiplexing. */
export function wsEndpoint(market: "spot" | "futures"): string {
  return `${UPSTREAM[market].ws}/ws`;
}
