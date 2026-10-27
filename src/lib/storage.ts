/**
 * localStorage with a namespace, a schema version and total failure tolerance.
 * Browsers in private mode, disabled storage or quota errors must never break
 * the terminal, so every access is wrapped.
 */

const PREFIX = "crypto-radar:v2:";

export const STORAGE_KEYS = {
  prefs: "prefs",
  watchlist: "watchlist",
  alerts: "alerts",
  radar: "radar",
  recent: "recent",
} as const;

function storage(): Storage | null {
  try {
    const probe = "__cr_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readJson<T>(key: string, fallback: T): T {
  const store = storage();
  if (!store) return fallback;
  try {
    const raw = store.getItem(PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): boolean {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

export function clearAll(): void {
  const store = storage();
  if (!store) return;
  try {
    const doomed: string[] = [];
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (key && key.startsWith(PREFIX)) doomed.push(key);
    }
    for (const key of doomed) store.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function isStorageAvailable(): boolean {
  return storage() !== null;
}

/** Persisted slice helper for zustand stores. */
export function loadSlice<T>(key: string, fallback: T, validate?: (value: unknown) => T | null): T {
  const raw = readJson<unknown>(key, undefined);
  if (raw === undefined) return fallback;
  if (!validate) return raw as T;
  const valid = validate(raw);
  return valid ?? fallback;
}

export function saveSlice(key: string, value: unknown): void {
  writeJson(key, value);
}

export function createId(prefix = "id"): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}
