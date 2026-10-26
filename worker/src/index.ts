/**
 * Crypto Radar edge proxy.
 *
 * Some networks cannot reach the Binance futures endpoints directly: the exit
 * IP is rate limited (HTTP 418/429) or the WebSocket upgrade is blocked. This
 * Worker forwards a **fixed, market scoped** set of paths to the official
 * Binance API. It is deliberately not a general purpose proxy — the upstream
 * origin and the path prefix come from a whitelist, so it can never be used
 * to fetch arbitrary URLs.
 *
 * Binance serves the same API from several hostnames and reacts differently
 * to different client profiles. The Worker therefore walks a list of
 * (origin, header profile) combinations and keeps the first one that answers
 * with a usable response.
 *
 * Deployment: Cloudflare Workers (wrangler.toml).
 */

export interface Env {
  /** Comma separated list of allowed browser origins. "*" allows any. */
  ALLOWED_ORIGINS?: string;
  /** Upstream request timeout in milliseconds. */
  UPSTREAM_TIMEOUT_MS?: string;
}

interface RouteRule {
  /** Path prefix that the browser may call on the proxy. */
  prefix: string;
  /** Official Binance hostnames, tried in order. */
  origins: string[];
  /** How long a successful response may be cached (seconds). */
  cacheSeconds: number;
}

const ROUTES: RouteRule[] = [
  {
    prefix: "/api/spot",
    origins: [
      "https://api.binance.com",
      "https://api1.binance.com",
      "https://api2.binance.com",
      "https://api3.binance.com",
      "https://api4.binance.com",
      "https://data-api.binance.vision",
    ],
    cacheSeconds: 2,
  },
  {
    prefix: "/api/futures",
    origins: [
      "https://fapi.binance.com",
      "https://fapi1.binance.com",
      "https://fapi2.binance.com",
      "https://fapi3.binance.com",
      "https://fapi4.binance.com",
      "https://www.binance.com",
      "https://dstream.binance.com",
    ],
    cacheSeconds: 2,
  },
  {
    prefix: "/api/alpha",
    origins: ["https://www.binance.com"],
    cacheSeconds: 15,
  },
];

/**
 * Header profiles. Binance's edge treats a request that claims to be a
 * browser but carries no browser headers as automation, so both a plain
 * server profile and a full browser profile are tried.
 */
const HEADER_PROFILES: Record<string, Record<string, string>> = {
  server: {
    Accept: "application/json",
    "User-Agent": "crypto-radar-proxy/1.0 (+https://github.com/iiiiiiiiiiiiiKK/crypto-radar)",
  },
  browser: {
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    Referer: "https://www.binance.com/",
  },
};

/** Binance weights the ticker endpoints heavily — keep the cache short. */
const MAX_CACHE_SECONDS = 60;

/** Remember the origin that answered last for each route prefix. */
const preferredOrigin = new Map<string, string>();

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get("Origin") ?? "";
  const allowed = (env.ALLOWED_ORIGINS ?? "*")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const allowOrigin =
    allowed.includes("*") || allowed.includes(origin) ? origin || "*" : allowed[0] ?? "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
  });
}

interface UpstreamResult {
  status: number;
  body: string;
  origin: string;
}

/**
 * Fetches the upstream URL, rotating through the official hostnames and the
 * header profiles until one answers with a usable response.
 */
async function fetchUpstream(
  origins: string[],
  suffix: string,
  search: string,
  timeoutMs: number,
): Promise<UpstreamResult> {
  const preferred = preferredOrigin.get(origins[0]);
  const order = preferred
    ? [preferred, ...origins.filter((origin) => origin !== preferred)]
    : origins;

  let last: UpstreamResult = {
    status: 502,
    body: JSON.stringify({ error: "upstream_unreachable" }),
    origin: "",
  };

  for (const origin of order) {
    for (const profile of Object.values(HEADER_PROFILES)) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const upstream = await fetch(`${origin}${suffix}${search}`, {
          signal: controller.signal,
          headers: profile,
        });
        const body = await upstream.text();
        last = { status: upstream.status, body, origin };

        // 403/418/429 mean "this combination does not serve us" — try the next.
        if (upstream.status === 403 || upstream.status === 418 || upstream.status === 429) {
          continue;
        }
        preferredOrigin.set(origins[0], origin);
        return last;
      } catch (error) {
        last = {
          status: 502,
          body: JSON.stringify({
            error: "upstream_unreachable",
            detail: (error instanceof Error ? error.message : String(error)).slice(0, 140),
          }),
          origin,
        };
      } finally {
        clearTimeout(timer);
      }
    }
  }

  return last;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "GET") {
      return json({ error: "method_not_allowed" }, 405, cors);
    }

    const url = new URL(request.url);
    const rule = ROUTES.find((entry) => url.pathname.startsWith(entry.prefix));
    if (!rule) {
      return json({ error: "unknown_route" }, 404, cors);
    }

    // Only the documented upstream paths may be forwarded.
    const suffix = url.pathname.slice(rule.prefix.length);
    if (!/^\/(api\/v3|fapi\/v1|dapi\/v1|bapi\/defi\/v1)\/[A-Za-z0-9/_-]*$/.test(suffix)) {
      return json({ error: "invalid_path" }, 400, cors);
    }

    const upstreamUrl = `${rule.origins[0]}${suffix}${url.search}`;
    const cache = caches.default;
    const cacheKey = new Request(upstreamUrl, { method: "GET" });
    const cached = await cache.match(cacheKey);
    if (cached) {
      const response = new Response(cached.body, cached);
      response.headers.set("X-Cache", "HIT");
      for (const [key, value] of Object.entries(cors)) response.headers.set(key, value);
      return response;
    }

    const upstream = await fetchUpstream(
      rule.origins,
      suffix,
      url.search,
      Number(env.UPSTREAM_TIMEOUT_MS ?? 12_000),
    );

    const ok = upstream.status >= 200 && upstream.status < 300;
    if (ok) {
      ctx.waitUntil(
        cache.put(
          cacheKey,
          new Response(upstream.body, {
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Cache-Control": `public, max-age=${Math.min(rule.cacheSeconds, MAX_CACHE_SECONDS)}`,
            },
          }),
        ),
      );
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        ...cors,
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": ok
          ? `public, max-age=${Math.min(rule.cacheSeconds, MAX_CACHE_SECONDS)}`
          : "no-store",
        "X-Cache": "MISS",
        "X-Upstream-Origin": upstream.origin,
      },
    });
  },
};
