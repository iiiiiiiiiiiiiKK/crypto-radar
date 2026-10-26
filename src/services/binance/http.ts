import { buildUrl, type ApiRoute } from "@/lib/constants/endpoints";

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

export interface RequestOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
  retries?: number;
}

const DEFAULT_TIMEOUT = 15_000;

export async function fetchJson<T>(route: ApiRoute, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT, signal, retries = 2 } = options;
  const url = buildUrl(route);
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
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
        // 4xx responses other than 429 are deterministic — retrying is pointless.
        const retryable = response.status === 429 || response.status >= 500;
        if (!retryable || attempt === retries) {
          throw new BinanceHttpError(response.status, route.path, text.slice(0, 300));
        }
        lastError = new BinanceHttpError(response.status, route.path, text.slice(0, 300));
      } else {
        try {
          return JSON.parse(text) as T;
        } catch {
          throw new BinanceHttpError(response.status, route.path, "Malformed JSON response");
        }
      }
    } catch (error) {
      if (error instanceof BinanceHttpError && error.status < 500 && error.status !== 429) throw error;
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
