import { safeStorage } from "./safeStorage";

export interface WatchlistEntry {
  /** `spot:BTCUSDT`, `futures:BTCUSDT` or `alpha:ALPHA_1248`. */
  key: string;
  market: string;
  symbol: string;
  name?: string;
  iconUrl?: string;
  addedAt: number;
}

export interface Watchlist {
  id: string;
  name: string;
  entries: WatchlistEntry[];
  createdAt: number;
}

const STORAGE_KEY = "crypto-radar:watchlists:v1";

export const DEFAULT_WATCHLIST_NAMES = ["主力观察", "山寨币", "Alpha 观察", "永续合约", "长期持仓"];

function createId(): string {
  return `wl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function defaultWatchlists(): Watchlist[] {
  const now = Date.now();
  return DEFAULT_WATCHLIST_NAMES.map((name, index) => ({
    id: createId() + index,
    name,
    entries: [],
    createdAt: now + index,
  }));
}

/** Reads the persisted watchlists, repairing anything that does not validate. */
export function loadWatchlists(): Watchlist[] {
  const raw = safeStorage.get<unknown>(STORAGE_KEY, null);
  if (!Array.isArray(raw)) return defaultWatchlists();
  const lists = raw.filter(isWatchlist).map((list) => ({
    ...list,
    entries: list.entries.filter(isEntry),
  }));
  if (lists.length === 0) return defaultWatchlists();
  return lists;
}

export function saveWatchlists(lists: Watchlist[]): boolean {
  return safeStorage.set(STORAGE_KEY, lists);
}

export function isWatchlist(value: unknown): value is Watchlist {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    typeof v.createdAt === "number" &&
    Array.isArray(v.entries)
  );
}

export function isEntry(value: unknown): value is WatchlistEntry {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.key === "string" &&
    typeof v.market === "string" &&
    typeof v.symbol === "string" &&
    typeof v.addedAt === "number"
  );
}

export function makeEntry(
  market: string,
  symbol: string,
  meta?: { name?: string; iconUrl?: string },
): WatchlistEntry {
  return {
    key: `${market}:${symbol}`,
    market,
    symbol,
    name: meta?.name,
    iconUrl: meta?.iconUrl,
    addedAt: Date.now(),
  };
}
