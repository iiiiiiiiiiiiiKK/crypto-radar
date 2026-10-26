/**
 * A localStorage wrapper that never throws.
 *
 * Private-mode browsers, disabled storage and corrupted values are all handled
 * here so that the rest of the app can treat persistence as always available.
 */
export interface SafeStorage {
  get<T>(key: string, fallback: T): T;
  set(key: string, value: unknown): boolean;
  remove(key: string): boolean;
  available: boolean;
}

function createStorage(): Storage | null {
  try {
    const probe = "__cr_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

const backing = typeof window === "undefined" ? null : createStorage();

export const safeStorage: SafeStorage = {
  get available() {
    return backing !== null;
  },
  get<T>(key: string, fallback: T): T {
    if (!backing) return fallback;
    try {
      const raw = backing.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      // Corrupted payload — drop it so it cannot break the next start-up.
      try {
        backing.removeItem(key);
      } catch {
        /* ignore */
      }
      return fallback;
    }
  },
  set(key: string, value: unknown): boolean {
    if (!backing) return false;
    try {
      backing.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove(key: string): boolean {
    if (!backing) return false;
    try {
      backing.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },
};
