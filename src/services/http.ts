import { buildUrl, restHosts, type RestRoute } from "./endpoints";

/** A transport level failure with the HTTP status kept for the UI. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    readonly body: string,
  ) {
    super(`Binance request failed (${status}) for ${path}`);
    this.name = "HttpError";
  }
}

export class RateLimitError extends HttpError {
  constructor(status: number, path: string, body: string) {
    super(status, path, body);
    this.name = "RateLimitError";
  }
}

export class BlockedError extends HttpError {
  constructor(status: number, path: string, body: string) {
    super(status, path, body);
    this.name = "BlockedError";
  }
}

export class TimeoutError extends Error {
  constructor(path: string) {
    super(`Binance request timed out for ${path}`);
    this.name = "TimeoutError";
  }
}

export interface RequestOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
  retries?: number;
}

const DEFAULT_TIMEOUT = 20_000;

/** The host that answered last is tried first to keep the happy path warm. */
const preferredHost = new Map<string, number>();

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchJson<T>(route: RestRoute, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT, signal, retries = 2 } = options;
  const hosts = restHosts(route.market);
  const start = preferredHost.get(route.market) ?? 0;
  const order = [...hosts.slice(start), ...hosts.slice(0, start)];

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
        cache: "no-store",
      });
      const text = await response.text();

      if (!response.ok) {
        if (response.status === 418 || response.status === 429) {
          lastError = new RateLimitError(response.status, route.path, text.slice(0, 300));
          if (attempt < retries) {
            await sleep(220 * (attempt + 1));
            continue;
          }
          throw lastError;
        }
        if (response.status === 403 || response.status === 451) {
          lastError = new BlockedError(response.status, route.path, text.slice(0, 300));
          if (attempt < retries) {
            await sleep(220 * (attempt + 1));
            continue;
          }
          throw lastError;
        }
        lastError = new HttpError(response.status, route.path, text.slice(0, 300));
        if (response.status < 500 || attempt === retries) throw lastError;
      } else {
        try {
          const parsed = JSON.parse(text) as T;
          preferredHost.set(route.market, hostIndex);
          return parsed;
        } catch {
          throw new HttpError(response.status, route.path, "Malformed JSON response");
        }
      }
    } catch (error) {
      if (error instanceof HttpError && error.status < 500) throw error;
      if (error instanceof DOMException && error.name === "AbortError") {
        lastError = new TimeoutError(route.path);
      } else {
        lastError = error;
      }
      if (attempt === retries) break;
      await sleep(400 * 2 ** attempt + Math.random() * 250);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unknown request failure");
}

/** Human readable, actionable description of a transport error. */
export function describeError(error: unknown): string {
  if (error instanceof RateLimitError) {
    return `币安对当前网络限流（HTTP ${error.status}），已自动切换到其他官方域名。请稍后重试。`;
  }
  if (error instanceof BlockedError) {
    return `币安拒绝了当前网络的请求（HTTP ${error.status}）。该地区或网络可能无法访问合约接口。`;
  }
  if (error instanceof TimeoutError) {
    return "请求超时，行情源没有在预期时间内响应。";
  }
  if (error instanceof HttpError) {
    return `行情接口返回异常（HTTP ${error.status}）。`;
  }
  if (error instanceof Error) {
    if (/Failed to fetch|NetworkError|Load failed/i.test(error.message)) {
      return "无法连接到币安公开接口，请检查网络或代理设置。";
    }
    return error.message;
  }
  return String(error);
}
