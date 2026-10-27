import { buildUrl, restHosts, type ApiRoute } from "@/lib/constants/endpoints";

export class BinanceHttpError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    readonly body: string,
  ) {
    super(`Binance request failed (${status}) for ${path}`);
    this.name = "BinanceHttpError";
  }
}

/** HTTP 418 is Binance's "IP banned" answer, 429 is the classic rate limit. */
export class BinanceRateLimitError extends BinanceHttpError {
  constructor(status: number, path: string, body: string) {
    super(status, path, body);
    this.name = "BinanceRateLimitError";
  }
}

/**
 * The exchange refuses the request because of the client IP (HTTP 418/429 for
 * a rate limited IP, HTTP 451/403 for a blocked region or a datacenter IP).
 */
export class BinanceBlockedError extends BinanceHttpError {
  constructor(status: number, path: string, body: string) {
    super(status, path, body);
    this.name = "BinanceBlockedError";
  }
}

export interface RequestOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
  retries?: number;
}

const DEFAULT_TIMEOUT = 15_000;

/**
 * The host that answered last is tried first, which keeps the happy path on
 * a single connection and only rotates when a host starts rate-limiting.
 */
const preferredHost = new Map<string, number>();

export async function fetchJson<T>(route: ApiRoute, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT, signal, retries = 2 } = options;
  const hosts = restHosts(route.market);
  const start = preferredHost.get(route.market) ?? 0;
  const order = [
    ...hosts.slice(start),
    ...hosts.slice(0, start),
  ];

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const hostIndex = attempt % order.length;
    const url = buildUrl(route, hostIndex);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    signal?.addEventListener("abort", onAbort);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      const text = await response.text();

      if (!response.ok) {
        if (response.status === 418 || response.status === 429) {
          // This host is rate limiting us — try the next hostname instead.
          lastError = new BinanceRateLimitError(response.status, route.path, text.slice(0, 300));
          if (attempt < retries) {
            await sleep(200 * (attempt + 1));
            continue;
          }
          throw lastError;
        }
        if (response.status === 403 || response.status === 451) {
          // The edge refuses this client (blocked region or datacenter IP).
          lastError = new BinanceBlockedError(response.status, route.path, text.slice(0, 300));
          if (attempt < retries) {
            await sleep(200 * (attempt + 1));
            continue;
          }
          throw lastError;
        }
        const retryable = response.status >= 500;
        if (!retryable || attempt === retries) {
          throw new BinanceHttpError(response.status, route.path, text.slice(0, 300));
        }
        lastError = new BinanceHttpError(response.status, route.path, text.slice(0, 300));
      } else {
        try {
          const parsed = JSON.parse(text) as T;
          preferredHost.set(route.market, hostIndex);
          return parsed;
        } catch {
          throw new BinanceHttpError(response.status, route.path, "Malformed JSON response");
        }
      }
    } catch (error) {
      if (error instanceof BinanceRateLimitError) {
        lastError = error;
        if (attempt < retries) continue;
        throw error;
      }
      if (error instanceof BinanceHttpError && error.status < 500) throw error;
      lastError = error;
      if (attempt === retries) break;
      await sleep(400 * 2 ** attempt + Math.random() * 250);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unknown request failure");
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
