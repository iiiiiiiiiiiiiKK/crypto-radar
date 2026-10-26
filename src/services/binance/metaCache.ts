import { safeStorage } from "@/services/storage/safeStorage";

/**
 * `exchangeInfo` is a multi-megabyte payload that barely changes. Caching it
 * in localStorage keeps the first paint fast on repeat visits.
 */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface CacheEnvelope<T> {
  at: number;
  value: T;
}

export function readMetaCache<T>(key: string): T | null {
  const envelope = safeStorage.get<CacheEnvelope<T> | null>(key, null);
  if (!envelope || typeof envelope.at !== "number") return null;
  if (Date.now() - envelope.at > CACHE_TTL_MS) {
    safeStorage.remove(key);
    return null;
  }
  return envelope.value ?? null;
}

export function writeMetaCache<T>(key: string, value: T): void {
  safeStorage.set(key, { at: Date.now(), value } satisfies CacheEnvelope<T>);
}
